import React, { useState, useEffect } from 'react';
import { 
  Shield, CheckCircle2, AlertTriangle, RefreshCw, Filter, 
  Lock, Key, FileText, User, ArrowRight, Hash, Database
} from 'lucide-react';
import { auditApi } from '../api';

const ACTION_COLORS = {
  UPLOAD: 'bg-blue-100 text-blue-800 border-blue-200',
  VIEW: 'bg-slate-100 text-slate-800 border-slate-200',
  DOWNLOAD: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  REPLACE: 'bg-amber-100 text-amber-800 border-amber-200',
  VERIFY: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  RETURN: 'bg-orange-100 text-orange-800 border-orange-200',
  CHANGE_VISIBILITY: 'bg-purple-100 text-purple-800 border-purple-200',
  DELETE: 'bg-red-100 text-red-800 border-red-200',
  DELETE_ATTEMPT: 'bg-red-200 text-red-900 border-red-300'
};

export default function AuditExplorer({ user }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [integrityStatus, setIntegrityStatus] = useState(null);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);

  useEffect(() => {
    loadAuditTrail();
    handleVerifyIntegrity();
  }, [actionFilter]);

  const loadAuditTrail = async () => {
    setLoading(true);
    try {
      const res = await auditApi.getAll({
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        limit: 100
      });
      setRecords(res.records || []);
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    setVerifyingIntegrity(true);
    try {
      const res = await auditApi.verifyIntegrity();
      setIntegrityStatus(res);
    } catch (err) {
      console.error('Integrity check failed:', err);
    } finally {
      setVerifyingIntegrity(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-700" />
          <span>Tamper-Evident Immutable Document Audit History</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          SHA-256 Cryptographic Hash Chaining & Database-Level Immutability Enforcement (Section G)
        </p>
      </div>

      {/* Cryptographic Chain Integrity Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${
              integrityStatus?.isValid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700'
            }`}>
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Cryptographic Blockchain Ledger Status</h3>
                {integrityStatus?.isValid ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> INTACT & TAMPER-FREE
                  </span>
                ) : (
                  <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> TAMPERING DETECTED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {integrityStatus?.message || 'Validating SHA-256 chain...'}
              </p>
            </div>
          </div>

          <button
            onClick={handleVerifyIntegrity}
            disabled={verifyingIntegrity}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1.5 self-start sm:self-auto shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifyingIntegrity ? 'animate-spin' : ''}`} />
            <span>{verifyingIntegrity ? 'Recalculating Chain...' : 'Verify Cryptographic Integrity'}</span>
          </button>
        </div>

        {integrityStatus && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Chained Records</span>
              <span className="font-black text-slate-900 text-base">{integrityStatus.totalRecords} Events</span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Database Trigger Protection</span>
              <span className="font-bold text-emerald-700">PREVENT_UPDATE & DELETE Active</span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Latest Block Hash</span>
              <span className="font-mono text-[10px] text-slate-700 truncate block">
                {integrityStatus.latestHash || 'Genesis State'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700">Filter Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg p-1.5 bg-slate-50 font-medium"
          >
            <option value="ALL">All Actions</option>
            <option value="UPLOAD">UPLOAD</option>
            <option value="VIEW">VIEW</option>
            <option value="DOWNLOAD">DOWNLOAD</option>
            <option value="REPLACE">REPLACE</option>
            <option value="VERIFY">VERIFY</option>
            <option value="RETURN">RETURN</option>
            <option value="CHANGE_VISIBILITY">CHANGE_VISIBILITY</option>
            <option value="DELETE">DELETE</option>
            <option value="DELETE_ATTEMPT">DELETE_ATTEMPT</option>
          </select>
        </div>

        <span className="text-xs text-slate-400">
          Showing {records.length} immutable events
        </span>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-900" />
            <span>Loading Immutable Audit Records...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No audit records matching filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Event & Timestamp</th>
                  <th className="py-3 px-4">Document Details</th>
                  <th className="py-3 px-4">Performed By</th>
                  <th className="py-3 px-4">Institution / App</th>
                  <th className="py-3 px-4">Contextual Details</th>
                  <th className="py-3 px-4">Cryptographic Hash Linkage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.audit_id || r.id} className="hover:bg-slate-50/80 transition">
                    
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${ACTION_COLORS[r.action] || 'bg-slate-100 text-slate-800'}`}>
                        {r.action}
                      </span>
                      <div className="text-[10px] font-mono text-slate-400 mt-1">{r.timestamp}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{r.document_title || r.document_id}</div>
                      <div className="text-[10px] font-mono text-blue-900">{r.document_number || r.document_id}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{r.performed_by_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Role: {r.performed_by_role}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{r.institution_name || r.institution_id}</div>
                      {r.application_id && (
                        <div className="text-[10px] font-mono text-slate-400">{r.application_id}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div className="bg-slate-50 p-2 rounded text-[11px] font-mono text-slate-700 truncate border border-slate-100">
                        {JSON.stringify(r.details)}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-0.5 text-[10px] font-mono">
                        <div className="text-slate-400 truncate max-w-[150px]" title={`Previous: ${r.previous_hash}`}>
                          Prev: {r.previous_hash.slice(0, 10)}...
                        </div>
                        <div className="text-emerald-700 font-bold truncate max-w-[150px]" title={`Entry: ${r.entry_hash}`}>
                          Entry: {r.entry_hash.slice(0, 10)}...
                        </div>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
