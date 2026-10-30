import React, { useState } from 'react';
import { 
  Shield, Lock, User, Building, MapPin, Key, AlertTriangle, 
  CheckCircle, ArrowRight, ShieldAlert, Sparkles, HelpCircle 
} from 'lucide-react';
import { authApi, setAuthToken, setStoredUser } from '../api';
import { ROLE_LABELS } from './Header';

export default function LoginModal({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register' | 'mfa'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login Form
  const [loginUsername, setLoginUsername] = useState('instadmin');
  const [loginPassword, setLoginPassword] = useState('Password@123');

  // MFA Challenge State
  const [mfaSessionToken, setMfaSessionToken] = useState('');
  const [mfaCode, setMfaCode] = useState('123456');

  // Registration Form
  const [regForm, setRegForm] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'INSTITUTION_ADMIN', // Strictly restricted to institution roles!
    institutionCode: '1-4001239999',
    institutionName: '',
    region: 'Northern',
    state: 'Delhi',
    city: 'New Delhi'
  });

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await authApi.login(loginUsername, loginPassword);

      if (res.requiresMfa) {
        setMfaSessionToken(res.mfaSessionToken);
        setActiveTab('mfa');
        setSuccessMsg(res.message);
        return;
      }

      setAuthToken(res.token);
      setStoredUser(res.user);
      onLoginSuccess(res.user, res.dashboardRoute);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
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
      setError(err.message || 'MFA verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e?.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await authApi.register(regForm);
      setAuthToken(res.token);
      setStoredUser(res.user);
      onLoginSuccess(res.user, res.dashboardRoute);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoSelect = (username, role) => {
    setLoginUsername(username);
    setLoginPassword('Password@123');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950 via-slate-900 to-black">
      
      {/* Branding Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex p-3 bg-blue-900/40 rounded-2xl border border-amber-500/30 text-amber-400 mb-3 shadow-inner">
          <Shield className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">
          All India Council for Technical Education
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Centralized Single Sign-On & Access Management Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-slate-200">
          
          {/* Navigation Pill Tabs */}
          {activeTab !== 'mfa' && (
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200">
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                  activeTab === 'login'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Centralized Login (All 13 Roles)
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('register'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                  activeTab === 'register'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                New Institution Registration
              </button>
            </div>
          )}

          {/* Error & Warning Notifications */}
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-600 p-3 rounded text-xs text-red-800 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Authentication Exception</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-emerald-50 border-l-4 border-emerald-600 p-3 rounded text-xs text-emerald-800 flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>{successMsg}</div>
            </div>
          )}

          {/* TAB 1: CENTRALIZED LOGIN */}
          {activeTab === 'login' && (
            <div>
              {/* Quick Preset Selector for Easy Testing */}
              <div className="mb-5 bg-indigo-50/70 border border-indigo-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Quick Demo Credentials Preset:
                  </span>
                  <span className="text-[10px] text-indigo-600 font-mono">Password: Password@123</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                  {[
                    { u: 'instadmin', label: '🏫 Institution Admin A' },
                    { u: 'inststaff', label: '👤 Institution Staff' },
                    { u: 'instadmin_b', label: '🏢 Institution Admin B' },
                    { u: 'scrutinyofficer', label: '🔍 Scrutiny Officer' },
                    { u: 'evcmember', label: '📋 Assigned EVC' },
                    { u: 'evcmember2', label: '🚫 Unassigned EVC' },
                    { u: 'regionalofficer', label: '🗺️ Regional Officer' },
                    { u: 'competentauthority', label: '⚖️ Competent Auth.' },
                    { u: 'auditor', label: '📑 Statutory Auditor' },
                    { u: 'superadmin', label: '⚡ Super Admin' },
                  ].map(item => (
                    <button
                      key={item.u}
                      type="button"
                      onClick={() => handleQuickDemoSelect(item.u)}
                      className={`px-2 py-1.5 rounded text-left border transition text-[11px] truncate cursor-pointer ${
                        loginUsername === item.u 
                          ? 'bg-indigo-600 text-white font-bold border-indigo-700 shadow-xs' 
                          : 'bg-white text-slate-700 border-indigo-100 hover:bg-indigo-100/50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Username or Registered Email
                  </label>
                  <div className="mt-1 relative rounded-md shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="e.g. instadmin, scrutinyofficer, superadmin"
                      className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="mt-1 relative rounded-md shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                    <span>Protection: 5 failed attempts locks account for 15 mins</span>
                    <span className="text-blue-900 hover:underline cursor-pointer">Forgot password?</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-900 hover:bg-blue-950 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-900 transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Authenticating & Verifying Session...' : 'Sign In to Authorised Dashboard'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: MFA CHALLENGE */}
          {activeTab === 'mfa' && (
            <div className="text-center py-4">
              <div className="inline-flex p-3 bg-emerald-100 rounded-full text-emerald-700 mb-3">
                <Key className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Multi-Factor Authentication (MFA)</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                Enter the 6-digit verification code from your authenticator device or simulated mobile OTP.
              </p>

              <form onSubmit={handleVerifyMfa} className="space-y-4 max-w-xs mx-auto">
                <div>
                  <input
                    type="text"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    className="block w-full text-center tracking-widest text-2xl font-mono py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
                    placeholder="123456"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Default demo code: 123456</p>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('login')}
                    className="flex-1 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-950 rounded-lg shadow-xs"
                  >
                    {loading ? 'Verifying...' : 'Validate Code'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: NEW INSTITUTION REGISTRATION (WITH PRIVILEGE ESCALATION BLOCKING) */}
          {activeTab === 'register' && (
            <div>
              {/* Mandatory Security Notice */}
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Privilege Escalation Protection (Section A)</p>
                  <p className="text-[11px] text-amber-800">
                    Public users are strictly prohibited from selecting privileged AICTE roles (Admin, Regulation Bureau, Scrutiny Officer, EVC Member, Regional Officer). Only Institution User registration is permitted here.
                  </p>
                </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Username</label>
                    <input
                      type="text"
                      required
                      value={regForm.username}
                      onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                      placeholder="e.g. director_iitd"
                      className="mt-1 block w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Official Email</label>
                    <input
                      type="email"
                      required
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      placeholder="principal@institute.edu.in"
                      className="mt-1 block w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Full Name</label>
                    <input
                      type="text"
                      required
                      value={regForm.fullName}
                      onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                      placeholder="Dr. Rajesh Gupta"
                      className="mt-1 block w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Password</label>
                    <input
                      type="password"
                      required
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                      placeholder="Strong password"
                      className="mt-1 block w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Permitted Public Role</label>
                  <select
                    value={regForm.role}
                    onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}
                    className="mt-1 block w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white font-medium"
                  >
                    <option value="INSTITUTION_ADMIN">Institution Administrator (Principal / Director)</option>
                    <option value="INSTITUTION_STAFF">Institution Staff / Authorized Representative</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">AICTE Permanent Inst. ID</label>
                    <input
                      type="text"
                      required
                      value={regForm.institutionCode}
                      onChange={(e) => setRegForm({ ...regForm, institutionCode: e.target.value })}
                      placeholder="e.g. 1-1002345671"
                      className="mt-1 block w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Institution Name</label>
                    <input
                      type="text"
                      required
                      value={regForm.institutionName}
                      onChange={(e) => setRegForm({ ...regForm, institutionName: e.target.value })}
                      placeholder="e.g. National Institute of Science"
                      className="mt-1 block w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700">Region</label>
                    <select
                      value={regForm.region}
                      onChange={(e) => setRegForm({ ...regForm, region: e.target.value })}
                      className="mt-1 block w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                    >
                      <option value="Northern">Northern</option>
                      <option value="Western">Western</option>
                      <option value="Southern">Southern</option>
                      <option value="Eastern">Eastern</option>
                      <option value="Central">Central</option>
                      <option value="South-Western">South-Western</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700">State</label>
                    <input
                      type="text"
                      value={regForm.state}
                      onChange={(e) => setRegForm({ ...regForm, state: e.target.value })}
                      className="mt-1 block w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700">City</label>
                    <input
                      type="text"
                      value={regForm.city}
                      onChange={(e) => setRegForm({ ...regForm, city: e.target.value })}
                      className="mt-1 block w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white bg-blue-900 hover:bg-blue-950 transition"
                >
                  {loading ? 'Registering Account...' : 'Register Institution & Create Admin Account'}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
