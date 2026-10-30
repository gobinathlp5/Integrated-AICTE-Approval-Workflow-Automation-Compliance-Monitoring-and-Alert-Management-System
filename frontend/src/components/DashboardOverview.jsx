import React, { useState, useEffect } from 'react';
import { 
  Shield, FileText, CheckCircle2, Clock, AlertCircle, 
  Users, Building2, Key, Award, Lock, ExternalLink, ArrowRight,
  Eye, Check, X, ShieldAlert, FileCheck
} from 'lucide-react';
import { ROLE_LABELS } from './Header';
import { documentApi, applicationApi, auditApi } from '../api';

export default function DashboardOverview({ user, onNavigate }) {
  const [metrics, setMetrics] = useState({
    totalDocs: 0,
    pendingDocs: 0,
    verifiedDocs: 0,
    totalApps: 0,
    auditRecords: 0
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
      const [docsRes, appsRes, auditRes] = await Promise.all([
        documentApi.list(),
        applicationApi.list(),
        auditApi.getAll({ limit: 5 })
      ]);

      const docs = docsRes.documents || [];
      const apps = appsRes.applications || [];

      setRecentDocs(docs.slice(0, 5));
      setApplications(apps);

      setMetrics({
        totalDocs: docs.length,
        pendingDocs: docs.filter(d => d.verification_status === 'PENDING').length,
        verifiedDocs: docs.filter(d => d.verification_status === 'VERIFIED').length,
        totalApps: apps.length,
        auditRecords: auditRes.total || 0
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
          title: 'Executive Platform Administration & Governance Dashboard',
          subtitle: 'Central AICTE Oversight, RBAC Enforcement, Audit Ledger, and Security Telemetry'
        };
      case 'SCRUTINY_OFFICER':
        return {
          title: 'Senior Scrutiny Officer Evaluation Portal',
          subtitle: 'Assigned Application Document Verification, Deficiency Analysis & Remarks'
        };
      case 'EVC_COORDINATOR':
      case 'EVC_MEMBER':
        return {
          title: 'Expert Visiting Committee (EVC) Inspection Portal',
          subtitle: 'Committee Restrictive Collections, Geospatial Reports & Peer Evaluation'
        };
      case 'REGIONAL_OFFICER':
        return {
          title: `Regional Office Directorate Dashboard (${user.region || 'Northern'} Region)`,
          subtitle: 'Regional Application Routing, Committee Appointment & Scrutiny Management'
        };
      case 'COMPETENT_AUTHORITY':
        return {
          title: 'Appellate & Competent Authority Decision Portal',
          subtitle: 'Final Approval / Rejection of Statutory Approvals and Policy Determinations'
        };
      case 'AUDITOR':
        return {
          title: 'Statutory Compliance & Audit Oversight Console (CAG / AICTE)',
          subtitle: 'Read-Only Cryptographic Evidence Verification, Process Logs & Integrity Check'
        };
      case 'INSTITUTION_ADMIN':
      case 'INSTITUTION_STAFF':
      default:
        return {
          title: 'Institution Authorized Approvals & Compliance Dashboard',
          subtitle: 'Document Repository, Extension of Approval (EoA) Tracking & Official Remarks'
        };
    }
  };

  const heading = getDashboardHeading();

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-linear-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-blue-800">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="inline-flex items-center space-x-2 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-xs font-semibold mb-3 border border-amber-500/30">
            <Shield className="w-3.5 h-3.5" />
            <span>Authorised Session: {ROLE_LABELS[user.role] || user.role}</span>
          </div>

          <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
            {heading.title}
          </h2>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            {heading.subtitle}
          </p>

          <div className="mt-4 pt-4 border-t border-slate-700/60 flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white">Authenticated Officer:</span> {user.full_name}
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white">Tenant Scope:</span>{' '}
              {user.institution_id ? (
                <span className="text-amber-400 font-mono font-bold">Institution ID: {user.institution_id}</span>
              ) : (
                <span className="text-emerald-400 font-semibold">{user.region || 'All-India HQ'}</span>
              )}
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white">Security State:</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> RBAC Enforced
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Visible Documents</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{metrics.totalDocs}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Strictly filtered by RBAC & tenancy</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Verification</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">{metrics.pendingDocs}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Requires statutory review</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Verified Documents</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">{metrics.verifiedDocs}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Locked against modification</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Applications</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{metrics.totalApps}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Under processing workflow</div>
        </div>

      </div>

      {/* Main Role-Specific Action Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Application & Document Status */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Applications Queue */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Application Approvals Queue</h3>
                <p className="text-xs text-slate-500">Accessible applications under your authorization scope</p>
              </div>
              <button
                onClick={() => onNavigate('applications')}
                className="text-xs font-semibold text-blue-900 hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {applications.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No applications currently assigned or visible under your role isolation filter.
                </div>
              ) : (
                applications.map(app => (
                  <div key={app.id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-blue-900">{app.application_number}</span>
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                          {app.academic_year}
                        </span>
                        <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium">
                          {app.application_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-900 font-medium mt-1">
                        {app.institution_name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Region: {app.region}</span>
                        <span>•</span>
                        <span>Scrutiny Officer: {app.scrutiny_officer_name || 'Unassigned'}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                        app.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        app.status === 'UNDER_SCRUTINY' ? 'bg-amber-100 text-amber-800' :
                        app.status === 'UNDER_EVC' ? 'bg-purple-100 text-purple-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {app.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Documents Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Statutory & Inspection Documents</h3>
                <p className="text-xs text-slate-500">Document repository entries adhering to confidentiality filters</p>
              </div>
              <button
                onClick={() => onNavigate('documents')}
                className="text-xs font-semibold text-blue-900 hover:underline flex items-center gap-1"
              >
                <span>Open Repository</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {recentDocs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No documents found matching role permissions.
                </div>
              ) : (
                recentDocs.map(doc => (
                  <div key={doc.id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-blue-50 text-blue-700 rounded-lg shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{doc.title}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{doc.file_name}</span>
                          <span>•</span>
                          <span className="font-bold text-slate-700">v{doc.document_version}</span>
                          <span>•</span>
                          <span>{doc.uploader_name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        doc.confidentiality_classification === 'INSTITUTION_VISIBLE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        doc.confidentiality_classification === 'INTERNAL_AICTE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        doc.confidentiality_classification === 'COMMITTEE_RESTRICTED' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {doc.confidentiality_classification.replace(/_/g, ' ')}
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        doc.verification_status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' :
                        doc.verification_status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {doc.verification_status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Security Features & Quick Actions */}
        <div className="space-y-6">
          
          {/* Acceptance Test Card */}
          <div className="bg-linear-to-br from-emerald-900 to-teal-950 text-white rounded-xl p-5 shadow-md border border-emerald-700">
            <div className="flex items-center space-x-2 text-emerald-300 mb-2">
              <Award className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Mandatory Security Verification</span>
            </div>
            <h4 className="text-sm font-bold text-white">Full Security & Acceptance Suite</h4>
            <p className="text-xs text-emerald-200/80 mt-1">
              Verifies all 8 security criteria: Institution isolation, Internal notes privacy, Unassigned EVC protection, File immutability, Auditor read-only locks, and SHA-256 audit chaining.
            </p>
            <button
              onClick={() => onNavigate('security-tests')}
              className="mt-4 w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center space-x-1.5 shadow-sm"
            >
              <span>Launch Automated Test Suite</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Role Navigation Hub
            </h4>

            <button
              onClick={() => onNavigate('documents')}
              className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition flex items-center justify-between text-xs"
            >
              <div className="flex items-center space-x-2.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-slate-800">Browse Virtual Document Folders</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigate('comments')}
              className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/50 transition flex items-center justify-between text-xs"
            >
              <div className="flex items-center space-x-2.5">
                <Lock className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-slate-800">Multi-Channel Remarks & Notes</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigate('audit')}
              className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition flex items-center justify-between text-xs"
            >
              <div className="flex items-center space-x-2.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-slate-800">Audit Trail (Cryptographic Chain)</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {(user.role === 'SUPER_ADMIN' || user.role === 'AICTE_ADMIN') && (
              <button
                onClick={() => onNavigate('rbac')}
                className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2.5">
                  <Key className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold text-slate-800">Configure Roles & User Overrides</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
