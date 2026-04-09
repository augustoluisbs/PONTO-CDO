import { query } from './storage';

const AUTH_KEY = 'pontoflow_currentUser';

export function login(email, password) {
  const users = query('users', u => u.email === email && u.password === password && u.active !== false);
  if (users.length === 0) return null;
  const user = { ...users[0] };
  delete user.password;
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}

export function getCurrentUser() {
  const data = localStorage.getItem(AUTH_KEY);
  return data ? JSON.parse(data) : null;
}

export function isAdmin() {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

export function isManager() {
  const user = getCurrentUser();
  return user?.role === 'manager';
}

// True for both admin and manager — can access manager panel
export function hasManagerAccess() {
  const user = getCurrentUser();
  return user?.role === 'manager' || user?.role === 'admin';
}

export function isAuthenticated() {
  return getCurrentUser() !== null;
}
