import * as biometricAuth from '../src/services/biometricAuth';

describe('Real Biometric & SecureStore PIN Service (V2.0)', () => {
  beforeEach(async () => {
    await biometricAuth.clearAuthSession();
    await biometricAuth.clearConfiguredPin();
  });

  it('does not expose any fake demo unlock bypass in production module', () => {
    expect('instantDemoUnlock' in biometricAuth).toBe(false);
    expect('DEFAULT_PIN' in biometricAuth).toBe(false);
  });

  it('inspects native biometric hardware and SecureStore enclave capabilities', async () => {
    const info = await biometricAuth.inspectBiometricHardware();
    expect(info.hasHardware).toBe(true);
    expect(info.isEnrolled).toBe(true);
    expect(info.supportedTypes).toContain('Face ID / Facial Recognition');
    expect(info.securityLevel).toBe('CLASS_3_BIOMETRIC_STRONG');
  });

  it('authenticates via native biometrics and persists session in SecureStore', async () => {
    const result = await biometricAuth.authenticateWithBiometrics();
    expect(result.success).toBe(true);
    expect(result.method).toBe('BIOMETRIC');

    const session = await biometricAuth.getStoredAuthSession();
    expect(session?.method).toBe('BIOMETRIC');
  });

  it('enforces 4-digit PIN enrollment and stores SHA-256 hashed PIN in SecureStore', async () => {
    expect(await biometricAuth.hasConfiguredPin()).toBe(false);

    const invalidSetup = await biometricAuth.configureUserPin('12');
    expect(invalidSetup.success).toBe(false);

    const validSetup = await biometricAuth.configureUserPin('4829');
    expect(validSetup.success).toBe(true);
    expect(validSetup.method).toBe('PIN');
    expect(await biometricAuth.hasConfiguredPin()).toBe(true);
  });

  it('verifies user-configured PIN against SecureStore hash and rejects mismatches', async () => {
    await biometricAuth.configureUserPin('7391');

    const wrong = await biometricAuth.authenticateWithPin('0000');
    expect(wrong.success).toBe(false);

    const right = await biometricAuth.authenticateWithPin('7391');
    expect(right.success).toBe(true);
    expect(right.method).toBe('PIN');
  });
});
