import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { generateIntegrityHashAsync } from '../utils/hash';

const SESSION_TOKEN_KEY = 'pulse_mobile_auth_session_v2';
const PIN_HASH_KEY = 'pulse_mobile_pin_sha256_v2';
const PIN_SALT_PREFIX = 'pulse_pin_enclave_v2:';

export type AuthMethod = 'BIOMETRIC' | 'PIN';

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
      // Ignore web storage errors
    }
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore native delete errors
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
      ? 'Web Storage Fallback (Keychain/Keystore active on iOS/Android)'
      : Platform.OS === 'ios'
      ? 'iOS Keychain (expo-secure-store)'
      : 'Android Keystore AES-256 (expo-secure-store)';

  if (Platform.OS === 'web') {
    return {
      hasHardware: false,
      isEnrolled: false,
      supportedTypes: ['Encrypted User PIN (SHA-256)'],
      securityLevel: 'WEB_CRYPTO_FALLBACK',
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
      rawTypes.length > 0 ? rawTypes.map(mapAuthTypeName) : ['Encrypted User PIN'];

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
      supportedTypes: ['Encrypted User PIN'],
      securityLevel: 'UNAVAILABLE_FALLBACK',
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
 * Checks whether the operator has already configured an encrypted 4-digit PIN in SecureStore.
 */
export async function hasConfiguredPin(): Promise<boolean> {
  const storedHash = await readSecureValue(PIN_HASH_KEY);
  return typeof storedHash === 'string' && storedHash.startsWith('sha256:');
}

/**
 * Creates or updates the operator's 4-digit PIN, hashing it with SHA-256 before storing in SecureStore.
 */
export async function configureUserPin(pin: string): Promise<AuthResult> {
  const clean = pin.trim();
  if (!/^\d{4}$/.test(clean)) {
    return {
      success: false,
      method: 'PIN',
      error: 'Security PIN must be exactly 4 numeric digits.',
    };
  }

  const digest = await generateIntegrityHashAsync(`${PIN_SALT_PREFIX}${clean}`);
  await writeSecureValue(PIN_HASH_KEY, digest);
  const token = await persistSession('PIN');
  return { success: true, method: 'PIN', token };
}

/**
 * Prompts native FaceID / TouchID / Fingerprint authentication via expo-local-authentication.
 */
export async function authenticateWithBiometrics(): Promise<AuthResult> {
  if (Platform.OS === 'web') {
    return {
      success: false,
      method: 'BIOMETRIC',
      error: 'Web browser lacks native biometric hardware. Authenticate with your encrypted 4-digit PIN.',
    };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      return {
        success: false,
        method: 'BIOMETRIC',
        error: 'No enrolled biometric credentials detected on this device. Use your encrypted 4-digit PIN.',
      };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'PULSE // MOBILE Biometric Authentication',
      fallbackLabel: 'Use Security PIN',
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
      error: result.error || 'Biometric verification cancelled or rejected.',
    };
  } catch {
    return {
      success: false,
      method: 'BIOMETRIC',
      error: 'Biometric authentication failed. Verify with your encrypted 4-digit PIN.',
    };
  }
}

/**
 * Verifies the user's 4-digit PIN against its SHA-256 hash stored in SecureStore.
 */
export async function authenticateWithPin(pin: string): Promise<AuthResult> {
  const clean = pin.trim();
  const storedHash = await readSecureValue(PIN_HASH_KEY);
  if (!storedHash) {
    return {
      success: false,
      method: 'PIN',
      error: 'No security PIN configured yet. Complete initial PIN enrollment first.',
    };
  }

  const candidateHash = await generateIntegrityHashAsync(`${PIN_SALT_PREFIX}${clean}`);
  if (candidateHash !== storedHash) {
    return {
      success: false,
      method: 'PIN',
      error: 'Invalid security PIN. Please try again.',
    };
  }

  const token = await persistSession('PIN');
  return { success: true, method: 'PIN', token };
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

export async function clearConfiguredPin(): Promise<void> {
  await deleteSecureValue(PIN_HASH_KEY);
}
