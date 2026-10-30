import React, { useState } from 'react';
import {
  LayoutDashboard, Building2, FileSpreadsheet, GitMerge, CheckSquare,
  ClipboardCheck, Scale, Award, FileText, ShieldCheck, FolderLock,
  MessageSquareText, AlertTriangle, BarChart3, UserCheck, History,
  ShieldAlert, ChevronLeft, ChevronRight, Sparkles, Bell
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
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'institution', label: 'Institution Profile', icon: Building2 }
      ]
    },
    {
      title: 'STATUTORY APPROVALS',
      items: [
        { id: 'applications', label: 'Applications', icon: FileSpreadsheet },
        { id: 'workflow', label: 'Workflow Engine', icon: GitMerge },
        { id: 'scrutiny', label: 'Scrutiny & Deficiencies', icon: CheckSquare },
        { id: 'evc', label: 'EVC Inspections', icon: ClipboardCheck },
        { id: 'sac', label: 'SAC Appellate Hearings', icon: Scale },
        { id: 'decisions', label: 'Authority Decisions', icon: Award }
      ]
    },
    {
      title: 'COMPLIANCE & GOVERNANCE',
      items: [
        { id: 'undertakings', label: 'Undertakings & Affidavits', icon: FileText },
        { id: 'compliance', label: 'Compliance Monitoring', icon: ShieldCheck },
        { id: 'documents', label: 'Document Repository', icon: FolderLock },
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
      title: 'ADMINISTRATION & SECURITY',
      items: [
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
        { id: 'rbac', label: 'RBAC Policy Matrix', icon: UserCheck, adminOnly: true },
        { id: 'audit', label: 'SHA-256 Audit Trail', icon: History },
        { id: 'security-tests', label: 'Security Tests (9/9)', icon: ShieldAlert }
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
              {visibleItems.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentTab(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition cursor-pointer text-left relative ${
                      isActive
                        ? 'bg-[#12345A] text-white font-semibold shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-[#12345A]'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1 bottom-1 w-1 bg-[#F2A900] rounded-r-md" />
                    )}
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#F2A900]' : 'text-[#1B5E80]'
                      }`}
                    />
                    {!collapsed && (
                      <span className="truncate flex-1">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span
                        className={`ml-auto text-[10px] font-bold px-1.5 py-0.2 rounded-full text-white ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {collapsed && item.badge && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Collapse Toggle Footer */}
      <div className="p-2 border-t border-[#DCE3EA] flex items-center justify-between text-xs text-slate-500">
        {!collapsed && (
          <div className="px-2 text-[11px] text-slate-400">
            AICTE SIH v3.0
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded hover:bg-slate-100 text-slate-600 transition ml-auto cursor-pointer"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
