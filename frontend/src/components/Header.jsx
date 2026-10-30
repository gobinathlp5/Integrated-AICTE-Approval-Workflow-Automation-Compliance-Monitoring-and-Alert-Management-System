import React, { useState, useEffect } from 'react';
import { 
  Shield, Volume2, User, Building, MapPin, LogOut, CheckCircle2, 
  ChevronDown, Key, RefreshCw, FileText, Lock, Award, Users, Activity,
  Globe, Bell, ExternalLink
} from 'lucide-react';
import { AicteEmblem, NationalEmblem, G20Logo } from './AicteLogo';

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
  const [dateTimeStr, setDateTimeStr] = useState('');
  const [fontSize, setFontSize] = useState(100);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const options = { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
      setDateTimeStr(now.toLocaleString('en-US', options).replace(/,/g, ' ,'));
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 30000);
    return () => clearInterval(interval);
  }, []);

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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs font-sans">
      
      {/* 1. Official Government Top Utility Bar (Black / Dark Gray, as seen in Image 3 & 4) */}
      <div className="bg-[#1e232a] text-slate-300 text-[11px] py-1 px-4 border-b border-slate-700/60">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          
          {/* Left: Date, Time & Screen Reader Access */}
          <div className="flex items-center space-x-4">
            <span className="font-mono text-slate-300">
              {dateTimeStr || 'Friday , 10-30-2026 ,2:37 PM'}
            </span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <button className="hidden sm:flex items-center space-x-1 text-slate-300 hover:text-white transition">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Screen Reader Access</span>
            </button>
          </div>

          {/* Right: Text Size, Hindi Toggle, Social, and Login Status */}
          <div className="flex items-center space-x-3">
            
            {/* Text Size Controls */}
            <div className="hidden md:flex items-center space-x-1.5 text-slate-300">
              <span className="text-[10px]">Text Size</span>
              <button onClick={() => setFontSize(90)} className="px-1 hover:text-white font-bold cursor-pointer">A-</button>
              <button onClick={() => setFontSize(100)} className="px-1 hover:text-white font-bold cursor-pointer">A</button>
              <button onClick={() => setFontSize(110)} className="px-1 hover:text-white font-bold cursor-pointer">A+</button>
            </div>

            <span className="text-slate-600 hidden md:inline">|</span>

            {/* Language Toggle Badge */}
            <div className="bg-[#f59e0b] text-slate-950 px-2 py-0.5 rounded text-[10px] font-bold flex items-center space-x-1 shadow-2xs">
              <span>अ/A हिन्दी</span>
            </div>

            <span className="text-slate-600">|</span>

            {/* Quick Demo Role Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="bg-[#f59e0b] hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-0.5 rounded text-[11px] flex items-center space-x-1 transition shadow-xs cursor-pointer"
                title="Switch AICTE System Role"
              >
                <RefreshCw className={`w-3 h-3 text-slate-900 ${isSwitching ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Role:</span>
                <span className="underline decoration-slate-900 font-black">
                  {user ? (ROLE_LABELS[user.role] || user.role) : 'Login'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-950" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1 w-80 bg-white rounded-xl shadow-2xl border border-slate-300 py-2 z-50 max-h-96 overflow-y-auto">
                  <div className="px-3 py-1.5 border-b border-slate-100 bg-amber-50">
                    <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                      Demo Role Switcher (All 13 AICTE Personas)
                    </p>
                    <p className="text-[10px] text-amber-700">
                      Instantly test RBAC permissions and data isolation
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {DEMO_PRESETS.map((p) => {
                      const isCurrent = user && user.username === p.username;
                      return (
                        <button
                          key={p.username}
                          onClick={() => handleSelectPreset(p)}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-amber-50 transition ${
                            isCurrent ? 'bg-amber-100/60 font-semibold text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{p.label}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              @{p.username} • {p.tag}
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

            {/* Logout Button */}
            {user && (
              <button
                onClick={onLogout}
                className="text-slate-300 hover:text-red-400 p-0.5 rounded transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}

          </div>

        </div>
      </div>

      {/* 2. Official AICTE Main Header Banner (White Background, matching Image 1, 3 & 4) */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* Left: AICTE Circular Logo + Bilingual Devanagari & English Names */}
          <div className="flex items-center space-x-3.5">
            <AicteEmblem className="w-14 h-14 md:w-16 md:h-16 shrink-0" />
            <div>
              <h2 className="text-sm md:text-base font-bold text-slate-800 tracking-tight leading-tight">
                अखिल भारतीय तकनीकी शिक्षा परिषद
              </h2>
              <h1 className="text-base md:text-xl font-bold text-slate-900 tracking-tight leading-tight font-serif">
                All India Council for Technical Education
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                (A Statutory Body of the Government of India)
              </p>
            </div>
          </div>

          {/* Right: National Emblem + Ministry of Education + G20 Bharat 2023 Motif */}
          <div className="hidden lg:flex items-center space-x-6 border-l border-slate-200 pl-6">
            <div className="flex items-center space-x-2">
              <NationalEmblem className="w-6 h-8" />
              <div>
                <div className="text-xs font-bold text-slate-800 leading-tight">शिक्षा मंत्रालय</div>
                <div className="text-xs font-bold text-slate-900 leading-tight">Ministry of Education</div>
                <div className="text-[10px] text-slate-500">Government of India</div>
              </div>
            </div>

            <G20Logo className="w-16 h-8" />
          </div>

        </div>
      </div>

      {/* 3. Primary Navigation Bar (Navy Blue #132a4e with Bright Gold #f5a623 Active Highlights, matching Image 3 & 4) */}
      <nav className="bg-[#122749] text-white shadow-md border-t border-blue-900">
        <div className="max-w-7xl mx-auto px-4 flex items-center overflow-x-auto scrollbar-none">
          
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`py-2.5 px-4 text-xs font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
              currentTab === 'dashboard'
                ? 'bg-[#f59e0b] text-slate-950 border-[#f59e0b]'
                : 'text-white hover:bg-[#1a365d] border-transparent'
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={() => setCurrentTab('documents')}
            className={`py-2.5 px-4 text-xs font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
              currentTab === 'documents'
                ? 'bg-[#f59e0b] text-slate-950 border-[#f59e0b]'
                : 'text-white hover:bg-[#1a365d] border-transparent'
            }`}
          >
            Document Repository
          </button>

          <button
            onClick={() => setCurrentTab('applications')}
            className={`py-2.5 px-4 text-xs font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
              currentTab === 'applications'
                ? 'bg-[#f59e0b] text-slate-950 border-[#f59e0b]'
                : 'text-white hover:bg-[#1a365d] border-transparent'
            }`}
          >
            Applications & Processing
          </button>

          <button
            onClick={() => setCurrentTab('comments')}
            className={`py-2.5 px-4 text-xs font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
              currentTab === 'comments'
                ? 'bg-[#f59e0b] text-slate-950 border-[#f59e0b]'
                : 'text-white hover:bg-[#1a365d] border-transparent'
            }`}
          >
            Bureaus / Remarks
          </button>

          {isAdmin && (
            <button
              onClick={() => setCurrentTab('rbac')}
              className={`py-2.5 px-4 text-xs font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
                currentTab === 'rbac'
                  ? 'bg-[#f59e0b] text-slate-950 border-[#f59e0b]'
                  : 'text-white hover:bg-[#1a365d] border-transparent'
              }`}
            >
              RBAC & Policy Studio
            </button>
          )}

          <button
            onClick={() => setCurrentTab('audit')}
            className={`py-2.5 px-4 text-xs font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
              currentTab === 'audit'
                ? 'bg-[#f59e0b] text-slate-950 border-[#f59e0b]'
                : 'text-white hover:bg-[#1a365d] border-transparent'
            }`}
          >
            Audit Trail (SHA-256)
          </button>

          <button
            onClick={() => setCurrentTab('security-tests')}
            className={`py-2.5 px-4 text-xs font-bold transition whitespace-nowrap cursor-pointer border-b-2 ${
              currentTab === 'security-tests'
                ? 'bg-[#f59e0b] text-slate-950 border-[#f59e0b]'
                : 'text-white hover:bg-[#1a365d] border-transparent'
            }`}
          >
            Mandatory Security Tests (9/9)
          </button>

        </div>
      </nav>

      {/* 4. Official "LATEST NEWS" Ticker Bar (Image 3 & 4) */}
      <div className="bg-[#fff9db] border-b border-amber-200 px-4 py-1.5 flex items-center space-x-3 text-xs overflow-hidden">
        <div className="bg-[#f59e0b] text-slate-950 font-black text-[11px] px-2.5 py-0.5 rounded uppercase tracking-wider shrink-0 shadow-2xs">
          LATEST NEWS
        </div>
        <div className="truncate text-slate-800 font-medium text-[11px]">
          <span className="text-red-600 font-bold mr-1">*</span>
          Extension of last date for submission of online applications under AICTE Approval Process 2026-27
          <span className="ml-3 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">NEW</span>
          <span className="mx-3 text-slate-400">|</span>
          <span className="text-red-600 font-bold mr-1">*</span>
          Mandatory Backend Document Visibility & RBAC Access Matrix Enforced for all Affiliated Technical Institutions
        </div>
      </div>

    </header>
  );
}
