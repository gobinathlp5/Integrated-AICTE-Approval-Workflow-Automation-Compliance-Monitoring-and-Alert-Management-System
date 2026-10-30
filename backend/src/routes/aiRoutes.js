const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authenticateToken, requirePermission } = require('../rbac');

// AI Assistant Advisory Endpoints (Strictly advisory, read-only decision support)

// 1. Analyze Document Completeness for an Application
router.get('/analyze-application/:applicationId', authenticateToken, (req, res) => {
  const db = getDb();
  const { applicationId } = req.params;

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Get uploaded documents for this application
  const docs = db.prepare('SELECT * FROM documents WHERE application_id = ?').all(applicationId);
  const categories = docs.map(d => d.document_category);

  // Mandatory statutory checklist for AICTE Approval
  const mandatoryCategories = [
    { key: 'LAND', title: 'Land Ownership / Lease Deed & Conversion Certificate', mandatory: true },
    { key: 'BUILDING_PLAN', title: 'Approved Master Building Plan & Fire Safety NOC', mandatory: true },
    { key: 'FINANCIAL', title: 'Audited Financial Statements & FDR / Bank Guarantee', mandatory: true },
    { key: 'ACADEMIC', title: 'Faculty Cadre Ratio & Student Curriculum Details', mandatory: true },
    { key: 'UNDERTAKING', title: 'Affidavit & Statutory Undertakings', mandatory: true },
    { key: 'REGULATORY', title: 'Society / Trust Registration & Previous Approval', mandatory: false }
  ];

  const checklist = mandatoryCategories.map(item => {
    const matchedDocs = docs.filter(d => d.document_category === item.key);
    const isPresent = matchedDocs.length > 0;
    const isVerified = matchedDocs.some(d => d.verification_status === 'VERIFIED');
    return {
      ...item,
      present: isPresent,
      verified: isVerified,
      documentCount: matchedDocs.length,
      documents: matchedDocs.map(d => ({ id: d.id, title: d.title, status: d.verification_status, version: d.version }))
    };
  });

  const missingMandatory = checklist.filter(c => c.mandatory && !c.present);
  const unverified = checklist.filter(c => c.present && !c.verified);

  // Calculate completeness score (0 - 100%)
  const totalMandatory = checklist.filter(c => c.mandatory).length;
  const fulfilledMandatory = checklist.filter(c => c.mandatory && c.present).length;
  const verifiedMandatory = checklist.filter(c => c.mandatory && c.verified).length;

  const completenessPercentage = Math.round((fulfilledMandatory / totalMandatory) * 70 + (verifiedMandatory / totalMandatory) * 30);

  // Advisory recommendation
  let advisoryStatus = 'READY_FOR_NEXT_STAGE';
  let recommendation = 'All mandatory documentation is in place. Application may proceed to Scrutiny / EVC.';
  if (missingMandatory.length > 0) {
    advisoryStatus = 'DOCUMENTATION_DEFICIENT';
    recommendation = `Missing ${missingMandatory.length} mandatory document(s): ${missingMandatory.map(m => m.title).join(', ')}. Scrutiny notice recommended.`;
  } else if (unverified.length > 0) {
    advisoryStatus = 'VERIFICATION_PENDING';
    recommendation = `${unverified.length} uploaded statutory document(s) await officer verification.`;
  }

  res.json({
    applicationId,
    applicationNumber: app.application_number,
    institutionId: app.institution_id,
    currentStage: app.current_stage,
    completenessPercentage,
    advisoryStatus,
    recommendation,
    checklist,
    missingMandatoryCount: missingMandatory.length,
    unverifiedCount: unverified.length,
    disclaimer: 'AI Advisory output is indicative and decision-support only. Statutory authority rests exclusively with authorized Council officers.'
  });
});

// 2. OCR and Document Classification Simulation
router.post('/classify-document', authenticateToken, (req, res) => {
  const { title, fileName, categoryHint } = req.body;
  if (!title && !fileName) {
    return res.status(400).json({ error: 'Document title or fileName is required for AI classification' });
  }

  const query = `${title || ''} ${fileName || ''}`.toLowerCase();

  let predictedCategory = 'GENERAL';
  let confidence = 0.88;
  let extractedEntities = {};

  if (query.includes('land') || query.includes('patta') || query.includes('khasra') || query.includes('deed')) {
    predictedCategory = 'LAND';
    confidence = 0.96;
    extractedEntities = {
      propertyIdentifier: 'Survey No. 442/A, Khasra 89',
      totalArea: '5.24 Acres (Contiguous)',
      landUseConversion: 'Approved for Higher Technical Education',
      issuingAuthority: 'Tehsildar / Sub-Divisional Magistrate'
    };
  } else if (query.includes('building') || query.includes('fire') || query.includes('noc') || query.includes('plan')) {
    predictedCategory = 'BUILDING_PLAN';
    confidence = 0.94;
    extractedEntities = {
      builtUpArea: '12,500 sq.m',
      fireNocNumber: 'FS-NOC-2026/8941',
      validityPeriod: 'Valid up to 31-Dec-2027',
      complianceCode: 'National Building Code 2016 Part 4'
    };
  } else if (query.includes('fdr') || query.includes('bank') || query.includes('guarantee') || query.includes('audit')) {
    predictedCategory = 'FINANCIAL';
    confidence = 0.92;
    extractedEntities = {
      bankName: 'State Bank of India',
      fdrAmount: 'INR 1,00,00,000 (Joint Account with AICTE)',
      maturityDate: '15-Mar-2031',
      lienMarked: 'YES (In favor of Member Secretary, AICTE)'
    };
  } else if (query.includes('affidavit') || query.includes('ragging') || query.includes('undertaking')) {
    predictedCategory = 'UNDERTAKING';
    confidence = 0.97;
    extractedEntities = {
      stampDuty: 'INR 100 Non-Judicial Stamp Paper',
      deponent: 'Chairman / Secretary of Trust',
      notaryRegistration: 'Reg. No. MH/4821/2026',
      antiRaggingClause: 'Affirmed under AICTE Regulations 2009'
    };
  } else if (query.includes('faculty') || query.includes('aicte') || query.includes('syllabus')) {
    predictedCategory = 'ACADEMIC';
    confidence = 0.89;
    extractedEntities = {
      cadreRatio: '1:2:6 (Prof:Assoc:Asst)',
      approvedIntake: '120 UG seats',
      cadreAdherence: 'Compliant with AICTE APH 2026-27'
    };
  }

  res.json({
    inputTitle: title,
    predictedCategory,
    confidence,
    extractedEntities,
    ocrTimestamp: new Date().toISOString(),
    disclaimer: 'AI OCR classification is probabilistic. Reviewing officer must verify the underlying physical/scanned document.'
  });
});

// 3. Statutory SLA & Bottleneck Risk Analyzer
router.get('/statutory-sla-risk', authenticateToken, (req, res) => {
  const db = getDb();

  // Query pending applications
  const applications = db.prepare(`
    SELECT a.*, i.name as institution_name, i.region, i.aicte_id
    FROM applications a
    JOIN institutions i ON a.institution_id = i.id
    WHERE a.status NOT IN ('APPROVED', 'REJECTED')
  `).all();

  const now = new Date();
  const analyzedApps = applications.map(app => {
    const createdDate = new Date(app.created_at);
    const daysElapsed = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));

    // Statutory timeline thresholds based on AICTE Approval Process Handbook (APH)
    let slaThreshold = 30; // 30 days total
    let riskLevel = 'LOW';
    let riskReason = 'Within standard SLA processing window';

    if (app.current_stage === 'SCRUTINY') {
      slaThreshold = 14;
      if (daysElapsed > 14) {
        riskLevel = 'BREACHED';
        riskReason = `Scrutiny stage exceeded 14-day statutory limit (${daysElapsed} days elapsed)`;
      } else if (daysElapsed >= 10) {
        riskLevel = 'HIGH';
        riskReason = `Approaching scrutiny SLA limit (${daysElapsed}/14 days elapsed)`;
      } else if (daysElapsed >= 7) {
        riskLevel = 'MEDIUM';
        riskReason = `Halfway through scrutiny SLA window (${daysElapsed}/14 days)`;
      }
    } else if (app.current_stage === 'EVC_INSPECTION') {
      slaThreshold = 21;
      if (daysElapsed > 21) {
        riskLevel = 'BREACHED';
        riskReason = `EVC inspection window exceeded 21 days (${daysElapsed} days elapsed)`;
      } else if (daysElapsed >= 15) {
        riskLevel = 'HIGH';
        riskReason = `High delay risk in EVC report submission (${daysElapsed}/21 days)`;
      }
    } else if (app.current_stage === 'SAC_HEARING') {
      slaThreshold = 10;
      if (daysElapsed > 10) {
        riskLevel = 'HIGH';
        riskReason = `SAC appellate hearing scheduling overdue (${daysElapsed} days elapsed)`;
      }
    }

    return {
      applicationId: app.id,
      applicationNumber: app.application_number,
      institutionName: app.institution_name,
      region: app.region,
      currentStage: app.current_stage,
      daysElapsed,
      slaThreshold,
      riskLevel,
      riskReason
    };
  });

  const highRiskCount = analyzedApps.filter(a => a.riskLevel === 'HIGH' || a.riskLevel === 'BREACHED').length;

  res.json({
    totalPending: analyzedApps.length,
    highRiskCount,
    applications: analyzedApps,
    disclaimer: 'Risk analysis calculates delays against AICTE statutory calendar dates.'
  });
});

module.exports = router;
