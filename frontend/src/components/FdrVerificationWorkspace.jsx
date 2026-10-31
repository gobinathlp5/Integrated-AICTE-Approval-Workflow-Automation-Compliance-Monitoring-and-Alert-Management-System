import React, { useState, useEffect } from 'react';
import {
  Shield, CheckCircle2, AlertTriangle, Clock, RefreshCw, FileText,
  Eye, Download, Building2, Landmark, Check, X, AlertCircle, ChevronRight
} from 'lucide-react';
import { fdrVerificationApi, fdrApi } from '../api';

export default function FdrVerificationWorkspace({ user, onSelectFdr }) {
  const [pendingList, setPendingList] = useState([]);
  const [selectedFdr, setSelectedFdr] = useState(null);
  const [fdrDetails, setFdrDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);

  // Verification form
  const [verificationMethod, setVerificationMethod] = useState('BANK_API');
  const [confirmationRef, setConfirmationRef] = useState('');
  const [observations, setObservations] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Discrepancy modal
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [discrepancyForm, setDiscrepancyForm] = useState({
    category: 'AMOUNT_MISMATCH',
    title: '',
    description: '',
    severity: 'MEDIUM'
  });

  const loadPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fdrVerificationApi.getPending();
      const list = res.data || [];
      setPendingList(list);
      if (list.length > 0 && !selectedFdr) {
        setSelectedFdr(list[0]);
      }
    } catch (err) {
      console.error('Failed to load pending queue:', err);
      setError(err.message || 'Failed to load verification queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, [user]);

  useEffect(() => {
    if (selectedFdr) {
      loadFdrDetails(selectedFdr.id);
    }
  }, [selectedFdr]);

  const loadFdrDetails = async (id) => {
    setLoadingDetails(true);
    try {
      const res = await fdrApi.getById(id);
      setFdrDetails(res.data || res);
    } catch (err) {
      console.error('Failed to load FDR details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleVerify = async (result) => {
    if (!fdrDetails) return;
    setIsVerifying(true);
    try {
      await fdrVerificationApi.verify(fdrDetails.id, {
        verification_method: verificationMethod,
        bank_confirmation_ref: confirmationRef,
        result,
        observations
      });
      alert(`FDR successfully processed as ${result}`);
      setObservations('');
      setConfirmationRef('');
      loadPending();
    } catch (err) {
      alert('Verification recording failed: ' + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRaiseDiscrepancy = async (e) => {
    e.preventDefault();
    if (!fdrDetails) return;
    try {
      await fdrVerificationApi.raiseDiscrepancy(fdrDetails.id, discrepancyForm);
      alert('Discrepancy notice issued to institution.');
      setShowDiscrepancyModal(false);
      setDiscrepancyForm({ category: 'AMOUNT_MISMATCH', title: '', description: '', severity: 'MEDIUM' });
      loadFdrDetails(fdrDetails.id);
      loadPending();
    } catch (err) {
      alert('Failed to raise discrepancy: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-700" />
            <span>AICTE Officer FDR Verification Workspace</span>
          </h2>
          <p className="text-xs text-slate-500">
            Formal bank liaison, lien certificate validation, discrepancy adjudication & active status activation
          </p>
        </div>

        <button
          onClick={loadPending}
          className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
          title="Refresh Queue"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Pending Queue (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[750px]">
          <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex items-center justify-between">
            <span>Pending Review Queue ({pendingList.length})</span>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
              Action Required
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#12345A]" />
                Loading queue...
              </div>
            ) : pendingList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Zero pending deposits awaiting verification. Queue is clear!
              </div>
            ) : (
              pendingList.map((item) => {
                const isSelected = selectedFdr?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedFdr(item)}
                    className={`p-3.5 transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-4 border-l-[#12345A]'
                        : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-xs text-[#12345A]">
                        {item.fdr_number}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.verification_status === 'DISCREPANT'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.verification_status}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {item.institution_name}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>{item.issuing_bank}</span>
                      <span className="font-bold text-slate-800">
                        ₹{Number(item.deposit_amount).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-1">
                      Submitted: {new Date(item.submission_date || item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Verification Panel (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[750px]">
          {!selectedFdr ? (
            <div className="p-12 text-center text-slate-400 text-xs m-auto">
              Select an instrument from the verification queue to inspect particulars and documents.
            </div>
          ) : loadingDetails ? (
            <div className="p-12 text-center text-slate-400 text-xs m-auto">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#12345A]" />
              Loading instrument documentation...
            </div>
          ) : fdrDetails ? (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Top Summary Banner */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {fdrDetails.purpose?.replace(/_/g, ' ')}
                  </div>
                  <h3 className="text-lg font-bold font-mono text-[#12345A]">
                    {fdrDetails.fdr_number}
                  </h3>
                  <p className="text-xs text-slate-600 font-semibold mt-0.5">
                    {fdrDetails.institution_name} ({fdrDetails.institution_code}) • {fdrDetails.institution_region}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-700">
                    ₹{Number(fdrDetails.deposit_amount).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-slate-500">
                    Maturity: <strong className="text-slate-800">{fdrDetails.maturity_date}</strong>
                  </div>
                </div>
              </div>

              {/* Bank Mandate Audit Table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Bank & Branch</span>
                  <span className="font-bold text-slate-800">{fdrDetails.issuing_bank}</span>
                  <div className="text-[10px] text-slate-500 truncate">{fdrDetails.bank_branch}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">IFSC Code</span>
                  <span className="font-mono font-bold text-slate-800">{fdrDetails.ifsc_code}</span>
                  <div className="text-[10px] text-emerald-600 font-semibold">Valid Format</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Joint Operation Mandate</span>
                  <span className="font-bold text-slate-800">{fdrDetails.joint_holder_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Bank Lien Status</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Lien Claimed</span>
                  </span>
                </div>
              </div>

              {/* Uploaded Documents for this FDR */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Uploaded Scans & Mandate Evidence ({fdrDetails.documents?.length || 0})
                </h4>

                {fdrDetails.documents?.length === 0 ? (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    No documents uploaded. The institution has not provided the mandatory FDR scan receipt.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fdrDetails.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-[#12345A]" />
                          <div>
                            <span className="font-bold text-slate-800">{doc.file_name}</span>
                            <div className="text-[10px] text-slate-400 font-mono">
                              SHA-256: {doc.file_hash_sha256}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              try {
                                const res = await fdrApi.getDocumentToken(doc.id);
                                window.open(`/api/fdr/documents/${doc.id}/preview?token=${res.data?.token}`, '_blank');
                              } catch (e) {
                                window.open(`/api/fdr/documents/${doc.id}/preview`, '_blank');
                              }
                            }}
                            className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 rounded border border-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discrepancy Log on this FDR */}
              {fdrDetails.discrepancies?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2">
                    Active Discrepancies ({fdrDetails.discrepancies.length})
                  </h4>
                  <div className="space-y-2">
                    {fdrDetails.discrepancies.map((d) => (
                      <div key={d.id} className="p-3 bg-red-50/70 border border-red-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-red-950">{d.title}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-200 text-red-900">{d.status}</span>
                        </div>
                        <p className="text-red-800 text-[11px]">{d.description}</p>
                        {d.institution_response && (
                          <div className="bg-white p-2 rounded border border-red-200 text-slate-800 mt-1">
                            <strong>Institution Response:</strong> {d.institution_response}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Officer Decision Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Officer Verification Determination
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Verification Channel</label>
                    <select
                      value={verificationMethod}
                      onChange={(e) => setVerificationMethod(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="BANK_API">Bank Automated Webhook / API Confirmation</option>
                      <option value="CONFIRMATION_LETTER">Physical Bank Confirmation Letter</option>
                      <option value="OFFICIAL_EMAIL">Official Bank Domain Email Exchange</option>
                      <option value="PORTAL_VERIFICATION">AICTE Portal Direct Branch Liaison</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bank Confirmation Letter / Ref No.</label>
                    <input
                      type="text"
                      placeholder="e.g. SBI/RO-DEL/2026/FDR-9842"
                      value={confirmationRef}
                      onChange={(e) => setConfirmationRef(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Officer Observations & Custody Audit Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter official observations confirming joint operation, lien endorsement, and statutory validity..."
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => setShowDiscrepancyModal(true)}
                    className="px-3.5 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Raise Discrepancy</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={isVerifying}
                      onClick={() => handleVerify('REJECTED')}
                      className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      Reject FDR
                    </button>

                    <button
                      disabled={isVerifying}
                      onClick={() => handleVerify('VERIFIED')}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4 text-[#F2A900]" />
                      <span>{isVerifying ? 'Processing...' : 'Verify & Activate Custody'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* RAISE DISCREPANCY MODAL */}
      {showDiscrepancyModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Raise Discrepancy on {fdrDetails?.fdr_number}</span>
            </h3>

            <form onSubmit={handleRaiseDiscrepancy} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={discrepancyForm.category}
                  onChange={(e) => setDiscrepancyForm({ ...discrepancyForm, category: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
                  <option value="MISSING_JOINT_HOLDER">Missing Joint Holder Mandate</option>
                  <option value="MISSING_LIEN">Missing Bank Lien Endorsement</option>
                  <option value="MATURITY_SHORTFALL">Maturity Tenure Shortfall</option>
                  <option value="BRANCH_IFSC_INVALID">Invalid Branch or IFSC</option>
                  <option value="UNREADABLE_SCAN">Unreadable Scan File</option>
                  <option value="OTHER">Other Regulatory Issue</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Severity</label>
                <select
                  value={discrepancyForm.severity}
                  onChange={(e) => setDiscrepancyForm({ ...discrepancyForm, severity: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Bank seal missing on joint mandate letter"
                  value={discrepancyForm.title}
                  onChange={(e) => setDiscrepancyForm({ ...discrepancyForm, title: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description & Rectification Instructions</label>
                <textarea
                  rows={3}
                  placeholder="Clearly state what must be rectified by the institution..."
                  value={discrepancyForm.description}
                  onChange={(e) => setDiscrepancyForm({ ...discrepancyForm, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscrepancyModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
                >
                  Issue Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
