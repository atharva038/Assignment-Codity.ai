/**
 * ============================================================================
 * Dashboard API Client Service — Distributed Job Scheduler
 * ============================================================================
 * Connects to http://localhost:3000/api/v1 endpoints for authentication, queues,
 * jobs, workers, metrics, workflows, events, and DLQ management.
 * Handles token caching, user sessions, and authenticated API queries.
 */

const API_BASE = 'http://localhost:3000/api/v1';

let cachedToken: string | null = localStorage.getItem('dashboard_jwt_token');
const tokenListeners: Array<(token: string | null) => void> = [];

export function setAuthToken(token: string | null) {
  cachedToken = token;
  if (token) {
    localStorage.setItem('dashboard_jwt_token', token);
  } else {
    localStorage.removeItem('dashboard_jwt_token');
  }
  tokenListeners.forEach((listener) => listener(token));
}

export function getAuthToken(): string | null {
  return cachedToken || localStorage.getItem('dashboard_jwt_token');
}

export function subscribeAuthChange(callback: (token: string | null) => void) {
  tokenListeners.push(callback);
  return () => {
    const idx = tokenListeners.indexOf(callback);
    if (idx !== -1) tokenListeners.splice(idx, 1);
  };
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();

  if (!token && endpoint !== '/auth/login' && endpoint !== '/auth/register') {
    throw new Error('Authentication required');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && endpoint !== '/auth/login') {
    // Clear invalid token
    setAuthToken(null);
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'API request failed' }));
    throw new Error(errorBody.message || `HTTP ${response.status}`);
  }

  return response.json();
}
