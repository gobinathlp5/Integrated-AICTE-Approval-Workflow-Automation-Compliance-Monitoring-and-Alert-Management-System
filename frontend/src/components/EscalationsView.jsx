import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, ShieldAlert, CheckCircle, Clock, PlayCircle, 
  RefreshCw, ArrowUpRight, Check 
} from 'lucide-react';
import { escalationApi } from '../api';

export default function EscalationsView({ user }) {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    loadEscalations();
  }, []);

  const loadEscalations = async () => {
    setLoading(true);
    try {
      const res = await escalationApi.list();
      setEscalations(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSlaScan = async () => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await escalationApi.scan();
      setStatusMessage({ 
        type: 'success', 
        text: `Statutory SLA scanner completed. Evaluated applications against APH deadlines: ${res.newEscalationsCreated} new escalation(s) triggered.` 
      });
      await loadEscalations();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveEscalation = async (escId) => {
    const notes = prompt('Enter supervisory action / resolution notes:');
    if (!notes) return;
    try {
      await escalationApi.resolve(escId, notes);
      await loadEscalations();
    } catch (err) {
      alert('Failed to resolve escalation: ' + err.message);
    }
  };

  const openCount = escalations.filter(e => e.status === 'OPEN').length;
  const criticalCount = escalations.filter(e => e.escalation_level === 'LEVEL_3' && e.status === 'OPEN').length;

  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="bg-white rounded-lg border-l-4 border-red-500 border border-[#DCE3EA] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-red-700">VIGILANCE & SLA OVERSIGHT</span>
              <span className="bg-red-50 text-red-800 text-[10px] px-2 py-0.5 rounded font-mono font-bold">Automated Breach Detection</span>
            </div>
            <h1 className="text-xl font-bold text-[#12345A] mt-1">SLA Escalation Engine & Processing Vigilance</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated multi-tier statutory breach escalation to Regional Officers (L1), Bureau Heads (L2), and Apex Member Secretary (L3).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunSlaScan}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              {actionLoading ? 'Scanning Deadlines...' : 'Run Automated SLA Scan'}
            </button>
            <button
              onClick={loadEscalations}
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

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs flex items-center gap-3">
          <div className="p-3 bg-red-50 rounded-lg text-red-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{openCount}</div>
            <div className="text-[11px] text-slate-500 font-medium">Active Escalations</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600">{criticalCount}</div>
            <div className="text-[11px] text-slate-500 font-medium">Critical Level 3 Apex Alerts</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600">{escalations.length - openCount}</div>
            <div className="text-[11px] text-slate-500 font-medium">Supervisory Resolutions</div>
          </div>
        </div>
      </div>

      {/* Escalations List */}
      <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
        <h2 className="text-xs font-bold text-[#12345A] uppercase tracking-wide pb-2 border-b border-slate-100">
          Escalation Dossier ({escalations.length})
        </h2>

        {escalations.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center">
            Zero pending SLA escalations. All applications are proceeding within statutory timeframes.
          </div>
        ) : (
          <div className="space-y-3">
            {escalations.map(esc => (
              <div key={esc.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      esc.escalation_level === 'LEVEL_3' ? 'bg-red-600 text-white' :
                      esc.escalation_level === 'LEVEL_2' ? 'bg-amber-600 text-white' :
                      'bg-blue-600 text-white'
                    }`}>
                      {esc.escalation_level}
                    </span>
                    <span className="font-bold text-slate-900">{esc.application_number}</span>
                    <span className="text-slate-500">({esc.institution_name})</span>
                  </div>
                  <span className={`self-start sm:self-auto px-2 py-0.5 rounded text-[10px] font-bold ${
                    esc.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {esc.status}
                  </span>
                </div>

                <p className="text-[11px] text-slate-700 font-medium">{esc.reason}</p>

                <div className="text-[10px] text-slate-500 flex flex-wrap gap-4 pt-1">
                  <span>Target Role: <strong>{esc.target_role}</strong></span>
                  <span>Triggered: {new Date(esc.created_at).toLocaleString()}</span>
                  {esc.resolved_at && <span>Resolved: {new Date(esc.resolved_at).toLocaleString()}</span>}
                </div>

                {esc.resolution_notes && (
                  <div className="bg-white p-2 rounded border border-slate-200 text-[10px] text-emerald-800">
                    <strong>Supervisory Action Taken:</strong> {esc.resolution_notes}
                  </div>
                )}

                {esc.status === 'OPEN' && (
                  <div className="pt-2 border-t border-slate-200 flex justify-end">
                    <button
                      onClick={() => handleResolveEscalation(esc.id)}
                      className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-bold cursor-pointer"
                    >
                      Record Resolution & Close Alert
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
