import React, { useState } from 'react';
import {
  LayoutDashboard, Building2, FileSpreadsheet, GitMerge, CheckSquare,
  ClipboardCheck, Scale, Award, FileText, ShieldCheck, FolderLock,
  MessageSquareText, AlertTriangle, BarChart3, UserCheck, History,
  ShieldAlert, ChevronLeft, ChevronRight, Sparkles, Bell, Landmark,
  Shield, RefreshCw, DollarSign
} from 'lucide-react';

export default function Sidebar({
  currentTab,
  setCurrentTab,
  collapsed,
  setCollapsed,
  user,
  unreadNotificationsCount = 0,
  openEscalationsCount = 0,
  onOpenAiAssistant
}) {
  const navSections = [
    {
      title: 'FDR & SECURITY DEPOSIT LIFECYCLE',
      items: [
        { id: 'dashboard', label: 'FDR Dashboard', icon: LayoutDashboard },
        { id: 'fdr-register', label: 'FDR Master Register', icon: Landmark },
        { id: 'fdr-verification', label: 'Verification Workspace', icon: Shield },
        { id: 'fdr-renewals', label: 'Renewal & Replacement', icon: RefreshCw },
        { id: 'fdr-releases', label: 'Release & Refund Portal', icon: DollarSign },
        { id: 'fdr-reports', label: 'Deposit Reports & Analytics', icon: BarChart3 }
      ]
    },
    {
      title: 'DOCUMENT CUSTODY & GOVERNANCE',
      items: [
        { id: 'documents', label: 'Document Repository', icon: FolderLock },
        { id: 'institution', label: 'Institution Profile', icon: Building2 },
        { id: 'comments', label: 'Official Communications', icon: MessageSquareText },
        {
          id: 'escalations',
          label: 'SLA Escalations',
          icon: AlertTriangle,
          badge: openEscalationsCount > 0 ? openEscalationsCount : null,
          badgeColor: 'bg-red-500'
        }
      ]
    },
    {
      title: 'STATUTORY APPROVALS (APH)',
      items: [
        { id: 'applications', label: 'Approval Applications', icon: FileSpreadsheet },
        { id: 'scrutiny', label: 'Scrutiny & Deficiencies', icon: CheckSquare },
        { id: 'decisions', label: 'Authority Decisions', icon: Award }
      ]
    },
    {
      title: 'ADMINISTRATION & SECURITY',
      items: [
        { id: 'rbac', label: 'RBAC Policy Matrix', icon: UserCheck, adminOnly: true },
        { id: 'audit', label: 'SHA-256 Audit Trail', icon: History },
        { id: 'security-tests', label: 'Security & Lifecycle Tests', icon: ShieldAlert }
      ]
    }
  ];

  const isAdmin = user && (user.role === 'SUPER_ADMIN' || user.role === 'AICTE_ADMIN');

  return (
    <aside
      className={`bg-white border-r border-[#DCE3EA] flex flex-col transition-all duration-200 z-30 select-none shadow-xs ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Sidebar Action: AI Assistant Trigger */}
      <div className="p-3 border-b border-slate-100">
        <button
          onClick={onOpenAiAssistant}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-[#12345A] to-[#1B5E80] text-white hover:brightness-110 shadow-xs text-xs font-semibold cursor-pointer transition ${
            collapsed ? 'px-2' : ''
          }`}
          title="Administrative Advisory AI Assistant"
        >
          <Sparkles className="w-4 h-4 text-[#F2A900] shrink-0" />
          {!collapsed && <span>AI Advisory Assistant</span>}
        </button>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navSections.map((section, idx) => {
          // Filter out admin-only items if not admin
          const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-1">
              {!collapsed && (
                <div className="px-3 text-[10px] font-bold text-slate-400 tracking-wider">
                  {section.title}
                </div>
              )}

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                      isActive
                        ? 'bg-[#12345A] text-white font-semibold shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#F2A900]' : 'text-slate-500'}`} />
                    {!collapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${item.badgeColor || 'bg-red-500'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Collapse/Expand Toggle Footer */}
      <div className="p-3 border-t border-slate-100 flex items-center justify-between">
        {!collapsed && (
          <div className="text-[10px] text-slate-400 font-mono">
            PS #26265 • v4.0.0
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer mx-auto"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
