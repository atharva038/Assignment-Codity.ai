import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  Building,
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Sun,
  Moon,
  CheckCircle2,
  Cpu,
  Layers,
  Zap,
} from 'lucide-react';
import { PersonaType } from '../hooks/useAuth.js';

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onRegister: (email: string, password: string, name: string, orgName?: string) => Promise<boolean>;
  onQuickPersona: (persona: PersonaType) => Promise<boolean>;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function AuthScreen({
  onLogin,
  onRegister,
  onQuickPersona,
  isDark,
  onToggleTheme,
}: AuthScreenProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    try {
      if (tab === 'login') {
        const success = await onLogin(email, password);
        if (!success) {
          setFormError('Invalid email or password credentials');
        }
      } else {
        if (!name.trim()) {
          setFormError('Full name is required');
          setLoading(false);
          return;
        }
        const success = await onRegister(email, password, name, orgName || undefined);
        if (!success) {
          setFormError('Registration failed. Email may already be registered.');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaClick = async (persona: PersonaType) => {
    setLoading(true);
    setFormError(null);
    try {
      const success = await onQuickPersona(persona);
      if (!success) {
        setFormError('Failed to sign in as persona');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error signing in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-black text-zinc-100' : 'light bg-[#FDFBF7] text-stone-900'} flex flex-col justify-between antialiased transition-colors duration-200`}>
      {/* Top Navbar */}
      <header className={`px-6 py-4 flex items-center justify-between border-b ${isDark ? 'border-zinc-800/80 bg-black/60' : 'border-[#E7E2D9] bg-[#FDFBF7]/80'} backdrop-blur-md sticky top-0 z-10`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-600 to-orange-500 shadow-md shadow-orange-500/20 text-white font-extrabold text-sm flex items-center justify-center tracking-wider">
            JS
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight">Distributed Job Scheduler</h1>
            <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Authentication & Access Portal</p>
          </div>
        </div>

        <button
          onClick={onToggleTheme}
          className={`p-2 rounded-full border transition-all ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-orange-400 hover:bg-zinc-800'
              : 'bg-zinc-100 border-zinc-300 text-orange-600 hover:bg-zinc-200'
          }`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-lg space-y-6">
          {/* Hero Branding */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
              <Zap className="w-3.5 h-3.5" /> High-Concurrency Distributed Engine
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Sign In to Your Workspace
            </h2>
            <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-stone-600'} max-w-md mx-auto`}>
              Log in to monitor distributed queues, inspect worker fleets, manage DAG pipelines, and configure execution policies.
            </p>
          </div>

          {/* 1-Click Persona Sign-In Card */}
          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-white border-[#E7E2D9]'} shadow-xl space-y-3`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> 1-Click Demo Personas (Viva & Evaluation)
              </span>
              <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-stone-400'}`}>Instant Setup</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Admin Persona */}
              <button
                type="button"
                onClick={() => handlePersonaClick('admin')}
                disabled={loading}
                className="p-3.5 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-left transition-all group disabled:opacity-50 active:scale-98"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-orange-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-orange-500" /> Lead Architect
                  </span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold">
                    ADMIN
                  </span>
                </div>
                <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Full control: queue pause/resume, DLQ replay, rate limit tuning.
                </p>
              </button>

              {/* Member Persona */}
              <button
                type="button"
                onClick={() => handlePersonaClick('member')}
                disabled={loading}
                className={`p-3.5 rounded-xl border ${isDark ? 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900' : 'border-stone-200 bg-stone-50 hover:bg-stone-100'} text-left transition-all group disabled:opacity-50 active:scale-98`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-extrabold ${isDark ? 'text-indigo-400' : 'text-indigo-600'} flex items-center gap-1.5`}>
                    <User className="w-4 h-4 text-indigo-500" /> Developer
                  </span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold">
                    MEMBER
                  </span>
                </div>
                <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  Restricted RBAC: job submission, DAG viewer, telemetry inspection.
                </p>
              </button>
            </div>
          </div>

          {/* Manual Auth Form Card */}
          <div className={`p-6 rounded-2xl border ${isDark ? 'bg-zinc-950/90 border-zinc-800' : 'bg-white border-[#E7E2D9]'} shadow-xl space-y-4`}>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Sign In with Credentials
              </h3>
              <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-stone-500'} mt-0.5`}>
                Enter your work email and assigned password.
              </p>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="architect@codity.ai"
                    className={`w-full ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-stone-50 border-stone-300 text-stone-900'} border rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-orange-500`}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold block mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-stone-50 border-stone-300 text-stone-900'} border rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-orange-500`}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : 'Sign In to Workspace'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            <div className={`pt-3 border-t ${isDark ? 'border-zinc-800/80 text-zinc-500' : 'border-stone-200 text-stone-500'} text-[11px] text-center`}>
              <span>New team member? Accounts are provisioned directly by your Organization Admin.</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={`px-6 py-4 text-center border-t ${isDark ? 'border-zinc-800/60 text-zinc-500' : 'border-[#E7E2D9] text-stone-400'} text-[11px] font-mono`}>
        Distributed Job Scheduler — PostgreSQL 16 · Redis 7 · Node.js Worker Fleet
      </footer>
    </div>
  );
}
