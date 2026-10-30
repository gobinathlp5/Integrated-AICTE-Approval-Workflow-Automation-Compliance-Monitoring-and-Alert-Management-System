import React, { useState, useEffect } from 'react';
import { 
  BarChart3, DownloadCloud, FileSpreadsheet, Users, ShieldAlert, 
  RefreshCw, CheckCircle, Clock, MapPin, Award 
} from 'lucide-react';
import { reportApi } from '../api';

export default function ReportsView({ user }) {
  const [summary, setSummary] = useState(null);
  const [workload, setWorkload] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
    setLoading(true);
    try {
      const [sumRes, workRes] = await Promise.all([
        reportApi.getSummary(),
        reportApi.getOfficerWorkload()
      ]);
      setSummary(sumRes);
      setWorkload(workRes?.officers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportApplications = async (format) => {
    setExportLoading(true);
    try {
      if (format === 'csv') {
        const csvData = await reportApi.exportApplications('csv');
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aicte_applications_export_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
      } else {
        const jsonData = await reportApi.exportApplications('json');
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aicte_applications_export_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportCompliance = async (format) => {
    setExportLoading(true);
    try {
      if (format === 'csv') {
        const csvData = await reportApi.exportCompliance('csv');
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aicte_compliance_export_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
      } else {
        const jsonData = await reportApi.exportCompliance('json');
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aicte_compliance_export_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const metrics = summary?.metrics;

  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="bg-white rounded-lg border-l-4 border-[#F2A900] border border-[#DCE3EA] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1B5E80]">STATUTORY REPORTING</span>
              <span className="bg-blue-50 text-[#12345A] text-[10px] px-2 py-0.5 rounded font-mono font-bold">Data Analytics & Exports</span>
            </div>
            <h1 className="text-xl font-bold text-[#12345A] mt-1">Management Information System & Workload Velocity</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive approval statistics, regional processing volumes, officer assignment distribution, and gazetted exports.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportApplications('csv')}
              disabled={exportLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#12345A] hover:bg-[#1B5E80] text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              Export Applications (CSV)
            </button>
            <button
              onClick={() => handleExportCompliance('csv')}
              disabled={exportLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Compliance (CSV)
            </button>
            <button
              onClick={loadReportsData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Aggregate Metric Tiles */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Total Applications</span>
            <div className="text-2xl font-bold text-[#12345A] mt-1">{metrics.applications.total}</div>
            <div className="text-[10px] text-slate-500 mt-1">
              Approved: <span className="text-emerald-700 font-bold">{metrics.applications.approved}</span> • In Progress: <span className="text-blue-700 font-bold">{metrics.applications.inProgress}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Documents Verified</span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{metrics.documents.verified} / {metrics.documents.total}</div>
            <div className="text-[10px] text-slate-500 mt-1">Verified against APH norms</div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs">
            <span className="text-[10px] text-slate-500 uppercase font-bold">EVC Inspections</span>
            <div className="text-2xl font-bold text-[#1B5E80] mt-1">{metrics.inspections.completed} / {metrics.inspections.total}</div>
            <div className="text-[10px] text-slate-500 mt-1">On-site visits concluded</div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs">
            <span className="text-[10px] text-slate-500 uppercase font-bold">SLA Escalations</span>
            <div className="text-2xl font-bold text-red-600 mt-1">{metrics.escalations.active}</div>
            <div className="text-[10px] text-slate-500 mt-1">Vigilance breaches open</div>
          </div>
        </div>
      )}

      {/* Tables: Regional Breakdown & Officer Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional Distribution */}
        <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
          <h2 className="text-xs font-bold text-[#12345A] uppercase tracking-wide pb-2 border-b border-slate-100 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#1B5E80]" />
            Regional Volume Distribution
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">AICTE Regional Office</th>
                  <th className="py-2.5 px-3 text-right">Institutions</th>
                  <th className="py-2.5 px-3 text-right">Active Applications</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary?.regionalDistribution?.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{r.region}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{r.inst_count}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#12345A]">{r.app_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Officer Workload Velocity */}
        <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
          <h2 className="text-xs font-bold text-[#12345A] uppercase tracking-wide pb-2 border-b border-slate-100 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#1B5E80]" />
            Council Officer Workload & Processing Velocity
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Officer Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3 text-right">Scrutiny / EVC / Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workload.map(officer => (
                  <tr key={officer.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {officer.name}
                      <div className="text-[10px] text-slate-400 font-mono">{officer.email}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-700">
                        {officer.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#12345A]">
                      {officer.scrutiny_assigned} / {officer.inspections_led} / {officer.decisions_rendered}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
