import {
  calculateAdaptiveMetrics,
  clampFontScale,
  DEVICE_PRESETS,
  MIN_TOUCH_TARGET_DP,
  normalizePlatform,
} from '../src/theme/adaptive';

describe('Multi-Device Adaptive Layout Engine', () => {
  it('classifies compact devices (< 380dp) in portrait with 1 column', () => {
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
    expect(metrics.isTablet).toBe(false);
    expect(metrics.minTouchTarget).toBe(MIN_TOUCH_TARGET_DP);
  });

  it('classifies standard devices (380dp-599dp) in portrait with 1 column and transitions to 2 columns in landscape', () => {
    const portrait = calculateAdaptiveMetrics({
      width: 412,
      height: 915,
      platform: 'android',
      insets: { top: 36, bottom: 24, left: 0, right: 0 },
    });

    expect(portrait.breakpoint).toBe('standard');
    expect(portrait.orientation).toBe('portrait');
    expect(portrait.columns).toBe(1);

    const landscape = calculateAdaptiveMetrics({
      width: 915,
      height: 412,
      platform: 'android',
      insets: { top: 24, bottom: 16, left: 36, right: 36 },
    });

    expect(landscape.orientation).toBe('landscape');
    expect(landscape.columns).toBe(3);
    expect(landscape.safePadding.left).toBeGreaterThan(36);
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

  it('classifies tablet devices (>= 600dp) with 2 columns in portrait and 3 columns in landscape', () => {
    const portrait = calculateAdaptiveMetrics({
      width: 834,
      height: 1194,
      platform: 'ios',
      insets: { top: 24, bottom: 20, left: 0, right: 0 },
    });

    expect(portrait.breakpoint).toBe('tablet');
    expect(portrait.orientation).toBe('portrait');
    expect(portrait.columns).toBe(2);
    expect(portrait.isTablet).toBe(true);

    const landscape = calculateAdaptiveMetrics({
      width: 1194,
      height: 834,
      platform: 'ios',
      insets: { top: 24, bottom: 20, left: 0, right: 0 },
    });

    expect(landscape.breakpoint).toBe('tablet');
    expect(landscape.orientation).toBe('landscape');
    expect(landscape.columns).toBe(3);
  });

  it('incorporates safe area insets for Dynamic Island / notches and Android navigation bars', () => {
    const iosNotch = calculateAdaptiveMetrics({
      width: 393,
      height: 852,
      platform: 'ios',
      insets: { top: 59, bottom: 34, left: 0, right: 0 },
    });

    expect(iosNotch.safePadding.top).toBe(65);
    expect(iosNotch.safePadding.bottom).toBe(34);

    const androidNav = calculateAdaptiveMetrics({
      width: 412,
      height: 915,
      platform: 'android',
      insets: { top: 28, bottom: 24, left: 0, right: 0 },
    });

    expect(androidNav.safePadding.top).toBe(36);
    expect(androidNav.safePadding.bottom).toBe(24);
  });

  it('clamps accessibility font scaling within [0.85, 1.35] and enforces >=48dp touch targets', () => {
    expect(clampFontScale(0.5)).toBe(0.85);
    expect(clampFontScale(2.4)).toBe(1.35);
    expect(clampFontScale(1.15)).toBe(1.15);

    const largeFontMetrics = calculateAdaptiveMetrics({
      width: 375,
      height: 667,
      fontScale: 2.0,
    });

    expect(largeFontMetrics.clampedFontScale).toBe(1.35);
    expect(largeFontMetrics.minTouchTarget).toBeGreaterThanOrEqual(48);
    expect(largeFontMetrics.typography.body).toBe(Math.round(13 * 1.35));
  });

  it('normalizes target platforms and provides 3 realistic Device Lab presets', () => {
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
