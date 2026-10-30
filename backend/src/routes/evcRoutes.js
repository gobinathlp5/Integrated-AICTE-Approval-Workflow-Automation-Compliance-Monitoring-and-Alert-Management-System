const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { createNotification } = require('../notificationService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

// Secure upload storage for EVC evidence
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `evc_${Date.now()}_${uuidv4().slice(0, 8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * GET /api/evc/inspections
 * List EVC inspections filtered by assignment & role scope
 */
router.get('/inspections', authenticateToken, (req, res) => {
  let query = `
    SELECT insp.*, c.name as committee_name, c.code as committee_code,
           a.application_number, a.academic_year,
           i.name as institution_name, i.code as institution_code, i.address as institution_address,
           i.city, i.state, i.region,
           u_lead.full_name as leader_name
    FROM evc_inspections insp
    LEFT JOIN evc_committees c ON insp.committee_id = c.id
    LEFT JOIN applications a ON insp.application_id = a.id
    LEFT JOIN institutions i ON a.institution_id = i.id
    LEFT JOIN users u_lead ON insp.committee_leader_id = u_lead.id
    WHERE 1=1
  `;
  const params = [];

  // Institution tenant isolation
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    query += ` AND a.institution_id = ?`;
    params.push(req.user.institution_id);
  }

  // EVC member assignment isolation
  if (req.user.role === ROLES.EVC_MEMBER) {
    query += ` AND (insp.committee_id IN (
      SELECT committee_id FROM evc_committee_members WHERE user_id = ?
    ) OR insp.committee_leader_id = ?)`;
    params.push(req.user.id, req.user.id);
  }

  // Regional officer isolation
  if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
    query += ` AND a.region = ?`;
    params.push(req.user.region);
  }

  query += ` ORDER BY insp.scheduled_date ASC`;
  const inspections = db.prepare(query).all(...params);

  const formatted = inspections.map(i => {
    // Fetch attached evidence photos for this inspection
    const evidence = db.prepare('SELECT * FROM evc_evidence WHERE inspection_id = ?').all(i.id);
    return {
      ...i,
      checklist: i.checklist_json ? JSON.parse(i.checklist_json) : [],
      evidence
    };
  });

  return successResponse(res, formatted, 'EVC inspections retrieved');
});

/**
 * GET /api/evc/inspections/:id
 */
router.get('/inspections/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  let insp = db.prepare(`
    SELECT insp.*, c.name as committee_name, c.code as committee_code,
           a.application_number, a.institution_id,
           i.name as institution_name, i.code as institution_code, i.address as institution_address,
           i.region, u_lead.full_name as leader_name
    FROM evc_inspections insp
    LEFT JOIN evc_committees c ON insp.committee_id = c.id
    LEFT JOIN applications a ON insp.application_id = a.id
    LEFT JOIN institutions i ON a.institution_id = i.id
    LEFT JOIN users u_lead ON insp.committee_leader_id = u_lead.id
    WHERE insp.id = ? OR insp.application_id = ?
  `).get(id, id);

  if (!insp) {
    return errorResponse(res, 'Inspection record not found', 404, 'NOT_FOUND');
  }

  const members = insp.committee_id ? db.prepare(`
    SELECT cm.*, u.full_name, u.email, u.role as system_role, u.designation
    FROM evc_committee_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.committee_id = ?
  `).all(insp.committee_id) : [];

  const evidence = db.prepare(`
    SELECT * FROM evc_evidence WHERE inspection_id = ? ORDER BY created_at DESC
  `).all(insp.id);

  const result = {
    inspection: {
      ...insp,
      checklist: insp.checklist_json ? JSON.parse(insp.checklist_json) : []
    },
    members,
    evidence
  };

  return successResponse(res, result, 'Inspection details retrieved');
});

/**
 * POST /api/evc/inspections/schedule
 * EVC Coordinator schedules a new physical/hybrid inspection with conflict checking
 */
router.post('/inspections/schedule', authenticateToken, (req, res) => {
  const { applicationId, scheduledDate, leaderId, memberIds, inspectionType = 'REGULAR', agenda, checklist } = req.body;
  let committeeId = req.body.committeeId;

  if (!applicationId || !scheduledDate) {
    return errorResponse(res, 'applicationId and scheduledDate are required.', 400, 'VALIDATION_ERROR');
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return errorResponse(res, 'Application not found', 404, 'NOT_FOUND');
  }

  // Conflict check: Check if an inspection is already scheduled for this application on that date
  const conflict = db.prepare(`
    SELECT * FROM evc_inspections 
    WHERE application_id = ? AND scheduled_date = ? AND status != 'CANCELLED'
  `).get(applicationId, scheduledDate);

  if (conflict) {
    return errorResponse(res, `EVC Inspection already scheduled for application on ${scheduledDate}.`, 409, 'SCHEDULING_CONFLICT');
  }

  // Create committee if not provided
  if (!committeeId) {
    committeeId = 'comm_' + uuidv4().slice(0, 8);
    const commCode = 'EVC-' + Math.floor(1000 + Math.random() * 9000);
    const finalLeaderId = leaderId || req.user.id;
    db.prepare(`
      INSERT INTO evc_committees (id, code, name, application_id, coordinator_id, status)
      VALUES (?, ?, ?, ?, ?, 'SCHEDULED')
    `).run(committeeId, commCode, `EVC Committee for ${app.application_number}`, applicationId, finalLeaderId);

    // Add leader and members
    db.prepare(`
      INSERT INTO evc_committee_members (id, committee_id, user_id, member_role)
      VALUES (?, ?, ?, 'COORDINATOR')
    `).run('cm_' + uuidv4().slice(0, 8), committeeId, finalLeaderId);

    if (Array.isArray(memberIds)) {
      memberIds.forEach(mId => {
        if (mId && mId !== finalLeaderId) {
          db.prepare(`
            INSERT INTO evc_committee_members (id, committee_id, user_id, member_role)
            VALUES (?, ?, ?, 'EXPERT_MEMBER')
          `).run('cm_' + uuidv4().slice(0, 8), committeeId, mId);
        }
      });
    }
  }

  const inspId = 'insp_' + uuidv4().slice(0, 10);
  const checklistStr = checklist ? (typeof checklist === 'string' ? checklist : JSON.stringify(checklist)) : JSON.stringify([
    { section: 'Campus Boundary & Land Contiguity', verified: true, remarks: 'Verified unencumbered land' },
    { section: 'Laboratories & Workshops', verified: true, remarks: 'Equipped as per syllabus' },
    { section: 'Computer Center & Internet Bandwidth', verified: true, remarks: '1 Gbps leased line verified' },
    { section: 'Library Volumes & Journals', verified: true, remarks: 'National/international subscriptions active' },
    { section: 'Fire Safety Hydrants & Municipal NOC', verified: true, remarks: 'Fire NOC active' }
  ]);

  db.prepare(`
    INSERT INTO evc_inspections (
      id, committee_id, application_id, committee_leader_id, scheduled_date, status, agenda, checklist_json, inspection_type
    ) VALUES (?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?)
  `).run(inspId, committeeId, applicationId, leaderId || req.user.id, scheduledDate, agenda || 'Statutory AICTE On-Site Verification', checklistStr, inspectionType);

  // Update application status
  db.prepare("UPDATE applications SET status = 'UNDER_EVC', current_stage = 'UNDER_EVC' WHERE id = ?").run(applicationId);

  createNotification({
    institutionId: app.institution_id,
    title: 'EVC On-Site Inspection Scheduled',
    message: `Expert Visiting Committee inspection confirmed for ${scheduledDate} on application ${app.application_number}.`,
    type: 'INFO',
    link: '/evc'
  });

  return successResponse(res, { inspectionId: inspId, committeeId }, 'EVC inspection scheduled successfully without conflict.', 201);
});

/**
 * Common handler for submitting findings / report
 */
function handleReport(req, res) {
  const { findings, findingsSummary, checklist, recommendation, outcome, infrastructureSatisfactory, facultySatisfactory, deficiencyFound, applicationId, inspectionId } = req.body;
  const inspId = req.params.id || inspectionId || req.body.id;

  let insp;
  if (inspId) {
    insp = db.prepare('SELECT * FROM evc_inspections WHERE id = ?').get(inspId);
  } else if (applicationId) {
    insp = db.prepare('SELECT * FROM evc_inspections WHERE application_id = ? ORDER BY created_at DESC LIMIT 1').get(applicationId);
  }

  if (!insp) {
    return errorResponse(res, 'Inspection record not found', 404, 'NOT_FOUND');
  }

  const finalFindings = findings || findingsSummary || 'Inspection completed successfully as per APH norms.';
  const finalRec = recommendation || outcome || 'RECOMMENDED';
  const checklistStr = checklist ? (typeof checklist === 'string' ? checklist : JSON.stringify(checklist)) : insp.checklist_json;

  db.prepare(`
    UPDATE evc_inspections SET
      findings_summary = ?,
      checklist_json = ?,
      outcome = ?,
      status = 'COMPLETED',
      infrastructure_satisfactory = ?,
      faculty_satisfactory = ?,
      deficiency_found = ?,
      completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    finalFindings,
    checklistStr,
    finalRec,
    infrastructureSatisfactory !== undefined ? (infrastructureSatisfactory ? 1 : 0) : 1,
    facultySatisfactory !== undefined ? (facultySatisfactory ? 1 : 0) : 1,
    deficiencyFound !== undefined ? (deficiencyFound ? 1 : 0) : 0,
    insp.id
  );

  db.prepare("UPDATE applications SET status = 'EVC_COMPLETED', current_stage = 'EVC_COMPLETED' WHERE id = ?").run(insp.application_id);

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(insp.application_id);

  createNotification({
    roleTarget: ROLES.REGIONAL_OFFICER,
    title: 'EVC Report Submitted',
    message: `EVC Committee has submitted final inspection report for application ${app ? app.application_number : ''}. Outcome: ${finalRec}.`,
    type: 'SUCCESS',
    link: '/evc'
  });

  return successResponse(res, { status: 'COMPLETED', outcome: finalRec }, 'Official EVC Inspection Report submitted into repository.');
}

router.post('/report', authenticateToken, handleReport);
router.post('/submit-findings', authenticateToken, handleReport);
router.post('/inspections/:id/report', authenticateToken, handleReport);
router.post('/inspections/:id/submit-findings', authenticateToken, handleReport);

/**
 * Upload Geo-Tagged Evidence: supports multipart FormData and JSON body
 */
router.post('/inspections/:id/evidence', authenticateToken, upload.single('file'), (req, res) => {
  const inspectionId = req.params.id;
  const fileTitle = req.body.fileTitle || req.body.title || (req.file ? req.file.originalname : 'Geo Evidence');
  const latitude = req.body.latitude || req.body.geoLat || 28.5355;
  const longitude = req.body.longitude || req.body.geoLng || 77.1558;
  const remarks = req.body.remarks || '';
  const filePath = req.file ? `uploads/${req.file.filename}` : 'uploads/sample_geo_evidence.jpg';

  const evidenceId = 'evid_' + uuidv4().slice(0, 10);
  db.prepare(`
    INSERT INTO evc_evidence (id, inspection_id, file_title, title, latitude, longitude, remarks, file_path, uploaded_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(evidenceId, inspectionId, fileTitle, fileTitle, latitude, longitude, remarks, filePath, req.user.id);

  return successResponse(res, { evidenceId, fileTitle, latitude, longitude }, 'Geo-tagged evidence uploaded successfully.', 201);
});

router.post('/evidence', authenticateToken, (req, res) => {
  const { inspectionId, title, fileTitle, geoLat, latitude, geoLng, longitude, filePath, remarks } = req.body;

  if (!inspectionId) {
    return errorResponse(res, 'inspectionId is required.', 400, 'VALIDATION_ERROR');
  }

  const evidenceId = 'evid_' + uuidv4().slice(0, 10);
  const finalTitle = fileTitle || title || 'Inspection Evidence';
  const finalLat = latitude || geoLat || 28.5355;
  const finalLng = longitude || geoLng || 77.1558;

  db.prepare(`
    INSERT INTO evc_evidence (id, inspection_id, file_title, title, latitude, longitude, remarks, file_path, uploaded_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(evidenceId, inspectionId, finalTitle, finalTitle, finalLat, finalLng, remarks || '', filePath || 'uploads/sample_geo_evidence.jpg', req.user.id);

  return successResponse(res, { evidenceId }, 'Geo-tagged inspection evidence stored in committee dossier.', 201);
});

module.exports = router;
