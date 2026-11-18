import { useRouter } from 'expo-router';
import {
  CheckCircle2,
  Crosshair,
  QrCode,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Coordinates,
  OperationCategory,
  PriorityLevel,
  usePulseStore,
} from '../../src/store/usePulseStore';
import { useAdaptiveLayout } from '../../src/theme/adaptive';
import { COLORS } from '../../src/theme/colors';
import { triggerHaptic } from '../../src/utils/haptics';
import { calculatePayloadBytes, formatShortHash, generateIntegrityHash } from '../../src/utils/hash';

const CATEGORIES: OperationCategory[] = [
  'INFRASTRUCTURE',
  'POWER_GRID',
  'TELEMETRY',
  'SECURITY',
  'MAINTENANCE',
];

const PRIORITIES: PriorityLevel[] = ['CRITICAL', 'HIGH', 'NORMAL'];

const GPS_SECTORS: Coordinates[] = [
  { latitude: 40.7128, longitude: -74.006, sector: 'SECTOR-NE-04', accuracyMeters: 1.8 },
  { latitude: 40.7419, longitude: -73.9895, sector: 'SECTOR-CORE-02', accuracyMeters: 2.2 },
  { latitude: 40.7589, longitude: -73.9851, sector: 'SECTOR-NORTH-08', accuracyMeters: 1.6 },
  { latitude: 40.7033, longitude: -74.017, sector: 'SECTOR-SOUTH-01', accuracyMeters: 2.4 },
];

const QR_CHECKPOINTS = [
  'CHK-2026-ALPHA',
  'CHK-2026-BRAVO',
  'CHK-2026-CHARLIE',
  'CHK-2026-DELTA',
  'CHK-2026-OMEGA',
];

const QUICK_TEMPLATES = [
  {
    label: 'Thermal Alert',
    title: 'Transformer Bus B Thermal Spike',
    category: 'POWER_GRID' as OperationCategory,
    priority: 'CRITICAL' as PriorityLevel,
    note: 'Infrared thermography detected +14°C delta across phase C insulator.',
  },
  {
    label: 'Fiber Splice',
    title: 'Backhaul Conduit Splice Audit',
    category: 'TELEMETRY' as OperationCategory,
    priority: 'HIGH' as PriorityLevel,
    note: 'Optical loss stabilized at 0.3dB after mechanical enclosure resealing.',
  },
  {
    label: 'Gate Patrol',
    title: 'Perimeter Access Telemetry Check',
    category: 'SECURITY' as OperationCategory,
    priority: 'NORMAL' as PriorityLevel,
    note: 'RFID badge reader and failover battery verified at 100% nominal.',
  },
];

export default function CaptureScreen() {
  const router = useRouter();
  const layout = useAdaptiveLayout();

  const networkMode = usePulseStore((s) => s.networkMode);
  const addOperation = usePulseStore((s) => s.addOperation);

  const [title, setTitle] = useState('Substation Valve Pressure Inspection');
  const [category, setCategory] = useState<OperationCategory>('INFRASTRUCTURE');
  const [priority, setPriority] = useState<PriorityLevel>('HIGH');
  const [technicalNote, setTechnicalNote] = useState(
    'Verified hydraulic pressure stability at 42.6 PSI; zero micro-leakage observed.'
  );
  const [gpsIndex, setGpsIndex] = useState(0);
  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const [qrScanned, setQrScanned] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastCommittedCode, setLastCommittedCode] = useState<string | null>(null);

  const coordinates = GPS_SECTORS[gpsIndex];
  const checkpointId = qrScanned ? QR_CHECKPOINTS[checkpointIndex] : undefined;

  const previewMeta = useMemo(() => {
    const raw = JSON.stringify({
      title: title.trim(),
      category,
      priority,
      coordinates,
      technicalNote: technicalNote.trim(),
      checkpointId: checkpointId ?? null,
    });
    return {
      hash: generateIntegrityHash(raw),
      bytes: calculatePayloadBytes(raw),
    };
  }, [title, category, priority, coordinates, technicalNote, checkpointId]);

  const handleLockGps = async () => {
    await triggerHaptic('medium');
    setGpsIndex((prev) => (prev + 1) % GPS_SECTORS.length);
  };

  const handleScanQr = async () => {
    await triggerHaptic('success');
    setQrScanned(true);
    setCheckpointIndex((prev) => (prev + 1) % QR_CHECKPOINTS.length);
  };

  const handleSelectPriority = async (level: PriorityLevel) => {
    await triggerHaptic(level === 'CRITICAL' ? 'heavy' : 'light');
    setPriority(level);
  };

  const handleApplyTemplate = async (tpl: (typeof QUICK_TEMPLATES)[number]) => {
    await triggerHaptic('light');
    setTitle(tpl.title);
    setCategory(tpl.category);
    setPriority(tpl.priority);
    setTechnicalNote(tpl.note);
    setValidationError(null);
  };

  const handleCommit = async () => {
    if (title.trim().length < 3) {
      await triggerHaptic('error');
      setValidationError('Enter an operation title (minimum 3 characters).');
      return;
    }
    if (technicalNote.trim().length < 5) {
      await triggerHaptic('error');
      setValidationError('Enter technical field observations before committing.');
      return;
    }

    setValidationError(null);
    await triggerHaptic('success');

    const created = addOperation({
      title,
      category,
      priority,
      coordinates,
      technicalNote,
      checkpointId,
    });

    setLastCommittedCode(created.code);
  };

  const isTwoCol = layout.columns >= 2;

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
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.screenTitle, { fontSize: layout.typography.title }]}>
              Field Operation Capture
            </Text>
            <Text style={styles.screenSubtitle}>
              One-handed capture • Mode: {networkMode === 'OFFLINE' ? 'LOCAL BUFFERING' : 'CLOUD UPLINK'}
            </Text>
          </View>
        </View>

        {/* Quick 1-Tap Field Templates */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
          {QUICK_TEMPLATES.map((tpl) => (
            <Pressable
              key={tpl.label}
              onPress={() => handleApplyTemplate(tpl)}
              style={({ pressed }) => [
                styles.templateChip,
                { minHeight: layout.minTouchTarget, opacity: pressed ? 0.78 : 1 },
              ]}
            >
              <Sparkles size={14} color={COLORS.textSecondary} />
              <Text style={styles.templateChipText}>{tpl.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={[styles.columnsWrap, isTwoCol && styles.columnsSplit, { gap: layout.gutter }]}>
          {/* Left Column: Ergonomic Form Inputs */}
          <View style={[styles.card, isTwoCol && styles.colFlex, { padding: layout.cardPadding }]}>
            <Text style={styles.fieldLabel}>OPERATION TITLE</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Substation T-14 Thermal Inspection"
              placeholderTextColor={COLORS.textMuted}
              style={[styles.input, { minHeight: layout.minTouchTarget }]}
            />

            <Text style={styles.fieldLabel}>TACTILE PRIORITY</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((level) => {
                const active = priority === level;
                const activeColor =
                  level === 'CRITICAL'
                    ? COLORS.critical
                    : level === 'HIGH'
                    ? COLORS.offline
                    : COLORS.online;
                const activeBg =
                  level === 'CRITICAL'
                    ? COLORS.criticalBg
                    : level === 'HIGH'
                    ? COLORS.offlineBg
                    : COLORS.onlineBg;
                const activeBorder =
                  level === 'CRITICAL'
                    ? COLORS.criticalBorder
                    : level === 'HIGH'
                    ? COLORS.offlineBorder
                    : COLORS.onlineBorder;

                return (
                  <Pressable
                    key={level}
                    onPress={() => handleSelectPriority(level)}
                    accessibilityRole="button"
                    accessibilityLabel={`Priority ${level}`}
                    style={({ pressed }) => [
                      styles.priorityButton,
                      {
                        minHeight: 52,
                        borderColor: active ? activeBorder : COLORS.border,
                        backgroundColor: active ? activeBg : COLORS.surfaceElevated,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.priorityDot,
                        { backgroundColor: active ? activeColor : COLORS.textMuted },
                      ]}
                    />
                    <Text
                      style={[
                        styles.priorityText,
                        { color: active ? activeColor : COLORS.textSecondary },
                      ]}
                    >
                      {level}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>OPERATIONAL CATEGORY</Text>
            <View style={styles.categoryWrap}>
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={async () => {
                      await triggerHaptic('light');
                      setCategory(cat);
                    }}
                    style={({ pressed }) => [
                      styles.categoryChip,
                      {
                        minHeight: layout.minTouchTarget,
                        borderColor: active ? COLORS.primary : COLORS.border,
                        backgroundColor: active ? COLORS.primary : COLORS.surfaceElevated,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        { color: active ? COLORS.primaryText : COLORS.textSecondary },
                      ]}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>TECHNICAL FIELD NOTE</Text>
            <TextInput
              value={technicalNote}
              onChangeText={setTechnicalNote}
              multiline
              numberOfLines={4}
              placeholder="Document sensor readings, physical state, and corrective actions..."
              placeholderTextColor={COLORS.textMuted}
              textAlignVertical="top"
              style={[styles.input, styles.textArea]}
            />
          </View>

          {/* Right Column: Telemetry, GPS, QR Checkpoint & Commit */}
          <View style={[styles.rightStack, isTwoCol && styles.colFlex, { gap: layout.gutter }]}>
            <View style={[styles.card, { padding: layout.cardPadding }]}>
              <View style={styles.cardHeader}>
                <Crosshair size={16} color={COLORS.online} />
                <Text style={styles.cardTitle}>GPS TELEMETRY LOCK</Text>
              </View>

              <View style={styles.telemetryBox}>
                <Text style={styles.telemetryLine}>
                  LAT / LNG:{' '}
                  <Text style={styles.telemetryVal}>
                    {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
                  </Text>
                </Text>
                <Text style={styles.telemetryLine}>
                  SECTOR: <Text style={styles.telemetryVal}>{coordinates.sector}</Text>
                </Text>
                <Text style={styles.telemetryLine}>
                  PRECISION:{' '}
                  <Text style={[styles.telemetryVal, { color: COLORS.online }]}>
                    ±{coordinates.accuracyMeters}m GNSS
                  </Text>
                </Text>
              </View>

              <Pressable
                onPress={handleLockGps}
                accessibilityRole="button"
                accessibilityLabel="Lock Satellite GPS"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { minHeight: layout.minTouchTarget, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Radio size={16} color={COLORS.textPrimary} />
                <Text style={styles.secondaryButtonText}>LOCK SATELLITE GPS</Text>
              </Pressable>
            </View>

            <View style={[styles.card, { padding: layout.cardPadding }]}>
              <View style={styles.cardHeader}>
                <QrCode size={16} color={COLORS.textPrimary} />
                <Text style={styles.cardTitle}>CHECKPOINT QR SCANNER</Text>
              </View>

              <View style={styles.qrFrame}>
                <Text style={styles.qrCodeText}>
                  {checkpointId ?? 'NO CHECKPOINT ATTACHED'}
                </Text>
                <Text style={styles.qrHint}>
                  Simulated haptic checkpoint verification for underground / offline zones
                </Text>
              </View>

              <Pressable
                onPress={handleScanQr}
                accessibilityRole="button"
                accessibilityLabel="Scan Checkpoint QR"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { minHeight: layout.minTouchTarget, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <QrCode size={16} color={COLORS.textPrimary} />
                <Text style={styles.secondaryButtonText}>SCAN CHECKPOINT QR (HAPTIC)</Text>
              </Pressable>
            </View>

            <View style={[styles.card, { padding: layout.cardPadding }]}>
              <View style={styles.cardHeader}>
                <ShieldCheck size={16} color={COLORS.online} />
                <Text style={styles.cardTitle}>SHA-256 INTEGRITY ENVELOPE</Text>
              </View>

              <Text style={styles.hashPreview}>{formatShortHash(previewMeta.hash)}</Text>
              <Text style={styles.payloadText}>
                PAYLOAD: {previewMeta.bytes} BYTES • TARGET:{' '}
                {networkMode === 'OFFLINE' ? 'QUEUED_LOCAL' : 'AUTO_SYNC_CLOUD'}
              </Text>

              {validationError ? (
                <Text style={styles.errorText}>{validationError}</Text>
              ) : null}

              {lastCommittedCode ? (
                <View style={styles.successBanner}>
                  <CheckCircle2 size={16} color={COLORS.online} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.successTitle}>
                      {lastCommittedCode} COMMITTED (
                      {networkMode === 'OFFLINE' ? 'QUEUED_LOCAL' : 'SYNCED'})
                    </Text>
                    <Pressable onPress={() => router.push('/(tabs)/queue')}>
                      <Text style={styles.successLink}>Inspect packet in Sync Queue →</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <Pressable
                onPress={handleCommit}
                accessibilityRole="button"
                accessibilityLabel="Commit Field Report"
                style={({ pressed }) => [
                  styles.primaryButton,
                  { minHeight: 52, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Send size={16} color={COLORS.primaryText} />
                <Text style={styles.primaryButtonText}>
                  {networkMode === 'OFFLINE'
                    ? 'SAVE TO OFFLINE QUEUE'
                    : 'COMMIT & SYNC FIELD REPORT'}
                </Text>
              </Pressable>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  templateRow: {
    gap: 8,
    paddingVertical: 2,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  templateChipText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  columnsWrap: {
    flexDirection: 'column',
  },
  columnsSplit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  colFlex: {
    flex: 1,
  },
  rightStack: {
    flexDirection: 'column',
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
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  input: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  textArea: {
    minHeight: 96,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  telemetryBox: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 4,
  },
  telemetryLine: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  telemetryVal: {
    color: COLORS.textPrimary,
    fontFamily: 'monospace',
  },
  qrFrame: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderStyle: 'dashed',
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  qrCodeText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  qrHint: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  hashPreview: {
    color: COLORS.online,
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  payloadText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  errorText: {
    color: COLORS.critical,
    fontSize: 12,
    fontWeight: '700',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.onlineBg,
    borderWidth: 1,
    borderColor: COLORS.onlineBorder,
    borderRadius: 8,
    padding: 10,
  },
  successTitle: {
    color: COLORS.online,
    fontSize: 12,
    fontWeight: '800',
  },
  successLink: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
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
    letterSpacing: 0.5,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
