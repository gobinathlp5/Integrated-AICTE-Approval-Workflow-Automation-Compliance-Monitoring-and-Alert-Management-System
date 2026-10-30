const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * GET /api/institutions/search/pid/:aicteId
 * Lookup institution by Permanent AICTE ID (PID)
 */
router.get('/search/pid/:aicteId', authenticateToken, (req, res) => {
  const { aicteId } = req.params;
  const inst = db.prepare('SELECT * FROM institutions WHERE aicte_id = ? OR code = ?').get(aicteId, aicteId);

  if (!inst) {
    return errorResponse(res, `No institution found with Permanent ID: ${aicteId}`, 404, 'NOT_FOUND');
  }

  // Tenant isolation: Institution users can only view their own PID record
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    if (req.user.institution_id !== inst.id) {
      return errorResponse(res, 'Access Denied: You cannot inspect another institution PID record.', 403, 'FORBIDDEN');
    }
  }

  return successResponse(res, {
    ...inst,
    programmes: inst.programmes_offered ? (typeof inst.programmes_offered === 'string' ? JSON.parse(inst.programmes_offered) : inst.programmes_offered) : []
  }, 'Institution located');
});

/**
 * GET /api/institutions
 * List institutions with filtering (region, state, type, status)
 */
router.get('/', authenticateToken, (req, res) => {
  const { region, state, status, search } = req.query;

  let query = 'SELECT * FROM institutions WHERE 1=1';
  const params = [];

  // Regional officer scope
  if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
    query += ' AND region = ?';
    params.push(req.user.region);
  } else if (region && region !== 'ALL') {
    query += ' AND region = ?';
    params.push(region);
  }

  // Institution tenant isolation
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    query += ' AND id = ?';
    params.push(req.user.institution_id);
  }

  if (state && state !== 'ALL') {
    query += ' AND state = ?';
    params.push(state);
  }

  if (status && status !== 'ALL') {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (name LIKE ? OR code LIKE ? OR aicte_id LIKE ? OR city LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY name ASC';
  const institutions = db.prepare(query).all(...params);

  return successResponse(res, institutions, 'Institutions retrieved');
});

/**
 * GET /api/institutions/:id
 * Retrieve comprehensive institutional profile, programmes, applications & compliance
 */
router.get('/:id', authenticateToken, (req, res) => {
  // Tenant check for institution users
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    if (req.user.institution_id !== req.params.id) {
      return errorResponse(res, 'Access Denied: Cross-institution profile inspection forbidden.', 403, 'FORBIDDEN');
    }
  }

  const inst = db.prepare('SELECT * FROM institutions WHERE id = ?').get(req.params.id);
  if (!inst) {
    return errorResponse(res, 'Institution not found', 404, 'NOT_FOUND');
  }

  const applications = db.prepare('SELECT * FROM applications WHERE institution_id = ? ORDER BY academic_year DESC').all(inst.id);
  const documents = db.prepare('SELECT * FROM documents WHERE institution_id = ? AND is_latest_version = 1').all(inst.id);
  const undertakings = db.prepare('SELECT * FROM undertakings WHERE institution_id = ?').all(inst.id);
  const obligations = db.prepare('SELECT * FROM compliance_obligations WHERE institution_id = ?').all(inst.id);
  const users = db.prepare('SELECT id, username, email, full_name, role, is_active, designation FROM users WHERE institution_id = ?').all(inst.id);

  let parsedProgrammes = [];
  const rawProg = inst.programmes_offered || inst.programmes_json;
  if (rawProg) {
    try {
      parsedProgrammes = typeof rawProg === 'string' ? JSON.parse(rawProg) : rawProg;
    } catch (e) {
      parsedProgrammes = [];
    }
  }

  const result = {
    ...inst,
    institution: {
      ...inst,
      programmes: parsedProgrammes
    },
    programmes_offered: parsedProgrammes,
    applications,
    documentsCount: documents.length,
    undertakingsCount: undertakings.length,
    obligations,
    authorizedUsers: users
  };

  return successResponse(res, result, 'Institution profile retrieved');
});

/**
 * PUT /api/institutions/:id
 * Update institution profile details
 */
router.put('/:id', authenticateToken, (req, res) => {
  if (req.user.role === ROLES.INSTITUTION_ADMIN && req.user.institution_id !== req.params.id) {
    return errorResponse(res, 'Cannot update other institutions.', 403, 'FORBIDDEN');
  }

  const {
    name, contact_person, contact_email, phone, contactPhone, hoi_name, hoiName,
    address, district, pincode, establishmentYear, programmes, land_area_acres, built_up_area_sqm
  } = req.body;

  const progStr = programmes ? (typeof programmes === 'string' ? programmes : JSON.stringify(programmes)) : null;

  db.prepare(`
    UPDATE institutions SET
      name = COALESCE(?, name),
      contact_person = COALESCE(?, contact_person),
      contact_email = COALESCE(?, contact_email),
      phone = COALESCE(?, ? , phone),
      hoi_name = COALESCE(?, ?, hoi_name),
      address = COALESCE(?, address),
      district = COALESCE(?, district),
      pincode = COALESCE(?, pincode),
      establishment_year = COALESCE(?, establishment_year),
      programmes_offered = COALESCE(?, programmes_offered),
      land_area_acres = COALESCE(?, land_area_acres),
      built_up_area_sqm = COALESCE(?, built_up_area_sqm)
    WHERE id = ?
  `).run(
    name, contact_person, contact_email,
    phone, contactPhone,
    hoi_name, hoiName,
    address, district, pincode, establishmentYear, progStr,
    land_area_acres, built_up_area_sqm,
    req.params.id
  );

  return successResponse(res, { institutionId: req.params.id }, 'Institutional profile updated.');
});

/**
 * POST /api/institutions/:id/verify
 */
router.post('/:id/verify', authenticateToken, (req, res) => {
  const canVerify = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER].includes(req.user.role);
  if (!canVerify) {
    return errorResponse(res, 'Permission Denied: Regional Officer or Admin authority required.', 403, 'FORBIDDEN');
  }

  db.prepare(`
    UPDATE institutions SET
      status = 'ACTIVE',
      verified = 1,
      verified_by = ?,
      verified_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user.full_name, req.params.id);

  createNotification({
    institutionId: req.params.id,
    title: 'Institution Registration Verified',
    message: 'Your institutional affiliation credentials have been formally verified by the AICTE Regional Directorate.',
    type: 'SUCCESS',
    link: '/dashboard'
  });

  return successResponse(res, { institutionId: req.params.id, status: 'ACTIVE' }, 'Institution verified and activated.');
});

module.exports = router;
