import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import type { AuthMethod } from '../services/biometricAuth';
import { calculatePayloadBytes, generateIntegrityHash } from '../utils/hash';

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'NORMAL';
export type OperationCategory =
  | 'INFRASTRUCTURE'
  | 'POWER_GRID'
  | 'TELEMETRY'
  | 'SECURITY'
  | 'MAINTENANCE';
export type SyncStatus = 'QUEUED_LOCAL' | 'SYNCING' | 'SYNCED_CLOUD' | 'SYNC_FAILED';
export type NetworkMode = 'ONLINE' | 'OFFLINE';

export interface Coordinates {
  latitude: number;
  longitude: number;
  sector: string;
  accuracyMeters?: number;
}

export interface FieldOperation {
  id: string;
  code: string;
  title: string;
  category: OperationCategory;
  priority: PriorityLevel;
  coordinates: Coordinates;
  technicalNote: string;
  checkpointId?: string;
  syncStatus: SyncStatus;
  integrityHash: string;
  createdAt: string;
  syncedAt?: string;
  latencyMs?: number;
  retryCount: number;
  payloadBytes: number;
  lastError?: string;
}

export interface CreateOperationInput {
  title: string;
  category: OperationCategory;
  priority: PriorityLevel;
  coordinates: Coordinates;
  technicalNote: string;
  checkpointId?: string;
}

export interface SyncOptions {
  stepDelayMs?: number;
}

export interface PulseState {
  operations: FieldOperation[];
  networkMode: NetworkMode;
  isSyncing: boolean;
  simulatedFaultMode: boolean;
  isUnlocked: boolean;
  authMethod: AuthMethod | null;
  lastSyncAt: string | null;
  addOperation: (input: CreateOperationInput, options?: { autoSync?: boolean }) => FieldOperation;
  setNetworkMode: (mode: NetworkMode, options?: SyncOptions) => Promise<void>;
  toggleNetworkMode: (options?: SyncOptions) => Promise<void>;
  setSimulatedFaultMode: (enabled: boolean) => void;
  syncQueue: (options?: SyncOptions) => Promise<{ synced: number; failed: number }>;
  retryOperation: (id: string, options?: SyncOptions) => Promise<boolean>;
  simulateNetworkFailure: (targetId?: string) => FieldOperation;
  unlockSession: (method: AuthMethod) => void;
  lockSession: () => void;
  resetDemoData: () => void;
}

function buildOperationRecord(
  seed: Omit<FieldOperation, 'integrityHash' | 'payloadBytes'>
): FieldOperation {
  const canonicalPayload = JSON.stringify({
    id: seed.id,
    code: seed.code,
    title: seed.title,
    category: seed.category,
    priority: seed.priority,
    coordinates: seed.coordinates,
    technicalNote: seed.technicalNote,
    checkpointId: seed.checkpointId ?? null,
    createdAt: seed.createdAt,
  });

  return {
    ...seed,
    integrityHash: generateIntegrityHash(canonicalPayload),
    payloadBytes: calculatePayloadBytes(canonicalPayload),
  };
}

export const INITIAL_OPERATIONS: FieldOperation[] = [
  buildOperationRecord({
    id: 'op-seed-1006',
    code: 'OP-1006',
    title: 'Substation T-14 Thermal Drift Alert',
    category: 'POWER_GRID',
    priority: 'CRITICAL',
    coordinates: {
      latitude: 40.7128,
      longitude: -74.006,
      sector: 'SECTOR-NE-04',
      accuracyMeters: 2.1,
    },
    technicalNote:
      'Primary transformer bushing temperature reached 89.4°C under peak load; coolant pump flow verified at 94%.',
    checkpointId: 'CHK-2026-ALPHA',
    syncStatus: 'QUEUED_LOCAL',
    createdAt: '2026-11-17T20:42:00.000Z',
    retryCount: 0,
  }),
  buildOperationRecord({
    id: 'op-seed-1005',
    code: 'OP-1005',
    title: 'Fiber Trunk Attenuation Check',
    category: 'TELEMETRY',
    priority: 'HIGH',
    coordinates: {
      latitude: 40.7306,
      longitude: -73.9866,
      sector: 'SECTOR-NE-02',
      accuracyMeters: 3.0,
    },
    technicalNote:
      'OTDR trace indicates 1.8dB splice loss at manhole 47B; standby dark fiber route verified clean.',
    checkpointId: 'CHK-2026-BRAVO',
    syncStatus: 'QUEUED_LOCAL',
    createdAt: '2026-11-17T20:15:00.000Z',
    retryCount: 0,
  }),
  buildOperationRecord({
    id: 'op-seed-1004',
    code: 'OP-1004',
    title: 'Perimeter Lidar Sensor Calibration',
    category: 'SECURITY',
    priority: 'NORMAL',
    coordinates: {
      latitude: 40.7484,
      longitude: -73.9857,
      sector: 'SECTOR-CORE-01',
      accuracyMeters: 1.8,
    },
    technicalNote:
      'Recalibrated north gate optical array after wind storm; zero false positives over 15-minute soak.',
    checkpointId: 'CHK-2026-CHARLIE',
    syncStatus: 'SYNCED_CLOUD',
    createdAt: '2026-11-17T19:10:00.000Z',
    syncedAt: '2026-11-17T19:10:04.000Z',
    latencyMs: 68,
    retryCount: 0,
  }),
  buildOperationRecord({
    id: 'op-seed-1003',
    code: 'OP-1003',
    title: 'Backup Diesel Generator Fuel Audit',
    category: 'MAINTENANCE',
    priority: 'NORMAL',
    coordinates: {
      latitude: 40.758,
      longitude: -73.9855,
      sector: 'SECTOR-NORTH-07',
      accuracyMeters: 2.6,
    },
    technicalNote:
      'Reserve tank level at 91% (4,120L); water separator drained and load-bank test passed.',
    checkpointId: 'CHK-2026-DELTA',
    syncStatus: 'SYNCED_CLOUD',
    createdAt: '2026-11-17T18:20:00.000Z',
    syncedAt: '2026-11-17T18:20:03.000Z',
    latencyMs: 84,
    retryCount: 0,
  }),
  buildOperationRecord({
    id: 'op-seed-1002',
    code: 'OP-1002',
    title: 'Microwave Backhaul Dish Alignment',
    category: 'INFRASTRUCTURE',
    priority: 'HIGH',
    coordinates: {
      latitude: 40.7061,
      longitude: -74.0088,
      sector: 'SECTOR-SOUTH-03',
      accuracyMeters: 2.4,
    },
    technicalNote:
      'Azimuth trimmed +0.4° following tower tension check; RSSI improved from -61dBm to -54dBm.',
    checkpointId: 'CHK-2026-ECHO',
    syncStatus: 'SYNCED_CLOUD',
    createdAt: '2026-11-17T17:05:00.000Z',
    syncedAt: '2026-11-17T17:05:02.000Z',
    latencyMs: 92,
    retryCount: 0,
  }),
  buildOperationRecord({
    id: 'op-seed-1001',
    code: 'OP-1001',
    title: 'Switchgear Relay Firmware Integrity',
    category: 'POWER_GRID',
    priority: 'CRITICAL',
    coordinates: {
      latitude: 40.7195,
      longitude: -74.0112,
      sector: 'SECTOR-WEST-05',
      accuracyMeters: 1.9,
    },
    technicalNote:
      'Verified protective relay firmware checksum and trip coil continuity on Bus B.',
    checkpointId: 'CHK-2026-FOXTROT',
    syncStatus: 'SYNCED_CLOUD',
    createdAt: '2026-11-17T15:50:00.000Z',
    syncedAt: '2026-11-17T15:50:05.000Z',
    latencyMs: 114,
    retryCount: 0,
  }),
];

const memoryFallbackMap = new Map<string, string>();

const safeAsyncStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      if (typeof window === 'undefined' && typeof process !== 'undefined' && process.env?.JEST_WORKER_ID) {
        return memoryFallbackMap.get(name) ?? null;
      }
      return await AsyncStorage.getItem(name);
    } catch {
      return memoryFallbackMap.get(name) ?? null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    memoryFallbackMap.set(name, value);
    try {
      if (typeof window === 'undefined' && typeof process !== 'undefined' && process.env?.JEST_WORKER_ID) {
        return;
      }
      await AsyncStorage.setItem(name, value);
    } catch {
      // Fallback already persisted in memory
    }
  },
  removeItem: async (name: string): Promise<void> => {
    memoryFallbackMap.delete(name);
    try {
      if (typeof window === 'undefined' && typeof process !== 'undefined' && process.env?.JEST_WORKER_ID) {
        return;
      }
      await AsyncStorage.removeItem(name);
    } catch {
      // Ignore removal fallback error
    }
  },
};

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextOperationCode(operations: FieldOperation[]): string {
  let maxNum = 1006;
  for (const op of operations) {
    const match = /^OP-(\d+)$/.exec(op.code);
    if (match) {
      const parsed = Number(match[1]);
      if (parsed > maxNum) maxNum = parsed;
    }
  }
  return `OP-${maxNum + 1}`;
}

function computeRealisticLatency(payloadBytes: number, retryCount: number): number {
  const base = 48 + (payloadBytes % 75) + retryCount * 19;
  return Math.min(240, Math.max(42, base));
}

export const usePulseStore = create<PulseState>()(
  persist(
    (set, get) => ({
      operations: INITIAL_OPERATIONS,
      networkMode: 'ONLINE',
      isSyncing: false,
      simulatedFaultMode: false,
      isUnlocked: false,
      authMethod: null,
      lastSyncAt: '2026-11-17T19:10:04.000Z',

      addOperation: (input, options) => {
        const currentOps = get().operations;
        const code = nextOperationCode(currentOps);
        const createdAt = new Date().toISOString();
        const id = `op-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const newOp = buildOperationRecord({
          id,
          code,
          title: input.title.trim(),
          category: input.category,
          priority: input.priority,
          coordinates: input.coordinates,
          technicalNote: input.technicalNote.trim(),
          checkpointId: input.checkpointId?.trim() || undefined,
          syncStatus: 'QUEUED_LOCAL',
          createdAt,
          retryCount: 0,
        });

        set((state) => ({
          operations: [newOp, ...state.operations],
        }));

        const shouldAutoSync = options?.autoSync !== false;
        if (shouldAutoSync && get().networkMode === 'ONLINE' && !get().simulatedFaultMode) {
          void get().syncQueue();
        }

        return newOp;
      },

      setNetworkMode: async (mode, options) => {
        const previousMode = get().networkMode;
        set({ networkMode: mode });

        if (mode === 'ONLINE' && previousMode === 'OFFLINE') {
          await get().syncQueue(options);
        }
      },

      toggleNetworkMode: async (options) => {
        const nextMode: NetworkMode = get().networkMode === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
        await get().setNetworkMode(nextMode, options);
      },

      setSimulatedFaultMode: (enabled) => {
        set({ simulatedFaultMode: enabled });
      },

      syncQueue: async (options) => {
        const stepDelayMs = options?.stepDelayMs ?? 240;

        if (get().networkMode === 'OFFLINE') {
          return { synced: 0, failed: 0 };
        }

        if (get().isSyncing) {
          return { synced: 0, failed: 0 };
        }

        const pendingIds = get()
          .operations.filter(
            (op) => op.syncStatus === 'QUEUED_LOCAL' || op.syncStatus === 'SYNC_FAILED'
          )
          .map((op) => op.id)
          .reverse();

        if (pendingIds.length === 0) {
          return { synced: 0, failed: 0 };
        }

        set({ isSyncing: true });
        let synced = 0;
        let failed = 0;

        try {
          for (const id of pendingIds) {
            if (get().networkMode === 'OFFLINE') {
              break;
            }

            set((state) => ({
              operations: state.operations.map((op) =>
                op.id === id ? { ...op, syncStatus: 'SYNCING', lastError: undefined } : op
              ),
            }));

            await sleep(stepDelayMs);

            if (get().networkMode === 'OFFLINE') {
              set((state) => ({
                operations: state.operations.map((op) =>
                  op.id === id ? { ...op, syncStatus: 'QUEUED_LOCAL' } : op
                ),
              }));
              break;
            }

            const shouldFail = get().simulatedFaultMode;
            if (shouldFail) {
              failed += 1;
              set((state) => ({
                operations: state.operations.map((op) =>
                  op.id === id
                    ? {
                        ...op,
                        syncStatus: 'SYNC_FAILED',
                        retryCount: op.retryCount + 1,
                        lastError: 'Simulated uplink packet loss (ERR_GATEWAY_TIMEOUT)',
                      }
                    : op
                ),
              }));
            } else {
              synced += 1;
              const nowIso = new Date().toISOString();
              set((state) => ({
                lastSyncAt: nowIso,
                operations: state.operations.map((op) =>
                  op.id === id
                    ? {
                        ...op,
                        syncStatus: 'SYNCED_CLOUD',
                        syncedAt: nowIso,
                        latencyMs: computeRealisticLatency(op.payloadBytes, op.retryCount),
                        lastError: undefined,
                      }
                    : op
                ),
              }));
            }
          }
        } finally {
          set({ isSyncing: false });
        }

        return { synced, failed };
      },

      retryOperation: async (id, options) => {
        const stepDelayMs = options?.stepDelayMs ?? 200;
        const target = get().operations.find((op) => op.id === id);
        if (!target) return false;

        if (get().networkMode === 'OFFLINE') {
          set((state) => ({
            operations: state.operations.map((op) =>
              op.id === id
                ? {
                    ...op,
                    syncStatus: 'QUEUED_LOCAL',
                    lastError: 'Device in OFFLINE AIRPLANE MODE. Packet held in local queue.',
                  }
                : op
            ),
          }));
          return false;
        }

        set((state) => ({
          operations: state.operations.map((op) =>
            op.id === id ? { ...op, syncStatus: 'SYNCING', lastError: undefined } : op
          ),
        }));

        await sleep(stepDelayMs);

        if (get().simulatedFaultMode) {
          set((state) => ({
            operations: state.operations.map((op) =>
              op.id === id
                ? {
                    ...op,
                    syncStatus: 'SYNC_FAILED',
                    retryCount: op.retryCount + 1,
                    lastError: 'Fault injection active: disable Fault Mode or toggle uplink.',
                  }
                : op
            ),
          }));
          return false;
        }

        const nowIso = new Date().toISOString();
        set((state) => ({
          lastSyncAt: nowIso,
          operations: state.operations.map((op) =>
            op.id === id
              ? {
                  ...op,
                  syncStatus: 'SYNCED_CLOUD',
                  syncedAt: nowIso,
                  latencyMs: computeRealisticLatency(op.payloadBytes, op.retryCount + 1),
                  lastError: undefined,
                }
              : op
          ),
        }));
        return true;
      },

      simulateNetworkFailure: (targetId) => {
        const current = get().operations;
        const candidate =
          (targetId ? current.find((op) => op.id === targetId) : undefined) ??
          current.find((op) => op.syncStatus === 'QUEUED_LOCAL');

        if (candidate) {
          const updated: FieldOperation = {
            ...candidate,
            syncStatus: 'SYNC_FAILED',
            retryCount: candidate.retryCount + 1,
            lastError: 'Simulated uplink interruption (ERR_SYNC_TIMEOUT_504)',
          };
          set((state) => ({
            operations: state.operations.map((op) => (op.id === candidate.id ? updated : op)),
          }));
          return updated;
        }

        const code = nextOperationCode(current);
        const faultPacket = buildOperationRecord({
          id: `op-fault-${Date.now()}`,
          code,
          title: 'Telemetry Heartbeat Fault Probe',
          category: 'TELEMETRY',
          priority: 'HIGH',
          coordinates: {
            latitude: 40.7143,
            longitude: -74.006,
            sector: 'SECTOR-TEST-99',
            accuracyMeters: 2.5,
          },
          technicalNote:
            'Simulated packet drop injected from Sync Queue audit console to verify retry resilience.',
          checkpointId: 'CHK-2026-DIAG',
          syncStatus: 'SYNC_FAILED',
          createdAt: new Date().toISOString(),
          retryCount: 1,
          lastError: 'Simulated uplink interruption (ERR_SYNC_TIMEOUT_504)',
        });

        set((state) => ({
          operations: [faultPacket, ...state.operations],
        }));
        return faultPacket;
      },

      unlockSession: (method) => {
        set({ isUnlocked: true, authMethod: method });
      },

      lockSession: () => {
        set({ isUnlocked: false, authMethod: null });
      },

      resetDemoData: () => {
        set({
          operations: INITIAL_OPERATIONS,
          networkMode: 'ONLINE',
          isSyncing: false,
          simulatedFaultMode: false,
          lastSyncAt: '2026-11-17T19:10:04.000Z',
        });
      },
    }),
    {
      name: 'pulse-mobile-store-v1',
      storage: createJSONStorage(() => safeAsyncStorage),
      partialize: (state) => ({
        operations: state.operations,
        networkMode: state.networkMode,
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
);
