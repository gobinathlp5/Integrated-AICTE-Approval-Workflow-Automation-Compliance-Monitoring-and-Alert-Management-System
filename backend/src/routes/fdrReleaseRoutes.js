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

function isAuthorityRole(role) {
  return [
    ROLES.COMPETENT_AUTHORITY,
    ROLES.SUPER_ADMIN,
    ROLES.AICTE_ADMIN
  ].includes(role);
}

/**
 * GET /api/fdr-releases
 * List release and refund applications
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    let whereClause = '1=1';
    const params = [];

    if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
      whereClause += ' AND rel.institution_id = ?';
      params.push(req.user.institution_id);
    } else if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
      whereClause += ' AND i.region = ?';
      params.push(req.user.region);
    }

    const query = `
      SELECT rel.*,
             f.fdr_number,
             f.deposit_amount,
             f.issuing_bank,
             f.maturity_date,
             f.purpose as fdr_purpose,
             i.name as institution_name,
             i.code as institution_code,
             i.region as institution_region
      FROM fdr_release_requests rel
      JOIN fdr_records f ON rel.fdr_id = f.id
      JOIN institutions i ON rel.institution_id = i.id
      WHERE ${whereClause}
      ORDER BY rel.created_at DESC
    `;

    const records = db.prepare(query).all(...params);
    return successResponse(res, records, 'FDR release requests loaded');
  } catch (err) {
    console.error('Error in GET /api/fdr-releases:', err);
    return errorResponse(res, err.message, 500);
  }
});

/**
 * POST /api/fdr-releases/:fdrId/request
 * Institution submits request for release/refund
 */
router.post('/:fdrId/request', authenticateToken, (req, res) => {
  try {
    const fdr = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(req.params.fdrId);
    if (!fdr) {
      return errorResponse(res, 'FDR not found', 404, 'NOT_FOUND');
    }

    if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
      if (req.user.institution_id !== fdr.institution_id) {
        return errorResponse(res, 'Access denied', 403, 'FORBIDDEN');
      }
    }

    if (fdr.status === 'RELEASED') {
      return errorResponse(res, 'This FDR has already been released', 400, 'ALREADY_RELEASED');
    }

    const {
      reason = 'TENURE_COMPLETED',
      justification,
      supporting_document_id
    } = req.body;

    if (!justification || !justification.trim()) {
      return errorResponse(res, 'Justification statement is required for FDR release', 400, 'VALIDATION_FAILED');
    }

    const requestId = uuidv4();
    const requestNumber = 'REL-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 900 + 100);
    const userName = req.user.full_name || req.user.username;

    db.prepare(`
      INSERT INTO fdr_release_requests (
        id, fdr_id, institution_id, request_number, reason,
        supporting_document_id, requested_by_id, requested_by_name,
        status, review_notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?, CURRENT_TIMESTAMP)
    `).run(
      requestId,
      fdr.id,
      fdr.institution_id,
      requestNumber,
      reason,
      supporting_document_id || null,
      req.user.id,
      userName,
      justification.trim()
    );

    // Update FDR status
    db.prepare(`
      UPDATE fdr_records SET status = 'RELEASE_REQUESTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(fdr.id);

    recordDocumentAudit({
      documentId: fdr.id,
      institutionId: fdr.institution_id,
      action: 'FDR_RELEASE_REQUESTED',
      performedById: req.user.id,
      performedByName: userName,
      performedByRole: req.user.role,
      details: {
        requestId,
        requestNumber,
        reason,
        deposit_amount: fdr.deposit_amount
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const created = db.prepare('SELECT * FROM fdr_release_requests WHERE id = ?').get(requestId);
    return successResponse(res, created, 'Release request submitted successfully', 201);
  } catch (err) {
    console.error('Error in release request:', err);
    return errorResponse(res, err.message, 500);
  }
});

/**
 * POST /api/fdr-releases/:requestId/scrutiny
 * Officer conducts technical scrutiny of release request
 */
router.post('/:requestId/scrutiny', authenticateToken, (req, res) => {
  try {
    if (!isOfficerRole(req.user.role)) {
      return errorResponse(res, 'Only AICTE Officers can scrutinize release requests', 403, 'FORBIDDEN');
    }

    const rel = db.prepare('SELECT * FROM fdr_release_requests WHERE id = ?').get(req.params.requestId);
    if (!rel) {
      return errorResponse(res, 'Release request not found', 404, 'NOT_FOUND');
    }

    const { review_notes, recommendation } = req.body;
    const officerName = req.user.full_name || req.user.username;

    db.prepare(`
      UPDATE fdr_release_requests SET
        status = 'UNDER_SCRUTINY',
        review_officer_id = ?,
        review_officer_name = ?,
        review_notes = COALESCE(?, review_notes)
      WHERE id = ?
    `).run(
      req.user.id,
      officerName,
      review_notes ? `${review_notes} (Recommendation: ${recommendation || 'Proceed to Authority'})` : null,
      rel.id
    );

    recordDocumentAudit({
      documentId: rel.fdr_id,
      institutionId: rel.institution_id,
      action: 'FDR_RELEASE_SCRUTINIZED',
      performedById: req.user.id,
      performedByName: officerName,
      performedByRole: req.user.role,
      details: { requestId: rel.id, recommendation, review_notes },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const updated = db.prepare('SELECT * FROM fdr_release_requests WHERE id = ?').get(rel.id);
    return successResponse(res, updated, 'Release request scrutiny recorded');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * POST /api/fdr-releases/:requestId/decision
 * Competent Authority approves or rejects release request
 */
router.post('/:requestId/decision', authenticateToken, (req, res) => {
  try {
    if (!isAuthorityRole(req.user.role)) {
      return errorResponse(res, 'Only Competent Authority or Super Admin can issue release orders', 403, 'FORBIDDEN');
    }

    const rel = db.prepare('SELECT * FROM fdr_release_requests WHERE id = ?').get(req.params.requestId);
    if (!rel) {
      return errorResponse(res, 'Release request not found', 404, 'NOT_FOUND');
    }

    const { decision, decision_remarks } = req.body;
    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return errorResponse(res, 'Decision must be APPROVED or REJECTED', 400, 'VALIDATION_FAILED');
    }

    const caStatus = decision === 'APPROVED' ? 'CA_APPROVED' : 'CA_REJECTED';
    const authorityName = req.user.full_name || req.user.username;

    db.prepare(`
      UPDATE fdr_release_requests SET
        status = ?,
        decision = ?,
        decision_maker_id = ?,
        decision_maker_name = ?,
        decision_remarks = ?,
        decision_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      caStatus,
      decision,
      req.user.id,
      authorityName,
      decision_remarks || 'Approved by Competent Authority',
      rel.id
    );

    if (decision === 'REJECTED') {
      db.prepare(`
        UPDATE fdr_records SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(rel.fdr_id);
    }

    recordDocumentAudit({
      documentId: rel.fdr_id,
      institutionId: rel.institution_id,
      action: `FDR_RELEASE_CA_${decision}`,
      performedById: req.user.id,
      performedByName: authorityName,
      performedByRole: req.user.role,
      details: { requestId: rel.id, decision, decision_remarks },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const updated = db.prepare('SELECT * FROM fdr_release_requests WHERE id = ?').get(rel.id);
    return successResponse(res, updated, `Release request ${decision.toLowerCase()} by Competent Authority`);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * POST /api/fdr-releases/:requestId/complete
 * Complete release process after bank lien removal
 */
router.post('/:requestId/complete', authenticateToken, (req, res) => {
  try {
    if (!isOfficerRole(req.user.role)) {
      return errorResponse(res, 'Only AICTE Officers can finalize release orders', 403, 'FORBIDDEN');
    }

    const rel = db.prepare('SELECT * FROM fdr_release_requests WHERE id = ?').get(req.params.requestId);
    if (!rel) {
      return errorResponse(res, 'Release request not found', 404, 'NOT_FOUND');
    }

    if (rel.status !== 'CA_APPROVED') {
      return errorResponse(res, 'Cannot finalize release without prior Competent Authority approval', 400, 'APPROVAL_REQUIRED');
    }

    const { release_evidence_doc_id, completion_notes } = req.body;
    const officerName = req.user.full_name || req.user.username;

    db.prepare(`
      UPDATE fdr_release_requests SET
        status = 'RELEASE_COMPLETED',
        release_evidence_doc_id = ?,
        release_completed_by = ?,
        release_completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      release_evidence_doc_id || null,
      officerName,
      rel.id
    );

    // Finalize FDR record to RELEASED
    db.prepare(`
      UPDATE fdr_records SET
        status = 'RELEASED',
        lien_marked = 0,
        remarks = COALESCE(?, remarks),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      completion_notes ? `Released: ${completion_notes}` : 'Lien revoked and security deposit released',
      rel.fdr_id
    );

    recordDocumentAudit({
      documentId: rel.fdr_id,
      institutionId: rel.institution_id,
      action: 'FDR_RELEASE_COMPLETED',
      performedById: req.user.id,
      performedByName: officerName,
      performedByRole: req.user.role,
      details: { requestId: rel.id, completion_notes },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const updated = db.prepare('SELECT * FROM fdr_release_requests WHERE id = ?').get(rel.id);
    return successResponse(res, updated, 'FDR release executed and lien successfully removed');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
