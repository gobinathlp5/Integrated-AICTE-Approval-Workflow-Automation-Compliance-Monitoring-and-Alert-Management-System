const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_token_government_grade_ci_2026';
}
if (!process.env.DOC_TOKEN_SECRET) {
  process.env.DOC_TOKEN_SECRET = 'test_doc_token_secret_government_grade_ci_2026';
}

const app = require('../src/server');
const { db } = require('../src/db');
const { generateAuthToken, getJwtSecret } = require('../src/auth');

async function runSafeguardsSuite() {
  console.log('========================================================');
  console.log('AICTE PLATFORM: RUNNING TARGETED SECURITY & SAFEGUARDS TEST SUITE');
  console.log('========================================================\n');

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
      return { _raw: text };
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

  // Pre-configured test tokens
  const superAdmin = db.prepare("SELECT * FROM users WHERE role = 'SUPER_ADMIN'").get();
  const caUser = db.prepare("SELECT * FROM users WHERE role = 'COMPETENT_AUTHORITY'").get();
  const roUser = db.prepare("SELECT * FROM users WHERE role = 'REGIONAL_OFFICER'").get();
  const scrutinyUser = db.prepare("SELECT * FROM users WHERE role = 'SCRUTINY_OFFICER'").get();
  const instAUser = db.prepare("SELECT * FROM users WHERE role = 'INSTITUTION_ADMIN' AND institution_id = 'inst_delhi_001'").get();
  const instBUser = db.prepare("SELECT * FROM users WHERE role = 'INSTITUTION_ADMIN' AND institution_id = 'inst_mumbai_002'").get();
  const auditorUser = db.prepare("SELECT * FROM users WHERE role = 'AUDITOR'").get();

  const caToken = generateAuthToken(caUser);
  const roToken = generateAuthToken(roUser);
  const scrutinyToken = generateAuthToken(scrutinyUser);
  const instAToken = generateAuthToken(instAUser);
  const instBToken = generateAuthToken(instBUser);
  const auditorToken = generateAuthToken(auditorUser);

  // Setup sample test application
  const testAppId = 'app_safeguard_test_01';
  db.prepare(`
    INSERT OR REPLACE INTO applications (
      id, application_number, institution_id, academic_year, application_type,
      status, current_stage, region, assigned_scrutiny_officer_id
    ) VALUES (?, 'AICTE-2026-SAFE-01', 'inst_delhi_001', '2026-27', 'EXTENSION_OF_APPROVAL', 'SUBMITTED', 'SUBMITTED', 'Northern', ?)
  `).run(testAppId, scrutinyUser.id);

  // -------------------------------------------------------------
  // PHASE 2: WORKFLOW TRANSITIONS & HISTORY SAFEGUARDS
  // -------------------------------------------------------------
  console.log('\n--- 1. WORKFLOW TRANSITIONS & HISTORY SAFEGUARDS ---');

  // Test 1.1: Skipping mandatory stages is rejected with 409
  {
    const res = await fetch(`${baseUrl}/api/workflows/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${roToken}` },
      body: JSON.stringify({ applicationId: testAppId, toStage: 'COMPETENT_AUTHORITY_REVIEW' })
    });
    const data = await safeJson(res);
    assert(
      res.status === 409 && data.error?.code === 'INVALID_WORKFLOW_TRANSITION',
      'Phase 2.1: Skipping mandatory workflow stages (SUBMITTED -> COMPETENT_AUTHORITY_REVIEW) rejected with 409',
      { status: res.status, code: data.error?.code }
    );
  }

  // Test 1.2: Institutions cannot transition workflow stages (403)
  {
    const res = await fetch(`${baseUrl}/api/workflows/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instAToken}` },
      body: JSON.stringify({ applicationId: testAppId, toStage: 'UNDER_SCRUTINY' })
    });
    assert(
      res.status === 403,
      'Phase 2.2: Institutional applicant strictly blocked from transitioning workflow stage (HTTP 403)',
      { status: res.status }
    );
  }

  // Test 1.3: Auditors cannot transition workflow stages (403)
  {
    const res = await fetch(`${baseUrl}/api/workflows/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auditorToken}` },
      body: JSON.stringify({ applicationId: testAppId, toStage: 'UNDER_SCRUTINY' })
    });
    assert(
      res.status === 403,
      'Phase 2.3: Read-only Auditor strictly blocked from modifying workflow stage (HTTP 403)',
      { status: res.status }
    );
  }

  // Test 1.4: Valid statutory transition succeeds
  {
    const res = await fetch(`${baseUrl}/api/workflows/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${roToken}` },
      body: JSON.stringify({ applicationId: testAppId, toStage: 'UNDER_SCRUTINY', remarks: 'Regional directorate verification complete' })
    });
    const data = await safeJson(res);
    assert(
      res.status === 200 && data.success && data.data?.currentStage === 'UNDER_SCRUTINY',
      'Phase 2.4: Valid statutory transition (SUBMITTED -> UNDER_SCRUTINY) by Regional Officer succeeds',
      { status: res.status, currentStage: data.data?.currentStage }
    );
  }

  // Test 1.5: Identical stage transition is rejected with 409
  {
    const res = await fetch(`${baseUrl}/api/workflows/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${roToken}` },
      body: JSON.stringify({ applicationId: testAppId, toStage: 'UNDER_SCRUTINY' })
    });
    assert(
      res.status === 409,
      'Phase 2.5: Duplicate/redundant transition to same stage rejected with 409 Conflict',
      { status: res.status }
    );
  }

  // Test 1.6: Workflow History Authorization - Cross-institution blocked (403)
  {
    const res = await fetch(`${baseUrl}/api/workflows/history/${testAppId}`, {
      headers: { Authorization: `Bearer ${instBToken}` }
    });
    assert(
      res.status === 403,
      'Phase 2.6: Institution B blocked from accessing Institution A workflow history (HTTP 403)',
      { status: res.status }
    );
  }

  // Test 1.7: Workflow History Authorization - Institution A authorized (200)
  {
    const res = await fetch(`${baseUrl}/api/workflows/history/${testAppId}`, {
      headers: { Authorization: `Bearer ${instAToken}` }
    });
    const data = await safeJson(res);
    assert(
      res.status === 200 && Array.isArray(data.data),
      'Phase 2.7: Institution A successfully retrieves its own workflow history',
      { status: res.status, historyCount: data.data?.length }
    );
  }

  function resetTestApp(appId) {
    db.prepare("DELETE FROM authority_decisions WHERE application_id = ?").run(appId);
    db.prepare("UPDATE applications SET status = 'UNDER_SCRUTINY', current_stage = 'UNDER_SCRUTINY' WHERE id = ?").run(appId);
    db.prepare("UPDATE deficiencies SET status = 'RESOLVED' WHERE application_id = ?").run(appId);
    db.prepare("UPDATE documents SET verification_status = 'VERIFIED' WHERE application_id = ?").run(appId);
    db.prepare(`
      INSERT OR REPLACE INTO scrutiny_evaluations (id, application_id, officer_id, officer_name, status, checklist_json, recommendation)
      VALUES (?, ?, ?, ?, 'COMPLETED', '[]', 'APPROVE_FOR_NEXT')
    `).run('scrutiny_' + appId, appId, scrutinyUser.id, scrutinyUser.full_name);
  }

  // -------------------------------------------------------------
  // PHASE 3: DECISION AUTHORIZATION & VALIDATION SAFEGUARDS
  // -------------------------------------------------------------
  console.log('\n--- 2. DECISION AUTHORIZATION & VALIDATION SAFEGUARDS ---');

  resetTestApp(testAppId);

  // Test 2.1: Unauthorized role accessing pending decisions (403)
  {
    const res = await fetch(`${baseUrl}/api/decisions/pending`, {
      headers: { Authorization: `Bearer ${instAToken}` }
    });
    assert(
      res.status === 403,
      'Phase 3.1: Institutional applicant blocked from accessing pending decision dockets (HTTP 403)',
      { status: res.status }
    );
  }

  // Test 2.2: Auditor accessing pending decisions (403)
  {
    const res = await fetch(`${baseUrl}/api/decisions/pending`, {
      headers: { Authorization: `Bearer ${auditorToken}` }
    });
    assert(
      res.status === 403,
      'Phase 3.2: Auditor role without decision authority blocked from pending decisions (HTTP 403)',
      { status: res.status }
    );
  }

  // Test 2.3: Authorized Competent Authority retrieves pending decisions (200)
  {
    const res = await fetch(`${baseUrl}/api/decisions/pending`, {
      headers: { Authorization: `Bearer ${caToken}` }
    });
    const data = await safeJson(res);
    assert(
      res.status === 200 && Array.isArray(data.data?.pendingApplications),
      'Phase 3.3: Authorized Competent Authority accesses pending decision dockets',
      { count: data.data?.pendingApplications?.length }
    );
  }

  // Test 2.4: Cross-institution decision details access blocked (403)
  {
    const res = await fetch(`${baseUrl}/api/decisions/${testAppId}`, {
      headers: { Authorization: `Bearer ${instBToken}` }
    });
    assert(
      res.status === 403,
      'Phase 3.4: Cross-institution access to decision details blocked with HTTP 403',
      { status: res.status }
    );
  }

  // Test 2.5: Invalid decision enum rejected (400)
  {
    const res = await fetch(`${baseUrl}/api/decisions/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` },
      body: JSON.stringify({
        applicationId: testAppId,
        decision: 'ARBITRARY_DECISION_STRING',
        approvedIntake: 120,
        validityYears: 3
      })
    });
    const data = await safeJson(res);
    assert(
      res.status === 400 && data.error?.code === 'INVALID_DECISION_ENUM',
      'Phase 3.5: Unknown decision enum rejected with 400 INVALID_DECISION_ENUM',
      { status: res.status, code: data.error?.code }
    );
  }

  // Test 2.6: Missing mandatory approvedIntake rejected (400)
  {
    resetTestApp(testAppId);
    const res = await fetch(`${baseUrl}/api/decisions/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` },
      body: JSON.stringify({
        applicationId: testAppId,
        decision: 'APPROVED',
        validityYears: 3
      })
    });
    const data = await safeJson(res);
    assert(
      res.status === 400 && data.error?.code === 'MISSING_MANDATORY_FIELD',
      'Phase 3.6: Approving without explicit approvedIntake rejected (no unsafe default 180 seats)',
      { status: res.status, message: data.error?.message }
    );
  }

  // Test 2.7: Missing mandatory validityYears rejected (400)
  {
    resetTestApp(testAppId);
    const res = await fetch(`${baseUrl}/api/decisions/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` },
      body: JSON.stringify({
        applicationId: testAppId,
        decision: 'APPROVED',
        approvedIntake: 180
      })
    });
    const data = await safeJson(res);
    assert(
      res.status === 400 && data.error?.code === 'MISSING_MANDATORY_FIELD',
      'Phase 3.7: Approving without explicit validityYears rejected (no unsafe default 3 years)',
      { status: res.status, message: data.error?.message }
    );
  }

  // Test 2.8: Duplicate final decision rejected
  {
    // Ensure clean state for testAppId
    db.prepare("DELETE FROM authority_decisions WHERE application_id = ?").run(testAppId);
    db.prepare("UPDATE applications SET status = 'UNDER_SCRUTINY', current_stage = 'UNDER_SCRUTINY' WHERE id = ?").run(testAppId);
    db.prepare("UPDATE deficiencies SET status = 'RESOLVED' WHERE application_id = ?").run(testAppId);
    db.prepare("UPDATE documents SET verification_status = 'VERIFIED' WHERE application_id = ?").run(testAppId);

    // Ensure scrutiny complete
    db.prepare(`
      INSERT OR REPLACE INTO scrutiny_evaluations (id, application_id, officer_id, officer_name, status, checklist_json, recommendation)
      VALUES ('scrutiny_safe_01', ?, ?, ?, 'COMPLETED', '[]', 'APPROVE_FOR_NEXT')
    `).run(testAppId, scrutinyUser.id, scrutinyUser.full_name);

    // First valid approval
    const res1 = await fetch(`${baseUrl}/api/decisions/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` },
      body: JSON.stringify({
        applicationId: testAppId,
        decision: 'APPROVED',
        approvedIntake: 180,
        validityYears: 3,
        reasoning: 'Compliance satisfied'
      })
    });
    const data1 = await safeJson(res1);
    const orderNum1 = data1.data?.formalOrderNumber;

    // Second attempt to approve same application -> 400/409 duplicate decision
    const res2 = await fetch(`${baseUrl}/api/decisions/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` },
      body: JSON.stringify({
        applicationId: testAppId,
        decision: 'APPROVED',
        approvedIntake: 180,
        validityYears: 3,
        reasoning: 'Second approval attempt'
      })
    });
    const data2 = await safeJson(res2);

    assert(
      res1.status === 201 && res2.status === 400 && JSON.stringify(data2).toLowerCase().includes('already'),
      'Phase 3.8: Duplicate final statutory decision attempt is strictly rejected',
      { orderNum1, duplicateAttemptStatus: res2.status }
    );
  }

  // Test 2.9: Deterministic Order Number Sequence allocation
  {
    // Generate order number through sequence allocation
    const testAppId2 = 'app_safeguard_test_02';
    db.prepare(`
      INSERT OR REPLACE INTO applications (
        id, application_number, institution_id, academic_year, application_type,
        status, current_stage, region
      ) VALUES (?, 'AICTE-2026-SAFE-02', 'inst_delhi_001', '2026-27', 'EXTENSION_OF_APPROVAL', 'UNDER_SCRUTINY', 'UNDER_SCRUTINY', 'Northern')
    `).run(testAppId2);

    db.prepare("DELETE FROM authority_decisions WHERE application_id = ?").run(testAppId2);
    db.prepare(`
      INSERT OR REPLACE INTO scrutiny_evaluations (id, application_id, officer_id, officer_name, status, checklist_json, recommendation)
      VALUES ('scrutiny_safe_02', ?, ?, ?, 'COMPLETED', '[]', 'APPROVE_FOR_NEXT')
    `).run(testAppId2, scrutinyUser.id, scrutinyUser.full_name);

    const res = await fetch(`${baseUrl}/api/decisions/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${caToken}` },
      body: JSON.stringify({
        applicationId: testAppId2,
        decision: 'APPROVED',
        approvedIntake: 120,
        validityYears: 2,
        reasoning: 'Valid compliance evidence'
      })
    });
    const data = await safeJson(res);
    const orderNumber = data.data?.formalOrderNumber;
    const isSequentialFormat = /^AICTE\/ORDER\/\d{4}\/\d{6}$/.test(orderNumber);

    assert(
      res.status === 201 && isSequentialFormat,
      'Phase 3.9: Controlled deterministic order number sequence format verified (e.g. AICTE/ORDER/2026/00000X)',
      { orderNumber }
    );
  }

  // -------------------------------------------------------------
  // PHASE 4: JWT SECRET & AUTHENTICATION SAFEGUARDS
  // -------------------------------------------------------------
  console.log('\n--- 3. JWT SECRET & AUTHENTICATION SAFEGUARDS ---');

  // Test 3.1: Missing JWT secret throws error securely
  {
    let threwMissing = false;
    const originalSecret = process.env.JWT_SECRET;
    try {
      delete process.env.JWT_SECRET;
      getJwtSecret();
    } catch (err) {
      threwMissing = err.message.includes('FATAL SECURITY ERROR') && err.message.includes('missing');
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
    assert(
      threwMissing,
      'Phase 4.1: Missing JWT_SECRET environment variable causes security service to fail securely'
    );
  }

  // Test 3.2: Short JWT secret (<32 chars) throws error securely
  {
    let threwShort = false;
    const originalSecret = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = 'short-weak-secret';
      getJwtSecret();
    } catch (err) {
      threwShort = err.message.includes('FATAL SECURITY ERROR') && err.message.includes('at least 32 characters');
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
    assert(
      threwShort,
      'Phase 4.2: Insufficient JWT_SECRET (< 32 characters) is rejected with cryptographic strength warning'
    );
  }

  // Test 3.3: Invalid JWT signature rejected with 403
  {
    const tamperedToken = caToken.slice(0, -6) + 'abcdef';
    const res = await fetch(`${baseUrl}/api/decisions/pending`, {
      headers: { Authorization: `Bearer ${tamperedToken}` }
    });
    assert(
      res.status === 403,
      'Phase 4.3: Tampered/forged JWT signature strictly rejected with HTTP 403 Forbidden',
      { status: res.status }
    );
  }

  // Test 3.4: Missing Authorization header rejected with 401
  {
    const res = await fetch(`${baseUrl}/api/decisions/pending`);
    assert(
      res.status === 401,
      'Phase 4.4: Missing Authorization header returns HTTP 401 Unauthorized',
      { status: res.status }
    );
  }

  // Cleanup test dockets safely
  db.pragma('foreign_keys = OFF');
  db.prepare("DELETE FROM authority_decisions WHERE application_id IN ('app_safeguard_test_01', 'app_safeguard_test_02')").run();
  db.prepare("DELETE FROM scrutiny_evaluations WHERE application_id IN ('app_safeguard_test_01', 'app_safeguard_test_02')").run();
  db.prepare("DELETE FROM application_workflow_history WHERE application_id IN ('app_safeguard_test_01', 'app_safeguard_test_02')").run();
  db.prepare("DELETE FROM deficiencies WHERE application_id IN ('app_safeguard_test_01', 'app_safeguard_test_02')").run();
  db.prepare("DELETE FROM escalations WHERE application_id IN ('app_safeguard_test_01', 'app_safeguard_test_02')").run();
  db.prepare("DELETE FROM applications WHERE id IN ('app_safeguard_test_01', 'app_safeguard_test_02')").run();
  db.pragma('foreign_keys = ON');

  server.close();

  console.log('\n========================================================');
  console.log(`SAFEGUARDS SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSafeguardsSuite().catch((err) => {
  console.error('Safeguards test execution error:', err);
  process.exit(1);
});
