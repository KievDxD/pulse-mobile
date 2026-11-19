import * as Battery from 'expo-battery';
import {
  classifyMotionState,
  fetchBatterySnapshot,
  mapBatteryState,
} from '../src/services/deviceTelemetry';
import {
  clearOperatorProfile,
  DEFAULT_OPERATOR_PROFILE,
  loadOperatorProfile,
  saveOperatorProfile,
} from '../src/services/operatorProfile';
import { captureEvidencePhoto } from '../src/services/photoEvidence';

describe('Physical Telemetry, Photo EXIF Evidence & Operator Identity (V3.0)', () => {
  beforeEach(async () => {
    await clearOperatorProfile();
  });

  it('classifies STATIC vs MOVING_IN_FIELD accurately from 3-axis accelerometer g-force', () => {
    const staticSample = classifyMotionState({ x: 0.01, y: -0.02, z: 0.99 });
    expect(staticSample.state).toBe('STATIC');
    expect(staticSample.deltaFromGravity).toBeLessThan(0.14);

    const movingSample = classifyMotionState({ x: 0.45, y: 0.3, z: 1.15 });
    expect(movingSample.state).toBe('MOVING_IN_FIELD');
    expect(movingSample.deltaFromGravity).toBeGreaterThanOrEqual(0.14);
  });

  it('maps BatteryState enum values and fetches real battery percentage', async () => {
    expect(mapBatteryState(Battery.BatteryState.CHARGING)).toBe('CHARGING');
    expect(mapBatteryState(Battery.BatteryState.UNPLUGGED)).toBe('UNPLUGGED');
    expect(mapBatteryState(Battery.BatteryState.FULL)).toBe('FULL');

    const snapshot = await fetchBatterySnapshot();
    expect(snapshot.batteryAvailable).toBe(true);
    expect(snapshot.batteryLevelPercent).toBe(84);
    expect(snapshot.batteryState).toBe('CHARGING');
  });

  it('degrades safely when battery sensors throw or return -1 on unsupported hosts', async () => {
    jest.spyOn(Battery, 'getBatteryLevelAsync').mockResolvedValueOnce(-1);
    jest.spyOn(Battery, 'getBatteryStateAsync').mockResolvedValueOnce(Battery.BatteryState.UNKNOWN);

    const degraded = await fetchBatterySnapshot();
    expect(degraded.batteryAvailable).toBe(false);
    expect(degraded.batteryLevelPercent).toBeNull();
    expect(degraded.batteryState).toBe('UNKNOWN');
  });

  it('captures photographic evidence with EXIF summary and active GPS coordinates', async () => {
    const res = await captureEvidencePhoto({
      latitude: 40.7128,
      longitude: -74.006,
      accuracyMeters: 3.2,
      altitudeMeters: 15,
      source: 'GPS_HARDWARE',
    });

    expect(res.ok).toBe(true);
    expect(res.evidence?.uri).toBe('file:///cache/evidence-001.jpg');
    expect(res.evidence?.width).toBe(1920);
    expect(res.evidence?.height).toBe(1080);
    expect(res.evidence?.gpsLatitude).toBe(40.7128);
    expect(res.evidence?.gpsLongitude).toBe(-74.006);
    expect(res.evidence?.exifSummary).toContain('Apple iPhone 15 Pro');
  });

  it('validates and persists Operator Identity Profile in SecureStore', async () => {
    const initial = await loadOperatorProfile();
    expect(initial).toEqual(DEFAULT_OPERATOR_PROFILE);

    const invalid = await saveOperatorProfile({
      operatorId: 'X',
      callsign: 'A',
      unitSector: 'S',
    });
    expect(invalid.ok).toBe(false);

    const saved = await saveOperatorProfile({
      operatorId: ' op-4092 ',
      callsign: ' vanguard-04 ',
      unitSector: ' grid-north-12 ',
    });
    expect(saved.ok).toBe(true);
    expect(saved.profile).toEqual({
      operatorId: 'OP-4092',
      callsign: 'VANGUARD-04',
      unitSector: 'GRID-NORTH-12',
    });

    const reloaded = await loadOperatorProfile();
    expect(reloaded).toEqual({
      operatorId: 'OP-4092',
      callsign: 'VANGUARD-04',
      unitSector: 'GRID-NORTH-12',
    });
  });

  it('embeds GPS fallback gracefully when photo EXIF lacks GPS tags', async () => {
    const res = await captureEvidencePhoto(null);
    expect(res.ok).toBe(true);
    expect(res.evidence?.gpsLatitude).toBeNull();
    expect(res.evidence?.gpsLongitude).toBeNull();
  });
});
