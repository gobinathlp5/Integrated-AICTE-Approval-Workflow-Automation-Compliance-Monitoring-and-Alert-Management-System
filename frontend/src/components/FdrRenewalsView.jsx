import React, { useState, useEffect } from 'react';
import {
  RefreshCw, Clock, AlertTriangle, CheckCircle2, Plus, Calendar,
  Landmark, AlertCircle, Eye, ArrowRight, Check, X
} from 'lucide-react';
import { fdrRenewalApi, fdrApi } from '../api';

export default function FdrRenewalsView({ user, onSelectFdr }) {
  const [activeTab, setActiveTab] = useState('DUE');
  const [dueList, setDueList] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Submit Renewal Modal
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const [targetFdr, setTargetFdr] = useState(null);
  const [renewalForm, setRenewalForm] = useState({
    renewal_type: 'SAME_FDR_EXTENDED',
    extended_maturity_date: '',
    replacement_fdr_id: '',
    remarks: ''
  });

  // Review Modal (Officers)
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedRenewal, setSelectedRenewal] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    decision: 'APPROVED',
    new_maturity_date: '',
    review_remarks: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOfficer = user && [
    'SUPER_ADMIN', 'AICTE_ADMIN', 'REGULATION_BUREAU', 'REGIONAL_OFFICER', 'BUREAU_OFFICER'
  ].includes(user.role);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dueRes, appRes] = await Promise.all([
        fdrRenewalApi.getDue(),
        fdrRenewalApi.list()
      ]);
      setDueList(dueRes.data || []);
      setApplications(appRes.data || []);
    } catch (err) {
      console.error('Failed to load renewals data:', err);
      setError(err.message || 'Failed to load renewals data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleOpenRenewalModal = (fdr) => {
    setTargetFdr(fdr);
    const dNextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
    setRenewalForm({
      renewal_type: 'SAME_FDR_EXTENDED',
      extended_maturity_date: dNextYear,
      replacement_fdr_id: '',
      remarks: 'Extended with issuing bank for statutory tenure'
    });
    setRenewalModalOpen(true);
  };

  const handleSubmitRenewal = async (e) => {
    e.preventDefault();
    if (!targetFdr) return;
    setIsSubmitting(true);
    try {
      await fdrRenewalApi.submit(targetFdr.id, renewalForm);
      alert('Renewal application submitted successfully for AICTE review.');
      setRenewalModalOpen(false);
      loadData();
    } catch (err) {
      alert('Renewal submission failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRenewal) return;
    setIsSubmitting(true);
    try {
      await fdrRenewalApi.review(selectedRenewal.id, reviewForm);
      alert(`Renewal application marked as ${reviewForm.decision}`);
      setReviewModalOpen(false);
      loadData();
    } catch (err) {
      alert('Review failed: ' + err.message);
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
            <RefreshCw className="w-5 h-5 text-purple-700" />
            <span>FDR Renewal & Replacement Management</span>
          </h2>
          <p className="text-xs text-slate-500">
            Proactive tracking of maturing deposits, statutory extensions & new instrument replacement linking
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
          title="Refresh List"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('DUE')}
          className={`py-2.5 px-4 border-b-2 transition cursor-pointer ${
            activeTab === 'DUE'
              ? 'border-purple-700 text-purple-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Renewal Due / Maturing ({dueList.length})
        </button>
        <button
          onClick={() => setActiveTab('APPLICATIONS')}
          className={`py-2.5 px-4 border-b-2 transition cursor-pointer ${
            activeTab === 'APPLICATIONS'
              ? 'border-purple-700 text-purple-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Renewal Applications ({applications.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-700" />
          Loading renewal records...
        </div>
      ) : activeTab === 'DUE' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {dueList.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              Zero instruments currently due for renewal. All active deposits have valid remaining tenure.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dueList.map((fdr) => {
                const isPast = new Date(fdr.maturity_date) < new Date();
                return (
                  <div key={fdr.id} className="p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#12345A]">{fdr.fdr_number}</span>
                        {isPast ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                            MATURED (OVERDUE)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            MATURING SOON
                          </span>
                        )}
                        <span className="text-xs text-slate-400">• {fdr.purpose?.replace(/_/g, ' ')}</span>
                      </div>

                      <div className="text-xs font-semibold text-slate-900">
                        {fdr.institution_name} ({fdr.institution_code})
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-4">
                        <span>Bank: <strong className="text-slate-700">{fdr.issuing_bank}</strong></span>
                        <span>Deposit: <strong className="text-emerald-700 font-bold">₹{Number(fdr.deposit_amount).toLocaleString('en-IN')}</strong></span>
                        <span>Maturity Date: <strong className={isPast ? 'text-red-600' : 'text-amber-700'}>{fdr.maturity_date}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => onSelectFdr(fdr.id)}
                        className="px-3 py-1.5 text-xs text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-lg font-semibold transition cursor-pointer"
                      >
                        View Dossier
                      </button>

                      <button
                        onClick={() => handleOpenRenewalModal(fdr)}
                        className="px-3.5 py-1.5 text-xs bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Submit Renewal</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {applications.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              No renewal applications submitted.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {applications.map((app) => (
                <div key={app.id} className="p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#12345A]">{app.original_fdr_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        app.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        app.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {app.status}
                      </span>
                      <span className="text-xs text-purple-700 font-semibold">{app.renewal_type?.replace(/_/g, ' ')}</span>
                    </div>

                    <div className="text-xs font-semibold text-slate-900">{app.institution_name}</div>
                    <p className="text-[11px] text-slate-600">{app.remarks || 'No remarks provided'}</p>
                    <div className="text-[10px] text-slate-400">
                      Filed by {app.requested_by_name} on {new Date(app.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {isOfficer && app.status === 'SUBMITTED' && (
                      <button
                        onClick={() => {
                          setSelectedRenewal(app);
                          setReviewForm({
                            decision: 'APPROVED',
                            new_maturity_date: '',
                            review_remarks: 'Renewal terms verified with bank.'
                          });
                          setReviewModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Review Renewal</span>
                      </button>
                    )}

                    <button
                      onClick={() => onSelectFdr(app.original_fdr_id)}
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
      )}

      {/* SUBMIT RENEWAL MODAL */}
      {renewalModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-700" />
              <span>Submit Renewal for {targetFdr?.fdr_number}</span>
            </h3>

            <form onSubmit={handleSubmitRenewal} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Renewal Strategy</label>
                <select
                  value={renewalForm.renewal_type}
                  onChange={(e) => setRenewalForm({ ...renewalForm, renewal_type: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="SAME_FDR_EXTENDED">Extend Existing FDR (Same Instrument Number)</option>
                  <option value="NEW_FDR_REPLACEMENT">Replacement with Newly Registered FDR</option>
                </select>
              </div>

              {renewalForm.renewal_type === 'SAME_FDR_EXTENDED' ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Extended Maturity Date</label>
                  <input
                    type="date"
                    value={renewalForm.extended_maturity_date}
                    onChange={(e) => setRenewalForm({ ...renewalForm, extended_maturity_date: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Replacement FDR ID</label>
                  <input
                    type="text"
                    placeholder="Enter ID of newly registered replacement FDR"
                    value={renewalForm.replacement_fdr_id}
                    onChange={(e) => setRenewalForm({ ...renewalForm, replacement_fdr_id: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks / Extension Reference</label>
                <textarea
                  rows={3}
                  placeholder="Details of bank endorsement and new deposit tenure..."
                  value={renewalForm.remarks}
                  onChange={(e) => setRenewalForm({ ...renewalForm, remarks: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenewalModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Renewal Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW RENEWAL MODAL */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Review Renewal for: {selectedRenewal?.original_fdr_number}
            </h3>

            <form onSubmit={handleReviewSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Review Determination</label>
                <select
                  value={reviewForm.decision}
                  onChange={(e) => setReviewForm({ ...reviewForm, decision: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold"
                >
                  <option value="APPROVED">APPROVE Renewal / Extension</option>
                  <option value="REJECTED">REJECT Renewal Request</option>
                </select>
              </div>

              {reviewForm.decision === 'APPROVED' && selectedRenewal?.renewal_type === 'SAME_FDR_EXTENDED' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Confirm New Maturity Date</label>
                  <input
                    type="date"
                    value={reviewForm.new_maturity_date}
                    onChange={(e) => setReviewForm({ ...reviewForm, new_maturity_date: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Officer Review Observations</label>
                <textarea
                  rows={3}
                  value={reviewForm.review_remarks}
                  onChange={(e) => setReviewForm({ ...reviewForm, review_remarks: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold"
                >
                  {isSubmitting ? 'Recording...' : 'Save Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
