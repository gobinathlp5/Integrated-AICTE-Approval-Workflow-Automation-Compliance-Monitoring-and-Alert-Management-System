const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { recordDocumentAudit } = require('../audit');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Valid FDR statuses and instrument types
 */
const FDR_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  MATURING_SOON: 'MATURING_SOON',
  MATURED: 'MATURED',
  RENEWAL_DUE: 'RENEWAL_DUE',
  RENEWED: 'RENEWED',
  RELEASE_REQUESTED: 'RELEASE_REQUESTED',
  RELEASED: 'RELEASED',
  ENCASHED: 'ENCASHED',
  FORFEITED: 'FORFEITED',
  REJECTED: 'REJECTED'
};

const VERIFICATION_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  DISCREPANT: 'DISCREPANT',
  REJECTED: 'REJECTED'
};

/**
 * Helper to check institution access
 */
function checkInstitutionAccess(user, targetInstitutionId) {
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.AICTE_ADMIN || 
      user.role === ROLES.REGULATION_BUREAU || user.role === ROLES.REGIONAL_OFFICER || 
      user.role === ROLES.BUREAU_OFFICER || user.role === ROLES.AUDITOR ||
      user.role === ROLES.COMPETENT_AUTHORITY) {
    return true;
  }
  return user.institution_id === targetInstitutionId;
}

/**
 * GET /api/fdr/stats
 * Overview dashboard metrics with role/institution isolation
 */
router.get('/stats', authenticateToken, (req, res) => {
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

    const today = new Date().toISOString().split('T')[0];
    const in15Days = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const statsQuery = `
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(deposit_amount), 0) as total_deposit_value,
        SUM(CASE WHEN f.status = 'ACTIVE' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN f.verification_status = 'PENDING' THEN 1 ELSE 0 END) as pending_verification_count,
        SUM(CASE WHEN f.verification_status = 'DISCREPANT' THEN 1 ELSE 0 END) as discrepancy_count,
        SUM(CASE WHEN f.maturity_date < ? AND f.status NOT IN ('RELEASED', 'ENCASHED', 'FORFEITED') THEN 1 ELSE 0 END) as matured_count,
        SUM(CASE WHEN f.maturity_date >= ? AND f.maturity_date <= ? AND f.status NOT IN ('RELEASED', 'ENCASHED', 'FORFEITED') THEN 1 ELSE 0 END) as maturing_15_days,
        SUM(CASE WHEN f.maturity_date >= ? AND f.maturity_date <= ? AND f.status NOT IN ('RELEASED', 'ENCASHED', 'FORFEITED') THEN 1 ELSE 0 END) as maturing_30_days,
        SUM(CASE WHEN f.status = 'RELEASE_REQUESTED' THEN 1 ELSE 0 END) as release_requested_count,
        SUM(CASE WHEN f.status = 'RELEASED' THEN 1 ELSE 0 END) as released_count
      FROM fdr_records f
      LEFT JOIN institutions i ON f.institution_id = i.id
      WHERE ${whereClause}
    `;

    const stats = db.prepare(statsQuery).get(today, today, in15Days, today, in30Days, ...params);

    return successResponse(res, {
      total: stats.total_count || 0,
      totalDepositValue: stats.total_deposit_value || 0,
      active: stats.active_count || 0,
      pendingVerification: stats.pending_verification_count || 0,
      discrepant: stats.discrepancy_count || 0,
      matured: stats.matured_count || 0,
      maturing15Days: stats.maturing_15_days || 0,
      maturing30Days: stats.maturing_30_days || 0,
      releaseRequested: stats.release_requested_count || 0,
      released: stats.released_count || 0
    }, 'FDR statistics calculated successfully');
  } catch (err) {
    console.error('Error in /api/fdr/stats:', err);
    return errorResponse(res, 'Failed to compute FDR statistics: ' + err.message, 500);
  }
});

/**
 * GET /api/fdr
 * List FDR records with search, filters, pagination and strict tenant isolation
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    let whereClause = '1=1';
    const params = [];

    // Tenant / Region isolation
    if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
      whereClause += ' AND f.institution_id = ?';
      params.push(req.user.institution_id);
    } else if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
      whereClause += ' AND i.region = ?';
      params.push(req.user.region);
    }

    // Filter by status
    if (req.query.status) {
      whereClause += ' AND f.status = ?';
      params.push(req.query.status);
    }

    // Filter by verification status
    if (req.query.verification_status) {
      whereClause += ' AND f.verification_status = ?';
      params.push(req.query.verification_status);
    }

    // Filter by issuing bank
    if (req.query.issuing_bank) {
      whereClause += ' AND f.issuing_bank LIKE ?';
      params.push(`%${req.query.issuing_bank}%`);
    }

    // Filter by maturity approaching / matured
    const today = new Date().toISOString().split('T')[0];
    if (req.query.filter === 'MATURING_30') {
      const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      whereClause += ' AND f.maturity_date >= ? AND f.maturity_date <= ? AND f.status NOT IN (\'RELEASED\', \'ENCASHED\', \'FORFEITED\')';
      params.push(today, in30Days);
    } else if (req.query.filter === 'MATURED') {
      whereClause += ' AND f.maturity_date < ? AND f.status NOT IN (\'RELEASED\', \'ENCASHED\', \'FORFEITED\')';
      params.push(today);
    }

    // Search keyword across FDR number, bank name, institution name, IFSC
    if (req.query.search) {
      const kw = `%${req.query.search.trim()}%`;
      whereClause += ' AND (f.fdr_number LIKE ? OR f.issuing_bank LIKE ? OR f.ifsc_code LIKE ? OR i.name LIKE ? OR i.code LIKE ?)';
      params.push(kw, kw, kw, kw, kw);
    }

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM fdr_records f
      LEFT JOIN institutions i ON f.institution_id = i.id
      WHERE ${whereClause}
    `;
    const { total } = db.prepare(countQuery).get(...params);

    const listQuery = `
      SELECT f.*, 
             i.name as institution_name, 
             i.code as institution_code,
             i.region as institution_region,
             (SELECT COUNT(*) FROM fdr_documents d WHERE d.fdr_id = f.id) as documents_count,
             (SELECT COUNT(*) FROM fdr_discrepancies disc WHERE disc.fdr_id = f.id AND disc.status = 'OPEN') as open_discrepancies_count
      FROM fdr_records f
      LEFT JOIN institutions i ON f.institution_id = i.id
      WHERE ${whereClause}
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const records = db.prepare(listQuery).all(...params, limit, offset);

    return successResponse(res, {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, 'FDR records retrieved successfully');
  } catch (err) {
    console.error('Error in GET /api/fdr:', err);
    return errorResponse(res, 'Failed to fetch FDR records: ' + err.message, 500);
  }
});

/**
 * GET /api/fdr/:id
 * Retrieve detailed FDR record with all relational child data
 */
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const fdr = db.prepare(`
      SELECT f.*, 
             i.name as institution_name, 
             i.code as institution_code,
             i.region as institution_region,
             i.state as institution_state,
             i.city as institution_city
      FROM fdr_records f
      LEFT JOIN institutions i ON f.institution_id = i.id
      WHERE f.id = ?
    `).get(req.params.id);

    if (!fdr) {
      return errorResponse(res, 'FDR record not found', 404, 'NOT_FOUND');
    }

    // Access authorization check
    if (!checkInstitutionAccess(req.user, fdr.institution_id)) {
      return errorResponse(res, 'Access denied: You do not have permission to view this FDR record', 403, 'FORBIDDEN');
    }

    // Load child relations
    const documents = db.prepare(`
      SELECT * FROM fdr_documents WHERE fdr_id = ? ORDER BY uploaded_at DESC
    `).all(fdr.id);

    const verifications = db.prepare(`
      SELECT * FROM fdr_verifications WHERE fdr_id = ? ORDER BY created_at DESC
    `).all(fdr.id);

    const discrepancies = db.prepare(`
      SELECT * FROM fdr_discrepancies WHERE fdr_id = ? ORDER BY created_at DESC
    `).all(fdr.id);

    const renewals = db.prepare(`
      SELECT * FROM fdr_renewals WHERE original_fdr_id = ? OR replacement_fdr_id = ? ORDER BY created_at DESC
    `).all(fdr.id, fdr.id);

    const releaseRequests = db.prepare(`
      SELECT * FROM fdr_release_requests WHERE fdr_id = ? ORDER BY created_at DESC
    `).all(fdr.id);

    return successResponse(res, {
      ...fdr,
      documents,
      verifications,
      discrepancies,
      renewals,
      releaseRequests
    }, 'FDR details loaded successfully');
  } catch (err) {
    console.error('Error in GET /api/fdr/:id:', err);
    return errorResponse(res, 'Failed to load FDR record: ' + err.message, 500);
  }
});

/**
 * POST /api/fdr
 * Register a new FDR record
 */
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      fdr_number,
      institution_id,
      instrument_type = 'FIXED_DEPOSIT',
      issuing_bank,
      bank_branch,
      ifsc_code,
      bank_ref,
      deposit_amount,
      currency = 'INR',
      issue_date,
      maturity_date,
      deposit_holder,
      joint_holder_name = 'Regional Officer, AICTE',
      beneficiary = 'Member Secretary, AICTE',
      interest_rate,
      auto_renewal = 0,
      lien_marked = 1,
      lien_ref,
      purpose,
      remarks,
      status = 'PENDING_VERIFICATION'
    } = req.body;

    const targetInstitutionId = req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF
      ? req.user.institution_id
      : (institution_id || req.user.institution_id);

    if (!targetInstitutionId) {
      return errorResponse(res, 'Institution ID is required', 400, 'VALIDATION_FAILED');
    }

    if (!checkInstitutionAccess(req.user, targetInstitutionId)) {
      return errorResponse(res, 'Forbidden: Cannot create FDR for another institution', 403, 'FORBIDDEN');
    }

    // Required field validation
    if (!fdr_number || !fdr_number.trim()) {
      return errorResponse(res, 'FDR / Fixed Deposit Receipt number is required', 400, 'VALIDATION_FAILED');
    }
    if (!issuing_bank || !issuing_bank.trim()) {
      return errorResponse(res, 'Issuing Bank Name is required', 400, 'VALIDATION_FAILED');
    }
    if (!bank_branch || !bank_branch.trim()) {
      return errorResponse(res, 'Bank Branch is required', 400, 'VALIDATION_FAILED');
    }
    if (!ifsc_code || !ifsc_code.trim()) {
      return errorResponse(res, 'Bank IFSC Code is required', 400, 'VALIDATION_FAILED');
    }
    if (!deposit_amount || Number(deposit_amount) <= 0) {
      return errorResponse(res, 'Deposit amount must be a positive number', 400, 'VALIDATION_FAILED');
    }
    if (!issue_date || !maturity_date) {
      return errorResponse(res, 'Issue date and Maturity date are required', 400, 'VALIDATION_FAILED');
    }
    if (new Date(maturity_date) <= new Date(issue_date)) {
      return errorResponse(res, 'Maturity date must be strictly after Issue date', 400, 'VALIDATION_FAILED');
    }
    if (!purpose || !purpose.trim()) {
      return errorResponse(res, 'Purpose of Security Deposit is required', 400, 'VALIDATION_FAILED');
    }

    // Check for duplicate FDR number
    const existingFdr = db.prepare('SELECT id FROM fdr_records WHERE fdr_number = ?').get(fdr_number.trim());
    if (existingFdr) {
      return errorResponse(res, `FDR Number '${fdr_number.trim()}' is already registered in the system`, 409, 'DUPLICATE_FDR_NUMBER');
    }

    const id = uuidv4();
    const initialStatus = status === 'DRAFT' ? 'DRAFT' : 'PENDING_VERIFICATION';
    const verificationStatus = 'PENDING';

    const insertStmt = db.prepare(`
      INSERT INTO fdr_records (
        id, fdr_number, institution_id, instrument_type, issuing_bank,
        bank_branch, ifsc_code, bank_ref, deposit_amount, currency,
        issue_date, maturity_date, deposit_holder, joint_holder_name, beneficiary,
        interest_rate, auto_renewal, lien_marked, lien_ref, purpose,
        status, verification_status, remarks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    insertStmt.run(
      id,
      fdr_number.trim(),
      targetInstitutionId,
      instrument_type,
      issuing_bank.trim(),
      bank_branch.trim(),
      ifsc_code.trim().toUpperCase(),
      bank_ref ? bank_ref.trim() : null,
      Number(deposit_amount),
      currency,
      issue_date,
      maturity_date,
      (deposit_holder || '').trim() || 'Institution Trust / Society',
      joint_holder_name.trim(),
      beneficiary.trim(),
      interest_rate ? Number(interest_rate) : null,
      auto_renewal ? 1 : 0,
      lien_marked ? 1 : 0,
      lien_ref ? lien_ref.trim() : null,
      purpose.trim(),
      initialStatus,
      verificationStatus,
      remarks ? remarks.trim() : null
    );

    // Audit log
    recordDocumentAudit({
      documentId: id,
      institutionId: targetInstitutionId,
      action: 'FDR_REGISTERED',
      performedById: req.user.id,
      performedByName: req.user.full_name || req.user.username,
      performedByRole: req.user.role,
      details: {
        fdr_number: fdr_number.trim(),
        deposit_amount: Number(deposit_amount),
        issuing_bank: issuing_bank.trim(),
        maturity_date,
        status: initialStatus
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Notify Regional / Bureau Officers
    try {
      const inst = db.prepare('SELECT name, code FROM institutions WHERE id = ?').get(targetInstitutionId);
      db.prepare(`
        INSERT INTO notifications (id, role_target, institution_id, title, message, type, link)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        ROLES.REGIONAL_OFFICER,
        targetInstitutionId,
        'New FDR Deposit Registered',
        `Institution ${inst ? inst.name : ''} registered FDR No. ${fdr_number} (Amount: ₹${Number(deposit_amount).toLocaleString('en-IN')}) for verification.`,
        'INFO',
        `/fdr/${id}`
      );
    } catch (notifErr) {
      console.warn('Notification non-critical failure:', notifErr.message);
    }

    const createdRecord = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(id);
    return successResponse(res, createdRecord, 'FDR registered successfully', 201);
  } catch (err) {
    console.error('Error in POST /api/fdr:', err);
    return errorResponse(res, 'Failed to register FDR: ' + err.message, 500);
  }
});

/**
 * PUT /api/fdr/:id
 * Update FDR details (Allowed for DRAFT or PENDING_VERIFICATION)
 */
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const fdr = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(req.params.id);
    if (!fdr) {
      return errorResponse(res, 'FDR record not found', 404, 'NOT_FOUND');
    }

    if (!checkInstitutionAccess(req.user, fdr.institution_id)) {
      return errorResponse(res, 'Access denied', 403, 'FORBIDDEN');
    }

    if (fdr.status === 'ACTIVE' || fdr.status === 'RELEASED') {
      return errorResponse(res, `Cannot modify FDR in '${fdr.status}' state directly. Submit a renewal or release request.`, 400, 'STATE_LOCKED');
    }

    const {
      fdr_number,
      issuing_bank,
      bank_branch,
      ifsc_code,
      bank_ref,
      deposit_amount,
      issue_date,
      maturity_date,
      deposit_holder,
      joint_holder_name,
      beneficiary,
      interest_rate,
      auto_renewal,
      lien_marked,
      lien_ref,
      purpose,
      remarks
    } = req.body;

    if (maturity_date && issue_date && new Date(maturity_date) <= new Date(issue_date)) {
      return errorResponse(res, 'Maturity date must be after Issue date', 400, 'VALIDATION_FAILED');
    }

    db.prepare(`
      UPDATE fdr_records SET
        fdr_number = COALESCE(?, fdr_number),
        issuing_bank = COALESCE(?, issuing_bank),
        bank_branch = COALESCE(?, bank_branch),
        ifsc_code = COALESCE(?, ifsc_code),
        bank_ref = COALESCE(?, bank_ref),
        deposit_amount = COALESCE(?, deposit_amount),
        issue_date = COALESCE(?, issue_date),
        maturity_date = COALESCE(?, maturity_date),
        deposit_holder = COALESCE(?, deposit_holder),
        joint_holder_name = COALESCE(?, joint_holder_name),
        beneficiary = COALESCE(?, beneficiary),
        interest_rate = COALESCE(?, interest_rate),
        auto_renewal = COALESCE(?, auto_renewal),
        lien_marked = COALESCE(?, lien_marked),
        lien_ref = COALESCE(?, lien_ref),
        purpose = COALESCE(?, purpose),
        remarks = COALESCE(?, remarks),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      fdr_number ? fdr_number.trim() : null,
      issuing_bank ? issuing_bank.trim() : null,
      bank_branch ? bank_branch.trim() : null,
      ifsc_code ? ifsc_code.trim().toUpperCase() : null,
      bank_ref ? bank_ref.trim() : null,
      deposit_amount ? Number(deposit_amount) : null,
      issue_date || null,
      maturity_date || null,
      deposit_holder ? deposit_holder.trim() : null,
      joint_holder_name ? joint_holder_name.trim() : null,
      beneficiary ? beneficiary.trim() : null,
      interest_rate !== undefined ? Number(interest_rate) : null,
      auto_renewal !== undefined ? (auto_renewal ? 1 : 0) : null,
      lien_marked !== undefined ? (lien_marked ? 1 : 0) : null,
      lien_ref ? lien_ref.trim() : null,
      purpose ? purpose.trim() : null,
      remarks ? remarks.trim() : null,
      fdr.id
    );

    recordDocumentAudit({
      documentId: fdr.id,
      institutionId: fdr.institution_id,
      action: 'FDR_UPDATED',
      performedById: req.user.id,
      performedByName: req.user.full_name || req.user.username,
      performedByRole: req.user.role,
      details: { changes: req.body },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const updated = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(fdr.id);
    return successResponse(res, updated, 'FDR record updated successfully');
  } catch (err) {
    console.error('Error in PUT /api/fdr/:id:', err);
    return errorResponse(res, 'Failed to update FDR: ' + err.message, 500);
  }
});

/**
 * POST /api/fdr/:id/submit
 * Submit DRAFT FDR for formal verification
 */
router.post('/:id/submit', authenticateToken, (req, res) => {
  try {
    const fdr = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(req.params.id);
    if (!fdr) {
      return errorResponse(res, 'FDR record not found', 404, 'NOT_FOUND');
    }

    if (!checkInstitutionAccess(req.user, fdr.institution_id)) {
      return errorResponse(res, 'Access denied', 403, 'FORBIDDEN');
    }

    // Check if at least 1 document (FDR scan) is uploaded
    const docs = db.prepare('SELECT COUNT(*) as count FROM fdr_documents WHERE fdr_id = ?').get(fdr.id);
    if (!docs || docs.count === 0) {
      return errorResponse(res, 'At least one mandatory document (FDR Scan / Receipt) must be uploaded before submission', 400, 'DOCUMENT_REQUIRED');
    }

    db.prepare(`
      UPDATE fdr_records SET 
        status = 'PENDING_VERIFICATION',
        verification_status = 'PENDING',
        submission_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(fdr.id);

    recordDocumentAudit({
      documentId: fdr.id,
      institutionId: fdr.institution_id,
      action: 'FDR_SUBMITTED_FOR_VERIFICATION',
      performedById: req.user.id,
      performedByName: req.user.full_name || req.user.username,
      performedByRole: req.user.role,
      details: { fdr_number: fdr.fdr_number },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const updated = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(fdr.id);
    return successResponse(res, updated, 'FDR submitted for verification successfully');
  } catch (err) {
    console.error('Error in POST /api/fdr/:id/submit:', err);
    return errorResponse(res, 'Failed to submit FDR: ' + err.message, 500);
  }
});

/**
 * GET /api/fdr/:id/history
 * Audit trail for this FDR
 */
router.get('/:id/history', authenticateToken, (req, res) => {
  try {
    const fdr = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(req.params.id);
    if (!fdr) {
      return errorResponse(res, 'FDR record not found', 404, 'NOT_FOUND');
    }

    if (!checkInstitutionAccess(req.user, fdr.institution_id)) {
      return errorResponse(res, 'Access denied', 403, 'FORBIDDEN');
    }

    const trail = db.prepare(`
      SELECT * FROM document_audit_trail 
      WHERE document_id = ? 
      ORDER BY id DESC
    `).all(fdr.id);

    return successResponse(res, trail, 'FDR history retrieved');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
