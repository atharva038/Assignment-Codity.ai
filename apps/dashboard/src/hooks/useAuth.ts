import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { fetchApi, setAuthToken, getAuthToken } from '../services/api.js';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  createdAt?: string;
  memberships?: Array<{
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    organization: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
}

export type PersonaType = 'admin' | 'member';

const PERSONAS: Record<PersonaType, { email: string; name: string; role: 'ADMIN' | 'USER'; orgName: string }> = {
  admin: {
    email: 'admin@codity.ai',
    name: 'Lead Architect (Admin)',
    role: 'ADMIN',
    orgName: 'Codity Corporation',
  },
  member: {
    email: 'developer@codity.ai',
    name: 'Backend Engineer (Member)',
    role: 'USER',
    orgName: 'Codity Corporation',
  },
};

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, organizationName?: string) => Promise<boolean>;
  switchPersona: (persona: PersonaType) => Promise<boolean>;
  inviteMember: (data: { email: string; name?: string; role: 'MEMBER' | 'ADMIN'; permissions?: string[]; password?: string }) => Promise<any>;
  fetchMembers: () => Promise<any[]>;
  updateMemberRole: (userId: string, role: 'MEMBER' | 'ADMIN' | 'OWNER', permissions?: string[]) => Promise<any>;
  removeMember: (userId: string) => Promise<any>;
  logout: () => void;
  fetchProfile: () => Promise<void>;
  isAdmin: boolean;
  orgRole: string;
  orgName: string;
  orgId: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetchApi<{ user: UserProfile }>('/auth/me');
      if (res.user) {
        setUser(res.user);
      }
    } catch (err: any) {
      console.warn('Failed to load profile, session cleared:', err.message);
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(body.message || 'Invalid email or password');
      }

      const data = await res.json();
      setAuthToken(data.token);
      await fetchProfile();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    organizationName?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          organizationName: organizationName || 'My Organization',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Registration failed' }));
        throw new Error(body.message || 'Registration failed');
      }

      const data = await res.json();
      setAuthToken(data.token);
      await fetchProfile();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const switchPersona = async (persona: PersonaType): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const target = PERSONAS[persona];
    try {
      const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target.email, password: 'password123' }),
      });

      if (loginRes.ok) {
        const data = await loginRes.json();
        setAuthToken(data.token);
        await fetchProfile();
        return true;
      }

      const regRes = await fetch('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: target.email,
          password: 'password123',
          name: target.name,
          organizationName: target.orgName,
        }),
      });

      if (regRes.ok) {
        const data = await regRes.json();
        setAuthToken(data.token);
        await fetchProfile();
        return true;
      }

      return false;
    } catch (err: any) {
      console.error('Persona switch error:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  const isAuthenticated = !!user;
  const orgRole = user?.memberships?.[0]?.role || 'MEMBER';
  const isAdmin = user?.role === 'ADMIN' || orgRole === 'OWNER' || orgRole === 'ADMIN';
  const orgName = user?.memberships?.[0]?.organization.name || 'Default Organization';
  const orgId = user?.memberships?.[0]?.organization.id || '';


  const inviteMember = useCallback(async (data: { email: string; name?: string; role: 'MEMBER' | 'ADMIN'; permissions?: string[]; password?: string }) => {
    if (!orgId) throw new Error('No active organization found');
    return fetchApi<{ message: string; member: any; temporaryPassword?: string }>(
      `/organizations/${orgId}/members`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }, [orgId]);

  const fetchMembers = useCallback(async () => {
    if (!orgId) return [];
    const res = await fetchApi<{ members: any[] }>(`/organizations/${orgId}/members`);
    return res.members || [];
  }, [orgId]);

  const updateMemberRole = useCallback(async (userId: string, role: 'MEMBER' | 'ADMIN' | 'OWNER', permissions?: string[]) => {
    if (!orgId) throw new Error('No active organization found');
    return fetchApi<{ message: string; member: any }>(`/organizations/${orgId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role, permissions }),
    });
  }, [orgId]);


  const removeMember = useCallback(async (userId: string) => {
    if (!orgId) throw new Error('No active organization found');
    return fetchApi<{ message: string }>(`/organizations/${orgId}/members/${userId}`, {
      method: 'DELETE',
    });
  }, [orgId]);

  const value = {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    switchPersona,
    inviteMember,
    fetchMembers,
    updateMemberRole,
    removeMember,
    logout,
    fetchProfile,
    isAdmin,
    orgRole,
    orgName,
    orgId,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
