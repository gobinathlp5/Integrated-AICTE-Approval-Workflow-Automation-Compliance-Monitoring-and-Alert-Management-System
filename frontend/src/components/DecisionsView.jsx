import React, { useState, useEffect } from 'react';
import { 
  Award, CheckCircle, XCircle, FileText, Printer, ShieldCheck, 
  AlertTriangle, RefreshCw, Stamp 
} from 'lucide-react';
import { decisionApi, applicationApi } from '../api';
import { AicteEmblem } from './AicteLogo';

export default function DecisionsView({ user }) {
  const [pendingApps, setPendingApps] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [activeDecision, setActiveDecision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Decision Form
  const [decisionForm, setDecisionForm] = useState({
    decision: 'APPROVED',
    formalOrderNumber: `AICTE/AB/2026/F-${Math.floor(100000 + Math.random() * 900000)}`,
    approvedIntake: 180,
    validityYears: 3,
    reasoning: 'Institution complies with all norms prescribed in AICTE Approval Process Handbook (APH) 2026-27.'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAppId) {
      loadDecision(selectedAppId);
    }
  }, [selectedAppId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pendingRes, appsRes] = await Promise.all([
        decisionApi.listPending(),
        applicationApi.list()
      ]);
      const list = pendingRes.pendingApplications || appsRes.applications || [];
      setPendingApps(list);
      if (list.length > 0) {
        setSelectedAppId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDecision = async (appId) => {
    try {
      const res = await decisionApi.getByApplication(appId);
      setActiveDecision(res);
    } catch (err) {
      console.error(err);
      setActiveDecision(null);
    }
  };

  const handleRenderDecision = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await decisionApi.renderDecision({
        applicationId: selectedAppId,
        ...decisionForm
      });
      setStatusMessage({ type: 'success', text: `Formal Statutory Order [${decisionForm.decision}] issued successfully.` });
      await loadDecision(selectedAppId);
      await loadData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const selectedApp = pendingApps.find(a => a.id === selectedAppId);
  const isCompetentAuthority = user && (user.role === 'COMPETENT_AUTHORITY' || user.role === 'SUPER_ADMIN');

  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="bg-white rounded-lg border-l-4 border-[#F2A900] border border-[#DCE3EA] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1B5E80]">APEX STATUTORY DECISION</span>
              <span className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-mono font-bold">Competent Authority Orders</span>
            </div>
            <h1 className="text-xl font-bold text-[#12345A] mt-1">Competent Authority Formal Decisions</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Prerequisite-verified issuance of Letter of Approval (LoA) or formal rejection orders under Section 10(k) of the AICTE Act.
            </p>
          </div>
          <button
            onClick={() => { loadData(); if (selectedAppId) loadDecision(selectedAppId); }}
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

      {/* Application Selector */}
      <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] flex flex-col sm:flex-row items-center gap-4">
        <label className="text-xs font-bold text-[#12345A] whitespace-nowrap">
          Select Consideration Case:
        </label>
        <select
          value={selectedAppId}
          onChange={(e) => setSelectedAppId(e.target.value)}
          className="w-full sm:w-auto flex-1 bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#12345A]"
        >
          {pendingApps.map(app => (
            <option key={app.id} value={app.id}>
              {app.application_number} — {app.institution_name} [{app.status} | Stage: {app.current_stage}]
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Decision Issuance Form */}
        <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Award className="w-4 h-4 text-[#1B5E80]" />
            <h2 className="text-sm font-bold text-[#12345A]">Statutory Consideration & Decision Issuance</h2>
          </div>

          {isCompetentAuthority ? (
            <form onSubmit={handleRenderDecision} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Formal Council Decision *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecisionForm({ ...decisionForm, decision: 'APPROVED' })}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                      decisionForm.decision === 'APPROVED'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    GRANT APPROVAL (LoA)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionForm({ ...decisionForm, decision: 'REJECTED' })}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                      decisionForm.decision === 'REJECTED'
                        ? 'bg-red-700 text-white border-red-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    REJECT APPLICATION
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Formal Order / Dispatch Number</label>
                <input
                  type="text"
                  value={decisionForm.formalOrderNumber}
                  onChange={(e) => setDecisionForm({ ...decisionForm, formalOrderNumber: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Approved Student Intake</label>
                  <input
                    type="number"
                    value={decisionForm.approvedIntake}
                    onChange={(e) => setDecisionForm({ ...decisionForm, approvedIntake: Number(e.target.value) })}
                    disabled={decisionForm.decision === 'REJECTED'}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Approval Validity (Years)</label>
                  <input
                    type="number"
                    value={decisionForm.validityYears}
                    onChange={(e) => setDecisionForm({ ...decisionForm, validityYears: Number(e.target.value) })}
                    disabled={decisionForm.decision === 'REJECTED'}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Formal Judicial / Regulatory Grounds</label>
                <textarea
                  rows={3}
                  value={decisionForm.reasoning}
                  onChange={(e) => setDecisionForm({ ...decisionForm, reasoning: e.target.value })}
                  required
                  placeholder="Detail grounds for decision under AICTE Act 1987..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 rounded bg-[#12345A] hover:bg-[#1B5E80] text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                {actionLoading ? 'Recording Statutory Order...' : 'Digitally Sign & Dispatch Council Order'}
              </button>
            </form>
          ) : (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
              Only the <strong>Competent Authority</strong> or <strong>Super Administrator</strong> possesses the statutory delegation to issue formal approval orders.
            </div>
          )}
        </div>

        {/* Right Column: Formal Letter of Approval / Certificate Preview */}
        <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h2 className="text-xs font-bold text-[#12345A] uppercase tracking-wide">
              Official Council Order Preview
            </h2>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Certificate
            </button>
          </div>

          {activeDecision ? (
            <div className="p-6 border-2 border-[#12345A] rounded-lg bg-gradient-to-b from-white to-slate-50 space-y-4 text-center">
              <div className="flex justify-center">
                <AicteEmblem className="w-16 h-16" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#12345A] uppercase">
                  All India Council for Technical Education
                </h3>
                <p className="text-[10px] text-slate-500">
                  (A Statutory Body of the Government of India) • Nelson Mandela Marg, New Delhi
                </p>
              </div>

              <div className="border-t border-b border-slate-300 py-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                  activeDecision.decision === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {activeDecision.decision === 'APPROVED' ? 'LETTER OF APPROVAL (LoA)' : 'ORDER OF REJECTION'}
                </span>
                <div className="text-[10px] text-slate-600 mt-1 font-mono">
                  Order No: <strong>{activeDecision.formal_order_number}</strong>
                </div>
              </div>

              <div className="text-left text-xs text-slate-800 space-y-2">
                <p>
                  To the Governing Body / Management of: <br />
                  <strong className="text-[#12345A] text-sm">{selectedApp ? selectedApp.institution_name : 'Institution'}</strong>
                </p>
                <p className="text-[11px] leading-relaxed">
                  In exercise of the powers conferred by Section 10(k) of the AICTE Act 1987 and based on the recommendations of the Scrutiny Committee, Expert Visit Committee and Executive Committee, the Council hereby conveys its decision:
                </p>
                <div className="bg-slate-100 p-2.5 rounded border border-slate-300 text-[11px] space-y-1">
                  <div>Approved Intake: <strong>{activeDecision.approved_intake || 'N/A'} Seats</strong></div>
                  <div>Approval Period: <strong>{activeDecision.validity_years || 1} Academic Year(s)</strong></div>
                  <div>Grounds: <em>{activeDecision.reasoning}</em></div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between text-left text-[10px] text-slate-500 border-t border-slate-200">
                <div>
                  Date: {new Date(activeDecision.created_at).toLocaleDateString()}<br />
                  Digital Token: <span className="font-mono text-[9px]">{activeDecision.id}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#12345A]">Competent Authority</div>
                  <div>AICTE Approval Bureau</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded border border-dashed border-slate-300">
              No formal Council Order rendered yet for this application. Once signed by the Competent Authority, the Letter of Approval (LoA) certificate will be rendered here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
