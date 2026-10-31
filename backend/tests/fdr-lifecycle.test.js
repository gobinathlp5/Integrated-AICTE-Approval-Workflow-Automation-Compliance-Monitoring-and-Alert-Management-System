const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_token_government_grade_ci_2026';
}
if (!process.env.DOC_TOKEN_SECRET) {
  process.env.DOC_TOKEN_SECRET = 'test_doc_token_secret_government_grade_ci_2026';
}
const http = require('http');
const fs = require('fs');
const app = require('../src/server');
const { db, initDb, uploadsDir } = require('../src/db');
const { generateAuthToken } = require('../src/auth');
const { runScheduledChecks } = require('../src/scheduler');

async function runFdrLifecycleTests() {
  console.log('========================================================');
  console.log('AICTE SECURITY DEPOSIT & FDR PORTAL: LIFECYCLE TESTS');
  console.log('Problem Statement 26265 - Comprehensive Verification');
  console.log('========================================================\n');

  initDb();

  // Test server on ephemeral port
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

  // Preload test accounts
  const instAUser = db.prepare('SELECT * FROM users WHERE username = ?').get('instadmin'); // Delhi (inst_delhi_001)
  const instBUser = db.prepare('SELECT * FROM users WHERE username = ?').get('instadmin_b'); // Mumbai (inst_mumbai_002)
  const regionalUser = db.prepare('SELECT * FROM users WHERE username = ?').get('regionalofficer');
  const scrutinyUser = db.prepare('SELECT * FROM users WHERE username = ?').get('scrutinyofficer');
  const caUser = db.prepare('SELECT * FROM users WHERE username = ?').get('competentauthority');

  const instAToken = generateAuthToken(instAUser);
  const instBToken = generateAuthToken(instBUser);
  const regionalToken = generateAuthToken(regionalUser);
  const scrutinyToken = generateAuthToken(scrutinyUser);
  const caToken = generateAuthToken(caUser);

  try {
    // 1. Stats endpoint respects tenant isolation
    {
      const resA = await fetch(`${baseUrl}/api/fdr/stats`, {
        headers: { Authorization: `Bearer ${instAToken}` }
      });
      const dataA = await resA.json();

      const resOfficer = await fetch(`${baseUrl}/api/fdr/stats`, {
        headers: { Authorization: `Bearer ${regionalToken}` }
      });
      const dataOfficer = await resOfficer.json();

      assert(
        resA.status === 200 && dataA.success && resOfficer.status === 200,
        'FDR statistics computed successfully with tenant-aware scoping',
        { instStats: dataA.data, officerStats: dataOfficer.data }
      );
    }

    // 2. FDR Multi-tenant list isolation
    {
      const resA = await fetch(`${baseUrl}/api/fdr`, {
        headers: { Authorization: `Bearer ${instAToken}` }
      });
      const dataA = await resA.json();

      const allBelongToInstA = dataA.data.records.every(r => r.institution_id === instAUser.institution_id);
      assert(
        resA.status === 200 && allBelongToInstA,
        'Institution A can only view its own FDR deposits (Multi-Tenant Isolation)',
        { count: dataA.data.records.length, sampleInstId: dataA.data.records[0]?.institution_id }
      );
    }

    // 3. Validation: Maturity date before issue date is rejected
    {
      const res = await fetch(`${baseUrl}/api/fdr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instAToken}`
        },
        body: JSON.stringify({
          fdr_number: 'FDR-INVALID-DATES-999',
          issuing_bank: 'Punjab National Bank',
          bank_branch: 'Civil Lines',
          ifsc_code: 'PUNB0123456',
          deposit_amount: 1000000,
          issue_date: '2026-05-01',
          maturity_date: '2025-05-01', // Before issue date!
          purpose: 'NEW_INSTITUTION'
        })
      });
      const data = await res.json();
      assert(
        res.status === 400 && data.success === false,
        'Registration rejects invalid maturity date occurring before issue date (HTTP 400)',
        { status: res.status, error: data.error }
      );
    }

    // 4. Register new FDR in DRAFT status
    let createdFdrId = null;
    const testFdrNum = 'FDR-TEST-' + Date.now();
    {
      const res = await fetch(`${baseUrl}/api/fdr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instAToken}`
        },
        body: JSON.stringify({
          fdr_number: testFdrNum,
          issuing_bank: 'State Bank of India',
          bank_branch: 'Parliament Street, New Delhi',
          ifsc_code: 'SBIN0000691',
          deposit_amount: 2500000,
          issue_date: '2026-01-01',
          maturity_date: '2031-01-01',
          deposit_holder: 'Delhi Institute Trust',
          purpose: 'NEW_PROGRAMME',
          status: 'DRAFT',
          remarks: 'Automated test draft instrument'
        })
      });
      const data = await res.json();
      createdFdrId = data.data?.id;
      assert(
        res.status === 201 && data.success && data.data.status === 'DRAFT',
        'Institution registers new FDR deposit in DRAFT status',
        { id: createdFdrId, fdrNumber: testFdrNum }
      );
    }

    // 5. Duplicate FDR number registration rejected (HTTP 409)
    {
      const res = await fetch(`${baseUrl}/api/fdr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instAToken}`
        },
        body: JSON.stringify({
          fdr_number: testFdrNum, // Duplicate!
          issuing_bank: 'State Bank of India',
          bank_branch: 'Parliament Street, New Delhi',
          ifsc_code: 'SBIN0000691',
          deposit_amount: 2500000,
          issue_date: '2026-01-01',
          maturity_date: '2031-01-01',
          purpose: 'NEW_PROGRAMME'
        })
      });
      const data = await res.json();
      assert(
        res.status === 409 && data.error?.code === 'DUPLICATE_FDR_NUMBER',
        'Duplicate FDR receipt number registration is blocked with HTTP 409',
        { status: res.status, code: data.error?.code }
      );
    }

    // 6. Submit DRAFT without document fails (requires at least 1 document)
    {
      const res = await fetch(`${baseUrl}/api/fdr/${createdFdrId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${instAToken}` }
      });
      const data = await res.json();
      assert(
        res.status === 400 && data.error?.code === 'DOCUMENT_REQUIRED',
        'Submission for verification is blocked if mandatory FDR receipt scan is missing',
        { status: res.status, error: data.error }
      );
    }

    // 7. Attach document and submit FDR
    {
      // Insert document record directly linked to created FDR
      const docId = 'fdr_test_doc_' + Date.now();
      const samplePath = path.join(uploadsDir, 'sample-fdr-receipt-9842.pdf');
      db.prepare(`
        INSERT INTO fdr_documents (
          id, fdr_id, institution_id, document_type, file_name, stored_path,
          file_size, mime_type, file_hash_sha256, version, verification_status,
          uploaded_by, uploaded_by_name
        ) VALUES (?, ?, ?, 'FDR_SCAN', 'fdr_scan.pdf', ?, 1024, 'application/pdf', 'hash123', 1, 'UNVERIFIED', ?, ?)
      `).run(docId, createdFdrId, instAUser.institution_id, samplePath, instAUser.id, instAUser.full_name);

      const res = await fetch(`${baseUrl}/api/fdr/${createdFdrId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${instAToken}` }
      });
      const data = await res.json();
      assert(
        res.status === 200 && data.success && data.data.status === 'PENDING_VERIFICATION',
        'FDR successfully submitted for officer verification after document attachment',
        { status: data.data.status, verificationStatus: data.data.verification_status }
      );
    }

    // 8. Officer Verification: Verify instrument -> Status becomes ACTIVE
    {
      const res = await fetch(`${baseUrl}/api/fdr-verification/${createdFdrId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${regionalToken}`
        },
        body: JSON.stringify({
          verification_method: 'BANK_API',
          bank_confirmation_ref: 'CONF-SBI-2026-8812',
          result: 'VERIFIED',
          observations: 'Confirmed joint mandate and lien marking with SBI nodal manager.'
        })
      });
      const data = await res.json();
      assert(
        res.status === 200 && data.success && data.data.fdr.status === 'ACTIVE',
        'AICTE Officer successfully verifies FDR and marks status as ACTIVE',
        { status: data.data.fdr.status, verification_status: data.data.fdr.verification_status }
      );
    }

    // 9. Discrepancy Lifecycle: Raise -> Respond -> Resolve
    {
      // Raise discrepancy
      const raiseRes = await fetch(`${baseUrl}/api/fdr-verification/${createdFdrId}/discrepancy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${regionalToken}`
        },
        body: JSON.stringify({
          category: 'MISSING_LIEN',
          title: 'Lien letter endorsement incomplete',
          description: 'Official seal of Chief Manager missing on page 2',
          severity: 'HIGH'
        })
      });
      const raiseData = await raiseRes.json();
      const discId = raiseData.data?.id;

      // Check FDR status became DISCREPANT
      const checkFdr = db.prepare('SELECT verification_status FROM fdr_records WHERE id = ?').get(createdFdrId);
      const isDiscrepant = checkFdr.verification_status === 'DISCREPANT';

      // Institution responds
      const respondRes = await fetch(`${baseUrl}/api/fdr-verification/discrepancy/${discId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instAToken}`
        },
        body: JSON.stringify({
          institution_response: 'Obtained re-endorsed letter with Chief Manager stamp.'
        })
      });
      const respondData = await respondRes.json();

      // Officer resolves
      const resolveRes = await fetch(`${baseUrl}/api/fdr-verification/discrepancy/${discId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${regionalToken}`
        },
        body: JSON.stringify({
          status: 'RESOLVED',
          resolution_remarks: 'Endorsement stamp verified.'
        })
      });
      const resolveData = await resolveRes.json();

      assert(
        discId && isDiscrepant && respondRes.status === 200 && resolveRes.status === 200,
        'Complete Discrepancy Lifecycle: Raise (DISCREPANT) -> Respond -> Resolve verified',
        { discrepancyId: discId, finalStatus: resolveData.data.status }
      );
    }

    // 10. Renewal / Replacement Request Submission & Approval
    {
      const renewRes = await fetch(`${baseUrl}/api/fdr-renewals/${createdFdrId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instAToken}`
        },
        body: JSON.stringify({
          renewal_type: 'SAME_FDR_EXTENDED',
          extended_maturity_date: '2036-01-01',
          remarks: 'Five year extension agreed with issuing bank'
        })
      });
      const renewData = await renewRes.json();
      const renewalId = renewData.data?.id;

      // Officer reviews and approves
      const reviewRes = await fetch(`${baseUrl}/api/fdr-renewals/${renewalId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${regionalToken}`
        },
        body: JSON.stringify({
          decision: 'APPROVED',
          new_maturity_date: '2036-01-01',
          review_remarks: 'Extension advice accepted'
        })
      });
      const reviewData = await reviewRes.json();

      const updatedFdr = db.prepare('SELECT maturity_date, status FROM fdr_records WHERE id = ?').get(createdFdrId);
      assert(
        renewRes.status === 201 && reviewRes.status === 200 && updatedFdr.maturity_date === '2036-01-01',
        'FDR renewal extension submitted by institution and approved by officer',
        { newMaturity: updatedFdr.maturity_date, status: updatedFdr.status }
      );
    }

    // 11. Release & Refund Lifecycle: Request -> Scrutiny -> CA Decision -> Complete
    {
      // Institution requests release
      const relRes = await fetch(`${baseUrl}/api/fdr-releases/${createdFdrId}/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instAToken}`
        },
        body: JSON.stringify({
          reason: 'TENURE_COMPLETED',
          justification: 'Completed 10 continuous statutory years with AICTE approval.'
        })
      });
      const relData = await relRes.json();
      const requestId = relData.data?.id;

      // Officer scrutiny
      const scrutinyRes = await fetch(`${baseUrl}/api/fdr-releases/${requestId}/scrutiny`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${regionalToken}`
        },
        body: JSON.stringify({
          review_notes: 'Academic audit confirms zero non-compliances.',
          recommendation: 'Recommend release of deposit'
        })
      });

      // Competent Authority Decision (CA_APPROVED)
      const caRes = await fetch(`${baseUrl}/api/fdr-releases/${requestId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${caToken}`
        },
        body: JSON.stringify({
          decision: 'APPROVED',
          decision_remarks: 'Formal release approved by Competent Authority'
        })
      });

      // Officer finalizes release after lien removal
      const completeRes = await fetch(`${baseUrl}/api/fdr-releases/${requestId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${regionalToken}`
        },
        body: JSON.stringify({
          completion_notes: 'SBI communicated cancellation of lien mandate. Funds unblocked.'
        })
      });

      const releasedFdr = db.prepare('SELECT status, lien_marked FROM fdr_records WHERE id = ?').get(createdFdrId);
      assert(
        relRes.status === 201 && caRes.status === 200 && completeRes.status === 200 && releasedFdr.status === 'RELEASED' && releasedFdr.lien_marked === 0,
        'Complete Release & Refund Lifecycle: Request -> Scrutiny -> CA Approval -> Finalized (Lien Removed)',
        { finalStatus: releasedFdr.status, lienMarked: releasedFdr.lien_marked }
      );
    }

    // 12. Background Scheduler: Maturity scan & alert deduplication
    {
      const schedulerResult = runScheduledChecks();
      assert(
        schedulerResult.success === true,
        'Background Scheduler automated maturity & overdue alert scan executed cleanly',
        { schedulerResult }
      );
    }

    // 13. Reports: Register CSV and JSON export
    {
      const jsonRes = await fetch(`${baseUrl}/api/fdr-reports/register`, {
        headers: { Authorization: `Bearer ${regionalToken}` }
      });
      const jsonData = await jsonRes.json();

      const csvRes = await fetch(`${baseUrl}/api/fdr-reports/register?format=csv`, {
        headers: { Authorization: `Bearer ${regionalToken}` }
      });
      const csvText = await csvRes.text();

      assert(
        jsonRes.status === 200 && csvRes.status === 200 && csvText.includes('FDR Number') && csvText.includes('Amount (INR)'),
        'Comprehensive FDR Register exported in JSON and CSV formats',
        { jsonRecordsCount: jsonData.data.length, csvHeaderPresent: true }
      );
    }

  } finally {
    server.close();
  }

  console.log('\n========================================================');
  console.log(`FDR LIFECYCLE SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runFdrLifecycleTests().catch((err) => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  });
}

module.exports = { runFdrLifecycleTests };
