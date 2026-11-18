import { INITIAL_OPERATIONS, usePulseStore } from '../src/store/usePulseStore';
import { formatShortHash, generateIntegrityHash, verifyIntegrityHash } from '../src/utils/hash';

describe('Offline-First Sync Engine & Operations Store', () => {
  beforeEach(() => {
    usePulseStore.getState().resetDemoData();
    usePulseStore.getState().lockSession();
  });

  it('preloads 6 realistic field operations with valid SHA-256 integrity hashes', () => {
    const ops = usePulseStore.getState().operations;
    expect(ops).toHaveLength(6);
    expect(INITIAL_OPERATIONS).toHaveLength(6);

    const queued = ops.filter((op) => op.syncStatus === 'QUEUED_LOCAL');
    const synced = ops.filter((op) => op.syncStatus === 'SYNCED_CLOUD');
    expect(queued.length).toBe(2);
    expect(synced.length).toBe(4);

    for (const op of ops) {
      expect(op.integrityHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(op.payloadBytes).toBeGreaterThan(50);
    }
  });

  it('creates field reports locally as QUEUED_LOCAL with SHA-256 signature while in OFFLINE mode', async () => {
    await usePulseStore.getState().setNetworkMode('OFFLINE');

    const created = usePulseStore.getState().addOperation({
      title: 'Emergency Switchgear Breaker Check',
      category: 'POWER_GRID',
      priority: 'CRITICAL',
      coordinates: { latitude: 40.7128, longitude: -74.006, sector: 'SECTOR-NE-09', accuracyMeters: 1.9 },
      technicalNote: 'Isolated breaker C3 pending thermal camera validation.',
      checkpointId: 'CHK-2026-ZULU',
    });

    expect(created.syncStatus).toBe('QUEUED_LOCAL');
    expect(created.integrityHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(created.code).toBe('OP-1007');
    expect(usePulseStore.getState().operations).toHaveLength(7);
  });

  it('does not flush queued packets when syncQueue is called while OFFLINE', async () => {
    await usePulseStore.getState().setNetworkMode('OFFLINE');
    const result = await usePulseStore.getState().syncQueue({ stepDelayMs: 0 });

    expect(result).toEqual({ synced: 0, failed: 0 });
    const pending = usePulseStore
      .getState()
      .operations.filter((op) => op.syncStatus === 'QUEUED_LOCAL');
    expect(pending.length).toBe(2);
  });

  it('automatically runs sequential sync when transitioning from OFFLINE to ONLINE', async () => {
    await usePulseStore.getState().setNetworkMode('OFFLINE');
    usePulseStore.getState().addOperation({
      title: 'Underground Conduit Sensor Calibration',
      category: 'TELEMETRY',
      priority: 'HIGH',
      coordinates: { latitude: 40.73, longitude: -73.99, sector: 'SECTOR-CORE-03' },
      technicalNote: 'Signal attenuation checked at -2.1dB.',
    });

    await usePulseStore.getState().setNetworkMode('ONLINE', { stepDelayMs: 0 });

    const state = usePulseStore.getState();
    expect(state.networkMode).toBe('ONLINE');
    expect(state.isSyncing).toBe(false);

    const pending = state.operations.filter((op) => op.syncStatus !== 'SYNCED_CLOUD');
    expect(pending).toHaveLength(0);

    for (const op of state.operations) {
      expect(op.syncStatus).toBe('SYNCED_CLOUD');
      expect(typeof op.latencyMs).toBe('number');
      expect(op.latencyMs).toBeGreaterThanOrEqual(42);
      expect(op.syncedAt).toBeTruthy();
    }
  });

  it('marks packets as SYNC_FAILED and increments retryCount when fault simulation is active', async () => {
    usePulseStore.getState().setSimulatedFaultMode(true);
    const result = await usePulseStore.getState().syncQueue({ stepDelayMs: 0 });

    expect(result.synced).toBe(0);
    expect(result.failed).toBe(2);

    const failedOps = usePulseStore
      .getState()
      .operations.filter((op) => op.syncStatus === 'SYNC_FAILED');
    expect(failedOps).toHaveLength(2);
    expect(failedOps[0].retryCount).toBe(1);
    expect(failedOps[0].lastError).toBeTruthy();
  });

  it('injects fault via simulateNetworkFailure and recovers individual packet via retryOperation', async () => {
    const faulted = usePulseStore.getState().simulateNetworkFailure();
    expect(faulted.syncStatus).toBe('SYNC_FAILED');
    expect(faulted.retryCount).toBeGreaterThanOrEqual(1);

    const recovered = await usePulseStore.getState().retryOperation(faulted.id, { stepDelayMs: 0 });
    expect(recovered).toBe(true);

    const updated = usePulseStore.getState().operations.find((op) => op.id === faulted.id);
    expect(updated?.syncStatus).toBe('SYNCED_CLOUD');
    expect(updated?.lastError).toBeUndefined();
  });

  it('verifies deterministic SHA-256 integrity hashing and short formatting', () => {
    const payload = '{"code":"OP-9999","title":"Valve Check"}';
    const digest = generateIntegrityHash(payload);

    expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(verifyIntegrityHash(payload, digest)).toBe(true);
    expect(verifyIntegrityHash(payload + 'tampered', digest)).toBe(false);
    expect(formatShortHash(digest)).toMatch(/^sha256:[0-9a-f]{6}\.\.\.[0-9a-f]{6}$/);
  });

  it('tracks biometric/demo session unlock and lock state transitions', () => {
    expect(usePulseStore.getState().isUnlocked).toBe(false);
    expect(usePulseStore.getState().authMethod).toBeNull();

    usePulseStore.getState().unlockSession('DEMO_BYPASS');
    expect(usePulseStore.getState().isUnlocked).toBe(true);
    expect(usePulseStore.getState().authMethod).toBe('DEMO_BYPASS');

    usePulseStore.getState().lockSession();
    expect(usePulseStore.getState().isUnlocked).toBe(false);
    expect(usePulseStore.getState().authMethod).toBeNull();
  });
});
