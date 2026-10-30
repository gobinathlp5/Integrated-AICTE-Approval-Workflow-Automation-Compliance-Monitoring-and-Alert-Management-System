import React, { useState } from 'react';
import { 
  Shield, Lock, User, Building, MapPin, Key, AlertTriangle, 
  CheckCircle, ArrowRight, ShieldAlert, Sparkles, GraduationCap,
  Building2, Home, Users as UsersIcon, Check, ExternalLink
} from 'lucide-react';
import { authApi, setAuthToken, setStoredUser } from '../api';
import { AicteEmblem, NationalEmblem, G20Logo, SocialSidebar } from './AicteLogo';

const USER_TYPES = [
  { id: 'STUDENT', label: 'Student', icon: GraduationCap, available: false, note: 'Internship & Portal Access' },
  { id: 'INSTITUTION', label: 'University / Institution (TPO / HOI)', icon: Building, available: true, note: 'AICTE Approval & Compliance' },
  { id: 'ULB', label: 'ULB / Smart City', icon: Building2, available: false, note: 'Urban Local Bodies' },
  { id: 'RURAL', label: 'Rural Body', icon: Home, available: false, note: 'Panchayat & Rural Agencies' },
  { id: 'EMPLOYER', label: 'Employer (MSME, DM, NGO, PSU)', icon: UsersIcon, available: false, note: 'Industry Partner' },
];

const PRE_SEEDED_INSTITUTIONS = [
  {
    name: 'DELHI INSTITUTE OF TECHNOLOGY & ADVANCED SCIENCE',
    pid: '1-1002345671',
    type: 'Private-Self Financing',
    hoi: 'Dr. Arvind Verma',
    region: 'Northern',
    city: 'New Delhi',
    state: 'Delhi'
  },
  {
    name: 'MALINENI LAKSHMAIAH MBA COLLEGE',
    pid: '1-7509401',
    type: 'Private-Self Financing',
    hoi: 'Ramesh Chandra sridhara',
    region: 'South-Central',
    city: 'Guntur',
    state: 'Andhra Pradesh'
  },
  {
    name: 'MUMBAI COLLEGE OF ENGINEERING & RESEARCH (INSTITUTION B)',
    pid: '1-2009876542',
    type: 'Private-Self Financing',
    hoi: 'Dr. Suresh Patil',
    region: 'Western',
    city: 'Mumbai',
    state: 'Maharashtra'
  }
];

export default function LoginModal({ onLoginSuccess }) {
  const [activeMode, setActiveMode] = useState('login'); // 'login' | 'register' | 'mfa'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login credentials
  const [loginUsername, setLoginUsername] = useState('instadmin');
  const [loginPassword, setLoginPassword] = useState('Password@123');

  // MFA Challenge State
  const [mfaSessionToken, setMfaSessionToken] = useState('');
  const [mfaCode, setMfaCode] = useState('123456');

  // Registration State (matching Image 1 & Image 2)
  const [selectedUserType, setSelectedUserType] = useState('INSTITUTION');
  const [affiliationType, setAffiliationType] = useState('AICTE_AFFILIATED'); // 'AICTE_AFFILIATED' | 'NON_AICTE'
  const [selectedInstIndex, setSelectedInstIndex] = useState(0);
  const [confirmedDetails, setConfirmedDetails] = useState(true);

  // New account form
  const [regForm, setRegForm] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'INSTITUTION_ADMIN'
  });

  const currentInst = PRE_SEEDED_INSTITUTIONS[selectedInstIndex];

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await authApi.login(loginUsername, loginPassword);

      if (res.requiresMfa) {
        setMfaSessionToken(res.mfaSessionToken);
        setActiveMode('mfa');
        setSuccessMsg(res.message);
        return;
      }

      setAuthToken(res.token);
      setStoredUser(res.user);
      onLoginSuccess(res.user, res.dashboardRoute);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.verifyMfa(mfaSessionToken, mfaCode);
      setAuthToken(res.token);
      setStoredUser(res.user);
      onLoginSuccess(res.user, res.dashboardRoute);
    } catch (err) {
      setError(err.message || 'MFA validation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e?.preventDefault();
    setError('');
    if (!confirmedDetails) {
      setError('Please check the confirmation box verifying that the institution details are correct.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: regForm.username,
        email: regForm.email,
        password: regForm.password,
        fullName: regForm.fullName || currentInst.hoi,
        role: regForm.role,
        institutionCode: currentInst.pid,
        institutionName: currentInst.name,
        region: currentInst.region,
        state: currentInst.state,
        city: currentInst.city
      };

      const res = await authApi.register(payload);
      setAuthToken(res.token);
      setStoredUser(res.user);
      onLoginSuccess(res.user, res.dashboardRoute);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoSelect = (username) => {
    setLoginUsername(username);
    setLoginPassword('Password@123');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans">
      <SocialSidebar />

      {/* Top Banner (matching Image 1 Header) */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          <div className="flex items-center space-x-4">
            <AicteEmblem className="w-12 h-12" />
            <div>
              <div className="text-xs font-bold text-slate-800">अखिल भारतीय तकनीकी शिक्षा परिषद</div>
              <div className="text-sm font-black text-slate-900 tracking-tight font-serif">
                All India Council for Technical Education
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-2 border-l border-slate-200 pl-4">
              <NationalEmblem className="w-5 h-7" />
              <div className="text-[11px] font-bold text-slate-700">
                Ministry of Education
              </div>
            </div>

            <G20Logo className="w-14 h-7 hidden lg:block" />
          </div>

          <div className="flex items-center space-x-3 text-xs font-semibold">
            <button
              onClick={() => { setActiveMode('login'); setError(''); }}
              className={`px-3 py-1.5 rounded transition ${
                activeMode === 'login'
                  ? 'text-blue-900 font-bold underline'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Portal Login
            </button>

            <button
              onClick={() => { setActiveMode('register'); setError(''); }}
              className="bg-[#f97316] hover:bg-orange-600 text-white font-bold px-4 py-1.5 rounded-full transition shadow-xs"
            >
              Register
            </button>
          </div>

        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        
        {/* TAB 1: REGISTRATION (Matching Image 1 & 2 Exactly!) */}
        {activeMode === 'register' && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-10 space-y-8">
            
            {/* Header: "Registration" with orange underline (Image 1) */}
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-normal text-slate-800 tracking-tight">
                Registration
              </h2>
              <div className="w-48 h-0.5 bg-[#f97316] mx-auto mt-2" />
              <p className="text-xs text-slate-500 mt-2 font-medium">Select User Type</p>
            </div>

            {/* User Type Big Graphic Icon Cards (Image 1) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {USER_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedUserType === type.id;

                return (
                  <div
                    key={type.id}
                    onClick={() => {
                      if (type.available) {
                        setSelectedUserType(type.id);
                      } else {
                        alert(`${type.label} registration is handled via dedicated ministerial portals.`);
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition text-center relative ${
                      isSelected
                        ? 'text-[#f97316]'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-12 h-12 mb-2 ${isSelected ? 'text-[#f97316]' : 'text-slate-400'}`} />
                    <span className="text-xs font-medium leading-tight">{type.label}</span>
                    
                    {/* Orange Active Underline */}
                    {isSelected && (
                      <div className="w-16 h-1 bg-[#f97316] mt-3 rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* AICTE Affiliated vs Non-AICTE Radio Selection (Image 2) */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              
              <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-800">
                <label className="flex items-center space-x-2 cursor-pointer bg-blue-50/60 px-3 py-1.5 rounded-full border border-blue-200">
                  <input
                    type="radio"
                    name="affiliation"
                    checked={affiliationType === 'AICTE_AFFILIATED'}
                    onChange={() => setAffiliationType('AICTE_AFFILIATED')}
                    className="w-4 h-4 text-blue-900"
                  />
                  <span>AICTE Affiliated Organisation (Diploma/Engineering/MBA)</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-slate-600">
                  <input
                    type="radio"
                    name="affiliation"
                    checked={affiliationType === 'NON_AICTE'}
                    onChange={() => setAffiliationType('NON_AICTE')}
                    className="w-4 h-4 text-blue-900"
                  />
                  <span>Non-AICTE (UGC/ IGNOU / Other)</span>
                </label>
              </div>

              <div className="text-xs text-blue-900 font-medium">
                If you don't know weather your institute is AICTE affialited,{' '}
                <a href="#check" className="underline font-bold text-blue-700">Check Here</a>
              </div>

              {/* Orange Bordered Institution Verification Card (Matching Image 2 Exactly!) */}
              <div className="border-2 border-[#f97316] rounded-xl p-6 bg-white space-y-4 shadow-sm">
                
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Name of University/College/Institute <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={selectedInstIndex}
                    onChange={(e) => setSelectedInstIndex(parseInt(e.target.value, 10))}
                    className="w-full bg-[#f1f5f9] border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-800 uppercase focus:outline-none"
                  >
                    {PRE_SEEDED_INSTITUTIONS.map((inst, idx) => (
                      <option key={inst.pid} value={idx}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4 Pill Boxes: Institute PID, Type, HOI Name, Region (Image 2) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Institute PID</label>
                    <div className="bg-white border border-[#f97316]/50 rounded-lg p-2 text-center font-bold text-slate-800">
                      {currentInst.pid}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Type</label>
                    <div className="bg-white border border-[#f97316]/50 rounded-lg p-2 text-center text-[11px] font-medium text-slate-800 truncate">
                      {currentInst.type}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">HOI Name</label>
                    <div className="bg-white border border-[#f97316]/50 rounded-lg p-2 text-center text-[11px] font-medium text-slate-800 truncate">
                      {currentInst.hoi}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Region</label>
                    <div className="bg-white border border-[#f97316]/50 rounded-lg p-2 text-center text-[11px] font-medium text-slate-800">
                      {currentInst.region}
                    </div>
                  </div>

                </div>

              </div>

              {/* Red Bold Checkbox (Image 2) */}
              <div className="flex items-center justify-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="confirmBox"
                  checked={confirmedDetails}
                  onChange={(e) => setConfirmedDetails(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded border-slate-300"
                />
                <label htmlFor="confirmBox" className="text-xs sm:text-sm font-bold text-red-600 cursor-pointer">
                  I confirm the above details are correct
                </label>
              </div>

              {/* Section A Security Notice */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900 flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Privilege Escalation Protection (Section A):</span>{' '}
                  Public self-registration is strictly restricted to Institution representatives. Privileged AICTE Administrative, Scrutiny, and Bureau Officer accounts cannot be selected by public users and are provisioned solely by AICTE HQ.
                </div>
              </div>

              {/* Account Credentials Form */}
              <form onSubmit={handleRegister} className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Create Institution Portal Account Credentials
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Desired Username</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. director_dit"
                      value={regForm.username}
                      onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Official Institutional Email</label>
                    <input
                      type="email"
                      required
                      placeholder="principal@institute.ac.in"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Authorized Person Name</label>
                    <input
                      type="text"
                      placeholder={currentInst.hoi}
                      value={regForm.fullName}
                      onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Strong password"
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-800 p-2.5 rounded text-xs border border-red-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#f97316] hover:bg-orange-600 text-white font-bold py-2.5 rounded-lg text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Registering...' : 'Register Institution & Generate Authorized Dashboard Access'}
                </button>
              </form>

            </div>

          </div>
        )}

        {/* TAB 2: CENTRALIZED LOGIN (Matching Official AICTE Single Sign-On) */}
        {activeMode === 'login' && (
          <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-10 space-y-6">
            
            <div className="text-center space-y-2">
              <AicteEmblem className="w-16 h-16 mx-auto" />
              <h3 className="text-xl font-bold text-slate-900 tracking-tight font-serif">
                AICTE Centralized Web Portal Login
              </h3>
              <p className="text-xs text-slate-500">
                Single sign-on gateway for Institutions, AICTE Officers, Committees, and Regulatory Authorities
              </p>
            </div>

            {/* Quick Demo Impersonator Bar */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-900 text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  1-Click Demo Credentials Preset:
                </span>
                <span className="text-[10px] text-amber-700 font-mono">Password: Password@123</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                {[
                  { u: 'instadmin', l: '🏫 Institution Admin A' },
                  { u: 'inststaff', l: '👤 Institution Staff' },
                  { u: 'instadmin_b', l: '🏢 Institution Admin B' },
                  { u: 'scrutinyofficer', l: '🔍 Scrutiny Officer' },
                  { u: 'evcmember', l: '📋 Assigned EVC' },
                  { u: 'evcmember2', l: '🚫 Unassigned EVC' },
                  { u: 'regionalofficer', l: '🗺️ Regional Officer' },
                  { u: 'competentauthority', l: '⚖️ Competent Auth.' },
                  { u: 'auditor', l: '📑 Statutory Auditor' },
                  { u: 'superadmin', l: '⚡ Super Admin' },
                ].map(item => (
                  <button
                    key={item.u}
                    type="button"
                    onClick={() => handleQuickDemoSelect(item.u)}
                    className={`px-2 py-1.5 rounded text-left border transition truncate cursor-pointer ${
                      loginUsername === item.u
                        ? 'bg-amber-600 text-white font-bold border-amber-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
                    }`}
                  >
                    {item.l}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-600 p-3 rounded text-xs text-red-800">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-50 border-l-4 border-emerald-600 p-3 rounded text-xs text-emerald-800">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Username or Registered Official Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="e.g. instadmin, scrutinyofficer, superadmin"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-900"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>Protection: 5 failed attempts locks account for 15 mins</span>
                  <span className="text-blue-900 hover:underline cursor-pointer">Forgot Password?</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#122749] hover:bg-[#0c1a32] text-white font-bold py-2.5 rounded-lg text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Authenticating & Verifying Session...' : 'Sign In to Authorised Dashboard'}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-500">
              New Institution?{' '}
              <button
                onClick={() => { setActiveMode('register'); setError(''); }}
                className="text-[#f97316] font-bold hover:underline"
              >
                Register Institution Here
              </button>
            </div>

          </div>
        )}

        {/* TAB 3: MFA CHALLENGE */}
        {activeMode === 'mfa' && (
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4">
            <div className="inline-flex p-3 bg-amber-100 rounded-full text-amber-700">
              <Key className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Multi-Factor Authentication (MFA)</h3>
            <p className="text-xs text-slate-500">
              Enter the 6-digit verification code from your authenticator device or simulated mobile OTP.
            </p>

            <form onSubmit={handleVerifyMfa} className="space-y-4 text-xs">
              <input
                type="text"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="w-full text-center tracking-widest text-2xl font-mono py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                placeholder="123456"
                required
              />
              <p className="text-[10px] text-slate-400">Default demo code: 123456</p>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('login')}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-[#122749] text-white font-bold rounded-lg"
                >
                  {loading ? 'Verifying...' : 'Validate Code'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* Statutory Footer (Government of India) */}
      <footer className="bg-[#1e232a] text-slate-400 text-[11px] py-6 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <span className="font-bold text-white">All India Council for Technical Education (AICTE)</span>
            <span className="mx-2">•</span>
            <span>Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070</span>
          </div>
          <div>
            <span>Website Policies | Terms & Conditions | e-Governance Cell © 2026</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
