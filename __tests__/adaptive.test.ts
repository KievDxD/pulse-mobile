import {
  calculateAdaptiveMetrics,
  clampFont,
  clampFontScale,
  DEVICE_PRESETS,
  MAX_CONTENT_WIDTH_DP,
  MIN_TOUCH_TARGET_DP,
  normalizePlatform,
} from '../src/theme/adaptive';

describe('Multi-Device Adaptive Layout & Safe Area Engine (V2.0)', () => {
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
    expect(metrics.minTouchTarget).toBe(MIN_TOUCH_TARGET_DP);
    expect(metrics.maxContentWidth).toBe(MAX_CONTENT_WIDTH_DP);
  });

  it('classifies standard devices (380dp-599dp) and adapts columns + left/right cutout insets in landscape', () => {
    const portrait = calculateAdaptiveMetrics({
      width: 412,
      height: 915,
      platform: 'android',
      insets: { top: 36, bottom: 24, left: 0, right: 0 },
    });

    expect(portrait.breakpoint).toBe('standard');
    expect(portrait.orientation).toBe('portrait');
    expect(portrait.columns).toBe(1);
    expect(portrait.scrollBottomPadding).toBe(24 + 96);

    const landscape = calculateAdaptiveMetrics({
      width: 915,
      height: 412,
      platform: 'android',
      insets: { top: 24, bottom: 16, left: 36, right: 36 },
    });

    expect(landscape.orientation).toBe('landscape');
    expect(landscape.columns).toBe(3);
    expect(landscape.safePadding.left).toBe(44);
    expect(landscape.safePadding.right).toBe(44);
    expect(landscape.scrollBottomPadding).toBe(16 + 96);
  });

  it('classifies standard-width landscape (560x360) with 2 columns', () => {
    const metrics = calculateAdaptiveMetrics({
      width: 560,
      height: 360,
      platform: 'ios',
    });

    expect(metrics.breakpoint).toBe('standard');
    expect(metrics.orientation).toBe('landscape');
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
    expect(portrait.columns).toBe(2);
    expect(portrait.maxContentWidth).toBe(960);

    const landscape = calculateAdaptiveMetrics({
      width: 1194,
      height: 834,
      platform: 'ios',
      insets: { top: 24, bottom: 20, left: 0, right: 0 },
    });

    expect(landscape.breakpoint).toBe('tablet');
    expect(landscape.orientation).toBe('landscape');
    expect(landscape.columns).toBe(3);
    expect(landscape.maxContentWidth).toBe(960);
  });

  it('computes dynamic tabBarHeight and scrollBottomPadding from insets.bottom', () => {
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
