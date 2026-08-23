import React, { useState } from 'react';
import { Building, X, Sparkles, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';

interface CreateOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateOrgModal({ isOpen, onClose }: CreateOrgModalProps) {
  const { createOrganization } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (autoSlug) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      await createOrganization(name.trim(), slug.trim() || undefined);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setName('');
        setSlug('');
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">Register New Organization</h2>
            <p className="text-xs text-zinc-400">Spin up a new isolated tenant workspace</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs mb-4">
            {error}
          </div>
        )}

        {success ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h3 className="text-sm font-bold text-zinc-100">Organization Created!</h3>
            <p className="text-xs text-zinc-400">Switching active workspace context...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Organization Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Acme Aerospace Corp"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-orange-500 placeholder:text-zinc-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Tenant Slug (Unique ID)
                </label>
                <button
                  type="button"
                  onClick={() => setAutoSlug(!autoSlug)}
                  className="text-[10px] text-orange-400 hover:underline font-mono"
                >
                  {autoSlug ? 'Customize' : 'Auto-sync'}
                </button>
              </div>
              <input
                type="text"
                required
                value={slug}
                disabled={autoSlug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-aerospace"
                className={`w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-orange-500 placeholder:text-zinc-600 ${
                  autoSlug ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              />
            </div>

            <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/15 text-[11px] text-zinc-400 space-y-1">
              <div className="font-semibold text-orange-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Workspace Isolation
              </div>
              <p>
                You will automatically become the <span className="text-zinc-200 font-bold">OWNER</span> of this organization and receive a starter default project and queues.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-500/20 disabled:opacity-50 transition-all active:scale-95"
              >
                {loading ? 'Creating...' : 'Create & Switch Workspace'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
