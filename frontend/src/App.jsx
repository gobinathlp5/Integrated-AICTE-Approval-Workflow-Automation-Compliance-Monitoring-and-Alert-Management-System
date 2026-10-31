import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Breadcrumbs from './components/Breadcrumbs';
import LoginModal from './components/LoginModal';
import DashboardOverview from './components/DashboardOverview';
import DocumentRepository from './components/DocumentRepository';
import ApplicationsView from './components/ApplicationsView';
import WorkflowEngineView from './components/WorkflowEngineView';
import ScrutinyView from './components/ScrutinyView';
import EvcManagementView from './components/EvcManagementView';
import SacHearingsView from './components/SacHearingsView';
import DecisionsView from './components/DecisionsView';
import UndertakingsView from './components/UndertakingsView';
import ComplianceMonitoringView from './components/ComplianceMonitoringView';
import InstitutionProfileView from './components/InstitutionProfileView';
import ReportsView from './components/ReportsView';
import CommentsDrawer from './components/CommentsDrawer';
import EscalationsView from './components/EscalationsView';
import RbacManager from './components/RbacManager';
import AuditExplorer from './components/AuditExplorer';
import SecurityTestRunner from './components/SecurityTestRunner';
import AiAssistantDrawer from './components/AiAssistantDrawer';
import NotificationCenterModal from './components/NotificationCenterModal';
import { SocialSidebar, AicteMascot } from './components/AicteLogo';

import { 
  getStoredUser, setStoredUser, removeStoredUser, 
  getAuthToken, removeAuthToken, setAuthToken, authApi,
  notificationApi, escalationApi
} from './api';

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [openEscalations, setOpenEscalations] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('aicte_theme') === 'dark';
  });

  useEffect(() => {
    document.title = 'AICTE';
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

  useEffect(() => {
    if (user) {
      fetchBadges();
    }
  }, [user]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('aicte_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('aicte_theme', 'light');
    }
  }, [isDarkMode]);

  const fetchBadges = async () => {
    try {
      const [notifs, escs] = await Promise.all([
        notificationApi.list().catch(() => []),
        escalationApi.list().catch(() => [])
      ]);
      setUnreadNotifications((notifs || []).filter(n => !n.is_read).length);
      setOpenEscalations((escs || []).filter(e => e.status === 'OPEN').length);
    } catch (err) {
      console.error(err);
    }
  };

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
      fetchBadges();
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
      <div className="min-h-screen bg-[#121926] flex items-center justify-center text-white text-xs font-sans">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-[#F2A900] border-t-transparent rounded-full animate-spin" />
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
    <div className="min-h-screen bg-[#F4F6F9] dark:bg-[#0B1321] flex flex-col font-sans text-[#202B38] dark:text-[#F1F5F9] antialiased relative">
      
      {/* Floating Government Right Social Sidebar */}
      <SocialSidebar />

      {/* Floating AICTE Assistant Mascot */}
      <AicteMascot onClick={() => setShowAiDrawer(true)} />

      {/* Official AICTE Platform Header */}
      <Header
        user={user}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onQuickSwitch={handleQuickSwitch}
        onLogout={handleLogout}
        onOpenNotifications={() => setShowNotificationModal(true)}
        unreadCount={unreadNotifications}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />

      {/* Body Layout: Sidebar + Main Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Collapsible Accessible Sidebar */}
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          user={user}
          unreadNotificationsCount={unreadNotifications}
          openEscalationsCount={openEscalations}
          onOpenAiAssistant={() => setShowAiDrawer(true)}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-4">
            
            {/* Standardized Government Breadcrumbs */}
            <Breadcrumbs
              currentTab={currentTab}
              onNavigate={setCurrentTab}
              user={user}
            />

            {/* Tab Routed Views */}
            {currentTab === 'dashboard' && (
              <DashboardOverview
                user={user}
                onNavigate={setCurrentTab}
                onOpenAiAssistant={() => setShowAiDrawer(true)}
              />
            )}

            {currentTab === 'institution' && (
              <InstitutionProfileView user={user} />
            )}

            {currentTab === 'applications' && (
              <ApplicationsView
                user={user}
                onSelectDocumentFolder={() => setCurrentTab('documents')}
              />
            )}

            {currentTab === 'workflow' && (
              <WorkflowEngineView user={user} />
            )}

            {currentTab === 'scrutiny' && (
              <ScrutinyView user={user} />
            )}

            {currentTab === 'evc' && (
              <EvcManagementView user={user} />
            )}

            {currentTab === 'sac' && (
              <SacHearingsView user={user} />
            )}

            {currentTab === 'decisions' && (
              <DecisionsView user={user} />
            )}

            {currentTab === 'undertakings' && (
              <UndertakingsView user={user} />
            )}

            {currentTab === 'compliance' && (
              <ComplianceMonitoringView user={user} />
            )}

            {currentTab === 'documents' && (
              <DocumentRepository user={user} />
            )}

            {currentTab === 'comments' && (
              <CommentsDrawer user={user} />
            )}

            {currentTab === 'escalations' && (
              <EscalationsView user={user} />
            )}

            {currentTab === 'reports' && (
              <ReportsView user={user} />
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

          </div>
        </main>
      </div>

      {/* Notification Center Modal */}
      <NotificationCenterModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        onRefreshCount={fetchBadges}
      />

      {/* Administrative Advisory AI Assistant Drawer */}
      <AiAssistantDrawer
        isOpen={showAiDrawer}
        onClose={() => setShowAiDrawer(false)}
        user={user}
      />

      {/* Council Statutory Government Footer */}
      <footer className="bg-[#121926] text-slate-400 text-xs border-t border-slate-800 py-6 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-4 text-center md:text-left">
            <div>
              <span className="font-bold text-white text-sm">All India Council for Technical Education (AICTE)</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070 • Phone: 011-29581000 • Regulation Bureau (Smart Automation)
              </p>
            </div>

            <div className="flex items-center space-x-2 text-[11px]">
              <span className="bg-[#F2A900] text-slate-950 px-2 py-0.5 rounded font-bold font-mono">
                SIH Problem #26262
              </span>
              <span className="bg-slate-800 text-emerald-400 px-2 py-0.5 rounded font-mono">
                SHA-256 Ledger Active
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
            <div>
              <span>Website Policies | Hyperlinking Policy | Privacy Policy | Copyright Policy | Terms & Conditions</span>
            </div>
            <div>
              <span>Designed & Developed for AICTE Digital Governance Portal © 2026</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
