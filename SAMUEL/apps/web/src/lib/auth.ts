import { apiFetch } from './api-client';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  company: { id: string; name: string };
};

export async function fetchMe(): Promise<SessionUser> {
  const data = await apiFetch<{ user: SessionUser }>('/api/v1/auth/me');
  return data.user;
}

export async function logout(): Promise<void> {
  await apiFetch('/api/v1/auth/logout', { method: 'POST' }, { authRedirect: false, retryOn401: false });
}
