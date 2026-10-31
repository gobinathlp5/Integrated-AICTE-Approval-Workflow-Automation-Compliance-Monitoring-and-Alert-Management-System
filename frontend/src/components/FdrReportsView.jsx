import React, { useState, useEffect } from 'react';
import {
  BarChart3, Download, RefreshCw, Landmark, Calendar, Shield,
  FileSpreadsheet, Filter, CheckCircle2, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import { fdrReportApi } from '../api';

export default function FdrReportsView({ user, onSelectFdr }) {
  const [activeTab, setActiveTab] = useState('REGISTER');
  const [registerData, setRegisterData] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [bankData, setBankData] = useState([]);
  const [complianceData, setComplianceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [bankFilter, setBankFilter] = useState('');

  const loadReports = async () => {
    setLoading(true);
    try {
      const [regRes, calRes, bankRes, compRes] = await Promise.all([
        fdrReportApi.getRegister({ status: statusFilter, issuing_bank: bankFilter }).catch(() => ({ data: [] })),
        fdrReportApi.getMaturityCalendar().catch(() => ({ data: [] })),
        fdrReportApi.getBankDistribution().catch(() => ({ data: [] })),
        fdrReportApi.getComplianceSummary().catch(() => ({ data: [] }))
      ]);
      setRegisterData(regRes.data || []);
      setCalendarData(calRes.data || []);
      setBankData(bankRes.data || []);
      setComplianceData(compRes.data || []);
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [statusFilter, bankFilter]);

  const formatCurrency = (val) => {
    if (!val) return '₹0';
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)} Lakh`;
    }
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#12345A]" />
            <span>AICTE Security Deposit & FDR Analytics & Reports</span>
          </h2>
          <p className="text-xs text-slate-500">
            Statutory registry reporting, maturity calendar forecasts, and scheduled bank exposure analysis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadReports}
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            title="Refresh Reports"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => fdrReportApi.downloadCsv()}
            className="px-3.5 py-2 text-xs font-bold text-white bg-[#12345A] hover:bg-[#1B5E80] rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-[#F2A900]" />
            <span>Download Full Register (CSV)</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold overflow-x-auto">
        {[
          { id: 'REGISTER', label: `FDR Master Register (${registerData.length})` },
          { id: 'CALENDAR', label: 'Maturity Schedule (24-Month)' },
          { id: 'BANK_RISK', label: 'Scheduled Bank Exposure' },
          { id: 'REGIONAL', label: 'Regional Compliance Summary' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`py-2.5 px-4 border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === t.id
                ? 'border-[#12345A] text-[#12345A] font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#12345A]" />
          Generating reports...
        </div>
      ) : activeTab === 'REGISTER' ? (
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filters:</span>
            </span>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-1.5 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="MATURING_SOON">MATURING SOON</option>
              <option value="MATURED">MATURED</option>
              <option value="PENDING_VERIFICATION">PENDING VERIFICATION</option>
              <option value="RELEASED">RELEASED</option>
            </select>

            <select
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              className="p-1.5 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">All Banks</option>
              <option value="State Bank of India">State Bank of India</option>
              <option value="Punjab National Bank">Punjab National Bank</option>
              <option value="Bank of Baroda">Bank of Baroda</option>
              <option value="HDFC Bank">HDFC Bank</option>
              <option value="Canara Bank">Canara Bank</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">FDR Number</th>
                  <th className="py-3 px-4">Institution</th>
                  <th className="py-3 px-4">Bank & Branch</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Maturity Date</th>
                  <th className="py-3 px-4">Lien Marked</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registerData.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 transition cursor-pointer"
                    onClick={() => onSelectFdr && onSelectFdr(r.id)}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-[#12345A]">{r.fdr_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 truncate max-w-[180px]">{r.institution_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{r.institution_code}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{r.issuing_bank}</div>
                      <div className="text-[10px] text-slate-400">{r.ifsc_code}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{Number(r.deposit_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">{r.issue_date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{r.maturity_date}</td>
                    <td className="py-3 px-4">
                      {r.lien_marked ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          YES
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">NO</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'CALENDAR' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#12345A]" />
            <span>Monthly Maturing Security Deposit Schedule</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {calendarData.map((c, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {new Date(c.month_period + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {c.fdr_count} Fixed Deposit Instrument(s) Maturing
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-800">
                    {formatCurrency(c.total_amount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'BANK_RISK' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Landmark className="w-4 h-4 text-[#12345A]" />
            <span>Custody Exposure by Scheduled Commercial Bank</span>
          </h3>
          <div className="space-y-4">
            {bankData.map((b, i) => {
              const totalAll = bankData.reduce((acc, curr) => acc + curr.total_amount, 0) || 1;
              const pct = Math.round((b.total_amount / totalAll) * 100);
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{b.issuing_bank}</span>
                    <span className="font-bold text-[#12345A]">
                      {formatCurrency(b.total_amount)} ({b.count} FDRs • {pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-[#12345A] h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs overflow-x-auto">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-700" />
            <span>AICTE Regional FDR Compliance Breakdown</span>
          </h3>
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">AICTE Region</th>
                <th className="py-2.5 px-4">Total Institutions</th>
                <th className="py-2.5 px-4">Total FDR Deposits</th>
                <th className="py-2.5 px-4">Total Custody Value</th>
                <th className="py-2.5 px-4">Active & Verified</th>
                <th className="py-2.5 px-4">Overdue Matured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {complianceData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-bold text-slate-900">{row.region}</td>
                  <td className="py-2.5 px-4">{row.total_institutions}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-[#12345A]">{row.total_fdrs}</td>
                  <td className="py-2.5 px-4 font-bold text-emerald-700">{formatCurrency(row.total_deposit_value)}</td>
                  <td className="py-2.5 px-4 font-semibold text-emerald-600">{row.active_fdrs || 0}</td>
                  <td className="py-2.5 px-4 font-semibold text-red-600">{row.overdue_matured_fdrs || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
