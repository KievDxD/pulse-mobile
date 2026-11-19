import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { FieldOperation, OperatorProfile } from '../types/operations';
import { LedgerIntegrityReport, verifyLedgerIntegrity } from './ledgerIntegrity';
import { DEFAULT_OPERATOR_PROFILE } from './operatorProfile';

export type AuditExportFormat = 'json' | 'csv';

export interface ExportAuditResult {
  ok: boolean;
  filename: string;
  recordCount: number;
  chainStatus: LedgerIntegrityReport['status'];
  method: 'NATIVE_SHARE' | 'WEB_DOWNLOAD' | 'MEMORY_ONLY';
  error?: string;
}

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes field operations with chain verification, operator identity, GPS, photo metadata, and SHA-256 hashes into JSON.
 */
export function formatOperationsAsJson(
  operations: FieldOperation[],
  chainVerification?: LedgerIntegrityReport,
  operatorProfile: OperatorProfile = DEFAULT_OPERATOR_PROFILE
): string {
  return JSON.stringify(
    {
      schema: 'pulse-mobile-audit-v3',
      exportedAt: new Date().toISOString(),
      operatorProfile,
      recordCount: operations.length,
      chainVerification: chainVerification ?? null,
      operations,
    },
    null,
    2
  );
}

/**
 * Serializes field operations with SHA-256 chain links, operator identity, GPS, and photo evidence metadata into RFC-4180 CSV.
 */
export function formatOperationsAsCsv(
  operations: FieldOperation[],
  chainVerification?: LedgerIntegrityReport
): string {
  const statusMap = new Map<string, string>();
  if (chainVerification) {
    for (const entry of chainVerification.records) {
      statusMap.set(entry.id, entry.valid ? 'VERIFIED' : 'TAMPER_DETECTED');
    }
  }

  const headers = [
    'id',
    'code',
    'chainIndex',
    'chainStatus',
    'prevHash',
    'integrityHash',
    'operatorId',
    'operatorCallsign',
    'operatorUnit',
    'title',
    'category',
    'priority',
    'latitude',
    'longitude',
    'altitudeMeters',
    'accuracyMeters',
    'coordinateSource',
    'checkpointId',
    'photoEvidenceUri',
    'photoResolution',
    'syncStatus',
    'syncMode',
    'payloadBytes',
    'latencyMs',
    'retryCount',
    'createdAt',
    'syncedAt',
    'technicalNote',
  ];

  const rows = operations.map((op) =>
    [
      op.id,
      op.code,
      op.chainIndex,
      statusMap.get(op.id) ?? 'UNVERIFIED',
      op.prevHash,
      op.integrityHash,
      op.operatorProfile?.operatorId ?? '',
      op.operatorProfile?.callsign ?? '',
      op.operatorProfile?.unitSector ?? '',
      op.title,
      op.category,
      op.priority,
      op.coordinates.latitude,
      op.coordinates.longitude,
      op.coordinates.altitudeMeters,
      op.coordinates.accuracyMeters,
      op.coordinates.source,
      op.checkpointId ?? '',
      op.photoEvidence?.uri ?? '',
      op.photoEvidence ? `${op.photoEvidence.width}x${op.photoEvidence.height}` : '',
      op.syncStatus,
      op.syncMode ?? '',
      op.payloadBytes,
      op.latencyMs ?? '',
      op.retryCount,
      op.createdAt,
      op.syncedAt ?? '',
      op.technicalNote,
    ]
      .map(escapeCsvField)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Verifies the SHA-256 hash chain and exports/shares the full audit trail via expo-file-system + expo-sharing or Web download.
 */
export async function exportOperationsAudit(
  operations: FieldOperation[],
  format: AuditExportFormat,
  operatorProfile: OperatorProfile = DEFAULT_OPERATOR_PROFILE
): Promise<ExportAuditResult> {
  const integrityReport = await verifyLedgerIntegrity(operations);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `pulse-audit-${timestamp}.${format}`;
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';
  const content =
    format === 'json'
      ? formatOperationsAsJson(operations, integrityReport, operatorProfile)
      : formatOperationsAsCsv(operations, integrityReport);

  if (Platform.OS === 'web') {
    try {
      if (
        typeof document !== 'undefined' &&
        typeof Blob !== 'undefined' &&
        typeof URL !== 'undefined'
      ) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        return {
          ok: true,
          filename,
          recordCount: operations.length,
          chainStatus: integrityReport.status,
          method: 'WEB_DOWNLOAD',
        };
      }
    } catch (err) {
      return {
        ok: false,
        filename,
        recordCount: operations.length,
        chainStatus: integrityReport.status,
        method: 'WEB_DOWNLOAD',
        error: err instanceof Error ? err.message : 'Browser export failed.',
      };
    }
  }

  try {
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    await file.write(content);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType,
        dialogTitle: `Export PULSE // MOBILE Audit (${format.toUpperCase()})`,
        UTI: format === 'json' ? 'public.json' : 'public.comma-separated-values-text',
      });
      return {
        ok: true,
        filename,
        recordCount: operations.length,
        chainStatus: integrityReport.status,
        method: 'NATIVE_SHARE',
      };
    }

    return {
      ok: true,
      filename,
      recordCount: operations.length,
      chainStatus: integrityReport.status,
      method: 'MEMORY_ONLY',
      error: 'File written to cache, but native sharing sheet is unavailable on this device.',
    };
  } catch (err) {
    return {
      ok: false,
      filename,
      recordCount: operations.length,
      chainStatus: integrityReport.status,
      method: 'NATIVE_SHARE',
      error: err instanceof Error ? err.message : 'Audit export failed.',
    };
  }
}
