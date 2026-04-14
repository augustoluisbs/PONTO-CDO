import { query, update, getById } from './storage';

const AUTH_KEY = 'pontoflow_currentUser';
const MAX_ATTEMPTS = 3;

// ── Password validation ────────────────────────────────────────────────────
export function validatePassword(pw) {
  if (!pw || pw.length < 4) return 'A senha deve ter no mínimo 4 caracteres.';
  if (pw.length > 10)       return 'A senha deve ter no máximo 10 caracteres.';
  return null; // null = valid
}

// ── Session helpers ────────────────────────────────────────────────────────
export function getCurrentUser() {
  const data = localStorage.getItem(AUTH_KEY);
  return data ? JSON.parse(data) : null;
}

function setCurrentUser(user) {
  const safe = { ...user };
  delete safe.password;
  localStorage.setItem(AUTH_KEY, JSON.stringify(safe));
  return safe;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}

export function isAuthenticated() { return getCurrentUser() !== null; }
export function isAdmin()         { return getCurrentUser()?.role === 'admin'; }
export function isManager()       { return getCurrentUser()?.role === 'manager'; }
export function hasManagerAccess() {
  const r = getCurrentUser()?.role;
  return r === 'manager' || r === 'admin';
}

// ── Account lock helpers ───────────────────────────────────────────────────
export function isAccountLocked(userId) {
  const u = getById('users', userId);
  return u?.accountLocked === true;
}

function recordFailedAttempt(userId) {
  const u = getById('users', userId);
  if (!u) return;
  const attempts = (u.loginAttempts || 0) + 1;
  const locked = attempts >= MAX_ATTEMPTS;
  update('users', userId, {
    loginAttempts: attempts,
    accountLocked: locked,
    lockedAt: locked ? new Date().toISOString() : u.lockedAt,
  });
  return { attempts, locked };
}

function clearAttempts(userId) {
  update('users', userId, { loginAttempts: 0, accountLocked: false, lockedAt: null });
}

// ── Core login (internal) ──────────────────────────────────────────────────
function _loginUser(user) {
  clearAttempts(user.id);
  return setCurrentUser(user);
}

// ── Login by email or matricula + password ─────────────────────────────────
export function login(emailOrMatricula, password) {
  // Try by email first, then by matricula
  let users = query('users', u =>
    (u.email === emailOrMatricula || u.matricula === emailOrMatricula) &&
    u.password === password &&
    u.active !== false
  );
  if (users.length === 0) return null;
  return _loginUser(users[0]);
}

/**
 * attemptLogin — wrapper that handles lock logic, returns:
 * { success, user, locked, attemptsLeft, mustChangePassword }
 */
export function attemptLogin(emailOrMatricula, password) {
  // Find user by email or matricula (ignore password for lock check)
  const candidates = query('users', u =>
    (u.email === emailOrMatricula || u.matricula === emailOrMatricula) &&
    u.active !== false
  );

  if (candidates.length === 0) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  const candidate = candidates[0];

  // Check if already locked
  if (candidate.accountLocked) {
    return { success: false, locked: true, error: 'Conta bloqueada. Contate seu gestor para desbloqueio.' };
  }

  // Check password
  if (candidate.password !== password) {
    const result = recordFailedAttempt(candidate.id);
    const attemptsLeft = MAX_ATTEMPTS - result.attempts;
    if (result.locked) {
      return { success: false, locked: true, error: 'Conta bloqueada após 3 tentativas. Contate seu gestor.' };
    }
    return {
      success: false,
      error: `Senha incorreta. ${attemptsLeft} tentativa${attemptsLeft !== 1 ? 's' : ''} restante${attemptsLeft !== 1 ? 's' : ''}.`,
      attemptsLeft,
    };
  }

  // Success
  const user = _loginUser(candidate);
  return { success: true, user, mustChangePassword: candidate.mustChangePassword === true };
}

// ── Login by biometric result (no password check) ─────────────────────────
export function loginByBiometricResult(userId) {
  const users = query('users', u => u.id === userId && u.active !== false);
  if (users.length === 0) return null;
  return _loginUser(users[0]);
}

// ── Lookup user by matricula only (for ClockIn without full login) ─────────
export function findUserByMatricula(matricula, password) {
  const users = query('users', u =>
    u.matricula === matricula &&
    u.password === password &&
    u.active !== false
  );
  if (users.length === 0) return null;
  const u = users[0];
  if (u.accountLocked) return { locked: true };
  return u;
}

// ── Password change ────────────────────────────────────────────────────────
export function changePassword(userId, currentPw, newPw) {
  const u = getById('users', userId);
  if (!u) return { success: false, error: 'Usuário não encontrado.' };
  if (u.password !== currentPw) return { success: false, error: 'Senha atual incorreta.' };

  const err = validatePassword(newPw);
  if (err) return { success: false, error: err };

  update('users', userId, {
    password: newPw,
    mustChangePassword: false,
    passwordChangedAt: new Date().toISOString(),
  });

  // Refresh session
  const updated = query('users', u2 => u2.id === userId)[0];
  if (updated) setCurrentUser(updated);

  return { success: true };
}

// ── Admin/Manager: force new password (after unlock) ──────────────────────
export function setPasswordByManager(userId, newPw) {
  const err = validatePassword(newPw);
  if (err) return { success: false, error: err };

  update('users', userId, {
    password: newPw,
    mustChangePassword: true,  // user must change on next login
    accountLocked: false,
    loginAttempts: 0,
    lockedAt: null,
    passwordChangedAt: new Date().toISOString(),
  });
  return { success: true };
}

// ── Manager: unlock account without setting new password ──────────────────
export function unlockAccount(userId) {
  update('users', userId, {
    accountLocked: false,
    loginAttempts: 0,
    lockedAt: null,
  });
}
