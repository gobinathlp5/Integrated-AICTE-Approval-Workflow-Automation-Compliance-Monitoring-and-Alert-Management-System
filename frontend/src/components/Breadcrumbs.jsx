import React from 'react';
import { ChevronRight, Home, Shield, Building, FileCheck } from 'lucide-react';

const TAB_TITLES = {
  dashboard: 'Executive Dashboard',
  institution: 'Institutional Profile & Accreditation',
  applications: 'Statutory Approval Applications',
  workflow: 'Approval Workflow Engine',
  scrutiny: 'Technical Scrutiny & Deficiency Tracker',
  evc: 'Expert Visit Committee (EVC) Inspections',
  sac: 'Standing Appellate Committee (SAC / SHC)',
  decisions: 'Competent Authority Final Orders',
  undertakings: 'Statutory Undertakings & Affidavits',
  compliance: 'Annual Compliance & Governance Monitoring',
  documents: 'Centralized Document Repository',
  comments: 'Communication Channels & Scrutiny Remarks',
  escalations: 'SLA Escalations & Vigilance Monitor',
  reports: 'Statistical Reports & Workload Analytics',
  rbac: 'RBAC Policy & Permission Matrix',
  audit: 'Immutable SHA-256 Audit Trail',
  'security-tests': 'Mandatory Security & Acceptance Tests'
};

export default function Breadcrumbs({ currentTab, onNavigate, user }) {
  const title = TAB_TITLES[currentTab] || currentTab;

  return (
    <nav className="flex items-center text-xs text-slate-500 mb-4 px-1" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-2">
        <li className="inline-flex items-center">
          <button
            onClick={() => onNavigate('dashboard')}
            className="inline-flex items-center text-slate-600 hover:text-[#12345A] font-medium transition cursor-pointer"
          >
            <Home className="w-3.5 h-3.5 mr-1 text-[#1B5E80]" />
            AICTE Portal
          </button>
        </li>
        <li>
          <div className="flex items-center">
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 mx-1" />
            <span className="text-slate-400 font-medium">Digital Governance</span>
          </div>
        </li>
        <li aria-current="page">
          <div className="flex items-center">
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 mx-1" />
            <span className="text-[#12345A] font-semibold">{title}</span>
          </div>
        </li>
      </ol>
      {user && (
        <div className="ml-auto hidden sm:flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Shield className="w-3 h-3 mr-1 text-[#1B5E80]" />
            {user.role}
          </span>
          {user.institutionId && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <Building className="w-3 h-3 mr-1 text-amber-600" />
              PID: {user.institutionId}
            </span>
          )}
        </div>
      )}
    </nav>
  );
}
