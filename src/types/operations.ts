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

export interface PhotoEvidence {
  uri: string;
  width: number;
  height: number;
  capturedAt: string;
  fileSizeBytes?: number | null;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  exifSummary?: string;
}

export interface OperatorProfile {
  operatorId: string;
  callsign: string;
  unitSector: string;
}

export interface SyncAttemptLog {
  timestamp: string;
  outcome: 'QUEUED' | 'SYNCING' | 'SUCCESS' | 'FAILED';
  mode?: SyncTransportMode;
  statusCode?: number;
  latencyMs?: number;
  message: string;
}

export interface FieldOperation {
  id: string;
  code: string;
  chainIndex: number;
  prevHash: string;
  title: string;
  category: OperationCategory;
  priority: PriorityLevel;
  coordinates: Coordinates;
  technicalNote: string;
  checkpointId?: string;
  photoEvidence?: PhotoEvidence;
  operatorProfile: OperatorProfile;
  syncStatus: SyncStatus;
  syncMode?: SyncTransportMode;
  integrityHash: string;
  createdAt: string;
  syncedAt?: string;
  latencyMs?: number;
  retryCount: number;
  payloadBytes: number;
  lastError?: string;
  syncLog: SyncAttemptLog[];
}

export interface CreateOperationInput {
  title: string;
  category: OperationCategory;
  priority: PriorityLevel;
  coordinates: Coordinates;
  technicalNote: string;
  checkpointId?: string;
  photoEvidence?: PhotoEvidence;
}

export function buildCanonicalOperationPayload(seed: {
  id: string;
  code: string;
  chainIndex: number;
  prevHash: string;
  title: string;
  category: OperationCategory;
  priority: PriorityLevel;
  coordinates: Coordinates;
  technicalNote: string;
  checkpointId?: string;
  photoEvidence?: PhotoEvidence;
  operatorProfile: OperatorProfile;
  createdAt: string;
}): string {
  return JSON.stringify({
    id: seed.id,
    code: seed.code,
    chainIndex: seed.chainIndex,
    prevHash: seed.prevHash,
    title: seed.title,
    category: seed.category,
    priority: seed.priority,
    coordinates: seed.coordinates,
    technicalNote: seed.technicalNote,
    checkpointId: seed.checkpointId ?? null,
    photoEvidence: seed.photoEvidence ?? null,
    operatorProfile: seed.operatorProfile,
    createdAt: seed.createdAt,
  });
}
