import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const DEFAULT_PIN = '2026';
const SESSION_TOKEN_KEY = 'pulse_mobile_auth_session_v1';
const PIN_STORE_KEY = 'pulse_mobile_pin_v1';

export type AuthMethod = 'BIOMETRIC' | 'PIN' | 'DEMO_BYPASS';

export interface BiometricHardwareInfo {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: string[];
  securityLevel: string;
  platform: string;
  storageDriver: string;
}

export interface AuthResult {
  success: boolean;
  method: AuthMethod;
  token?: string;
  error?: string;
}

const memoryFallbackStore = new Map<string, string>();

async function writeSecureValue(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    memoryFallbackStore.set(key, value);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage quota errors in restricted web contexts
    }
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    memoryFallbackStore.set(key, value);
  }
}

async function readSecureValue(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(key);
        if (stored !== null) return stored;
      }
    } catch {
      // Ignore web storage access errors
    }
    return memoryFallbackStore.get(key) ?? null;
  }

  try {
    const val = await SecureStore.getItemAsync(key);
    return val ?? memoryFallbackStore.get(key) ?? null;
  } catch {
    return memoryFallbackStore.get(key) ?? null;
  }
}

async function deleteSecureValue(key: string): Promise<void> {
  memoryFallbackStore.delete(key);
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore web storage access errors
    }
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore native deletion errors
  }
}

function mapAuthTypeName(type: LocalAuthentication.AuthenticationType): string {
  switch (type) {
    case LocalAuthentication.AuthenticationType.FINGERPRINT:
      return 'Fingerprint / Touch ID';
    case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
      return 'Face ID / Facial Recognition';
    case LocalAuthentication.AuthenticationType.IRIS:
      return 'Iris Scanner';
    default:
      return 'Biometric Sensor';
  }
}

function mapSecurityLevelName(level: LocalAuthentication.SecurityLevel): string {
  switch (level) {
    case LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG:
      return 'CLASS_3_BIOMETRIC_STRONG';
    case LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK:
      return 'CLASS_2_BIOMETRIC_WEAK';
    case LocalAuthentication.SecurityLevel.SECRET:
      return 'DEVICE_CREDENTIAL_SECRET';
    default:
      return 'SOFTWARE_FALLBACK';
  }
}

/**
 * Inspects native biometric capabilities and secure enclave driver availability.
 */
export async function inspectBiometricHardware(): Promise<BiometricHardwareInfo> {
  const storageDriver =
    Platform.OS === 'web'
      ? 'Web Storage Fallback (Use Native iOS/Android for Keychain/Keystore)'
      : Platform.OS === 'ios'
      ? 'iOS Keychain (expo-secure-store)'
      : 'Android Keystore AES-256 (expo-secure-store)';

  if (Platform.OS === 'web') {
    return {
      hasHardware: false,
      isEnrolled: false,
      supportedTypes: ['PIN Fallback (2026)', 'Instant Demo Unlock'],
      securityLevel: 'WEB_SANDBOX_FALLBACK',
      platform: Platform.OS,
      storageDriver,
    };
  }

  try {
    const [hasHardware, isEnrolled, rawTypes, rawLevel] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);

    const supportedTypes =
      rawTypes.length > 0 ? rawTypes.map(mapAuthTypeName) : ['Device PIN (2026)'];

    return {
      hasHardware,
      isEnrolled,
      supportedTypes,
      securityLevel: mapSecurityLevelName(rawLevel),
      platform: Platform.OS,
      storageDriver,
    };
  } catch {
    return {
      hasHardware: false,
      isEnrolled: false,
      supportedTypes: ['PIN Fallback (2026)'],
      securityLevel: 'EMULATOR_FALLBACK',
      platform: Platform.OS,
      storageDriver,
    };
  }
}

async function persistSession(method: AuthMethod): Promise<string> {
  const token = `pulse_sec_${method.toLowerCase()}_${Date.now()}`;
  await writeSecureValue(
    SESSION_TOKEN_KEY,
    JSON.stringify({ token, method, issuedAt: new Date().toISOString() })
  );
  return token;
}

/**
 * Prompts native FaceID / TouchID / Fingerprint authentication via expo-local-authentication.
 */
export async function authenticateWithBiometrics(): Promise<AuthResult> {
  if (Platform.OS === 'web') {
    return {
      success: false,
      method: 'BIOMETRIC',
      error: 'Native biometric prompt is unavailable on Web. Use PIN 2026 or Instant Demo Unlock.',
    };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      return {
        success: false,
        method: 'BIOMETRIC',
        error: 'Biometric hardware not enrolled on this device/emulator. Use PIN 2026 or Instant Demo Unlock.',
      };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'PULSE // MOBILE Clearance',
      fallbackLabel: 'Use Security PIN (2026)',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (result.success) {
      const token = await persistSession('BIOMETRIC');
      return { success: true, method: 'BIOMETRIC', token };
    }

    return {
      success: false,
      method: 'BIOMETRIC',
      error: result.error || 'Biometric authentication cancelled or rejected.',
    };
  } catch {
    return {
      success: false,
      method: 'BIOMETRIC',
      error: 'Biometric prompt failed. Use Security PIN (2026) or Instant Demo Unlock.',
    };
  }
}

/**
 * Validates security PIN against SecureStore or default operator PIN (`2026`).
 */
export async function authenticateWithPin(pin: string): Promise<AuthResult> {
  const storedPin = (await readSecureValue(PIN_STORE_KEY)) ?? DEFAULT_PIN;
  if (pin.trim() !== storedPin) {
    return {
      success: false,
      method: 'PIN',
      error: 'Invalid clearance PIN. Default operator PIN is 2026.',
    };
  }

  const token = await persistSession('PIN');
  return { success: true, method: 'PIN', token };
}

/**
 * Immediate 1-click clearance bypass for recruiters reviewing on emulators or web browsers.
 */
export async function instantDemoUnlock(): Promise<AuthResult> {
  const token = await persistSession('DEMO_BYPASS');
  return { success: true, method: 'DEMO_BYPASS', token };
}

export async function getStoredAuthSession(): Promise<{
  token: string;
  method: AuthMethod;
  issuedAt: string;
} | null> {
  const raw = await readSecureValue(SESSION_TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { token: string; method: AuthMethod; issuedAt: string };
  } catch {
    return null;
  }
}

export async function clearAuthSession(): Promise<void> {
  await deleteSecureValue(SESSION_TOKEN_KEY);
}
