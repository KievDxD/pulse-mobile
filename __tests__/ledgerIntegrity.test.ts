import {
  GENESIS_HASH,
  getNextChainLink,
  verifyLedgerIntegrity,
} from '../src/services/ledgerIntegrity';
import { usePulseStore } from '../src/store/usePulseStore';

describe('Tamper-Evident SHA-256 Hash Chain Ledger (V3.0)', () => {
  beforeEach(async () => {
    usePulseStore.getState().clearAllOperations();
    await usePulseStore.getState().setNetworkMode('OFFLINE');
    await usePulseStore.getState().setOperatorProfile({
      operatorId: 'OP-7701',
      callsign: 'ALPHA-LEAD',
      unitSector: 'GRID-WEST-03',
    });
  });

  it('returns EMPTY status and GENESIS_HASH when no records exist', async () => {
    const link = getNextChainLink([]);
    expect(link).toEqual({ prevHash: GENESIS_HASH, chainIndex: 0 });

    const report = await verifyLedgerIntegrity([]);
    expect(report.status).toBe('EMPTY');
    expect(report.totalRecords).toBe(0);
    expect(report.headHash).toBe(GENESIS_HASH);
  });

  it('links consecutive records via prevHash and certifies VERIFIED_CHAIN', async () => {
    const r0 = await usePulseStore.getState().createOperation({
      title: 'Substation Fence Sensor Audit',
      category: 'SECURITY',
      priority: 'NORMAL',
      coordinates: {
        latitude: 40.71,
        longitude: -74.0,
        accuracyMeters: 2.5,
        altitudeMeters: 10,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Perimeter loop intact.',
    });

    const r1 = await usePulseStore.getState().createOperation({
      title: 'Transformer Coolant Flow Check',
      category: 'POWER_GRID',
      priority: 'HIGH',
      coordinates: {
        latitude: 40.72,
        longitude: -74.01,
        accuracyMeters: 2.0,
        altitudeMeters: 11,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Coolant pump flow nominal at 96%.',
    });

    const r2 = await usePulseStore.getState().createOperation({
      title: 'Fiber Trunk OTDR Trace',
      category: 'TELEMETRY',
      priority: 'CRITICAL',
      coordinates: {
        latitude: 40.73,
        longitude: -74.02,
        accuracyMeters: 1.8,
        altitudeMeters: 9,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Attenuation within spec at 0.4dB.',
    });

    expect(r0.chainIndex).toBe(0);
    expect(r0.prevHash).toBe(GENESIS_HASH);
    expect(r1.chainIndex).toBe(1);
    expect(r1.prevHash).toBe(r0.integrityHash);
    expect(r2.chainIndex).toBe(2);
    expect(r2.prevHash).toBe(r1.integrityHash);

    const report = await verifyLedgerIntegrity(usePulseStore.getState().operations);
    expect(report.status).toBe('VERIFIED_CHAIN');
    expect(report.totalRecords).toBe(3);
    expect(report.verifiedRecords).toBe(3);
    expect(report.brokenRecordIds).toEqual([]);
    expect(report.headHash).toBe(r2.integrityHash);
  });

  it('detects local payload mutation as TAMPER_DETECTED', async () => {
    await usePulseStore.getState().createOperation({
      title: 'Valve Pressure Nominal',
      category: 'INFRASTRUCTURE',
      priority: 'NORMAL',
      coordinates: {
        latitude: 40.7,
        longitude: -74.0,
        accuracyMeters: 3,
        altitudeMeters: null,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Gauge read 42 PSI.',
    });

    const ops = usePulseStore.getState().operations;
    const tamperedOps = [{ ...ops[0], technicalNote: 'Gauge read 99 PSI (Altered)' }];

    const report = await verifyLedgerIntegrity(tamperedOps);
    expect(report.status).toBe('TAMPER_DETECTED');
    expect(report.brokenRecordIds).toContain(ops[0].id);
    expect(report.brokenReason).toContain('SHA-256 payload mismatch');
  });

  it('detects broken prevHash chain pointers across sequential records', async () => {
    const r0 = await usePulseStore.getState().createOperation({
      title: 'Record Zero',
      category: 'MAINTENANCE',
      priority: 'NORMAL',
      coordinates: {
        latitude: 40.7,
        longitude: -74.0,
        accuracyMeters: 3,
        altitudeMeters: null,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Baseline note 0.',
    });

    const r1 = await usePulseStore.getState().createOperation({
      title: 'Record One',
      category: 'MAINTENANCE',
      priority: 'NORMAL',
      coordinates: {
        latitude: 40.71,
        longitude: -74.01,
        accuracyMeters: 3,
        altitudeMeters: null,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Baseline note 1.',
    });

    const brokenChain = [
      { ...r1, prevHash: GENESIS_HASH },
      r0,
    ];

    const report = await verifyLedgerIntegrity(brokenChain);
    expect(report.status).toBe('TAMPER_DETECTED');
    expect(report.brokenRecordIds).toContain(r1.id);
  });

  it('detects tampering of embedded photographic evidence metadata', async () => {
    const op = await usePulseStore.getState().createOperation({
      title: 'Breaker Arc Inspection',
      category: 'POWER_GRID',
      priority: 'CRITICAL',
      coordinates: {
        latitude: 40.71,
        longitude: -74.0,
        accuracyMeters: 2,
        altitudeMeters: 5,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Captured breaker housing photo.',
      photoEvidence: {
        uri: 'file:///cache/evidence-001.jpg',
        width: 1920,
        height: 1080,
        capturedAt: '2026-11-18T18:00:00.000Z',
        gpsLatitude: 40.71,
        gpsLongitude: -74.0,
        exifSummary: 'Apple iPhone 15 Pro',
      },
    });

    const mutated = [
      {
        ...op,
        photoEvidence: {
          ...op.photoEvidence!,
          uri: 'file:///cache/fake-photo.jpg',
        },
      },
    ];

    const report = await verifyLedgerIntegrity(mutated);
    expect(report.status).toBe('TAMPER_DETECTED');
    expect(report.brokenRecordIds).toEqual([op.id]);
  });

  it('detects tampering of embedded operator identity fields', async () => {
    const op = await usePulseStore.getState().createOperation({
      title: 'Relay Seal Verification',
      category: 'SECURITY',
      priority: 'HIGH',
      coordinates: {
        latitude: 40.72,
        longitude: -74.01,
        accuracyMeters: 3,
        altitudeMeters: null,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Tamper seal #884 intact.',
    });

    const spoofedOperator = [
      {
        ...op,
        operatorProfile: {
          ...op.operatorProfile,
          callsign: 'SPOOFED-USER',
        },
      },
    ];

    const report = await verifyLedgerIntegrity(spoofedOperator);
    expect(report.status).toBe('TAMPER_DETECTED');
    expect(report.brokenRecordIds).toEqual([op.id]);
  });

  it('verifies newest-first store ordering consistently by sorting chainIndex chronologically', async () => {
    await usePulseStore.getState().createOperation({
      title: 'First Operation',
      category: 'INFRASTRUCTURE',
      priority: 'NORMAL',
      coordinates: {
        latitude: 40.7,
        longitude: -74.0,
        accuracyMeters: 4,
        altitudeMeters: null,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'First entry.',
    });

    await usePulseStore.getState().createOperation({
      title: 'Second Operation',
      category: 'INFRASTRUCTURE',
      priority: 'HIGH',
      coordinates: {
        latitude: 40.71,
        longitude: -74.01,
        accuracyMeters: 3,
        altitudeMeters: null,
        source: 'GPS_HARDWARE',
      },
      technicalNote: 'Second entry.',
    });

    const storeOps = usePulseStore.getState().operations;
    expect(storeOps[0].chainIndex).toBe(1);
    expect(storeOps[1].chainIndex).toBe(0);

    const report = await verifyLedgerIntegrity(storeOps);
    expect(report.status).toBe('VERIFIED_CHAIN');
    expect(report.records.map((r) => r.chainIndex)).toEqual([0, 1]);
  });
});
