import * as Battery from 'expo-battery';
import { Accelerometer } from 'expo-sensors';
import { Platform } from 'react-native';

export type BatteryChargeLabel =
  | 'CHARGING'
  | 'FULL'
  | 'UNPLUGGED'
  | 'NOT_CHARGING'
  | 'UNKNOWN';

export type FieldMotionState = 'STATIC' | 'MOVING_IN_FIELD' | 'UNAVAILABLE';

export interface PhysicalTelemetrySnapshot {
  batteryAvailable: boolean;
  batteryLevelPercent: number | null;
  batteryState: BatteryChargeLabel;
  accelerometerAvailable: boolean;
  accelX: number;
  accelY: number;
  accelZ: number;
  magnitudeG: number;
  motionState: FieldMotionState;
  updatedAt: string;
}

export function mapBatteryState(state: Battery.BatteryState): BatteryChargeLabel {
  switch (state) {
    case Battery.BatteryState.CHARGING:
      return 'CHARGING';
    case Battery.BatteryState.FULL:
      return 'FULL';
    case Battery.BatteryState.UNPLUGGED:
      return 'UNPLUGGED';
    case Battery.BatteryState.NOT_CHARGING:
      return 'NOT_CHARGING';
    default:
      return 'UNKNOWN';
  }
}

export function classifyMotionState(accel: { x: number; y: number; z: number }): {
  magnitudeG: number;
  deltaFromGravity: number;
  state: 'STATIC' | 'MOVING_IN_FIELD';
} {
  const magnitudeG = Number(
    Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z).toFixed(3)
  );
  const deltaFromGravity = Number(Math.abs(magnitudeG - 1.0).toFixed(3));
  return {
    magnitudeG,
    deltaFromGravity,
    state: deltaFromGravity >= 0.14 ? 'MOVING_IN_FIELD' : 'STATIC',
  };
}

/**
 * Fetches current battery percentage and charging state with graceful degradation on Web/emulators.
 */
export async function fetchBatterySnapshot(): Promise<{
  batteryAvailable: boolean;
  batteryLevelPercent: number | null;
  batteryState: BatteryChargeLabel;
}> {
  try {
    const [rawLevel, rawState] = await Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
    ]);

    const hasValidLevel = typeof rawLevel === 'number' && rawLevel >= 0 && rawLevel <= 1;
    const batteryLevelPercent = hasValidLevel ? Math.round(rawLevel * 100) : null;
    const batteryState = mapBatteryState(rawState);

    return {
      batteryAvailable: hasValidLevel,
      batteryLevelPercent,
      batteryState,
    };
  } catch {
    return {
      batteryAvailable: false,
      batteryLevelPercent: null,
      batteryState: 'UNKNOWN',
    };
  }
}

/**
 * Subscribes to live device battery and accelerometer telemetry (500ms interval),
 * safely degrading when physical motion sensors are absent (e.g. desktop Web or simulators).
 */
export function subscribeToPhysicalTelemetry(
  onUpdate: (snapshot: PhysicalTelemetrySnapshot) => void
): () => void {
  let active = true;
  let current: PhysicalTelemetrySnapshot = {
    batteryAvailable: false,
    batteryLevelPercent: null,
    batteryState: 'UNKNOWN',
    accelerometerAvailable: false,
    accelX: 0,
    accelY: 0,
    accelZ: 0,
    magnitudeG: 0,
    motionState: 'UNAVAILABLE',
    updatedAt: new Date().toISOString(),
  };

  const emit = (patch: Partial<PhysicalTelemetrySnapshot>) => {
    if (!active) return;
    current = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    onUpdate(current);
  };

  let accelSub: { remove: () => void } | null = null;
  let batteryLevelSub: { remove: () => void } | null = null;
  let batteryStateSub: { remove: () => void } | null = null;

  void (async () => {
    const batterySnap = await fetchBatterySnapshot();
    emit(batterySnap);

    if (Platform.OS !== 'web') {
      try {
        batteryLevelSub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
          if (typeof batteryLevel === 'number' && batteryLevel >= 0) {
            emit({
              batteryAvailable: true,
              batteryLevelPercent: Math.round(batteryLevel * 100),
            });
          }
        });
        batteryStateSub = Battery.addBatteryStateListener(({ batteryState }) => {
          emit({ batteryState: mapBatteryState(batteryState) });
        });
      } catch {
        // Battery listeners optional on unsupported hosts
      }
    }

    try {
      const accelAvailable = await Accelerometer.isAvailableAsync();
      if (!active || !accelAvailable) {
        emit({ accelerometerAvailable: false, motionState: 'UNAVAILABLE' });
        return;
      }

      Accelerometer.setUpdateInterval(500);
      emit({ accelerometerAvailable: true, motionState: 'STATIC' });

      accelSub = Accelerometer.addListener((measurement) => {
        const x = Number((measurement.x ?? 0).toFixed(3));
        const y = Number((measurement.y ?? 0).toFixed(3));
        const z = Number((measurement.z ?? 0).toFixed(3));
        const classified = classifyMotionState({ x, y, z });
        emit({
          accelerometerAvailable: true,
          accelX: x,
          accelY: y,
          accelZ: z,
          magnitudeG: classified.magnitudeG,
          motionState: classified.state,
        });
      });
    } catch {
      emit({ accelerometerAvailable: false, motionState: 'UNAVAILABLE' });
    }
  })();

  return () => {
    active = false;
    accelSub?.remove();
    batteryLevelSub?.remove();
    batteryStateSub?.remove();
  };
}
