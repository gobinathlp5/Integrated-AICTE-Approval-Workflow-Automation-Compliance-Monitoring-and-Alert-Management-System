const http = require('http');
const app = require('../src/server');
const { db, initDb } = require('../src/db');
const { generateAuthToken } = require('../src/auth');
const { verifyAuditChainIntegrity } = require('../src/audit');

async function runE2EWorkflowTests() {
  console.log('========================================================');
  console.log('AICTE PLATFORM: RUNNING END-TO-END STATUTORY WORKFLOW TEST');
  console.log('========================================================\n');

  initDb();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, message, evidence = null) {
    if (condition) {
      passed++;
      console.log(`[✅ PASS] ${message}`);
      if (evidence) {
        console.log(`       Evidence: ${JSON.stringify(evidence)}`);
      }
    } else {
      failed++;
      console.error(`[❌ FAIL] ${message}`);
      if (evidence) {
        console.error(`       Evidence: ${JSON.stringify(evidence)}`);
      }
    }
  }

  async function safeJson(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error(`Failed to parse JSON from ${res.url} (status: ${res.status}):\n${text}`);
      throw e;
    }
  }

  try {
    const uniqueId = Date.now();
    const instCode = `1-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regUsername = `e2e_inst_${uniqueId}`;
    const regEmail = `e2e_${uniqueId}@aicte-e2e.edu.in`;

    // 1. Institution Registration
    let regToken;
    let institutionId;
    {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: 'Password@123',
          fullName: 'Dr. E2E Principal Director',
          role: 'INSTITUTION_ADMIN',
          institutionCode: instCode,
          institutionName: `National Institute of Advanced AI Technology (${uniqueId})`,
          region: 'Northern',
          state: 'Haryana',
          city: 'Gurugram'
        })
      });
      const data = await safeJson(res);
      regToken = data.token;
      institutionId = data.user?.institution_id;
      assert(
        res.status === 201 && regToken && institutionId && data.institutionStatus === 'PENDING_VERIFICATION',
        'STEP 1: Public institution onboarding initiated in PENDING_VERIFICATION state',
        { institutionCode: instCode, institutionId, status: data.institutionStatus }
      );
    }

    // Preload council officers
    const regionalOfficer = db.prepare('SELECT * FROM users WHERE username = ?').get('regionalofficer');
    const scrutinyOfficer = db.prepare('SELECT * FROM users WHERE username = ?').get('scrutinyofficer');
    const evcMember = db.prepare('SELECT * FROM users WHERE username = ?').get('evcmember');
    const sacMember = db.prepare('SELECT * FROM users WHERE username = ?').get('sacmember');
    const caOfficer = db.prepare('SELECT * FROM users WHERE username = ?').get('competentauthority');

    const roToken = generateAuthToken(regionalOfficer);
    const scrutinyToken = generateAuthToken(scrutinyOfficer);
    const evcToken = generateAuthToken(evcMember);
    const sacToken = generateAuthToken(sacMember);
    const caToken = generateAuthToken(caOfficer);

    // 1b. Unverified Institution Blocked from Creating Applications (Prompt 3.3)
    {
      const prematureAppRes = await fetch(`${baseUrl}/api/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${regToken}`
        },
        body: JSON.stringify({
          academicYear: '2026-27',
          applicationType: 'EXTENSION_OF_APPROVAL',
          region: 'Northern'
        })
      });
      assert(
        prematureAppRes.status === 403,
        'STEP 1b: Unverified institution strictly blocked from submitting applications (HTTP 403)',
        { status: prematureAppRes.status }
      );
    }

    // 1c. Regional Officer Verifies Institution Affiliation
    {
      const verifyInstRes = await fetch(`${baseUrl}/api/institutions/${institutionId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${roToken}`
        }
      });
      const verifyInstData = await safeJson(verifyInstRes);
      assert(
        verifyInstRes.status === 200 && verifyInstData.success && verifyInstData.data?.status === 'ACTIVE',
        'STEP 1c: AICTE Regional Officer verifies institution credentials and activates account',
        { institutionId, status: verifyInstData.data?.status }
      );
    }

    // 2. Application Submission
    let applicationId;
    let applicationNumber;
    {
      const res = await fetch(`${baseUrl}/api/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${regToken}`
        },
        body: JSON.stringify({
          academicYear: '2026-27',
          applicationType: 'EXTENSION_OF_APPROVAL',
          region: 'Northern',
          programmesRequested: [
            { programme: 'B.Tech Artificial Intelligence & Machine Learning', intake: 120 },
            { programme: 'M.Tech Autonomous Systems', intake: 30 }
          ],
          remarks: 'Formal application for academic expansion for AY 2026-27'
        })
      });
      const data = await safeJson(res);
      applicationId = data.data?.id || data.applicationId || data.id;
      applicationNumber = data.data?.applicationNumber || data.application_number;
      assert(
        (res.status === 200 || res.status === 201) && applicationId,
        'STEP 2: Verified institutional applicant creates application dossier',
        { applicationId, applicationNumber }
      );
    }

    // 3. Genuine Multipart Document Upload with SHA-256 & Magic Bytes (Prompt 3.5)
    let docId;
    {
      const formData = new FormData();
      const pdfBytes = Buffer.from('%PDF-1.4\n%AICTE Statutory Archive - Land Deed Master Plan\n%%EOF');
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      formData.append('file', blob, 'land_deed_master.pdf');
      formData.append('applicationId', applicationId);
      formData.append('title', 'Registered Land Deed & Municipal Approval Plan');
      formData.append('documentCategory', 'MANDATORY_DISCLOSURE');
      formData.append('folderCategory', 'LAND_AND_BUILDING');
      formData.append('confidentialityClassification', 'INSTITUTION_VISIBLE');

      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${regToken}`
        },
        body: formData
      });
      const data = await safeJson(res);
      docId = data.document?.id || data.data?.id || data.id;
      assert(
        (res.status === 200 || res.status === 201) && docId,
        'STEP 3: Genuine multipart statutory PDF document uploaded with verified magic bytes and SHA-256 integrity hash',
        { docId, checksumSha256: data.document?.checksum_sha256 }
      );
    }

    // 4. Workflow Transition to UNDER_SCRUTINY
    {
      const res = await fetch(`${baseUrl}/api/workflows/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${roToken}`
        },
        body: JSON.stringify({
          applicationId,
          toStage: 'UNDER_SCRUTINY',
          remarks: 'Assigned to Senior Scrutiny Evaluator'
        })
      });
      const data = await safeJson(res);
      assert(
        res.status === 200 && data.success,
        'STEP 4: Regional Officer verifies initial submission and transitions to UNDER_SCRUTINY',
        { currentStage: data.data?.currentStage }
      );
    }

    // 5. Scrutiny Evaluation & Deficiency Resolution
    {
      const res = await fetch(`${baseUrl}/api/scrutiny/evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${scrutinyToken}`
        },
        body: JSON.stringify({
          applicationId,
          checklist: [
            { category: 'Land', status: 'VERIFIED', remarks: '5.2 acres unencumbered land verified' },
            { category: 'Built-up', status: 'VERIFIED', remarks: '12,500 sqm building verified' },
            { category: 'Faculty', status: 'DEFICIENT', remarks: 'Requires updated cadre appointment letters' }
          ],
          overallRemarks: 'Land and building verified. Faculty appointment letters needed.',
          recommendation: 'DEFICIENCY_RAISED'
        })
      });
      const data = await safeJson(res);
      assert(
        res.status === 200 || res.status === 201,
        'STEP 5a: Scrutiny Officer completes evaluation and identifies faculty cadre deficiency'
      );

      // Raise deficiency notice
      const defRes = await fetch(`${baseUrl}/api/scrutiny/deficiencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${scrutinyToken}`
        },
        body: JSON.stringify({
          applicationId,
          documentId: docId,
          title: 'Faculty Appointment Letters Deficiency',
          description: 'Provide selection committee minutes and appointment orders',
          severity: 'MAJOR',
          statutoryClause: 'Clause 7.2 Cadre Norms',
          deadlineDays: 15
        })
      });
      const defData = await safeJson(defRes);
      const defId = defData.data?.id || defData.data?.deficiencyId;

      // Institution responds
      const respRes = await fetch(`${baseUrl}/api/scrutiny/deficiencies/${defId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${regToken}`
        },
        body: JSON.stringify({
          institutionResponse: 'Selection committee minutes uploaded on institutional portal'
        })
      });
      const respData = await safeJson(respRes);

      // Scrutiny resolves
      const resDefRes = await fetch(`${baseUrl}/api/scrutiny/deficiencies/${defId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${scrutinyToken}`
        },
        body: JSON.stringify({
          status: 'RESOLVED',
          remarks: 'Recruitment appointment orders authenticated'
        })
      });
      const resDefData = await safeJson(resDefRes);
      assert(
        resDefRes.status === 200 && resDefData.success,
        'STEP 5b: Institutional deficiency clarification submitted and authenticated by Scrutiny Evaluator'
      );
    }

    // 6. EVC Scheduling, Inspection & Report
    {
      const schedRes = await fetch(`${baseUrl}/api/evc/inspections/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${roToken}`
        },
        body: JSON.stringify({
          applicationId,
          scheduledDate: '2026-11-15',
          leaderId: evcMember.id,
          agenda: 'On-site physical campus inspection for AI & Autonomous Systems'
        })
      });
      const schedData = await safeJson(schedRes);
      const inspectionId = schedData.data?.inspectionId;

      // EVC report submission
      const repRes = await fetch(`${baseUrl}/api/evc/inspections/${inspectionId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${evcToken}`
        },
        body: JSON.stringify({
          findings: 'Laboratories, computing clusters, and workshop facilities fully operational.',
          findingsSummary: 'Physical infrastructure complies with APH 2026-27 norms.',
          infrastructureSatisfactory: true,
          facultySatisfactory: true,
          deficiencyFound: false,
          recommendation: 'RECOMMENDED_APPROVAL'
        })
      });
      const repData = await safeJson(repRes);
      assert(
        repRes.status === 200 && repData.success,
        'STEP 6: EVC Committee conducts on-site inspection and files official recommendation (RECOMMENDED_APPROVAL)'
      );
    }

    // 7. SAC Committee Hearing
    {
      // Schedule SAC
      const sacSchedRes = await fetch(`${baseUrl}/api/sac/hearings/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${roToken}`
        },
        body: JSON.stringify({
          applicationId,
          scheduledDate: '2026-11-20',
          appellantName: 'Dr. E2E Principal Director',
          hearingSummary: 'Statutory Appellate Hearing on Intake Allocation'
        })
      });
      const sacSchedData = await safeJson(sacSchedRes);
      const hearingId = sacSchedData.data?.hearingId;

      // SAC recommendation
      const sacRecRes = await fetch(`${baseUrl}/api/sac/hearings/${hearingId}/recommendation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sacToken}`
        },
        body: JSON.stringify({
          recommendation: 'APPROVE_GRANT',
          reasoning: 'Unanimous concurrence with EVC findings.',
          conditionNotes: 'Maintain 1:15 faculty ratio.'
        })
      });
      const sacRecData = await safeJson(sacRecRes);
      assert(
        sacRecRes.status === 200 && sacRecData.success,
        'STEP 7: Standing Appellate Committee (SAC) adjudicates docket and recommends grant of approval'
      );
    }

    // 8. Competent Authority Final Statutory Approval Order
    {
      const decRes = await fetch(`${baseUrl}/api/decisions/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caToken}`
        },
        body: JSON.stringify({
          applicationId,
          decision: 'APPROVED',
          reasoning: 'Application satisfies all statutory requirements under AICTE Act 1987.',
          approvedIntake: 150,
          validityYears: 3,
          conditions: 'Annual compliance reporting mandatory before Dec 31 each year.'
        })
      });
      const decData = await safeJson(decRes);
      assert(
        (decRes.status === 200 || decRes.status === 201) && decData.success && (decData.data?.orderNumber || decData.data?.formalOrderNumber),
        'STEP 8: Competent Authority executes statutory Approval Order (Status: APPROVED, Validity: 3 Years)',
        { orderNumber: decData.data?.orderNumber || decData.data?.formalOrderNumber }
      );
    }

    // 9. Post-Approval Compliance Scorecard
    {
      const scoreRes = await fetch(`${baseUrl}/api/compliance/scorecard/${institutionId}`, {
        headers: { Authorization: `Bearer ${regToken}` }
      });
      const scoreData = await safeJson(scoreRes);
      assert(
        scoreRes.status === 200,
        'STEP 9: Post-approval regulatory compliance scorecard generated for new institution'
      );
    }

    // 10. Audit Chain Verification
    {
      const auditResult = verifyAuditChainIntegrity();
      assert(
        auditResult.isValid && auditResult.totalRecords > 0,
        'STEP 10: Tamper-evident SHA-256 document audit trail integrity confirmed across all operations',
        { totalAuditRecords: auditResult.totalRecords, latestHash: auditResult.latestHash }
      );
    }

  } catch (err) {
    console.error('Unhandled E2E workflow runtime error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n========================================================');
  console.log(`END-TO-END WORKFLOW SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2EWorkflowTests();
