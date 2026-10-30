const http = require('http');
const app = require('../src/server');
const { db, initDb } = require('../src/db');
const { generateAuthToken } = require('../src/auth');

async function runApiIntegrationTests() {
  console.log('========================================================');
  console.log('AICTE PLATFORM: RUNNING API INTEGRATION & CONTRACT TESTS');
  console.log('========================================================\n');

  initDb();

  // Spin up test server on an ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  async function safeJson(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error(`Failed to parse JSON from ${res.url} (status: ${res.status}):\n${text}`);
      throw e;
    }
  }

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

  // Preload test accounts
  const instUser = db.prepare('SELECT * FROM users WHERE username = ?').get('instadmin');
  const instBUser = db.prepare('SELECT * FROM users WHERE username = ?').get('instadmin_b');
  const scrutinyUser = db.prepare('SELECT * FROM users WHERE username = ?').get('scrutinyofficer');
  const evcUser = db.prepare('SELECT * FROM users WHERE username = ?').get('evcmember');
  const sacUser = db.prepare('SELECT * FROM users WHERE username = ?').get('sacmember');
  const caUser = db.prepare('SELECT * FROM users WHERE username = ?').get('competentauthority');
  const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('superadmin');

  const instToken = generateAuthToken(instUser);
  const instBToken = generateAuthToken(instBUser);
  const scrutinyToken = generateAuthToken(scrutinyUser);
  const evcToken = generateAuthToken(evcUser);
  const sacToken = generateAuthToken(sacUser);
  const caToken = generateAuthToken(caUser);
  const adminToken = generateAuthToken(adminUser);

  try {
    // 1. Direct access block on /uploads
    {
      const res = await fetch(`${baseUrl}/uploads/confidential_audit.pdf`);
      const data = await res.json();
      assert(
        res.status === 403 && data.error && data.error.code === 'DIRECT_ACCESS_FORBIDDEN',
        'Direct static access to /uploads is blocked with HTTP 403 DIRECT_ACCESS_FORBIDDEN',
        { status: res.status, error: data.error }
      );
    }

    // 2. Auth: Bad credentials
    {
      db.prepare("UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE username = 'instadmin'").run();
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'instadmin', password: 'wrongpassword' })
      });
      const data = await safeJson(res);
      assert(
        res.status === 401 && (data.error || data.message),
        'Invalid login credentials returns HTTP 401 Unauthorized',
        { status: res.status, data }
      );
    }

    // 3. Auth: Quick-switch blocked in production
    {
      process.env.NODE_ENV = 'production';
      const res = await fetch(`${baseUrl}/api/auth/quick-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'SUPER_ADMIN' })
      });
      const data = await res.json();
      assert(
        res.status === 403,
        'Quick-switch demo endpoint is strictly rejected (403) in production environment',
        { status: res.status, data }
      );
      process.env.NODE_ENV = 'test';
    }

    // 4. Workflow: Application workflow history & transition validation
    {
      const testApp = db.prepare('SELECT * FROM applications LIMIT 1').get();
      const res = await fetch(`${baseUrl}/api/workflows/history/${testApp.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      assert(
        res.status === 200 && Array.isArray(data.data || data.history || data),
        'Workflow history API returns valid tracking history',
        { status: res.status, count: (data.data || data.history || data).length }
      );
    }

    // 5. Workflow: Transition hold & resume
    {
      const testApp = db.prepare('SELECT * FROM applications LIMIT 1').get();
      // Put on hold
      const holdRes = await fetch(`${baseUrl}/api/workflows/hold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          applicationId: testApp.id,
          reason: 'Automated statutory compliance audit hold'
        })
      });
      const holdData = await holdRes.json();
      assert(
        holdRes.status === 200 && holdData.success,
        'Workflow hold transition succeeds with valid officer remarks',
        { status: holdRes.status, holdData }
      );

      // Resume
      const resumeRes = await fetch(`${baseUrl}/api/workflows/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          applicationId: testApp.id,
          remarks: 'Hold cleared following audit verification'
        })
      });
      const resumeData = await resumeRes.json();
      assert(
        resumeRes.status === 200 && resumeData.success,
        'Workflow resume transition re-activates application',
        { status: resumeRes.status, resumeData }
      );
    }

    // 6. Scrutiny: Evaluation creation, checklist item, deficiency raise & resolution
    {
      const testApp = db.prepare('SELECT * FROM applications LIMIT 1').get();
      // Evaluation
      const evalRes = await fetch(`${baseUrl}/api/scrutiny/evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${scrutinyToken}`
        },
        body: JSON.stringify({
          applicationId: testApp.id,
          checklist: [
            { category: 'Land', status: 'VERIFIED', remarks: 'Land contiguity confirmed' },
            { category: 'Faculty', status: 'VERIFIED', remarks: 'Cadre ratio satisfied' }
          ],
          overallRemarks: 'Preliminary scrutiny satisfactory',
          recommendation: 'APPROVE_FOR_NEXT'
        })
      });
      const evalData = await evalRes.json();
      assert(
        evalRes.status === 200 || evalRes.status === 201,
        'Scrutiny evaluation submitted and saved to database',
        { status: evalRes.status, id: evalData.data?.id }
      );

      // Raise deficiency
      const defRes = await fetch(`${baseUrl}/api/scrutiny/deficiencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${scrutinyToken}`
        },
        body: JSON.stringify({
          applicationId: testApp.id,
          title: 'Missing Land Conversion Certificate',
          description: 'Provide revenue department NA permission certificate',
          severity: 'MAJOR',
          statutoryClause: 'AICTE APH 2026-27 Clause 2.3.1',
          deadlineDays: 14
        })
      });
      const defData = await defRes.json();
      const defId = defData.data?.id;
      assert(
        (defRes.status === 200 || defRes.status === 201) && defId,
        'Deficiency successfully raised with statutory clause and deadline',
        { status: defRes.status, defId }
      );

      // Institution responds to deficiency
      const respondRes = await fetch(`${baseUrl}/api/scrutiny/deficiencies/${defId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instToken}`
        },
        body: JSON.stringify({
          institutionResponse: 'Uploaded collector order dated 15-08-2025'
        })
      });
      const respondData = await respondRes.json();
      assert(
        respondRes.status === 200 && respondData.success,
        'Institution responds to deficiency with bidirectional field support',
        { status: respondRes.status }
      );

      // Scrutiny resolves deficiency
      const resolveRes = await fetch(`${baseUrl}/api/scrutiny/deficiencies/${defId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${scrutinyToken}`
        },
        body: JSON.stringify({
          status: 'RESOLVED',
          remarks: 'Collector order verified and accepted'
        })
      });
      const resolveData = await resolveRes.json();
      assert(
        resolveRes.status === 200 && resolveData.success,
        'Scrutiny officer successfully resolves deficiency',
        { status: resolveRes.status }
      );
    }

    // 7. EVC Management: Committee inspection findings & reporting
    {
      const testApp = db.prepare('SELECT * FROM applications LIMIT 1').get();
      let comm = db.prepare('SELECT id FROM evc_committees WHERE application_id = ?').get(testApp.id);
      if (!comm) {
        comm = { id: 'evc_comm_' + Date.now() };
        db.prepare(`
          INSERT INTO evc_committees (id, code, name, application_id, coordinator_id, status)
          VALUES (?, ?, 'EVC Inspection Committee', ?, ?, 'SCHEDULED')
        `).run(comm.id, 'EVC-' + Math.floor(1000 + Math.random() * 9000), testApp.id, evcUser.id);
      }

      let insp = db.prepare('SELECT id FROM evc_inspections WHERE application_id = ?').get(testApp.id);
      if (!insp) {
        insp = { id: 'insp_' + Date.now() };
        db.prepare(`
          INSERT INTO evc_inspections (id, committee_id, application_id, scheduled_date, status)
          VALUES (?, ?, ?, date('now'), 'SCHEDULED')
        `).run(insp.id, comm.id, testApp.id);
      }

      const evcRes = await fetch(`${baseUrl}/api/evc/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${evcToken}`
        },
        body: JSON.stringify({
          applicationId: testApp.id,
          inspectionId: insp.id,
          findings: 'Physical campus infrastructure and labs verified',
          findingsSummary: 'All workshops and laboratories equipped per AICTE norms',
          infrastructureSatisfactory: true,
          facultySatisfactory: true,
          deficiencyFound: false,
          recommendation: 'RECOMMENDED_APPROVAL'
        })
      });
      const evcData = await safeJson(evcRes);
      assert(
        evcRes.status === 200 && evcData.success,
        'EVC Expert Inspection report submitted with infrastructure & faculty compliance',
        { status: evcRes.status }
      );
    }

    // 8. SAC / SHC Hearings: Committee recommendation
    {
      const testApp = db.prepare('SELECT * FROM applications LIMIT 1').get();
      // Ensure committee exists
      let comm = db.prepare('SELECT id FROM sac_committees LIMIT 1').get();
      if (!comm) {
        db.prepare("INSERT INTO sac_committees (id, code, name, type) VALUES ('sac_comm_01', 'SAC-DEMO', 'Standing Appellate Committee', 'SAC')").run();
        comm = { id: 'sac_comm_01' };
      }

      // Ensure hearing exists
      let hearing = db.prepare('SELECT * FROM sac_hearings WHERE application_id = ?').get(testApp.id);
      if (!hearing) {
        const hearingId = 'sac_test_' + Date.now();
        db.prepare(`
          INSERT INTO sac_hearings (id, committee_id, application_id, scheduled_at, appellant_name, status)
          VALUES (?, ?, ?, datetime('now'), 'Principal', 'SCHEDULED')
        `).run(hearingId, comm.id, testApp.id);
        hearing = { id: hearingId };
      }

      const sacRes = await fetch(`${baseUrl}/api/sac/hearings/${hearing.id}/recommendation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sacToken}`
        },
        body: JSON.stringify({
          recommendation: 'APPROVE_GRANT',
          reasoning: 'Appellate committee found representation valid and verified',
          conditionNotes: 'Subject to continuous faculty cadre compliance'
        })
      });
      const sacData = await safeJson(sacRes);
      assert(
        sacRes.status === 200 && sacData.success,
        'Standing Appellate Committee (SAC) hearing recommendation registered',
        { status: sacRes.status }
      );
    }

    // 9. Competent Authority Decision: Non-CA blocked, Critical Deficiency Block, Statutory Approval
    {
      const testApp = db.prepare('SELECT * FROM applications LIMIT 1').get();
      // Clear any prior open critical test deficiencies so test starts clean
      db.prepare("UPDATE deficiencies SET status = 'RESOLVED' WHERE application_id = ? AND severity = 'CRITICAL'").run(testApp.id);

      // Scrutiny officer attempt to render decision -> 403
      const blockedRes = await fetch(`${baseUrl}/api/decisions/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${scrutinyToken}`
        },
        body: JSON.stringify({
          applicationId: testApp.id,
          decision: 'APPROVED',
          reasoning: 'Unauthorized decision attempt'
        })
      });
      assert(
        blockedRes.status === 403,
        'Statutory separation enforced: Scrutiny Officer blocked from rendering Competent Authority decision (HTTP 403)',
        { status: blockedRes.status }
      );

      // Insert an unresolved CRITICAL deficiency
      const critDefId = 'crit_test_' + Date.now();
      db.prepare(`
        INSERT INTO deficiencies (id, application_id, raised_by_id, raised_by_name, raised_by_role, title, description, severity, status)
        VALUES (?, ?, 'usr_test', 'Auditor', 'AUDITOR', 'Severe Fire Safety Violation', 'No NOC', 'CRITICAL', 'OPEN')
      `).run(critDefId, testApp.id);

      // CA attempt with open CRITICAL deficiency -> 400
      const critBlockedRes = await fetch(`${baseUrl}/api/decisions/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caToken}`
        },
        body: JSON.stringify({
          applicationId: testApp.id,
          decision: 'APPROVED',
          reasoning: 'Approval with critical deficiency'
        })
      });
      const critBlockedData = await safeJson(critBlockedRes);
      const isCritError = critBlockedData.error?.code === 'CRITICAL_DEFICIENCIES_EXIST' || 
                          (typeof critBlockedData.error === 'string' && critBlockedData.error.toLowerCase().includes('critical')) ||
                          (typeof critBlockedData.error?.message === 'string' && critBlockedData.error.message.toLowerCase().includes('critical'));

      assert(
        critBlockedRes.status === 400 && isCritError,
        'Statutory safety lock: Competent Authority cannot approve application with open CRITICAL deficiencies (HTTP 400)',
        { status: critBlockedRes.status, error: critBlockedData.error }
      );

      // Clean up test critical deficiency and ensure no leftover test criticals
      db.prepare('DELETE FROM deficiencies WHERE id = ?').run(critDefId);
      db.prepare("UPDATE deficiencies SET status = 'RESOLVED' WHERE application_id = ? AND severity = 'CRITICAL'").run(testApp.id);

      // Render statutory approval order
      const approveRes = await fetch(`${baseUrl}/api/decisions/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caToken}`
        },
        body: JSON.stringify({
          applicationId: testApp.id,
          decision: 'APPROVED',
          reasoning: 'All statutory committees recommended grant of approval for AY 2026-27',
          approvedIntake: 360,
          validityYears: 3,
          conditions: 'Maintain standard student-faculty cadre ratio.'
        })
      });
      const approveData = await safeJson(approveRes);
      assert(
        (approveRes.status === 200 || approveRes.status === 201) && approveData.success && (approveData.data?.orderNumber || approveData.data?.formalOrderNumber),
        'Competent Authority formally issues statutory Approval Order with Order Number',
        { status: approveRes.status, orderNumber: approveData.data?.orderNumber || approveData.data?.formalOrderNumber }
      );
    }

    // 10. Undertakings: Submission & Verification
    {
      const templatesRes = await fetch(`${baseUrl}/api/undertakings/templates`);
      const templatesData = await safeJson(templatesRes);
      const template = templatesData.data?.[0];
      assert(
        templatesRes.status === 200 && template,
        'Public undertaking templates retrieved successfully',
        { count: templatesData.data?.length, templateTitle: template?.title }
      );

      if (template) {
        const subRes = await fetch(`${baseUrl}/api/undertakings/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${instToken}`
          },
          body: JSON.stringify({
            templateId: template.id,
            title: template.title,
            validityDate: '2027-06-30',
            remarks: 'Formally notarized and sealed by authorized signatory'
          })
        });
        const subData = await safeJson(subRes);
        const undertakingId = subData.data?.id;
        assert(
          (subRes.status === 200 || subRes.status === 201) && undertakingId,
          'Institution submits statutory undertaking',
          { undertakingId }
        );

        // Verification by officer
        const verifyRes = await fetch(`${baseUrl}/api/undertakings/${undertakingId}/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${scrutinyToken}`
          },
          body: JSON.stringify({
            status: 'VERIFIED',
            remarks: 'Undertaking verified by regulatory officer'
          })
        });
        const verifyData = await safeJson(verifyRes);
        assert(
          verifyRes.status === 200 && verifyData.success,
          'Regulatory Officer successfully verifies submitted undertaking',
          { status: verifyRes.status }
        );
      }
    }

    // 11. Compliance Monitoring: Scorecard, Obligations, Evidence Submission & Review
    {
      const scoreRes = await fetch(`${baseUrl}/api/compliance/scorecard/${instUser.institution_id}`, {
        headers: { Authorization: `Bearer ${instToken}` }
      });
      const scoreData = await safeJson(scoreRes);
      assert(
        scoreRes.status === 200 && (scoreData.data?.complianceScore !== undefined || scoreData.complianceScore !== undefined),
        'Real-time institution statutory compliance scorecard calculated',
        { score: scoreData.data?.complianceScore || scoreData.complianceScore }
      );

      // Submit obligation evidence
      const ob = db.prepare('SELECT * FROM compliance_obligations WHERE institution_id = ? LIMIT 1').get(instUser.institution_id);
      if (ob) {
        const evRes = await fetch(`${baseUrl}/api/compliance/obligations/${ob.id}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${instToken}`
          },
          body: JSON.stringify({
            evidenceNotes: 'Bio-metric attendance and AICTE portal upload verified'
          })
        });
        const evData = await safeJson(evRes);
        assert(
          evRes.status === 200 && evData.success,
          'Institution uploads annual compliance monitoring evidence',
          { status: evRes.status }
        );

        // Review by officer
        const revRes = await fetch(`${baseUrl}/api/compliance/obligations/${ob.id}/review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${scrutinyToken}`
          },
          body: JSON.stringify({
            status: 'VERIFIED',
            score: 95
          })
        });
        const revData = await safeJson(revRes);
        assert(
          revRes.status === 200 && revData.success,
          'AICTE Officer validates compliance obligation and recalculates score',
          { status: revRes.status }
        );
      }
    }

    // 12. Notifications: Strict ownership isolation
    {
      // Insert test notifications for instUser and instBUser
      const notifA = 'notif_a_' + Date.now();
      const notifB = 'notif_b_' + Date.now();
      db.prepare(`INSERT INTO notifications (id, user_id, title, message) VALUES (?, ?, 'Notice A', 'Test')`).run(notifA, instUser.id);
      db.prepare(`INSERT INTO notifications (id, user_id, title, message) VALUES (?, ?, 'Notice B', 'Test')`).run(notifB, instBUser.id);

      // InstUser tries to mark InstB's notification as read -> 404 or 403
      const markOtherRes = await fetch(`${baseUrl}/api/notifications/${notifB}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${instToken}` }
      });
      assert(
        markOtherRes.status === 404 || markOtherRes.status === 403,
        'Notification tenant isolation: User cannot mark another user’s notification as read (HTTP 404/403)',
        { status: markOtherRes.status }
      );

      // InstUser marks own notification as read -> 200
      const markOwnRes = await fetch(`${baseUrl}/api/notifications/${notifA}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${instToken}` }
      });
      const markOwnData = await safeJson(markOwnRes);
      assert(
        markOwnRes.status === 200 && markOwnData.success,
        'User successfully marks their own notification as read',
        { status: markOwnRes.status }
      );

      // Cleanup
      db.prepare('DELETE FROM notifications WHERE id IN (?, ?)').run(notifA, notifB);
    }

    // 13. Escalations: Role enforcement
    {
      // Institution user attempts escalation scan -> 403
      const instScanRes = await fetch(`${baseUrl}/api/escalations/scan`, {
        headers: { Authorization: `Bearer ${instToken}` }
      });
      assert(
        instScanRes.status === 403,
        'Institutional applicant blocked from running administrative escalation scans (HTTP 403)',
        { status: instScanRes.status }
      );

      // Council officer / admin scans escalations -> 200
      const adminScanRes = await fetch(`${baseUrl}/api/escalations/scan`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const adminScanData = await safeJson(adminScanRes);
      assert(
        adminScanRes.status === 200 && adminScanData.success,
        'AICTE Council Officer successfully scans overdue SLA escalations',
        { status: adminScanRes.status, escalationsCount: adminScanData.data?.length }
      );
    }

  } catch (err) {
    console.error('Unhandled test suite runtime error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n========================================================');
  console.log(`API INTEGRATION SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runApiIntegrationTests();
