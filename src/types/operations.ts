export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'NORMAL';

export type OperationCategory =
  | 'INFRASTRUCTURE'
  | 'POWER_GRID'
  | 'TELEMETRY'
  | 'SECURITY'
  | 'MAINTENANCE';

export type SyncStatus = 'QUEUED_LOCAL' | 'SYNCING' | 'SYNCED_CLOUD' | 'SYNC_FAILED';

export type NetworkMode = 'ONLINE' | 'OFFLINE';

export type CoordinateSource = 'GPS_HARDWARE' | 'MANUAL';

export type SyncTransportMode = 'REMOTE_HTTP' | 'LOCAL_TRANSACTIONAL_LEDGER';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  source: CoordinateSource;
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
  syncMode?: SyncTransportMode;
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

export function buildCanonicalOperationPayload(seed: {
  id: string;
  code: string;
  title: string;
  category: OperationCategory;
  priority: PriorityLevel;
  coordinates: Coordinates;
  technicalNote: string;
  checkpointId?: string;
  createdAt: string;
}): string {
  return JSON.stringify({
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
}
