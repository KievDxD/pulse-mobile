import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import {
  Camera,
  CheckCircle2,
  Crosshair,
  QrCode,
  Radio,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
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
import {
  calculatePayloadBytes,
  formatShortHash,
  generateIntegrityHashAsync,
} from '../../src/utils/hash';

const CATEGORIES: OperationCategory[] = [
  'INFRASTRUCTURE',
  'POWER_GRID',
  'TELEMETRY',
  'SECURITY',
  'MAINTENANCE',
];

const PRIORITIES: PriorityLevel[] = ['CRITICAL', 'HIGH', 'NORMAL'];

export default function CaptureScreen() {
  const router = useRouter();
  const layout = useAdaptiveLayout();

  const networkMode = usePulseStore((s) => s.networkMode);
  const createOperation = usePulseStore((s) => s.createOperation);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<OperationCategory>('INFRASTRUCTURE');
  const [priority, setPriority] = useState<PriorityLevel>('HIGH');
  const [technicalNote, setTechnicalNote] = useState('');

  // Real GPS State
  const [gpsStatus, setGpsStatus] = useState<
    'IDLE' | 'ACQUIRING' | 'LOCKED' | 'DENIED' | 'ERROR'
  >('IDLE');
  const [gpsMessage, setGpsMessage] = useState<string>('Tap Acquire GPS to capture device location');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  // Real Camera QR State
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedType, setScannedType] = useState<string | null>(null);
  const [checkpointId, setCheckpointId] = useState('');
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);

  // Hash & Submission State
  const [liveHash, setLiveHash] = useState<string>('sha256:pending...');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastCommittedCode, setLastCommittedCode] = useState<string | null>(null);

  const resolvedCoordinates: Coordinates | null = useMemo(() => {
    if (coordinates) return coordinates;
    const parsedLat = Number.parseFloat(manualLat);
    const parsedLng = Number.parseFloat(manualLng);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      return {
        latitude: parsedLat,
        longitude: parsedLng,
        accuracyMeters: null,
        altitudeMeters: null,
        source: 'MANUAL',
      };
    }
    return null;
  }, [coordinates, manualLat, manualLng]);

  const canonicalPreview = useMemo(
    () =>
      JSON.stringify({
        title: title.trim(),
        category,
        priority,
        coordinates: resolvedCoordinates,
        technicalNote: technicalNote.trim(),
        checkpointId: checkpointId.trim() || null,
      }),
    [title, category, priority, resolvedCoordinates, technicalNote, checkpointId]
  );

  const payloadBytes = useMemo(() => calculatePayloadBytes(canonicalPreview), [canonicalPreview]);

  useEffect(() => {
    let active = true;
    void generateIntegrityHashAsync(canonicalPreview).then((digest) => {
      if (active) setLiveHash(digest);
    });
    return () => {
      active = false;
    };
  }, [canonicalPreview]);

  const handleAcquireGps = async () => {
    await triggerHaptic('medium');
    setGpsStatus('ACQUIRING');
    setGpsMessage('Requesting foreground location permission...');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        await triggerHaptic('warning');
        setGpsStatus('DENIED');
        setGpsMessage(
          'Location permission denied. Enter coordinates manually below or enable GPS in OS settings.'
        );
        return;
      }

      setGpsMessage('Acquiring satellite GNSS fix...');
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const nextCoords: Coordinates = {
        latitude: Number(fix.coords.latitude.toFixed(6)),
        longitude: Number(fix.coords.longitude.toFixed(6)),
        accuracyMeters:
          typeof fix.coords.accuracy === 'number'
            ? Number(fix.coords.accuracy.toFixed(1))
            : null,
        altitudeMeters:
          typeof fix.coords.altitude === 'number'
            ? Number(fix.coords.altitude.toFixed(1))
            : null,
        source: 'GPS_HARDWARE',
      };

      setCoordinates(nextCoords);
      setManualLat(String(nextCoords.latitude));
      setManualLng(String(nextCoords.longitude));
      setGpsStatus('LOCKED');
      setGpsMessage('Hardware GPS fix acquired');
      await triggerHaptic('success');
    } catch (err) {
      await triggerHaptic('error');
      setGpsStatus('ERROR');
      setGpsMessage(
        err instanceof Error
          ? `${err.message}. Use manual coordinates fallback.`
          : 'GPS sensor unavailable. Enter coordinates manually.'
      );
    }
  };

  const handleToggleScanner = async () => {
    await triggerHaptic('light');
    if (scannerOpen) {
      setScannerOpen(false);
      return;
    }

    setCameraMessage(null);
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        await triggerHaptic('warning');
        setCameraMessage(
          'Camera permission denied or unavailable. Enter checkpoint ID manually below.'
        );
        return;
      }
    }

    setScannerOpen(true);
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (!scannerOpen) return;
    setScannerOpen(false);
    setCheckpointId(result.data);
    setScannedType(result.type.toUpperCase());
    setCameraMessage(`Captured ${result.type.toUpperCase()} checkpoint`);
    void triggerHaptic('success');
  };

  const handleSelectPriority = async (level: PriorityLevel) => {
    await triggerHaptic(level === 'CRITICAL' ? 'heavy' : 'light');
    setPriority(level);
  };

  const handleCommit = async () => {
    if (submitting) return;
    if (title.trim().length < 3) {
      await triggerHaptic('error');
      setValidationError('Enter an operation title (minimum 3 characters).');
      return;
    }
    if (technicalNote.trim().length < 5) {
      await triggerHaptic('error');
      setValidationError('Enter technical field observations (minimum 5 characters).');
      return;
    }
    if (!resolvedCoordinates) {
      await triggerHaptic('error');
      setValidationError('Acquire hardware GPS coordinates or enter valid latitude/longitude.');
      return;
    }

    setValidationError(null);
    setSubmitting(true);

    try {
      const created = await createOperation({
        title,
        category,
        priority,
        coordinates: resolvedCoordinates,
        technicalNote,
        checkpointId: checkpointId.trim() || undefined,
      });

      await triggerHaptic('success');
      setLastCommittedCode(created.code);
      setTitle('');
      setTechnicalNote('');
      setCheckpointId('');
      setScannedType(null);
    } finally {
      setSubmitting(false);
    }
  };

  const isTwoCol = layout.columns >= 2;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: layout.spacing.md,
        paddingBottom: layout.scrollBottomPadding,
        paddingLeft: layout.safePadding.left,
        paddingRight: layout.safePadding.right,
      }}
    >
      <View style={[styles.container, { maxWidth: layout.maxContentWidth }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.screenTitle, { fontSize: layout.typography.title }]} numberOfLines={1}>
              Field Operation Capture
            </Text>
            <Text style={styles.screenSubtitle} numberOfLines={2}>
              Hardware GPS + Camera QR + SHA-256 • Mode:{' '}
              {networkMode === 'OFFLINE' ? 'LOCAL OFFLINE QUEUE' : 'ONLINE AUTO-SYNC'}
            </Text>
          </View>
        </View>

        <View style={[styles.columnsWrap, isTwoCol && styles.columnsSplit, { gap: layout.gutter }]}>
          {/* Left Column: Operation Details */}
          <View style={[styles.card, isTwoCol && styles.colFlex, { padding: layout.cardPadding }]}>
            <Text style={styles.fieldLabel}>OPERATION TITLE</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Enter field inspection title..."
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
                        minHeight: 50,
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
                      numberOfLines={1}
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
                      numberOfLines={1}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>TECHNICAL FIELD OBSERVATIONS</Text>
            <TextInput
              value={technicalNote}
              onChangeText={setTechnicalNote}
              multiline
              numberOfLines={4}
              placeholder="Record measurements, diagnostics, and corrective actions..."
              placeholderTextColor={COLORS.textMuted}
              textAlignVertical="top"
              style={[styles.input, styles.textArea]}
            />
          </View>

          {/* Right Column: Real GPS, Real QR Camera & SHA-256 Commit */}
          <View style={[styles.rightStack, isTwoCol && styles.colFlex, { gap: layout.gutter }]}>
            {/* Real Hardware GPS Card */}
            <View style={[styles.card, { padding: layout.cardPadding }]}>
              <View style={styles.cardHeader}>
                <Crosshair
                  size={16}
                  color={gpsStatus === 'LOCKED' ? COLORS.online : COLORS.textPrimary}
                />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  REAL GPS TELEMETRY (EXPO-LOCATION)
                </Text>
              </View>

              <View style={styles.telemetryBox}>
                <Text style={styles.telemetryStatus}>{gpsMessage}</Text>
                {resolvedCoordinates ? (
                  <>
                    <Text style={styles.telemetryLine}>
                      COORDS:{' '}
                      <Text style={styles.telemetryVal}>
                        {resolvedCoordinates.latitude.toFixed(6)},{' '}
                        {resolvedCoordinates.longitude.toFixed(6)}
                      </Text>
                    </Text>
                    <Text style={styles.telemetryLine}>
                      ACCURACY:{' '}
                      <Text style={[styles.telemetryVal, { color: COLORS.online }]}>
                        {resolvedCoordinates.accuracyMeters !== null
                          ? `±${resolvedCoordinates.accuracyMeters}m`
                          : 'MANUAL INPUT'}
                      </Text>
                      {resolvedCoordinates.altitudeMeters !== null
                        ? ` • ALT: ${resolvedCoordinates.altitudeMeters}m`
                        : ''}
                    </Text>
                  </>
                ) : null}
              </View>

              <Pressable
                onPress={handleAcquireGps}
                disabled={gpsStatus === 'ACQUIRING'}
                accessibilityRole="button"
                accessibilityLabel="Acquire Real GPS Coordinates"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    minHeight: layout.minTouchTarget,
                    opacity: pressed || gpsStatus === 'ACQUIRING' ? 0.78 : 1,
                  },
                ]}
              >
                <Radio size={16} color={COLORS.textPrimary} />
                <Text style={styles.secondaryButtonText} numberOfLines={1}>
                  {gpsStatus === 'ACQUIRING' ? 'ACQUIRING GNSS FIX...' : 'ACQUIRE REAL GPS FIX'}
                </Text>
              </Pressable>

              <View style={styles.manualCoordRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>LATITUDE</Text>
                  <TextInput
                    value={manualLat}
                    onChangeText={(val) => {
                      setCoordinates(null);
                      setManualLat(val);
                    }}
                    keyboardType="numeric"
                    placeholder="e.g. 40.7128"
                    placeholderTextColor={COLORS.textMuted}
                    style={[styles.input, { minHeight: layout.minTouchTarget }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>LONGITUDE</Text>
                  <TextInput
                    value={manualLng}
                    onChangeText={(val) => {
                      setCoordinates(null);
                      setManualLng(val);
                    }}
                    keyboardType="numeric"
                    placeholder="e.g. -74.0060"
                    placeholderTextColor={COLORS.textMuted}
                    style={[styles.input, { minHeight: layout.minTouchTarget }]}
                  />
                </View>
              </View>
            </View>

            {/* Real Camera QR / Barcode Card */}
            <View style={[styles.card, { padding: layout.cardPadding }]}>
              <View style={styles.cardHeader}>
                <QrCode size={16} color={COLORS.textPrimary} />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  QR / BARCODE SCANNER (EXPO-CAMERA)
                </Text>
              </View>

              {scannerOpen ? (
                <View style={styles.cameraContainer}>
                  <CameraView
                    style={styles.cameraView}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr', 'code128', 'ean13'],
                    }}
                    onBarcodeScanned={handleBarcodeScanned}
                  />
                  <View style={styles.cameraOverlay}>
                    <Text style={styles.cameraHint}>Align QR / Code128 / EAN13 inside frame</Text>
                  </View>
                </View>
              ) : null}

              <Pressable
                onPress={handleToggleScanner}
                accessibilityRole="button"
                accessibilityLabel={scannerOpen ? 'Close Camera Scanner' : 'Open QR Camera Scanner'}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { minHeight: layout.minTouchTarget, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                {scannerOpen ? (
                  <X size={16} color={COLORS.critical} />
                ) : (
                  <Camera size={16} color={COLORS.textPrimary} />
                )}
                <Text style={styles.secondaryButtonText} numberOfLines={1}>
                  {scannerOpen ? 'CLOSE CAMERA VIEWFINDER' : 'SCAN CHECKPOINT WITH CAMERA'}
                </Text>
              </Pressable>

              {cameraMessage ? <Text style={styles.cameraNote}>{cameraMessage}</Text> : null}

              <Text style={styles.miniLabel}>
                CHECKPOINT ID {scannedType ? `(${scannedType})` : '(SCANNED OR MANUAL)'}
              </Text>
              <TextInput
                value={checkpointId}
                onChangeText={setCheckpointId}
                placeholder="Scan QR/barcode or enter checkpoint code..."
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { minHeight: layout.minTouchTarget }]}
              />
            </View>

            {/* Real SHA-256 Digest & Commit */}
            <View style={[styles.card, { padding: layout.cardPadding }]}>
              <View style={styles.cardHeader}>
                <ShieldCheck size={16} color={COLORS.online} />
                <Text style={styles.cardTitle} numberOfLines={1}>
                  REAL SHA-256 SEAL (EXPO-CRYPTO)
                </Text>
              </View>

              <Text style={styles.hashPreview} numberOfLines={1}>
                {formatShortHash(liveHash)}
              </Text>
              <Text style={styles.payloadText} numberOfLines={1}>
                PAYLOAD: {payloadBytes} BYTES • TARGET:{' '}
                {networkMode === 'OFFLINE' ? 'QUEUED_LOCAL' : 'AUTO_SYNC'}
              </Text>

              {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}

              {lastCommittedCode ? (
                <View style={styles.successBanner}>
                  <CheckCircle2 size={16} color={COLORS.online} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.successTitle}>
                      {lastCommittedCode} SEALED & PERSISTED
                    </Text>
                    <Pressable
                      onPress={() => router.push('/(tabs)/queue')}
                      style={{ minHeight: 32, justifyContent: 'center' }}
                    >
                      <Text style={styles.successLink}>Inspect packet in Sync Queue →</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <Pressable
                onPress={handleCommit}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Commit Field Report"
                style={({ pressed }) => [
                  styles.primaryButton,
                  { minHeight: 52, opacity: pressed || submitting ? 0.8 : 1 },
                ]}
              >
                <Send size={16} color={COLORS.primaryText} />
                <Text style={styles.primaryButtonText} numberOfLines={1}>
                  {submitting
                    ? 'SEALING & PERSISTING...'
                    : networkMode === 'OFFLINE'
                    ? 'SAVE TO OFFLINE QUEUE'
                    : 'COMMIT & SYNC REPORT'}
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
    flexShrink: 1,
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
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginTop: 2,
  },
  miniLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
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
    minHeight: 100,
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
    paddingHorizontal: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    flexShrink: 1,
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
    gap: 5,
  },
  telemetryStatus: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
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
  manualCoordRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cameraContainer: {
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.background,
  },
  cameraView: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(9,9,11,0.75)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  cameraHint: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  cameraNote: {
    color: COLORS.offline,
    fontSize: 12,
    lineHeight: 17,
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
    flexShrink: 1,
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
    flexShrink: 1,
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
    flexShrink: 1,
  },
});
