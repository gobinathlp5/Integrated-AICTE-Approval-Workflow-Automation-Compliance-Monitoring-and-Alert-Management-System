import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, Calendar, MapPin, Camera, CheckCircle, AlertTriangle, 
  UserCheck, PlusCircle, RefreshCw, Eye, UploadCloud 
} from 'lucide-react';
import { evcApi, applicationApi, adminApi } from '../api';

export default function EvcManagementView({ user }) {
  const [inspections, setInspections] = useState([]);
  const [applications, setApplications] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Scheduling Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    applicationId: '',
    scheduledDate: '',
    leaderId: '',
    memberIds: [],
    inspectionType: 'REGULAR'
  });

  // Submit Findings Modal
  const [showFindingsModal, setShowFindingsModal] = useState(false);
  const [findingsForm, setFindingsForm] = useState({
    findingsSummary: '',
    outcome: 'RECOMMENDED',
    infrastructureSatisfactory: true,
    facultySatisfactory: true,
    deficiencyFound: false
  });

  // Evidence Upload Modal
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidenceMeta, setEvidenceMeta] = useState({
    fileTitle: '',
    latitude: 28.5355,
    longitude: 77.1558,
    remarks: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inspRes, appsRes] = await Promise.all([
        evcApi.listInspections(),
        applicationApi.list()
      ]);
      setInspections(inspRes || []);
      setApplications(appsRes.applications || []);
      if (inspRes && inspRes.length > 0) {
        setSelectedInspection(inspRes[0]);
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
      await evcApi.schedule(scheduleForm);
      setStatusMessage({ type: 'success', text: 'EVC inspection scheduled successfully with verified committee members.' });
      setShowScheduleModal(false);
      await loadData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitFindings = async (e) => {
    e.preventDefault();
    if (!selectedInspection) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await evcApi.submitFindings(selectedInspection.id, findingsForm);
      setStatusMessage({ type: 'success', text: 'Inspection report and committee findings submitted.' });
      setShowFindingsModal(false);
      await loadData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadEvidence = async (e) => {
    e.preventDefault();
    if (!selectedInspection || !evidenceFile) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', evidenceFile);
      formData.append('fileTitle', evidenceMeta.fileTitle || evidenceFile.name);
      formData.append('latitude', evidenceMeta.latitude);
      formData.append('longitude', evidenceMeta.longitude);
      formData.append('remarks', evidenceMeta.remarks);

      await evcApi.uploadEvidence(selectedInspection.id, formData);
      setStatusMessage({ type: 'success', text: 'Geo-tagged evidence photo uploaded successfully.' });
      setShowEvidenceModal(false);
      setEvidenceFile(null);
      await loadData();
    } catch (err) {
      alert('Error uploading evidence: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isCoordinator = user && (user.role === 'EVC_COORDINATOR' || user.role === 'SUPER_ADMIN' || user.role === 'AICTE_ADMIN');
  const isEvcMember = user && (user.role === 'EVC_MEMBER' || user.role === 'EVC_COORDINATOR' || user.role === 'SUPER_ADMIN');

  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="bg-white rounded-lg border-l-4 border-[#F2A900] border border-[#DCE3EA] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1B5E80]">INSPECTION BUREAU</span>
              <span className="bg-blue-50 text-[#12345A] text-[10px] px-2 py-0.5 rounded font-mono font-bold">Physical Verification</span>
            </div>
            <h1 className="text-xl font-bold text-[#12345A] mt-1">Expert Visit Committee (EVC) Inspections</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Committee constitution without conflict of interest, on-site campus verification, and geo-tagged photographic evidence.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isCoordinator && (
              <button
                onClick={() => setShowScheduleModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#12345A] hover:bg-[#1B5E80] text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Schedule EVC Inspection
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

      {/* Main Inspections List & Inspection Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Scheduled Inspections (1 Col) */}
        <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-4 space-y-3">
          <h2 className="text-xs font-bold text-[#12345A] uppercase tracking-wide pb-2 border-b border-slate-100">
            Inspection Roster ({inspections.length})
          </h2>

          {inspections.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">
              No EVC inspections scheduled yet.
            </div>
          ) : (
            <div className="space-y-2">
              {inspections.map(insp => {
                const isSelected = selectedInspection && selectedInspection.id === insp.id;
                return (
                  <div
                    key={insp.id}
                    onClick={() => setSelectedInspection(insp)}
                    className={`p-3 rounded-lg border cursor-pointer transition text-xs space-y-1.5 ${
                      isSelected
                        ? 'bg-[#12345A] text-white border-[#12345A]'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{insp.application_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        insp.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        insp.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {insp.status}
                      </span>
                    </div>
                    <div className={`text-[11px] truncate ${isSelected ? 'text-slate-200' : 'text-slate-600'}`}>
                      {insp.institution_name} ({insp.region})
                    </div>
                    <div className="flex items-center justify-between text-[10px] opacity-80 pt-1">
                      <span>Date: {insp.scheduled_date}</span>
                      <span>Leader: {insp.leader_name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Inspection Dossier & Evidence (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {selectedInspection ? (
            <>
              {/* Inspection Dossier Card */}
              <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">EVC Inspection Dossier</span>
                    <h2 className="text-base font-bold text-[#12345A]">
                      {selectedInspection.institution_name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Application No: <span className="font-mono font-bold">{selectedInspection.application_number}</span> • Region: {selectedInspection.region}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEvcMember && selectedInspection.status !== 'COMPLETED' && (
                      <button
                        onClick={() => setShowFindingsModal(true)}
                        className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                      >
                        Submit Inspection Findings
                      </button>
                    )}
                    {isEvcMember && (
                      <button
                        onClick={() => setShowEvidenceModal(true)}
                        className="px-3 py-1.5 rounded bg-[#1B5E80] hover:bg-[#12345A] text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Add Geo-Photo
                      </button>
                    )}
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500">Scheduled Date</span>
                    <div className="text-xs font-bold text-slate-900">{selectedInspection.scheduled_date}</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500">Committee Leader</span>
                    <div className="text-xs font-bold text-slate-900">{selectedInspection.leader_name}</div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500">Infrastructure</span>
                    <div className="text-xs font-bold text-slate-900">
                      {selectedInspection.infrastructure_satisfactory ? 'Satisfactory' : 'Under Review / Deficient'}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500">Committee Outcome</span>
                    <div className="text-xs font-bold text-[#12345A]">
                      {selectedInspection.outcome || 'PENDING REPORT'}
                    </div>
                  </div>
                </div>

                {selectedInspection.findings_summary && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-blue-700" />
                      Executive Committee Findings Summary:
                    </div>
                    <p className="text-[11px] leading-relaxed">{selectedInspection.findings_summary}</p>
                  </div>
                )}

                {/* Geo-Tagged Evidence Gallery */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#12345A] uppercase flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500" />
                      Geo-Tagged Inspection Evidence Photos ({selectedInspection.evidence ? selectedInspection.evidence.length : 0})
                    </h3>
                  </div>

                  {(!selectedInspection.evidence || selectedInspection.evidence.length === 0) ? (
                    <div className="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded border border-dashed border-slate-300">
                      No geo-tagged evidence uploaded yet for this on-site visit.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedInspection.evidence.map(ev => (
                        <div key={ev.id} className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs space-y-1.5">
                          <div className="font-bold text-slate-800 truncate">{ev.file_title}</div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                            <span>Lat: {ev.latitude}</span>
                            <span>Lng: {ev.longitude}</span>
                          </div>
                          {ev.remarks && (
                            <p className="text-[10px] text-slate-600 italic">"{ev.remarks}"</p>
                          )}
                          <div className="text-[9px] text-slate-400">
                            Captured on: {new Date(ev.uploaded_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-8 rounded-lg border border-[#DCE3EA] text-center text-xs text-slate-500">
              Select an inspection on the left to review the committee dossier.
            </div>
          )}
        </div>
      </div>

      {/* Schedule Inspection Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#12345A]">Schedule EVC On-Site Inspection</h3>
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Scheduled Inspection Date</label>
                <input
                  type="date"
                  value={scheduleForm.scheduledDate}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledDate: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Committee Leader User ID</label>
                <input
                  type="text"
                  value={scheduleForm.leaderId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, leaderId: e.target.value })}
                  placeholder="usr_evc_coord_01"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Assigned Member User IDs (Comma separated)</label>
                <input
                  type="text"
                  placeholder="usr_evc_member_01"
                  onChange={(e) => setScheduleForm({ ...scheduleForm, memberIds: e.target.value.split(',').map(s => s.trim()) })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono"
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
                  {actionLoading ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Findings Modal */}
      {showFindingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#12345A]">Submit EVC Inspection Findings</h3>
              <button onClick={() => setShowFindingsModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitFindings} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Overall Inspection Outcome</label>
                <select
                  value={findingsForm.outcome}
                  onChange={(e) => setFindingsForm({ ...findingsForm, outcome: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-bold"
                >
                  <option value="RECOMMENDED">RECOMMENDED FOR APPROVAL</option>
                  <option value="DEFICIENT">DEFICIENCIES NOTED</option>
                  <option value="NOT_RECOMMENDED">NOT RECOMMENDED / REJECT</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-800">
                  <input
                    type="checkbox"
                    checked={findingsForm.infrastructureSatisfactory}
                    onChange={(e) => setFindingsForm({ ...findingsForm, infrastructureSatisfactory: e.target.checked })}
                    className="rounded text-[#12345A]"
                  />
                  <span>Physical Infrastructure & Laboratories Satisfactory</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-800">
                  <input
                    type="checkbox"
                    checked={findingsForm.facultySatisfactory}
                    onChange={(e) => setFindingsForm({ ...findingsForm, facultySatisfactory: e.target.checked })}
                    className="rounded text-[#12345A]"
                  />
                  <span>Faculty Qualifications & Biometric Attendance Satisfactory</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Executive Summary of Observations</label>
                <textarea
                  rows={3}
                  value={findingsForm.findingsSummary}
                  onChange={(e) => setFindingsForm({ ...findingsForm, findingsSummary: e.target.value })}
                  required
                  placeholder="Detail laboratory equipment, library titles, fire egress, computer center..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFindingsModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-100 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded bg-emerald-700 text-white text-xs font-bold"
                >
                  {actionLoading ? 'Saving...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Geo-Photo Modal */}
      {showEvidenceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#12345A]">Upload Geo-Tagged Photo Evidence</h3>
              <button onClick={() => setShowEvidenceModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUploadEvidence} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Photo Title / Lab Name</label>
                <input
                  type="text"
                  value={evidenceMeta.fileTitle}
                  onChange={(e) => setEvidenceMeta({ ...evidenceMeta, fileTitle: e.target.value })}
                  placeholder="e.g. AI & Robotics Computing Laboratory"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={evidenceMeta.latitude}
                    onChange={(e) => setEvidenceMeta({ ...evidenceMeta, latitude: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={evidenceMeta.longitude}
                    onChange={(e) => setEvidenceMeta({ ...evidenceMeta, longitude: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Photo File *</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setEvidenceFile(e.target.files[0])}
                  required
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-[#12345A] file:text-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEvidenceModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-100 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !evidenceFile}
                  className="px-4 py-1.5 rounded bg-[#12345A] text-white text-xs font-bold"
                >
                  {actionLoading ? 'Uploading...' : 'Upload Evidence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
