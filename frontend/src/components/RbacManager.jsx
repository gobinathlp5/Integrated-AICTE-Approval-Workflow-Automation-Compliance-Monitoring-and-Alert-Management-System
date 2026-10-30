import React, { useState, useEffect } from 'react';
import { 
  Key, Shield, Users, Check, X, Sliders, RefreshCw, 
  AlertTriangle, Lock, Eye, Edit3, Settings
} from 'lucide-react';
import { adminApi } from '../api';
import { ROLE_LABELS } from './Header';

export default function RbacManager({ user }) {
  const [activeSubTab, setActiveSubTab] = useState('matrix'); // 'matrix' | 'overrides' | 'classifications' | 'users'
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);

  // User Overrides State
  const [userList, setUserList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userOverrides, setUserOverrides] = useState([]);
  const [overridePerm, setOverridePerm] = useState('DELETE');
  const [overrideStatus, setOverrideStatus] = useState('1'); // '1' = Grant, '0' = Deny
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);

  // Visibility Classifications State
  const [classifications, setClassifications] = useState([]);

  useEffect(() => {
    loadRbacData();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadUserOverrides(selectedUserId);
    }
  }, [selectedUserId]);

  const loadRbacData = async () => {
    setLoading(true);
    try {
      const [matrixRes, usersRes, classRes] = await Promise.all([
        adminApi.getRolesPermissions(),
        adminApi.getUsers(),
        adminApi.getVisibilityClassifications()
      ]);

      setRoles(matrixRes.roles || []);
      setPermissions(matrixRes.permissions || []);
      setMatrix(matrixRes.matrix || {});
      setUserList(usersRes.users || []);
      setClassifications(classRes.classifications || []);

      if (usersRes.users && usersRes.users.length > 0) {
        setSelectedUserId(usersRes.users[0].id);
      }
    } catch (err) {
      console.error('Failed to load RBAC data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserOverrides = async (userId) => {
    try {
      const res = await adminApi.getUserOverrides(userId);
      setUserOverrides(res.overrides || []);
    } catch (err) {
      console.error('Failed to load user overrides:', err);
    }
  };

  const handleTogglePermission = async (role, permission, currentStatus) => {
    try {
      const nextStatus = !currentStatus;
      await adminApi.updateRolePermission(role, permission, nextStatus);
      
      setMatrix(prev => ({
        ...prev,
        [role]: {
          ...prev[role],
          [permission]: nextStatus
        }
      }));
    } catch (err) {
      alert('Error updating permission: ' + err.message);
    }
  };

  const handleSaveOverride = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setOverrideLoading(true);
    try {
      await adminApi.setUserOverride({
        userId: selectedUserId,
        permission: overridePerm,
        isGranted: overrideStatus === '1' ? 1 : 0,
        reason: overrideReason || 'Administrative granular adjustment'
      });
      alert('User-specific permission override applied successfully.');
      loadUserOverrides(selectedUserId);
      setOverrideReason('');
    } catch (err) {
      alert('Failed to set override: ' + err.message);
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleRemoveOverride = async (perm) => {
    try {
      await adminApi.setUserOverride({
        userId: selectedUserId,
        permission: perm,
        isGranted: null // Removes override
      });
      loadUserOverrides(selectedUserId);
    } catch (err) {
      alert('Failed to remove override: ' + err.message);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      await adminApi.updateUserStatus(userId, !currentStatus);
      setUserList(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentStatus ? 1 : 0 } : u));
    } catch (err) {
      alert('Failed to update user status: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-900" />
        <span>Loading RBAC Authorization Matrix & Security Policies...</span>
      </div>
    );
  }

  const selectedUser = userList.find(u => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Key className="w-5 h-5 text-indigo-700" />
          <span>RBAC & Fine-Grained Policy Studio</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Backend-enforced Role-Based Access Control, individual user overrides, and configurable confidentiality schemas
        </p>
      </div>

      {/* Subtab Navigation */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold max-w-2xl">
        <button
          onClick={() => setActiveSubTab('matrix')}
          className={`flex-1 py-2 px-3 rounded-lg transition ${
            activeSubTab === 'matrix' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          1. Role Permissions Matrix
        </button>
        <button
          onClick={() => setActiveSubTab('overrides')}
          className={`flex-1 py-2 px-3 rounded-lg transition ${
            activeSubTab === 'overrides' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          2. Individual User Overrides
        </button>
        <button
          onClick={() => setActiveSubTab('classifications')}
          className={`flex-1 py-2 px-3 rounded-lg transition ${
            activeSubTab === 'classifications' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          3. Document Classifications
        </button>
        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex-1 py-2 px-3 rounded-lg transition ${
            activeSubTab === 'users' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          4. User Activation
        </button>
      </div>

      {/* SUBTAB 1: ROLE PERMISSION MATRIX */}
      {activeSubTab === 'matrix' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">13 Roles × 13 Permissions Kernel Matrix</h3>
              <p className="text-xs text-slate-500">
                Click any cell toggle to immediately configure backend authorization policy
              </p>
            </div>
            <span className="text-[11px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
              Backend Real-Time Enforced
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-[11px] text-slate-600">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 sticky left-0 bg-slate-50 z-10">Role Name</th>
                  {permissions.map(p => (
                    <th key={p} className="py-2.5 px-2 text-center whitespace-nowrap">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roles.map(role => (
                  <tr key={role} className="hover:bg-slate-50/80 transition">
                    <td className="py-2 px-3 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-100 whitespace-nowrap">
                      {ROLE_LABELS[role] || role}
                      <span className="block text-[9px] font-mono text-slate-400 font-normal">{role}</span>
                    </td>
                    {permissions.map(perm => {
                      const allowed = matrix[role] && matrix[role][perm];
                      const isSuperAdmin = role === 'SUPER_ADMIN';

                      return (
                        <td key={perm} className="py-2 px-2 text-center">
                          <button
                            type="button"
                            disabled={isSuperAdmin}
                            onClick={() => handleTogglePermission(role, perm, allowed)}
                            className={`w-6 h-6 rounded flex items-center justify-center transition mx-auto cursor-pointer ${
                              allowed 
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-2xs' 
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            } ${isSuperAdmin ? 'opacity-80 cursor-not-allowed' : ''}`}
                            title={`${role} - ${perm}: ${allowed ? 'Allowed' : 'Denied'}`}
                          >
                            {allowed ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: INDIVIDUAL USER PERMISSION OVERRIDES */}
      {activeSubTab === 'overrides' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* User Select & Active Overrides */}
          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Select User for Granular Override Configuration
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
              >
                {userList.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} (@{u.username}) — Role: {u.role}
                  </option>
                ))}
              </select>
            </div>

            {selectedUser && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-900">{selectedUser.full_name}</div>
                <div className="text-[11px] text-slate-500">
                  Role: <strong className="text-indigo-800">{selectedUser.role}</strong> • Email: {selectedUser.email}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Active Custom Overrides for Selected User
              </h4>

              {userOverrides.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400">
                  No custom permission overrides active. User inherits standard {selectedUser?.role} defaults.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {userOverrides.map(ov => (
                    <div key={ov.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{ov.permission}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            ov.is_granted === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {ov.is_granted === 1 ? 'EXPLICITLY GRANTED' : 'EXPLICITLY DENIED'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Reason: {ov.reason}</div>
                      </div>

                      <button
                        onClick={() => handleRemoveOverride(ov.permission)}
                        className="text-red-600 hover:text-red-800 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 transition"
                      >
                        Revert to Role Default
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Create New Override Form */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs h-fit space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Grant / Deny User Override
            </h3>

            <form onSubmit={handleSaveOverride} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Permission</label>
                <select
                  value={overridePerm}
                  onChange={(e) => setOverridePerm(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  {permissions.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Override Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium"
                >
                  <option value="1">GRANT (Override Role Default to Allowed)</option>
                  <option value="0">DENY (Override Role Default to Forbidden)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Administrative Justification</label>
                <textarea
                  rows={3}
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Special ministerial authorization for interim audit sign-off"
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={overrideLoading}
                className="w-full bg-blue-900 hover:bg-blue-950 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                {overrideLoading ? 'Applying...' : 'Enforce Individual Override'}
              </button>
            </form>
          </div>

        </div>
      )}

      {/* SUBTAB 3: CONFIGURABLE VISIBILITY CLASSIFICATIONS (Section C) */}
      {activeSubTab === 'classifications' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Configurable Document Visibility Classifications</h3>
            <p className="text-xs text-slate-500">
              System classifications configurable by administrators (Section C)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {classifications.map((c) => (
              <div key={c.code} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {c.code}
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded">
                    Configurable System Class
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900">{c.label}</h4>
                <p className="text-[11px] text-slate-600">{c.description}</p>
                <div className="pt-2 border-t border-slate-200 text-[11px]">
                  <span className="text-slate-400 font-semibold">Allowed Roles:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.default_allowed_roles.map((r) => (
                      <span key={r} className="bg-white border border-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded font-mono">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 4: USER ACTIVATION & STATUS */}
      {activeSubTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Registered User Directory & Status Management</h3>
            <p className="text-xs text-slate-500">Deactivate or reactivate platform accounts</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">User Details</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Institution / Scope</th>
                  <th className="py-3 px-4">MFA State</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userList.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{u.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">@{u.username} • {u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-indigo-900">{u.role}</span>
                    </td>
                    <td className="py-3 px-4">
                      {u.institution_name ? (
                        <div>
                          <div className="font-medium text-slate-900">{u.institution_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.institution_id}</div>
                        </div>
                      ) : (
                        <span className="text-slate-500">{u.region || 'HQ'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {u.mfa_enabled ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                          Enabled
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Disabled</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                        className={`px-3 py-1 rounded text-xs font-semibold transition ${
                          u.is_active
                            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
