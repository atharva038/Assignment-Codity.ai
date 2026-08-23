import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  UserPlus,
  Mail,
  User,
  ShieldCheck,
  CheckCircle2,
  Copy,
  AlertCircle,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  Cpu,
  AlertOctagon,
  Lock,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PermissionOption {
  id: string;
  name: string;
  desc: string;
  category: 'execution' | 'cluster' | 'dlq' | 'governance';
}

const ALL_PERMISSIONS: PermissionOption[] = [
  // Execution
  { id: 'jobs:create', name: 'Submit & Enqueue Jobs', desc: 'Ingest payload tasks into Redis/Postgres queues', category: 'execution' },
  { id: 'jobs:cancel', name: 'Abort & Cancel Jobs', desc: 'Send abort signal to active workers', category: 'execution' },
  { id: 'workflows:trigger', name: 'Trigger DAG Workflows', desc: 'Execute multi-step dependency DAG pipelines', category: 'execution' },
  // Cluster
  { id: 'cluster:scale', name: 'Scale Worker Fleet', desc: 'Spawn/terminate worker thread pool processes', category: 'cluster' },
  { id: 'cluster:drain', name: 'Drain & Stop Nodes', desc: 'Gracefully shutdown and evict worker tasks', category: 'cluster' },
  { id: 'sharding:manage', name: 'Queue Sharding Rings', desc: 'Configure virtual node hash distribution', category: 'cluster' },
  // DLQ
  { id: 'dlq:replay', name: 'Replay Dead Letter Jobs', desc: 'Re-enqueue exhausted tasks after bug resolution', category: 'dlq' },
  { id: 'dlq:purge', name: 'Purge DLQ Records', desc: 'Permanent destructive cleanup of dead jobs', category: 'dlq' },
  // Governance
  { id: 'users:invite', name: 'Provision Team Members', desc: 'Create new organization user accounts', category: 'governance' },
  { id: 'users:manage', name: 'Modify RBAC Permissions', desc: 'Promote/demote roles and security privileges', category: 'governance' },
];

const DEFAULT_MEMBER_PERMS = ['jobs:create', 'jobs:cancel', 'workflows:trigger'];
const DEFAULT_ADMIN_PERMS = ALL_PERMISSIONS.map((p) => p.id);

export function InviteMemberModal({ isOpen, onClose }: InviteMemberModalProps) {
  const { inviteMember, orgName } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(DEFAULT_MEMBER_PERMS);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ message: string; email: string; permissions: string[]; tempPass?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleRolePreset = (newRole: 'MEMBER' | 'ADMIN') => {
    setRole(newRole);
    if (newRole === 'ADMIN') {
      setSelectedPermissions(DEFAULT_ADMIN_PERMS);
    } else {
      setSelectedPermissions(DEFAULT_MEMBER_PERMS);
    }
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) => {
      const next = prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId];
      // Automatically adjust role indicator if user checks admin-level permissions
      const hasAdmin = next.some((p) => ['cluster:scale', 'cluster:drain', 'sharding:manage', 'dlq:purge', 'users:manage'].includes(p));
      if (hasAdmin && role !== 'ADMIN') setRole('ADMIN');
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedPermissions.length === ALL_PERMISSIONS.length) {
      setSelectedPermissions(DEFAULT_MEMBER_PERMS);
      setRole('MEMBER');
    } else {
      setSelectedPermissions(DEFAULT_ADMIN_PERMS);
      setRole('ADMIN');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await inviteMember({
        email: email.trim(),
        name: name.trim() || undefined,
        role,
        permissions: selectedPermissions,
        password: password.trim() || undefined,
      });

      setSuccessData({
        message: res.message,
        email: email.trim(),
        permissions: selectedPermissions,
        tempPass: res.temporaryPassword || password || 'Welcome2026!',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to provision team member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!successData) return;
    const text = `Distributed Job Scheduler Access Credentials:
Organization: ${orgName}
Email: ${successData.email}
Password: ${successData.tempPass}
Role: ${role === 'ADMIN' ? 'Lead Architect (Admin)' : 'Developer (Member)'}
Granted Permissions: ${selectedPermissions.join(', ')}
Login URL: http://localhost:5173`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetAndClose = () => {
    setEmail('');
    setName('');
    setPassword('');
    setRole('MEMBER');
    setSelectedPermissions(DEFAULT_MEMBER_PERMS);
    setError(null);
    setSuccessData(null);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center border border-orange-500/30">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-zinc-100">Provision Team Member & RBAC Scope</h3>
              <p className="text-[11px] text-zinc-400">Configure credentials & granular capabilities under {orgName}</p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success State */}
        {successData ? (
          <div className="space-y-4 py-2 overflow-y-auto">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Member Provisioned with Custom RBAC Scope!</span>
              </div>
              <p className="text-xs text-emerald-300/90">{successData.message}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 text-xs font-mono">
              <div className="text-zinc-400 text-[11px]">Login Credentials:</div>
              <div className="text-zinc-200">
                <span className="text-zinc-500">Email:</span> {successData.email}
              </div>
              <div className="text-zinc-200">
                <span className="text-zinc-500">Temp Password:</span> {successData.tempPass}
              </div>
              <div className="text-zinc-200">
                <span className="text-zinc-500">Assigned Role:</span>{' '}
                <span className={role === 'ADMIN' ? 'text-orange-400 font-bold' : 'text-indigo-400 font-bold'}>
                  {role}
                </span>
              </div>
              <div className="pt-2 border-t border-zinc-800/80">
                <span className="text-zinc-500 block mb-1">Active Permissions ({selectedPermissions.length}):</span>
                <div className="flex flex-wrap gap-1">
                  {selectedPermissions.map((p) => (
                    <span key={p} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px]">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied to Clipboard!' : 'Copy Credentials'}
              </button>
              <button
                type="button"
                onClick={handleResetAndClose}
                className="py-2 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Invite Form */
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="e.g. Alex Chen"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Work Email *</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="email"
                    required
                    placeholder="alex@codity.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Role Preset Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-zinc-300">Base Role Template</label>
                <span className="text-[10px] text-zinc-500 font-mono">Select preset or customize below</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleRolePreset('MEMBER')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    role === 'MEMBER'
                      ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Developer (Member)</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Execution & telemetry scope</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleRolePreset('ADMIN')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    role === 'ADMIN'
                      ? 'border-orange-500/60 bg-orange-500/10 text-orange-300'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                    <span>Lead Architect (Admin)</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Full cluster & node governance</p>
                </button>
              </div>
            </div>

            {/* Granular Permissions Section */}
            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange-400" />
                  Granular Permission Matrix ({selectedPermissions.length} granted)
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[10px] font-mono text-orange-400 hover:text-orange-300 hover:underline"
                >
                  {selectedPermissions.length === ALL_PERMISSIONS.length ? 'Reset to Defaults' : 'Select All (Full Admin)'}
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {ALL_PERMISSIONS.map((perm) => {
                  const isChecked = selectedPermissions.includes(perm.id);
                  const isDangerous = ['cluster:scale', 'cluster:drain', 'sharding:manage', 'dlq:purge', 'users:manage'].includes(perm.id);

                  return (
                    <div
                      key={perm.id}
                      onClick={() => togglePermission(perm.id)}
                      className={`p-2 rounded-lg border text-xs flex items-start justify-between gap-2.5 cursor-pointer transition-all ${
                        isChecked
                          ? isDangerous
                            ? 'border-orange-500/30 bg-orange-500/10 text-zinc-100'
                            : 'border-indigo-500/30 bg-indigo-500/10 text-zinc-100'
                          : 'border-zinc-850 bg-zinc-950/40 text-zinc-500 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isChecked ? (
                          <CheckSquare className={`w-4 h-4 mt-0.5 shrink-0 ${isDangerous ? 'text-orange-400' : 'text-indigo-400'}`} />
                        ) : (
                          <Square className="w-4 h-4 mt-0.5 shrink-0 text-zinc-600" />
                        )}
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{perm.name}</span>
                            <span className="text-[9px] font-mono text-zinc-500">({perm.id})</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">{perm.desc}</p>
                        </div>
                      </div>

                      {isDangerous && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-orange-500/20 text-orange-400 shrink-0">
                          Admin
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Temporary Password <span className="text-zinc-500 font-normal">(Optional, defaults to Welcome2026!)</span>
              </label>
              <input
                type="text"
                placeholder="Welcome2026!"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800/80 shrink-0">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-3 py-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !email || selectedPermissions.length === 0}
                className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {submitting ? 'Provisioning...' : `Provision Member (${selectedPermissions.length} Perms)`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
