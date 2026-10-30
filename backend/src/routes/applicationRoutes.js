const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES, PERMISSIONS, hasPermission } = require('../rbac');
const { authenticateToken } = require('../auth');

/**
 * GET /api/applications
 * List applications with multi-tenant data isolation
 */
router.get('/', authenticateToken, (req, res) => {
  let query = `
    SELECT a.*, i.name as institution_name, i.code as institution_code,
           u_sc.full_name as scrutiny_officer_name,
           c.name as committee_name, c.code as committee_code
    FROM applications a
    LEFT JOIN institutions i ON a.institution_id = i.id
    LEFT JOIN users u_sc ON a.assigned_scrutiny_officer_id = u_sc.id
    LEFT JOIN evc_committees c ON a.assigned_evc_committee_id = c.id
    WHERE 1=1
  `;
  const params = [];

  // Institution isolation
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    query += ` AND a.institution_id = ?`;
    params.push(req.user.institution_id);
  }

  // Region isolation for Regional Officer
  if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
    query += ` AND a.region = ?`;
    params.push(req.user.region);
  }

  // Assignment isolation for Scrutiny Officer
  if (req.user.role === ROLES.SCRUTINY_OFFICER) {
    query += ` AND (a.assigned_scrutiny_officer_id = ? OR a.assigned_scrutiny_officer_id IS NULL)`;
    params.push(req.user.id);
  }

  // Assignment isolation for EVC Member
  if (req.user.role === ROLES.EVC_MEMBER) {
    query += ` AND a.id IN (
      SELECT c2.application_id FROM evc_committees c2
      JOIN evc_committee_members cm2 ON c2.id = cm2.committee_id
      WHERE cm2.user_id = ?
    )`;
    params.push(req.user.id);
  }

  query += ` ORDER BY a.created_at DESC`;
  const applications = db.prepare(query).all(...params);

  return res.json({
    total: applications.length,
    applications
  });
});

/**
 * POST /api/applications
 * Create new approval application
 */
router.post('/', authenticateToken, (req, res) => {
  const {
    institutionId,
    academicYear = '2026-27',
    applicationType = 'EXTENSION_OF_APPROVAL',
    region,
    programmesRequested,
    remarks
  } = req.body;

  let effectiveInstId;
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    effectiveInstId = req.user.institution_id;
  } else {
    effectiveInstId = institutionId || req.user.institution_id;
  }

  if (!effectiveInstId) {
    return res.status(400).json({ error: 'Institution ID could not be established.' });
  }

  const inst = db.prepare('SELECT * FROM institutions WHERE id = ?').get(effectiveInstId);
  if (!inst) {
    return res.status(404).json({ error: 'Institution not found.' });
  }

  const appId = 'app_' + uuidv4().slice(0, 10);
  const appNumber = `AICTE-${academicYear}-${inst.code || Math.floor(100000 + Math.random() * 900000)}`;
  const finalRegion = region || inst.region || req.user.region || 'Northern';
  const programmesStr = typeof programmesRequested === 'object' ? JSON.stringify(programmesRequested) : (programmesRequested || '[]');

  db.prepare(`
    INSERT INTO applications (
      id, application_number, institution_id, academic_year, application_type,
      status, current_stage, region, remarks, programmes_requested, submission_date
    ) VALUES (?, ?, ?, ?, ?, 'SUBMITTED', 'SUBMITTED', ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    appId,
    appNumber,
    effectiveInstId,
    academicYear,
    applicationType,
    finalRegion,
    remarks || 'New Application Submission',
    programmesStr
  );

  // Record initial workflow history
  db.prepare(`
    INSERT INTO application_workflow_history (
      id, application_id, from_stage, to_stage, transitioned_by, transitioned_by_role, remarks
    ) VALUES (?, ?, 'DRAFT', 'SUBMITTED', ?, ?, 'Initial statutory dossier submitted')
  `).run('wfh_' + uuidv4().slice(0, 10), appId, req.user.full_name, req.user.role);

  const newApp = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);

  return res.status(201).json({
    success: true,
    message: 'Application successfully created and submitted to Regulation Bureau.',
    data: newApp,
    applicationId: appId,
    applicationNumber: appNumber
  });
});

/**
 * GET /api/applications/:id
 * Retrieve single application details with documents and committee info
 */
router.get('/:id', authenticateToken, (req, res) => {
  const app = db.prepare(`
    SELECT a.*, i.name as institution_name, i.code as institution_code,
           u_sc.full_name as scrutiny_officer_name,
           c.name as committee_name, c.code as committee_code
    FROM applications a
    LEFT JOIN institutions i ON a.institution_id = i.id
    LEFT JOIN users u_sc ON a.assigned_scrutiny_officer_id = u_sc.id
    LEFT JOIN evc_committees c ON a.assigned_evc_committee_id = c.id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Tenant isolation check
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    if (app.institution_id !== req.user.institution_id) {
      return res.status(403).json({ error: 'Access Denied: Cross-institution data isolation violation.' });
    }
  }

  // Committee members list if committee is assigned
  let committeeMembers = [];
  if (app.assigned_evc_committee_id) {
    committeeMembers = db.prepare(`
      SELECT cm.*, u.full_name, u.role as system_role, u.email
      FROM evc_committee_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.committee_id = ?
    `).all(app.assigned_evc_committee_id);
  }

  // Associated documents
  const docs = db.prepare(`
    SELECT * FROM documents WHERE application_id = ? AND is_latest_version = 1
  `).all(app.id);

  return res.json({
    application: app,
    committeeMembers,
    documentsCount: docs.length
  });
});

/**
 * POST /api/applications/:id/assign
 * Assign or reassign Scrutiny Officer or EVC Committee
 */
router.post('/:id/assign', authenticateToken, (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.ASSIGN) && !hasPermission(req.user, PERMISSIONS.REASSIGN)) {
    return res.status(403).json({ error: 'Forbidden', message: 'User lacks ASSIGN / REASSIGN permission.' });
  }

  const { scrutinyOfficerId, evcCommitteeId } = req.body;
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  db.prepare(`
    UPDATE applications SET
      assigned_scrutiny_officer_id = COALESCE(?, assigned_scrutiny_officer_id),
      assigned_evc_committee_id = COALESCE(?, assigned_evc_committee_id),
      status = 'UNDER_SCRUTINY',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(scrutinyOfficerId || null, evcCommitteeId || null, app.id);

  return res.json({
    success: true,
    message: 'Application assignments updated successfully.'
  });
});

/**
 * POST /api/applications/:id/decision
 * Competent Authority approves or rejects application
 * STRICT STATUTORY CHECK: Only authorized Competent Authority, subject to workflow prerequisites!
 */
router.post('/:id/decision', authenticateToken, (req, res) => {
  if (req.user.role !== ROLES.COMPETENT_AUTHORITY) {
    return res.status(403).json({
      error: 'Statutory Privilege Violation',
      message: 'Decision approval / rejection is strictly restricted to the authorized Competent Authority under Section 10(k) of the AICTE Act. Administrative roles cannot bypass statutory requirements.'
    });
  }

  const { decision, remarks } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be either APPROVED or REJECTED.' });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Prerequisite check: ensure no unresolved critical deficiencies
  const openDef = db.prepare(`
    SELECT count(*) as count FROM deficiencies 
    WHERE application_id = ? AND status = 'OPEN' AND severity = 'CRITICAL'
  `).get(app.id);

  if (openDef && openDef.count > 0) {
    return res.status(400).json({
      error: 'Unresolved Deficiencies Exist',
      message: `Cannot issue statutory decision while ${openDef.count} critical deficiencies remain open.`
    });
  }

  const decisionId = 'dec_' + uuidv4().slice(0, 10);
  const orderNumber = `AICTE/ORDER/${new Date().getFullYear()}/${Math.floor(100000 + Math.random() * 900000)}`;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO authority_decisions (
        id, application_id, authority_user_id, authority_name, authority_role,
        decision, formal_order_number, approved_intake, validity_years, reasoning
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 180, 3, ?)
    `).run(decisionId, app.id, req.user.id, req.user.full_name, req.user.role, decision, orderNumber, remarks || 'Statutory determination recorded.');

    db.prepare(`
      UPDATE applications SET
        status = ?,
        current_stage = ?,
        approval_date = CURRENT_TIMESTAMP,
        remarks = COALESCE(?, remarks),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(decision, decision, remarks || null, app.id);
  })();

  return res.json({
    success: true,
    message: `Application has been formally [${decision}] by Competent Authority ${req.user.full_name}. Order: ${orderNumber}`,
    status: decision,
    orderNumber
  });
});

module.exports = router;
