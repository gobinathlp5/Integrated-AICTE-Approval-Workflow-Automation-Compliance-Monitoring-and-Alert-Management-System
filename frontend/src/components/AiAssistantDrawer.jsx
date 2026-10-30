import React, { useState, useEffect } from 'react';
import { 
  Sparkles, X, CheckCircle, AlertTriangle, FileText, Search, 
  Clock, ShieldAlert, Cpu, ArrowRight 
} from 'lucide-react';
import { aiApi, applicationApi } from '../api';

export default function AiAssistantDrawer({ isOpen, onClose, user }) {
  const [activeTab, setActiveTab] = useState('completeness');
  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [slaRisks, setSlaRisks] = useState(null);
  const [loading, setLoading] = useState(false);

  // OCR Classification State
  const [ocrInput, setOcrInput] = useState('');
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadApps();
      loadSlaRisks();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedAppId && isOpen) {
      runAnalysis(selectedAppId);
    }
  }, [selectedAppId, isOpen]);

  const loadApps = async () => {
    try {
      const res = await applicationApi.list();
      setApplications(res.applications || []);
      if (res.applications && res.applications.length > 0) {
        setSelectedAppId(res.applications[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const runAnalysis = async (appId) => {
    setLoading(true);
    try {
      const res = await aiApi.analyzeApplication(appId);
      setAnalysis(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSlaRisks = async () => {
    try {
      const res = await aiApi.getSlaRisks();
      setSlaRisks(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClassify = async (e) => {
    e.preventDefault();
    if (!ocrInput) return;
    setOcrLoading(true);
    try {
      const res = await aiApi.classifyDocument({
        title: ocrInput,
        fileName: ocrInput
      });
      setOcrResult(res);
    } catch (err) {
      alert('Classification failed: ' + err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-[#DCE3EA]">
        
        {/* Drawer Header */}
        <div className="bg-[#12345A] text-white p-4 flex items-center justify-between border-b border-[#1B5E80]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F2A900] flex items-center justify-center text-[#12345A]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                AICTE Administrative Advisory Assistant
                <span className="text-[10px] bg-[#1B5E80] text-slate-100 px-1.5 py-0.2 rounded font-mono">v3.0</span>
              </h3>
              <p className="text-[10px] text-slate-300">
                Decision-Support Analytical Co-Pilot for Scrutiny & Regulatory Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mandatory Statutory Disclaimer Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-[11px] text-amber-900 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Statutory Rule:</strong> AI Advisory outputs are strictly analytical and indicative. Statutory authority and final decision rests exclusively with authorized Council officers.
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('completeness')}
            className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'completeness'
                ? 'border-[#12345A] text-[#12345A] bg-white font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Completeness Scan
          </button>
          <button
            onClick={() => setActiveTab('ocr')}
            className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'ocr'
                ? 'border-[#12345A] text-[#12345A] bg-white font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            OCR & Doc Classifier
          </button>
          <button
            onClick={() => setActiveTab('sla')}
            className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'sla'
                ? 'border-[#12345A] text-[#12345A] bg-white font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            SLA Delay Risk
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          
          {/* TAB 1: Completeness Scan */}
          {activeTab === 'completeness' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="font-bold text-[#12345A] whitespace-nowrap">Target Application:</label>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                >
                  {applications.map(app => (
                    <option key={app.id} value={app.id}>
                      {app.application_number} ({app.institution_name})
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="text-center py-8 text-slate-500">Scanning application document repository...</div>
              ) : analysis ? (
                <div className="space-y-4">
                  {/* Completeness Score Card */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-[#12345A]">Statutory Completeness Score</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {analysis.recommendation}
                      </div>
                    </div>
                    <div className="text-3xl font-extrabold text-[#12345A]">
                      {analysis.completenessPercentage}%
                    </div>
                  </div>

                  {/* Checklist Items */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800 uppercase text-[10px]">
                      Mandatory Checklist Breakdown
                    </h4>
                    {analysis.checklist.map(item => (
                      <div key={item.key} className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {item.title}
                            {item.mandatory && (
                              <span className="text-[9px] bg-red-100 text-red-800 px-1 py-0.2 rounded font-bold">Mandatory</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {item.documentCount} document(s) filed
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.verified ? 'bg-emerald-100 text-emerald-800' :
                          item.present ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {item.verified ? 'VERIFIED' : item.present ? 'UPLOADED (UNVERIFIED)' : 'MISSING'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: OCR & Doc Classifier */}
          {activeTab === 'ocr' && (
            <div className="space-y-4">
              <p className="text-slate-600">
                Simulate optical character recognition (OCR) and NLP semantic categorization of statutory certificates and deeds:
              </p>
              <form onSubmit={handleClassify} className="space-y-3">
                <input
                  type="text"
                  value={ocrInput}
                  onChange={(e) => setOcrInput(e.target.value)}
                  placeholder="Enter sample document name (e.g. Registered_Land_Deed_Khasra_89.pdf)"
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOcrInput('Master_Plan_Fire_Safety_NOC_2026.pdf')}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded cursor-pointer"
                  >
                    Try Fire NOC
                  </button>
                  <button
                    type="button"
                    onClick={() => setOcrInput('State_Bank_FDR_One_Crore_Joint.pdf')}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded cursor-pointer"
                  >
                    Try FDR Guarantee
                  </button>
                  <button
                    type="button"
                    onClick={() => setOcrInput('Notarized_Anti_Ragging_Affidavit_100_Stamp.pdf')}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded cursor-pointer"
                  >
                    Try Affidavit
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={ocrLoading || !ocrInput}
                  className="w-full py-2 bg-[#12345A] hover:bg-[#1B5E80] text-white rounded font-bold cursor-pointer transition disabled:opacity-50"
                >
                  {ocrLoading ? 'Processing OCR Stream...' : 'Run Neural Classification'}
                </button>
              </form>

              {ocrResult && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 mt-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-bold text-[#12345A]">Predicted Classification:</span>
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                      {ocrResult.predictedCategory} ({(ocrResult.confidence * 100).toFixed(1)}% Confidence)
                    </span>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-700 text-[11px] mb-1">Extracted Key Entity Values:</h5>
                    <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-[11px] space-y-1">
                      {Object.entries(ocrResult.extractedEntities || {}).map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-slate-500">{key}:</span>
                          <span className="text-slate-900 font-semibold">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SLA Delay Risk */}
          {activeTab === 'sla' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#12345A]">Statutory Calendar SLA Tracking</span>
                <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded text-[10px]">
                  {slaRisks?.highRiskCount || 0} At Risk Applications
                </span>
              </div>

              {slaRisks?.applications?.length === 0 ? (
                <div className="text-center py-6 text-slate-500">All applications running within SLA window.</div>
              ) : (
                <div className="space-y-2">
                  {slaRisks?.applications?.map(app => (
                    <div key={app.applicationId} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{app.applicationNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          app.riskLevel === 'BREACHED' ? 'bg-red-600 text-white' :
                          app.riskLevel === 'HIGH' ? 'bg-amber-600 text-white' :
                          'bg-emerald-600 text-white'
                        }`}>
                          {app.riskLevel} RISK
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">{app.institutionName}</div>
                      <div className="text-[10px] text-slate-500">
                        Stage: <strong className="text-slate-700">{app.currentStage}</strong> • Days Elapsed: <strong className="text-slate-700">{app.daysElapsed} Days</strong> (SLA Limit: {app.slaThreshold} Days)
                      </div>
                      <div className="text-[10px] text-red-700 bg-red-50 p-1 rounded font-medium">
                        {app.riskReason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Drawer Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#12345A] text-white rounded text-xs font-bold hover:bg-[#1B5E80]"
          >
            Close Advisory Assistant
          </button>
        </div>

      </div>
    </div>
  );
}
