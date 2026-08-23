import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Mail, User, Shield, ShieldCheck, CheckCircle2, Copy, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteMemberModal({ isOpen, onClose }: InviteMemberModalProps) {
  const { inviteMember, orgName } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ message: string; email: string; tempPass?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await inviteMember({
        email: email.trim(),
        name: name.trim() || undefined,
        role,
        password: password.trim() || undefined,
      });

      setSuccessData({
        message: res.message,
        email: email.trim(),
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
    setError(null);
    setSuccessData(null);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center border border-orange-500/30">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-zinc-100">Provision Team Member</h3>
              <p className="text-[11px] text-zinc-400">Add user to {orgName}</p>
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
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Member Provisioned Successfully!</span>
              </div>
              <p className="text-xs text-emerald-300/90">{successData.message}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 text-xs font-mono">
              <div className="text-zinc-400 text-[11px]">Login Credentials to Share:</div>
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
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

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

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5">Assigned RBAC Role</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('MEMBER')}
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
                  <p className="text-[10px] text-zinc-500 mt-1">Submit jobs, run workflows & monitor logs</p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('ADMIN')}
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
                  <p className="text-[10px] text-zinc-500 mt-1">Full control, worker scaling & DLQ purges</p>
                </button>
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

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-3 py-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !email}
                className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {submitting ? 'Provisioning...' : 'Provision Member'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

