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
 * STRICT RBAC CHECK: only authorized competent authorities!
 */
router.post('/:id/decision', authenticateToken, (req, res) => {
  if (!hasPermission(req.user, PERMISSIONS.APPROVE_REJECT)) {
    return res.status(403).json({
      error: 'Permission Denied',
      message: 'Decision approval / rejection is strictly restricted to authorized Competent Authorities.'
    });
  }

  const { decision, remarks } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be either APPROVED or REJECTED.' });
  }

  db.prepare(`
    UPDATE applications SET
      status = ?,
      approval_date = CURRENT_TIMESTAMP,
      remarks = COALESCE(?, remarks),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(decision, remarks || null, req.params.id);

  return res.json({
    success: true,
    message: `Application has been formally [${decision}] by Competent Authority ${req.user.full_name}.`,
    status: decision
  });
});

module.exports = router;
