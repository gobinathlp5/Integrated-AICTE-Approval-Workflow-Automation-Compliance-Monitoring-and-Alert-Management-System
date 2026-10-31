import React, { useState, useEffect } from 'react';
import {
  Shield, AlertTriangle, Clock, CheckCircle2, FileText, ArrowUpRight,
  TrendingUp, Building2, Landmark, RefreshCw, Download, Plus, AlertCircle,
  ExternalLink, Calendar, DollarSign, Search, Filter
} from 'lucide-react';
import { fdrApi, fdrReportApi } from '../api';

export default function FdrDashboard({ user, onNavigate, onOpenRegisterModal }) {
  const [stats, setStats] = useState(null);
  const [bankDist, setBankDist] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, bankRes, calRes] = await Promise.all([
        fdrApi.getStats(),
        fdrReportApi.getBankDistribution().catch(() => ({ data: [] })),
        fdrReportApi.getMaturityCalendar().catch(() => ({ data: [] }))
      ]);
      setStats(statsRes.data || statsRes);
      setBankDist(bankRes.data || []);
      setCalendar(calRes.data || []);
    } catch (err) {
      console.error('Failed to load FDR Dashboard metrics:', err);
      setError(err.message || 'Unable to retrieve dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

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

  const isOfficer = user && [
    'SUPER_ADMIN', 'AICTE_ADMIN', 'REGULATION_BUREAU', 'REGIONAL_OFFICER', 'BUREAU_OFFICER'
  ].includes(user.role);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="bg-gradient-to-r from-[#12345A] to-[#1B5E80] text-white rounded-xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-[#F2A900] text-slate-950 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                SIH PROBLEM STATEMENT 26265
              </span>
              <span className="bg-white/20 text-white px-2 py-0.5 rounded text-[10px] font-medium">
                Active Financial Year 2026-27
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold font-serif tracking-tight">
              AICTE Security Deposit & Fixed Deposit Receipt (FDR) Management Portal
            </h1>
            <p className="text-xs md:text-sm text-slate-200 mt-1 max-w-3xl">
              Centralized statutory custody, bank lien verification, automated maturity monitoring,
              and compliant renewal and release workflows for technical education institutions across India.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {(!isOfficer || user.role === 'SUPER_ADMIN') && (
              <button
                onClick={onOpenRegisterModal}
                className="px-3.5 py-2 bg-[#F2A900] hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Register New FDR</span>
              </button>
            )}

            <button
              onClick={() => fdrReportApi.downloadCsv()}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-white/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Critical Alert Bar if Matured or Discrepancies exist */}
      {stats && (stats.matured > 0 || stats.maturing15Days > 0 || stats.discrepant > 0) && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="text-sm font-bold text-amber-900">
              Immediate Statutory Attention Required:
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-amber-800 pt-1">
            {stats.matured > 0 && (
              <div 
                onClick={() => onNavigate('fdr-renewals')}
                className="bg-white p-2.5 rounded border border-amber-200 cursor-pointer hover:border-amber-400 transition"
              >
                <span className="font-bold text-red-600">{stats.matured} Matured Deposit(s)</span> are past due date without renewal. Submit renewal or replacement.
              </div>
            )}
            {stats.maturing15Days > 0 && (
              <div 
                onClick={() => onNavigate('fdr-register', { filter: 'MATURING_30' })}
                className="bg-white p-2.5 rounded border border-amber-200 cursor-pointer hover:border-amber-400 transition"
              >
                <span className="font-bold text-amber-700">{stats.maturing15Days} Instrument(s)</span> are maturing in less than 15 calendar days.
              </div>
            )}
            {stats.discrepant > 0 && (
              <div 
                onClick={() => onNavigate('fdr-verification')}
                className="bg-white p-2.5 rounded border border-amber-200 cursor-pointer hover:border-amber-400 transition"
              >
                <span className="font-bold text-red-600">{stats.discrepant} FDR(s)</span> have active discrepancies pending resolution.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Custody Value */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Custody Value</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold text-slate-900">
              {formatCurrency(stats?.totalDepositValue || 0)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Across {stats?.total || 0} registered deposits
            </div>
          </div>
        </div>

        {/* Active & Verified Deposits */}
        <div 
          onClick={() => onNavigate('fdr-register', { status: 'ACTIVE' })}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active & Verified</span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold text-blue-900">
              {stats?.active || 0}
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>Full Bank Lien Marked</span>
            </div>
          </div>
        </div>

        {/* Pending Verification */}
        <div 
          onClick={() => onNavigate('fdr-verification')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-amber-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Verification</span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold text-amber-900">
              {stats?.pendingVerification || 0}
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-0.5">
              Awaiting officer verification
            </div>
          </div>
        </div>

        {/* Maturing / Overdue */}
        <div 
          onClick={() => onNavigate('fdr-renewals')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-red-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Matured / Renewal Due</span>
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold text-red-700">
              {(stats?.matured || 0) + (stats?.maturing30Days || 0)}
            </div>
            <div className="text-[11px] text-red-600 font-medium mt-0.5">
              {stats?.matured || 0} overdue • {stats?.maturing30Days || 0} in 30 days
            </div>
          </div>
        </div>
      </div>

      {/* Middle Grid: Bank Exposure & Maturity Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Monthly Maturity Timeline Calendar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#12345A]" />
                <span>Statutory Maturity Horizon (24-Month Schedule)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Scheduled deposit maturities requiring renewal, replacement or statutory release
              </p>
            </div>
            <button
              onClick={() => onNavigate('fdr-renewals')}
              className="text-xs text-[#12345A] hover:underline font-semibold flex items-center gap-1"
            >
              <span>View Renewals</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {calendar.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No upcoming maturities recorded in the forecast window.
            </div>
          ) : (
            <div className="space-y-3">
              {calendar.slice(0, 6).map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#12345A] text-white flex flex-col items-center justify-center text-xs font-bold">
                      <span>{item.month_period.split('-')[1]}</span>
                      <span className="text-[9px] font-normal text-slate-300">{item.month_period.split('-')[0]}</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        Period: {new Date(item.month_period + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.fdr_count} Fixed Deposit Instrument(s)
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900">
                      {formatCurrency(item.total_amount)}
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                      Scheduled Maturity
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Issuing Bank Exposure */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#12345A]" />
                <span>Issuing Bank Distribution</span>
              </h3>
              <p className="text-xs text-slate-500">Deposit volume by scheduled bank</p>
            </div>
          </div>

          {bankDist.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No bank records loaded.
            </div>
          ) : (
            <div className="space-y-3">
              {bankDist.slice(0, 5).map((b, i) => (
                <div key={i} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-800 truncate max-w-[140px]">{b.issuing_bank}</span>
                    <span className="font-bold text-[#12345A]">{formatCurrency(b.total_amount)}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#12345A] h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((b.total_amount / (stats?.totalDepositValue || 1)) * 100))}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>{b.count} FDR(s)</span>
                    <span>{Math.round((b.total_amount / (stats?.totalDepositValue || 1)) * 100)}% of total</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Access Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('fdr-register')}
          className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-[#12345A] transition cursor-pointer flex items-center gap-3.5 group"
        >
          <div className="p-3 bg-blue-50 text-[#12345A] rounded-xl group-hover:bg-[#12345A] group-hover:text-white transition">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#12345A] transition">
              FDR Master Register
            </h4>
            <p className="text-[11px] text-slate-500">Browse and search all records</p>
          </div>
        </div>

        <div
          onClick={() => onNavigate('fdr-verification')}
          className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-[#12345A] transition cursor-pointer flex items-center gap-3.5 group"
        >
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-800 transition">
              Verification Workspace
            </h4>
            <p className="text-[11px] text-slate-500">Bank liaison and discrepancy audit</p>
          </div>
        </div>

        <div
          onClick={() => onNavigate('fdr-renewals')}
          className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-[#12345A] transition cursor-pointer flex items-center gap-3.5 group"
        >
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-purple-800 transition">
              Renewal & Replacement
            </h4>
            <p className="text-[11px] text-slate-500">Maturity lifecycle & extensions</p>
          </div>
        </div>

        <div
          onClick={() => onNavigate('fdr-releases')}
          className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-[#12345A] transition cursor-pointer flex items-center gap-3.5 group"
        >
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 transition">
              Release & Refund
            </h4>
            <p className="text-[11px] text-slate-500">Tenure completed refunds & lien release</p>
          </div>
        </div>
      </div>
    </div>
  );
}
