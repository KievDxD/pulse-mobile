import { useRouter } from 'expo-router';
import { Lock, Plane, RefreshCw, ShieldCheck, Wifi } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { subscribeToNetworkStatus } from '../services/networkMonitor';
import { usePulseStore } from '../store/usePulseStore';
import { useAdaptiveLayout } from '../theme/adaptive';
import { COLORS } from '../theme/colors';
import { triggerHaptic } from '../utils/haptics';

export function OperationalHeader() {
  const router = useRouter();
  const layout = useAdaptiveLayout();

  const networkMode = usePulseStore((s) => s.networkMode);
  const networkInfo = usePulseStore((s) => s.networkInfo);
  const isSyncing = usePulseStore((s) => s.isSyncing);
  const isUnlocked = usePulseStore((s) => s.isUnlocked);
  const authMethod = usePulseStore((s) => s.authMethod);
  const operations = usePulseStore((s) => s.operations);
  const applyRealNetworkStatus = usePulseStore((s) => s.applyRealNetworkStatus);
  const refreshNetworkStatus = usePulseStore((s) => s.refreshNetworkStatus);

  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus((status) => {
      void applyRealNetworkStatus(status);
    });
    return unsubscribe;
  }, [applyRealNetworkStatus]);

  const pendingCount = operations.filter(
    (op) => op.syncStatus === 'QUEUED_LOCAL' || op.syncStatus === 'SYNC_FAILED'
  ).length;

  const isOnline = networkMode === 'ONLINE';

  const handleRefreshNetwork = async () => {
    await triggerHaptic('light');
    const latest = await refreshNetworkStatus();
    await triggerHaptic(latest.isOffline ? 'warning' : 'success');
  };

  const handleOpenSecurity = async () => {
    await triggerHaptic('light');
    router.push('/lock');
  };

  const authBadgeLabel = !isUnlocked ? 'LOCK' : authMethod === 'BIOMETRIC' ? 'BIO' : 'PIN';

  const networkLabel = isSyncing
    ? 'SYNCING'
    : !isOnline
    ? layout.isCompact
      ? 'OFFLINE'
      : 'AIRPLANE / OFFLINE'
    : networkInfo.type !== 'UNKNOWN'
    ? networkInfo.type
    : 'ONLINE';

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingTop: layout.safePadding.top,
          paddingLeft: layout.safePadding.left,
          paddingRight: layout.safePadding.right,
        },
      ]}
    >
      <View style={[styles.inner, { maxWidth: layout.maxContentWidth }]}>
        <View style={styles.brandBlock}>
          <View style={styles.brandRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? COLORS.online : COLORS.offline },
              ]}
            />
            <Text
              style={[
                styles.brandTitle,
                { fontSize: layout.clampFont(layout.isCompact ? 13 : 15) },
              ]}
              numberOfLines={1}
            >
              PULSE // MOBILE
            </Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText} numberOfLines={1}>
                V2.0
              </Text>
            </View>
          </View>
          <Text style={styles.subline} numberOfLines={1}>
            {layout.breakpoint.toUpperCase()} • {layout.columns}COL
            {!layout.isCompact && networkInfo.ipAddress ? ` • ${networkInfo.ipAddress}` : ''}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={handleOpenSecurity}
            accessibilityRole="button"
            accessibilityLabel="Security Clearance Gate"
            style={({ pressed }) => [
              styles.securityButton,
              {
                minWidth: layout.minTouchTarget,
                minHeight: layout.minTouchTarget,
                borderColor: isUnlocked ? COLORS.onlineBorder : COLORS.offlineBorder,
                backgroundColor: isUnlocked ? COLORS.onlineBg : COLORS.offlineBg,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            {isUnlocked ? (
              <ShieldCheck size={15} color={COLORS.online} />
            ) : (
              <Lock size={15} color={COLORS.offline} />
            )}
            <Text
              style={[
                styles.securityText,
                { color: isUnlocked ? COLORS.online : COLORS.offline },
              ]}
              numberOfLines={1}
            >
              {authBadgeLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleRefreshNetwork}
            accessibilityRole="button"
            accessibilityLabel="Refresh Real Device Network State"
            style={({ pressed }) => [
              styles.networkButton,
              {
                minHeight: layout.minTouchTarget,
                borderColor: isOnline ? COLORS.onlineBorder : COLORS.offlineBorder,
                backgroundColor: isOnline ? COLORS.onlineBg : COLORS.offlineBg,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            {isSyncing ? (
              <RefreshCw size={14} color={COLORS.online} />
            ) : isOnline ? (
              <Wifi size={14} color={COLORS.online} />
            ) : (
              <Plane size={14} color={COLORS.offline} />
            )}
            <Text
              style={[
                styles.networkText,
                { color: isOnline ? COLORS.online : COLORS.offline },
              ]}
              numberOfLines={1}
            >
              {networkLabel}
            </Text>
            {pendingCount > 0 ? (
              <View
                style={[
                  styles.queueCountPill,
                  { backgroundColor: isOnline ? COLORS.online : COLORS.offline },
                ]}
              >
                <Text style={styles.queueCountText}>{pendingCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
  },
  inner: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  brandBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  brandTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  versionBadge: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    flexShrink: 0,
  },
  versionText: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subline: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  securityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  networkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 170,
  },
  networkText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  queueCountPill: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  queueCountText: {
    color: COLORS.primaryText,
    fontSize: 10,
    fontWeight: '800',
  },
});
