import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import type { AuthMethod } from '../services/biometricAuth';
import { getNextChainLink } from '../services/ledgerIntegrity';
import { fetchRealNetworkStatus, RealNetworkStatus } from '../services/networkMonitor';
import {
  DEFAULT_OPERATOR_PROFILE,
  loadOperatorProfile,
  saveOperatorProfile,
} from '../services/operatorProfile';
import { syncOperationRecord } from '../services/syncClient';
import {
  buildCanonicalOperationPayload,
  Coordinates,
  CreateOperationInput,
  FieldOperation,
  NetworkMode,
  OperationCategory,
  OperatorProfile,
  PhotoEvidence,
  PriorityLevel,
  SyncAttemptLog,
  SyncStatus,
  SyncTransportMode,
} from '../types/operations';
import { calculatePayloadBytes, generateIntegrityHashAsync } from '../utils/hash';

export type {
  Coordinates,
  CreateOperationInput,
  FieldOperation,
  NetworkMode,
  OperationCategory,
  OperatorProfile,
  PhotoEvidence,
  PriorityLevel,
  SyncAttemptLog,
  SyncStatus,
  SyncTransportMode,
};

export interface SyncOptions {
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
}

export interface PulseState {
  operations: FieldOperation[];
  operatorProfile: OperatorProfile;
  networkMode: NetworkMode;
  networkInfo: RealNetworkStatus;
  syncEndpointUrl: string;
  isSyncing: boolean;
  isUnlocked: boolean;
  authMethod: AuthMethod | null;
  lastSyncAt: string | null;
  hydrateOperatorProfile: () => Promise<OperatorProfile>;
  setOperatorProfile: (
    profile: OperatorProfile
  ) => Promise<{ ok: boolean; profile: OperatorProfile; error?: string }>;
  createOperation: (
    input: CreateOperationInput,
    options?: { autoSync?: boolean }
  ) => Promise<FieldOperation>;
  applyRealNetworkStatus: (status: RealNetworkStatus, options?: SyncOptions) => Promise<void>;
  refreshNetworkStatus: (options?: SyncOptions) => Promise<RealNetworkStatus>;
  setNetworkMode: (mode: NetworkMode, options?: SyncOptions) => Promise<void>;
  setSyncEndpointUrl: (url: string) => void;
  syncQueue: (options?: SyncOptions) => Promise<{ synced: number; failed: number }>;
  retryOperation: (id: string, options?: SyncOptions) => Promise<boolean>;
  unlockSession: (method: AuthMethod) => void;
  lockSession: () => void;
  clearAllOperations: () => void;
}

const DEFAULT_NETWORK_INFO: RealNetworkStatus = {
  isConnected: true,
  isInternetReachable: true,
  type: 'UNKNOWN',
  ipAddress: null,
  isOffline: false,
  checkedAt: new Date(0).toISOString(),
};

const memoryFallbackMap = new Map<string, string>();

const safeAsyncStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      if (
        typeof window === 'undefined' &&
        typeof process !== 'undefined' &&
        process.env?.JEST_WORKER_ID
      ) {
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
      if (
        typeof window === 'undefined' &&
        typeof process !== 'undefined' &&
        process.env?.JEST_WORKER_ID
      ) {
        return;
      }
      await AsyncStorage.setItem(name, value);
    } catch {
      // Fallback persisted in memory
    }
  },
  removeItem: async (name: string): Promise<void> => {
    memoryFallbackMap.delete(name);
    try {
      if (
        typeof window === 'undefined' &&
        typeof process !== 'undefined' &&
        process.env?.JEST_WORKER_ID
      ) {
        return;
      }
      await AsyncStorage.removeItem(name);
    } catch {
      // Ignore removal error
    }
  },
};

function nextOperationCode(operations: FieldOperation[]): string {
  let maxNum = 1000;
  for (const op of operations) {
    const match = /^OP-(\d+)$/.exec(op.code);
    if (match) {
      const parsed = Number(match[1]);
      if (parsed > maxNum) maxNum = parsed;
    }
  }
  return `OP-${maxNum + 1}`;
}

export const usePulseStore = create<PulseState>()(
  persist(
    (set, get) => ({
      operations: [],
      operatorProfile: DEFAULT_OPERATOR_PROFILE,
      networkMode: 'ONLINE',
      networkInfo: DEFAULT_NETWORK_INFO,
      syncEndpointUrl: '',
      isSyncing: false,
      isUnlocked: false,
      authMethod: null,
      lastSyncAt: null,

      hydrateOperatorProfile: async () => {
        const stored = await loadOperatorProfile();
        set({ operatorProfile: stored });
        return stored;
      },

      setOperatorProfile: async (profile) => {
        const result = await saveOperatorProfile(profile);
        if (result.ok) {
          set({ operatorProfile: result.profile });
        }
        return result;
      },

      createOperation: async (input, options) => {
        const currentOps = get().operations;
        const code = nextOperationCode(currentOps);
        const createdAt = new Date().toISOString();
        const id = `op-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const { prevHash, chainIndex } = getNextChainLink(currentOps);
        const operatorProfile = get().operatorProfile;

        const seed = {
          id,
          code,
          chainIndex,
          prevHash,
          title: input.title.trim(),
          category: input.category,
          priority: input.priority,
          coordinates: input.coordinates,
          technicalNote: input.technicalNote.trim(),
          checkpointId: input.checkpointId?.trim() || undefined,
          photoEvidence: input.photoEvidence,
          operatorProfile,
          createdAt,
        };

        const canonicalPayload = buildCanonicalOperationPayload(seed);
        const integrityHash = await generateIntegrityHashAsync(canonicalPayload);
        const payloadBytes = calculatePayloadBytes(canonicalPayload);

        const initialLog: SyncAttemptLog = {
          timestamp: createdAt,
          outcome: 'QUEUED',
          message: `Chain #${chainIndex} sealed (${operatorProfile.callsign}) and queued locally.`,
        };

        const newOp: FieldOperation = {
          ...seed,
          syncStatus: 'QUEUED_LOCAL',
          integrityHash,
          payloadBytes,
          retryCount: 0,
          syncLog: [initialLog],
        };

        set((state) => ({
          operations: [newOp, ...state.operations],
        }));

        const shouldAutoSync = options?.autoSync !== false;
        if (shouldAutoSync && get().networkMode === 'ONLINE') {
          await get().syncQueue();
        }

        return get().operations.find((op) => op.id === id) ?? newOp;
      },

      applyRealNetworkStatus: async (status, options) => {
        const previousMode = get().networkMode;
        const nextMode: NetworkMode = status.isOffline ? 'OFFLINE' : 'ONLINE';

        set({
          networkInfo: status,
          networkMode: nextMode,
        });

        if (nextMode === 'ONLINE' && previousMode === 'OFFLINE') {
          await get().syncQueue(options);
        }
      },

      refreshNetworkStatus: async (options) => {
        const status = await fetchRealNetworkStatus();
        await get().applyRealNetworkStatus(status, options);
        return status;
      },

      setNetworkMode: async (mode, options) => {
        const previousMode = get().networkMode;
        set({ networkMode: mode });

        if (mode === 'ONLINE' && previousMode === 'OFFLINE') {
          await get().syncQueue(options);
        }
      },

      setSyncEndpointUrl: (url) => {
        set({ syncEndpointUrl: url.trim() });
      },

      syncQueue: async (options) => {
        if (get().networkMode === 'OFFLINE' || get().isSyncing) {
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

            const currentTarget = get().operations.find((op) => op.id === id);
            if (!currentTarget) continue;

            const syncingEntry: SyncAttemptLog = {
              timestamp: new Date().toISOString(),
              outcome: 'SYNCING',
              message: 'Dispatching SHA-256 verified payload...',
            };

            set((state) => ({
              operations: state.operations.map((op) =>
                op.id === id
                  ? {
                      ...op,
                      syncStatus: 'SYNCING',
                      lastError: undefined,
                      syncLog: [...(op.syncLog ?? []), syncingEntry],
                    }
                  : op
              ),
            }));

            const result = await syncOperationRecord(currentTarget, {
              endpointUrl: get().syncEndpointUrl,
              timeoutMs: options?.timeoutMs,
              maxRetries: options?.maxRetries,
              baseDelayMs: options?.baseDelayMs,
            });

            if (get().networkMode === 'OFFLINE') {
              const interruptedEntry: SyncAttemptLog = {
                timestamp: new Date().toISOString(),
                outcome: 'QUEUED',
                message: 'Device went offline mid-flight; returned packet to local queue.',
              };
              set((state) => ({
                operations: state.operations.map((op) =>
                  op.id === id
                    ? {
                        ...op,
                        syncStatus: 'QUEUED_LOCAL',
                        syncLog: [...(op.syncLog ?? []), interruptedEntry],
                      }
                    : op
                ),
              }));
              break;
            }

            if (result.ok) {
              synced += 1;
              const syncedAt = result.syncedAt ?? new Date().toISOString();
              const successEntry: SyncAttemptLog = {
                timestamp: syncedAt,
                outcome: 'SUCCESS',
                mode: result.mode,
                statusCode: result.statusCode,
                latencyMs: result.latencyMs,
                message: `Verified & replicated via ${result.mode} (${result.latencyMs}ms).`,
              };

              set((state) => ({
                lastSyncAt: syncedAt,
                operations: state.operations.map((op) =>
                  op.id === id
                    ? {
                        ...op,
                        syncStatus: 'SYNCED_CLOUD',
                        syncMode: result.mode,
                        syncedAt,
                        latencyMs: result.latencyMs,
                        lastError: undefined,
                        syncLog: [...(op.syncLog ?? []), successEntry],
                      }
                    : op
                ),
              }));
            } else {
              failed += 1;
              const errMsg = result.error ?? 'Synchronization failed.';
              const failEntry: SyncAttemptLog = {
                timestamp: new Date().toISOString(),
                outcome: 'FAILED',
                mode: result.mode,
                statusCode: result.statusCode,
                latencyMs: result.latencyMs,
                message: errMsg,
              };

              set((state) => ({
                operations: state.operations.map((op) =>
                  op.id === id
                    ? {
                        ...op,
                        syncStatus: 'SYNC_FAILED',
                        syncMode: result.mode,
                        retryCount: op.retryCount + 1,
                        latencyMs: result.latencyMs,
                        lastError: errMsg,
                        syncLog: [...(op.syncLog ?? []), failEntry],
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
        const target = get().operations.find((op) => op.id === id);
        if (!target) return false;

        if (get().networkMode === 'OFFLINE') {
          const deferredEntry: SyncAttemptLog = {
            timestamp: new Date().toISOString(),
            outcome: 'QUEUED',
            message: 'Retry deferred: device is offline.',
          };
          set((state) => ({
            operations: state.operations.map((op) =>
              op.id === id
                ? {
                    ...op,
                    syncStatus: 'QUEUED_LOCAL',
                    lastError: 'Device offline. Packet stays queued until connectivity resumes.',
                    syncLog: [...(op.syncLog ?? []), deferredEntry],
                  }
                : op
            ),
          }));
          return false;
        }

        const retryingEntry: SyncAttemptLog = {
          timestamp: new Date().toISOString(),
          outcome: 'SYNCING',
          message: `Manual retry #${target.retryCount + 1} initiated.`,
        };

        set((state) => ({
          operations: state.operations.map((op) =>
            op.id === id
              ? {
                  ...op,
                  syncStatus: 'SYNCING',
                  lastError: undefined,
                  syncLog: [...(op.syncLog ?? []), retryingEntry],
                }
              : op
          ),
        }));

        const result = await syncOperationRecord(target, {
          endpointUrl: get().syncEndpointUrl,
          timeoutMs: options?.timeoutMs,
          maxRetries: options?.maxRetries,
          baseDelayMs: options?.baseDelayMs,
        });

        if (result.ok) {
          const syncedAt = result.syncedAt ?? new Date().toISOString();
          const successEntry: SyncAttemptLog = {
            timestamp: syncedAt,
            outcome: 'SUCCESS',
            mode: result.mode,
            statusCode: result.statusCode,
            latencyMs: result.latencyMs,
            message: `Retry succeeded via ${result.mode} (${result.latencyMs}ms).`,
          };
          set((state) => ({
            lastSyncAt: syncedAt,
            operations: state.operations.map((op) =>
              op.id === id
                ? {
                    ...op,
                    syncStatus: 'SYNCED_CLOUD',
                    syncMode: result.mode,
                    syncedAt,
                    latencyMs: result.latencyMs,
                    lastError: undefined,
                    syncLog: [...(op.syncLog ?? []), successEntry],
                  }
                : op
            ),
          }));
          return true;
        }

        const errMsg = result.error ?? 'Retry failed.';
        const failEntry: SyncAttemptLog = {
          timestamp: new Date().toISOString(),
          outcome: 'FAILED',
          mode: result.mode,
          statusCode: result.statusCode,
          latencyMs: result.latencyMs,
          message: errMsg,
        };
        set((state) => ({
          operations: state.operations.map((op) =>
            op.id === id
              ? {
                  ...op,
                  syncStatus: 'SYNC_FAILED',
                  syncMode: result.mode,
                  retryCount: op.retryCount + 1,
                  latencyMs: result.latencyMs,
                  lastError: errMsg,
                  syncLog: [...(op.syncLog ?? []), failEntry],
                }
              : op
          ),
        }));
        return false;
      },

      unlockSession: (method) => {
        set({ isUnlocked: true, authMethod: method });
      },

      lockSession: () => {
        set({ isUnlocked: false, authMethod: null });
      },

      clearAllOperations: () => {
        set({
          operations: [],
          isSyncing: false,
          lastSyncAt: null,
        });
      },
    }),
    {
      name: 'pulse-mobile-store-v3',
      storage: createJSONStorage(() => safeAsyncStorage),
      partialize: (state) => ({
        operations: state.operations,
        operatorProfile: state.operatorProfile,
        syncEndpointUrl: state.syncEndpointUrl,
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
);
