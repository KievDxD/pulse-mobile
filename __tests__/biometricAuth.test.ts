import {
  authenticateWithBiometrics,
  authenticateWithPin,
  clearAuthSession,
  DEFAULT_PIN,
  getStoredAuthSession,
  inspectBiometricHardware,
  instantDemoUnlock,
} from '../src/services/biometricAuth';

describe('Biometric & PIN Security Service', () => {
  beforeEach(async () => {
    await clearAuthSession();
  });

  it('inspects native biometric hardware and SecureStore enclave capabilities', async () => {
    const info = await inspectBiometricHardware();
    expect(info.hasHardware).toBe(true);
    expect(info.isEnrolled).toBe(true);
    expect(info.supportedTypes).toContain('Face ID / Facial Recognition');
    expect(info.securityLevel).toBe('CLASS_3_BIOMETRIC_STRONG');
  });

  it('authenticates via native biometrics and persists encrypted session', async () => {
    const result = await authenticateWithBiometrics();
    expect(result.success).toBe(true);
    expect(result.method).toBe('BIOMETRIC');

    const session = await getStoredAuthSession();
    expect(session?.method).toBe('BIOMETRIC');
  });

  it('validates fallback security PIN 2026 and rejects incorrect PINs', async () => {
    const failed = await authenticateWithPin('9999');
    expect(failed.success).toBe(false);
    expect(failed.error).toContain('2026');

    const passed = await authenticateWithPin(DEFAULT_PIN);
    expect(passed.success).toBe(true);
    expect(passed.method).toBe('PIN');
  });

  it('grants immediate access via 1-click Instant Demo Unlock', async () => {
    const demo = await instantDemoUnlock();
    expect(demo.success).toBe(true);
    expect(demo.method).toBe('DEMO_BYPASS');

    const session = await getStoredAuthSession();
    expect(session?.method).toBe('DEMO_BYPASS');
  });
});
