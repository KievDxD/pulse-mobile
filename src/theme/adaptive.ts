import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type DeviceBreakpoint = 'compact' | 'standard' | 'tablet';
export type DeviceOrientation = 'portrait' | 'landscape';
export type TargetPlatform = 'ios' | 'android' | 'web';
export type GridColumns = 1 | 2 | 3;

export interface SafeInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface AdaptiveInput {
  width: number;
  height: number;
  fontScale?: number;
  platform?: TargetPlatform;
  insets?: SafeInsets;
}

export interface AdaptiveMetrics {
  width: number;
  height: number;
  aspectRatio: number;
  breakpoint: DeviceBreakpoint;
  orientation: DeviceOrientation;
  platform: TargetPlatform;
  columns: GridColumns;
  minTouchTarget: number;
  clampedFontScale: number;
  insets: SafeInsets;
  safePadding: SafeInsets;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  gutter: number;
  cardPadding: number;
  maxContentWidth: number;
  typography: {
    hero: number;
    title: number;
    subtitle: number;
    body: number;
    caption: number;
    micro: number;
  };
  isCompact: boolean;
  isTablet: boolean;
  isLandscape: boolean;
}

export interface DevicePreset {
  id: 'iphone-se' | 'pixel-standard' | 'ipad-tablet';
  label: string;
  subtitle: string;
  platform: TargetPlatform;
  width: number;
  height: number;
  insetsPortrait: SafeInsets;
  insetsLandscape: SafeInsets;
  hardwareNote: string;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  {
    id: 'iphone-se',
    label: 'iPhone SE',
    subtitle: '320 × 568 dp • Compact',
    platform: 'ios',
    width: 320,
    height: 568,
    insetsPortrait: { top: 20, bottom: 0, left: 0, right: 0 },
    insetsLandscape: { top: 0, bottom: 0, left: 0, right: 0 },
    hardwareNote: 'Touch ID • 4.7" Compact Viewport',
  },
  {
    id: 'pixel-standard',
    label: 'Pixel / Moto Standard',
    subtitle: '412 × 915 dp • Standard',
    platform: 'android',
    width: 412,
    height: 915,
    insetsPortrait: { top: 36, bottom: 24, left: 0, right: 0 },
    insetsLandscape: { top: 24, bottom: 16, left: 36, right: 36 },
    hardwareNote: 'Biometric Strong • Android Gesture Bar',
  },
  {
    id: 'ipad-tablet',
    label: 'iPad / Tablet',
    subtitle: '834 × 1194 dp • Tablet',
    platform: 'ios',
    width: 834,
    height: 1194,
    insetsPortrait: { top: 24, bottom: 20, left: 0, right: 0 },
    insetsLandscape: { top: 24, bottom: 20, left: 0, right: 0 },
    hardwareNote: 'Face ID • Multi-Column Command Center',
  },
];

export const MIN_TOUCH_TARGET_DP = 48;

export function normalizePlatform(os: string = Platform.OS): TargetPlatform {
  if (os === 'ios') return 'ios';
  if (os === 'android') return 'android';
  return 'web';
}

export function clampFontScale(scale: number = 1): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(1.35, Math.max(0.85, Number(scale.toFixed(2))));
}

/**
 * Pure layout calculation engine that derives breakpoints, multi-column grids,
 * safe-area paddings, touch targets, and accessible typography metrics.
 */
export function calculateAdaptiveMetrics(input: AdaptiveInput): AdaptiveMetrics {
  const width = Math.max(240, Math.round(input.width));
  const height = Math.max(240, Math.round(input.height));
  const platform = input.platform ?? normalizePlatform();
  const clampedFontScale = clampFontScale(input.fontScale ?? 1);
  const insets: SafeInsets = input.insets ?? { top: 0, bottom: 0, left: 0, right: 0 };

  let breakpoint: DeviceBreakpoint = 'standard';
  if (width < 380) {
    breakpoint = 'compact';
  } else if (width >= 600) {
    breakpoint = 'tablet';
  }

  const orientation: DeviceOrientation = width > height ? 'landscape' : 'portrait';

  let columns: GridColumns = 1;
  if (width >= 900 || (breakpoint === 'tablet' && orientation === 'landscape')) {
    columns = 3;
  } else if (breakpoint === 'tablet' || (breakpoint === 'standard' && orientation === 'landscape')) {
    columns = 2;
  }

  const baseUnit = breakpoint === 'compact' ? 4 : breakpoint === 'tablet' ? 6 : 5;
  const spacing = {
    xs: baseUnit,
    sm: baseUnit * 2,
    md: baseUnit * 3,
    lg: baseUnit * 4,
    xl: baseUnit * 6,
  };

  const horizontalBase = breakpoint === 'compact' ? 12 : breakpoint === 'tablet' ? 24 : 16;
  const safePadding: SafeInsets = {
    top: insets.top + (platform === 'ios' ? 6 : 8),
    bottom: Math.max(insets.bottom, 12),
    left: insets.left + horizontalBase,
    right: insets.right + horizontalBase,
  };

  const gutter = breakpoint === 'compact' ? 10 : breakpoint === 'tablet' ? 16 : 12;
  const cardPadding = breakpoint === 'compact' ? 12 : breakpoint === 'tablet' ? 18 : 14;
  const maxContentWidth = breakpoint === 'tablet' ? 1160 : 720;

  const scale = (size: number) => Math.round(size * clampedFontScale);

  const typography = {
    hero: scale(breakpoint === 'compact' ? 22 : breakpoint === 'tablet' ? 28 : 25),
    title: scale(breakpoint === 'compact' ? 17 : breakpoint === 'tablet' ? 21 : 19),
    subtitle: scale(breakpoint === 'compact' ? 14 : 16),
    body: scale(breakpoint === 'compact' ? 13 : 14),
    caption: scale(breakpoint === 'compact' ? 11 : 12),
    micro: scale(10),
  };

  return {
    width,
    height,
    aspectRatio: Number((width / height).toFixed(2)),
    breakpoint,
    orientation,
    platform,
    columns,
    minTouchTarget: MIN_TOUCH_TARGET_DP,
    clampedFontScale,
    insets,
    safePadding,
    spacing,
    gutter,
    cardPadding,
    maxContentWidth,
    typography,
    isCompact: breakpoint === 'compact',
    isTablet: breakpoint === 'tablet',
    isLandscape: orientation === 'landscape',
  };
}

/**
 * Reactive React Native hook tracking real-time viewport dimensions, OS platform,
 * font accessibility scale, and safe-area insets for notches / Dynamic Island / nav bars.
 */
export function useAdaptiveLayout(): AdaptiveMetrics {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const platform = normalizePlatform(Platform.OS);

  return calculateAdaptiveMetrics({
    width,
    height,
    fontScale,
    platform,
    insets,
  });
}
