import {
  AlertTriangle,
  Database,
  RefreshCw,
  RotateCcw,
  WifiOff,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OperationCard } from '../../src/components/OperationCard';
import { usePulseStore } from '../../src/store/usePulseStore';
import { useAdaptiveLayout } from '../../src/theme/adaptive';
import { COLORS } from '../../src/theme/colors';
import { triggerHaptic } from '../../src/utils/haptics';

type QueueFilter = 'ALL' | 'QUEUED_LOCAL' | 'SYNCED_CLOUD' | 'SYNC_FAILED' | 'CRITICAL';

const FILTERS: { id: QueueFilter; label: string }[] = [
  { id: 'ALL', label: 'ALL' },
  { id: 'QUEUED_LOCAL', label: 'QUEUED' },
  { id: 'SYNCED_CLOUD', label: 'SYNCED' },
  { id: 'SYNC_FAILED', label: 'FAILED' },
  { id: 'CRITICAL', label: 'CRITICAL' },
];

export default function QueueScreen() {
  const layout = useAdaptiveLayout();

  const operations = usePulseStore((s) => s.operations);
  const networkMode = usePulseStore((s) => s.networkMode);
  const isSyncing = usePulseStore((s) => s.isSyncing);
  const simulatedFaultMode = usePulseStore((s) => s.simulatedFaultMode);
  const syncQueue = usePulseStore((s) => s.syncQueue);
  const retryOperation = usePulseStore((s) => s.retryOperation);
  const simulateNetworkFailure = usePulseStore((s) => s.simulateNetworkFailure);
  const setSimulatedFaultMode = usePulseStore((s) => s.setSimulatedFaultMode);
  const resetDemoData = usePulseStore((s) => s.resetDemoData);

  const [filter, setFilter] = useState<QueueFilter>('ALL');
  const [auditNotice, setAuditNotice] = useState<string | null>(null);

  const estimatedWidth =
    Math.min(layout.width, layout.maxContentWidth) -
    layout.safePadding.left -
    layout.safePadding.right;
  const [contentWidth, setContentWidth] = useState<number>(Math.max(280, estimatedWidth));

  const counts = useMemo(() => {
    let queued = 0;
    let synced = 0;
    let failed = 0;
    let totalBytes = 0;
    for (const op of operations) {
      totalBytes += op.payloadBytes;
      if (op.syncStatus === 'QUEUED_LOCAL' || op.syncStatus === 'SYNCING') queued += 1;
      else if (op.syncStatus === 'SYNCED_CLOUD') synced += 1;
      else if (op.syncStatus === 'SYNC_FAILED') failed += 1;
    }
    return { queued, synced, failed, totalBytes };
  }, [operations]);

  const filteredOperations = useMemo(() => {
    return operations.filter((op) => {
      if (filter === 'ALL') return true;
      if (filter === 'CRITICAL') return op.priority === 'CRITICAL';
      return op.syncStatus === filter;
    });
  }, [operations, filter]);

  const cardColumns = layout.columns;
  const cardWidth =
    cardColumns === 1
      ? contentWidth
      : Math.floor((contentWidth - layout.gutter * (cardColumns - 1)) / cardColumns);

  const handleSyncAll = async () => {
    if (networkMode === 'OFFLINE') {
      await triggerHaptic('warning');
      setAuditNotice('Device is in OFFLINE AIRPLANE MODE. Switch header to ONLINE to flush packets.');
      return;
    }
    await triggerHaptic('medium');
    if (simulatedFaultMode) {
      setSimulatedFaultMode(false);
    }
    const res = await syncQueue();
    await triggerHaptic(res.failed > 0 ? 'error' : 'success');
    setAuditNotice(
      `Sequential sync finished: ${res.synced} packet(s) replicated to cloud, ${res.failed} failed.`
    );
  };

  const handleSimulateFault = async () => {
    await triggerHaptic('error');
    const faulted = simulateNetworkFailure();
    setFilter('ALL');
    setAuditNotice(
      `Injected uplink fault on ${faulted.code} (retry #${faulted.retryCount}). Tap RETRY PACKET UPLINK to recover.`
    );
  };

  const handleRetryPacket = async (id: string) => {
    await triggerHaptic('light');
    if (simulatedFaultMode) {
      setSimulatedFaultMode(false);
    }
    const ok = await retryOperation(id);
    await triggerHaptic(ok ? 'success' : 'warning');
    setAuditNotice(
      ok
        ? 'Packet uplink recovered and acknowledged by cloud gateway.'
        : 'Retry deferred: device is currently in OFFLINE AIRPLANE MODE.'
    );
  };

  const handleReset = async () => {
    await triggerHaptic('light');
    resetDemoData();
    setFilter('ALL');
    setAuditNotice('Demo dataset restored to initial 6 field operations.');
  };

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
      <View
        style={[styles.container, { maxWidth: layout.maxContentWidth }]}
        onLayout={(e) => {
          const measured = Math.floor(e.nativeEvent.layout.width);
          if (measured > 0 && Math.abs(measured - contentWidth) > 2) {
            setContentWidth(measured);
          }
        }}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.screenTitle, { fontSize: layout.typography.title }]}>
              Sync Queue Audit
            </Text>
            <Text style={styles.screenSubtitle}>
              Local AsyncStorage packet buffer vs Cloud SHA-256 ledger
            </Text>
          </View>
        </View>

        {/* Audit Summary Strip */}
        <View style={[styles.summaryCard, { padding: layout.cardPadding }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryLabel}>QUEUED LOCAL</Text>
              <Text style={[styles.summaryVal, { color: COLORS.offline }]}>{counts.queued}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryLabel}>CLOUD SYNCED</Text>
              <Text style={[styles.summaryVal, { color: COLORS.online }]}>{counts.synced}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryLabel}>SYNC FAILED</Text>
              <Text style={[styles.summaryVal, { color: COLORS.critical }]}>{counts.failed}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryLabel}>LEDGER SIZE</Text>
              <Text style={[styles.summaryVal, { color: COLORS.textPrimary }]}>
                {counts.totalBytes}B
              </Text>
            </View>
          </View>

          <View style={[styles.actionsWrap, layout.isCompact && styles.actionsCol]}>
            <Pressable
              onPress={handleSyncAll}
              disabled={isSyncing}
              accessibilityRole="button"
              accessibilityLabel="Sync Pending Queue"
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  minHeight: layout.minTouchTarget,
                  flex: layout.isCompact ? undefined : 1,
                  opacity: pressed || isSyncing ? 0.8 : 1,
                },
              ]}
            >
              {networkMode === 'OFFLINE' ? (
                <WifiOff size={15} color={COLORS.primaryText} />
              ) : (
                <RefreshCw size={15} color={COLORS.primaryText} />
              )}
              <Text style={styles.primaryButtonText}>
                {isSyncing ? 'SYNCING PACKETS...' : 'SYNC PENDING QUEUE'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSimulateFault}
              accessibilityRole="button"
              accessibilityLabel="Simulate Network Fault"
              style={({ pressed }) => [
                styles.faultButton,
                { minHeight: layout.minTouchTarget, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <AlertTriangle size={15} color={COLORS.critical} />
              <Text style={styles.faultButtonText}>SIMULATE FAULT</Text>
            </Pressable>

            <Pressable
              onPress={handleReset}
              accessibilityRole="button"
              accessibilityLabel="Reset Demo Data"
              style={({ pressed }) => [
                styles.secondaryButton,
                { minHeight: layout.minTouchTarget, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <RotateCcw size={15} color={COLORS.textSecondary} />
              <Text style={styles.secondaryButtonText}>RESET</Text>
            </Pressable>
          </View>

          {auditNotice ? (
            <View style={styles.noticeBox}>
              <Database size={14} color={COLORS.textSecondary} />
              <Text style={styles.noticeText}>{auditNotice}</Text>
            </View>
          ) : null}
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={async () => {
                  await triggerHaptic('light');
                  setFilter(item.id);
                }}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    minHeight: layout.minTouchTarget,
                    backgroundColor: active ? COLORS.primary : COLORS.card,
                    borderColor: active ? COLORS.primary : COLORS.borderStrong,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? COLORS.primaryText : COLORS.textSecondary },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Filtered Packet Cards */}
        {filteredOperations.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No packets match filter "{filter}"</Text>
            <Text style={styles.emptySubtitle}>
              Switch filter to ALL or create a new field report in the Capture tab.
            </Text>
          </View>
        ) : (
          <View style={[styles.grid, { gap: layout.gutter }]}>
            {filteredOperations.map((op) => (
              <View key={op.id} style={{ width: cardWidth }}>
                <OperationCard
                  operation={op}
                  compact={layout.isCompact}
                  detailed
                  onRetry={handleRetryPacket}
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
  summaryCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryStat: {
    minWidth: 72,
    gap: 2,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  summaryVal: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  actionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionsCol: {
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
  },
  faultButton: {
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
  faultButtonText: {
    color: COLORS.critical,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
  },
  noticeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  filterRow: {
    gap: 8,
  },
  filterChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
