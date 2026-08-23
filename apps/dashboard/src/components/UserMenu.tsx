import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  ShieldCheck,
  Building,
  LogOut,
  ChevronUp,
  ChevronDown,
  UserPlus,
  Eye,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { InviteMemberModal } from './InviteMemberModal.js';
import { CreateOrgModal } from './CreateOrgModal.js';

interface UserMenuProps {
  variant?: 'sidebar' | 'header';
  isCollapsed?: boolean;
}

export function UserMenu({ variant = 'sidebar', isCollapsed = false }: UserMenuProps) {
  const { user, isAdmin, orgRole, orgName, orgId, setActiveOrgId, switchPersona, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePreviewToggle = async () => {
    setSwitching(true);
    await switchPersona(isAdmin ? 'member' : 'admin');
    setSwitching(false);
    setDropdownOpen(false);
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

  const isSidebar = variant === 'sidebar';

  return (
    <div className={`relative ${isSidebar && !isCollapsed ? 'w-full' : 'flex justify-center'}`} ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        title={isCollapsed ? `${user?.name} (${isAdmin ? 'ADMIN' : 'MEMBER'})` : undefined}
        className={`flex items-center transition-all text-xs cursor-pointer ${
          isSidebar
            ? isCollapsed
              ? 'w-10 h-10 rounded-xl justify-center p-0 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800'
              : 'w-full p-2.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-850 text-zinc-200 justify-between shadow-sm'
            : 'pl-2 pr-2.5 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-200'
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          {/* Avatar Circle */}
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0 ${
              isAdmin
                ? 'bg-gradient-to-tr from-amber-600 to-orange-500 shadow-orange-500/20'
                : 'bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-blue-500/20'
            }`}
          >
            {getInitials(user?.name)}
          </div>

          {!isCollapsed && (
            <div className="text-left overflow-hidden">
              <div className="font-bold text-[11px] leading-tight truncate">
                {user?.name || 'Authenticated User'}
              </div>
              <div className="text-[10px] font-mono leading-none text-zinc-400 truncate mt-0.5">
                {user?.email || 'developer@codity.ai'}
              </div>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase ${
                isAdmin
                  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                  : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              }`}
            >
              {isAdmin ? 'ADMIN' : 'MEMBER'}
            </span>

            {isSidebar ? (
              dropdownOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div
          className={`absolute ${
            isSidebar
              ? isCollapsed
                ? 'left-full ml-3 bottom-0 w-72'
                : 'bottom-full mb-2 left-0 w-full'
              : 'right-0 mt-2 w-72'
          } rounded-2xl bg-zinc-950 border border-zinc-800 p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 text-xs`}
        >
          {/* User Info Header */}
          <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 mb-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold text-white shrink-0 ${
                  isAdmin
                    ? 'bg-gradient-to-tr from-amber-600 to-orange-500'
                    : 'bg-gradient-to-tr from-blue-600 to-indigo-500'
                }`}
              >
                {getInitials(user?.name)}
              </div>
              <div className="overflow-hidden">
                <div className="font-bold text-zinc-100 truncate">{user?.name || 'Authenticated User'}</div>
                <div className="text-[11px] text-zinc-400 truncate">{user?.email || 'developer@codity.ai'}</div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
              <span className="flex items-center gap-1 truncate">
                <Building className="w-3 h-3 text-zinc-500 shrink-0" /> {orgName}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                  isAdmin ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                {orgRole} ({user?.role || 'USER'})
              </span>
            </div>
          </div>

          {/* Admin Management Section */}
          {isAdmin && (
            <div className="mb-2 p-2 rounded-xl bg-orange-500/5 border border-orange-500/15 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1 px-1 mb-1">
                <ShieldCheck className="w-3 h-3" /> Organization Admin
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  setInviteModalOpen(true);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold text-zinc-200 hover:bg-orange-500/20 hover:text-orange-300 flex items-center gap-2 transition-all"
              >
                <UserPlus className="w-3.5 h-3.5 text-orange-400" />
                <span>Invite / Provision Member</span>
              </button>

              <button
                type="button"
                onClick={handlePreviewToggle}
                disabled={switching}
                className="w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 flex items-center justify-between transition-all"
              >
                <span className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Preview Member View</span>
                </span>
                <span className="text-[9px] text-zinc-500 font-mono">Simulate</span>
              </button>
            </div>
          )}

          {/* Regular Member RBAC Note */}
          {!isAdmin && (
            <div className="mb-2 p-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/15 text-[11px] text-zinc-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-indigo-400 text-[10px] uppercase tracking-wider">
                <User className="w-3 h-3" /> Member Access
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                Standard developer role scoped to {orgName}. Role managed by organization admin.
              </p>
            </div>
          )}

          {/* Multi-Org Switcher if multiple memberships */}
          {user?.memberships && user.memberships.length > 1 && (
            <div className="mb-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1 mb-1">
                Switch Organization
              </div>
              {user.memberships.map((m) => (
                <button
                  key={m.organization.id}
                  onClick={() => {
                    setActiveOrgId(m.organization.id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-2 py-1.5 rounded-lg text-left text-[11px] flex items-center justify-between transition-all ${
                    m.organization.id === orgId
                      ? 'bg-orange-500/20 text-orange-300 font-bold'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate">{m.organization.name}</span>
                  <span className="text-[9px] font-mono uppercase text-zinc-500">{m.role}</span>
                </button>
              ))}
            </div>
          )}

          {/* Register Organization Action */}
          <div className="mb-1">
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                setCreateOrgModalOpen(true);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-orange-400 flex items-center gap-2 transition-all"
            >
              <Building className="w-3.5 h-3.5 text-orange-400" />
              <span>Register New Organization</span>
            </button>
          </div>

          {/* Actions */}
          <div className="space-y-1 pt-1 border-t border-zinc-800/80">
            <button
              onClick={() => {
                logout();
                setDropdownOpen(false);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors text-[11px] font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <InviteMemberModal isOpen={inviteModalOpen} onClose={() => setInviteModalOpen(false)} />
      <CreateOrgModal isOpen={createOrgModalOpen} onClose={() => setCreateOrgModalOpen(false)} />
    </div>
  );
}


