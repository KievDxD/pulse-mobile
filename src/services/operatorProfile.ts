import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { OperatorProfile } from '../types/operations';

const OPERATOR_PROFILE_KEY = 'pulse_mobile_operator_profile_v3';

export const DEFAULT_OPERATOR_PROFILE: OperatorProfile = {
  operatorId: 'OP-UNASSIGNED',
  callsign: 'FIELD-UNIT',
  unitSector: 'SECTOR-01',
};

const memoryProfileFallback = new Map<string, string>();

export function validateOperatorProfile(input: OperatorProfile): {
  valid: boolean;
  sanitized: OperatorProfile;
  error?: string;
} {
  const sanitized: OperatorProfile = {
    operatorId: input.operatorId.trim().toUpperCase(),
    callsign: input.callsign.trim().toUpperCase(),
    unitSector: input.unitSector.trim().toUpperCase(),
  };

  if (sanitized.operatorId.length < 2) {
    return {
      valid: false,
      sanitized,
      error: 'Operator ID must be at least 2 characters.',
    };
  }
  if (sanitized.callsign.length < 2) {
    return {
      valid: false,
      sanitized,
      error: 'Callsign / Name must be at least 2 characters.',
    };
  }
  if (sanitized.unitSector.length < 2) {
    return {
      valid: false,
      sanitized,
      error: 'Unit / Sector must be at least 2 characters.',
    };
  }

  return { valid: true, sanitized };
}

export async function saveOperatorProfile(
  profile: OperatorProfile
): Promise<{ ok: boolean; profile: OperatorProfile; error?: string }> {
  const check = validateOperatorProfile(profile);
  if (!check.valid) {
    return { ok: false, profile: check.sanitized, error: check.error };
  }

  const serialized = JSON.stringify(check.sanitized);
  memoryProfileFallback.set(OPERATOR_PROFILE_KEY, serialized);

  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(OPERATOR_PROFILE_KEY, serialized);
      }
    } catch {
      // Ignore web storage errors
    }
    return { ok: true, profile: check.sanitized };
  }

  try {
    await SecureStore.setItemAsync(OPERATOR_PROFILE_KEY, serialized);
  } catch {
    // Fallback already persisted in memory
  }

  return { ok: true, profile: check.sanitized };
}

export async function loadOperatorProfile(): Promise<OperatorProfile> {
  let raw: string | null = null;

  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        raw = window.localStorage.getItem(OPERATOR_PROFILE_KEY);
      }
    } catch {
      raw = null;
    }
    if (!raw) raw = memoryProfileFallback.get(OPERATOR_PROFILE_KEY) ?? null;
  } else {
    try {
      raw = await SecureStore.getItemAsync(OPERATOR_PROFILE_KEY);
    } catch {
      raw = memoryProfileFallback.get(OPERATOR_PROFILE_KEY) ?? null;
    }
  }

  if (!raw) return DEFAULT_OPERATOR_PROFILE;

  try {
    const parsed = JSON.parse(raw) as Partial<OperatorProfile>;
    if (
      typeof parsed.operatorId === 'string' &&
      typeof parsed.callsign === 'string' &&
      typeof parsed.unitSector === 'string'
    ) {
      return {
        operatorId: parsed.operatorId,
        callsign: parsed.callsign,
        unitSector: parsed.unitSector,
      };
    }
    return DEFAULT_OPERATOR_PROFILE;
  } catch {
    return DEFAULT_OPERATOR_PROFILE;
  }
}

export async function clearOperatorProfile(): Promise<void> {
  memoryProfileFallback.delete(OPERATOR_PROFILE_KEY);
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(OPERATOR_PROFILE_KEY);
      }
    } catch {
      // Ignore web storage cleanup error
    }
    return;
  }

  try {
    await SecureStore.deleteItemAsync(OPERATOR_PROFILE_KEY);
  } catch {
    // Ignore native cleanup error
  }
}
