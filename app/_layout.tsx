import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { COLORS } from '../src/theme/colors';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = COLORS.background;
    document.documentElement.style.height = '100%';
    document.body.style.backgroundColor = COLORS.background;
    document.body.style.height = '100%';
    document.body.style.margin = '0';

    const rootEl = document.getElementById('root');
    if (rootEl) {
      rootEl.style.height = '100dvh';
      rootEl.style.minHeight = '100%';
      rootEl.style.width = '100%';
      rootEl.style.backgroundColor = COLORS.background;
    }

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute(
        'content',
        'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
      );
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar style="light" />
      <Slot />
    </View>
  );
}
