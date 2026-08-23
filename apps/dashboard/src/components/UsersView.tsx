import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  User,
  Shield,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Key,
  Layers,
  Cpu,
  AlertOctagon,
  Split,
  Sparkles,
  Search,
  ChevronDown,
  Building,
  Plus,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { InviteMemberModal } from './InviteMemberModal.js';
import { CreateOrgModal } from './CreateOrgModal.js';

interface MemberItem {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  permissions?: string[];
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'USER';
    createdAt: string;
  };
}

export function UsersView() {
  const { user: currentUser, isAdmin, orgName, orgId, setActiveOrgId, fetchMembers, updateMemberRole, removeMember } = useAuth();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadMembers = useCallback(async () => {
    if (!orgId) return;
    try {
      setRefreshing(true);
      const data = await fetchMembers();
      setMembers(data);
    } catch (err: any) {
      console.error('Failed to load members:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load team members' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchMembers, orgId]);

  useEffect(() => {
    loadMembers();
  }, [orgId, loadMembers]);

  const handleRoleChange = async (userId: string, newRole: 'MEMBER' | 'ADMIN' | 'OWNER') => {
    setActionLoadingId(userId);
    setFeedback(null);
    try {
      const res = await updateMemberRole(userId, newRole);
      setFeedback({ type: 'success', message: res.message || `Updated role to ${newRole}` });
      await loadMembers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update user role' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveUser = async (userId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to revoke access for ${email}?`)) {
      return;
    }
    setActionLoadingId(userId);
    setFeedback(null);
    try {
      const res = await removeMember(userId);
      setFeedback({ type: 'success', message: res.message || `Revoked access for ${email}` });
      await loadMembers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to revoke user access' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'US';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredMembers = members.filter((m) => {
    const query = searchQuery.toLowerCase();
    return (
      m.user.name?.toLowerCase().includes(query) ||
      m.user.email?.toLowerCase().includes(query) ||
      m.role.toLowerCase().includes(query)
    );
  });

  const totalMembers = members.length;
  const adminCount = members.filter((m) => m.role === 'ADMIN' || m.role === 'OWNER').length;
  const memberCount = members.filter((m) => m.role === 'MEMBER').length;

  const permissionsMatrix = [
    {
      category: 'Job & Workflow Execution',
      actions: [
        { name: 'Submit & Enqueue Jobs', member: true, admin: true, desc: 'Add payload to Redis/Postgres shards' },
        { name: 'Trigger Multi-Step Workflows (DAGs)', member: true, admin: true, desc: 'Evaluate dependencies and schedule children' },
        { name: 'View Job Telemetry & Execution Logs', member: true, admin: true, desc: 'Inspect stdout, error traces, and retries' },
        { name: 'Cancel Running Jobs', member: true, admin: true, desc: 'Send abort signal to worker threads' },
      ],
    },
    {
      category: 'Cluster & Fleet Controls',
      actions: [
        { name: 'Scale Worker Fleet (Dynamic Capacity)', member: false, admin: true, desc: 'Spawn/terminate child worker processes' },
        { name: 'Drain & Terminate Worker Nodes', member: false, admin: true, desc: 'Graceful shutdown during node deployment' },
        { name: 'Queue Sharding & Rebalancing', member: false, admin: true, desc: 'Configure consistent hash ring parameters' },
      ],
    },
    {
      category: 'Dead Letter Queue (DLQ) & Recovery',
      actions: [
        { name: 'Inspect Failed DLQ Payloads', member: true, admin: true, desc: 'Examine stack traces and failure diagnostics' },
        { name: 'Replay Dead Jobs to Active Queue', member: false, admin: true, desc: 'Re-enqueue exhausted jobs after bug fixes' },
        { name: 'Purge / Delete DLQ Records', member: false, admin: true, desc: 'Permanent destructive cleanup of dead jobs' },
      ],
    },
    {
      category: 'Security & Team Governance',
      actions: [
        { name: 'Provision & Invite Team Members', member: false, admin: true, desc: 'Create accounts with assigned RBAC roles' },
        { name: 'Modify Member RBAC Permissions', member: false, admin: true, desc: 'Promote or demote organization roles' },
        { name: 'Revoke User Access & Sessions', member: false, admin: true, desc: 'Delete membership and invalidate tokens' },
      ],
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase">
              RBAC Governance
            </span>
            <span className="text-zinc-500 text-xs font-mono">• {orgName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-orange-500" />
            Users & Access Control
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Provision organization members, assign granular RBAC roles, and govern distributed cluster permissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {currentUser?.memberships && currentUser.memberships.length > 1 && (
            <select
              value={orgId}
              onChange={(e) => setActiveOrgId(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-orange-500"
            >
              {currentUser.memberships.map((m) => (
                <option key={m.organization.id} value={m.organization.id}>
                  🏢 {m.organization.name} ({m.role})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={loadMembers}
            disabled={refreshing}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-colors"
            title="Refresh member roster"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-orange-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setCreateOrgModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-200 text-xs font-bold flex items-center gap-2 transition-all active:scale-95"
          >
            <Building className="w-3.5 h-3.5 text-orange-400" />
            <span>Register Org</span>
          </button>

          <button
            onClick={() => setInviteModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Provision New User</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[11px] font-mono hover:underline text-zinc-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
            <span>Total Roster</span>
            <Users className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-extrabold text-zinc-100">{totalMembers}</div>
          <div className="text-[11px] text-zinc-500">Active organization members</div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-orange-400 text-xs font-semibold">
            <span>Lead Architects (Admin)</span>
            <ShieldCheck className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-extrabold text-orange-400">{adminCount}</div>
          <div className="text-[11px] text-zinc-500">Full cluster & node governance</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950/80 border border-stone-200 dark:border-zinc-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
            <span>Developers (Member)</span>
            <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{memberCount}</div>
          <div className="text-[11px] text-stone-500 dark:text-zinc-500">Task submission & workflow execution</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950/80 border border-stone-200 dark:border-zinc-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <span>Enforcement Engine</span>
            <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">Strict RBAC</div>
          <div className="text-[11px] text-stone-500 dark:text-zinc-500">API Gateway & token validation active</div>
        </div>
      </div>

      {/* Main Roster Section */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950/80 border border-stone-200 dark:border-zinc-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-500" />
              Organization Team Roster
            </h2>
            <p className="text-[11px] text-stone-500 dark:text-zinc-400">
              Users provisioned under {orgName} with explicit permission scopes.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 text-stone-900 dark:text-zinc-100 text-xs focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        {/* Member Table */}
        <div className="overflow-x-auto border border-stone-200 dark:border-zinc-800/80 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-100/90 dark:bg-zinc-900/80 text-stone-600 dark:text-zinc-400 font-mono text-[11px] border-b border-stone-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">RBAC Role</th>
                <th className="px-4 py-3">Allowed Capabilities</th>
                <th className="px-4 py-3">Joined Date</th>
                {isAdmin && <th className="px-4 py-3 text-right">Admin Controls</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-stone-500 dark:text-zinc-500 font-mono">
                    Loading team roster...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-stone-500 dark:text-zinc-500 font-mono">
                    No team members found matching your search.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  const isCurrent = currentUser?.id === m.user.id;
                  const isMemberAdmin = m.role === 'ADMIN' || m.role === 'OWNER';
                  const isOwner = m.role === 'OWNER';

                  return (
                    <tr key={m.id} className="hover:bg-stone-50 dark:hover:bg-zinc-900/40 transition-colors">
                      {/* Member Info */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs text-white shadow-sm shrink-0 ${
                              isMemberAdmin
                                ? 'bg-gradient-to-tr from-amber-600 to-orange-500 shadow-orange-500/20'
                                : 'bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-blue-500/20'
                            }`}
                          >
                            {getInitials(m.user.name)}
                          </div>
                          <div>
                            <div className="font-bold text-stone-900 dark:text-zinc-200 flex items-center gap-1.5">
                              <span>{m.user.name || 'Unnamed User'}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-600 dark:text-orange-400 font-mono font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-stone-500 dark:text-zinc-400">{m.user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* RBAC Role */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            isOwner
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              : isMemberAdmin
                              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
                              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                          }`}
                        >
                          {isOwner ? (
                            <ShieldCheck className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          ) : isMemberAdmin ? (
                            <ShieldCheck className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                          ) : (
                            <User className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          )}
                          {m.role}
                        </span>
                      </td>

                      {/* Capabilities Chips */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {m.permissions && m.permissions.length > 0 ? (
                            <>
                              {m.permissions.slice(0, 3).map((p) => (
                                <span
                                  key={p}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                    ['cluster:scale', 'cluster:drain', 'dlq:purge', 'sharding:manage', 'users:manage'].includes(p)
                                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-300 border border-orange-500/20'
                                      : 'bg-stone-100 dark:bg-zinc-800/80 text-stone-700 dark:text-zinc-300 border border-stone-200 dark:border-zinc-750'
                                  }`}
                                >
                                  {p}
                                </span>
                              ))}
                              {m.permissions.length > 3 && (
                                <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[10px] font-mono font-bold">
                                  +{m.permissions.length - 3} more
                                </span>
                              )}
                            </>
                          ) : isMemberAdmin ? (
                            <>
                              <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-300 border border-orange-500/20 text-[10px]">
                                Full Cluster Admin
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 text-[10px] border border-stone-200 dark:border-zinc-700">
                                DLQ Replay & Purge
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[10px]">
                                Submit Jobs
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 text-[10px] border border-stone-200 dark:border-zinc-700">
                                DAG Workflows
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">
                        {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'Active'}
                      </td>

                      {/* Admin Controls */}
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Role Switcher */}
                            {!isOwner && (
                              <select
                                value={m.role}
                                disabled={actionLoadingId === m.user.id}
                                onChange={(e) =>
                                  handleRoleChange(m.user.id, e.target.value as 'MEMBER' | 'ADMIN')
                                }
                                className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 font-semibold focus:outline-none focus:border-orange-500"
                              >
                                <option value="MEMBER">Member (Developer)</option>
                                <option value="ADMIN">Admin (Lead Architect)</option>
                              </select>
                            )}

                            {/* Revoke Button */}
                            {!isOwner && !isCurrent && (
                              <button
                                onClick={() => handleRemoveUser(m.user.id, m.user.email)}
                                disabled={actionLoadingId === m.user.id}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                title="Revoke member access"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Matrix / Controlled Environment Breakdown */}
      <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-orange-500" />
            Distributed RBAC Security Matrix & Capability Map
          </h2>
          <p className="text-[11px] text-zinc-400">
            Enforced at the API Gateway, Worker Executor, and PostgreSQL transaction layers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {permissionsMatrix.map((section, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="text-xs font-bold text-orange-400 uppercase tracking-wider font-mono">
                {section.category}
              </div>

              <div className="space-y-2">
                {section.actions.map((act, aIdx) => (
                  <div
                    key={aIdx}
                    className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-850 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-zinc-200">{act.name}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{act.desc}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                          act.member
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-500 line-through'
                        }`}
                      >
                        MEMBER
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                          act.admin
                            ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                            : 'bg-zinc-800 text-zinc-500 line-through'
                        }`}
                      >
                        ADMIN
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      <InviteMemberModal
        isOpen={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          loadMembers();
        }}
      />

      {/* Register Organization Modal */}
      <CreateOrgModal
        isOpen={createOrgModalOpen}
        onClose={() => {
          setCreateOrgModalOpen(false);
          loadMembers();
        }}
      />
    </div>
  );
}
