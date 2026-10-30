const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Common handler for obligations listing
 */
function handleGetObligations(req, res) {
  let query = `
    SELECT c.*, i.name as institution_name, i.code as institution_code,
           doc.title as evidence_doc_title, doc.document_number as evidence_doc_number
    FROM compliance_obligations c
    JOIN institutions i ON c.institution_id = i.id
    LEFT JOIN documents doc ON c.evidence_doc_id = doc.id
    WHERE 1=1
  `;
  const params = [];

  // Institution tenant isolation
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    query += ` AND c.institution_id = ?`;
    params.push(req.user.institution_id);
  } else if (req.params.institutionId) {
    query += ` AND c.institution_id = ?`;
    params.push(req.params.institutionId);
  }

  query += ` ORDER BY c.due_date ASC`;
  const obligations = db.prepare(query).all(...params);

  const now = new Date();
  const enriched = obligations.map(o => {
    const dueDate = new Date(o.due_date);
    const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    let statusCategory = o.status;
    if (diffDays < 0 && o.status === 'PENDING') {
      statusCategory = 'OVERDUE';
    } else if (diffDays <= 30 && o.status === 'PENDING') {
      statusCategory = 'DUE_SOON';
    }
    return {
      ...o,
      days_remaining: diffDays,
      computed_state: statusCategory
    };
  });

  return successResponse(res, enriched, 'Compliance obligations retrieved');
}

router.get('/obligations', authenticateToken, handleGetObligations);
router.get('/obligations/:institutionId', authenticateToken, handleGetObligations);

/**
 * Common handler for compliance scorecard / summary
 */
function handleGetScorecard(req, res) {
  const targetId = req.params.institutionId || req.user.institution_id || 'inst_delhi_001';

  // Tenant isolation check
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    if (req.user.institution_id && req.user.institution_id !== targetId) {
      return errorResponse(res, 'Cross-tenant violation: Cannot view another institution compliance scorecard.', 403, 'FORBIDDEN');
    }
  }

  const inst = db.prepare('SELECT * FROM institutions WHERE id = ?').get(targetId);
  if (!inst) {
    return errorResponse(res, 'Institution not found', 404, 'NOT_FOUND');
  }

  const obligations = db.prepare('SELECT * FROM compliance_obligations WHERE institution_id = ?').all(inst.id);

  const total = obligations.length;
  const verified = obligations.filter(o => o.status === 'VERIFIED' || o.status === 'COMPLIANT').length;
  const pending = obligations.filter(o => o.status === 'PENDING' || o.status === 'SUBMITTED').length;
  const overdue = obligations.filter(o => new Date(o.due_date) < new Date() && o.status !== 'VERIFIED' && o.status !== 'COMPLIANT').length;

  const score = total > 0 ? Math.round((verified / total) * 100) : (inst.compliance_score || 85);

  const result = {
    institutionId: inst.id,
    institutionName: inst.name,
    compliancePercentage: score,
    complianceScore: score,
    totalObligations: total,
    compliantCount: verified,
    verifiedCount: verified,
    pendingCount: pending,
    overdueCount: overdue,
    grade: score >= 90 ? 'A+ (Exemplary)' : score >= 75 ? 'A (Compliant)' : 'B (Action Required)'
  };

  return successResponse(res, result, 'Scorecard retrieved');
}

router.get('/summary/:institutionId', authenticateToken, handleGetScorecard);
router.get('/scorecard/:institutionId', authenticateToken, handleGetScorecard);

/**
 * Common handler for submitting evidence
 */
function handleSubmitEvidence(req, res) {
  const { evidenceDocId, documentId, evidenceNotes } = req.body;
  const oblId = req.params.id;

  const ob = db.prepare('SELECT * FROM compliance_obligations WHERE id = ?').get(oblId);
  if (!ob) {
    return errorResponse(res, 'Compliance obligation not found', 404, 'NOT_FOUND');
  }

  // Tenant isolation check
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    if (ob.institution_id !== req.user.institution_id) {
      return errorResponse(res, 'Cross-tenant violation: Cannot submit evidence for another institution obligation.', 403, 'FORBIDDEN');
    }
  }

  const docId = evidenceDocId || documentId || null;
  const notes = evidenceNotes || '';

  db.prepare(`
    UPDATE compliance_obligations SET
      evidence_doc_id = COALESCE(?, evidence_doc_id),
      evidence_notes = ?,
      status = 'SUBMITTED',
      submitted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(docId, notes, ob.id);

  createNotification({
    roleTarget: ROLES.REGULATION_BUREAU,
    title: 'Compliance Evidence Filed',
    message: `Institution submitted evidence for compliance obligation "${ob.title}".`,
    type: 'INFO',
    link: '/compliance'
  });

  return successResponse(res, { obligationId: ob.id, status: 'SUBMITTED' }, 'Evidence submitted for Bureau verification.');
}

router.post('/obligations/:id/submit-evidence', authenticateToken, handleSubmitEvidence);
router.post('/obligations/:id/submit', authenticateToken, handleSubmitEvidence);

/**
 * Common handler for reviewing evidence
 */
function handleReviewEvidence(req, res) {
  const status = req.body.status || 'COMPLIANT';
  const reviewNotes = req.body.reviewNotes || req.body.remarks || '';
  const oblId = req.params.id;

  const canReview = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGULATION_BUREAU, ROLES.BUREAU_OFFICER, ROLES.REGIONAL_OFFICER, ROLES.SCRUTINY_OFFICER].includes(req.user.role);
  if (!canReview) {
    return errorResponse(res, 'User role not authorized to review compliance evidence.', 403, 'FORBIDDEN');
  }

  const ob = db.prepare('SELECT * FROM compliance_obligations WHERE id = ?').get(oblId);
  if (!ob) {
    return errorResponse(res, 'Compliance obligation not found', 404, 'NOT_FOUND');
  }

  const finalStatus = (status === 'COMPLIANT' || status === 'VERIFIED') ? 'COMPLIANT' : 'PENDING';

  db.prepare(`
    UPDATE compliance_obligations SET
      status = ?,
      verified_by = ?,
      verified_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(finalStatus, req.user.full_name, ob.id);

  return successResponse(res, { obligationId: ob.id, status: finalStatus }, `Compliance status updated to [${finalStatus}].`);
}

router.post('/obligations/:id/verify', authenticateToken, handleReviewEvidence);
router.post('/obligations/:id/review', authenticateToken, handleReviewEvidence);

module.exports = router;
