import React, { useState, useEffect } from 'react';
import {
  X, Landmark, Shield, Clock, CheckCircle2, AlertTriangle, AlertCircle,
  Download, Eye, Upload, RefreshCw, DollarSign, Calendar, FileText, Check,
  ExternalLink, User, Hash, MessageSquare, History, ArrowRight
} from 'lucide-react';
import { fdrApi, fdrVerificationApi } from '../api';

export default function FdrDetailDrawer({
  fdrId,
  isOpen,
  onClose,
  user,
  onOpenRenewal,
  onOpenRelease,
  onRefreshList
}) {
  if (!isOpen || !fdrId) return null;

  const [fdr, setFdr] = useState(null);
  const [activeTab, setActiveTab] = useState('PARTICULARS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verification modal state
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyForm, setVerifyForm] = useState({
    verification_method: 'BANK_API',
    bank_confirmation_ref: '',
    bank_contact_person: '',
    bank_contact_email: '',
    result: 'VERIFIED',
    observations: ''
  });

  // Discrepancy modal state
  const [discrepancyModalOpen, setDiscrepancyModalOpen] = useState(false);
  const [discrepancyForm, setDiscrepancyForm] = useState({
    category: 'AMOUNT_MISMATCH',
    title: '',
    description: '',
    severity: 'MEDIUM'
  });

  // Respond discrepancy state
  const [respondModalOpen, setRespondModalOpen] = useState(false);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState(null);
  const [responseText, setResponseText] = useState('');

  // Upload document state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('FDR_SCAN');
  const [uploadFile, setUploadFile] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOfficer = user && [
    'SUPER_ADMIN', 'AICTE_ADMIN', 'REGULATION_BUREAU', 'REGIONAL_OFFICER', 'BUREAU_OFFICER'
  ].includes(user.role);

  const loadDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fdrApi.getById(fdrId);
      setFdr(res.data || res);
    } catch (err) {
      console.error('Error loading FDR details:', err);
      setError(err.message || 'Failed to load FDR details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [fdrId]);

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fdrVerificationApi.verify(fdr.id, verifyForm);
      setVerifyModalOpen(false);
      loadDetails();
      onRefreshList && onRefreshList();
    } catch (err) {
      alert('Verification failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRaiseDiscrepancy = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fdrVerificationApi.raiseDiscrepancy(fdr.id, discrepancyForm);
      setDiscrepancyModalOpen(false);
      setDiscrepancyForm({ category: 'AMOUNT_MISMATCH', title: '', description: '', severity: 'MEDIUM' });
      loadDetails();
      onRefreshList && onRefreshList();
    } catch (err) {
      alert('Failed to raise discrepancy: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespondSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDiscrepancy) return;
    setIsSubmitting(true);
    try {
      await fdrVerificationApi.respondDiscrepancy(selectedDiscrepancy.id, {
        institution_response: responseText
      });
      setRespondModalOpen(false);
      setSelectedDiscrepancy(null);
      setResponseText('');
      loadDetails();
      onRefreshList && onRefreshList();
    } catch (err) {
      alert('Failed to submit response: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveDiscrepancy = async (discId) => {
    const remarks = prompt('Enter resolution remarks / confirmation notes:');
    if (!remarks) return;
    try {
      await fdrVerificationApi.resolveDiscrepancy(discId, {
        status: 'RESOLVED',
        resolution_remarks: remarks
      });
      loadDetails();
      onRefreshList && onRefreshList();
    } catch (err) {
      alert('Failed to resolve discrepancy: ' + err.message);
    }
  };

  const handleDocumentUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please select a file.');
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('document_type', uploadDocType);
      await fdrApi.uploadDocument(fdr.id, formData);
      setUploadModalOpen(false);
      setUploadFile(null);
      loadDetails();
      onRefreshList && onRefreshList();
    } catch (err) {
      alert('Document upload failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadDoc = async (docId) => {
    try {
      const res = await fdrApi.getDocumentToken(docId);
      const token = res.data?.token;
      window.open(`/api/fdr/documents/${docId}/download?token=${token}`, '_blank');
    } catch (err) {
      window.open(`/api/fdr/documents/${docId}/download`, '_blank');
    }
  };

  const handlePreviewDoc = async (docId) => {
    try {
      const res = await fdrApi.getDocumentToken(docId);
      const token = res.data?.token;
      window.open(`/api/fdr/documents/${docId}/preview?token=${token}`, '_blank');
    } catch (err) {
      window.open(`/api/fdr/documents/${docId}/preview`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-3xl h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden">
        {/* Drawer Header */}
        <div className="p-5 bg-gradient-to-r from-[#12345A] to-[#1B5E80] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Landmark className="w-6 h-6 text-[#F2A900]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-mono tracking-tight">{fdr?.fdr_number || 'Loading...'}</h3>
                {fdr?.status === 'ACTIVE' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    ACTIVE
                  </span>
                )}
                {fdr?.verification_status === 'VERIFIED' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-blue-400" />
                    <span>VERIFIED</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 mt-0.5">
                {fdr?.issuing_bank} • Deposit: ₹{Number(fdr?.deposit_amount || 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        {fdr && (
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">Institution:</span>
              <span className="font-bold text-slate-900">{fdr.institution_name}</span>
              <span className="text-slate-400 font-mono">({fdr.institution_code})</span>
            </div>

            <div className="flex items-center gap-2">
              {isOfficer && fdr.verification_status !== 'VERIFIED' && (
                <>
                  <button
                    onClick={() => setVerifyModalOpen(true)}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verify Instrument</span>
                  </button>

                  <button
                    onClick={() => setDiscrepancyModalOpen(true)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Raise Discrepancy</span>
                  </button>
                </>
              )}

              {fdr.status !== 'RELEASED' && (
                <>
                  <button
                    onClick={() => {
                      onOpenRenewal && onOpenRenewal(fdr);
                    }}
                    className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Renew / Replace</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenRelease && onOpenRelease(fdr);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Request Release</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white overflow-x-auto text-xs font-semibold">
          {[
            { id: 'PARTICULARS', label: 'Particulars & Lien' },
            { id: 'DOCUMENTS', label: `Documents (${fdr?.documents?.length || 0})` },
            { id: 'VERIFICATION', label: `Verifications (${fdr?.verifications?.length || 0})` },
            { id: 'DISCREPANCIES', label: `Discrepancies (${fdr?.discrepancies?.length || 0})` },
            { id: 'RENEWALS_RELEASES', label: 'Renewals & Release' },
            { id: 'AUDIT', label: 'Audit Trail' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3.5 border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[#12345A] text-[#12345A] font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#12345A]" />
              Loading FDR details...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600 text-xs">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
              {error}
            </div>
          ) : !fdr ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              FDR record not found.
            </div>
          ) : (
            <div>
              {/* TAB 1: PARTICULARS */}
              {activeTab === 'PARTICULARS' && (
                <div className="space-y-4">
                  {/* Summary Box */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Financial Instrument Overview
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Instrument Type</span>
                        <span className="font-bold text-slate-800">{fdr.instrument_type?.replace(/_/g, ' ')}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Deposit Amount</span>
                        <span className="font-bold text-emerald-700 text-sm">₹{Number(fdr.deposit_amount).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Interest Rate</span>
                        <span className="font-bold text-slate-800">{fdr.interest_rate ? `${fdr.interest_rate}% p.a.` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Issue Date</span>
                        <span className="font-bold text-slate-800">{fdr.issue_date}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Maturity Date</span>
                        <span className={`font-bold ${new Date(fdr.maturity_date) < new Date() ? 'text-red-600' : 'text-slate-800'}`}>
                          {fdr.maturity_date}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Auto Renewal</span>
                        <span className="font-bold text-slate-800">{fdr.auto_renewal ? 'YES' : 'NO'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Banking Particulars */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Issuing Bank Particulars
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Issuing Bank</span>
                        <span className="font-bold text-slate-800">{fdr.issuing_bank}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Branch Name</span>
                        <span className="font-bold text-slate-800">{fdr.bank_branch}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">IFSC Code</span>
                        <span className="font-mono font-bold text-slate-800">{fdr.ifsc_code}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Bank Ref / Account No</span>
                        <span className="font-mono text-slate-800">{fdr.bank_ref || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Statutory AICTE Lien Mandate */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-[#12345A]" />
                        <span>Statutory Custody & AICTE Lien</span>
                      </h4>
                      {fdr.lien_marked ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          LIEN ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          LIEN REVOKED
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Deposit Holder (Trust/Society)</span>
                        <span className="font-semibold text-slate-800">{fdr.deposit_holder || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Joint Operation Holder</span>
                        <span className="font-semibold text-slate-800">{fdr.joint_holder_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Exclusive Beneficiary</span>
                        <span className="font-semibold text-slate-800">{fdr.beneficiary}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Statutory Purpose</span>
                        <span className="font-semibold text-slate-800">{fdr.purpose?.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Remarks */}
                  {fdr.remarks && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                        Administrative Remarks
                      </h4>
                      <p className="text-xs text-slate-600">{fdr.remarks}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: DOCUMENTS */}
              {activeTab === 'DOCUMENTS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Uploaded Statutory Files</span>
                    <button
                      onClick={() => setUploadModalOpen(true)}
                      className="px-3 py-1.5 bg-[#12345A] hover:bg-[#1B5E80] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Document</span>
                    </button>
                  </div>

                  {fdr.documents?.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                      No documents currently attached to this FDR record.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fdr.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 text-[#12345A] rounded-xl">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-bold text-xs text-slate-900">{doc.file_name}</div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-700">
                                  {doc.document_type?.replace(/_/g, ' ')}
                                </span>
                                <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                                <span>• {new Date(doc.uploaded_at).toLocaleString()}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-sm">
                                SHA-256: {doc.file_hash_sha256}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePreviewDoc(doc.id)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Preview Document"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadDoc(doc.id)}
                              className="p-1.5 text-[#12345A] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Download Signed Copy"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: VERIFICATION */}
              {activeTab === 'VERIFICATION' && (
                <div className="space-y-4">
                  {fdr.verifications?.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                      No official verifications logged yet. Instrument is awaiting verification by Council Officers.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fdr.verifications.map((v) => (
                        <div key={v.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v.result === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                {v.result}
                              </span>
                              <span className="text-xs font-semibold text-slate-700">
                                Method: {v.verification_method?.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {new Date(v.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            {v.observations || 'No additional remarks provided.'}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                            <span>Officer: <strong className="text-slate-700">{v.officer_name}</strong> ({v.officer_role})</span>
                            {v.bank_confirmation_ref && (
                              <span>Bank Confirmation Ref: <strong className="font-mono text-slate-700">{v.bank_confirmation_ref}</strong></span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: DISCREPANCIES */}
              {activeTab === 'DISCREPANCIES' && (
                <div className="space-y-4">
                  {fdr.discrepancies?.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                      No statutory discrepancies raised. Clean compliance status!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fdr.discrepancies.map((d) => (
                        <div key={d.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                {d.status}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                {d.severity}
                              </span>
                              <span className="text-xs font-bold text-slate-900">{d.title}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {new Date(d.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600">{d.description}</p>

                          {d.institution_response && (
                            <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200 text-xs text-amber-900">
                              <div className="font-bold text-[11px] mb-0.5">Institution Clarification:</div>
                              <div>{d.institution_response}</div>
                            </div>
                          )}

                          {d.resolution_remarks && (
                            <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                              <div className="font-bold text-[11px] mb-0.5">Officer Resolution Notes:</div>
                              <div>{d.resolution_remarks}</div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            {d.status === 'OPEN' && !isOfficer && (
                              <button
                                onClick={() => {
                                  setSelectedDiscrepancy(d);
                                  setRespondModalOpen(true);
                                }}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition cursor-pointer"
                              >
                                Submit Response
                              </button>
                            )}

                            {isOfficer && d.status !== 'RESOLVED' && (
                              <button
                                onClick={() => handleResolveDiscrepancy(d.id)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition cursor-pointer"
                              >
                                Mark Resolved
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: RENEWALS & RELEASES */}
              {activeTab === 'RENEWALS_RELEASES' && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      Renewal & Extension History
                    </h4>
                    {fdr.renewals?.length === 0 ? (
                      <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-400 text-center">
                        No renewal requests submitted for this deposit.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {fdr.renewals.map((r) => (
                          <div key={r.id} className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">{r.renewal_type?.replace(/_/g, ' ')}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                {r.status}
                              </span>
                            </div>
                            <p className="text-slate-500 text-[11px]">{r.remarks || 'No remarks provided'}</p>
                            <div className="text-[10px] text-slate-400">
                              Requested by {r.requested_by_name} on {new Date(r.created_at).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      Release & Refund Applications
                    </h4>
                    {fdr.releaseRequests?.length === 0 ? (
                      <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-400 text-center">
                        No release requests filed.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {fdr.releaseRequests.map((rel) => (
                          <div key={rel.id} className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-[#12345A]">{rel.request_number}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                {rel.status}
                              </span>
                            </div>
                            <p className="text-slate-600">{rel.review_notes}</p>
                            <div className="text-[10px] text-slate-400">
                              Requested by {rel.requested_by_name} on {new Date(rel.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: AUDIT TRAIL */}
              {activeTab === 'AUDIT' && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Cryptographic SHA-256 Tamper-Evident Ledger. All mutations immutably signed.</span>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2 font-mono">
                    <div>FDR Identifier: {fdr.id}</div>
                    <div>Custody Created: {fdr.created_at}</div>
                    <div>Last Modification: {fdr.updated_at}</div>
                    <div>Verified By: {fdr.verified_by_name || 'Unverified'}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* VERIFY MODAL */}
      {verifyModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Record Officer FDR Verification</span>
            </h3>

            <form onSubmit={handleVerifySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Verification Method</label>
                <select
                  value={verifyForm.verification_method}
                  onChange={(e) => setVerifyForm({ ...verifyForm, verification_method: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="BANK_API">Bank Automated API Confirmation</option>
                  <option value="CONFIRMATION_LETTER">Physical Bank Confirmation Letter</option>
                  <option value="OFFICIAL_EMAIL">Official Bank Domain Email Exchange</option>
                  <option value="PORTAL_VERIFICATION">AICTE Portal Direct Branch Liaison</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Bank Confirmation Reference</label>
                <input
                  type="text"
                  placeholder="e.g. SBI/CONF/2026/88421"
                  value={verifyForm.bank_confirmation_ref}
                  onChange={(e) => setVerifyForm({ ...verifyForm, bank_confirmation_ref: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Verification Outcome</label>
                <select
                  value={verifyForm.result}
                  onChange={(e) => setVerifyForm({ ...verifyForm, result: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold"
                >
                  <option value="VERIFIED">VERIFIED (Activate Deposit)</option>
                  <option value="DEFICIENT">DEFICIENT (Requires Rectification)</option>
                  <option value="REJECTED">REJECTED (Invalid / Ineligible)</option>
                  <option value="SUSPECTED_FRAUD">SUSPECTED FRAUD (Flag for Investigation)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observations & Verification Notes</label>
                <textarea
                  rows={3}
                  placeholder="Detailed officer notes regarding bank confirmation, mandate letter and seal verification..."
                  value={verifyForm.observations}
                  onChange={(e) => setVerifyForm({ ...verifyForm, observations: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold"
                >
                  {isSubmitting ? 'Recording...' : 'Confirm Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISCREPANCY MODAL */}
      {discrepancyModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Raise FDR Discrepancy / Deficiency</span>
            </h3>

            <form onSubmit={handleRaiseDiscrepancy} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Discrepancy Category</label>
                <select
                  value={discrepancyForm.category}
                  onChange={(e) => setDiscrepancyForm({ ...discrepancyForm, category: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="AMOUNT_MISMATCH">Amount Mismatch (Approved Norm vs FDR)</option>
                  <option value="MISSING_JOINT_HOLDER">Missing Joint Holder Mandate (RO AICTE)</option>
                  <option value="MISSING_LIEN">Missing Bank Official Lien Endorsement</option>
                  <option value="MATURITY_SHORTFALL">Maturity Tenure Less than Mandated Lock-in</option>
                  <option value="BRANCH_IFSC_INVALID">Invalid Branch or Non-Scheduled Bank</option>
                  <option value="UNREADABLE_SCAN">Unreadable or Incomplete Document Scan</option>
                  <option value="OTHER">Other Statutory Deficiency</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Severity Level</label>
                <select
                  value={discrepancyForm.severity}
                  onChange={(e) => setDiscrepancyForm({ ...discrepancyForm, severity: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="LOW">Low (Minor Clerical)</option>
                  <option value="MEDIUM">Medium (Rectifiable Discrepancy)</option>
                  <option value="HIGH">High (Mandatory Statutory Requirement)</option>
                  <option value="CRITICAL">Critical (Blocks Institutional Approval)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Branch Manager seal missing on lien letter"
                  value={discrepancyForm.title}
                  onChange={(e) => setDiscrepancyForm({ ...discrepancyForm, title: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Detailed Description & Remedial Instructions</label>
                <textarea
                  rows={3}
                  placeholder="Specific instructions to the institution on how to cure this deficiency..."
                  value={discrepancyForm.description}
                  onChange={(e) => setDiscrepancyForm({ ...discrepancyForm, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDiscrepancyModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
                >
                  {isSubmitting ? 'Raising...' : 'Issue Discrepancy Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESPOND MODAL */}
      {respondModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Submit Clarification for: {selectedDiscrepancy?.title}
            </h3>

            <form onSubmit={handleRespondSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Clarification Explanation</label>
                <textarea
                  rows={4}
                  placeholder="State the actions taken with the issuing bank or clarify the instrument details..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRespondModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold"
                >
                  {isSubmitting ? 'Submitting...' : 'Send Clarification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD DOCUMENT MODAL */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#12345A]" />
              <span>Upload Supporting Document</span>
            </h3>

            <form onSubmit={handleDocumentUpload} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Document Type</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="FDR_SCAN">FDR Scanned Copy / Deposit Certificate</option>
                  <option value="BANK_LIEN_LETTER">Bank Lien Endorsement Letter</option>
                  <option value="JOINT_OPERATION_LETTER">Joint Operation Mandate Confirmation</option>
                  <option value="RENEWAL_ADVICE">Bank Renewal Advice / Extended Receipt</option>
                  <option value="RELEASE_ORDER">Release / Refund Order Document</option>
                  <option value="OTHER">Other Regulatory Document</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select File (PDF / Images)</label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setUploadFile(e.target.files[0] || null)}
                  className="w-full text-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#12345A] hover:bg-[#1B5E80] text-white rounded-lg font-bold"
                >
                  {isSubmitting ? 'Uploading...' : 'Upload & Compute Hash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
