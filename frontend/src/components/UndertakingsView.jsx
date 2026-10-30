import React, { useState, useEffect } from 'react';
import { 
  FileText, CheckCircle, AlertTriangle, Clock, PlusCircle, 
  RefreshCw, ShieldCheck, DownloadCloud 
} from 'lucide-react';
import { undertakingApi, applicationApi, documentApi } from '../api';

export default function UndertakingsView({ user }) {
  const [templates, setTemplates] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Submit Undertaking Modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    templateId: '',
    validityDate: '2027-06-30',
    remarks: '',
    documentId: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAppId) {
      loadSubmissions(selectedAppId);
    }
  }, [selectedAppId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tmplRes, appsRes] = await Promise.all([
        undertakingApi.getTemplates(),
        applicationApi.list()
      ]);
      setTemplates(tmplRes || []);
      setApplications(appsRes.applications || []);
      if (tmplRes && tmplRes.length > 0) {
        setSubmitForm(prev => ({ ...prev, templateId: tmplRes[0].id }));
      }
      if (appsRes.applications && appsRes.applications.length > 0) {
        setSelectedAppId(appsRes.applications[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async (appId) => {
    try {
      const res = await undertakingApi.getSubmissions(appId);
      setSubmissions(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitUndertaking = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await undertakingApi.submit({
        applicationId: selectedAppId,
        ...submitForm
      });
      setStatusMessage({ type: 'success', text: 'Statutory affidavit / undertaking submitted successfully.' });
      setShowSubmitModal(false);
      await loadSubmissions(selectedAppId);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyUndertaking = async (subId, status) => {
    const remarks = prompt('Enter verification remarks for this affidavit:');
    if (!remarks) return;
    try {
      await undertakingApi.verify(subId, status, remarks);
      await loadSubmissions(selectedAppId);
    } catch (err) {
      alert('Verification failed: ' + err.message);
    }
  };

  const isScrutinyOrAdmin = user && (user.role === 'SCRUTINY_OFFICER' || user.role === 'SUPER_ADMIN' || user.role === 'AICTE_ADMIN');

  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="bg-white rounded-lg border-l-4 border-[#F2A900] border border-[#DCE3EA] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1B5E80]">LEGAL COMPLIANCE</span>
              <span className="bg-blue-50 text-[#12345A] text-[10px] px-2 py-0.5 rounded font-mono font-bold">Notarized Affidavits</span>
            </div>
            <h1 className="text-xl font-bold text-[#12345A] mt-1">Statutory Undertakings & Affidavits</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Notarized statutory oaths on non-judicial stamp paper as mandated by the AICTE Approval Process Handbook.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#12345A] hover:bg-[#1B5E80] text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              File Undertaking
            </button>
            <button
              onClick={() => { loadData(); if (selectedAppId) loadSubmissions(selectedAppId); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
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

      {/* Application Selector */}
      <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] flex flex-col sm:flex-row items-center gap-4">
        <label className="text-xs font-bold text-[#12345A] whitespace-nowrap">
          Viewing Application:
        </label>
        <select
          value={selectedAppId}
          onChange={(e) => setSelectedAppId(e.target.value)}
          className="w-full sm:w-auto flex-1 bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#12345A]"
        >
          {applications.map(app => (
            <option key={app.id} value={app.id}>
              {app.application_number} — {app.institution_name} [{app.status}]
            </option>
          ))}
        </select>
      </div>

      {/* Two Column Layout: Mandatory Templates & Filed Undertakings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates Info Card (1 Col) */}
        <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
          <h2 className="text-xs font-bold text-[#12345A] uppercase tracking-wide pb-2 border-b border-slate-100">
            Mandatory Statutory Formats ({templates.length})
          </h2>
          <div className="space-y-3">
            {templates.map(tmpl => (
              <div key={tmpl.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                <div className="font-bold text-[#12345A]">{tmpl.title}</div>
                <p className="text-[11px] text-slate-600 leading-snug">{tmpl.description}</p>
                <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                  <span>Stamp: <strong>₹{tmpl.stamp_duty_required || 100}</strong></span>
                  <span>Notary: <strong>{tmpl.notarized_required ? 'Mandatory' : 'Optional'}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filed Submissions Card (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
          <h2 className="text-xs font-bold text-[#12345A] uppercase tracking-wide pb-2 border-b border-slate-100">
            Filed Affidavits & Verification Status ({submissions.length})
          </h2>

          {submissions.length === 0 ? (
            <div className="text-xs text-slate-500 py-8 text-center bg-slate-50 rounded border border-dashed border-slate-300">
              No statutory undertakings filed yet for this application. Use "File Undertaking" above to submit.
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map(sub => (
                <div key={sub.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{sub.template_title}</span>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Submission Ref: <span className="font-mono">{sub.id}</span> • Validity: <span className="font-bold text-slate-700">{sub.validity_date}</span>
                      </div>
                    </div>
                    <span className={`self-start sm:self-auto px-2 py-0.5 rounded text-[10px] font-bold ${
                      sub.verification_status === 'VALID' ? 'bg-emerald-100 text-emerald-800' :
                      sub.verification_status === 'DEFICIENT' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {sub.verification_status}
                    </span>
                  </div>

                  {sub.remarks && (
                    <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                      <strong>Notes:</strong> {sub.remarks}
                    </div>
                  )}

                  {sub.verification_remarks && (
                    <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200">
                      <strong>Officer Verification:</strong> {sub.verification_remarks} (by {sub.verified_by_user_id || 'Scrutiny Officer'})
                    </div>
                  )}

                  {/* Scrutiny Officer Verification Controls */}
                  {isScrutinyOrAdmin && sub.verification_status !== 'VALID' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => handleVerifyUndertaking(sub.id, 'VALID')}
                        className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold cursor-pointer"
                      >
                        ✓ Confirm Legal Validity
                      </button>
                      <button
                        onClick={() => handleVerifyUndertaking(sub.id, 'DEFICIENT')}
                        className="px-2.5 py-1 rounded bg-red-700 hover:bg-red-800 text-white text-[10px] font-bold cursor-pointer"
                      >
                        ✕ Mark Deficient Stamp/Affidavit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* File Undertaking Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#12345A]">File Statutory Affidavit / Undertaking</h3>
              <button onClick={() => setShowSubmitModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitUndertaking} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Undertaking Category</label>
                <select
                  value={submitForm.templateId}
                  onChange={(e) => setSubmitForm({ ...submitForm, templateId: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                >
                  {templates.map(tmpl => (
                    <option key={tmpl.id} value={tmpl.id}>{tmpl.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Validity Date</label>
                <input
                  type="date"
                  value={submitForm.validityDate}
                  onChange={(e) => setSubmitForm({ ...submitForm, validityDate: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notary Registration & Stamp Reference</label>
                <input
                  type="text"
                  value={submitForm.remarks}
                  onChange={(e) => setSubmitForm({ ...submitForm, remarks: e.target.value })}
                  placeholder="e.g. Notarized on ₹100 Stamp Paper No. DL/8941/2026"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-100 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded bg-[#12345A] text-white text-xs font-bold"
                >
                  {actionLoading ? 'Filing...' : 'Submit to Council'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
