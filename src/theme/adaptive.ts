import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  availableWidth: number;
  aspectRatio: number;
  breakpoint: DeviceBreakpoint;
  orientation: DeviceOrientation;
  platform: TargetPlatform;
  columns: GridColumns;
  canSplitTwoColumns: boolean;
  minTouchTarget: number;
  clampedFontScale: number;
  clampFont: (size: number) => number;
  insets: SafeInsets;
  safePadding: SafeInsets;
  contentPaddingLeft: number;
  contentPaddingRight: number;
  scrollBottomPadding: number;
  tabBarHeight: number;
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
  isPhoneLandscape: boolean;
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
    hardwareNote: 'Biometric Strong • Android Gesture Bar & Cutout',
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
export const MAX_CONTENT_WIDTH_DP = 960;

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
 * Scales and clamps typography sizes to honor accessibility preferences without overflowing cards.
 */
export function clampFont(size: number, fontScale: number = 1): number {
  const clampedScale = clampFontScale(fontScale);
  return Math.round(size * clampedScale);
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
  const rawInsets: SafeInsets = input.insets ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const insets: SafeInsets = {
    top: Math.max(0, rawInsets.top),
    bottom: Math.max(0, rawInsets.bottom),
    left: Math.max(0, rawInsets.left),
    right: Math.max(0, rawInsets.right),
  };

  let breakpoint: DeviceBreakpoint = 'standard';
  if (width < 380) {
    breakpoint = 'compact';
  } else if (width >= 600) {
    breakpoint = 'tablet';
  }

  const orientation: DeviceOrientation = width > height ? 'landscape' : 'portrait';
  const isPhoneLandscape = orientation === 'landscape' && height < 500;

  const horizontalBase =
    breakpoint === 'compact' ? 12 : breakpoint === 'tablet' && !isPhoneLandscape ? 24 : 16;
  const safePadding: SafeInsets = {
    top: isPhoneLandscape
      ? Math.max(insets.top, 4) + 4
      : insets.top + (platform === 'ios' ? 6 : 8),
    bottom: Math.max(insets.bottom, isPhoneLandscape ? 6 : 12),
    left: Math.max(insets.left + (insets.left > 0 ? 8 : 0), horizontalBase),
    right: Math.max(insets.right + (insets.right > 0 ? 8 : 0), horizontalBase),
  };

  const maxContentWidth = MAX_CONTENT_WIDTH_DP;
  const innerUnclamped = Math.max(240, width - safePadding.left - safePadding.right);
  const availableWidth = Math.max(240, Math.floor(Math.min(innerUnclamped, maxContentWidth)));
  const extraCentering = Math.max(0, Math.floor((innerUnclamped - maxContentWidth) / 2));
  const contentPaddingLeft = safePadding.left + extraCentering;
  const contentPaddingRight = safePadding.right + extraCentering;

  let columns: GridColumns = 1;
  if (!isPhoneLandscape && (width >= 900 || (breakpoint === 'tablet' && orientation === 'landscape'))) {
    columns = 3;
  } else if (availableWidth >= 520 || breakpoint === 'tablet') {
    columns = 2;
  }

  // Only split multi-card forms/inspectors side-by-side on true tablets / desktops (never on short rotated phones).
  const canSplitTwoColumns = !isPhoneLandscape && availableWidth >= 720;

  const baseUnit =
    breakpoint === 'compact' || isPhoneLandscape ? 4 : breakpoint === 'tablet' ? 6 : 5;
  const spacing = {
    xs: baseUnit,
    sm: baseUnit * 2,
    md: baseUnit * 3,
    lg: baseUnit * 4,
    xl: baseUnit * 6,
  };

  const scrollBottomPadding = Math.max(insets.bottom, 12) + (isPhoneLandscape ? 72 : 96);
  const tabBarHeight = isPhoneLandscape
    ? 44 + Math.max(insets.bottom, 4)
    : 58 + Math.max(insets.bottom, 8);
  const gutter =
    breakpoint === 'compact' || isPhoneLandscape ? 10 : breakpoint === 'tablet' ? 16 : 12;
  const cardPadding =
    breakpoint === 'compact' || isPhoneLandscape ? 12 : breakpoint === 'tablet' ? 18 : 14;

  const scale = (size: number) => clampFont(size, clampedFontScale);

  const typography = {
    hero: scale(
      breakpoint === 'compact' ? 22 : breakpoint === 'tablet' && !isPhoneLandscape ? 28 : 24
    ),
    title: scale(
      breakpoint === 'compact' ? 17 : breakpoint === 'tablet' && !isPhoneLandscape ? 21 : 19
    ),
    subtitle: scale(breakpoint === 'compact' ? 14 : 16),
    body: scale(breakpoint === 'compact' ? 13 : 14),
    caption: scale(breakpoint === 'compact' ? 11 : 12),
    micro: scale(10),
  };

  return {
    width,
    height,
    availableWidth,
    aspectRatio: Number((width / height).toFixed(2)),
    breakpoint,
    orientation,
    platform,
    columns,
    canSplitTwoColumns,
    minTouchTarget: MIN_TOUCH_TARGET_DP,
    clampedFontScale,
    clampFont: scale,
    insets,
    safePadding,
    contentPaddingLeft,
    contentPaddingRight,
    scrollBottomPadding,
    tabBarHeight,
    spacing,
    gutter,
    cardPadding,
    maxContentWidth,
    typography,
    isCompact: breakpoint === 'compact',
    isTablet: breakpoint === 'tablet' && !isPhoneLandscape,
    isLandscape: orientation === 'landscape',
    isPhoneLandscape,
  };
}

/**
 * Reactive React Native hook tracking real-time native SafeArea frame dimensions
 * (atomically synchronized with insets on orientation changes), OS platform, and font scale.
 */
export function useAdaptiveLayout(): AdaptiveMetrics {
  const windowDims = useWindowDimensions();
  const frame = useSafeAreaFrame();
  const insets = useSafeAreaInsets();
  const platform = normalizePlatform(Platform.OS);

  const width = platform !== 'web' && frame.width > 0 ? frame.width : windowDims.width;
  const height = platform !== 'web' && frame.height > 0 ? frame.height : windowDims.height;

  return calculateAdaptiveMetrics({
    width,
    height,
    fontScale: windowDims.fontScale,
    platform,
    insets,
  });
}
