import React, { useState, useEffect } from 'react';
import { 
  Shield, FileText, CheckCircle2, Clock, AlertCircle, 
  Users, Building2, Key, Award, Lock, ExternalLink, ArrowRight,
  Eye, Check, X, ShieldAlert, FileCheck, GitMerge, ClipboardCheck,
  Scale, AlertTriangle, Sparkles
} from 'lucide-react';
import { ROLE_LABELS } from './Header';
import { documentApi, applicationApi, auditApi, reportApi } from '../api';

export default function DashboardOverview({ user, onNavigate, onOpenAiAssistant }) {
  const [metrics, setMetrics] = useState({
    totalDocs: 0,
    pendingDocs: 0,
    verifiedDocs: 0,
    totalApps: 0,
    openDeficiencies: 0,
    inspectionsCount: 0,
    escalationsCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentDocs, setRecentDocs] = useState([]);
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [docsRes, appsRes, summaryRes] = await Promise.all([
        documentApi.list(),
        applicationApi.list(),
        reportApi.getSummary().catch(() => null)
      ]);

      const docs = docsRes.documents || [];
      const apps = appsRes.applications || [];

      setRecentDocs(docs.slice(0, 5));
      setApplications(apps.slice(0, 5));

      const summaryMetrics = summaryRes?.metrics;

      setMetrics({
        totalDocs: docs.length,
        pendingDocs: docs.filter(d => d.verification_status === 'PENDING').length,
        verifiedDocs: docs.filter(d => d.verification_status === 'VERIFIED').length,
        totalApps: apps.length,
        openDeficiencies: summaryMetrics?.scrutiny?.openDeficiencies || 0,
        inspectionsCount: summaryMetrics?.inspections?.total || 0,
        escalationsCount: summaryMetrics?.escalations?.active || 0
      });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDashboardHeading = () => {
    switch (user.role) {
      case 'SUPER_ADMIN':
      case 'AICTE_ADMIN':
        return {
          title: 'Apex Governance & Administrative Directorate Console',
          subtitle: 'Central AICTE Statutory Oversight, RBAC Enforcement, SHA-256 Audit Ledger, and Security Telemetry'
        };
      case 'SCRUTINY_OFFICER':
        return {
          title: 'Senior Scrutiny Officer Technical Evaluation Portal',
          subtitle: 'Statutory Document Scrutiny, Deficiency Notice Issuance & Resolution against APH Guidelines'
        };
      case 'EVC_COORDINATOR':
      case 'EVC_MEMBER':
        return {
          title: 'Expert Visiting Committee (EVC) On-Site Inspection Portal',
          subtitle: 'Committee Restrictive Collections, Geospatial Photographic Evidence & Peer Campus Verification'
        };
      case 'SAC_SHC_MEMBER':
        return {
          title: 'Standing Appellate Committee (SAC / SHC) Judicial Docket',
          subtitle: 'Appellate Review of Deficiencies, Oral Submissions & Formal Legal Recommendations'
        };
      case 'REGIONAL_OFFICER':
        return {
          title: `Regional Office Directorate Dashboard (${user.region || 'Northern'} Region)`,
          subtitle: 'Regional Application Routing, Committee Scheduling & Scrutiny Supervision'
        };
      case 'COMPETENT_AUTHORITY':
        return {
          title: 'Competent Authority Final Decision Portal',
          subtitle: 'Prerequisite-Verified Issuance of Formal Letters of Approval (LoA) & Executive Orders'
        };
      case 'AUDITOR':
        return {
          title: 'Statutory Compliance & Audit Oversight Console (CAG / AICTE)',
          subtitle: 'Read-Only Cryptographic Evidence Verification, Process Timelines & Hash Chain Integrity Check'
        };
      case 'INSTITUTION_ADMIN':
      case 'INSTITUTION_STAFF':
      default:
        return {
          title: 'Institution Authorized Approvals & Governance Dashboard',
          subtitle: 'Statutory Approval Filings, Document Repository, Deficiency Rectification & Mandatory Affidavits'
        };
    }
  };

  const heading = getDashboardHeading();

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#12345A] via-[#1B5E80] to-[#0A192F] rounded-xl p-6 text-white shadow-xs relative overflow-hidden border border-[#DCE3EA]">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-[#F2A900]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="inline-flex items-center space-x-2 bg-[#F2A900] text-slate-950 px-3 py-1 rounded-full text-xs font-bold mb-3 shadow-2xs">
            <Shield className="w-3.5 h-3.5" />
            <span>Official Authorised Session: {ROLE_LABELS[user.role] || user.role}</span>
          </div>

          <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
            {heading.title}
          </h2>
          <p className="text-xs text-slate-200 mt-1 max-w-2xl">
            {heading.subtitle}
          </p>

          <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap items-center gap-4 text-xs text-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white">Authenticated Officer:</span> {user.full_name}
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white">Tenant Scope:</span>{' '}
              {user.institution_id ? (
                <span className="text-[#F2A900] font-mono font-bold">PID: {user.institution_id}</span>
              ) : (
                <span className="text-emerald-300 font-semibold">{user.region || 'All-India HQ'}</span>
              )}
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white">Security State:</span>
              <span className="text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> RBAC Enforced
              </span>
            </div>
            {onOpenAiAssistant && (
              <button
                onClick={onOpenAiAssistant}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F2A900] text-slate-950 font-bold hover:brightness-110 text-xs shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Assistant
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Visible Documents</span>
            <FileText className="w-4 h-4 text-[#1B5E80]" />
          </div>
          <div className="text-2xl font-bold text-[#12345A] mt-1">{metrics.totalDocs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Strictly filtered by RBAC & tenancy</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending Verification</span>
            <Clock className="w-4 h-4 text-[#B7791F]" />
          </div>
          <div className="text-2xl font-bold text-[#B7791F] mt-1">{metrics.pendingDocs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Requires statutory review</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Verified Documents</span>
            <CheckCircle2 className="w-4 h-4 text-[#13805B]" />
          </div>
          <div className="text-2xl font-bold text-[#13805B] mt-1">{metrics.verifiedDocs}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Locked against modification</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Applications</span>
            <Building2 className="w-4 h-4 text-[#12345A]" />
          </div>
          <div className="text-2xl font-bold text-[#12345A] mt-1">{metrics.totalApps}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Under statutory workflow</div>
        </div>

      </div>

      {/* Quick Action Shortcuts by Role */}
      <div className="bg-white p-4 rounded-lg border border-[#DCE3EA] shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-[#12345A] uppercase tracking-wide">
          Authorized Quick Navigation for {ROLE_LABELS[user.role] || user.role}
        </h3>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => onNavigate('applications')}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
          >
            📋 Applications Register
          </button>
          <button
            onClick={() => onNavigate('workflow')}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
          >
            ⚙️ Workflow Progression Engine
          </button>
          <button
            onClick={() => onNavigate('scrutiny')}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
          >
            🔍 Scrutiny & Deficiencies
          </button>
          <button
            onClick={() => onNavigate('evc')}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
          >
            📍 EVC Inspections
          </button>
          <button
            onClick={() => onNavigate('sac')}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
          >
            ⚖️ SAC Appellate Hearings
          </button>
          <button
            onClick={() => onNavigate('decisions')}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
          >
            🎖️ Competent Authority Orders
          </button>
          <button
            onClick={() => onNavigate('undertakings')}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
          >
            📜 Statutory Affidavits
          </button>
          <button
            onClick={() => onNavigate('compliance')}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
          >
            📊 Compliance Scorecards
          </button>
          <button
            onClick={() => onNavigate('escalations')}
            className="px-3 py-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700 font-semibold cursor-pointer"
          >
            ⚠️ SLA Escalations
          </button>
          <button
            onClick={() => onNavigate('security-tests')}
            className="px-3 py-1.5 rounded bg-blue-50 hover:bg-blue-100 text-[#12345A] font-bold cursor-pointer"
          >
            🛡️ Security Tests (9/9)
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Application Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[#12345A] uppercase tracking-wide">
                  Application Approvals Queue
                </h3>
                <p className="text-[11px] text-slate-500">Accessible applications under your authorization scope</p>
              </div>
              <button
                onClick={() => onNavigate('applications')}
                className="text-xs font-semibold text-[#12345A] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {applications.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No applications currently visible under your tenant filter.
                </div>
              ) : (
                applications.map(app => (
                  <div key={app.id} className="p-4 hover:bg-slate-50/70 transition flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-[#12345A]">{app.application_number}</span>
                        <span className="bg-blue-50 text-[#12345A] text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                          {app.academic_year}
                        </span>
                        <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium">
                          {app.application_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-900 font-semibold mt-1">
                        {app.institution_name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Region: {app.region}</span>
                        <span>•</span>
                        <span>Current Stage: <strong className="text-slate-700">{app.current_stage}</strong></span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold ${
                        app.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        app.status === 'ON_HOLD' ? 'bg-amber-100 text-amber-800' :
                        app.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {app.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Recent Verified Documents */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-[#DCE3EA] shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-[#12345A] uppercase tracking-wide">
                Document Repository Status
              </h3>
              <button
                onClick={() => onNavigate('documents')}
                className="text-xs font-semibold text-[#12345A] hover:underline"
              >
                Browse All
              </button>
            </div>

            <div className="space-y-3">
              {recentDocs.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4">No documents found.</div>
              ) : (
                recentDocs.map(doc => (
                  <div key={doc.id} className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span className="truncate">{doc.title}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                        doc.verification_status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {doc.verification_status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Category: {doc.document_category} • Ver: v{doc.version}.0
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
