import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Plus, Download, RefreshCw, FileText, CheckCircle2,
  AlertTriangle, Clock, Shield, ChevronLeft, ChevronRight, Eye, Landmark,
  AlertCircle, ArrowUpDown, Calendar, ExternalLink
} from 'lucide-react';
import { fdrApi, fdrReportApi } from '../api';

export default function FdrListView({
  user,
  initialFilter = null,
  onOpenRegisterModal,
  onSelectFdr
}) {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [activeTab, setActiveTab] = useState(initialFilter || 'ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRecords = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 15 };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (bankFilter) params.issuing_bank = bankFilter;

      if (activeTab === 'ACTIVE') params.status = 'ACTIVE';
      else if (activeTab === 'PENDING') params.verification_status = 'PENDING';
      else if (activeTab === 'DISCREPANT') params.verification_status = 'DISCREPANT';
      else if (activeTab === 'MATURING_30') params.filter = 'MATURING_30';
      else if (activeTab === 'MATURED') params.filter = 'MATURED';
      else if (activeTab === 'RELEASED') params.status = 'RELEASED';

      const res = await fdrApi.list(params);
      setRecords(res.data?.records || []);
      if (res.data?.pagination) {
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Error fetching FDR records:', err);
      setError(err.message || 'Failed to fetch FDR records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(1);
  }, [activeTab, bankFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRecords(1);
  };

  const getStatusBadge = (status, maturityDate) => {
    const isPast = new Date(maturityDate) < new Date();
    if (status === 'ACTIVE' && isPast) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">MATURED (OVERDUE)</span>;
    }
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">ACTIVE</span>;
      case 'PENDING_VERIFICATION':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">PENDING VERIFICATION</span>;
      case 'MATURING_SOON':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">MATURING SOON</span>;
      case 'MATURED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">MATURED</span>;
      case 'RENEWAL_DUE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">RENEWAL DUE</span>;
      case 'RENEWED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">RENEWED</span>;
      case 'RELEASE_REQUESTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">RELEASE REQUESTED</span>;
      case 'RELEASED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">RELEASED</span>;
      case 'DRAFT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">DRAFT</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const getVerificationBadge = (vStatus) => {
    switch (vStatus) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verified</span>
          </span>
        );
      case 'DISCREPANT':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span>Discrepant</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-800">
            <AlertCircle className="w-3.5 h-3.5 text-red-700" />
            <span>Rejected</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-[#12345A]" />
            <span>AICTE Security Deposit & FDR Master Register</span>
          </h2>
          <p className="text-xs text-slate-500">
            Statutory Fixed Deposit Receipts, Bank Guarantees, Lien Status & Custody Tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRecords(pagination.page)}
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => fdrReportApi.downloadCsv()}
            className="px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenRegisterModal}
            className="px-3.5 py-2 text-xs font-bold text-white bg-[#12345A] hover:bg-[#1B5E80] rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#F2A900]" />
            <span>Register FDR</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px text-xs font-semibold">
        {[
          { id: 'ALL', label: 'All Deposits' },
          { id: 'ACTIVE', label: 'Active & Verified' },
          { id: 'PENDING', label: 'Pending Verification' },
          { id: 'MATURING_30', label: 'Expiring Soon (<=30 Days)' },
          { id: 'MATURED', label: 'Matured / Renewal Due' },
          { id: 'DISCREPANT', label: 'Discrepant' },
          { id: 'RELEASED', label: 'Released / Refunded' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2.5 rounded-t-lg transition whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white text-[#12345A] border-t-2 border-x border-[#12345A] font-bold shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Bank Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by FDR Number, Bank Name, IFSC code, Institution Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12345A]/20"
          />
        </form>

        <div className="flex items-center gap-2">
          <select
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#12345A]/20"
          >
            <option value="">All Issuing Banks</option>
            <option value="State Bank of India">State Bank of India (SBI)</option>
            <option value="Punjab National Bank">Punjab National Bank (PNB)</option>
            <option value="Bank of Baroda">Bank of Baroda</option>
            <option value="Canara Bank">Canara Bank</option>
            <option value="Bank of India">Bank of India</option>
            <option value="HDFC Bank">HDFC Bank</option>
            <option value="ICICI Bank">ICICI Bank</option>
          </select>

          <button
            onClick={() => fetchRecords(1)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
          >
            Search
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#12345A]" />
            Loading FDR Master Register...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 text-xs">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
            {error}
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No fixed deposit records match your current filter parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">FDR / Instrument No.</th>
                  <th className="py-3 px-4">Institution Name & Code</th>
                  <th className="py-3 px-4">Issuing Bank & Branch</th>
                  <th className="py-3 px-4">Deposit Amount</th>
                  <th className="py-3 px-4">Maturity Date</th>
                  <th className="py-3 px-4">Lien Marked</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => {
                  const isMatured = new Date(r.maturity_date) < new Date();
                  const isMaturingSoon = !isMatured && (new Date(r.maturity_date) - new Date() <= 30 * 86400000);

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => onSelectFdr(r.id)}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[#12345A]">
                        <div>{r.fdr_number}</div>
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          {r.purpose?.replace(/_/g, ' ')}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 max-w-[200px] truncate" title={r.institution_name}>
                          {r.institution_name || 'N/A'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {r.institution_code} • {r.institution_region}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{r.issuing_bank}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                          {r.bank_branch} • {r.ifsc_code}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        ₹{Number(r.deposit_amount).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3 px-4">
                        <div className={`font-semibold ${isMatured ? 'text-red-600' : isMaturingSoon ? 'text-amber-600' : 'text-slate-800'}`}>
                          {r.maturity_date}
                        </div>
                        {isMatured && (
                          <div className="text-[9px] text-red-600 font-bold uppercase">Matured Past Due</div>
                        )}
                        {isMaturingSoon && (
                          <div className="text-[9px] text-amber-600 font-bold uppercase">&lt; 30 Days Left</div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {r.lien_marked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Shield className="w-3 h-3 text-emerald-600" />
                            <span>Marked</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            Unmarked
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {getStatusBadge(r.status, r.maturity_date)}
                      </td>

                      <td className="py-3 px-4">
                        {getVerificationBadge(r.verification_status)}
                      </td>

                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectFdr(r.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#12345A] hover:bg-slate-100 rounded border border-slate-200 transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          <div>
            Showing Page <span className="font-bold text-slate-800">{pagination.page}</span> of <span className="font-bold text-slate-800">{pagination.totalPages}</span> ({pagination.total} total records)
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchRecords(pagination.page - 1)}
              className="p-1 rounded border border-slate-200 hover:bg-white disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchRecords(pagination.page + 1)}
              className="p-1 rounded border border-slate-200 hover:bg-white disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
