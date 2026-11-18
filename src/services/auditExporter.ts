import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { FieldOperation } from '../types/operations';

export type AuditExportFormat = 'json' | 'csv';

export interface ExportAuditResult {
  ok: boolean;
  filename: string;
  recordCount: number;
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
 * Serializes field operations with full SHA-256 hashes and GPS telemetry into JSON.
 */
export function formatOperationsAsJson(operations: FieldOperation[]): string {
  return JSON.stringify(
    {
      schema: 'pulse-mobile-audit-v2',
      exportedAt: new Date().toISOString(),
      recordCount: operations.length,
      operations,
    },
    null,
    2
  );
}

/**
 * Serializes field operations with full SHA-256 hashes and GPS telemetry into RFC-4180 CSV.
 */
export function formatOperationsAsCsv(operations: FieldOperation[]): string {
  const headers = [
    'id',
    'code',
    'title',
    'category',
    'priority',
    'latitude',
    'longitude',
    'altitudeMeters',
    'accuracyMeters',
    'coordinateSource',
    'checkpointId',
    'syncStatus',
    'syncMode',
    'integrityHash',
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
      op.title,
      op.category,
      op.priority,
      op.coordinates.latitude,
      op.coordinates.longitude,
      op.coordinates.altitudeMeters,
      op.coordinates.accuracyMeters,
      op.coordinates.source,
      op.checkpointId ?? '',
      op.syncStatus,
      op.syncMode ?? '',
      op.integrityHash,
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
 * Writes and shares/downloads the complete audit ledger via expo-file-system + expo-sharing or Web Blob.
 */
export async function exportOperationsAudit(
  operations: FieldOperation[],
  format: AuditExportFormat
): Promise<ExportAuditResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `pulse-audit-${timestamp}.${format}`;
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';
  const content =
    format === 'json'
      ? formatOperationsAsJson(operations)
      : formatOperationsAsCsv(operations);

  if (Platform.OS === 'web') {
    try {
      if (typeof document !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
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
          method: 'WEB_DOWNLOAD',
        };
      }
    } catch (err) {
      return {
        ok: false,
        filename,
        recordCount: operations.length,
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
        method: 'NATIVE_SHARE',
      };
    }

    return {
      ok: true,
      filename,
      recordCount: operations.length,
      method: 'MEMORY_ONLY',
      error: 'File written to cache, but native sharing sheet is unavailable on this device.',
    };
  } catch (err) {
    return {
      ok: false,
      filename,
      recordCount: operations.length,
      method: 'NATIVE_SHARE',
      error: err instanceof Error ? err.message : 'Audit export failed.',
    };
  }
}
