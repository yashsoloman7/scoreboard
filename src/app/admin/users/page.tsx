'use client';

// src/app/admin/users/page.tsx - Super Admin & Admin User Role Authorization Portal
import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { getUsersWithRoles, grantUserRole, revokeUserRole, createUserWithRole } from '@/actions/users';
import { UserProfile, AppRole } from '@/types';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { 
  Users, 
  ShieldCheck, 
  UserPlus, 
  ShieldAlert, 
  CheckCircle2, 
  Search, 
  ArrowLeft,
  X,
  PlusCircle,
  Save,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Add User Modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addForm, setAddForm] = useState<{ email: string; fullName: string; role: AppRole }>({
    email: '',
    fullName: '',
    role: 'event_manager',
  });
  const [isAdding, setIsAdding] = useState(false);

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Yes, Proceed',
    variant: 'primary',
    action: async () => {},
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsersWithRoles();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChangeRequest = (user: UserProfile, newRole: AppRole) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Role Change',
      message: `Are you sure you want to change the role of "${user.fullName || user.email}" to "${newRole.replace('_', ' ').toUpperCase()}"?`,
      confirmLabel: `Yes, Grant ${newRole.replace('_', ' ')}`,
      variant: newRole === 'admin' || newRole === 'super_admin' ? 'warning' : 'primary',
      action: async () => {
        await grantUserRole(user.id, newRole);
        setActionMessage(`Successfully updated role for ${user.fullName || user.email} to ${newRole}`);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        await loadUsers();
      },
    });
  };

  const handleRevokeRoleRequest = (user: UserProfile) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Role Revocation',
      message: `Are you sure you want to revoke all access permissions for "${user.fullName || user.email}"?`,
      confirmLabel: 'Yes, Revoke Access',
      variant: 'danger',
      action: async () => {
        await revokeUserRole(user.id);
        setActionMessage(`Successfully revoked permissions for ${user.fullName || user.email}`);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        await loadUsers();
      },
    });
  };

  const handleCreateUser = async () => {
    if (!addForm.email.trim()) return;
    setIsAdding(true);
    try {
      await createUserWithRole(addForm.email, addForm.fullName, addForm.role);
      setActionMessage(`Successfully added ${addForm.fullName || addForm.email} as ${addForm.role.replace('_', ' ')}`);
      setIsAddUserOpen(false);
      setAddForm({ email: '', fullName: '', role: 'event_manager' });
      await loadUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setIsAdding(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: AppRole) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'admin':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'event_manager':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'event_operator':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'judge':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'public_viewer':
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
              <ShieldCheck className="w-7 h-7 text-cyan-400" />
              <span>User & Role Authorization</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Super Admin Control: Directly assign Admins, Event Managers, Judges, and Operators.
            </p>
          </div>

          <button
            onClick={() => setIsAddUserOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-950 transition-all cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Admin / Manager</span>
          </button>
        </div>

        {actionMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between font-bold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{actionMessage}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-emerald-400 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Filters & Search */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-400 font-bold shrink-0">Filter Role:</span>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Roles ({users.length})</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="event_manager">Event Manager</option>
              <option value="event_operator">Event Operator</option>
              <option value="judge">Judge</option>
              <option value="public_viewer">Public Viewer</option>
              <option value="unauthorized">Unauthorized</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-extrabold">
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Current Role</th>
                  <th className="py-3.5 px-4 text-center">Assign Role</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">Loading user registry...</td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">No users found matching query.</td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-950/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">{u.fullName || 'No Name'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${getRoleBadge(u.role)}`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChangeRequest(u, e.target.value as AppRole)}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 hover:border-cyan-500 rounded-xl text-xs font-bold text-cyan-300 focus:outline-none cursor-pointer"
                        >
                          <option value="super_admin">Super Admin</option>
                          <option value="admin">Admin</option>
                          <option value="event_manager">Event Manager</option>
                          <option value="event_operator">Event Operator</option>
                          <option value="judge">Judge</option>
                          <option value="public_viewer">Public Viewer</option>
                          <option value="unauthorized">Unauthorized</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {u.role !== 'unauthorized' && (
                          <button
                            onClick={() => handleRevokeRoleRequest(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Revoke Role Access"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                Add & Authorize User Role
              </h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Email Address *</label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="manager@example.com"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Full Name</label>
                <input
                  type="text"
                  value={addForm.fullName}
                  onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Assigned Role</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value as AppRole })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500"
                >
                  <option value="event_manager">Event Manager (Stage Controls & Staging)</option>
                  <option value="admin">Admin (Events, Scrutiny & Overrides)</option>
                  <option value="super_admin">Super Admin (Full System Privileges)</option>
                  <option value="event_operator">Event Operator (Timer & Queue)</option>
                  <option value="judge">Judge (Touch Scoring Portal)</option>
                  <option value="public_viewer">Public Viewer</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateUser}
                disabled={isAdding || !addForm.email.trim()}
                className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isAdding ? 'Authorizing...' : 'Save & Authorize'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
