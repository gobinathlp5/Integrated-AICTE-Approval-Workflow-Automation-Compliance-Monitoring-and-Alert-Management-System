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

import { 
  getStoredUser, setStoredUser, removeStoredUser, 
  getAuthToken, removeAuthToken, setAuthToken, authApi 
} from './api';

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs">
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      
      {/* Platform Header */}
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

      {/* Council Statutory Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white">All India Council for Technical Education (AICTE)</span>
            <span>•</span>
            <span>Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070</span>
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            <span className="bg-slate-800 text-emerald-400 px-2 py-0.5 rounded font-mono">
              RBAC Engine v2.4 (HMAC-SHA256 Chained)
            </span>
            <span>Protected by Government e-Security Standard</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
