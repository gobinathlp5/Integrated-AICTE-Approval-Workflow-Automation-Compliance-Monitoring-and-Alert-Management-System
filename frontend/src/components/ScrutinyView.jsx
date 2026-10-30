import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, AlertCircle, CheckCircle, Clock, FileText, Send, 
  HelpCircle, RefreshCw, PlusCircle, ShieldCheck, XCircle 
} from 'lucide-react';
import { scrutinyApi, applicationApi, documentApi } from '../api';

const DEFAULT_CHECKLIST_ITEMS = [
  { key: 'LAND_OWNERSHIP', title: 'Land Ownership / Registered 30-Year Lease Deed' },
  { key: 'LAND_CONVERSION', title: 'Land Use Conversion Order for Educational Purpose' },
  { key: 'BUILDING_PLAN', title: 'Master Plan & Building Completion Certificate' },
  { key: 'FIRE_SAFETY_NOC', title: 'Fire Safety NOC from Competent State Authority' },
  { key: 'FINANCIAL_FDR', title: 'Joint FDR with Member Secretary, AICTE' },
  { key: 'FACULTY_CADRE', title: 'Faculty Cadre Ratio (1:2:6) and Cadre Declarations' },
  { key: 'AFFIDAVIT_REGULATIONS', title: 'Statutory Affidavit as per APH 2026-27' }
];

export default function ScrutinyView({ user }) {
  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [deficiencies, setDeficiencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Deficiency Notice Form State
  const [showDeficiencyModal, setShowDeficiencyModal] = useState(false);
  const [defForm, setDefForm] = useState({
    deficiencyType: 'LAND_DOCUMENT',
    description: '',
    statutoryClause: 'APH 2026-27 Clause 2.4.1',
    remedyInstructions: '',
    deadlineDays: 14
  });

  // Institution Response Modal
  const [respondingDefId, setRespondingDefId] = useState(null);
  const [responseText, setResponseText] = useState('');

  // Scrutiny Completion Form
  const [overallRecommendation, setOverallRecommendation] = useState('RECOMMENDED_FOR_EVC');
  const [evaluationRemarks, setEvaluationRemarks] = useState('');

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    if (selectedAppId) {
      loadEvaluation(selectedAppId);
      loadDeficiencies(selectedAppId);
    }
  }, [selectedAppId]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const res = await applicationApi.list();
      setApplications(res.applications || []);
      if (res.applications && res.applications.length > 0) {
        setSelectedAppId(res.applications[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadEvaluation = async (appId) => {
    try {
      const res = await scrutinyApi.getEvaluation(appId);
      setEvaluation(res);
      if (res && res.overall_recommendation) {
        setOverallRecommendation(res.overall_recommendation);
      }
      if (res && res.remarks) {
        setEvaluationRemarks(res.remarks);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadDeficiencies = async (appId) => {
    try {
      const res = await scrutinyApi.getDeficiencies(appId);
      setDeficiencies(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveItem = async (itemKey, title, status, remarks) => {
    try {
      await scrutinyApi.saveItem(selectedAppId, {
        check_item_key: itemKey,
        item_title: title,
        status,
        remarks: remarks || ''
      });
      loadEvaluation(selectedAppId);
    } catch (err) {
      alert('Failed to save checklist item: ' + err.message);
    }
  };

  const handleCreateDeficiency = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await scrutinyApi.createDeficiency({
        applicationId: selectedAppId,
        ...defForm
      });
      setStatusMessage({ type: 'success', text: 'Deficiency notice issued and transmitted to institution.' });
      setShowDeficiencyModal(false);
      setDefForm({
        deficiencyType: 'LAND_DOCUMENT',
        description: '',
        statutoryClause: 'APH 2026-27 Clause 2.4.1',
        remedyInstructions: '',
        deadlineDays: 14
      });
      loadDeficiencies(selectedAppId);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRespondDeficiency = async (defId) => {
    if (!responseText) return;
    setActionLoading(true);
    try {
      await scrutinyApi.respondDeficiency(defId, responseText);
      setStatusMessage({ type: 'success', text: 'Response submitted to Scrutiny Committee.' });
      setRespondingDefId(null);
      setResponseText('');
      loadDeficiencies(selectedAppId);
    } catch (err) {
      alert('Error submitting response: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveDeficiency = async (defId, status) => {
    const remarks = prompt('Enter officer resolution remarks:');
    if (!remarks) return;
    try {
      await scrutinyApi.resolveDeficiency(defId, status, remarks);
      loadDeficiencies(selectedAppId);
    } catch (err) {
      alert('Error resolving deficiency: ' + err.message);
    }
  };

  const handleCompleteEvaluation = async () => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await scrutinyApi.completeEvaluation(selectedAppId, overallRecommendation, evaluationRemarks);
      setStatusMessage({ type: 'success', text: 'Scrutiny evaluation completed and signed by Scrutiny Committee.' });
      loadEvaluation(selectedAppId);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const isScrutinyOfficer = user && (user.role === 'SCRUTINY_OFFICER' || user.role === 'SUPER_ADMIN' || user.role === 'AICTE_ADMIN');
  const isInstitution = user && (user.role === 'INSTITUTION_ADMIN' || user.role === 'INSTITUTION_STAFF');

  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="bg-white rounded-lg border-l-4 border-[#F2A900] border border-[#DCE3EA] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1B5E80]">SCRUTINY COMMITTEE</span>
              <span className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-mono font-bold">Document Integrity Verification</span>
            </div>
            <h1 className="text-xl font-bold text-[#12345A] mt-1">Technical Scrutiny & Deficiency Portal</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Standardized statutory document verification checklist, deficiency notice issuance, and institutional compliance rectification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isScrutinyOfficer && (
              <button
                onClick={() => setShowDeficiencyModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Issue Deficiency Notice
              </button>
            )}
            <button
              onClick={() => { loadApplications(); if (selectedAppId) { loadEvaluation(selectedAppId); loadDeficiencies(selectedAppId); } }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition"
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
          Evaluating Application:
        </label>
        <select
          value={selectedAppId}
          onChange={(e) => setSelectedAppId(e.target.value)}
          className="w-full sm:w-auto flex-1 bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#12345A]"
        >
          {applications.map(app => (
            <option key={app.id} value={app.id}>
              {app.application_number} — {app.institution_name} ({app.application_type} - {app.academic_year}) [Stage: {app.current_stage}]
            </option>
          ))}
        </select>
      </div>

      {/* Two Column Layout: Scrutiny Checklist & Deficiencies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Checklist Inspector (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[#1B5E80]" />
              <h2 className="text-sm font-bold text-[#12345A]">Statutory Checklist Evaluation Items</h2>
            </div>
            {evaluation && evaluation.completed_at && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                COMPLETED & SIGNED
              </span>
            )}
          </div>

          <div className="space-y-3">
            {DEFAULT_CHECKLIST_ITEMS.map((item, idx) => {
              const savedItem = evaluation && evaluation.checklist 
                ? evaluation.checklist.find(c => c.check_item_key === item.key) 
                : null;
              const currentStatus = savedItem ? savedItem.status : 'PENDING';

              return (
                <div key={item.key} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">
                      {idx + 1}. {item.title}
                    </span>
                    <span className={`self-start sm:self-auto px-2 py-0.5 rounded text-[10px] font-bold ${
                      currentStatus === 'ACCEPTABLE' ? 'bg-emerald-100 text-emerald-800' :
                      currentStatus === 'DEFICIENT' ? 'bg-red-100 text-red-800' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {currentStatus}
                    </span>
                  </div>

                  {savedItem && savedItem.remarks && (
                    <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 italic">
                      Remarks: "{savedItem.remarks}"
                    </div>
                  )}

                  {/* Officer Actions for Checklist Item */}
                  {isScrutinyOfficer && (
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                      <button
                        onClick={() => handleSaveItem(item.key, item.title, 'ACCEPTABLE', 'Document inspected and found in order.')}
                        className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold cursor-pointer"
                      >
                        ✓ Mark Acceptable
                      </button>
                      <button
                        onClick={() => {
                          const rem = prompt('Enter deficiency remark for ' + item.title + ':');
                          if (rem) handleSaveItem(item.key, item.title, 'DEFICIENT', rem);
                        }}
                        className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold cursor-pointer"
                      >
                        ✕ Mark Deficient
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Scrutiny Final Decision Form */}
          {isScrutinyOfficer && (
            <div className="mt-6 pt-4 border-t border-slate-200 space-y-3 bg-slate-50 p-4 rounded-lg">
              <h3 className="text-xs font-bold text-[#12345A] uppercase">Final Scrutiny Recommendation</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Recommendation</label>
                  <select
                    value={overallRecommendation}
                    onChange={(e) => setOverallRecommendation(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-bold"
                  >
                    <option value="RECOMMENDED_FOR_EVC">RECOMMENDED FOR EVC INSPECTION</option>
                    <option value="DEFICIENCIES_COMMUNICATED">DEFICIENCIES COMMUNICATED (PENDING RECTIFICATION)</option>
                    <option value="REJECTED_AT_SCRUTINY">REJECTED AT SCRUTINY STAGE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Consolidated Committee Remarks</label>
                  <input
                    type="text"
                    value={evaluationRemarks}
                    onChange={(e) => setEvaluationRemarks(e.target.value)}
                    placeholder="All documents verified against AICTE APH..."
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                  />
                </div>
              </div>
              <button
                onClick={handleCompleteEvaluation}
                disabled={actionLoading}
                className="w-full py-2 bg-[#12345A] hover:bg-[#1B5E80] text-white rounded text-xs font-bold transition cursor-pointer"
              >
                {actionLoading ? 'Saving...' : 'Finalize & Record Scrutiny Evaluation'}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Deficiencies Issued (1 Col) */}
        <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-[#12345A]">Statutory Deficiencies</h2>
            </div>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {deficiencies.length}
            </span>
          </div>

          {deficiencies.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">
              No deficiencies recorded for this application.
            </div>
          ) : (
            <div className="space-y-3">
              {deficiencies.map(def => (
                <div key={def.id} className="p-3 border rounded-lg bg-slate-50 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{def.deficiency_type}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      def.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' :
                      def.status === 'RESPONDED' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {def.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700">{def.description}</p>
                  <div className="text-[10px] text-slate-500">
                    Clause: <span className="font-mono">{def.statutory_clause}</span> • Deadline: <span className="font-bold">{def.deadline_days} Days</span>
                  </div>

                  {def.institution_response && (
                    <div className="bg-white p-2 rounded border border-slate-200 text-[10px] text-slate-700">
                      <strong>Institution Reply:</strong> {def.institution_response}
                    </div>
                  )}

                  {/* Institution Response Form */}
                  {isInstitution && def.status === 'ISSUED' && (
                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      {respondingDefId === def.id ? (
                        <div className="space-y-1.5">
                          <textarea
                            rows={2}
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            placeholder="Enter compliance response and clarification..."
                            className="w-full bg-white border border-slate-300 rounded p-1 text-xs"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRespondDeficiency(def.id)}
                              className="px-2 py-1 bg-[#12345A] text-white rounded text-[10px] font-bold"
                            >
                              Submit Reply
                            </button>
                            <button
                              onClick={() => setRespondingDefId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setRespondingDefId(def.id); setResponseText(''); }}
                          className="w-full py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold"
                        >
                          Submit Institutional Rectification Reply
                        </button>
                      )}
                    </div>
                  )}

                  {/* Scrutiny Officer Resolution Controls */}
                  {isScrutinyOfficer && def.status !== 'RESOLVED' && (
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                      <button
                        onClick={() => handleResolveDeficiency(def.id, 'RESOLVED')}
                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold"
                      >
                        Accept & Resolve
                      </button>
                      <button
                        onClick={() => handleResolveDeficiency(def.id, 'UNRESOLVED')}
                        className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold"
                      >
                        Reject Rectification
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deficiency Notice Modal */}
      {showDeficiencyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#12345A]">Issue Statutory Deficiency Notice</h3>
              <button onClick={() => setShowDeficiencyModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateDeficiency} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Deficiency Category</label>
                <select
                  value={defForm.deficiencyType}
                  onChange={(e) => setDefForm({ ...defForm, deficiencyType: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                >
                  <option value="LAND_DOCUMENT">Land Ownership / Title Defect</option>
                  <option value="BUILDING_PLAN">Building Plan / Fire Safety Defect</option>
                  <option value="FINANCIAL_FDR">Financial Reserve / Joint FDR Defect</option>
                  <option value="FACULTY_SHORTFALL">Faculty Cadre Ratio Shortfall</option>
                  <option value="UNDERTAKING_MISSING">Statutory Affidavit Defect</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Statutory Clause Reference</label>
                <input
                  type="text"
                  value={defForm.statutoryClause}
                  onChange={(e) => setDefForm({ ...defForm, statutoryClause: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Deficiency Description</label>
                <textarea
                  rows={2}
                  value={defForm.description}
                  onChange={(e) => setDefForm({ ...defForm, description: e.target.value })}
                  required
                  placeholder="Detail exact statutory non-compliance observed..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Remedy Instructions for Institution</label>
                <textarea
                  rows={2}
                  value={defForm.remedyInstructions}
                  onChange={(e) => setDefForm({ ...defForm, remedyInstructions: e.target.value })}
                  placeholder="Specific rectification instructions (e.g. submit certificate from District Collector)..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Remedy Deadline (Days)</label>
                  <input
                    type="number"
                    value={defForm.deadlineDays}
                    onChange={(e) => setDefForm({ ...defForm, deadlineDays: Number(e.target.value) })}
                    min={3}
                    max={30}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeficiencyModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  {actionLoading ? 'Issuing...' : 'Issue Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
