import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import {
  Activity,
  BatteryCharging,
  Cpu,
  Fingerprint,
  Globe,
  LayoutGrid,
  RotateCw,
  ShieldCheck,
  Smartphone,
  Tablet,
  UserCheck,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BiometricHardwareInfo, inspectBiometricHardware } from '../../src/services/biometricAuth';
import {
  PhysicalTelemetrySnapshot,
  subscribeToPhysicalTelemetry,
} from '../../src/services/deviceTelemetry';
import { getVerifiedLedgerCount, isValidHttpEndpoint } from '../../src/services/syncClient';
import { usePulseStore } from '../../src/store/usePulseStore';
import {
  calculateAdaptiveMetrics,
  DEVICE_PRESETS,
  DeviceOrientation,
  DevicePreset,
  useAdaptiveLayout,
} from '../../src/theme/adaptive';
import { COLORS } from '../../src/theme/colors';
import { triggerHaptic } from '../../src/utils/haptics';

export default function DeviceLabScreen() {
  const layout = useAdaptiveLayout();

  const networkInfo = usePulseStore((s) => s.networkInfo);
  const operatorProfile = usePulseStore((s) => s.operatorProfile);
  const setOperatorProfile = usePulseStore((s) => s.setOperatorProfile);
  const syncEndpointUrl = usePulseStore((s) => s.syncEndpointUrl);
  const setSyncEndpointUrl = usePulseStore((s) => s.setSyncEndpointUrl);
  const refreshNetworkStatus = usePulseStore((s) => s.refreshNetworkStatus);

  const [hardware, setHardware] = useState<BiometricHardwareInfo | null>(null);
  const [gpsPerm, setGpsPerm] = useState<string>('CHECKING');
  const [camPerm, setCamPerm] = useState<string>('CHECKING');
  const [ledgerCount, setLedgerCount] = useState<number>(0);

  // Live Battery & Motion Telemetry
  const [telemetry, setTelemetry] = useState<PhysicalTelemetrySnapshot | null>(null);

  // Operator Identity Draft
  const [operatorIdDraft, setOperatorIdDraft] = useState(operatorProfile.operatorId);
  const [callsignDraft, setCallsignDraft] = useState(operatorProfile.callsign);
  const [unitSectorDraft, setUnitSectorDraft] = useState(operatorProfile.unitSector);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [endpointDraft, setEndpointDraft] = useState<string>(syncEndpointUrl);
  const [endpointStatus, setEndpointStatus] = useState<string | null>(null);

  const [selectedPresetId, setSelectedPresetId] = useState<DevicePreset['id']>('iphone-se');
  const [simOrientation, setSimOrientation] = useState<DeviceOrientation>('portrait');
  const [stageWidth, setStageWidth] = useState<number>(0);

  useEffect(() => {
    setOperatorIdDraft(operatorProfile.operatorId);
    setCallsignDraft(operatorProfile.callsign);
    setUnitSectorDraft(operatorProfile.unitSector);
  }, [operatorProfile]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [hw, locStatus, camStatus, count] = await Promise.all([
        inspectBiometricHardware(),
        Location.getForegroundPermissionsAsync().catch(() => ({ status: 'unavailable' })),
        Camera.getCameraPermissionsAsync().catch(() => ({ status: 'unavailable' })),
        getVerifiedLedgerCount(),
      ]);
      if (!active) return;
      setHardware(hw);
      setGpsPerm(String(locStatus.status).toUpperCase());
      setCamPerm(String(camStatus.status).toUpperCase());
      setLedgerCount(count);
    })();

    const unsubscribeTelemetry = subscribeToPhysicalTelemetry((snap) => {
      if (active) setTelemetry(snap);
    });

    return () => {
      active = false;
      unsubscribeTelemetry();
    };
  }, []);

  const selectedPreset = useMemo(
    () => DEVICE_PRESETS.find((p) => p.id === selectedPresetId) ?? DEVICE_PRESETS[0],
    [selectedPresetId]
  );

  const simulatedMetrics = useMemo(() => {
    const isPortrait = simOrientation === 'portrait';
    const simWidth = isPortrait ? selectedPreset.width : selectedPreset.height;
    const simHeight = isPortrait ? selectedPreset.height : selectedPreset.width;
    const simInsets = isPortrait
      ? selectedPreset.insetsPortrait
      : selectedPreset.insetsLandscape;

    return calculateAdaptiveMetrics({
      width: simWidth,
      height: simHeight,
      platform: selectedPreset.platform,
      fontScale: layout.clampedFontScale,
      insets: simInsets,
    });
  }, [selectedPreset, simOrientation, layout.clampedFontScale]);

  const handleSaveProfile = async () => {
    await triggerHaptic('medium');
    const result = await setOperatorProfile({
      operatorId: operatorIdDraft,
      callsign: callsignDraft,
      unitSector: unitSectorDraft,
    });

    if (result.ok) {
      await triggerHaptic('success');
      setProfileError(null);
      setProfileNotice(
        `Operator identity encrypted in SecureStore (${result.profile.callsign} • ${result.profile.operatorId}).`
      );
    } else {
      await triggerHaptic('error');
      setProfileNotice(null);
      setProfileError(result.error ?? 'Invalid operator profile fields.');
    }
  };

  const handleSaveEndpoint = async () => {
    await triggerHaptic('medium');
    const trimmed = endpointDraft.trim();
    if (trimmed.length > 0 && !isValidHttpEndpoint(trimmed)) {
      await triggerHaptic('error');
      setEndpointStatus('Endpoint must start with http:// or https://, or clear to use local ledger.');
      return;
    }

    setSyncEndpointUrl(trimmed);
    await triggerHaptic('success');
    setEndpointStatus(
      trimmed.length > 0
        ? `Configured remote HTTP sync target: ${trimmed}`
        : 'Using SHA-256 verified local transactional ledger.'
    );
  };

  const isSplit = layout.canSplitTwoColumns;
  const columnWidth = isSplit
    ? Math.floor((layout.availableWidth - layout.gutter) / 2)
    : layout.availableWidth;

  const liveMetricsRows = [
    { label: 'OS / PLATFORM', value: layout.platform.toUpperCase() },
    { label: 'VIEWPORT (DP)', value: `${layout.width} × ${layout.height} dp` },
    {
      label: 'BREAKPOINT',
      value: `${layout.breakpoint.toUpperCase()} (${layout.columns} COL)`,
    },
    { label: 'ORIENTATION', value: layout.orientation.toUpperCase() },
    { label: 'MAX CONTENT WIDTH', value: `${layout.maxContentWidth} dp` },
    { label: 'MIN TOUCH TARGET', value: `${layout.minTouchTarget} × ${layout.minTouchTarget} dp` },
    {
      label: 'SAFE AREA INSETS',
      value: `T:${layout.insets.top} B:${layout.insets.bottom} L:${layout.insets.left} R:${layout.insets.right}`,
    },
    {
      label: 'REAL NETWORK',
      value: `${networkInfo.type}${networkInfo.ipAddress ? ` (${networkInfo.ipAddress})` : ''}`,
    },
    { label: 'GPS / CAMERA PERM', value: `${gpsPerm} / ${camPerm}` },
  ];

  const motionBadgeColor =
    telemetry?.motionState === 'MOVING_IN_FIELD'
      ? COLORS.offline
      : telemetry?.motionState === 'STATIC'
      ? COLORS.online
      : COLORS.textMuted;

  const fallbackStage = Math.max(150, columnWidth - layout.cardPadding * 2 - 36);
  const measuredStage = stageWidth > 40 ? stageWidth - 28 : fallbackStage;
  const previewMaxWidth = Math.max(140, Math.min(280, measuredStage));
  const previewAspect = simulatedMetrics.width / simulatedMetrics.height;
  const previewW =
    simulatedMetrics.orientation === 'landscape'
      ? previewMaxWidth
      : Math.min(previewMaxWidth, Math.max(156, Math.round(200 * previewAspect)));
  const previewH = Math.max(130, Math.round(previewW / previewAspect));

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.root}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        contentContainerStyle={{
          flexGrow: 1,
          gap: 14,
          paddingTop: layout.spacing.md,
          paddingBottom: layout.scrollBottomPadding,
          paddingLeft: layout.contentPaddingLeft,
          paddingRight: layout.contentPaddingRight,
        }}
      >
        <View>
          <Text style={[styles.screenTitle, { fontSize: layout.typography.title }]} numberOfLines={1}>
            Device Lab, Sensors & Profile
          </Text>
          <Text style={styles.screenSubtitle} numberOfLines={2}>
            Live battery & accelerometer telemetry, operator identity, HTTP sync & viewport simulator
          </Text>
        </View>

        <View style={[styles.splitRow, isSplit && styles.splitRowActive, { gap: layout.gutter }]}>
          {/* Left Column: Physical Telemetry + Operator Profile + HTTP Settings */}
          <View style={[styles.colStack, isSplit && styles.colFlex, { gap: layout.gutter }]}>
            {/* Live Physical Telemetry (Battery + Accelerometer) */}
            <View style={[styles.card, { padding: layout.cardPadding }]}>
              <View style={styles.cardHeader}>
                <Activity size={16} color={COLORS.online} />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  LIVE PHYSICAL TELEMETRY (BATTERY + ACCEL)
                </Text>
              </View>

              <View style={styles.metricsList}>
                <View style={styles.metricItem}>
                  <View style={styles.inlineIconLabel}>
                    <BatteryCharging size={14} color={COLORS.online} />
                    <Text style={styles.metricLabel}>BATTERY LEVEL</Text>
                  </View>
                  <Text style={styles.metricVal} numberOfLines={2}>
                    {telemetry?.batteryAvailable && telemetry.batteryLevelPercent !== null
                      ? `${telemetry.batteryLevelPercent}% • ${telemetry.batteryState}`
                      : `UNAVAILABLE (${telemetry?.batteryState ?? 'UNKNOWN'})`}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>OPERATOR MOTION</Text>
                  <Text
                    style={[styles.metricVal, { color: motionBadgeColor }]}
                    numberOfLines={2}
                  >
                    {telemetry?.motionState ?? 'INITIALIZING'}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>ACCELEROMETER (G)</Text>
                  <Text style={styles.metricVal} numberOfLines={2}>
                    {telemetry?.accelerometerAvailable
                      ? `X:${telemetry.accelX.toFixed(2)} Y:${telemetry.accelY.toFixed(2)} Z:${telemetry.accelZ.toFixed(2)} (|${telemetry.magnitudeG.toFixed(2)}g|)`
                      : 'SENSOR UNAVAILABLE ON HOST'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Operator Identity Profile */}
            <View style={[styles.card, { padding: layout.cardPadding }]}>
              <View style={styles.cardHeader}>
                <UserCheck size={16} color={COLORS.textPrimary} />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  OPERATOR IDENTITY PROFILE (SECURESTORE)
                </Text>
              </View>

              <Text style={styles.helperText}>
                Embedded in every SHA-256 chain record and JSON/CSV audit export.
              </Text>

              <Text style={styles.miniLabel}>OPERATOR ID</Text>
              <TextInput
                value={operatorIdDraft}
                onChangeText={setOperatorIdDraft}
                autoCapitalize="characters"
                placeholder="e.g. OP-4092"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { minHeight: layout.minTouchTarget }]}
              />

              <Text style={styles.miniLabel}>CALLSIGN / OPERATOR NAME</Text>
              <TextInput
                value={callsignDraft}
                onChangeText={setCallsignDraft}
                autoCapitalize="characters"
                placeholder="e.g. VANGUARD-04"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { minHeight: layout.minTouchTarget }]}
              />

              <Text style={styles.miniLabel}>UNIT / SECTOR</Text>
              <TextInput
                value={unitSectorDraft}
                onChangeText={setUnitSectorDraft}
                autoCapitalize="characters"
                placeholder="e.g. GRID-NORTH-12"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { minHeight: layout.minTouchTarget }]}
              />

              {profileError ? <Text style={styles.errorNote}>{profileError}</Text> : null}
              {profileNotice ? <Text style={styles.statusNote}>{profileNotice}</Text> : null}

              <Pressable
                onPress={handleSaveProfile}
                accessibilityRole="button"
                accessibilityLabel="Save Operator Identity Profile"
                style={({ pressed }) => [
                  styles.primaryButton,
                  { minHeight: layout.minTouchTarget, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.primaryButtonText} numberOfLines={1}>
                  SAVE OPERATOR PROFILE
                </Text>
              </Pressable>
            </View>

            {/* Host Device & Biometrics */}
            <View style={[styles.card, { padding: layout.cardPadding }]}>
              <View style={styles.cardHeader}>
                <Cpu size={16} color={COLORS.online} />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  HOST DEVICE & HARDWARE ENCLAVE
                </Text>
              </View>

              <View style={styles.metricsList}>
                {liveMetricsRows.map((row) => (
                  <View key={row.label} style={styles.metricItem}>
                    <Text style={styles.metricLabel} numberOfLines={1}>
                      {row.label}
                    </Text>
                    <Text style={styles.metricVal} numberOfLines={2}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={async () => {
                  await triggerHaptic('light');
                  await refreshNetworkStatus();
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { minHeight: layout.minTouchTarget, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.secondaryButtonText} numberOfLines={1}>
                  REFRESH NETWORK & IP TELEMETRY
                </Text>
              </Pressable>

              <View style={styles.divider} />

              <View style={styles.cardHeader}>
                <Fingerprint size={16} color={COLORS.textPrimary} />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  BIOMETRIC ENCLAVE
                </Text>
              </View>

              <View style={styles.metricsList}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>HARDWARE / ENROLLED</Text>
                  <Text
                    style={[
                      styles.metricVal,
                      { color: hardware?.hasHardware ? COLORS.online : COLORS.offline },
                    ]}
                    numberOfLines={2}
                  >
                    {hardware?.hasHardware ? 'YES' : 'NO'} / {hardware?.isEnrolled ? 'YES' : 'NO'}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>SECURITY LEVEL</Text>
                  <Text style={styles.metricVal} numberOfLines={2}>
                    {hardware?.securityLevel ?? 'CHECKING'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right Column: HTTP Endpoint Settings + Adaptive Viewport Simulator */}
          <View style={[styles.colStack, isSplit && styles.colFlex, { gap: layout.gutter }]}>
            <View style={[styles.card, { padding: layout.cardPadding }]}>
              <View style={styles.cardHeader}>
                <Globe size={16} color={COLORS.textPrimary} />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  HTTP SYNC ENDPOINT CONFIGURATION
                </Text>
              </View>

              <Text style={styles.helperText}>
                Configure a REST API endpoint to POST signed chain records with exponential backoff,
                or leave blank to persist in the local verified SHA-256 ledger ({ledgerCount}{' '}
                stored).
              </Text>

              <TextInput
                value={endpointDraft}
                onChangeText={setEndpointDraft}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://api.example.com/v1/field-operations"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { minHeight: layout.minTouchTarget }]}
              />

              {endpointStatus ? <Text style={styles.statusNote}>{endpointStatus}</Text> : null}

              <View style={styles.endpointButtons}>
                <Pressable
                  onPress={handleSaveEndpoint}
                  accessibilityRole="button"
                  accessibilityLabel="Save HTTP Sync Endpoint"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { minHeight: layout.minTouchTarget, flex: 1, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={styles.primaryButtonText} numberOfLines={1}>
                    SAVE ENDPOINT
                  </Text>
                </Pressable>

                <Pressable
                  onPress={async () => {
                    await triggerHaptic('light');
                    setEndpointDraft('');
                    setSyncEndpointUrl('');
                    setEndpointStatus('Cleared remote URL; using local SHA-256 verified ledger.');
                  }}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { minHeight: layout.minTouchTarget, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={styles.secondaryButtonText} numberOfLines={1}>
                    LOCAL LEDGER
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.card, { padding: layout.cardPadding }]}>
              <View style={styles.cardHeader}>
                <LayoutGrid size={16} color={COLORS.textPrimary} />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  ADAPTIVE VIEWPORT SIMULATOR
                </Text>
              </View>

              <View style={styles.presetButtons}>
                {DEVICE_PRESETS.map((preset) => {
                  const active = preset.id === selectedPreset.id;
                  const Icon = preset.id === 'ipad-tablet' ? Tablet : Smartphone;
                  return (
                    <Pressable
                      key={preset.id}
                      onPress={async () => {
                        await triggerHaptic('light');
                        setSelectedPresetId(preset.id);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Simulate ${preset.label}`}
                      style={({ pressed }) => [
                        styles.presetButton,
                        {
                          minHeight: layout.minTouchTarget,
                          backgroundColor: active ? COLORS.primary : COLORS.surfaceElevated,
                          borderColor: active ? COLORS.primary : COLORS.borderStrong,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Icon size={15} color={active ? COLORS.primaryText : COLORS.textSecondary} />
                      <Text
                        style={[
                          styles.presetLabel,
                          { color: active ? COLORS.primaryText : COLORS.textPrimary },
                        ]}
                        numberOfLines={1}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={async () => {
                  await triggerHaptic('medium');
                  setSimOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'));
                }}
                accessibilityRole="button"
                accessibilityLabel="Toggle Simulated Orientation"
                style={({ pressed }) => [
                  styles.orientationButton,
                  { minHeight: layout.minTouchTarget, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <RotateCw size={15} color={COLORS.textPrimary} />
                <Text style={styles.orientationText} numberOfLines={1}>
                  ORIENTATION: {simOrientation.toUpperCase()} (ROTATE)
                </Text>
              </Pressable>

              <View
                style={styles.previewStage}
                onLayout={(e) => {
                  const w = Math.floor(e.nativeEvent.layout.width);
                  if (w > 0 && Math.abs(w - stageWidth) > 2) {
                    setStageWidth(w);
                  }
                }}
              >
                <View
                  style={[
                    styles.deviceFrame,
                    {
                      width: previewW,
                      minHeight: Math.min(250, previewH),
                    },
                  ]}
                >
                  <View style={styles.wireHeader}>
                    <Text style={styles.wireBrand} numberOfLines={1}>
                      PULSE // {simulatedMetrics.platform.toUpperCase()}
                    </Text>
                    <Text style={styles.wireBadge} numberOfLines={1}>
                      {simulatedMetrics.columns} COL • {simulatedMetrics.breakpoint.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.wireGrid}>
                    {[1, 2, 3, 4, 5, 6].map((idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.wireCard,
                          {
                            width:
                              simulatedMetrics.columns === 1
                                ? '100%'
                                : simulatedMetrics.columns === 2
                                ? '47%'
                                : '30%',
                          },
                        ]}
                      >
                        <View style={styles.wireDot} />
                        <View style={styles.wireBar} />
                      </View>
                    ))}
                  </View>

                  <View style={styles.wireFooter}>
                    <ShieldCheck size={12} color={COLORS.online} />
                    <Text style={styles.wireFooterText} numberOfLines={1}>
                      Touch ≥{simulatedMetrics.minTouchTarget}dp • Bottom+
                      {simulatedMetrics.scrollBottomPadding}dp
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.simSpecBox}>
                <Text style={styles.simSpecTitle}>
                  {selectedPreset.label} ({simulatedMetrics.width} × {simulatedMetrics.height} dp)
                </Text>
                <Text style={styles.simSpecLine}>{selectedPreset.hardwareNote}</Text>
                <Text style={styles.simSpecLine}>
                  BREAKPOINT: {simulatedMetrics.breakpoint.toUpperCase()} • COLUMNS:{' '}
                  {simulatedMetrics.columns} • GUTTER: {simulatedMetrics.gutter}dp
                </Text>
                <Text style={styles.simSpecLine}>
                  SAFE PADDING: T:{simulatedMetrics.safePadding.top} B:
                  {simulatedMetrics.safePadding.bottom} L:{simulatedMetrics.safePadding.left} R:
                  {simulatedMetrics.safePadding.right} dp
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    flexShrink: 1,
  },
  splitRow: {
    flexDirection: 'column',
  },
  splitRowActive: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  colStack: {
    flexDirection: 'column',
    minWidth: 0,
  },
  colFlex: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    gap: 10,
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
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  inlineIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  metricsList: {
    gap: 7,
  },
  metricItem: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 10,
    rowGap: 4,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    flexShrink: 0,
  },
  metricVal: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    flexGrow: 1,
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  helperText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  miniLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  input: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  statusNote: {
    color: COLORS.online,
    fontSize: 12,
    fontWeight: '600',
  },
  errorNote: {
    color: COLORS.critical,
    fontSize: 12,
    fontWeight: '700',
  },
  endpointButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  presetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexGrow: 1,
    minWidth: 110,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
  },
  orientationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  orientationText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  previewStage: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceFrame: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    borderRadius: 14,
    padding: 10,
    justifyContent: 'space-between',
    gap: 8,
  },
  wireHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
    gap: 4,
  },
  wireBrand: {
    color: COLORS.textPrimary,
    fontSize: 9,
    fontWeight: '800',
    flexShrink: 1,
  },
  wireBadge: {
    color: COLORS.online,
    fontSize: 8,
    fontWeight: '800',
    flexShrink: 0,
  },
  wireGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  wireCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 8,
    gap: 5,
  },
  wireDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.online,
  },
  wireBar: {
    height: 5,
    borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
  },
  wireFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  wireFooterText: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '600',
    flexShrink: 1,
  },
  simSpecBox: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  simSpecTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  simSpecLine: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
