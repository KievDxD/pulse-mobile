import { useRouter } from 'expo-router';
import {
  Delete,
  Fingerprint,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  authenticateWithBiometrics,
  authenticateWithPin,
  BiometricHardwareInfo,
  clearAuthSession,
  configureUserPin,
  hasConfiguredPin,
  inspectBiometricHardware,
} from '../src/services/biometricAuth';
import { usePulseStore } from '../src/store/usePulseStore';
import { MIN_TOUCH_TARGET_DP, useAdaptiveLayout } from '../src/theme/adaptive';
import { COLORS } from '../src/theme/colors';
import { triggerHaptic } from '../src/utils/haptics';

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['CLR', '0', 'DEL'],
] as const;

export default function LockScreen() {
  const router = useRouter();
  const layout = useAdaptiveLayout();

  const isUnlocked = usePulseStore((s) => s.isUnlocked);
  const authMethod = usePulseStore((s) => s.authMethod);
  const unlockSession = usePulseStore((s) => s.unlockSession);
  const lockSession = usePulseStore((s) => s.lockSession);

  const [pin, setPin] = useState('');
  const [setupStage, setSetupStage] = useState<'LOADING' | 'CREATE' | 'CONFIRM' | 'VERIFY'>(
    'LOADING'
  );
  const [pendingPin, setPendingPin] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [hardware, setHardware] = useState<BiometricHardwareInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const autoPromptTriggered = useRef(false);

  const completeUnlock = useCallback(
    async (method: 'BIOMETRIC' | 'PIN') => {
      await triggerHaptic('success');
      unlockSession(method);
      router.replace('/(tabs)');
    },
    [router, unlockSession]
  );

  const handleBiometricAuth = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setStatusMessage(null);
    setIsError(false);
    await triggerHaptic('medium');

    const result = await authenticateWithBiometrics();
    setBusy(false);

    if (result.success) {
      await completeUnlock('BIOMETRIC');
      return;
    }

    await triggerHaptic('warning');
    setIsError(true);
    setStatusMessage(
      result.error ?? 'Biometric verification unavailable. Authenticate using your security PIN.'
    );
  }, [busy, completeUnlock]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [info, pinExists] = await Promise.all([
        inspectBiometricHardware(),
        hasConfiguredPin(),
      ]);
      if (!active) return;

      setHardware(info);
      setSetupStage(pinExists ? 'VERIFY' : 'CREATE');

      if (!isUnlocked && info.hasHardware && info.isEnrolled && !autoPromptTriggered.current) {
        autoPromptTriggered.current = true;
        const result = await authenticateWithBiometrics();
        if (active && result.success) {
          await completeUnlock('BIOMETRIC');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [completeUnlock, isUnlocked]);

  const handlePinComplete = async (enteredPin: string) => {
    if (busy || setupStage === 'LOADING') return;

    if (setupStage === 'CREATE') {
      setPendingPin(enteredPin);
      setPin('');
      setSetupStage('CONFIRM');
      setIsError(false);
      setStatusMessage('Re-enter the 4-digit PIN to encrypt and store it in SecureStore.');
      return;
    }

    if (setupStage === 'CONFIRM') {
      if (enteredPin !== pendingPin) {
        await triggerHaptic('error');
        setPin('');
        setPendingPin('');
        setSetupStage('CREATE');
        setIsError(true);
        setStatusMessage('PIN confirmation mismatch. Choose a new 4-digit security PIN.');
        return;
      }

      setBusy(true);
      const res = await configureUserPin(enteredPin);
      setBusy(false);

      if (res.success) {
        setSetupStage('VERIFY');
        await completeUnlock('PIN');
      } else {
        await triggerHaptic('error');
        setPin('');
        setIsError(true);
        setStatusMessage(res.error ?? 'Failed to store PIN in SecureStore.');
      }
      return;
    }

    setBusy(true);
    const result = await authenticateWithPin(enteredPin);
    setBusy(false);

    if (result.success) {
      await completeUnlock('PIN');
      return;
    }

    await triggerHaptic('error');
    setIsError(true);
    setStatusMessage(result.error ?? 'Invalid security PIN.');
    setPin('');
  };

  const handleKeyPress = async (key: string) => {
    if (setupStage === 'LOADING') return;
    await triggerHaptic('light');
    setIsError(false);

    if (key === 'CLR') {
      setPin('');
      if (setupStage === 'CONFIRM') {
        setPendingPin('');
        setSetupStage('CREATE');
      }
      setStatusMessage(null);
      return;
    }

    if (key === 'DEL') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }

    if (pin.length >= 4) return;
    const nextPin = `${pin}${key}`;
    setPin(nextPin);

    if (nextPin.length === 4) {
      await handlePinComplete(nextPin);
    }
  };

  const handleLockTerminal = async () => {
    await triggerHaptic('warning');
    await clearAuthSession();
    lockSession();
    setPin('');
    setIsError(false);
    setStatusMessage('Terminal sealed. Biometric or PIN verification required to resume.');
  };

  const isSplitLayout = layout.canSplitTwoColumns;

  const pinInstruction =
    setupStage === 'CREATE'
      ? 'First-time setup: Create your personal 4-digit security PIN'
      : setupStage === 'CONFIRM'
      ? 'Confirm your 4-digit security PIN to encrypt in SecureStore'
      : setupStage === 'VERIFY'
      ? 'Enter your encrypted 4-digit operator PIN'
      : 'Inspecting SecureStore enclave...';

  return (
    <ScrollView
      style={styles.root}
      showsVerticalScrollIndicator
      contentContainerStyle={[
        styles.scrollContent,
        {
          justifyContent: layout.isPhoneLandscape ? 'flex-start' : 'center',
          gap: 18,
          paddingTop: layout.safePadding.top + 12,
          paddingBottom: layout.scrollBottomPadding,
          paddingLeft: layout.contentPaddingLeft,
          paddingRight: layout.contentPaddingRight,
        },
      ]}
    >
      <View style={styles.headerBlock}>
        <View style={styles.brandBadge}>
          {isUnlocked ? (
            <ShieldCheck size={16} color={COLORS.online} />
          ) : (
            <Lock size={16} color={COLORS.offline} />
          )}
          <Text style={styles.brandBadgeText} numberOfLines={1}>
            PULSE // MOBILE • {isUnlocked ? `VERIFIED (${authMethod})` : 'SECURITY GATE V3.0'}
          </Text>
        </View>
          <Text style={[styles.title, { fontSize: layout.typography.hero }]}>
            Field Terminal Security
          </Text>
          <Text style={[styles.subtitle, { fontSize: layout.typography.body }]}>
            Hardware biometric verification via expo-local-authentication with SHA-256 PIN stored
            in SecureStore.
          </Text>
        </View>

        <View style={[styles.gridContainer, isSplitLayout && styles.gridSplit]}>
          <View style={[styles.card, isSplitLayout && styles.splitColumn]}>
            <View style={styles.cardHeader}>
              <Fingerprint size={18} color={COLORS.textPrimary} />
              <Text style={styles.cardTitle} numberOfLines={1}>
                HARDWARE BIOMETRICS
              </Text>
            </View>

            <View style={styles.hardwareBox}>
              <Text style={styles.hwRow}>
                SENSOR:{' '}
                <Text style={styles.hwVal}>
                  {hardware
                    ? hardware.hasHardware
                      ? hardware.isEnrolled
                        ? 'ENROLLED & ACTIVE'
                        : 'HARDWARE PRESENT (NOT ENROLLED)'
                      : 'NOT PRESENT ON HOST'
                    : 'INSPECTING HARDWARE...'}
                </Text>
              </Text>
              <Text style={styles.hwRow}>
                CAPABILITIES:{' '}
                <Text style={styles.hwVal}>
                  {hardware?.supportedTypes.join(', ') ?? 'Checking...'}
                </Text>
              </Text>
              <Text style={styles.hwRow}>
                SECURITY LEVEL:{' '}
                <Text style={styles.hwVal}>{hardware?.securityLevel ?? 'Checking...'}</Text>
              </Text>
              <Text style={styles.hwRow}>
                ENCLAVE:{' '}
                <Text style={styles.hwVal}>
                  {hardware?.storageDriver ?? 'Initializing SecureStore...'}
                </Text>
              </Text>
            </View>

            <Pressable
              onPress={handleBiometricAuth}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Authenticate with Biometrics"
              style={({ pressed }) => [
                styles.primaryButton,
                { minHeight: 52, opacity: pressed || busy ? 0.82 : 1 },
              ]}
            >
              <Fingerprint size={18} color={COLORS.primaryText} />
              <Text style={styles.primaryButtonText} numberOfLines={1}>
                {busy ? 'VERIFYING BIOMETRICS...' : 'AUTHENTICATE WITH BIOMETRICS'}
              </Text>
            </Pressable>

            {isUnlocked ? (
              <View style={styles.sessionActions}>
                <Pressable
                  onPress={() => router.replace('/(tabs)')}
                  style={({ pressed }) => [
                    styles.returnButton,
                    { minHeight: MIN_TOUCH_TARGET_DP, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={styles.returnButtonText} numberOfLines={1}>
                    RETURN TO COMMAND
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleLockTerminal}
                  style={({ pressed }) => [
                    styles.lockNowButton,
                    { minHeight: MIN_TOUCH_TARGET_DP, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Lock size={15} color={COLORS.critical} />
                  <Text style={styles.lockNowText} numberOfLines={1}>
                    SEAL TERMINAL
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {statusMessage ? (
              <View
                style={[
                  styles.alertBox,
                  {
                    backgroundColor: isError ? COLORS.criticalBg : COLORS.onlineBg,
                    borderColor: isError ? COLORS.criticalBorder : COLORS.onlineBorder,
                  },
                ]}
              >
                <ShieldAlert size={16} color={isError ? COLORS.critical : COLORS.online} />
                <Text
                  style={[
                    styles.alertText,
                    { color: isError ? COLORS.critical : COLORS.online },
                  ]}
                >
                  {statusMessage}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.card, isSplitLayout && styles.splitColumn]}>
            <View style={styles.cardHeader}>
              <KeyRound size={18} color={COLORS.textPrimary} />
              <Text style={styles.cardTitle} numberOfLines={1}>
                {setupStage === 'CREATE' || setupStage === 'CONFIRM'
                  ? 'ENCRYPTED PIN ENROLLMENT'
                  : 'SECURESTORE PIN CLEARANCE'}
              </Text>
            </View>

            <Text style={styles.pinHint}>{pinInstruction}</Text>

            <View style={styles.pinDotsRow}>
              {[0, 1, 2, 3].map((idx) => {
                const filled = idx < pin.length;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.pinSlot,
                      filled && styles.pinSlotFilled,
                      isError && styles.pinSlotError,
                    ]}
                  >
                    <View style={[styles.pinDot, filled && styles.pinDotFilled]} />
                  </View>
                );
              })}
            </View>

            <View style={styles.keypad}>
              {KEYPAD_ROWS.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.keypadRow}>
                  {row.map((key) => {
                    const isControl = key === 'CLR' || key === 'DEL';
                    return (
                      <Pressable
                        key={key}
                        onPress={() => handleKeyPress(key)}
                        accessibilityRole="button"
                        accessibilityLabel={`Keypad ${key}`}
                        style={({ pressed }) => [
                          styles.keypadKey,
                          isControl && styles.keypadControlKey,
                          {
                            minWidth: MIN_TOUCH_TARGET_DP,
                            minHeight: layout.isPhoneLandscape ? 48 : 52,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        {key === 'DEL' ? (
                          <Delete size={18} color={COLORS.textSecondary} />
                        ) : (
                          <Text
                            style={[
                              styles.keypadKeyText,
                              isControl && styles.keypadControlText,
                            ]}
                          >
                            {key}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerBlock: {
    gap: 8,
  },
  brandBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    maxWidth: '100%',
  },
  brandBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    flexShrink: 1,
  },
  title: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  gridContainer: {
    gap: 14,
  },
  gridSplit: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  splitColumn: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    flexShrink: 1,
  },
  hardwareBox: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  hwRow: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  hwVal: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  sessionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  returnButton: {
    flex: 1,
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.onlineBg,
    borderWidth: 1,
    borderColor: COLORS.onlineBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  returnButtonText: {
    color: COLORS.online,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  lockNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.criticalBg,
    borderWidth: 1,
    borderColor: COLORS.criticalBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  lockNowText: {
    color: COLORS.critical,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  alertText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
    lineHeight: 17,
  },
  pinHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  pinDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  pinSlot: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSlotFilled: {
    borderColor: COLORS.primary,
  },
  pinSlotError: {
    borderColor: COLORS.critical,
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: COLORS.primary,
  },
  keypad: {
    gap: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keypadKey: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadControlKey: {
    backgroundColor: COLORS.background,
  },
  keypadKeyText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  keypadControlText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
