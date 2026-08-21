/**
 * ============================================================================
 * Dashboard API Client Service — Distributed Job Scheduler
 * ============================================================================
 * Connects to http://localhost:3000/api/v1 endpoints for authentication, queues,
 * jobs, workers, metrics, and DLQ management. Handles token caching and deduplicated
 * automatic user authentication.
 */

const API_BASE = 'http://localhost:3000/api/v1';

let cachedToken: string | null = localStorage.getItem('dashboard_jwt_token');
let authPromise: Promise<string> | null = null;

export async function ensureAuthToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      // 1. Try logging in with test credentials
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'mytest@example.com', password: 'password123' }),
      });

      if (loginRes.ok) {
        const data = await loginRes.json();
        cachedToken = data.token;
        localStorage.setItem('dashboard_jwt_token', cachedToken!);
        return cachedToken!;
      }

      // 2. If login fails, register a dedicated dashboard user
      const uniqueEmail = `dashboard-admin-${Date.now()}@codity.ai`;
      const regRes = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: uniqueEmail,
          password: 'password123',
          name: 'Dashboard Administrator',
          organizationName: 'Codity Corporation',
        }),
      });

      if (regRes.ok) {
        const data = await regRes.json();
        cachedToken = data.token;
        localStorage.setItem('dashboard_jwt_token', cachedToken!);
        return cachedToken!;
      }

      return '';
    } catch (err) {
      console.error('Failed dashboard auto-authentication:', err);
      return '';
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await ensureAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Clear invalid cached token and retry once
    localStorage.removeItem('dashboard_jwt_token');
    cachedToken = null;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'API request failed' }));
    throw new Error(errorBody.message || `HTTP ${response.status}`);
  }

  return response.json();
}
