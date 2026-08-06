import { api } from './api.js';

export const auth = $state({
  user: null,
  loading: true,
});

export async function loadMe() {
  try {
    auth.user = await api.get('/api/auth/me');
  } catch {
    auth.user = null;
  } finally {
    auth.loading = false;
  }
}

export function setUser(user) {
  auth.user = user;
}

export function clearUser() {
  auth.user = null;
}
