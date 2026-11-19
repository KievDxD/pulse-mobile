import { Redirect, Tabs } from 'expo-router';
import { Database, LayoutGrid, PlusSquare, Smartphone } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { OperationalHeader } from '../../src/components/OperationalHeader';
import { usePulseStore } from '../../src/store/usePulseStore';
import { useAdaptiveLayout } from '../../src/theme/adaptive';
import { COLORS } from '../../src/theme/colors';

export default function TabsLayout() {
  const layout = useAdaptiveLayout();
  const isUnlocked = usePulseStore((s) => s.isUnlocked);
  const operations = usePulseStore((s) => s.operations);

  if (!isUnlocked) {
    return <Redirect href="/lock" />;
  }

  const pendingCount = operations.filter(
    (op) => op.syncStatus === 'QUEUED_LOCAL' || op.syncStatus === 'SYNC_FAILED'
  ).length;

  const bottomInset = Math.max(layout.insets.bottom, layout.isPhoneLandscape ? 4 : 8);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <OperationalHeader />
      <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <Tabs
          detachInactiveScreens={false}
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
            sceneStyle: { flex: 1, backgroundColor: COLORS.background },
            tabBarLabelPosition: layout.isPhoneLandscape ? 'beside-icon' : 'below-icon',
            tabBarStyle: {
              backgroundColor: COLORS.background,
              borderTopColor: COLORS.border,
              borderTopWidth: 1,
              height: layout.tabBarHeight,
              paddingTop: layout.isPhoneLandscape ? 4 : 6,
              paddingBottom: bottomInset,
              paddingHorizontal: 0,
              paddingLeft: layout.insets.left,
              paddingRight: layout.insets.right,
            },
            tabBarItemStyle: {
              minHeight: layout.isPhoneLandscape ? 40 : layout.minTouchTarget,
            },
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.textMuted,
            tabBarLabelStyle: {
              fontSize: layout.isCompact || layout.isPhoneLandscape ? 10 : 11,
              fontWeight: '700',
              letterSpacing: 0.3,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Command',
              tabBarIcon: ({ color, size }) => <LayoutGrid size={size - 2} color={color} />,
            }}
          />
          <Tabs.Screen
            name="capture"
            options={{
              title: 'Capture',
              tabBarIcon: ({ color, size }) => <PlusSquare size={size - 2} color={color} />,
            }}
          />
          <Tabs.Screen
            name="queue"
            options={{
              title: 'Sync Queue',
              tabBarIcon: ({ color, size }) => <Database size={size - 2} color={color} />,
              tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
              tabBarBadgeStyle: {
                backgroundColor: COLORS.offline,
                color: COLORS.primaryText,
                fontSize: 10,
                fontWeight: '800',
              },
            }}
          />
          <Tabs.Screen
            name="device"
            options={{
              title: 'Device Lab',
              tabBarIcon: ({ color, size }) => <Smartphone size={size - 2} color={color} />,
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}
