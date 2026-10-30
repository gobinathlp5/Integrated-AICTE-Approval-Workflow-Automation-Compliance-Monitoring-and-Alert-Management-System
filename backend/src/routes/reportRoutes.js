const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticateToken } = require('../auth');
const { hasPermission, PERMISSIONS } = require('../rbac');

const requireExportPermission = (req, res, next) => {
  if (!hasPermission(req.user, PERMISSIONS.EXPORT)) {
    return res.status(403).json({ error: 'Forbidden', message: 'Insufficient permission to export statutory data.' });
  }
  next();
};

// 1. Comprehensive System Analytics & Summary
router.get('/summary', authenticateToken, (req, res) => {
  const db = getDb();

  // Institution stats
  const totalInstitutions = db.prepare('SELECT COUNT(*) as count FROM institutions').get().count;
  const verifiedInstitutions = db.prepare('SELECT COUNT(*) as count FROM institutions WHERE verified = 1').get().count;

  // Application stats
  const totalApplications = db.prepare('SELECT COUNT(*) as count FROM applications').get().count;
  const approvedApplications = db.prepare("SELECT COUNT(*) as count FROM applications WHERE status = 'APPROVED'").get().count;
  const rejectedApplications = db.prepare("SELECT COUNT(*) as count FROM applications WHERE status = 'REJECTED'").get().count;
  const inProgressApplications = db.prepare("SELECT COUNT(*) as count FROM applications WHERE status = 'IN_PROGRESS'").get().count;

  // By Stage
  const stageStats = db.prepare(`
    SELECT current_stage, COUNT(*) as count
    FROM applications
    GROUP BY current_stage
  `).all();

  // By Region
  const regionStats = db.prepare(`
    SELECT i.region, COUNT(a.id) as app_count, COUNT(DISTINCT i.id) as inst_count
    FROM institutions i
    LEFT JOIN applications a ON i.id = a.institution_id
    GROUP BY i.region
  `).all();

  // Documents
  const totalDocs = db.prepare('SELECT COUNT(*) as count FROM documents').get().count;
  const verifiedDocs = db.prepare("SELECT COUNT(*) as count FROM documents WHERE verification_status = 'VERIFIED'").get().count;

  // Scrutiny Deficiencies
  const totalDeficiencies = db.prepare('SELECT COUNT(*) as count FROM deficiencies').get().count;
  const openDeficiencies = db.prepare("SELECT COUNT(*) as count FROM deficiencies WHERE status != 'RESOLVED'").get().count;

  // EVC Inspections
  const totalInspections = db.prepare('SELECT COUNT(*) as count FROM evc_inspections').get().count;
  const completedInspections = db.prepare("SELECT COUNT(*) as count FROM evc_inspections WHERE status = 'COMPLETED'").get().count;

  // Escalations
  const activeEscalations = db.prepare("SELECT COUNT(*) as count FROM escalations WHERE status = 'OPEN'").get().count;

  // Audit trail tamper health
  const totalAuditEvents = db.prepare('SELECT COUNT(*) as count FROM document_audit_trail').get().count;

  res.json({
    generatedAt: new Date().toISOString(),
    metrics: {
      institutions: { total: totalInstitutions, verified: verifiedInstitutions },
      applications: {
        total: totalApplications,
        approved: approvedApplications,
        rejected: rejectedApplications,
        inProgress: inProgressApplications
      },
      documents: { total: totalDocs, verified: verifiedDocs },
      scrutiny: { totalDeficiencies, openDeficiencies },
      inspections: { total: totalInspections, completed: completedInspections },
      escalations: { active: activeEscalations },
      auditEvents: { total: totalAuditEvents }
    },
    stageDistribution: stageStats,
    regionalDistribution: regionStats
  });
});

// 2. Export Applications Report (CSV / JSON)
router.get('/export/applications', authenticateToken, requireExportPermission, (req, res) => {
  const db = getDb();
  const format = req.query.format || 'csv';

  const rows = db.prepare(`
    SELECT 
      a.id,
      a.application_number,
      i.aicte_id as institution_aicte_id,
      i.name as institution_name,
      i.region,
      i.state,
      a.academic_year,
      a.application_type,
      a.status,
      a.current_stage,
      a.created_at
    FROM applications a
    JOIN institutions i ON a.institution_id = i.id
    ORDER BY a.created_at DESC
  `).all();

  if (format === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename=aicte_applications_report.json');
    return res.json(rows);
  }

  // Convert to CSV
  const headers = ['Application ID', 'Application Number', 'AICTE Permanent ID', 'Institution Name', 'Region', 'State', 'Academic Year', 'Type', 'Status', 'Current Stage', 'Created Date'];
  const csvLines = [headers.join(',')];

  rows.forEach(r => {
    const line = [
      r.id,
      `"${r.application_number}"`,
      `"${r.institution_aicte_id}"`,
      `"${(r.institution_name || '').replace(/"/g, '""')}"`,
      `"${r.region}"`,
      `"${r.state}"`,
      `"${r.academic_year}"`,
      `"${r.application_type}"`,
      `"${r.status}"`,
      `"${r.current_stage}"`,
      `"${r.created_at}"`
    ];
    csvLines.push(line.join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=aicte_applications_report.csv');
  res.send(csvLines.join('\n'));
});

// 3. Export Compliance & Risk Report (CSV / JSON)
router.get('/export/compliance', authenticateToken, requireExportPermission, (req, res) => {
  const db = getDb();
  const format = req.query.format || 'csv';

  const rows = db.prepare(`
    SELECT 
      c.id,
      i.aicte_id as institution_aicte_id,
      i.name as institution_name,
      c.obligation_category,
      c.title,
      c.due_date,
      c.status,
      c.academic_year
    FROM compliance_obligations c
    JOIN institutions i ON c.institution_id = i.id
    ORDER BY c.due_date ASC
  `).all();

  if (format === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename=aicte_compliance_report.json');
    return res.json(rows);
  }

  const headers = ['Obligation ID', 'AICTE Permanent ID', 'Institution Name', 'Category', 'Obligation Title', 'Due Date', 'Status', 'Academic Year'];
  const csvLines = [headers.join(',')];

  rows.forEach(r => {
    const line = [
      r.id,
      `"${r.institution_aicte_id}"`,
      `"${(r.institution_name || '').replace(/"/g, '""')}"`,
      `"${r.obligation_category}"`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${r.due_date}"`,
      `"${r.status}"`,
      `"${r.academic_year}"`
    ];
    csvLines.push(line.join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=aicte_compliance_report.csv');
  res.send(csvLines.join('\n'));
});

// 4. Officer Workload & Processing Velocity Report
router.get('/officer-workload', authenticateToken, (req, res) => {
  const db = getDb();

  const officers = db.prepare(`
    SELECT u.id, u.full_name as name, u.email, u.role, u.region,
      (SELECT COUNT(*) FROM scrutiny_evaluations s WHERE s.scrutiny_officer_id = u.id) as scrutiny_assigned,
      (SELECT COUNT(*) FROM evc_inspections e WHERE e.committee_leader_id = u.id) as inspections_led,
      (SELECT COUNT(*) FROM authority_decisions d WHERE d.authority_user_id = u.id) as decisions_rendered
    FROM users u
    WHERE u.role IN ('SCRUTINY_OFFICER', 'EVC_COORDINATOR', 'EVC_MEMBER', 'SAC_SHC_MEMBER', 'COMPETENT_AUTHORITY', 'REGIONAL_OFFICER', 'BUREAU_OFFICER')
  `).all();

  res.json({
    totalOfficers: officers.length,
    officers
  });
});

module.exports = router;
