import React, { useState } from 'react';
import { 
  Shield, User, Building, MapPin, LogOut, CheckCircle2, 
  ChevronDown, Key, RefreshCw, FileText, Lock, Award, Users, Activity
} from 'lucide-react';

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Administrator',
  AICTE_ADMIN: 'AICTE Administrator',
  REGULATION_BUREAU: 'Regulation Bureau Officer',
  REGIONAL_OFFICER: 'Regional Officer (North)',
  BUREAU_OFFICER: 'Bureau Officer',
  SCRUTINY_OFFICER: 'Scrutiny Officer',
  EVC_COORDINATOR: 'EVC Coordinator',
  EVC_MEMBER: 'EVC Committee Member',
  SAC_SHC_MEMBER: 'SAC / SHC Member',
  COMPETENT_AUTHORITY: 'Competent Authority',
  INSTITUTION_ADMIN: 'Institution Admin',
  INSTITUTION_STAFF: 'Institution Staff',
  AUDITOR: 'Auditor (CAG Read-Only)'
};

const DEMO_PRESETS = [
  { username: 'superadmin', role: 'SUPER_ADMIN', label: 'Super Admin (Dr. Sitharam)', tag: 'Full Control' },
  { username: 'aicteadmin', role: 'AICTE_ADMIN', label: 'AICTE Admin (Shri Manoj Kumar)', tag: 'Portal Admin' },
  { username: 'regbureau', role: 'REGULATION_BUREAU', label: 'Regulation Bureau (Prof. Rajive)', tag: 'Bureau Head' },
  { username: 'regionalofficer', role: 'REGIONAL_OFFICER', label: 'Regional Officer (Dr. Sunil Luthra)', tag: 'Northern Region' },
  { username: 'bureauofficer', role: 'BUREAU_OFFICER', label: 'Bureau Officer (Smt. Vandana)', tag: 'Approval Bureau' },
  { username: 'scrutinyofficer', role: 'SCRUTINY_OFFICER', label: 'Scrutiny Officer (Dr. Sharma)', tag: 'Assigned Evaluator' },
  { username: 'evccoordinator', role: 'EVC_COORDINATOR', label: 'EVC Coordinator (Prof. Mathur)', tag: 'Inspection Head' },
  { username: 'evcmember', role: 'EVC_MEMBER', label: 'EVC Member (Dr. Sen)', tag: 'Assigned Committee' },
  { username: 'evcmember2', role: 'EVC_MEMBER', label: 'EVC Member 2 (Dr. Joshi)', tag: 'Unassigned Committee' },
  { username: 'sacmember', role: 'SAC_SHC_MEMBER', label: 'SAC/SHC Member (Prof. Murthy)', tag: 'Appellate Jurist' },
  { username: 'competentauthority', role: 'COMPETENT_AUTHORITY', label: 'Competent Authority (Appellate)', tag: 'Final Approval' },
  { username: 'instadmin', role: 'INSTITUTION_ADMIN', label: 'Institution A Admin (Dr. Verma)', tag: 'Delhi Inst. of Tech' },
  { username: 'inststaff', role: 'INSTITUTION_STAFF', label: 'Institution A Staff (Sri Narayan)', tag: 'Delhi Staff' },
  { username: 'instadmin_b', role: 'INSTITUTION_ADMIN', label: 'Institution B Admin (Dr. Patil)', tag: 'Mumbai College' },
  { username: 'auditor', role: 'AUDITOR', label: 'Statutory Auditor (CAG Shri Jain)', tag: 'Strictly Read-Only' },
];

export default function Header({ user, currentTab, setCurrentTab, onQuickSwitch, onLogout }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSelectPreset = async (preset) => {
    setIsSwitching(true);
    setDropdownOpen(false);
    try {
      await onQuickSwitch(preset.role, preset.username);
    } finally {
      setIsSwitching(false);
    }
  };

  const isAdmin = user && (user.role === 'SUPER_ADMIN' || user.role === 'AICTE_ADMIN');

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Tricolor Government of India Top Banner */}
      <div className="h-1 bg-gradient-to-r from-amber-500 via-white to-emerald-600" />
      
      {/* Council Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          
          {/* Logo & Platform Title */}
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-lg bg-linear-to-br from-blue-900 to-indigo-950 flex items-center justify-center text-white shadow-md border border-amber-500/40">
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold tracking-widest uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Government of India • Ministry of Education
                </span>
                <span className="text-xs text-slate-500 hidden md:inline">e-Governance Cell</span>
              </div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                AICTE Centralized Access Management Portal
              </h1>
            </div>
          </div>

          {/* User Profile & Demo Switcher */}
          <div className="flex items-center space-x-3">
            
            {/* Quick Role Switcher Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
                title="Switch role for testing & demonstration"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSwitching ? 'animate-spin' : ''}`} />
                <span className="font-semibold hidden sm:inline">Role Switcher:</span>
                <span className="bg-indigo-600 text-white px-2 py-0.5 rounded font-bold">
                  {user ? (ROLE_LABELS[user.role] || user.role) : 'Guest'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 max-h-96 overflow-y-auto">
                  <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Demo Role Impersonator (All 13 Roles)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Switch instantly to test RBAC and tenant isolation
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {DEMO_PRESETS.map((p) => {
                      const isCurrent = user && user.username === p.username;
                      return (
                        <button
                          key={p.username}
                          onClick={() => handleSelectPreset(p)}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-indigo-50 transition ${
                            isCurrent ? 'bg-indigo-50/80 font-semibold text-indigo-950' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-medium text-slate-900">{p.label}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                              <span className="font-mono text-indigo-700">@{p.username}</span>
                              <span>•</span>
                              <span>{p.tag}</span>
                            </div>
                          </div>
                          {isCurrent && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* User Info Capsule */}
            {user && (
              <div className="hidden lg:flex items-center space-x-2 pl-2 border-l border-slate-200">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                    {user.full_name}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
                    {user.institution_id ? (
                      <span className="text-amber-700 font-medium">Institution Tenant</span>
                    ) : (
                      <span className="text-blue-700 font-medium">{user.region || 'HQ'}</span>
                    )}
                    {user.mfa_enabled ? (
                      <span className="bg-emerald-100 text-emerald-800 px-1 rounded text-[9px]">MFA</span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* Logout */}
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center space-x-1 overflow-x-auto py-1 scrollbar-none">
          
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`px-3 py-2 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition whitespace-nowrap ${
              currentTab === 'dashboard'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentTab('documents')}
            className={`px-3 py-2 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition whitespace-nowrap ${
              currentTab === 'documents'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Document Repository</span>
          </button>

          <button
            onClick={() => setCurrentTab('applications')}
            className={`px-3 py-2 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition whitespace-nowrap ${
              currentTab === 'applications'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Applications & Processing</span>
          </button>

          <button
            onClick={() => setCurrentTab('comments')}
            className={`px-3 py-2 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition whitespace-nowrap ${
              currentTab === 'comments'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            <span>Multi-Channel Remarks</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setCurrentTab('rbac')}
              className={`px-3 py-2 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition whitespace-nowrap ${
                currentTab === 'rbac'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span>RBAC & Policy Studio</span>
            </button>
          )}

          <button
            onClick={() => setCurrentTab('audit')}
            className={`px-3 py-2 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition whitespace-nowrap ${
              currentTab === 'audit'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>Immutable Audit Trail</span>
          </button>

          <button
            onClick={() => setCurrentTab('security-tests')}
            className={`px-3 py-2 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition whitespace-nowrap ${
              currentTab === 'security-tests'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Mandatory Security Tests (9/9)</span>
          </button>

        </div>
      </div>
    </header>
  );
}
