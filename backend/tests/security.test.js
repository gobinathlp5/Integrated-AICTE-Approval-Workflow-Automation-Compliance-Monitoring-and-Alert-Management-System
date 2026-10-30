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
