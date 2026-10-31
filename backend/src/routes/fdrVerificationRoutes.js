const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { recordDocumentAudit } = require('../audit');
const { successResponse, errorResponse } = require('../utils/responseHelper');

function isOfficerRole(role) {
  return [
    ROLES.SUPER_ADMIN,
    ROLES.AICTE_ADMIN,
    ROLES.REGULATION_BUREAU,
    ROLES.REGIONAL_OFFICER,
    ROLES.BUREAU_OFFICER
  ].includes(role);
}

/**
 * GET /api/fdr-verification/pending
 * Pending verification queue for AICTE officers
 */
router.get('/pending', authenticateToken, (req, res) => {
  try {
    if (!isOfficerRole(req.user.role) && req.user.role !== ROLES.AUDITOR) {
      return errorResponse(res, 'Access denied: Verification workspace is reserved for AICTE Officers', 403, 'FORBIDDEN');
    }

    let query = `
      SELECT f.*, 
             i.name as institution_name, 
             i.code as institution_code,
             i.region as institution_region,
             (SELECT COUNT(*) FROM fdr_documents d WHERE d.fdr_id = f.id) as documents_count,
             (SELECT COUNT(*) FROM fdr_discrepancies disc WHERE disc.fdr_id = f.id AND disc.status = 'OPEN') as open_discrepancies_count
      FROM fdr_records f
      LEFT JOIN institutions i ON f.institution_id = i.id
      WHERE f.verification_status IN ('PENDING', 'DISCREPANT')
    `;
    const params = [];

    if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
      query += ' AND i.region = ?';
      params.push(req.user.region);
    }

    query += ' ORDER BY f.submission_date ASC';

    const pendingList = db.prepare(query).all(...params);
    return successResponse(res, pendingList, 'Pending FDR verification queue loaded');
  } catch (err) {
    console.error('Error in /api/fdr-verification/pending:', err);
    return errorResponse(res, err.message, 500);
  }
});

/**
 * POST /api/fdr-verification/:id/verify
 * Record officer verification outcome
 */
router.post('/:id/verify', authenticateToken, (req, res) => {
  try {
    if (!isOfficerRole(req.user.role)) {
      return errorResponse(res, 'Only designated AICTE Officers may record FDR verification decisions', 403, 'FORBIDDEN');
    }

    const fdr = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(req.params.id);
    if (!fdr) {
      return errorResponse(res, 'FDR record not found', 404, 'NOT_FOUND');
    }

    const {
      verification_method = 'PORTAL_VERIFICATION', // BANK_API, OFFICIAL_EMAIL, PHYSICAL_LETTER, PORTAL_VERIFICATION
      bank_confirmation_ref,
      bank_contact_person,
      bank_contact_email,
      result, // VERIFIED, DEFICIENT, REJECTED, SUSPECTED_FRAUD
      observations
    } = req.body;

    if (!result || !['VERIFIED', 'DEFICIENT', 'REJECTED', 'SUSPECTED_FRAUD'].includes(result)) {
      return errorResponse(res, 'Valid verification result is required (VERIFIED, DEFICIENT, REJECTED, SUSPECTED_FRAUD)', 400, 'VALIDATION_FAILED');
    }

    const verificationId = uuidv4();
    const officerName = req.user.full_name || req.user.username;

    // Record formal verification
    db.prepare(`
      INSERT INTO fdr_verifications (
        id, fdr_id, officer_id, officer_name, officer_role,
        verification_method, bank_confirmation_ref, bank_contact_person,
        bank_contact_email, result, observations, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      verificationId,
      fdr.id,
      req.user.id,
      officerName,
      req.user.role,
      verification_method,
      bank_confirmation_ref || null,
      bank_contact_person || null,
      bank_contact_email || null,
      result,
      observations || null
    );

    // Update FDR state based on result
    let newStatus = fdr.status;
    let newVerificationStatus = 'PENDING';

    if (result === 'VERIFIED') {
      newStatus = 'ACTIVE';
      newVerificationStatus = 'VERIFIED';
    } else if (result === 'DEFICIENT') {
      newStatus = 'PENDING_VERIFICATION';
      newVerificationStatus = 'DISCREPANT';
    } else if (result === 'REJECTED' || result === 'SUSPECTED_FRAUD') {
      newStatus = 'REJECTED';
      newVerificationStatus = 'REJECTED';
    }

    db.prepare(`
      UPDATE fdr_records SET
        status = ?,
        verification_status = ?,
        verified_by_user_id = ?,
        verified_by_name = ?,
        verified_at = CURRENT_TIMESTAMP,
        verification_method = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      newStatus,
      newVerificationStatus,
      req.user.id,
      officerName,
      verification_method,
      fdr.id
    );

    // If verified, mark linked documents as VALID
    if (result === 'VERIFIED') {
      db.prepare(`
        UPDATE fdr_documents SET verification_status = 'VALID' WHERE fdr_id = ?
      `).run(fdr.id);
    }

    // Audit log
    recordDocumentAudit({
      documentId: fdr.id,
      institutionId: fdr.institution_id,
      action: `FDR_VERIFICATION_${result}`,
      performedById: req.user.id,
      performedByName: officerName,
      performedByRole: req.user.role,
      details: {
        fdr_number: fdr.fdr_number,
        result,
        verification_method,
        bank_confirmation_ref,
        observations
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Notify institution
    try {
      db.prepare(`
        INSERT INTO notifications (id, role_target, institution_id, title, message, type, link)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        ROLES.INSTITUTION_ADMIN,
        fdr.institution_id,
        `FDR Verification Status: ${result}`,
        `Your FDR No. ${fdr.fdr_number} (₹${Number(fdr.deposit_amount).toLocaleString('en-IN')}) verification result is: ${result}. Observations: ${observations || 'None'}`,
        result === 'VERIFIED' ? 'SUCCESS' : 'WARNING',
        `/fdr/${fdr.id}`
      );
    } catch (notifErr) {
      console.warn('Notification failure:', notifErr.message);
    }

    const updatedFdr = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(fdr.id);
    return successResponse(res, { fdr: updatedFdr, verificationId }, `Verification recorded as ${result}`);
  } catch (err) {
    console.error('Error in /api/fdr-verification/:id/verify:', err);
    return errorResponse(res, err.message, 500);
  }
});

/**
 * POST /api/fdr-verification/:id/discrepancy
 * Raise a formal discrepancy / deficiency
 */
router.post('/:id/discrepancy', authenticateToken, (req, res) => {
  try {
    if (!isOfficerRole(req.user.role)) {
      return errorResponse(res, 'Only designated AICTE Officers may raise FDR discrepancies', 403, 'FORBIDDEN');
    }

    const fdr = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(req.params.id);
    if (!fdr) {
      return errorResponse(res, 'FDR record not found', 404, 'NOT_FOUND');
    }

    const {
      category = 'AMOUNT_MISMATCH',
      title,
      description,
      severity = 'MEDIUM'
    } = req.body;

    if (!title || !description) {
      return errorResponse(res, 'Title and Description are required to raise a discrepancy', 400, 'VALIDATION_FAILED');
    }

    const discrepancyId = uuidv4();
    const officerName = req.user.full_name || req.user.username;

    db.prepare(`
      INSERT INTO fdr_discrepancies (
        id, fdr_id, institution_id, category, title, description,
        severity, raised_by_id, raised_by_name, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP)
    `).run(
      discrepancyId,
      fdr.id,
      fdr.institution_id,
      category,
      title.trim(),
      description.trim(),
      severity,
      req.user.id,
      officerName
    );

    // Update FDR verification status to DISCREPANT
    db.prepare(`
      UPDATE fdr_records SET 
        verification_status = 'DISCREPANT',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(fdr.id);

    // Audit log
    recordDocumentAudit({
      documentId: fdr.id,
      institutionId: fdr.institution_id,
      action: 'FDR_DISCREPANCY_RAISED',
      performedById: req.user.id,
      performedByName: officerName,
      performedByRole: req.user.role,
      details: {
        discrepancyId,
        category,
        title,
        severity
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Notify institution
    try {
      db.prepare(`
        INSERT INTO notifications (id, role_target, institution_id, title, message, type, link)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        ROLES.INSTITUTION_ADMIN,
        fdr.institution_id,
        `Discrepancy Raised on FDR ${fdr.fdr_number}`,
        `AICTE Scrutiny Officer raised a ${severity} discrepancy: "${title}". Please review and provide clarification immediately.`,
        'WARNING',
        `/fdr/${fdr.id}`
      );
    } catch (notifErr) {
      console.warn('Notification warning:', notifErr.message);
    }

    const created = db.prepare('SELECT * FROM fdr_discrepancies WHERE id = ?').get(discrepancyId);
    return successResponse(res, created, 'Discrepancy raised successfully', 201);
  } catch (err) {
    console.error('Error raising discrepancy:', err);
    return errorResponse(res, err.message, 500);
  }
});

/**
 * POST /api/fdr-verification/discrepancy/:discrepancyId/respond
 * Institution responds to a raised discrepancy
 */
router.post('/discrepancy/:discrepancyId/respond', authenticateToken, (req, res) => {
  try {
    const disc = db.prepare('SELECT * FROM fdr_discrepancies WHERE id = ?').get(req.params.discrepancyId);
    if (!disc) {
      return errorResponse(res, 'Discrepancy not found', 404, 'NOT_FOUND');
    }

    // Must belong to institution
    if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
      if (req.user.institution_id !== disc.institution_id) {
        return errorResponse(res, 'Access denied', 403, 'FORBIDDEN');
      }
    }

    const { institution_response, response_document_id } = req.body;
    if (!institution_response || !institution_response.trim()) {
      return errorResponse(res, 'Response explanation text is required', 400, 'VALIDATION_FAILED');
    }

    db.prepare(`
      UPDATE fdr_discrepancies SET
        institution_response = ?,
        response_document_id = ?,
        status = 'INSTITUTION_RESPONDED',
        responded_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      institution_response.trim(),
      response_document_id || null,
      disc.id
    );

    recordDocumentAudit({
      documentId: disc.fdr_id,
      institutionId: disc.institution_id,
      action: 'FDR_DISCREPANCY_RESPONDED',
      performedById: req.user.id,
      performedByName: req.user.full_name || req.user.username,
      performedByRole: req.user.role,
      details: {
        discrepancyId: disc.id,
        response: institution_response.trim()
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const updated = db.prepare('SELECT * FROM fdr_discrepancies WHERE id = ?').get(disc.id);
    return successResponse(res, updated, 'Response submitted to AICTE successfully');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * POST /api/fdr-verification/discrepancy/:discrepancyId/resolve
 * Officer resolves or waives discrepancy
 */
router.post('/discrepancy/:discrepancyId/resolve', authenticateToken, (req, res) => {
  try {
    if (!isOfficerRole(req.user.role)) {
      return errorResponse(res, 'Only AICTE Officers can resolve discrepancies', 403, 'FORBIDDEN');
    }

    const disc = db.prepare('SELECT * FROM fdr_discrepancies WHERE id = ?').get(req.params.discrepancyId);
    if (!disc) {
      return errorResponse(res, 'Discrepancy not found', 404, 'NOT_FOUND');
    }

    const { status = 'RESOLVED', resolution_remarks } = req.body;
    if (!['RESOLVED', 'WAIVED'].includes(status)) {
      return errorResponse(res, 'Status must be RESOLVED or WAIVED', 400, 'VALIDATION_FAILED');
    }

    const officerName = req.user.full_name || req.user.username;

    db.prepare(`
      UPDATE fdr_discrepancies SET
        status = ?,
        resolved_by_id = ?,
        resolved_by_name = ?,
        resolved_at = CURRENT_TIMESTAMP,
        resolution_remarks = ?
      WHERE id = ?
    `).run(
      status,
      req.user.id,
      officerName,
      resolution_remarks ? resolution_remarks.trim() : 'Resolved by reviewing officer',
      disc.id
    );

    // Check if any open discrepancies remain for this FDR
    const remainingOpen = db.prepare(`
      SELECT COUNT(*) as count FROM fdr_discrepancies 
      WHERE fdr_id = ? AND status IN ('OPEN', 'INSTITUTION_RESPONDED')
    `).get(disc.fdr_id);

    if (remainingOpen.count === 0) {
      // Return FDR verification status to PENDING so it can be verified
      db.prepare(`
        UPDATE fdr_records SET 
          verification_status = 'PENDING',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(disc.fdr_id);
    }

    recordDocumentAudit({
      documentId: disc.fdr_id,
      institutionId: disc.institution_id,
      action: `FDR_DISCREPANCY_${status}`,
      performedById: req.user.id,
      performedByName: officerName,
      performedByRole: req.user.role,
      details: {
        discrepancyId: disc.id,
        resolution_remarks
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const updated = db.prepare('SELECT * FROM fdr_discrepancies WHERE id = ?').get(disc.id);
    return successResponse(res, updated, `Discrepancy marked as ${status}`);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
