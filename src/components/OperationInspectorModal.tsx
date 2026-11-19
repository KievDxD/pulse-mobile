import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ExternalLink,
  Link2,
  MapPin,
  RefreshCw,
  Shield,
  UserCheck,
  X,
} from 'lucide-react-native';
import React from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MIN_TOUCH_TARGET_DP, useAdaptiveLayout } from '../theme/adaptive';
import { COLORS } from '../theme/colors';
import type { FieldOperation } from '../types/operations';
import { triggerHaptic } from '../utils/haptics';

interface OperationInspectorModalProps {
  operation: FieldOperation | null;
  chainValid?: boolean;
  chainReason?: string;
  onClose: () => void;
  onRetry?: (id: string) => void;
}

export function OperationInspectorModal({
  operation,
  chainValid = true,
  chainReason,
  onClose,
  onRetry,
}: OperationInspectorModalProps) {
  const layout = useAdaptiveLayout();

  if (!operation) return null;

  const coords = operation.coordinates;
  const mapsUrl = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
  const canRetry =
    Boolean(onRetry) &&
    (operation.syncStatus === 'QUEUED_LOCAL' || operation.syncStatus === 'SYNC_FAILED');

  const handleOpenMaps = async () => {
    await triggerHaptic('light');
    try {
      await Linking.openURL(mapsUrl);
    } catch {
      // Ignore if URL handler unavailable in restricted test/web environments
    }
  };

  return (
    <Modal
      visible={Boolean(operation)}
      animationType="slide"
      transparent
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              maxWidth: layout.maxContentWidth,
              maxHeight: layout.isPhoneLandscape ? '95%' : '90%',
              paddingTop: 16,
              paddingBottom: Math.max(layout.insets.bottom, 16),
              paddingLeft: layout.safePadding.left,
              paddingRight: layout.safePadding.right,
            },
          ]}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={styles.modalEyebrow} numberOfLines={1}>
                CRYPTOGRAPHIC INSPECTOR • CHAIN #{operation.chainIndex}
              </Text>
              <Text style={[styles.modalTitle, { fontSize: layout.typography.title }]} numberOfLines={2}>
                {operation.code} — {operation.title}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close Cryptographic Inspector"
              style={({ pressed }) => [
                styles.closeButton,
                {
                  minWidth: MIN_TOUCH_TARGET_DP,
                  minHeight: MIN_TOUCH_TARGET_DP,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <X size={18} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
            showsVerticalScrollIndicator
          >
            {/* Chain Verification Banner */}
            <View
              style={[
                styles.chainBanner,
                {
                  backgroundColor: chainValid ? COLORS.onlineBg : COLORS.criticalBg,
                  borderColor: chainValid ? COLORS.onlineBorder : COLORS.criticalBorder,
                },
              ]}
            >
              {chainValid ? (
                <CheckCircle2 size={18} color={COLORS.online} />
              ) : (
                <AlertTriangle size={18} color={COLORS.critical} />
              )}
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text
                  style={[
                    styles.chainStatusTitle,
                    { color: chainValid ? COLORS.online : COLORS.critical },
                  ]}
                >
                  {chainValid ? 'VERIFIED_CHAIN' : 'TAMPER_DETECTED'}
                </Text>
                <Text style={styles.chainStatusSub}>
                  {chainValid
                    ? 'Payload SHA-256 digest and prevHash pointer verified intact.'
                    : chainReason ?? 'Record signature or chain pointer failed verification.'}
                </Text>
              </View>
            </View>

            {/* Photo Evidence Section */}
            {operation.photoEvidence ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Camera size={15} color={COLORS.textPrimary} />
                  <Text style={styles.sectionTitle}>SEALED PHOTOGRAPHIC EVIDENCE</Text>
                </View>
                <Image
                  source={{ uri: operation.photoEvidence.uri }}
                  style={[
                    styles.fullPhoto,
                    { height: layout.isPhoneLandscape ? 130 : 200 },
                  ]}
                  resizeMode="cover"
                />
                <Text style={styles.monoLine}>
                  RESOLUTION: {operation.photoEvidence.width} × {operation.photoEvidence.height} px
                </Text>
                <Text style={styles.monoLine}>
                  CAPTURED UTC: {operation.photoEvidence.capturedAt}
                </Text>
                {operation.photoEvidence.exifSummary ? (
                  <Text style={styles.monoLine}>
                    EXIF: {operation.photoEvidence.exifSummary}
                  </Text>
                ) : null}
                {typeof operation.photoEvidence.gpsLatitude === 'number' &&
                typeof operation.photoEvidence.gpsLongitude === 'number' ? (
                  <Text style={styles.monoLine}>
                    PHOTO GPS: {operation.photoEvidence.gpsLatitude.toFixed(6)},{' '}
                    {operation.photoEvidence.gpsLongitude.toFixed(6)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* GPS Coordinates + External Map Link */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MapPin size={15} color={COLORS.online} />
                <Text style={styles.sectionTitle}>GPS TELEMETRY & FIELD OBSERVATION</Text>
              </View>
              <Text style={styles.bodyText}>{operation.technicalNote}</Text>
              <Text style={styles.monoLine}>
                COORDS: {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)} (
                {coords.source})
              </Text>
              <Text style={styles.monoLine}>
                ACCURACY:{' '}
                {coords.accuracyMeters !== null ? `±${coords.accuracyMeters}m` : 'MANUAL'} •
                ALTITUDE:{' '}
                {coords.altitudeMeters !== null ? `${coords.altitudeMeters}m` : 'N/A'}
              </Text>
              {operation.checkpointId ? (
                <Text style={styles.monoLine}>CHECKPOINT: {operation.checkpointId}</Text>
              ) : null}
              <Pressable
                onPress={handleOpenMaps}
                accessibilityRole="button"
                accessibilityLabel="Open GPS Coordinates in Maps"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { minHeight: MIN_TOUCH_TARGET_DP, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <ExternalLink size={15} color={COLORS.textPrimary} />
                <Text style={styles.secondaryButtonText}>OPEN IN MAPS ({coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)})</Text>
              </Pressable>
            </View>

            {/* Operator Identity */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <UserCheck size={15} color={COLORS.textPrimary} />
                <Text style={styles.sectionTitle}>OPERATOR IDENTITY</Text>
              </View>
              <Text style={styles.monoLine}>
                OPERATOR ID: {operation.operatorProfile?.operatorId ?? 'OP-UNASSIGNED'}
              </Text>
              <Text style={styles.monoLine}>
                CALLSIGN: {operation.operatorProfile?.callsign ?? 'FIELD-UNIT'}
              </Text>
              <Text style={styles.monoLine}>
                UNIT / SECTOR: {operation.operatorProfile?.unitSector ?? 'SECTOR-01'}
              </Text>
            </View>

            {/* Cryptographic Hashes */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Shield size={15} color={COLORS.online} />
                <Text style={styles.sectionTitle}>CRYPTOGRAPHIC CHAIN HASHES</Text>
              </View>
              <Text style={styles.hashLabel}>PAYLOAD HASH (SHA-256)</Text>
              <Text style={styles.fullHash} selectable>
                {operation.integrityHash}
              </Text>
              <View style={styles.prevRow}>
                <Link2 size={13} color={COLORS.textMuted} />
                <Text style={styles.hashLabel}>PREVIOUS HASH (CHAIN #{Math.max(0, operation.chainIndex - 1)})</Text>
              </View>
              <Text style={styles.fullHash} selectable>
                {operation.prevHash}
              </Text>
            </View>

            {/* Synchronization Audit Log */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <RefreshCw size={15} color={COLORS.textPrimary} />
                <Text style={styles.sectionTitle}>
                  SYNCHRONIZATION AUDIT LOG ({operation.syncLog?.length ?? 0})
                </Text>
              </View>
              {(operation.syncLog ?? []).map((entry, idx) => (
                <View key={`${entry.timestamp}-${idx}`} style={styles.logItem}>
                  <View style={styles.logTop}>
                    <Text
                      style={[
                        styles.logOutcome,
                        {
                          color:
                            entry.outcome === 'SUCCESS'
                              ? COLORS.online
                              : entry.outcome === 'FAILED'
                              ? COLORS.critical
                              : entry.outcome === 'SYNCING'
                              ? COLORS.accentBlue
                              : COLORS.offline,
                        },
                      ]}
                    >
                      {entry.outcome}
                    </Text>
                    <Text style={styles.logTime}>{entry.timestamp.slice(11, 19)} UTC</Text>
                  </View>
                  <Text style={styles.logMsg}>{entry.message}</Text>
                </View>
              ))}
            </View>

            {canRetry ? (
              <Pressable
                onPress={() => onRetry?.(operation.id)}
                accessibilityRole="button"
                accessibilityLabel="Retry Packet Uplink"
                style={({ pressed }) => [
                  styles.primaryButton,
                  { minHeight: MIN_TOUCH_TARGET_DP, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <RefreshCw size={15} color={COLORS.primaryText} />
                <Text style={styles.primaryButtonText}>RETRY PACKET UPLINK</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
  },
  modalEyebrow: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  closeButton: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chainBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  chainStatusTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  chainStatusSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    flexShrink: 1,
  },
  fullPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
  },
  bodyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  monoLine: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  hashLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  prevRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  fullHash: {
    color: COLORS.online,
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 8,
  },
  logItem: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  logTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  logOutcome: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  logTime: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  logMsg: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
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
    fontSize: 12,
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
    paddingHorizontal: 12,
    marginTop: 2,
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
});
