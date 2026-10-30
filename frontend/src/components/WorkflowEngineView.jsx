import React, { useState, useEffect } from 'react';
import { 
  GitMerge, CheckCircle, Clock, AlertTriangle, ArrowRight, PauseCircle, 
  PlayCircle, History, Shield, RefreshCw, FileText 
} from 'lucide-react';
import { workflowApi, applicationApi } from '../api';

const STAGE_ORDER = [
  { key: 'APPLICATION_SUBMITTED', label: '1. Submitted', desc: 'Application filed with statutory fees' },
  { key: 'SCRUTINY', label: '2. Scrutiny', desc: 'Document verification & deficiency check' },
  { key: 'EVC_INSPECTION', label: '3. EVC Inspection', desc: 'Physical on-site infrastructure verification' },
  { key: 'SAC_HEARING', label: '4. SAC Hearing', desc: 'Standing Appellate Committee review' },
  { key: 'RC_DECISION', label: '5. Regional Committee', desc: 'Regional bureau recommendation' },
  { key: 'EC_APPROVAL', label: '6. Executive Committee', desc: 'Apex Council final consideration' },
  { key: 'APPROVED', label: 'Approved', desc: 'Formal Letter of Approval issued' }
];

export default function WorkflowEngineView({ user }) {
  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [history, setHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [nextStage, setNextStage] = useState('');
  const [transitionRemarks, setTransitionRemarks] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [resumeRemarks, setResumeRemarks] = useState('');
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAppId) {
      loadHistory(selectedAppId);
    }
  }, [selectedAppId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [appsRes, tmplRes] = await Promise.all([
        applicationApi.list(),
        workflowApi.getTemplates()
      ]);
      setApplications(appsRes.applications || []);
      setTemplates(tmplRes || []);
      if (appsRes.applications && appsRes.applications.length > 0) {
        setSelectedAppId(appsRes.applications[0].id);
      }
    } catch (err) {
      console.error('Failed to load workflow data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (appId) => {
    try {
      const res = await workflowApi.getHistory(appId);
      setHistory(res || []);
    } catch (err) {
      console.error('Failed to load workflow history:', err);
    }
  };

  const selectedApp = applications.find(a => a.id === selectedAppId);

  const handleTransition = async (e) => {
    e.preventDefault();
    if (!nextStage) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await workflowApi.transition(selectedAppId, nextStage, transitionRemarks);
      setStatusMessage({ type: 'success', text: `Stage transitioned to ${nextStage} successfully.` });
      setTransitionRemarks('');
      setNextStage('');
      await loadData();
      await loadHistory(selectedAppId);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleHold = async () => {
    if (!holdReason) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await workflowApi.hold(selectedAppId, holdReason);
      setStatusMessage({ type: 'success', text: 'Application placed ON HOLD successfully.' });
      setShowHoldModal(false);
      setHoldReason('');
      await loadData();
      await loadHistory(selectedAppId);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await workflowApi.resume(selectedAppId, resumeRemarks || 'Administrative review completed');
      setStatusMessage({ type: 'success', text: 'Application resumed to ACTIVE state.' });
      setResumeRemarks('');
      await loadData();
      await loadHistory(selectedAppId);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const currentStageIndex = selectedApp ? STAGE_ORDER.findIndex(s => s.key === selectedApp.current_stage) : -1;

  return (
    <div className="space-y-6">
      {/* Page Title Banner */}
      <div className="bg-white rounded-lg border-l-4 border-[#F2A900] border border-[#DCE3EA] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1B5E80]">STATUTORY ENGINE</span>
              <span className="bg-blue-50 text-[#12345A] text-[10px] px-2 py-0.5 rounded font-mono font-bold">Rule-Based FSM</span>
            </div>
            <h1 className="text-xl font-bold text-[#12345A] mt-1">Approval Workflow Automation Engine</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated stage gating, conditional prerequisites check, administrative hold/resume, and statutory transition history.
            </p>
          </div>
          <button
            onClick={() => { loadData(); if (selectedAppId) loadHistory(selectedAppId); }}
            className="self-start md:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-lg text-xs font-medium border flex items-center justify-between ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs font-bold">✕</button>
        </div>
      )}

      {/* Application Selector */}
      <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] flex flex-col sm:flex-row items-center gap-4">
        <label className="text-xs font-bold text-[#12345A] whitespace-nowrap">
          Select Active Application:
        </label>
        <select
          value={selectedAppId}
          onChange={(e) => setSelectedAppId(e.target.value)}
          className="w-full sm:w-auto flex-1 bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#12345A]"
        >
          {applications.map(app => (
            <option key={app.id} value={app.id}>
              {app.application_number} — {app.institution_name} ({app.application_type} - {app.academic_year}) [Status: {app.status} | Stage: {app.current_stage}]
            </option>
          ))}
        </select>
        {selectedApp && (
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded text-xs font-bold ${
              selectedApp.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
              selectedApp.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
              selectedApp.status === 'ON_HOLD' ? 'bg-amber-100 text-amber-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {selectedApp.status}
            </span>
          </div>
        )}
      </div>

      {selectedApp && (
        <>
          {/* Statutory Workflow Progression Bar */}
          <div className="bg-white p-5 rounded-lg border border-[#DCE3EA] shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-[#12345A] uppercase tracking-wide">
              Statutory Stage Pipeline (AICTE Approval Process Handbook)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {STAGE_ORDER.map((stage, index) => {
                const isPassed = currentStageIndex > index;
                const isCurrent = currentStageIndex === index;
                return (
                  <div
                    key={stage.key}
                    className={`p-3 rounded-lg border flex flex-col justify-between text-left transition ${
                      isCurrent
                        ? 'bg-[#12345A] text-white border-[#12345A] shadow-xs'
                        : isPassed
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-bold">
                        {index + 1}
                      </span>
                      {isPassed && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                      {isCurrent && <Clock className="w-3.5 h-3.5 text-[#F2A900] animate-pulse" />}
                    </div>
                    <div className="text-xs font-bold leading-tight truncate">
                      {stage.label.split('. ')[1] || stage.label}
                    </div>
                    <div className={`text-[9px] mt-1 line-clamp-2 ${isCurrent ? 'text-slate-200' : 'text-slate-500'}`}>
                      {stage.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Workflow Action Panel: Stage Transition & Hold/Resume */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Advance Stage Form */}
            <div className="bg-white p-5 rounded-lg border border-[#DCE3EA] shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <GitMerge className="w-4 h-4 text-[#1B5E80]" />
                <h3 className="text-xs font-bold text-[#12345A] uppercase">Advance Workflow Stage</h3>
              </div>
              <form onSubmit={handleTransition} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Statutory Stage *
                  </label>
                  <select
                    value={nextStage}
                    onChange={(e) => setNextStage(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#12345A]"
                  >
                    <option value="">-- Choose Next Stage --</option>
                    {STAGE_ORDER.filter(s => s.key !== selectedApp.current_stage).map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Stage Transition Remarks / Minutes of Review
                  </label>
                  <textarea
                    rows={2}
                    value={transitionRemarks}
                    onChange={(e) => setTransitionRemarks(e.target.value)}
                    placeholder="Enter compliance verification note or administrative authorization..."
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#12345A]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading || !nextStage}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#12345A] hover:bg-[#1B5E80] text-white py-2 px-4 rounded text-xs font-bold cursor-pointer transition disabled:opacity-50"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  {actionLoading ? 'Transitioning...' : 'Execute Statutory Transition'}
                </button>
              </form>
            </div>

            {/* Hold / Resume Controls */}
            <div className="bg-white p-5 rounded-lg border border-[#DCE3EA] shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Shield className="w-4 h-4 text-[#B7791F]" />
                <h3 className="text-xs font-bold text-[#12345A] uppercase">Administrative Hold Controls</h3>
              </div>
              <p className="text-xs text-slate-600">
                Place this application on administrative or vigilance hold in case of pending court inquiry, regulatory clarification, or land title dispute.
              </p>

              {selectedApp.status === 'ON_HOLD' ? (
                <div className="space-y-3 bg-amber-50 p-3 rounded border border-amber-200">
                  <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                    <PauseCircle className="w-4 h-4 text-amber-600" />
                    <span>Application is currently ON HOLD</span>
                  </div>
                  <input
                    type="text"
                    value={resumeRemarks}
                    onChange={(e) => setResumeRemarks(e.target.value)}
                    placeholder="Clearance reference or lifting remarks..."
                    className="w-full bg-white border border-amber-300 rounded p-2 text-xs"
                  />
                  <button
                    onClick={handleResume}
                    disabled={actionLoading}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded text-xs font-bold cursor-pointer"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Resume Application to Active Processing
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    Application status is currently: <strong className="text-emerald-700 font-mono">{selectedApp.status}</strong>
                  </div>
                  <input
                    type="text"
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value)}
                    placeholder="Reason for administrative hold (e.g. Land Contiguity Notice)..."
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  />
                  <button
                    onClick={handleHold}
                    disabled={actionLoading || !holdReason}
                    className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    Enact Administrative Hold
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Transition Audit Timeline */}
          <div className="bg-white p-5 rounded-lg border border-[#DCE3EA] shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <History className="w-4 h-4 text-[#1B5E80]" />
              <h3 className="text-xs font-bold text-[#12345A] uppercase">Workflow Stage Transition History</h3>
            </div>
            {history.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">No stage transition records logged yet.</div>
            ) : (
              <div className="relative border-l border-slate-200 ml-4 space-y-4">
                {history.map((record, index) => (
                  <div key={record.id || index} className="mb-4 ml-6">
                    <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-[#12345A] rounded-full text-white ring-4 ring-white text-[10px] font-bold">
                      {history.length - index}
                    </span>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-[#12345A]">
                        <span>{record.from_stage || 'START'} ➔ {record.to_stage}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(record.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Officer: <span className="font-semibold text-slate-800">{record.performer_name || record.performed_by}</span> ({record.performer_role || 'COUNCIL_OFFICER'})
                      </div>
                      {record.remarks && (
                        <div className="text-[11px] bg-white p-2 rounded border border-slate-200 text-slate-700 mt-1 italic">
                          "{record.remarks}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
