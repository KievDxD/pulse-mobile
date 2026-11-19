import { buildCanonicalOperationPayload, FieldOperation } from '../types/operations';
import { generateIntegrityHashAsync } from '../utils/hash';

export const GENESIS_HASH =
  'sha256:0000000000000000000000000000000000000000000000000000000000000000';

export type LedgerChainStatus = 'EMPTY' | 'VERIFIED_CHAIN' | 'TAMPER_DETECTED';

export interface LedgerRecordVerification {
  id: string;
  code: string;
  chainIndex: number;
  hashValid: boolean;
  linkValid: boolean;
  valid: boolean;
  reason?: string;
}

export interface LedgerIntegrityReport {
  status: LedgerChainStatus;
  totalRecords: number;
  verifiedRecords: number;
  brokenRecordIds: string[];
  brokenReason: string | null;
  headHash: string;
  checkedAt: string;
  records: LedgerRecordVerification[];
}

/**
 * Computes the next sequential chainIndex and prevHash pointer from existing ledger records.
 */
export function getNextChainLink(operations: FieldOperation[]): {
  prevHash: string;
  chainIndex: number;
} {
  if (operations.length === 0) {
    return {
      prevHash: GENESIS_HASH,
      chainIndex: 0,
    };
  }

  let head = operations[0];
  for (const op of operations) {
    if (op.chainIndex > head.chainIndex) {
      head = op;
    }
  }

  return {
    prevHash: head.integrityHash,
    chainIndex: head.chainIndex + 1,
  };
}

/**
 * Walks the entire chronological operation ledger, verifying both each record's SHA-256
 * cryptographic digest and its prevHash link to the immediately preceding record.
 */
export async function verifyLedgerIntegrity(
  records: FieldOperation[]
): Promise<LedgerIntegrityReport> {
  const checkedAt = new Date().toISOString();

  if (records.length === 0) {
    return {
      status: 'EMPTY',
      totalRecords: 0,
      verifiedRecords: 0,
      brokenRecordIds: [],
      brokenReason: null,
      headHash: GENESIS_HASH,
      checkedAt,
      records: [],
    };
  }

  const ordered = [...records].sort((a, b) => a.chainIndex - b.chainIndex);
  const verifications: LedgerRecordVerification[] = [];
  const brokenRecordIds: string[] = [];
  let brokenReason: string | null = null;
  let verifiedRecords = 0;

  let expectedPrevHash = GENESIS_HASH;

  for (let idx = 0; idx < ordered.length; idx++) {
    const record = ordered[idx];
    const canonical = buildCanonicalOperationPayload(record);
    const recomputedHash = await generateIntegrityHashAsync(canonical);

    const hashValid = recomputedHash === record.integrityHash;
    const indexValid = record.chainIndex === idx;
    const prevLinkValid = record.prevHash === expectedPrevHash;
    const linkValid = indexValid && prevLinkValid;
    const valid = hashValid && linkValid;

    let reason: string | undefined;
    if (!hashValid) {
      reason = `${record.code}: SHA-256 payload mismatch (local tampering detected).`;
    } else if (!prevLinkValid) {
      reason = `${record.code}: Broken prevHash link at chain #${record.chainIndex}.`;
    } else if (!indexValid) {
      reason = `${record.code}: Non-contiguous chainIndex ${record.chainIndex} (expected ${idx}).`;
    }

    if (valid) {
      verifiedRecords += 1;
    } else {
      brokenRecordIds.push(record.id);
      if (!brokenReason && reason) {
        brokenReason = reason;
      }
    }

    verifications.push({
      id: record.id,
      code: record.code,
      chainIndex: record.chainIndex,
      hashValid,
      linkValid,
      valid,
      reason,
    });

    expectedPrevHash = record.integrityHash;
  }

  return {
    status: brokenRecordIds.length > 0 ? 'TAMPER_DETECTED' : 'VERIFIED_CHAIN',
    totalRecords: ordered.length,
    verifiedRecords,
    brokenRecordIds,
    brokenReason,
    headHash: ordered[ordered.length - 1].integrityHash,
    checkedAt,
    records: verifications,
  };
}
