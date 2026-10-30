import React, { useState, useEffect } from 'react';
import { 
  Scale, Calendar, Users, CheckCircle, AlertTriangle, FileText, 
  PlusCircle, RefreshCw, MessageSquare 
} from 'lucide-react';
import { sacApi, applicationApi } from '../api';

export default function SacHearingsView({ user }) {
  const [hearings, setHearings] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedHearing, setSelectedHearing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Schedule Hearing Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    applicationId: '',
    scheduledDate: '',
    meetingMode: 'VIRTUAL',
    committeeChair: 'Prof. K. Murthy (Retd. High Court Justice)',
    committeeMembers: 'Prof. S. R. Rao, Dr. Ananya Sen'
  });

  // Record Recommendation Modal
  const [showRecModal, setShowRecModal] = useState(false);
  const [recForm, setRecForm] = useState({
    recommendation: 'REVERSAL_APPROVED',
    reasoning: '',
    conditionNotes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hearingsRes, appsRes] = await Promise.all([
        sacApi.listHearings(),
        applicationApi.list()
      ]);
      setHearings(hearingsRes || []);
      setApplications(appsRes.applications || []);
      if (hearingsRes && hearingsRes.length > 0) {
        setSelectedHearing(hearingsRes[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await sacApi.schedule(scheduleForm);
      setStatusMessage({ type: 'success', text: 'SAC hearing scheduled on appellate calendar.' });
      setShowScheduleModal(false);
      await loadData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordRecommendation = async (e) => {
    e.preventDefault();
    if (!selectedHearing) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await sacApi.recordRecommendation(selectedHearing.id, recForm);
      setStatusMessage({ type: 'success', text: 'Appellate recommendation and judicial reasoning recorded.' });
      setShowRecModal(false);
      await loadData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const isSacMember = user && (user.role === 'SAC_SHC_MEMBER' || user.role === 'SUPER_ADMIN' || user.role === 'COMPETENT_AUTHORITY');

  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="bg-white rounded-lg border-l-4 border-[#F2A900] border border-[#DCE3EA] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1B5E80]">APPELLATE JURISDICTION</span>
              <span className="bg-amber-50 text-amber-800 text-[10px] px-2 py-0.5 rounded font-mono font-bold">Standing Appellate Committee</span>
            </div>
            <h1 className="text-xl font-bold text-[#12345A] mt-1">Standing Appellate Committee (SAC / SHC)</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review of institutional appeals against rejection or deficiency findings with formal legal recommendations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSacMember && (
              <button
                onClick={() => setShowScheduleModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#12345A] hover:bg-[#1B5E80] text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Schedule Appellate Hearing
              </button>
            )}
            <button
              onClick={loadData}
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

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Hearings Docket (1 Col) */}
        <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-4 space-y-3">
          <h2 className="text-xs font-bold text-[#12345A] uppercase tracking-wide pb-2 border-b border-slate-100">
            Appellate Hearings Docket ({hearings.length})
          </h2>

          {hearings.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">
              No appeals currently docketed for hearing.
            </div>
          ) : (
            <div className="space-y-2">
              {hearings.map(h => {
                const isSelected = selectedHearing && selectedHearing.id === h.id;
                return (
                  <div
                    key={h.id}
                    onClick={() => setSelectedHearing(h)}
                    className={`p-3 rounded-lg border cursor-pointer transition text-xs space-y-1.5 ${
                      isSelected
                        ? 'bg-[#12345A] text-white border-[#12345A]'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{h.application_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        h.status === 'CONCLUDED' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {h.status}
                      </span>
                    </div>
                    <div className={`text-[11px] truncate ${isSelected ? 'text-slate-200' : 'text-slate-600'}`}>
                      {h.institution_name}
                    </div>
                    <div className="flex items-center justify-between text-[10px] opacity-80 pt-1">
                      <span>Date: {h.scheduled_date}</span>
                      <span>Mode: {h.meeting_mode}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Hearing Minutes & Jurist Recommendation (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {selectedHearing ? (
            <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">SAC Case Dossier</span>
                  <h2 className="text-base font-bold text-[#12345A]">
                    {selectedHearing.institution_name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Appeal Ref: <span className="font-mono font-bold">{selectedHearing.id}</span> • Hearing Date: {selectedHearing.scheduled_date}
                  </p>
                </div>
                {isSacMember && selectedHearing.status !== 'CONCLUDED' && (
                  <button
                    onClick={() => setShowRecModal(true)}
                    className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                  >
                    Record Advisory Recommendation
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500">Committee Chairperson</span>
                  <div className="text-xs font-bold text-slate-900">{selectedHearing.committee_chair}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500">Appellate Mode</span>
                  <div className="text-xs font-bold text-slate-900">{selectedHearing.meeting_mode}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-800">SAC Recommendation:</div>
                <div className="text-sm font-bold text-[#12345A]">
                  {selectedHearing.recommendation ? selectedHearing.recommendation.replace('_', ' ') : 'HEARING PENDING'}
                </div>
                {selectedHearing.reasoning && (
                  <p className="text-[11px] text-slate-700 mt-2 bg-white p-2.5 rounded border border-slate-200 leading-relaxed">
                    <strong>Legal Reasoning:</strong> {selectedHearing.reasoning}
                  </p>
                )}
                {selectedHearing.condition_notes && (
                  <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded border border-amber-200 mt-2">
                    <strong>Conditions Precedent:</strong> {selectedHearing.condition_notes}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-lg border border-[#DCE3EA] text-center text-xs text-slate-500">
              Select an appellate hearing from the docket to review proceedings.
            </div>
          )}
        </div>
      </div>

      {/* Schedule Hearing Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#12345A]">Schedule Appellate Hearing</h3>
              <button onClick={() => setShowScheduleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSchedule} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Application</label>
                <select
                  value={scheduleForm.applicationId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, applicationId: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                >
                  <option value="">-- Choose Application --</option>
                  {applications.map(app => (
                    <option key={app.id} value={app.id}>
                      {app.application_number} ({app.institution_name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Hearing Date</label>
                <input
                  type="date"
                  value={scheduleForm.scheduledDate}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledDate: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Appellate Chairperson</label>
                <input
                  type="text"
                  value={scheduleForm.committeeChair}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, committeeChair: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-100 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded bg-[#12345A] text-white text-xs font-bold"
                >
                  {actionLoading ? 'Scheduling...' : 'Confirm Docket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Recommendation Modal */}
      {showRecModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#12345A]">Record SAC Advisory Recommendation</h3>
              <button onClick={() => setShowRecModal(false)}>✕</button>
            </div>
            <form onSubmit={handleRecordRecommendation} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Appellate Recommendation</label>
                <select
                  value={recForm.recommendation}
                  onChange={(e) => setRecForm({ ...recForm, recommendation: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-bold"
                >
                  <option value="REVERSAL_APPROVED">RECOMMEND REVERSAL & GRANT OF APPROVAL</option>
                  <option value="UPHELD_REJECTION">UPHOLD REJECTION (APPEAL DISMISSED)</option>
                  <option value="RE_SCRUTINY_DIRECTED">DIRECT RE-SCRUTINY / REMAND BACK</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Statutory & Factual Reasoning</label>
                <textarea
                  rows={3}
                  value={recForm.reasoning}
                  onChange={(e) => setRecForm({ ...recForm, reasoning: e.target.value })}
                  required
                  placeholder="Detail documentary evidence submitted by institution..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Conditions Precedent (if any)</label>
                <input
                  type="text"
                  value={recForm.conditionNotes}
                  onChange={(e) => setRecForm({ ...recForm, conditionNotes: e.target.value })}
                  placeholder="e.g. Subject to physical inspection within 60 days..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-100 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded bg-emerald-700 text-white text-xs font-bold"
                >
                  {actionLoading ? 'Recording...' : 'Submit Judicial Recommendation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
