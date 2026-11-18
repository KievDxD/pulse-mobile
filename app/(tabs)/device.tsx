import {
  Cpu,
  Fingerprint,
  LayoutGrid,
  RotateCw,
  ShieldCheck,
  Smartphone,
  Tablet,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BiometricHardwareInfo, inspectBiometricHardware } from '../../src/services/biometricAuth';
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

  const [hardware, setHardware] = useState<BiometricHardwareInfo | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<DevicePreset['id']>('iphone-se');
  const [simOrientation, setSimOrientation] = useState<DeviceOrientation>('portrait');

  useEffect(() => {
    let active = true;
    inspectBiometricHardware().then((info) => {
      if (active) setHardware(info);
    });
    return () => {
      active = false;
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

  const isSplit = layout.columns >= 2;

  const liveMetricsRows = [
    { label: 'OS / PLATFORM', value: layout.platform.toUpperCase() },
    { label: 'VIEWPORT (DP)', value: `${layout.width} × ${layout.height} dp` },
    {
      label: 'BREAKPOINT',
      value: `${layout.breakpoint.toUpperCase()} (${
        layout.breakpoint === 'compact'
          ? '<380dp'
          : layout.breakpoint === 'standard'
          ? '380–599dp'
          : '>=600dp'
      })`,
    },
    { label: 'ORIENTATION', value: layout.orientation.toUpperCase() },
    { label: 'GRID COLUMNS', value: `${layout.columns} COL` },
    { label: 'MIN TOUCH TARGET', value: `${layout.minTouchTarget} × ${layout.minTouchTarget} dp` },
    { label: 'FONT SCALE (CLAMPED)', value: `${layout.clampedFontScale}x` },
    {
      label: 'SAFE AREA INSETS',
      value: `T:${layout.insets.top} B:${layout.insets.bottom} L:${layout.insets.left} R:${layout.insets.right} dp`,
    },
  ];

  // Visual preview scaling
  const previewMaxWidth = layout.isCompact ? 240 : 320;
  const previewAspect = simulatedMetrics.width / simulatedMetrics.height;
  const previewW =
    simulatedMetrics.orientation === 'landscape'
      ? previewMaxWidth
      : Math.min(previewMaxWidth, Math.round(220 * previewAspect));
  const previewH = Math.max(140, Math.round(previewW / previewAspect));

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: layout.spacing.md,
        paddingBottom: layout.spacing.xl + 20,
        paddingLeft: layout.safePadding.left,
        paddingRight: layout.safePadding.right,
      }}
    >
      <View style={[styles.container, { maxWidth: layout.maxContentWidth }]}>
        <View>
          <Text style={[styles.screenTitle, { fontSize: layout.typography.title }]}>
            Device Lab & Adaptive Inspector
          </Text>
          <Text style={styles.screenSubtitle}>
            Real-time viewport telemetry + interactive multi-device form factor simulator
          </Text>
        </View>

        <View style={[styles.splitRow, isSplit && styles.splitRowActive, { gap: layout.gutter }]}>
          {/* Host Device Live Metrics */}
          <View style={[styles.card, isSplit && styles.colFlex, { padding: layout.cardPadding }]}>
            <View style={styles.cardHeader}>
              <Cpu size={16} color={COLORS.online} />
              <Text style={styles.cardTitle}>LIVE HOST DEVICE TELEMETRY</Text>
            </View>

            <View style={styles.metricsList}>
              {liveMetricsRows.map((row) => (
                <View key={row.label} style={styles.metricItem}>
                  <Text style={styles.metricLabel}>{row.label}</Text>
                  <Text style={styles.metricVal}>{row.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.cardHeader}>
              <Fingerprint size={16} color={COLORS.textPrimary} />
              <Text style={styles.cardTitle}>BIOMETRIC HARDWARE & ENCLAVE</Text>
            </View>

            <View style={styles.metricsList}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>HARDWARE SENSOR</Text>
                <Text
                  style={[
                    styles.metricVal,
                    { color: hardware?.hasHardware ? COLORS.online : COLORS.offline },
                  ]}
                >
                  {hardware?.hasHardware ? 'DETECTED' : 'UNAVAILABLE (FALLBACK)'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>BIOMETRIC ENROLLED</Text>
                <Text style={styles.metricVal}>
                  {hardware?.isEnrolled ? 'YES' : 'NO (PIN 2026 / DEMO)'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>SECURITY LEVEL</Text>
                <Text style={styles.metricVal}>{hardware?.securityLevel ?? 'LOADING'}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>SECURE STORAGE</Text>
                <Text style={[styles.metricVal, { flexShrink: 1, textAlign: 'right' }]}>
                  {hardware?.storageDriver ?? 'INITIALIZING'}
                </Text>
              </View>
            </View>
          </View>

          {/* Interactive Multi-Device Preview */}
          <View style={[styles.card, isSplit && styles.colFlex, { padding: layout.cardPadding }]}>
            <View style={styles.cardHeader}>
              <LayoutGrid size={16} color={COLORS.textPrimary} />
              <Text style={styles.cardTitle}>INTERACTIVE MULTI-DEVICE SIMULATOR</Text>
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
              <Text style={styles.orientationText}>
                ORIENTATION: {simOrientation.toUpperCase()} (TAP TO ROTATE)
              </Text>
            </Pressable>

            {/* Computed Preview Wireframe */}
            <View style={styles.previewStage}>
              <View
                style={[
                  styles.deviceFrame,
                  {
                    width: previewW,
                    minHeight: Math.min(260, previewH),
                  },
                ]}
              >
                <View style={styles.wireHeader}>
                  <Text style={styles.wireBrand}>PULSE // {simulatedMetrics.platform.toUpperCase()}</Text>
                  <Text style={styles.wireBadge}>
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
                              ? '48%'
                              : '31%',
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
                  <Text style={styles.wireFooterText}>
                    Touch ≥{simulatedMetrics.minTouchTarget}dp • SafeTop {simulatedMetrics.safePadding.top}dp
                  </Text>
                </View>
              </View>
            </View>

            {/* Computed Simulated Spec Readout */}
            <View style={styles.simSpecBox}>
              <Text style={styles.simSpecTitle}>
                {selectedPreset.label} ({simulatedMetrics.width} × {simulatedMetrics.height} dp)
              </Text>
              <Text style={styles.simSpecLine}>{selectedPreset.hardwareNote}</Text>
              <Text style={styles.simSpecLine}>
                BREAKPOINT: {simulatedMetrics.breakpoint.toUpperCase()} • COLUMNS:{' '}
                {simulatedMetrics.columns} • GUTTER: {simulatedMetrics.gutter}dp • CARD PAD:{' '}
                {simulatedMetrics.cardPadding}dp
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
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    width: '100%',
    alignSelf: 'center',
    gap: 14,
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
  },
  splitRow: {
    flexDirection: 'column',
  },
  splitRowActive: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  colFlex: {
    flex: 1,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    gap: 12,
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
  },
  metricsList: {
    gap: 8,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  metricVal: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 2,
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
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '800',
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
  },
  wireBadge: {
    color: COLORS.online,
    fontSize: 8,
    fontWeight: '800',
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
