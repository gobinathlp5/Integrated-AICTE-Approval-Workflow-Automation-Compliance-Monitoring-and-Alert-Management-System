const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_token_government_grade_ci_2026';
}
if (!process.env.DOC_TOKEN_SECRET) {
  process.env.DOC_TOKEN_SECRET = 'test_doc_token_secret_government_grade_ci_2026';
}
const { runAllSecurityTests } = require('../src/routes/securityTestRoutes');

console.log('========================================================');
console.log('AICTE PLATFORM: RUNNING MANDATORY SECURITY & ACCEPTANCE TESTS');
console.log('========================================================\n');

const report = runAllSecurityTests();

report.results.forEach((test, idx) => {
  const icon = test.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] ${test.testId}: ${test.title}`);
  console.log(`       Outcome: ${test.details}`);
  if (test.technicalEvidence) {
    console.log(`       Evidence: ${JSON.stringify(test.technicalEvidence, null, 2).replace(/\n/g, '\n       ')}`);
  }
  console.log('');
});

console.log('========================================================');
console.log(`SUMMARY: ${report.passCount} of ${report.totalTests} tests PASSED (${report.failCount} failed).`);
console.log('========================================================\n');

if (!report.success) {
  process.exit(1);
} else {
  console.log('All backend security controls, tenant boundaries, and acceptance tests PASSED!');
  process.exit(0);
}
