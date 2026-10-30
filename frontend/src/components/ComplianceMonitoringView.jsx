import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertTriangle, CheckCircle, Clock, FileCheck, 
  RefreshCw, TrendingUp, Send, Check 
} from 'lucide-react';
import { complianceApi, institutionApi } from '../api';

export default function ComplianceMonitoringView({ user }) {
  const [institutionId, setInstitutionId] = useState(user?.institutionId || 'inst_delhi_001');
  const [scorecard, setScorecard] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Evidence Submit Modal
  const [submittingOblId, setSubmittingOblId] = useState(null);
  const [evidenceNotes, setEvidenceNotes] = useState('');

  useEffect(() => {
    loadComplianceData(institutionId);
  }, [institutionId]);

  const loadComplianceData = async (instId) => {
    setLoading(true);
    try {
      const [scoreRes, oblRes] = await Promise.all([
        complianceApi.getScorecard(instId),
        complianceApi.getObligations(instId)
      ]);
      setScorecard(scoreRes);
      setObligations(oblRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEvidence = async (oblId) => {
    if (!evidenceNotes) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await complianceApi.submitEvidence(oblId, null, evidenceNotes);
      setStatusMessage({ type: 'success', text: 'Compliance evidence submitted to Regulation Bureau.' });
      setSubmittingOblId(null);
      setEvidenceNotes('');
      await loadComplianceData(institutionId);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewEvidence = async (oblId, status) => {
    const reviewNotes = prompt('Enter bureau review remarks:');
    if (!reviewNotes) return;
    setActionLoading(true);
    try {
      await complianceApi.reviewEvidence(oblId, status, reviewNotes);
      await loadComplianceData(institutionId);
    } catch (err) {
      alert('Review failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isBureauOrAdmin = user && (user.role === 'REGULATION_BUREAU' || user.role === 'BUREAU_OFFICER' || user.role === 'REGIONAL_OFFICER' || user.role === 'SUPER_ADMIN' || user.role === 'AICTE_ADMIN');
  const isInstitution = user && (user.role === 'INSTITUTION_ADMIN' || user.role === 'INSTITUTION_STAFF');

  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="bg-white rounded-lg border-l-4 border-[#F2A900] border border-[#DCE3EA] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1B5E80]">REGULATION BUREAU</span>
              <span className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-mono font-bold">Annual Governance</span>
            </div>
            <h1 className="text-xl font-bold text-[#12345A] mt-1">Compliance Monitoring & Institutional Scorecard</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuous monitoring of statutory obligations: 7th CPC Pay Scale, Anti-Ragging Committee, Fire NOC, and Mandatory Public Disclosures.
            </p>
          </div>
          <button
            onClick={() => loadComplianceData(institutionId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-lg text-xs font-medium border flex items-center justify-between ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}>✕</button>
        </div>
      )}

      {/* Institution Filter for Council Officers */}
      {isBureauOrAdmin && (
        <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] flex items-center gap-4">
          <label className="text-xs font-bold text-[#12345A]">Select Inspected Institution:</label>
          <select
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800"
          >
            <option value="inst_delhi_001">Delhi Institute of Technology & Management (1-10928374)</option>
            <option value="inst_mumbai_002">Mumbai Technical Academy (1-98765432)</option>
            <option value="inst_bengaluru_003">Bengaluru Advanced Engineering College (1-45678901)</option>
          </select>
        </div>
      )}

      {/* Scorecard Metric Tiles */}
      {scorecard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg text-[#12345A]">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#12345A]">{scorecard.compliancePercentage}%</div>
              <div className="text-[11px] text-slate-500 font-medium">Compliance Index</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-700">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-700">{scorecard.compliantCount} / {scorecard.totalObligations}</div>
              <div className="text-[11px] text-slate-500 font-medium">Fulfilled Obligations</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs flex items-center gap-3">
            <div className="p-3 bg-amber-50 rounded-lg text-amber-700">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700">{scorecard.pendingCount}</div>
              <div className="text-[11px] text-slate-500 font-medium">Pending Returns</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-lg text-red-700">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-700">{scorecard.overdueCount}</div>
              <div className="text-[11px] text-slate-500 font-medium">Overdue Breaches</div>
            </div>
          </div>
        </div>
      )}

      {/* Obligations Table Card */}
      <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
        <h2 className="text-xs font-bold text-[#12345A] uppercase tracking-wide pb-2 border-b border-slate-100">
          Statutory Compliance Obligation Register
        </h2>

        {obligations.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center">
            No active compliance obligations registered for this institution.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Obligation Title</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Statutory Deadline</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {obligations.map(obl => (
                  <tr key={obl.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{obl.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">AY: {obl.academic_year}</div>
                      {obl.evidence_notes && (
                        <div className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded mt-1 border border-slate-200">
                          <strong>Evidence Submitted:</strong> {obl.evidence_notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
                        {obl.obligation_category}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700">
                      {obl.due_date}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        obl.status === 'COMPLIANT' ? 'bg-emerald-100 text-emerald-800' :
                        obl.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                        obl.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {obl.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1">
                      {/* Institution Evidence Submission */}
                      {isInstitution && obl.status !== 'COMPLIANT' && (
                        <>
                          {submittingOblId === obl.id ? (
                            <div className="flex items-center gap-1.5 justify-end mt-1">
                              <input
                                type="text"
                                value={evidenceNotes}
                                onChange={(e) => setEvidenceNotes(e.target.value)}
                                placeholder="Disbursement reference / Gazetted URL..."
                                className="bg-white border border-slate-300 rounded px-2 py-1 text-[11px] w-48"
                              />
                              <button
                                onClick={() => handleSubmitEvidence(obl.id)}
                                className="px-2 py-1 bg-[#12345A] text-white rounded text-[10px] font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setSubmittingOblId(null)}
                                className="px-1.5 py-1 bg-slate-200 rounded text-[10px]"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setSubmittingOblId(obl.id); setEvidenceNotes(''); }}
                              className="px-2.5 py-1 rounded bg-[#1B5E80] text-white text-[10px] font-semibold hover:bg-[#12345A]"
                            >
                              Submit Evidence
                            </button>
                          )}
                        </>
                      )}

                      {/* Bureau Review Actions */}
                      {isBureauOrAdmin && obl.status === 'SUBMITTED' && (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => handleReviewEvidence(obl.id, 'COMPLIANT')}
                            className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700"
                          >
                            ✓ Validate
                          </button>
                          <button
                            onClick={() => handleReviewEvidence(obl.id, 'PENDING')}
                            className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-semibold hover:bg-red-700"
                          >
                            ✕ Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
