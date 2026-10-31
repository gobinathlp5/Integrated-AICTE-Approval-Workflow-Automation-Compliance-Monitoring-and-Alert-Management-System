import React, { useState, useEffect } from 'react';
import {
  DollarSign, Shield, CheckCircle2, AlertTriangle, Clock, RefreshCw,
  Landmark, ArrowRight, Check, X, FileText, AlertCircle, Award
} from 'lucide-react';
import { fdrReleaseApi } from '../api';

export default function FdrReleasesView({ user, onSelectFdr }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Scrutiny Modal
  const [scrutinyModalOpen, setScrutinyModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [scrutinyForm, setScrutinyForm] = useState({ review_notes: '', recommendation: 'Recommend release' });

  // Decision Modal (CA)
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionForm, setDecisionForm] = useState({ decision: 'APPROVED', decision_remarks: '' });

  // Complete Modal
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOfficer = user && [
    'SUPER_ADMIN', 'AICTE_ADMIN', 'REGULATION_BUREAU', 'REGIONAL_OFFICER', 'BUREAU_OFFICER'
  ].includes(user.role);

  const isAuthority = user && [
    'COMPETENT_AUTHORITY', 'SUPER_ADMIN', 'AICTE_ADMIN'
  ].includes(user.role);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fdrReleaseApi.list();
      setRequests(res.data || []);
    } catch (err) {
      console.error('Failed to load release requests:', err);
      setError(err.message || 'Failed to load release requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [user]);

  const handleScrutinySubmit = async (e) => {
    e.preventDefault();
    if (!selectedReq) return;
    setIsSubmitting(true);
    try {
      await fdrReleaseApi.scrutiny(selectedReq.id, scrutinyForm);
      setScrutinyModalOpen(false);
      loadRequests();
    } catch (err) {
      alert('Scrutiny recording failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReq) return;
    setIsSubmitting(true);
    try {
      await fdrReleaseApi.decision(selectedReq.id, decisionForm);
      setDecisionModalOpen(false);
      loadRequests();
    } catch (err) {
      alert('Authority decision failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReq) return;
    setIsSubmitting(true);
    try {
      await fdrReleaseApi.complete(selectedReq.id, { completion_notes: completionNotes });
      setCompleteModalOpen(false);
      loadRequests();
    } catch (err) {
      alert('Finalize release failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-700" />
            <span>FDR Release, Refund & Lien Revocation Portal</span>
          </h2>
          <p className="text-xs text-slate-500">
            End-to-end statutory release workflow upon completion of institutional tenure or regulatory exemption
          </p>
        </div>

        <button
          onClick={loadRequests}
          className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
          title="Refresh List"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Table / Cards */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-700" />
            Loading release applications...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 text-xs">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
            {error}
          </div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            No release or refund applications currently recorded.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((rel) => (
              <div key={rel.id} className="p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#12345A]">{rel.request_number}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      rel.status === 'RELEASE_COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      rel.status === 'CA_APPROVED' ? 'bg-blue-100 text-blue-800' :
                      rel.status === 'CA_REJECTED' ? 'bg-red-100 text-red-800' :
                      rel.status === 'UNDER_SCRUTINY' ? 'bg-purple-100 text-purple-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {rel.status?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">FDR: {rel.fdr_number}</span>
                  </div>

                  <div className="text-xs font-semibold text-slate-900">
                    {rel.institution_name} ({rel.institution_code}) • {rel.institution_region}
                  </div>

                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-4">
                    <span>Reason: <strong className="text-slate-800">{rel.reason?.replace(/_/g, ' ')}</strong></span>
                    <span>Deposit: <strong className="text-emerald-700 font-bold">₹{Number(rel.deposit_amount).toLocaleString('en-IN')}</strong></span>
                    <span>Bank: <strong className="text-slate-800">{rel.issuing_bank}</strong></span>
                  </div>

                  {rel.review_notes && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 max-w-2xl">
                      {rel.review_notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                  {/* Step 1: Officer Scrutiny */}
                  {isOfficer && rel.status === 'REQUESTED' && (
                    <button
                      onClick={() => {
                        setSelectedReq(rel);
                        setScrutinyForm({ review_notes: '', recommendation: 'Recommended for release order' });
                        setScrutinyModalOpen(true);
                      }}
                      className="px-3 py-1.5 text-xs bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Scrutinize</span>
                    </button>
                  )}

                  {/* Step 2: Competent Authority Approval */}
                  {isAuthority && rel.status === 'UNDER_SCRUTINY' && (
                    <button
                      onClick={() => {
                        setSelectedReq(rel);
                        setDecisionForm({ decision: 'APPROVED', decision_remarks: 'Approved by Competent Authority' });
                        setDecisionModalOpen(true);
                      }}
                      className="px-3 py-1.5 text-xs bg-[#12345A] hover:bg-[#1B5E80] text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5 text-[#F2A900]" />
                      <span>Issue CA Order</span>
                    </button>
                  )}

                  {/* Step 3: Officer Complete & Revoke Lien */}
                  {isOfficer && rel.status === 'CA_APPROVED' && (
                    <button
                      onClick={() => {
                        setSelectedReq(rel);
                        setCompletionNotes('Issuing bank lien removed; funds unblocked');
                        setCompleteModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Finalize & Revoke Lien</span>
                    </button>
                  )}

                  <button
                    onClick={() => onSelectFdr(rel.fdr_id)}
                    className="px-3 py-1.5 text-xs text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-lg font-semibold transition cursor-pointer"
                  >
                    View FDR
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SCRUTINY MODAL */}
      {scrutinyModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Technical Scrutiny: {selectedReq?.request_number}
            </h3>

            <form onSubmit={handleScrutinySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Recommendation</label>
                <select
                  value={scrutinyForm.recommendation}
                  onChange={(e) => setScrutinyForm({ ...scrutinyForm, recommendation: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Recommend release of deposit">Recommend Release (Compliant with Tenure)</option>
                  <option value="Recommend rejection of release">Recommend Rejection (Deficiencies Unresolved)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Scrutiny Notes & Justification</label>
                <textarea
                  rows={3}
                  value={scrutinyForm.review_notes}
                  onChange={(e) => setScrutinyForm({ ...scrutinyForm, review_notes: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="Verify completion of academic tenure, absence of pending complaints..."
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setScrutinyModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold"
                >
                  Submit Scrutiny
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DECISION MODAL */}
      {decisionModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Competent Authority Release Order
            </h3>

            <form onSubmit={handleDecisionSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Formal Order Determination</label>
                <select
                  value={decisionForm.decision}
                  onChange={(e) => setDecisionForm({ ...decisionForm, decision: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold"
                >
                  <option value="APPROVED">APPROVE Release Order</option>
                  <option value="REJECTED">REJECT Release Order</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Order Remarks</label>
                <textarea
                  rows={3}
                  value={decisionForm.decision_remarks}
                  onChange={(e) => setDecisionForm({ ...decisionForm, decision_remarks: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="Statutory reasoning under AICTE Approval Process Handbook..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDecisionModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#12345A] hover:bg-[#1B5E80] text-white rounded-lg font-bold"
                >
                  Issue Authority Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETE MODAL */}
      {completeModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Finalize Release & Revoke Bank Lien
            </h3>

            <form onSubmit={handleCompleteSubmit} className="space-y-3 text-xs">
              <p className="text-slate-600">
                Executing this will revoke the statutory AICTE lien and mark the FDR status as <strong>RELEASED</strong>.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Completion Notes / Bank Communication</label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold"
                >
                  Complete Release
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
