import { useRouter } from 'expo-router';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Compass,
  Plus,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OperationCard } from '../../src/components/OperationCard';
import { isValidHttpEndpoint } from '../../src/services/syncClient';
import { usePulseStore } from '../../src/store/usePulseStore';
import { useAdaptiveLayout } from '../../src/theme/adaptive';
import { COLORS } from '../../src/theme/colors';
import { triggerHaptic } from '../../src/utils/haptics';

export default function CommandScreen() {
  const router = useRouter();
  const layout = useAdaptiveLayout();

  const operations = usePulseStore((s) => s.operations);
  const networkMode = usePulseStore((s) => s.networkMode);
  const networkInfo = usePulseStore((s) => s.networkInfo);
  const syncEndpointUrl = usePulseStore((s) => s.syncEndpointUrl);
  const isSyncing = usePulseStore((s) => s.isSyncing);
  const lastSyncAt = usePulseStore((s) => s.lastSyncAt);
  const syncQueue = usePulseStore((s) => s.syncQueue);
  const retryOperation = usePulseStore((s) => s.retryOperation);

  const estimatedWidth =
    Math.min(layout.width, layout.maxContentWidth) -
    layout.safePadding.left -
    layout.safePadding.right;
  const [contentWidth, setContentWidth] = useState<number>(Math.max(260, estimatedWidth));

  const syncedOps = operations.filter((op) => op.syncStatus === 'SYNCED_CLOUD');
  const queuedOps = operations.filter(
    (op) => op.syncStatus === 'QUEUED_LOCAL' || op.syncStatus === 'SYNC_FAILED'
  );
  const criticalOps = operations.filter((op) => op.priority === 'CRITICAL');

  const latencies = syncedOps
    .map((op) => op.latencyMs)
    .filter((ms): ms is number => typeof ms === 'number');
  const meanLatency =
    latencies.length > 0
      ? Math.round(latencies.reduce((acc, v) => acc + v, 0) / latencies.length)
      : 0;

  const syncRatio = operations.length > 0 ? syncedOps.length / operations.length : 1;

  const kpiColumns = layout.columns === 1 ? 2 : layout.columns === 2 ? 3 : 6;
  const kpiGap = layout.gutter;
  const kpiCardWidth = Math.floor((contentWidth - kpiGap * (kpiColumns - 1)) / kpiColumns);

  const feedColumns = layout.columns;
  const feedGap = layout.gutter;
  const feedCardWidth =
    feedColumns === 1
      ? contentWidth
      : Math.floor((contentWidth - feedGap * (feedColumns - 1)) / feedColumns);

  const handleManualSync = async () => {
    if (networkMode === 'OFFLINE') {
      await triggerHaptic('warning');
      return;
    }
    await triggerHaptic('medium');
    const result = await syncQueue();
    if (result.synced > 0) {
      await triggerHaptic('success');
    }
  };

  const handleRetryItem = async (id: string) => {
    await triggerHaptic('light');
    const ok = await retryOperation(id);
    await triggerHaptic(ok ? 'success' : 'warning');
  };

  const engineStateLabel = isSyncing
    ? 'SYNC_IN_PROGRESS'
    : networkMode === 'OFFLINE'
    ? 'OFFLINE_BUFFERING'
    : queuedOps.length > 0
    ? 'ONLINE_PENDING_FLUSH'
    : 'ONLINE_READY';

  const engineColor =
    networkMode === 'OFFLINE'
      ? COLORS.offline
      : isSyncing
      ? COLORS.accentBlue
      : COLORS.online;

  const transportTarget = isValidHttpEndpoint(syncEndpointUrl)
    ? `HTTP API (${syncEndpointUrl})`
    : 'LOCAL SHA-256 TRANSACTIONAL LEDGER';

  const kpis = [
    {
      label: 'TOTAL OPS',
      value: String(operations.length),
      color: COLORS.textPrimary,
      icon: Activity,
    },
    {
      label: 'REPLICATED',
      value: String(syncedOps.length),
      color: COLORS.online,
      icon: CheckCircle2,
    },
    {
      label: 'LOCAL QUEUE',
      value: String(queuedOps.length),
      color: queuedOps.length > 0 ? COLORS.offline : COLORS.textSecondary,
      icon: Clock,
    },
    {
      label: 'CRITICAL',
      value: String(criticalOps.length),
      color: criticalOps.length > 0 ? COLORS.critical : COLORS.textSecondary,
      icon: AlertOctagon,
    },
    {
      label: 'MEAN LATENCY',
      value: meanLatency > 0 ? `${meanLatency}ms` : '—',
      color: COLORS.textPrimary,
      icon: RefreshCw,
    },
    {
      label: 'SHA-256 AUDIT',
      value: operations.length > 0 ? 'VERIFIED' : 'READY',
      color: COLORS.online,
      icon: ShieldCheck,
    },
  ];

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
      <View
        style={[styles.container, { maxWidth: layout.maxContentWidth }]}
        onLayout={(e) => {
          const measured = Math.floor(e.nativeEvent.layout.width);
          if (measured > 0 && Math.abs(measured - contentWidth) > 2) {
            setContentWidth(measured);
          }
        }}
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontSize: layout.typography.title }]} numberOfLines={1}>
            Operational Command
          </Text>
          <Text style={styles.sectionMeta} numberOfLines={1}>
            {layout.columns} COL • {layout.breakpoint.toUpperCase()}
          </Text>
        </View>

        <View style={[styles.kpiGrid, { gap: kpiGap }]}>
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <View
                key={kpi.label}
                style={[
                  styles.kpiCard,
                  {
                    width: kpiCardWidth,
                    padding: layout.cardPadding,
                  },
                ]}
              >
                <View style={styles.kpiTop}>
                  <Text style={styles.kpiLabel} numberOfLines={1}>
                    {kpi.label}
                  </Text>
                  <Icon size={14} color={kpi.color} />
                </View>
                <Text
                  style={[
                    styles.kpiValue,
                    { color: kpi.color, fontSize: layout.typography.title },
                  ]}
                  numberOfLines={1}
                >
                  {kpi.value}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Sync Engine Status Card */}
        <View style={[styles.engineCard, { padding: layout.cardPadding }]}>
          <View style={styles.engineTop}>
            <View style={styles.engineTitleRow}>
              <View style={[styles.engineDot, { backgroundColor: engineColor }]} />
              <Text style={styles.engineTitle} numberOfLines={1}>
                OFFLINE-FIRST SYNC ENGINE
              </Text>
            </View>
            <View
              style={[
                styles.enginePill,
                {
                  borderColor:
                    networkMode === 'OFFLINE' ? COLORS.offlineBorder : COLORS.onlineBorder,
                  backgroundColor:
                    networkMode === 'OFFLINE' ? COLORS.offlineBg : COLORS.onlineBg,
                },
              ]}
            >
              <Text style={[styles.enginePillText, { color: engineColor }]} numberOfLines={1}>
                {engineStateLabel}
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.round(syncRatio * 100)}%`,
                  backgroundColor: queuedOps.length === 0 ? COLORS.online : COLORS.offline,
                },
              ]}
            />
          </View>

          <View style={styles.engineStatsRow}>
            <Text style={styles.engineStat} numberOfLines={1}>
              LINK: {networkInfo.type}
              {networkInfo.ipAddress ? ` (${networkInfo.ipAddress})` : ''}
            </Text>
            <Text style={styles.engineStat} numberOfLines={1}>
              LAST ACK: {lastSyncAt ? lastSyncAt.slice(11, 19) + ' UTC' : 'NONE'}
            </Text>
          </View>

          <Text style={styles.transportLine} numberOfLines={2}>
            TARGET: {transportTarget}
          </Text>

          {networkMode === 'OFFLINE' ? (
            <View style={styles.offlineCallout}>
              <WifiOff size={15} color={COLORS.offline} />
              <Text style={styles.offlineCalloutText}>
                Device connectivity lost / Airplane Mode active. Captured reports are sealed with
                SHA-256 and buffered locally until OS connectivity restores.
              </Text>
            </View>
          ) : null}

          <View style={[styles.ctaRow, layout.isCompact && styles.ctaColumn]}>
            <Pressable
              onPress={handleManualSync}
              disabled={isSyncing || queuedOps.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Sync Pending Queue Now"
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  minHeight: layout.minTouchTarget,
                  flex: layout.isCompact ? undefined : 1,
                  opacity: pressed || isSyncing || queuedOps.length === 0 ? 0.65 : 1,
                },
              ]}
            >
              <RefreshCw size={16} color={COLORS.primaryText} />
              <Text style={styles.primaryButtonText} numberOfLines={1}>
                {networkMode === 'OFFLINE'
                  ? 'OFFLINE — AUTO-SYNC ON RECONNECT'
                  : isSyncing
                  ? 'SYNCING QUEUE...'
                  : `SYNC QUEUE (${queuedOps.length})`}
              </Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                await triggerHaptic('light');
                router.push('/(tabs)/capture');
              }}
              accessibilityRole="button"
              accessibilityLabel="Capture Field Report"
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  minHeight: layout.minTouchTarget,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Plus size={16} color={COLORS.textPrimary} />
              <Text style={styles.secondaryButtonText} numberOfLines={1}>
                CAPTURE REPORT
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Field Operations Feed or Clean Empty State */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontSize: layout.typography.subtitle }]} numberOfLines={1}>
            Field Operations Ledger
          </Text>
          {operations.length > 0 ? (
            <Pressable
              onPress={() => router.push('/(tabs)/queue')}
              style={{ minHeight: layout.minTouchTarget, justifyContent: 'center' }}
            >
              <Text style={styles.linkText} numberOfLines={1}>
                AUDIT QUEUE →
              </Text>
            </Pressable>
          ) : null}
        </View>

        {operations.length === 0 ? (
          <View style={[styles.emptyCard, { padding: layout.cardPadding + 8 }]}>
            <Compass size={28} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No Field Operations Recorded</Text>
            <Text style={styles.emptySubtitle}>
              Your local queue and verified ledger are clean. Capture your first real inspection
              using hardware GPS telemetry, QR camera scanning, and SHA-256 sealing.
            </Text>
            <Pressable
              onPress={async () => {
                await triggerHaptic('medium');
                router.push('/(tabs)/capture');
              }}
              accessibilityRole="button"
              accessibilityLabel="Capture First Field Report"
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  minHeight: layout.minTouchTarget,
                  paddingHorizontal: 18,
                  marginTop: 6,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Plus size={16} color={COLORS.primaryText} />
              <Text style={styles.primaryButtonText} numberOfLines={1}>
                CAPTURE FIRST FIELD REPORT
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.feedGrid, { gap: feedGap }]}>
            {operations.map((op) => (
              <View key={op.id} style={{ width: feedCardWidth }}>
                <OperationCard
                  operation={op}
                  compact={layout.isCompact}
                  onRetry={handleRetryItem}
                />
              </View>
            ))}
          </View>
        )}
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  sectionMeta: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    flexShrink: 0,
  },
  linkText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  kpiCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    gap: 8,
  },
  kpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  kpiLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    flex: 1,
    flexShrink: 1,
  },
  kpiValue: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  engineCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    gap: 10,
  },
  engineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  engineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  engineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  engineTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  enginePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 1,
  },
  enginePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  engineStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  engineStat: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  transportLine: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  offlineCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.offlineBg,
    borderWidth: 1,
    borderColor: COLORS.offlineBorder,
    borderRadius: 8,
    padding: 10,
  },
  offlineCalloutText: {
    color: COLORS.offline,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
    lineHeight: 17,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ctaColumn: {
    flexDirection: 'column',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontSize: 12,
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
  emptyCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 420,
  },
  feedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
