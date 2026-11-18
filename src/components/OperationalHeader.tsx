import { useRouter } from 'expo-router';
import { Lock, Plane, RefreshCw, ShieldCheck, Wifi } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePulseStore } from '../store/usePulseStore';
import { useAdaptiveLayout } from '../theme/adaptive';
import { COLORS } from '../theme/colors';
import { triggerHaptic } from '../utils/haptics';

export function OperationalHeader() {
  const router = useRouter();
  const layout = useAdaptiveLayout();

  const networkMode = usePulseStore((s) => s.networkMode);
  const isSyncing = usePulseStore((s) => s.isSyncing);
  const isUnlocked = usePulseStore((s) => s.isUnlocked);
  const authMethod = usePulseStore((s) => s.authMethod);
  const operations = usePulseStore((s) => s.operations);
  const toggleNetworkMode = usePulseStore((s) => s.toggleNetworkMode);

  const pendingCount = operations.filter(
    (op) => op.syncStatus === 'QUEUED_LOCAL' || op.syncStatus === 'SYNC_FAILED'
  ).length;

  const isOnline = networkMode === 'ONLINE';

  const handleNetworkToggle = async () => {
    await triggerHaptic(isOnline ? 'warning' : 'success');
    await toggleNetworkMode();
  };

  const handleOpenSecurity = async () => {
    await triggerHaptic('light');
    router.push('/lock');
  };

  const authBadgeLabel = !isUnlocked
    ? 'LOCK'
    : authMethod === 'BIOMETRIC'
    ? 'BIO'
    : authMethod === 'PIN'
    ? 'PIN'
    : 'DEMO';

  const networkLabel = layout.isCompact
    ? isOnline
      ? isSyncing
        ? 'SYNC'
        : 'ONLINE'
      : 'OFFLINE'
    : isOnline
    ? isSyncing
      ? 'SYNCING'
      : 'ONLINE'
    : 'OFFLINE AIRPLANE';

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
              style={[styles.brandTitle, { fontSize: layout.isCompact ? 13 : 15 }]}
              numberOfLines={1}
            >
              PULSE // MOBILE
            </Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>V1.0</Text>
            </View>
          </View>
          <Text style={styles.subline} numberOfLines={1}>
            {layout.breakpoint.toUpperCase()} • {layout.columns}COL • {layout.platform.toUpperCase()}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={handleOpenSecurity}
            accessibilityRole="button"
            accessibilityLabel="Biometric Security Gate"
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
              <ShieldCheck size={16} color={COLORS.online} />
            ) : (
              <Lock size={16} color={COLORS.offline} />
            )}
            <Text
              style={[
                styles.securityText,
                { color: isUnlocked ? COLORS.online : COLORS.offline },
              ]}
            >
              {authBadgeLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleNetworkToggle}
            accessibilityRole="button"
            accessibilityLabel="Toggle Online or Offline Airplane Mode"
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
              <RefreshCw size={15} color={COLORS.online} />
            ) : isOnline ? (
              <Wifi size={15} color={COLORS.online} />
            ) : (
              <Plane size={15} color={COLORS.offline} />
            )}
            <Text
              style={[
                styles.networkText,
                { color: isOnline ? COLORS.online : COLORS.offline },
              ]}
            >
              {networkLabel}
            </Text>
            {pendingCount > 0 && (
              <View
                style={[
                  styles.queueCountPill,
                  { backgroundColor: isOnline ? COLORS.online : COLORS.offline },
                ]}
              >
                <Text style={styles.queueCountText}>{pendingCount}</Text>
              </View>
            )}
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
    flexShrink: 1,
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
  },
  brandTitle: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  versionBadge: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
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
    letterSpacing: 0.6,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    letterSpacing: 0.6,
  },
  networkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  networkText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  queueCountPill: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  queueCountText: {
    color: COLORS.primaryText,
    fontSize: 10,
    fontWeight: '800',
  },
});
