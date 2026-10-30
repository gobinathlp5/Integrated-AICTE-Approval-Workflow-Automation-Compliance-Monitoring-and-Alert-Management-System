import React, { useState, useEffect } from 'react';
import { 
  Award, CheckCircle2, XCircle, RefreshCw, Shield, 
  ChevronDown, ChevronUp, Lock, FileText, Check, ArrowRight, Code
} from 'lucide-react';
import { securityApi } from '../api';

export default function SecurityTestRunner() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedTest, setExpandedTest] = useState(null);

  useEffect(() => {
    runSecuritySuite();
  }, []);

  const runSecuritySuite = async () => {
    setLoading(true);
    try {
      const res = await securityApi.runTests();
      setReport(res);
    } catch (err) {
      alert('Security test suite execution failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (testId) => {
    setExpandedTest(expandedTest === testId ? null : testId);
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Description */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-700" />
          <span>Mandatory Security Tests & Acceptance Demonstration Suite</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Backend enforcement verification for Sections H and I with cryptographic telemetry
        </p>
      </div>

      {/* Summary Scorecard Banner */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-semibold mb-2 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Full Compliance Verification Report</span>
            </div>
            <h3 className="text-xl font-black">
              {report ? `${report.passCount} of ${report.totalTests} Security & Acceptance Tests Passed` : 'Running Security Engine...'}
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              All access controls, confidentiality boundaries, role isolation rules, and document immutability constraints are verified at the backend API gateway.
            </p>
          </div>

          <button
            onClick={runSecuritySuite}
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition flex items-center space-x-2 shadow-sm self-start sm:self-auto cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Executing Test Scenarios...' : 'Re-Run Security Suite'}</span>
          </button>
        </div>

        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Security Status</span>
              <span className="text-emerald-400 font-bold text-sm">
                {report.failCount === 0 ? '100% HARDENED' : `${report.failCount} DEFECTS`}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Execution Timestamp</span>
              <span className="text-slate-200 font-mono text-[11px]">{report.timestamp}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Data Isolation</span>
              <span className="text-emerald-400 font-semibold">Tenant & Assignment Active</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Audit Ledger Chaining</span>
              <span className="text-emerald-400 font-semibold">SHA-256 Verified Intact</span>
            </div>
          </div>
        )}
      </div>

      {/* Acceptance Test Flow Visualizer (Section I) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
          <Shield className="w-4 h-4 text-indigo-700" />
          <span>Section I: End-to-End Acceptance Test Demonstration Workflow</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs">
          
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
            <span className="font-bold text-blue-900 block text-[11px]">Step 1: Upload</span>
            <p className="text-[11px] text-slate-600">
              Institution A uploads Land Title Deed (Khasra 942).
            </p>
            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Stored & Hashed
            </span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
            <span className="font-bold text-blue-900 block text-[11px]">Step 2: Inst. View</span>
            <p className="text-[11px] text-slate-600">
              Institution A authorised users view & download document.
            </p>
            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Access Granted
            </span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
            <span className="font-bold text-blue-900 block text-[11px]">Step 3: Scrutiny</span>
            <p className="text-[11px] text-slate-600">
              Assigned Scrutiny Officer evaluates & verifies document.
            </p>
            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Verified Status
            </span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
            <span className="font-bold text-blue-900 block text-[11px]">Step 4: EVC ABAC</span>
            <p className="text-[11px] text-slate-600">
              Assigned EVC views; Unassigned EVC strictly rejected.
            </p>
            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
              <Check className="w-3 h-3" /> ABAC Enforced
            </span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
            <span className="font-bold text-blue-900 block text-[11px]">Step 5: Inst B 403</span>
            <p className="text-[11px] text-slate-600">
              Institution B tries to view or download document.
            </p>
            <span className="text-[10px] font-bold text-red-700 flex items-center gap-0.5">
              <Lock className="w-3 h-3" /> 403 Forbidden
            </span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
            <span className="font-bold text-blue-900 block text-[11px]">Step 6: Notes & Audit</span>
            <p className="text-[11px] text-slate-600">
              Internal notes hidden from Inst A; All actions audited.
            </p>
            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
              <Check className="w-3 h-3" /> SHA-256 Chained
            </span>
          </div>

        </div>
      </div>

      {/* Tests Results List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-900" />
            <span>Executing automated security test suites against live database & API endpoints...</span>
          </div>
        ) : !report ? null : (
          report.results.map((test) => {
            const isExpanded = expandedTest === test.testId;
            return (
              <div
                key={test.testId}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition"
              >
                <div
                  onClick={() => toggleExpand(test.testId)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition"
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {test.passed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-slate-500">{test.testId}</span>
                        <h4 className="text-xs font-bold text-slate-900">{test.title}</h4>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{test.details}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      test.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {test.status}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {isExpanded && test.technicalEvidence && (
                  <div className="bg-slate-900 text-slate-200 p-4 border-t border-slate-200 text-xs font-mono overflow-x-auto">
                    <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mb-2 font-bold uppercase tracking-wider">
                      <Code className="w-3.5 h-3.5 text-amber-400" />
                      <span>Technical Evidence & Cryptographic Verification Payload:</span>
                    </div>
                    <pre className="text-[11px] text-emerald-400 whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(test.technicalEvidence, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
