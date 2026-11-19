import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Database,
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  WifiOff,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { OperationCard } from '../../src/components/OperationCard';
import { OperationInspectorModal } from '../../src/components/OperationInspectorModal';
import { AuditExportFormat, exportOperationsAudit } from '../../src/services/auditExporter';
import {
  LedgerIntegrityReport,
  verifyLedgerIntegrity,
} from '../../src/services/ledgerIntegrity';
import { FieldOperation, usePulseStore } from '../../src/store/usePulseStore';
import { useAdaptiveLayout } from '../../src/theme/adaptive';
import { COLORS } from '../../src/theme/colors';
import { triggerHaptic } from '../../src/utils/haptics';
import { formatShortHash } from '../../src/utils/hash';

type QueueFilter = 'ALL' | 'QUEUED_LOCAL' | 'SYNCED_CLOUD' | 'SYNC_FAILED' | 'CRITICAL';

const FILTERS: { id: QueueFilter; label: string }[] = [
  { id: 'ALL', label: 'ALL' },
  { id: 'QUEUED_LOCAL', label: 'QUEUED' },
  { id: 'SYNCED_CLOUD', label: 'SYNCED' },
  { id: 'SYNC_FAILED', label: 'FAILED' },
  { id: 'CRITICAL', label: 'CRITICAL' },
];

export default function QueueScreen() {
  const router = useRouter();
  const layout = useAdaptiveLayout();

  const operations = usePulseStore((s) => s.operations);
  const operatorProfile = usePulseStore((s) => s.operatorProfile);
  const networkMode = usePulseStore((s) => s.networkMode);
  const isSyncing = usePulseStore((s) => s.isSyncing);
  const syncQueue = usePulseStore((s) => s.syncQueue);
  const retryOperation = usePulseStore((s) => s.retryOperation);
  const clearAllOperations = usePulseStore((s) => s.clearAllOperations);

  const [filter, setFilter] = useState<QueueFilter>('ALL');
  const [auditNotice, setAuditNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [chainReport, setChainReport] = useState<LedgerIntegrityReport | null>(null);

  useEffect(() => {
    let active = true;
    void verifyLedgerIntegrity(operations).then((report) => {
      if (active) setChainReport(report);
    });
    return () => {
      active = false;
    };
  }, [operations]);

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

  const brokenSet = useMemo(
    () => new Set(chainReport?.brokenRecordIds ?? []),
    [chainReport]
  );

  const recordStatusMap = useMemo(() => {
    const map = new Map<string, { valid: boolean; reason?: string }>();
    if (chainReport) {
      for (const rec of chainReport.records) {
        map.set(rec.id, { valid: rec.valid, reason: rec.reason });
      }
    }
    return map;
  }, [chainReport]);

  const selectedOperation = useMemo(
    () => operations.find((op) => op.id === selectedOperationId) ?? null,
    [operations, selectedOperationId]
  );

  const selectedVerification = selectedOperation
    ? recordStatusMap.get(selectedOperation.id)
    : undefined;

  const cardColumns = layout.columns;

  const handleSyncAll = async () => {
    if (networkMode === 'OFFLINE') {
      await triggerHaptic('warning');
      setAuditNotice(
        'Device is offline. Restore Wi-Fi or Cellular connectivity to replicate queued packets.'
      );
      return;
    }
    await triggerHaptic('medium');
    const res = await syncQueue();
    await triggerHaptic(res.failed > 0 ? 'error' : 'success');
    setAuditNotice(
      `Sync completed: ${res.synced} packet(s) verified and replicated, ${res.failed} failed.`
    );
  };

  const handleExport = async (format: AuditExportFormat) => {
    if (operations.length === 0 || exporting) {
      await triggerHaptic('warning');
      setAuditNotice('No records available to export yet.');
      return;
    }

    setExporting(true);
    await triggerHaptic('light');
    const result = await exportOperationsAudit(operations, format, operatorProfile);
    setExporting(false);

    if (result.ok) {
      await triggerHaptic('success');
      setAuditNotice(
        `Exported ${result.recordCount} record(s) [${result.chainStatus}] to ${result.filename} (${result.method}).`
      );
    } else {
      await triggerHaptic('error');
      setAuditNotice(result.error ?? 'Audit export failed.');
    }
  };

  const handleRetryPacket = async (id: string) => {
    await triggerHaptic('light');
    const ok = await retryOperation(id);
    await triggerHaptic(ok ? 'success' : 'warning');
    setAuditNotice(
      ok
        ? 'Packet uplink verified with SHA-256 and replicated.'
        : 'Packet retry deferred or failed — check endpoint URL and network connectivity.'
    );
  };

  const handleClearAll = async () => {
    await triggerHaptic('warning');
    clearAllOperations();
    setFilter('ALL');
    setSelectedOperationId(null);
    setAuditNotice('Local operations queue cleared.');
  };

  const chainIsTampered = chainReport?.status === 'TAMPER_DETECTED';
  const chainIsVerified = chainReport?.status === 'VERIFIED_CHAIN';

  const listHeader = (
    <View style={styles.headerStack}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.screenTitle, { fontSize: layout.typography.title }]} numberOfLines={1}>
            Sync Queue & SHA-256 Chain
          </Text>
          <Text style={styles.screenSubtitle} numberOfLines={2}>
            Virtualized tamper-evident ledger • Tap any packet for cryptographic inspection
          </Text>
        </View>
      </View>

      {/* Tamper-Evident Chain Integrity Banner */}
      <View
        style={[
          styles.chainBanner,
          {
            backgroundColor: chainIsTampered
              ? COLORS.criticalBg
              : chainIsVerified
              ? COLORS.onlineBg
              : COLORS.surfaceElevated,
            borderColor: chainIsTampered
              ? COLORS.criticalBorder
              : chainIsVerified
              ? COLORS.onlineBorder
              : COLORS.borderStrong,
          },
        ]}
      >
        {chainIsTampered ? (
          <AlertTriangle size={18} color={COLORS.critical} />
        ) : (
          <ShieldCheck
            size={18}
            color={chainIsVerified ? COLORS.online : COLORS.textSecondary}
          />
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            style={[
              styles.chainBannerTitle,
              {
                color: chainIsTampered
                  ? COLORS.critical
                  : chainIsVerified
                  ? COLORS.online
                  : COLORS.textPrimary,
              },
            ]}
            numberOfLines={1}
          >
            {chainReport?.status ?? 'CHECKING_CHAIN'}
            {chainReport && chainReport.totalRecords > 0
              ? ` (${chainReport.verifiedRecords}/${chainReport.totalRecords} VALID)`
              : ''}
          </Text>
          <Text style={styles.chainBannerSub} numberOfLines={2}>
            {chainIsTampered
              ? chainReport?.brokenReason ?? 'Tampering detected in local ledger chain.'
              : chainIsVerified && chainReport
              ? `Head: ${formatShortHash(chainReport.headHash)} • All prevHash links verified`
              : 'Capture your first operation to initialize the Genesis SHA-256 chain.'}
          </Text>
        </View>
      </View>

      {/* Audit Summary Strip */}
      <View style={[styles.summaryCard, { padding: layout.cardPadding }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryLabel}>QUEUED</Text>
            <Text style={[styles.summaryVal, { color: COLORS.offline }]}>{counts.queued}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryLabel}>VERIFIED</Text>
            <Text style={[styles.summaryVal, { color: COLORS.online }]}>{counts.synced}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryLabel}>FAILED</Text>
            <Text style={[styles.summaryVal, { color: COLORS.critical }]}>{counts.failed}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryLabel}>PAYLOAD</Text>
            <Text style={[styles.summaryVal, { color: COLORS.textPrimary }]}>
              {counts.totalBytes}B
            </Text>
          </View>
        </View>

        <View style={[styles.actionsWrap, layout.isCompact && styles.actionsCol]}>
          <Pressable
            onPress={handleSyncAll}
            disabled={isSyncing || counts.queued + counts.failed === 0}
            accessibilityRole="button"
            accessibilityLabel="Sync Pending Queue"
            style={({ pressed }) => [
              styles.primaryButton,
              {
                minHeight: layout.minTouchTarget,
                flex: layout.isCompact ? undefined : 1,
                opacity: pressed || isSyncing || counts.queued + counts.failed === 0 ? 0.65 : 1,
              },
            ]}
          >
            {networkMode === 'OFFLINE' ? (
              <WifiOff size={15} color={COLORS.primaryText} />
            ) : (
              <RefreshCw size={15} color={COLORS.primaryText} />
            )}
            <Text style={styles.primaryButtonText} numberOfLines={1}>
              {isSyncing ? 'SYNCING PACKETS...' : 'SYNC PENDING QUEUE'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleExport('json')}
            disabled={exporting || operations.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Export Audit JSON"
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                minHeight: layout.minTouchTarget,
                opacity: pressed || exporting || operations.length === 0 ? 0.6 : 1,
              },
            ]}
          >
            <Download size={15} color={COLORS.textPrimary} />
            <Text style={styles.secondaryButtonText} numberOfLines={1}>
              EXPORT JSON
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleExport('csv')}
            disabled={exporting || operations.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Export Audit CSV"
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                minHeight: layout.minTouchTarget,
                opacity: pressed || exporting || operations.length === 0 ? 0.6 : 1,
              },
            ]}
          >
            <FileSpreadsheet size={15} color={COLORS.textPrimary} />
            <Text style={styles.secondaryButtonText} numberOfLines={1}>
              EXPORT CSV
            </Text>
          </Pressable>

          {operations.length > 0 ? (
            <Pressable
              onPress={handleClearAll}
              accessibilityRole="button"
              accessibilityLabel="Clear Operations Ledger"
              style={({ pressed }) => [
                styles.clearButton,
                { minHeight: layout.minTouchTarget, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Trash2 size={15} color={COLORS.critical} />
              <Text style={styles.clearButtonText} numberOfLines={1}>
                CLEAR
              </Text>
            </Pressable>
          ) : null}
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
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const listEmpty =
    operations.length === 0 ? (
      <View style={styles.emptyCard}>
        <Database size={26} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>Sync Queue Empty</Text>
        <Text style={styles.emptySubtitle}>
          Capture a field inspection with real GPS coordinates, QR code, or photo evidence to
          inspect its tamper-evident SHA-256 chain here.
        </Text>
        <Pressable
          onPress={() => router.push('/(tabs)/capture')}
          style={({ pressed }) => [
            styles.primaryButton,
            { minHeight: layout.minTouchTarget, paddingHorizontal: 18, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Plus size={16} color={COLORS.primaryText} />
          <Text style={styles.primaryButtonText} numberOfLines={1}>
            GO TO CAPTURE
          </Text>
        </Pressable>
      </View>
    ) : (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No packets match filter "{filter}"</Text>
        <Text style={styles.emptySubtitle}>
          Switch filter to ALL to view all recorded field operations.
        </Text>
      </View>
    );

  const renderOperation = ({ item }: { item: FieldOperation }) => (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        maxWidth:
          cardColumns > 1 ? (`${Math.floor(10000 / cardColumns) / 100}%` as const) : '100%',
      }}
    >
      <OperationCard
        operation={item}
        compact={layout.isCompact}
        detailed
        chainValid={!brokenSet.has(item.id)}
        onPress={async (op) => {
          await triggerHaptic('light');
          setSelectedOperationId(op.id);
        }}
        onRetry={handleRetryPacket}
      />
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        key={`queue-${cardColumns}-${layout.orientation}`}
        data={filteredOperations}
        numColumns={cardColumns}
        keyExtractor={(item) => item.id}
        renderItem={renderOperation}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        removeClippedSubviews={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        style={styles.flatList}
        columnWrapperStyle={cardColumns > 1 ? { gap: layout.gutter } : undefined}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: layout.spacing.md,
          paddingBottom: layout.scrollBottomPadding,
          paddingLeft: layout.contentPaddingLeft,
          paddingRight: layout.contentPaddingRight,
          gap: layout.gutter,
        }}
      />

      <OperationInspectorModal
        operation={selectedOperation}
        chainValid={selectedVerification?.valid ?? true}
        chainReason={selectedVerification?.reason}
        onClose={() => setSelectedOperationId(null)}
        onRetry={handleRetryPacket}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flatList: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  headerStack: {
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
  chainBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  chainBannerTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  chainBannerSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
    flexShrink: 1,
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
    minWidth: 68,
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
    flexShrink: 1,
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
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  clearButton: {
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
  clearButtonText: {
    color: COLORS.critical,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
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
    flexShrink: 1,
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
    gap: 10,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
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
});
