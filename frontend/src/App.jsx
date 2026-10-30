import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LoginModal from './components/LoginModal';
import DashboardOverview from './components/DashboardOverview';
import DocumentRepository from './components/DocumentRepository';
import ApplicationsView from './components/ApplicationsView';
import CommentsDrawer from './components/CommentsDrawer';
import RbacManager from './components/RbacManager';
import AuditExplorer from './components/AuditExplorer';
import SecurityTestRunner from './components/SecurityTestRunner';
import { SocialSidebar, AicteMascot } from './components/AicteLogo';

import { 
  getStoredUser, setStoredUser, removeStoredUser, 
  getAuthToken, removeAuthToken, setAuthToken, authApi 
} from './api';

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    // Check if token exists and verify session
    const token = getAuthToken();
    if (token) {
      authApi.getMe()
        .then(res => {
          setUser(res.user);
          setStoredUser(res.user);
        })
        .catch(() => {
          handleLogout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLoginSuccess = (authenticatedUser, dashboardRoute) => {
    setUser(authenticatedUser);
    setCurrentTab('dashboard');
  };

  const handleQuickSwitch = async (role, username) => {
    try {
      const res = await authApi.quickSwitch(role, username);
      setAuthToken(res.token);
      setStoredUser(res.user);
      setUser(res.user);
    } catch (err) {
      alert('Quick switch failed: ' + err.message);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    removeStoredUser();
    setUser(null);
    setCurrentTab('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1e232a] flex items-center justify-center text-white text-xs font-sans">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>Verifying Centralized AICTE Session Credentials...</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, display Centralized Login Portal
  if (!user) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-900 antialiased relative">
      
      {/* Floating Government Right Social Sidebar (Image 3 & 4) */}
      <SocialSidebar />

      {/* Floating AICTE Assistant Mascot (Image 4 bottom right) */}
      <AicteMascot onClick={() => setShowHelpModal(true)} />

      {/* Official AICTE Platform Header */}
      <Header
        user={user}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onQuickSwitch={handleQuickSwitch}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && (
          <DashboardOverview user={user} onNavigate={setCurrentTab} />
        )}

        {currentTab === 'documents' && (
          <DocumentRepository user={user} />
        )}

        {currentTab === 'applications' && (
          <ApplicationsView user={user} onSelectDocumentFolder={() => setCurrentTab('documents')} />
        )}

        {currentTab === 'comments' && (
          <CommentsDrawer user={user} />
        )}

        {currentTab === 'rbac' && (
          <RbacManager user={user} />
        )}

        {currentTab === 'audit' && (
          <AuditExplorer user={user} />
        )}

        {currentTab === 'security-tests' && (
          <SecurityTestRunner />
        )}
      </main>

      {/* Official AICTE Help Mascot Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm">
                  🤖
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">AICTE e-Governance Portal Assistant</h4>
                  <p className="text-[10px] text-slate-500">Online Helpdesk & Regulatory Support</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-700 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="font-semibold text-slate-900">Centralized Access Management Quick Guide:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                <li>Use the top <strong>Role Switcher</strong> to test all 13 AICTE administrative and institutional roles.</li>
                <li>Visit <strong>Mandatory Security Tests (9/9)</strong> to run automated backend verification with live telemetry.</li>
                <li>Documents carry independent access control metadata and time-limited HMAC signed download tokens.</li>
                <li>All document events are cryptographically recorded in the SHA-256 tamper-evident ledger.</li>
              </ul>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full bg-[#122749] text-white font-bold py-2 rounded-lg text-xs"
            >
              Close Assistant
            </button>
          </div>
        </div>
      )}

      {/* Council Statutory Government Footer */}
      <footer className="bg-[#1e232a] text-slate-400 text-xs border-t border-slate-800 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4 text-center md:text-left">
            <div>
              <span className="font-bold text-white text-sm">All India Council for Technical Education (AICTE)</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070 • Phone: 011-29581000
              </p>
            </div>

            <div className="flex items-center space-x-2 text-[11px]">
              <span className="bg-[#f59e0b] text-slate-950 px-2 py-0.5 rounded font-bold font-mono">
                RBAC Kernel v2.4
              </span>
              <span className="bg-slate-800 text-emerald-400 px-2 py-0.5 rounded font-mono">
                SHA-256 Ledger Intact
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
            <div>
              <span>Website Policies | Hyperlinking Policy | Privacy Policy | Copyright Policy | Terms & Conditions</span>
            </div>
            <div>
              <span>Designed & Developed for AICTE SIH Approval Process System © 2026</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
