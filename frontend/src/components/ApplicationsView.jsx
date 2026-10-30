import React, { useState, useEffect } from 'react';
import { 
  Building, CheckCircle2, Clock, Users, ArrowRight, 
  Check, X, AlertTriangle, Shield, RefreshCw 
} from 'lucide-react';
import { applicationApi } from '../api';

export default function ApplicationsView({ user, onSelectDocumentFolder }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Competent Authority Decision Form
  const [decision, setDecision] = useState('APPROVED');
  const [decisionRemarks, setDecisionRemarks] = useState('');

  useEffect(() => {
    loadApplications();
  }, [user]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const res = await applicationApi.list();
      setApplications(res.applications || []);
      if (res.applications && res.applications.length > 0) {
        setSelectedApp(res.applications[0]);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteDecision = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;

    setActionLoading(true);
    try {
      await applicationApi.decide(selectedApp.id, decision, decisionRemarks);
      alert(`Application determination [${decision}] recorded by Competent Authority.`);
      setDecisionRemarks('');
      loadApplications();
    } catch (err) {
      alert('Decision error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isCompetentAuthority = user.role === 'COMPETENT_AUTHORITY' || user.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Building className="w-5 h-5 text-blue-900" />
          <span>Integrated Application Management & Processing Module</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          End-to-end integration across Scrutiny, EVC, Committee Processing, and Competent Authority Approval
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Applications List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Applications List</h3>
            <span className="text-xs text-slate-400">{applications.length} items</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-900 mx-auto mb-2" />
                Loading scoped applications...
              </div>
            ) : applications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No applications matching tenant scope.
              </div>
            ) : (
              applications.map((app) => (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className={`p-4 cursor-pointer transition ${
                    selectedApp?.id === app.id ? 'bg-blue-50/70 border-l-4 border-blue-900' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-900">{app.application_number}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {app.academic_year}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mt-1">{app.institution_name}</h4>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between mt-2">
                    <span>Region: {app.region}</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      app.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                      app.status === 'UNDER_SCRUTINY' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {app.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 2 Columns: Application Detail & Processing Actions */}
        <div className="lg:col-span-2 space-y-6">
          {selectedApp ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
              
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                    {selectedApp.application_number}
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-2">{selectedApp.institution_name}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>Academic Cycle: {selectedApp.academic_year}</span>
                    <span>•</span>
                    <span>Type: {selectedApp.application_type.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  selectedApp.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                  selectedApp.status === 'UNDER_SCRUTINY' ? 'bg-amber-100 text-amber-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  {selectedApp.status}
                </span>
              </div>

              {/* Assignments Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Assigned Scrutiny Evaluator</span>
                  <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                    {selectedApp.scrutiny_officer_name || 'Not yet appointed'}
                  </span>
                  <span className="text-[11px] text-slate-500">ID: {selectedApp.assigned_scrutiny_officer_id || 'N/A'}</span>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Assigned EVC Inspection Committee</span>
                  <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                    {selectedApp.committee_name || 'Pending Committee Empanelment'}
                  </span>
                  <span className="text-[11px] text-slate-500">Code: {selectedApp.committee_code || 'N/A'}</span>
                </div>
              </div>

              {/* Remarks & History */}
              {selectedApp.remarks && (
                <div className="text-xs bg-blue-50/50 border border-blue-100 p-3 rounded-lg">
                  <span className="font-bold text-blue-900 block mb-0.5">Application Docket Notes:</span>
                  <p className="text-slate-700">{selectedApp.remarks}</p>
                </div>
              )}

              {/* Competent Authority Determination Section */}
              {isCompetentAuthority && (
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                    <Shield className="w-4 h-4 text-indigo-700" />
                    <span>Competent Authority Statutory Determination (Approve / Reject)</span>
                  </div>

                  <form onSubmit={handleExecuteDecision} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Determination</label>
                      <select
                        value={decision}
                        onChange={(e) => setDecision(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium"
                      >
                        <option value="APPROVED">APPROVED - Issue Official Extension of Approval (EoA)</option>
                        <option value="REJECTED">REJECTED - Issue Rejection Order with Hearing Rights</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Official Decision Remarks / Conditions</label>
                      <textarea
                        required
                        rows={3}
                        value={decisionRemarks}
                        onChange={(e) => setDecisionRemarks(e.target.value)}
                        placeholder="e.g. Approved subject to compliance of faculty Cadre ratio by next academic quarter."
                        className="w-full border border-slate-300 rounded-lg p-2.5"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="bg-indigo-900 hover:bg-indigo-950 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50 cursor-pointer"
                    >
                      {actionLoading ? 'Recording Authority Decision...' : 'Commit Regulatory Decision'}
                    </button>
                  </form>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-400">
              Select an application from the queue to view processing details.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
