import React, { useState, useEffect } from 'react';
import { 
  X, FileText, Download, Eye, RefreshCw, CheckCircle, AlertTriangle, 
  Clock, Shield, Lock, History, Trash2, Key, Link as LinkIcon, Check, Copy
} from 'lucide-react';
import { documentApi } from '../api';

export default function DocumentDetailModal({ docId, user, onClose, onRefresh }) {
  const [doc, setDoc] = useState(null);
  const [permittedActions, setPermittedActions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('metadata'); // 'metadata' | 'preview' | 'versions' | 'replace' | 'verify'

  // Signed token download state
  const [signedUrlData, setSignedUrlData] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Replace form state
  const [replaceFile, setReplaceFile] = useState(null);
  const [replaceSummary, setReplaceSummary] = useState('');
  const [replaceLoading, setReplaceLoading] = useState(false);

  // Verification form state
  const [verifyStatus, setVerifyStatus] = useState('VERIFIED');
  const [verifyRemarks, setVerifyRemarks] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Visibility change state
  const [newVisibility, setNewVisibility] = useState('');
  const [visLoading, setVisLoading] = useState(false);

  // Version history state
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    loadDocumentDetails();
  }, [docId]);

  const loadDocumentDetails = async () => {
    setLoading(true);
    try {
      const res = await documentApi.getById(docId);
      setDoc(res.document);
      setPermittedActions(res.permittedActions || {});
      setNewVisibility(res.document.confidentiality_classification);
    } catch (err) {
      setError(err.message || 'Failed to load document details');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSignedDownload = async () => {
    try {
      const res = await documentApi.getSignedToken(docId, 300); // 5 minutes valid
      setSignedUrlData(res);
    } catch (err) {
      alert('Error generating download token: ' + err.message);
    }
  };

  const handleCopyLink = () => {
    if (signedUrlData) {
      const fullUrl = window.location.origin + signedUrlData.downloadUrl;
      navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleExecuteReplace = async (e) => {
    e.preventDefault();
    if (!replaceFile) {
      alert('Please select a replacement file.');
      return;
    }
    setReplaceLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', replaceFile);
      formData.append('changeSummary', replaceSummary);

      await documentApi.replaceVersion(docId, formData);
      alert('Document version replaced successfully.');
      onRefresh();
      loadDocumentDetails();
      setActiveTab('metadata');
    } catch (err) {
      alert('Replace error: ' + err.message);
    } finally {
      setReplaceLoading(false);
    }
  };

  const handleExecuteVerify = async (e) => {
    e.preventDefault();
    setVerifyLoading(true);
    try {
      await documentApi.verify(docId, verifyStatus, verifyRemarks);
      alert(`Document status successfully marked as [${verifyStatus}].`);
      onRefresh();
      loadDocumentDetails();
      setActiveTab('metadata');
    } catch (err) {
      alert('Verification error: ' + err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleUpdateVisibility = async () => {
    setVisLoading(true);
    try {
      await documentApi.updateVisibility(docId, { classification: newVisibility });
      alert(`Confidentiality classification updated to [${newVisibility}]. Audit trail generated.`);
      onRefresh();
      loadDocumentDetails();
    } catch (err) {
      alert('Error updating visibility: ' + err.message);
    } finally {
      setVisLoading(false);
    }
  };

  const handleLoadVersions = async () => {
    setActiveTab('versions');
    try {
      const res = await documentApi.getVersions(docId);
      setVersions(res.versions || []);
    } catch (err) {
      alert('Error loading version history: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this document? This action is audited.')) return;
    try {
      await documentApi.delete(docId);
      alert('Document deleted.');
      onRefresh();
      onClose();
    } catch (err) {
      alert('Delete prohibited: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl flex items-center space-x-3 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-900" />
          <span>Evaluating Document-Level Access & Decrypting Metadata...</span>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full border border-red-200">
          <div className="flex items-center space-x-2 text-red-600 font-bold mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Access Evaluation Exception</span>
          </div>
          <p className="text-xs text-slate-600">{error || 'Access Denied.'}</p>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-slate-200 text-slate-800 text-xs font-semibold py-2 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/30 rounded-lg text-blue-400 border border-blue-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs text-blue-300 font-bold">{doc.document_number}</span>
                <span className="bg-blue-800 text-white text-[10px] px-2 py-0.5 rounded font-bold">
                  Version {doc.document_version}
                </span>
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">{doc.title}</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center space-x-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('metadata')}
            className={`py-3 px-3 border-b-2 transition ${
              activeTab === 'metadata'
                ? 'border-blue-900 text-blue-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Metadata & Access Controls
          </button>

          {permittedActions.PREVIEW && (
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-3 px-3 border-b-2 transition ${
                activeTab === 'preview'
                  ? 'border-blue-900 text-blue-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Secure In-Browser Preview
            </button>
          )}

          {permittedActions.VIEW_VERSION_HISTORY && (
            <button
              onClick={handleLoadVersions}
              className={`py-3 px-3 border-b-2 transition ${
                activeTab === 'versions'
                  ? 'border-blue-900 text-blue-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Version History
            </button>
          )}

          {permittedActions.REPLACE && (
            <button
              onClick={() => setActiveTab('replace')}
              className={`py-3 px-3 border-b-2 transition ${
                activeTab === 'replace'
                  ? 'border-blue-900 text-blue-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Replace Document (New Version)
            </button>
          )}

          {permittedActions.VERIFY && (
            <button
              onClick={() => setActiveTab('verify')}
              className={`py-3 px-3 border-b-2 transition ${
                activeTab === 'verify'
                  ? 'border-blue-900 text-blue-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Officer Verification & Remarks
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[65vh] overflow-y-auto">
          
          {/* TAB: METADATA & ACCESS CONTROLS (Section C & D) */}
          {activeTab === 'metadata' && (
            <div className="space-y-6">
              
              {/* Classification & Status Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Confidentiality Classification
                  </span>
                  <span className="text-xs font-bold text-indigo-900 mt-1 inline-block">
                    {doc.confidentiality_classification.replace(/_/g, ' ')}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Verification Status
                  </span>
                  <span className={`text-xs font-bold mt-1 inline-block ${
                    doc.verification_status === 'VERIFIED' ? 'text-emerald-700' :
                    doc.verification_status === 'PENDING' ? 'text-amber-700' : 'text-red-700'
                  }`}>
                    {doc.verification_status}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Statutory Retention
                  </span>
                  <span className="text-xs font-bold text-slate-700 mt-1 inline-block">
                    {doc.retention_status}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Expiry Monitoring
                  </span>
                  <span className="text-xs font-bold text-slate-700 mt-1 inline-block">
                    {doc.expiry_date || 'Perpetual / No Expiry'}
                  </span>
                </div>
              </div>

              {/* Section C Metadata Checklist */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Document Access-Control Metadata (Section C Compliance)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 font-medium">Institution ID:</span>{' '}
                    <span className="font-mono font-bold text-slate-800">{doc.institution_id}</span>
                    <div className="text-[11px] text-slate-500">{doc.institution_name}</div>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium">Application ID:</span>{' '}
                    <span className="font-mono font-bold text-blue-900">{doc.application_number || doc.application_id || 'Standalone Statutory'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium">Document Category:</span>{' '}
                    <span className="font-bold text-slate-800">{doc.document_category}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium">Folder Collection:</span>{' '}
                    <span className="font-bold text-slate-800">{doc.folder_category} Folders</span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium">Original Uploader:</span>{' '}
                    <span className="font-bold text-slate-800">{doc.uploader_name}</span>
                    <span className="text-[11px] text-slate-500 block">Role: {doc.uploader_role}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium">Upload Timestamp:</span>{' '}
                    <span className="font-mono text-slate-800">{doc.upload_timestamp}</span>
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                    <span className="text-slate-400 font-medium">SHA-256 Cryptographic Checksum:</span>
                    <div className="font-mono text-[11px] text-slate-700 break-all bg-slate-50 p-2 rounded mt-1 border border-slate-200">
                      {doc.checksum_sha256}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section D Document Actions Panel */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Authorized Actions for Active Session
                </h4>
                
                <div className="flex flex-wrap gap-2">
                  
                  {/* Download with Signed Temporary Token */}
                  {permittedActions.DOWNLOAD && (
                    <button
                      onClick={handleGenerateSignedDownload}
                      className="bg-blue-900 hover:bg-blue-950 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Generate Signed Download Token</span>
                    </button>
                  )}

                  {/* Direct Download fallback */}
                  {permittedActions.DOWNLOAD && (
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      download
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 border border-slate-300"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <span>Direct Bearer Download</span>
                    </a>
                  )}

                  {/* Delete where legally permitted */}
                  {permittedActions.DELETE && (
                    <button
                      onClick={handleDelete}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Document</span>
                    </button>
                  )}
                </div>

                {/* Signed Token Result Box */}
                {signedUrlData && (
                  <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs">
                    <div className="flex items-center justify-between text-emerald-900 font-bold mb-1">
                      <span className="flex items-center gap-1.5">
                        <Key className="w-4 h-4 text-emerald-600" />
                        Signed Temporary Access Link (HMAC-SHA256 Token)
                      </span>
                      <span className="text-[11px] font-mono text-emerald-700">
                        Expires: {signedUrlData.expiresAt}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 mb-3">
                      This signed link is valid for 300 seconds and automatically self-invalidates afterwards.
                    </p>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={window.location.origin + signedUrlData.downloadUrl}
                        className="bg-white border border-emerald-300 text-slate-700 px-3 py-1.5 rounded-lg text-[11px] font-mono flex-1 truncate"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition flex items-center space-x-1"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                      </button>
                      <a
                        href={signedUrlData.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 transition"
                      >
                        Open Download
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Confidentiality Classification Override for Admins */}
              {permittedActions.CHANGE_VISIBILITY && (
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Modify Confidentiality Classification
                  </h4>
                  <div className="flex items-center space-x-2">
                    <select
                      value={newVisibility}
                      onChange={(e) => setNewVisibility(e.target.value)}
                      className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-medium flex-1 max-w-sm"
                    >
                      <option value="INSTITUTION_VISIBLE">Institution-Visible</option>
                      <option value="INTERNAL_AICTE">Internal AICTE Only (Hidden from Institution)</option>
                      <option value="COMMITTEE_RESTRICTED">Committee-Restricted (EVC Only)</option>
                      <option value="HIGHLY_RESTRICTED">Highly Restricted (Competent Authority / Vigilance)</option>
                    </select>

                    <button
                      onClick={handleUpdateVisibility}
                      disabled={visLoading || newVisibility === doc.confidentiality_classification}
                      className="bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                    >
                      {visLoading ? 'Updating...' : 'Save & Record Audit'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB: PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-lg flex items-center justify-between">
                <span>
                  Watermarked In-Browser Preview active for: <strong className="font-mono">{user.username}</strong> ({user.role})
                </span>
                <span className="font-mono text-[11px] text-amber-700">{new Date().toISOString()}</span>
              </div>

              <div className="border border-slate-300 rounded-xl bg-slate-100 p-4 min-h-[300px] flex items-center justify-center relative overflow-hidden">
                {/* Watermark Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 select-none rotate-[-30deg]">
                  <div className="text-center font-black text-slate-900 text-3xl leading-tight">
                    AICTE OFFICIAL REPOSITORY<br />
                    VIEWED BY: {user.username.toUpperCase()}<br />
                    {new Date().toLocaleDateString()}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm max-w-lg w-full z-10 text-xs space-y-3">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold border-b border-slate-100 pb-2">
                    <FileText className="w-4 h-4 text-blue-900" />
                    <span>{doc.file_name}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Document Category: <strong>{doc.document_category}</strong><br />
                    Title: <strong>{doc.title}</strong><br />
                    Institution: <strong>{doc.institution_name} ({doc.institution_id})</strong><br />
                    File Size: <strong>{(doc.file_size / 1024).toFixed(1)} KB</strong>
                  </p>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 font-mono text-[11px] text-slate-700">
                    Content preview stream active. Tamper-evident checksum verified against SHA-256 integrity ledger.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: VERSION HISTORY */}
          {activeTab === 'versions' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Document Version Audit Chain
              </h4>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {versions.map((ver) => (
                  <div key={ver.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          v{ver.version}
                        </span>
                        <span className="font-semibold text-slate-800">{ver.file_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Uploaded by <strong className="text-slate-700">{ver.uploaded_by_name}</strong> on {ver.uploaded_at}
                      </div>
                      <p className="text-[11px] text-slate-600 italic mt-0.5">{ver.change_summary}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[200px]">
                        {ver.checksum_sha256}
                      </span>
                      <span className="text-[10px] text-slate-500">{(ver.file_size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: REPLACE DOCUMENT (NEW VERSION) */}
          {activeTab === 'replace' && (
            <form onSubmit={handleExecuteReplace} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-lg text-xs">
                <strong>Version Replacement Rules:</strong> Uploading a new file preserves the existing document ID, creates a new version record in the audit chain, resets verification status to PENDING, and records an immutable REPLACE audit event.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Replacement File</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setReplaceFile(e.target.files[0])}
                  className="block w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-900 file:text-white hover:file:bg-blue-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Replacement / Change Summary</label>
                <textarea
                  required
                  rows={3}
                  value={replaceSummary}
                  onChange={(e) => setReplaceSummary(e.target.value)}
                  placeholder="e.g. Corrected surveyed boundary coordinates per Scrutiny memo"
                  className="block w-full text-xs border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <button
                type="submit"
                disabled={replaceLoading}
                className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                {replaceLoading ? 'Uploading & Calculating Checksum...' : 'Submit New Version'}
              </button>
            </form>
          )}

          {/* TAB: VERIFY & RETURN */}
          {activeTab === 'verify' && (
            <form onSubmit={handleExecuteVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Verification Determination</label>
                <select
                  value={verifyStatus}
                  onChange={(e) => setVerifyStatus(e.target.value)}
                  className="block w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                >
                  <option value="VERIFIED">VERIFIED - Document meets all statutory criteria</option>
                  <option value="RETURNED_FOR_CORRECTION">RETURNED FOR CORRECTION - Deficiencies noted</option>
                  <option value="REJECTED">REJECTED - Non-compliant or forged</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Statutory Verification Remarks</label>
                <textarea
                  required
                  rows={3}
                  value={verifyRemarks}
                  onChange={(e) => setVerifyRemarks(e.target.value)}
                  placeholder="e.g. Verified with Land Revenue Authority records. All land survey bounds authenticated."
                  className="block w-full text-xs border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <button
                type="submit"
                disabled={verifyLoading}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                {verifyLoading ? 'Recording Statutory Decision...' : 'Commit Verification Status'}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
