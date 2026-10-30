const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Calculates SHA-256 entry hash
 */
function calculateEntryHash(prevHash, auditId, documentId, institutionId, action, performedById, timestamp, details) {
  const content = `${prevHash}|${auditId}|${documentId}|${institutionId}|${action}|${performedById}|${timestamp}|${details || ''}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Appends a tamper-evident audit record with SHA-256 chain linkage.
 */
function recordDocumentAudit({
  documentId,
  institutionId,
  applicationId = null,
  action,
  performedById,
  performedByName,
  performedByRole,
  details = {},
  ipAddress = '127.0.0.1',
  userAgent = 'AICTE-Client/1.0'
}) {
  const lastEntry = db.prepare(`
    SELECT entry_hash FROM document_audit_trail 
    ORDER BY id DESC LIMIT 1
  `).get();

  const prevHash = lastEntry ? lastEntry.entry_hash : GENESIS_HASH;
  const auditId = uuidv4();
  const timestamp = new Date().toISOString();
  const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);

  const entryHash = calculateEntryHash(
    prevHash,
    auditId,
    documentId,
    institutionId,
    action,
    performedById,
    timestamp,
    detailsStr
  );

  const stmt = db.prepare(`
    INSERT INTO document_audit_trail (
      audit_id, document_id, institution_id, application_id, action,
      performed_by_id, performed_by_name, performed_by_role,
      details, ip_address, user_agent, timestamp, previous_hash, entry_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    auditId,
    documentId,
    institutionId,
    applicationId,
    action,
    performedById,
    performedByName,
    performedByRole,
    detailsStr,
    ipAddress,
    userAgent,
    timestamp,
    prevHash,
    entryHash
  );

  return {
    auditId,
    timestamp,
    entryHash,
    prevHash
  };
}

/**
 * Validates the cryptographic integrity of the entire audit chain.
 * Verifies that no records have been altered, added out of order, or deleted.
 */
function verifyAuditChainIntegrity() {
  const records = db.prepare(`
    SELECT * FROM document_audit_trail ORDER BY id ASC
  `).all();

  if (records.length === 0) {
    return {
      isValid: true,
      totalRecords: 0,
      message: 'Audit trail is empty. Ready for immutable logging.'
    };
  }

  let expectedPrevHash = GENESIS_HASH;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];

    if (r.previous_hash !== expectedPrevHash) {
      return {
        isValid: false,
        brokenAtRecordId: r.id,
        brokenAtAuditId: r.audit_id,
        expectedPrevHash,
        actualPrevHash: r.previous_hash,
        message: `Cryptographic chain broken at record ID ${r.id}! Hash mismatch with previous record.`
      };
    }

    const recomputedHash = calculateEntryHash(
      r.previous_hash,
      r.audit_id,
      r.document_id,
      r.institution_id,
      r.action,
      r.performed_by_id,
      r.timestamp,
      r.details
    );

    if (recomputedHash !== r.entry_hash) {
      return {
        isValid: false,
        tamperedRecordId: r.id,
        tamperedAuditId: r.audit_id,
        message: `Tampering detected at record ID ${r.id}! Stored hash does not match content hash.`
      };
    }

    expectedPrevHash = r.entry_hash;
  }

  return {
    isValid: true,
    totalRecords: records.length,
    latestHash: expectedPrevHash,
    message: `All ${records.length} audit records verified. Cryptographic hash chain is intact and tamper-free.`
  };
}

module.exports = {
  recordDocumentAudit,
  verifyAuditChainIntegrity
};
