import {
  exportOperationsAudit,
  formatOperationsAsCsv,
  formatOperationsAsJson,
} from '../src/services/auditExporter';
import { fetchRealNetworkStatus, normalizeNetworkState } from '../src/services/networkMonitor';
import {
  clearVerifiedLedger,
  getVerifiedLedgerCount,
  isValidHttpEndpoint,
  syncOperationRecord,
} from '../src/services/syncClient';
import { usePulseStore } from '../src/store/usePulseStore';
import {
  formatShortHash,
  generateIntegrityHashAsync,
  verifyIntegrityHashAsync,
} from '../src/utils/hash';

describe('Real Network, SHA-256 Crypto, Sync Client & Audit Store (V2.0)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    usePulseStore.getState().clearAllOperations();
    usePulseStore.getState().setSyncEndpointUrl('');
    usePulseStore.getState().lockSession();
    await usePulseStore.getState().setNetworkMode('ONLINE');
    await clearVerifiedLedger();
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('initializes with a clean empty operations list (zero preloaded fake data)', () => {
    const state = usePulseStore.getState();
    expect(state.operations).toEqual([]);
    expect(state.lastSyncAt).toBeNull();
  });

  it('creates a field operation with real expo-crypto SHA-256 hash and hardware GPS coordinates while offline', async () => {
    await usePulseStore.getState().setNetworkMode('OFFLINE');

    const created = await usePulseStore.getState().createOperation({
      title: 'Transformer Thermal Reading',
      category: 'POWER_GRID',
      priority: 'CRITICAL',
      coordinates: {
        latitude: 40.7128,
        longitude: -74.006,
        accuracyMeters: 3.4,
        altitudeMeters: 14.5,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Measured hotspot at 88.2C using handheld FLIR.',
      checkpointId: 'QR-SUBSTATION-14',
    });

    expect(created.code).toBe('OP-1001');
    expect(created.syncStatus).toBe('QUEUED_LOCAL');
    expect(created.integrityHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(created.coordinates.accuracyMeters).toBe(3.4);
    expect(created.coordinates.altitudeMeters).toBe(14.5);
    expect(created.payloadBytes).toBeGreaterThan(80);
  });

  it('automatically transitions from Airplane Mode (NONE) to WIFI and syncs queued packets to verified local ledger', async () => {
    const offlineState = normalizeNetworkState({
      type: 'NONE',
      isConnected: false,
      isInternetReachable: false,
    });
    expect(offlineState.isOffline).toBe(true);

    await usePulseStore.getState().applyRealNetworkStatus(offlineState);
    expect(usePulseStore.getState().networkMode).toBe('OFFLINE');

    await usePulseStore.getState().createOperation({
      title: 'Fiber Splice Enclosure Check',
      category: 'TELEMETRY',
      priority: 'HIGH',
      coordinates: {
        latitude: 40.7306,
        longitude: -73.9866,
        accuracyMeters: 2.1,
        altitudeMeters: 8.0,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Resealed optical splice tray and confirmed -0.2dB loss.',
    });

    expect(usePulseStore.getState().operations[0].syncStatus).toBe('QUEUED_LOCAL');

    const wifiState = normalizeNetworkState(
      {
        type: 'WIFI',
        isConnected: true,
        isInternetReachable: true,
      },
      '192.168.1.42'
    );
    expect(wifiState.isOffline).toBe(false);

    await usePulseStore.getState().applyRealNetworkStatus(wifiState);

    const ops = usePulseStore.getState().operations;
    expect(usePulseStore.getState().networkMode).toBe('ONLINE');
    expect(ops).toHaveLength(1);
    expect(ops[0].syncStatus).toBe('SYNCED_CLOUD');
    expect(ops[0].syncMode).toBe('LOCAL_TRANSACTIONAL_LEDGER');
    expect(await getVerifiedLedgerCount()).toBe(1);
  });

  it('queries real network state and IPv4 address via expo-network', async () => {
    const status = await fetchRealNetworkStatus();
    expect(status.isOffline).toBe(false);
    expect(status.type).toBe('WIFI');
    expect(status.ipAddress).toBe('192.168.1.42');
  });

  it('rejects tampered payloads during pre-sync SHA-256 verification', async () => {
    await usePulseStore.getState().setNetworkMode('OFFLINE');
    const op = await usePulseStore.getState().createOperation({
      title: 'Valve Pressure Audit',
      category: 'INFRASTRUCTURE',
      priority: 'NORMAL',
      coordinates: {
        latitude: 40.7,
        longitude: -74.0,
        accuracyMeters: 5.0,
        altitudeMeters: null,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Pressure nominal at 41 PSI.',
    });

    const tampered = { ...op, title: 'TAMPERED TITLE' };
    const result = await syncOperationRecord(tampered, { endpointUrl: '' });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('ERR_INTEGRITY_MISMATCH');
  });

  it('syncs to a real HTTP endpoint with retries and exponential backoff on transient 503', async () => {
    expect(isValidHttpEndpoint('https://api.pulse.ops/v2/ingest')).toBe(true);
    expect(isValidHttpEndpoint('ftp://invalid')).toBe(false);

    await usePulseStore.getState().setNetworkMode('OFFLINE');
    const op = await usePulseStore.getState().createOperation({
      title: 'Substation Relay Firmware',
      category: 'POWER_GRID',
      priority: 'CRITICAL',
      coordinates: {
        latitude: 40.75,
        longitude: -73.98,
        accuracyMeters: 2.0,
        altitudeMeters: 15,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Checksum verified prior to upload.',
    });

    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 503, statusText: 'Service Unavailable' } as Response;
      }
      return { ok: true, status: 201, statusText: 'Created' } as Response;
    }) as unknown as typeof fetch;

    const result = await syncOperationRecord(op, {
      endpointUrl: 'https://api.pulse.ops/v2/ingest',
      maxRetries: 2,
      baseDelayMs: 5,
      timeoutMs: 1000,
    });

    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
    expect(result.mode).toBe('REMOTE_HTTP');
    expect(result.statusCode).toBe(201);
    expect(result.attempts).toBe(2);
  });

  it('marks packet as SYNC_FAILED when HTTP endpoint fails all retries and recovers via retryOperation', async () => {
    usePulseStore.getState().setSyncEndpointUrl('https://api.pulse.ops/v2/ingest');

    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    })) as unknown as typeof fetch;

    await usePulseStore.getState().setNetworkMode('OFFLINE');
    const op = await usePulseStore.getState().createOperation({
      title: 'Perimeter Gate Telemetry',
      category: 'SECURITY',
      priority: 'HIGH',
      coordinates: {
        latitude: 40.74,
        longitude: -73.99,
        accuracyMeters: 4.0,
        altitudeMeters: 10,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Gate reader loop checked.',
    });

    await usePulseStore.getState().setNetworkMode('ONLINE', { maxRetries: 1, baseDelayMs: 5 });
    const failedOp = usePulseStore.getState().operations.find((item) => item.id === op.id);
    expect(failedOp?.syncStatus).toBe('SYNC_FAILED');
    expect(failedOp?.retryCount).toBe(1);

    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
    })) as unknown as typeof fetch;

    const ok = await usePulseStore.getState().retryOperation(op.id, { maxRetries: 1, baseDelayMs: 5 });
    expect(ok).toBe(true);
    expect(usePulseStore.getState().operations[0].syncStatus).toBe('SYNCED_CLOUD');
  });

  it('verifies async SHA-256 digest generation and validation via expo-crypto', async () => {
    const payload = '{"op":"real-crypto-check"}';
    const hash = await generateIntegrityHashAsync(payload);

    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await verifyIntegrityHashAsync(payload, hash)).toBe(true);
    expect(await verifyIntegrityHashAsync(payload + 'x', hash)).toBe(false);
    expect(formatShortHash(hash)).toMatch(/^sha256:[0-9a-f]{6}\.\.\.[0-9a-f]{6}$/);
  });

  it('formats and exports full audit trail as JSON and RFC-4180 CSV via expo-sharing', async () => {
    const op = await usePulseStore.getState().createOperation({
      title: 'Generator Load Test, Bay "A"',
      category: 'MAINTENANCE',
      priority: 'NORMAL',
      coordinates: {
        latitude: 40.72,
        longitude: -74.01,
        accuracyMeters: 2.5,
        altitudeMeters: 6.2,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Battery bank passed 100A load test.',
      checkpointId: 'CHK-GEN-01',
    });

    const jsonStr = formatOperationsAsJson([op]);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.schema).toBe('pulse-mobile-audit-v3');
    expect(parsed.recordCount).toBe(1);
    expect(parsed.operatorProfile).toBeDefined();
    expect(parsed.operations[0].integrityHash).toBe(op.integrityHash);
    expect(op.syncLog.length).toBeGreaterThanOrEqual(2);

    const csvStr = formatOperationsAsCsv([op]);
    expect(csvStr).toContain('integrityHash');
    expect(csvStr).toContain('chainStatus');
    expect(csvStr).toContain('"Generator Load Test, Bay ""A"""');

    const exported = await exportOperationsAudit([op], 'csv');
    expect(exported.ok).toBe(true);
    expect(exported.recordCount).toBe(1);
    expect(exported.chainStatus).toBe('VERIFIED_CHAIN');
    expect(exported.filename).toMatch(/^pulse-audit-.*\.csv$/);
  });

  it('tracks real biometric/PIN lock and unlock transitions', () => {
    expect(usePulseStore.getState().isUnlocked).toBe(false);
    usePulseStore.getState().unlockSession('BIOMETRIC');
    expect(usePulseStore.getState().isUnlocked).toBe(true);
    expect(usePulseStore.getState().authMethod).toBe('BIOMETRIC');

    usePulseStore.getState().lockSession();
    expect(usePulseStore.getState().isUnlocked).toBe(false);
    expect(usePulseStore.getState().authMethod).toBeNull();
  });
});
