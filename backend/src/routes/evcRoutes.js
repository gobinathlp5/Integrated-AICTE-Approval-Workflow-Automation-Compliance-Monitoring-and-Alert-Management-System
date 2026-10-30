const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');

/**
 * GET /api/evc/inspections
 * List EVC inspections filtered by assignment & role scope
 */
router.get('/inspections', authenticateToken, (req, res) => {
  let query = `
    SELECT insp.*, c.name as committee_name, c.code as committee_code,
           a.application_number, a.academic_year,
           i.name as institution_name, i.code as institution_code, i.address as institution_address,
           i.city, i.state
    FROM evc_inspections insp
    JOIN evc_committees c ON insp.committee_id = c.id
    JOIN applications a ON insp.application_id = a.id
    JOIN institutions i ON a.institution_id = i.id
    WHERE 1=1
  `;
  const params = [];

  // Institution tenant isolation
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    query += ` AND a.institution_id = ?`;
    params.push(req.user.institution_id);
  }

  // EVC member assignment isolation: can only see inspections for their committee
  if (req.user.role === ROLES.EVC_MEMBER) {
    query += ` AND c.id IN (
      SELECT committee_id FROM evc_committee_members WHERE user_id = ?
    )`;
    params.push(req.user.id);
  }

  // Regional officer isolation
  if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
    query += ` AND a.region = ?`;
    params.push(req.user.region);
  }

  query += ` ORDER BY insp.scheduled_date ASC`;
  const inspections = db.prepare(query).all(...params);

  return res.json({
    total: inspections.length,
    inspections: inspections.map(i => ({
      ...i,
      checklist: i.checklist_json ? JSON.parse(i.checklist_json) : []
    }))
  });
});

/**
 * GET /api/evc/inspections/:id
 * Retrieve inspection details, committee members, checklist & evidence
 */
router.get('/inspections/:id', authenticateToken, (req, res) => {
  const insp = db.prepare(`
    SELECT insp.*, c.name as committee_name, c.code as committee_code,
           a.application_number, a.institution_id,
           i.name as institution_name, i.code as institution_code, i.address as institution_address
    FROM evc_inspections insp
    JOIN evc_committees c ON insp.committee_id = c.id
    JOIN applications a ON insp.application_id = a.id
    JOIN institutions i ON a.institution_id = i.id
    WHERE insp.id = ?
  `).get(req.params.id);

  if (!insp) {
    return res.status(404).json({ error: 'Inspection schedule not found' });
  }

  // Committee members list
  const members = db.prepare(`
    SELECT cm.*, u.full_name, u.email, u.role as system_role, u.designation
    FROM evc_committee_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.committee_id = ?
  `).all(insp.committee_id);

  // Evidence list
  const evidence = db.prepare(`
    SELECT * FROM evc_evidence WHERE inspection_id = ? ORDER BY created_at DESC
  `).all(insp.id);

  return res.json({
    inspection: {
      ...insp,
      checklist: insp.checklist_json ? JSON.parse(insp.checklist_json) : []
    },
    members,
    evidence
  });
});

/**
 * POST /api/evc/inspections/schedule
 * EVC Coordinator schedules a new physical/hybrid inspection with conflict checking
 */
router.post('/inspections/schedule', authenticateToken, (req, res) => {
  const { committeeId, applicationId, scheduledDate, agenda, checklist } = req.body;

  if (!committeeId || !applicationId || !scheduledDate) {
    return res.status(400).json({ error: 'committeeId, applicationId, and scheduledDate are required.' });
  }

  // Conflict check: Check if committee already has an inspection scheduled on that date
  const conflict = db.prepare(`
    SELECT * FROM evc_inspections 
    WHERE committee_id = ? AND scheduled_date = ? AND status != 'CANCELLED'
  `).get(committeeId, scheduledDate);

  if (conflict) {
    return res.status(409).json({
      error: 'Scheduling Conflict',
      message: `EVC Committee is already scheduled for an inspection on ${scheduledDate}. Please select another date.`
    });
  }

  const inspId = 'insp_' + uuidv4().slice(0, 10);
  const checklistStr = checklist ? (typeof checklist === 'string' ? checklist : JSON.stringify(checklist)) : JSON.stringify([
    { section: 'Campus Boundary & Land Contiguity', verified: false, remarks: '' },
    { section: 'Laboratories & Technical Workshops', verified: false, remarks: '' },
    { section: 'Digital Computer Facilities & Internet Bandwidth', verified: false, remarks: '' },
    { section: 'Library Volumes & National/International Journals', verified: false, remarks: '' },
    { section: 'Barrier-Free Physical Accessibility for Divyangjan', verified: false, remarks: '' },
    { section: 'Fire Safety Hydrants & Municipal NOC', verified: false, remarks: '' }
  ]);

  db.prepare(`
    INSERT INTO evc_inspections (
      id, committee_id, application_id, scheduled_date, status, agenda, checklist_json
    ) VALUES (?, ?, ?, ?, 'SCHEDULED', ?, ?)
  `).run(inspId, committeeId, applicationId, scheduledDate, agenda || 'Statutory AICTE On-Site Verification', checklistStr);

  // Update application status
  db.prepare("UPDATE applications SET status = 'UNDER_EVC', current_stage = 'UNDER_EVC' WHERE id = ?").run(applicationId);

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);

  createNotification({
    institutionId: app.institution_id,
    title: 'EVC On-Site Inspection Scheduled',
    message: `Expert Visiting Committee inspection confirmed for ${scheduledDate} on application ${app.application_number}.`,
    type: 'INFO',
    link: '/evc'
  });

  return res.status(201).json({
    success: true,
    message: 'EVC inspection scheduled successfully without conflict.',
    inspectionId: inspId
  });
});

/**
 * POST /api/evc/inspections/:id/report
 * EVC Team submits comprehensive inspection findings and statutory recommendation
 */
router.post('/inspections/:id/report', authenticateToken, (req, res) => {
  const { findings, checklist, recommendation } = req.body;

  const insp = db.prepare('SELECT * FROM evc_inspections WHERE id = ?').get(req.params.id);
  if (!insp) {
    return res.status(404).json({ error: 'Inspection record not found' });
  }

  const checklistStr = checklist ? (typeof checklist === 'string' ? checklist : JSON.stringify(checklist)) : insp.checklist_json;

  db.prepare(`
    UPDATE evc_inspections SET
      findings = ?,
      checklist_json = ?,
      recommendation = ?,
      status = 'COMPLETED',
      completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(findings || 'Inspection completed successfully as per APH norms.', checklistStr, recommendation || 'RECOMMENDED_APPROVAL', insp.id);

  // Update application to EVC_COMPLETED
  db.prepare("UPDATE applications SET status = 'EVC_COMPLETED', current_stage = 'EVC_COMPLETED' WHERE id = ?").run(insp.application_id);

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(insp.application_id);

  createNotification({
    roleTarget: ROLES.REGIONAL_OFFICER,
    title: 'EVC Report Submitted',
    message: `EVC Committee has submitted final inspection report for application ${app.application_number}. Recommendation: ${recommendation}.`,
    type: 'SUCCESS',
    link: '/evc'
  });

  return res.json({
    success: true,
    message: 'Official EVC Inspection Report submitted into repository.',
    status: 'COMPLETED'
  });
});

/**
 * POST /api/evc/evidence
 * Upload geo-tagged evidence during inspection
 */
router.post('/evidence', authenticateToken, (req, res) => {
  const { inspectionId, evidenceType, title, geoLat, geoLng, filePath } = req.body;

  if (!inspectionId || !title) {
    return res.status(400).json({ error: 'inspectionId and title are required.' });
  }

  const evidenceId = 'evid_' + uuidv4().slice(0, 10);
  db.prepare(`
    INSERT INTO evc_evidence (id, inspection_id, evidence_type, title, geo_lat, geo_lng, file_path, uploader_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(evidenceId, inspectionId, evidenceType || 'PHOTO', title, geoLat || 28.5355, geoLng || 77.1557, filePath || 'uploads/sample_geo_evidence.jpg', req.user.id);

  return res.status(201).json({
    success: true,
    message: 'Geo-tagged inspection evidence stored in committee dossier.',
    evidenceId
  });
});

module.exports = router;
