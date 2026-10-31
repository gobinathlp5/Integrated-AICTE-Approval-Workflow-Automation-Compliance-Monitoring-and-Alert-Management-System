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
 * GET /api/fdr-renewals/due
 * List FDRs requiring renewal (maturing within 60 days or matured)
 */
router.get('/due', authenticateToken, (req, res) => {
  try {
    let whereClause = '1=1';
    const params = [];

    if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
      whereClause += ' AND f.institution_id = ?';
      params.push(req.user.institution_id);
    } else if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
      whereClause += ' AND i.region = ?';
      params.push(req.user.region);
    }

    const in60Days = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
    whereClause += ' AND f.maturity_date <= ? AND f.status NOT IN (\'RELEASED\', \'ENCASHED\', \'FORFEITED\', \'RENEWED\')';
    params.push(in60Days);

    const query = `
      SELECT f.*, 
             i.name as institution_name, 
             i.code as institution_code,
             i.region as institution_region,
             (SELECT COUNT(*) FROM fdr_renewals r WHERE r.original_fdr_id = f.id AND r.status = 'SUBMITTED') as pending_renewals_count
      FROM fdr_records f
      LEFT JOIN institutions i ON f.institution_id = i.id
      WHERE ${whereClause}
      ORDER BY f.maturity_date ASC
    `;

    const records = db.prepare(query).all(...params);
    return successResponse(res, records, 'FDR renewal candidates loaded');
  } catch (err) {
    console.error('Error in /api/fdr-renewals/due:', err);
    return errorResponse(res, err.message, 500);
  }
});

/**
 * GET /api/fdr-renewals
 * List renewal applications
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    let whereClause = '1=1';
    const params = [];

    if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
      whereClause += ' AND r.institution_id = ?';
      params.push(req.user.institution_id);
    } else if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
      whereClause += ' AND i.region = ?';
      params.push(req.user.region);
    }

    const query = `
      SELECT r.*,
             orig.fdr_number as original_fdr_number,
             orig.deposit_amount as original_deposit_amount,
             orig.issuing_bank as original_issuing_bank,
             orig.maturity_date as original_maturity_date,
             rep.fdr_number as replacement_fdr_number,
             rep.deposit_amount as replacement_deposit_amount,
             rep.issuing_bank as replacement_issuing_bank,
             i.name as institution_name,
             i.code as institution_code
      FROM fdr_renewals r
      JOIN fdr_records orig ON r.original_fdr_id = orig.id
      LEFT JOIN fdr_records rep ON r.replacement_fdr_id = rep.id
      JOIN institutions i ON r.institution_id = i.id
      WHERE ${whereClause}
      ORDER BY r.created_at DESC
    `;

    const renewals = db.prepare(query).all(...params);
    return successResponse(res, renewals, 'Renewal requests retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * POST /api/fdr-renewals/:fdrId/submit
 * Institution submits renewal or replacement request
 */
router.post('/:fdrId/submit', authenticateToken, (req, res) => {
  try {
    const fdr = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(req.params.fdrId);
    if (!fdr) {
      return errorResponse(res, 'Original FDR not found', 404, 'NOT_FOUND');
    }

    if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
      if (req.user.institution_id !== fdr.institution_id) {
        return errorResponse(res, 'Access denied', 403, 'FORBIDDEN');
      }
    }

    const {
      renewal_type = 'SAME_FDR_EXTENDED', // SAME_FDR_EXTENDED or NEW_FDR_REPLACEMENT
      extended_maturity_date,
      replacement_fdr_id,
      remarks
    } = req.body;

    if (renewal_type === 'SAME_FDR_EXTENDED') {
      if (!extended_maturity_date) {
        return errorResponse(res, 'Extended maturity date is required for same FDR extension', 400, 'VALIDATION_FAILED');
      }
      if (new Date(extended_maturity_date) <= new Date(fdr.maturity_date)) {
        return errorResponse(res, 'Extended maturity date must be after current maturity date', 400, 'VALIDATION_FAILED');
      }
    } else if (renewal_type === 'NEW_FDR_REPLACEMENT') {
      if (!replacement_fdr_id) {
        return errorResponse(res, 'Replacement FDR ID must be specified', 400, 'VALIDATION_FAILED');
      }
      const repFdr = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(replacement_fdr_id);
      if (!repFdr) {
        return errorResponse(res, 'Replacement FDR record not found', 404, 'NOT_FOUND');
      }
      if (repFdr.institution_id !== fdr.institution_id) {
        return errorResponse(res, 'Replacement FDR must belong to the same institution', 400, 'VALIDATION_FAILED');
      }
    }

    const renewalId = uuidv4();
    const userName = req.user.full_name || req.user.username;

    db.prepare(`
      INSERT INTO fdr_renewals (
        id, original_fdr_id, replacement_fdr_id, institution_id,
        renewal_type, requested_by, requested_by_name, status,
        remarks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, CURRENT_TIMESTAMP)
    `).run(
      renewalId,
      fdr.id,
      replacement_fdr_id || null,
      fdr.institution_id,
      renewal_type,
      req.user.id,
      userName,
      remarks ? `${remarks.trim()}${extended_maturity_date ? ` (Requested New Maturity: ${extended_maturity_date})` : ''}` : (extended_maturity_date ? `Requested New Maturity: ${extended_maturity_date}` : null)
    );

    // Update original FDR status
    db.prepare(`
      UPDATE fdr_records SET status = 'RENEWAL_DUE', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(fdr.id);

    // If replacement FDR provided, mark it as replacement
    if (replacement_fdr_id) {
      db.prepare(`
        UPDATE fdr_records SET is_replacement = 1, original_fdr_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(fdr.id, replacement_fdr_id);
    }

    recordDocumentAudit({
      documentId: fdr.id,
      institutionId: fdr.institution_id,
      action: 'FDR_RENEWAL_REQUESTED',
      performedById: req.user.id,
      performedByName: userName,
      performedByRole: req.user.role,
      details: {
        renewalId,
        renewal_type,
        extended_maturity_date,
        replacement_fdr_id
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const renewalRecord = db.prepare('SELECT * FROM fdr_renewals WHERE id = ?').get(renewalId);
    return successResponse(res, renewalRecord, 'Renewal request submitted successfully', 201);
  } catch (err) {
    console.error('Error submitting renewal request:', err);
    return errorResponse(res, err.message, 500);
  }
});

/**
 * POST /api/fdr-renewals/:renewalId/review
 * AICTE Officer approves or rejects renewal request
 */
router.post('/:renewalId/review', authenticateToken, (req, res) => {
  try {
    if (!isOfficerRole(req.user.role)) {
      return errorResponse(res, 'Only AICTE Officers can review renewal requests', 403, 'FORBIDDEN');
    }

    const renewal = db.prepare('SELECT * FROM fdr_renewals WHERE id = ?').get(req.params.renewalId);
    if (!renewal) {
      return errorResponse(res, 'Renewal request not found', 404, 'NOT_FOUND');
    }

    const { decision, new_maturity_date, review_remarks } = req.body;
    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return errorResponse(res, 'Decision must be APPROVED or REJECTED', 400, 'VALIDATION_FAILED');
    }

    const officerName = req.user.full_name || req.user.username;

    db.prepare(`
      UPDATE fdr_renewals SET
        status = ?,
        review_decision = ?,
        reviewed_by_id = ?,
        reviewed_by_name = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        remarks = COALESCE(?, remarks)
      WHERE id = ?
    `).run(
      decision,
      decision,
      req.user.id,
      officerName,
      review_remarks || null,
      renewal.id
    );

    const origFdr = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(renewal.original_fdr_id);

    if (decision === 'APPROVED') {
      if (renewal.renewal_type === 'SAME_FDR_EXTENDED') {
        const matDate = new_maturity_date || (renewal.remarks && renewal.remarks.match(/Requested New Maturity: (\d{4}-\d{2}-\d{2})/) ? renewal.remarks.match(/Requested New Maturity: (\d{4}-\d{2}-\d{2})/)[1] : null);
        db.prepare(`
          UPDATE fdr_records SET
            status = 'ACTIVE',
            maturity_date = COALESCE(?, maturity_date),
            verification_status = 'VERIFIED',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(matDate, renewal.original_fdr_id);
      } else if (renewal.renewal_type === 'NEW_FDR_REPLACEMENT' && renewal.replacement_fdr_id) {
        // Mark original as RENEWED and link to replacement
        db.prepare(`
          UPDATE fdr_records SET
            status = 'RENEWED',
            replacement_fdr_id = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(renewal.replacement_fdr_id, renewal.original_fdr_id);

        // Activate replacement FDR
        db.prepare(`
          UPDATE fdr_records SET
            status = 'ACTIVE',
            verification_status = 'VERIFIED',
            original_fdr_id = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(renewal.original_fdr_id, renewal.replacement_fdr_id);
      }
    } else {
      // If rejected, revert status to ACTIVE or MATURED based on date
      const today = new Date().toISOString().split('T')[0];
      const revertedStatus = origFdr.maturity_date < today ? 'MATURED' : 'ACTIVE';
      db.prepare(`
        UPDATE fdr_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(revertedStatus, renewal.original_fdr_id);
    }

    recordDocumentAudit({
      documentId: renewal.original_fdr_id,
      institutionId: renewal.institution_id,
      action: `FDR_RENEWAL_${decision}`,
      performedById: req.user.id,
      performedByName: officerName,
      performedByRole: req.user.role,
      details: {
        renewalId: renewal.id,
        decision,
        review_remarks
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const updatedRenewal = db.prepare('SELECT * FROM fdr_renewals WHERE id = ?').get(renewal.id);
    return successResponse(res, updatedRenewal, `Renewal request ${decision.toLowerCase()} successfully`);
  } catch (err) {
    console.error('Error reviewing renewal:', err);
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
