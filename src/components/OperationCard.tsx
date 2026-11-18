import { AlertTriangle, CheckCircle2, Clock, MapPin, QrCode, RefreshCw, Shield } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FieldOperation, PriorityLevel, SyncStatus } from '../store/usePulseStore';
import { MIN_TOUCH_TARGET_DP } from '../theme/adaptive';
import { COLORS } from '../theme/colors';
import { formatShortHash } from '../utils/hash';

interface OperationCardProps {
  operation: FieldOperation;
  compact?: boolean;
  detailed?: boolean;
  onRetry?: (id: string) => void;
}

function getPriorityStyle(priority: PriorityLevel) {
  switch (priority) {
    case 'CRITICAL':
      return {
        color: COLORS.critical,
        bg: COLORS.criticalBg,
        border: COLORS.criticalBorder,
      };
    case 'HIGH':
      return {
        color: COLORS.offline,
        bg: COLORS.offlineBg,
        border: COLORS.offlineBorder,
      };
    default:
      return {
        color: COLORS.online,
        bg: COLORS.onlineBg,
        border: COLORS.onlineBorder,
      };
  }
}

function getSyncStyle(status: SyncStatus) {
  switch (status) {
    case 'SYNCED_CLOUD':
      return {
        label: 'SYNCED_CLOUD',
        color: COLORS.online,
        bg: COLORS.onlineBg,
        border: COLORS.onlineBorder,
      };
    case 'SYNCING':
      return {
        label: 'SYNCING...',
        color: COLORS.accentBlue,
        bg: COLORS.blueBg,
        border: COLORS.blueBorder,
      };
    case 'SYNC_FAILED':
      return {
        label: 'SYNC_FAILED',
        color: COLORS.critical,
        bg: COLORS.criticalBg,
        border: COLORS.criticalBorder,
      };
    default:
      return {
        label: 'QUEUED_LOCAL',
        color: COLORS.offline,
        bg: COLORS.offlineBg,
        border: COLORS.offlineBorder,
      };
  }
}

export function OperationCard({
  operation,
  compact = false,
  detailed = false,
  onRetry,
}: OperationCardProps) {
  const priorityStyle = getPriorityStyle(operation.priority);
  const syncStyle = getSyncStyle(operation.syncStatus);
  const canRetry =
    Boolean(onRetry) &&
    (operation.syncStatus === 'QUEUED_LOCAL' || operation.syncStatus === 'SYNC_FAILED');

  return (
    <View style={[styles.card, { padding: compact ? 12 : 16 }]}>
      <View style={styles.topRow}>
        <View style={styles.codeGroup}>
          <Text style={styles.codeText}>{operation.code}</Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: priorityStyle.bg, borderColor: priorityStyle.border },
            ]}
          >
            <Text style={[styles.badgeText, { color: priorityStyle.color }]}>
              {operation.priority}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.badge,
            { backgroundColor: syncStyle.bg, borderColor: syncStyle.border },
          ]}
        >
          {operation.syncStatus === 'SYNCED_CLOUD' ? (
            <CheckCircle2 size={12} color={syncStyle.color} />
          ) : operation.syncStatus === 'SYNC_FAILED' ? (
            <AlertTriangle size={12} color={syncStyle.color} />
          ) : operation.syncStatus === 'SYNCING' ? (
            <RefreshCw size={12} color={syncStyle.color} />
          ) : (
            <Clock size={12} color={syncStyle.color} />
          )}
          <Text style={[styles.badgeText, { color: syncStyle.color }]}>{syncStyle.label}</Text>
        </View>
      </View>

      <Text style={[styles.title, { fontSize: compact ? 15 : 16 }]} numberOfLines={2}>
        {operation.title}
      </Text>

      <Text style={styles.note} numberOfLines={detailed ? 5 : 2}>
        {operation.technicalNote}
      </Text>

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <MapPin size={13} color={COLORS.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {operation.coordinates.latitude.toFixed(4)}, {operation.coordinates.longitude.toFixed(4)}{' '}
            • {operation.coordinates.sector}
          </Text>
        </View>

        {operation.checkpointId ? (
          <View style={styles.metaItem}>
            <QrCode size={13} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{operation.checkpointId}</Text>
          </View>
        ) : null}

        <View style={styles.metaItem}>
          <Shield size={13} color={COLORS.textMuted} />
          <Text style={styles.monoText}>
            {detailed ? operation.integrityHash : formatShortHash(operation.integrityHash)}
          </Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerStat}>CAT: {operation.category}</Text>
        <Text style={styles.footerStat}>
          {operation.payloadBytes}B • RETRIES: {operation.retryCount}
        </Text>
        {typeof operation.latencyMs === 'number' ? (
          <Text style={[styles.footerStat, { color: COLORS.online }]}>
            {operation.latencyMs}ms
          </Text>
        ) : null}
      </View>

      {operation.lastError ? (
        <View style={styles.errorBanner}>
          <AlertTriangle size={14} color={COLORS.critical} />
          <Text style={styles.errorText}>{operation.lastError}</Text>
        </View>
      ) : null}

      {canRetry ? (
        <Pressable
          onPress={() => onRetry?.(operation.id)}
          accessibilityRole="button"
          accessibilityLabel={`Retry sync for ${operation.code}`}
          style={({ pressed }) => [
            styles.retryButton,
            { minHeight: MIN_TOUCH_TARGET_DP, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <RefreshCw size={15} color={COLORS.primaryText} />
          <Text style={styles.retryButtonText}>
            {operation.syncStatus === 'SYNC_FAILED' ? 'RETRY PACKET UPLINK' : 'PUSH PACKET NOW'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  codeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    lineHeight: 22,
  },
  note: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  metaGrid: {
    gap: 5,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flexShrink: 1,
  },
  monoText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    flexShrink: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 2,
  },
  footerStat: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.criticalBg,
    borderWidth: 1,
    borderColor: COLORS.criticalBorder,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: COLORS.critical,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  retryButtonText: {
    color: COLORS.primaryText,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
