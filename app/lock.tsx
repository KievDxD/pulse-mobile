import { useRouter } from 'expo-router';
import {
  Delete,
  Fingerprint,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  authenticateWithBiometrics,
  authenticateWithPin,
  BiometricHardwareInfo,
  clearAuthSession,
  DEFAULT_PIN,
  inspectBiometricHardware,
  instantDemoUnlock,
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [hardware, setHardware] = useState<BiometricHardwareInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    inspectBiometricHardware().then((info) => {
      if (active) setHardware(info);
    });
    return () => {
      active = false;
    };
  }, []);

  const completeUnlock = async (method: 'BIOMETRIC' | 'PIN' | 'DEMO_BYPASS') => {
    await triggerHaptic('success');
    unlockSession(method);
    router.replace('/(tabs)');
  };

  const handleBiometricAuth = async () => {
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
      result.error ?? 'Biometric unavailable. Enter PIN 2026 or tap Instant Demo Unlock.'
    );
  };

  const handleInstantDemoUnlock = async () => {
    if (busy) return;
    setBusy(true);
    await triggerHaptic('medium');
    const result = await instantDemoUnlock();
    setBusy(false);
    if (result.success) {
      await completeUnlock('DEMO_BYPASS');
    }
  };

  const submitPin = async (candidatePin: string) => {
    if (busy) return;
    setBusy(true);
    const result = await authenticateWithPin(candidatePin);
    setBusy(false);

    if (result.success) {
      await completeUnlock('PIN');
      return;
    }

    await triggerHaptic('error');
    setIsError(true);
    setStatusMessage(result.error ?? `Invalid PIN. Use ${DEFAULT_PIN} for demo access.`);
    setPin('');
  };

  const handleKeyPress = async (key: string) => {
    await triggerHaptic('light');
    setIsError(false);
    setStatusMessage(null);

    if (key === 'CLR') {
      setPin('');
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
      await submitPin(nextPin);
    }
  };

  const handleLockTerminal = async () => {
    await triggerHaptic('warning');
    await clearAuthSession();
    lockSession();
    setPin('');
    setIsError(false);
    setStatusMessage('Terminal session sealed. Authenticate to resume field operations.');
  };

  const isSplitLayout = layout.columns >= 2;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: layout.safePadding.top + 12,
          paddingBottom: layout.safePadding.bottom + 24,
          paddingLeft: layout.safePadding.left,
          paddingRight: layout.safePadding.right,
        },
      ]}
    >
      <View style={[styles.container, { maxWidth: isSplitLayout ? 920 : 480 }]}>
        <View style={styles.headerBlock}>
          <View style={styles.brandBadge}>
            {isUnlocked ? (
              <ShieldCheck size={16} color={COLORS.online} />
            ) : (
              <Lock size={16} color={COLORS.offline} />
            )}
            <Text style={styles.brandBadgeText}>
              PULSE // MOBILE • {isUnlocked ? `VERIFIED (${authMethod})` : 'SECURITY GATE'}
            </Text>
          </View>
          <Text style={[styles.title, { fontSize: layout.typography.hero }]}>
            Field Terminal Clearance
          </Text>
          <Text style={[styles.subtitle, { fontSize: layout.typography.body }]}>
            Hardware-backed biometric verification via expo-local-authentication & encrypted
            SecureStore enclave.
          </Text>
        </View>

        <View style={[styles.gridContainer, isSplitLayout && styles.gridSplit]}>
          <View style={[styles.card, isSplitLayout && styles.splitColumn]}>
            <View style={styles.cardHeader}>
              <Fingerprint size={18} color={COLORS.textPrimary} />
              <Text style={styles.cardTitle}>BIOMETRIC & DEMO ACCESS</Text>
            </View>

            <View style={styles.hardwareBox}>
              <Text style={styles.hwRow}>
                SENSOR:{' '}
                <Text style={styles.hwVal}>
                  {hardware?.hasHardware
                    ? hardware.isEnrolled
                      ? 'ENROLLED & READY'
                      : 'HARDWARE PRESENT (UNENROLLED)'
                    : 'EMULATOR / WEB FALLBACK'}
                </Text>
              </Text>
              <Text style={styles.hwRow}>
                METHODS:{' '}
                <Text style={styles.hwVal}>
                  {hardware?.supportedTypes.join(', ') ?? 'Inspecting sensors...'}
                </Text>
              </Text>
              <Text style={styles.hwRow}>
                ENCLAVE:{' '}
                <Text style={styles.hwVal}>
                  {hardware?.storageDriver ?? 'Initializing SecureStore...'}
                </Text>
              </Text>
            </View>

            <Pressable
              onPress={handleInstantDemoUnlock}
              accessibilityRole="button"
              accessibilityLabel="Instant Demo Unlock"
              style={({ pressed }) => [
                styles.primaryButton,
                { minHeight: 52, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Zap size={18} color={COLORS.primaryText} />
              <Text style={styles.primaryButtonText}>INSTANT DEMO UNLOCK (1-CLICK)</Text>
            </Pressable>

            <Pressable
              onPress={handleBiometricAuth}
              accessibilityRole="button"
              accessibilityLabel="Authenticate with Biometrics"
              style={({ pressed }) => [
                styles.secondaryButton,
                { minHeight: 50, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Fingerprint size={18} color={COLORS.textPrimary} />
              <Text style={styles.secondaryButtonText}>AUTHENTICATE WITH BIOMETRICS</Text>
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
                  <Text style={styles.returnButtonText}>RETURN TO COMMAND</Text>
                </Pressable>
                <Pressable
                  onPress={handleLockTerminal}
                  style={({ pressed }) => [
                    styles.lockNowButton,
                    { minHeight: MIN_TOUCH_TARGET_DP, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Lock size={15} color={COLORS.critical} />
                  <Text style={styles.lockNowText}>SEAL TERMINAL</Text>
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
              <Text style={styles.cardTitle}>FALLBACK SECURITY PIN</Text>
            </View>

            <Text style={styles.pinHint}>
              Enter 4-digit operator PIN (<Text style={styles.pinHighlight}>{DEFAULT_PIN}</Text>)
            </Text>

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
                            minHeight: 52,
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
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    alignSelf: 'center',
    gap: 18,
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
  },
  brandBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
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
    letterSpacing: 0.8,
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
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sessionActions: {
    flexDirection: 'row',
    gap: 10,
  },
  returnButton: {
    flex: 1,
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
    lineHeight: 17,
  },
  pinHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  pinHighlight: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontFamily: 'monospace',
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
