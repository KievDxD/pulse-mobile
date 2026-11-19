import {
  calculateAdaptiveMetrics,
  clampFont,
  clampFontScale,
  DEVICE_PRESETS,
  MAX_CONTENT_WIDTH_DP,
  MIN_TOUCH_TARGET_DP,
  normalizePlatform,
} from '../src/theme/adaptive';

describe('Multi-Device Adaptive Layout, Phone Landscape & Safe Area Engine (V3.0)', () => {
  it('classifies compact devices (< 380dp) in portrait with 1 column and safe padding', () => {
    const metrics = calculateAdaptiveMetrics({
      width: 320,
      height: 568,
      platform: 'ios',
      insets: { top: 20, bottom: 0, left: 0, right: 0 },
    });

    expect(metrics.breakpoint).toBe('compact');
    expect(metrics.orientation).toBe('portrait');
    expect(metrics.columns).toBe(1);
    expect(metrics.isCompact).toBe(true);
    expect(metrics.isPhoneLandscape).toBe(false);
    expect(metrics.canSplitTwoColumns).toBe(false);
    expect(metrics.minTouchTarget).toBe(MIN_TOUCH_TARGET_DP);
    expect(metrics.maxContentWidth).toBe(MAX_CONTENT_WIDTH_DP);
  });

  it('classifies standard devices (380dp-599dp) and caps rotated phones at 2 columns with compact chrome', () => {
    const portrait = calculateAdaptiveMetrics({
      width: 412,
      height: 915,
      platform: 'android',
      insets: { top: 36, bottom: 24, left: 0, right: 0 },
    });

    expect(portrait.breakpoint).toBe('standard');
    expect(portrait.orientation).toBe('portrait');
    expect(portrait.columns).toBe(1);
    expect(portrait.isPhoneLandscape).toBe(false);
    expect(portrait.scrollBottomPadding).toBe(24 + 96);

    const phoneLandscape = calculateAdaptiveMetrics({
      width: 915,
      height: 412,
      platform: 'android',
      insets: { top: 24, bottom: 16, left: 36, right: 36 },
    });

    expect(phoneLandscape.orientation).toBe('landscape');
    expect(phoneLandscape.isPhoneLandscape).toBe(true);
    expect(phoneLandscape.columns).toBe(2);
    // Short rotated phones keep forms/Device Lab single-column to prevent clipped/uneven voids
    expect(phoneLandscape.canSplitTwoColumns).toBe(false);
    expect(phoneLandscape.safePadding.left).toBe(44);
    expect(phoneLandscape.safePadding.right).toBe(44);
    expect(phoneLandscape.contentPaddingLeft).toBe(44);
    expect(phoneLandscape.contentPaddingRight).toBe(44);
    expect(phoneLandscape.availableWidth).toBe(915 - 44 - 44);
    expect(phoneLandscape.tabBarHeight).toBe(44 + 16);
    expect(phoneLandscape.scrollBottomPadding).toBe(16 + 72);
  });

  it('keeps narrow rotated phones (667x375) single-column for split forms (canSplitTwoColumns=false)', () => {
    const metrics = calculateAdaptiveMetrics({
      width: 667,
      height: 375,
      platform: 'ios',
    });

    expect(metrics.isPhoneLandscape).toBe(true);
    expect(metrics.columns).toBe(2);
    expect(metrics.canSplitTwoColumns).toBe(false);
    expect(metrics.availableWidth).toBe(667 - 32);
  });

  it('classifies standard-width landscape (560x360) with 2 columns', () => {
    const metrics = calculateAdaptiveMetrics({
      width: 560,
      height: 360,
      platform: 'ios',
    });

    expect(metrics.breakpoint).toBe('standard');
    expect(metrics.orientation).toBe('landscape');
    expect(metrics.isPhoneLandscape).toBe(true);
    expect(metrics.columns).toBe(2);
  });

  it('centers tablet devices (>= 600dp) within maxContentWidth=960 with 2-3 columns', () => {
    const portrait = calculateAdaptiveMetrics({
      width: 834,
      height: 1194,
      platform: 'ios',
      insets: { top: 24, bottom: 20, left: 0, right: 0 },
    });

    expect(portrait.breakpoint).toBe('tablet');
    expect(portrait.isTablet).toBe(true);
    expect(portrait.isPhoneLandscape).toBe(false);
    expect(portrait.columns).toBe(2);
    expect(portrait.canSplitTwoColumns).toBe(true);
    expect(portrait.maxContentWidth).toBe(960);

    const landscape = calculateAdaptiveMetrics({
      width: 1194,
      height: 834,
      platform: 'ios',
      insets: { top: 24, bottom: 20, left: 0, right: 0 },
    });

    expect(landscape.breakpoint).toBe('tablet');
    expect(landscape.orientation).toBe('landscape');
    expect(landscape.isPhoneLandscape).toBe(false);
    expect(landscape.columns).toBe(3);
    expect(landscape.canSplitTwoColumns).toBe(true);
    expect(landscape.availableWidth).toBe(960);
    // 1194 - 24 - 24 = 1146; extraCentering = floor((1146 - 960) / 2) = 93
    expect(landscape.contentPaddingLeft).toBe(24 + 93);
    expect(landscape.contentPaddingRight).toBe(24 + 93);
  });

  it('handles asymmetric Android cutout + navigation bar insets in landscape without overflow', () => {
    const asymmetric = calculateAdaptiveMetrics({
      width: 892,
      height: 412,
      platform: 'android',
      insets: { top: 24, bottom: 0, left: 36, right: 48 },
    });

    expect(asymmetric.isPhoneLandscape).toBe(true);
    expect(asymmetric.canSplitTwoColumns).toBe(false);
    expect(asymmetric.contentPaddingLeft).toBe(44);
    expect(asymmetric.contentPaddingRight).toBe(56);
    expect(asymmetric.availableWidth).toBe(892 - 44 - 56);
    expect(asymmetric.contentPaddingLeft + asymmetric.availableWidth + asymmetric.contentPaddingRight).toBe(892);
  });

  it('computes dynamic tabBarHeight and scrollBottomPadding from insets.bottom in portrait', () => {
    const iosNotch = calculateAdaptiveMetrics({
      width: 393,
      height: 852,
      platform: 'ios',
      insets: { top: 59, bottom: 34, left: 0, right: 0 },
    });

    expect(iosNotch.safePadding.top).toBe(65);
    expect(iosNotch.tabBarHeight).toBe(58 + 34);
    expect(iosNotch.scrollBottomPadding).toBe(34 + 96);
  });

  it('provides clampFont utility bounded to [0.85, 1.35] and enforces >=48dp touch targets', () => {
    expect(clampFontScale(0.4)).toBe(0.85);
    expect(clampFontScale(2.5)).toBe(1.35);
    expect(clampFont(16, 2.0)).toBe(Math.round(16 * 1.35));
    expect(clampFont(16, 0.5)).toBe(Math.round(16 * 0.85));

    const metrics = calculateAdaptiveMetrics({
      width: 375,
      height: 667,
      fontScale: 2.0,
    });

    expect(metrics.clampFont(14)).toBe(Math.round(14 * 1.35));
    expect(metrics.minTouchTarget).toBeGreaterThanOrEqual(48);
  });

  it('normalizes platforms and provides 3 realistic Device Lab presets', () => {
    expect(normalizePlatform('ios')).toBe('ios');
    expect(normalizePlatform('android')).toBe('android');
    expect(normalizePlatform('web')).toBe('web');
    expect(normalizePlatform('windows')).toBe('web');
    expect(DEVICE_PRESETS.map((p) => p.id)).toEqual([
      'iphone-se',
      'pixel-standard',
      'ipad-tablet',
    ]);
  });
});
