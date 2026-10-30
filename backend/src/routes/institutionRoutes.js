const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');

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

  // Institution tenant isolation: institution users only see their own institution
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
    query += ' AND (name LIKE ? OR code LIKE ? OR city LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY name ASC';
  const institutions = db.prepare(query).all(...params);

  return res.json({
    total: institutions.length,
    institutions: institutions.map(i => ({
      ...i,
      programmes: i.programmes_json ? JSON.parse(i.programmes_json) : []
    }))
  });
});

/**
 * GET /api/institutions/:id
 * Retrieve comprehensive institutional profile, programmes, applications & compliance
 */
router.get('/:id', authenticateToken, (req, res) => {
  // Tenant check for institution users
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    if (req.user.institution_id !== req.params.id) {
      return res.status(403).json({ error: 'Access Denied: Cross-institution profile inspection forbidden.' });
    }
  }

  const inst = db.prepare('SELECT * FROM institutions WHERE id = ?').get(req.params.id);
  if (!inst) {
    return res.status(404).json({ error: 'Institution not found' });
  }

  const applications = db.prepare('SELECT * FROM applications WHERE institution_id = ? ORDER BY academic_year DESC').all(inst.id);
  const documents = db.prepare('SELECT * FROM documents WHERE institution_id = ? AND is_latest_version = 1').all(inst.id);
  const undertakings = db.prepare('SELECT * FROM undertakings WHERE institution_id = ?').all(inst.id);
  const obligations = db.prepare('SELECT * FROM compliance_obligations WHERE institution_id = ?').all(inst.id);
  const users = db.prepare('SELECT id, username, email, full_name, role, is_active, designation FROM users WHERE institution_id = ?').all(inst.id);

  return res.json({
    institution: {
      ...inst,
      programmes: inst.programmes_json ? JSON.parse(inst.programmes_json) : []
    },
    applications,
    documentsCount: documents.length,
    undertakingsCount: undertakings.length,
    obligations,
    authorizedUsers: users
  });
});

/**
 * PUT /api/institutions/:id
 * Update institution profile details
 */
router.put('/:id', authenticateToken, (req, res) => {
  // Check authorization
  if (req.user.role === ROLES.INSTITUTION_ADMIN && req.user.institution_id !== req.params.id) {
    return res.status(403).json({ error: 'Cannot update other institutions.' });
  }

  const {
    name, contactEmail, contactPhone, hoiName, hoiDesignation,
    address, district, pincode, establishmentYear, programmes
  } = req.body;

  const progStr = programmes ? (typeof programmes === 'string' ? programmes : JSON.stringify(programmes)) : null;

  db.prepare(`
    UPDATE institutions SET
      name = COALESCE(?, name),
      contact_email = COALESCE(?, contact_email),
      contact_phone = COALESCE(?, contact_phone),
      hoi_name = COALESCE(?, hoi_name),
      hoi_designation = COALESCE(?, hoi_designation),
      address = COALESCE(?, address),
      district = COALESCE(?, district),
      pincode = COALESCE(?, pincode),
      establishment_year = COALESCE(?, establishment_year),
      programmes_json = COALESCE(?, programmes_json)
    WHERE id = ?
  `).run(name, contactEmail, contactPhone, hoiName, hoiDesignation, address, district, pincode, establishmentYear, progStr, req.params.id);

  return res.json({ success: true, message: 'Institutional profile updated.' });
});

/**
 * POST /api/institutions/:id/verify
 * Regional Officer or Admin verifies new institution registration
 */
router.post('/:id/verify', authenticateToken, (req, res) => {
  const canVerify = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER].includes(req.user.role);
  if (!canVerify) {
    return res.status(403).json({ error: 'Permission Denied: Regional Officer or Admin authority required.' });
  }

  db.prepare(`
    UPDATE institutions SET
      status = 'ACTIVE',
      verified_by_officer_id = ?,
      verified_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user.id, req.params.id);

  createNotification({
    institutionId: req.params.id,
    title: 'Institution Registration Verified',
    message: 'Your institutional affiliation credentials have been formally verified by the AICTE Regional Directorate.',
    type: 'SUCCESS',
    link: '/dashboard'
  });

  return res.json({ success: true, message: 'Institution verified and activated.' });
});

module.exports = router;
