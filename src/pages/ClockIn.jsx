import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { add, update, query, generateId } from '../services/storage';
import { getCurrentUser, findUserByMatricula } from '../services/auth';
import { seedDemoData } from '../services/seedData';
import {
  checkBiometricSupport,
  hasUserBiometric,
  authenticateBiometric,
} from '../services/biometricAuth';

// Register a punch for a user (used by both modal and biometric, without full login)
function registerPunchForUser(user, location) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const existing = query('timeRecords', r => r.userId === user.id && r.date === today);
  let punchType = null;

  if (existing.length === 0) {
    punchType = 'entrada';
  } else {
    const rec = existing[0];
    if (!rec.entrada)       punchType = 'entrada';
    else if (!rec.almoco_ida)   punchType = 'almoco_ida';
    else if (!rec.almoco_volta) punchType = 'almoco_volta';
    else if (!rec.saida)        punchType = 'saida';
  }

  if (!punchType) return { done: true };

  const locationData = location ? {
    latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy,
  } : null;

  const labels = { entrada: 'Entrada', almoco_ida: 'Almoço (Saída)', almoco_volta: 'Almoço (Retorno)', saida: 'Saída' };

  if (existing.length > 0) {
    update('timeRecords', existing[0].id, {
      [punchType]: timeStr,
      [`${punchType}_location`]: locationData,
      registrationTimestamp: now.toISOString(),
    });
  } else {
    add('timeRecords', {
      id: generateId(),
      userId: user.id,
      date: today,
      entrada: timeStr,
      entrada_location: locationData,
      almoco_ida: null, almoco_volta: null, saida: null,
      status: 'pending',
      homologated: false, homologatedBy: null, homologatedAt: null,
      loginTimestamp: now.toISOString(),
      registrationTimestamp: now.toISOString(),
    });
  }

  return {
    done: false,
    punch: { type: labels[punchType], time: timeStr, date: now.toLocaleDateString('pt-BR'), userName: user.name },
  };
}

// ── ClockIn modal for manual punch (matricula + password) ─────────────────
function PunchModal({ onClose, location }) {
  const [matricula, setMatricula] = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const user = findUserByMatricula(matricula.trim(), password);
      setLoading(false);

      if (!user) { setError('Matrícula ou senha inválidos.'); return; }
      if (user.locked) { setError('Conta bloqueada. Contate seu gestor.'); return; }

      const result = registerPunchForUser(user, location);
      if (result.done) {
        setError('Todos os registros do dia já foram realizados.');
        return;
      }
      setSuccess(result.punch);
    }, 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onPointerDown={onClose}
    >
      <div
        className="w-full max-w-sm slide-up"
        style={{ background: 'var(--color-surface-900)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px' }}
        onPointerDown={e => e.stopPropagation()}
      >
        {success ? (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-white mb-1">Ponto Registrado!</h2>
            <p className="text-[var(--color-surface-300)] text-sm mb-1">{success.userName}</p>
            <p className="text-[var(--color-brand-400)] font-semibold">{success.type} · {success.time}</p>
            <p className="text-xs text-[var(--color-surface-300)] mt-1">{success.date}</p>
            <button onClick={onClose} className="btn-primary w-full mt-6">Fechar</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">Bater Ponto</h2>
                <p className="text-xs text-[var(--color-surface-300)] mt-0.5">Informe sua matrícula e senha</p>
              </div>
              <button onClick={onClose}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', width: 32, height: 32, minHeight: 'auto', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', padding: 0 }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">Matrícula</label>
                <input
                  type="text"
                  value={matricula}
                  onChange={e => setMatricula(e.target.value)}
                  className="input-field"
                  placeholder="Ex: COL-001"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">Senha</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field pr-12"
                    placeholder="••••••"
                    maxLength={10}
                    required
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', minHeight: 'auto', padding: 0, cursor: 'pointer', color: '#94a3b8' }}>
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? '⏳ Registrando...' : '⏱️ Registrar Ponto'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main ClockIn Page ──────────────────────────────────────────────────────
export default function ClockIn() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime]     = useState(new Date());
  const [clockingIn, setClockingIn]       = useState(false);
  const [lastPunch, setLastPunch]         = useState(null);
  const [location, setLocation]           = useState(null);
  const [locationError, setLocationError] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showPunchModal, setShowPunchModal]   = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLoading, setBiometricLoading]     = useState(false);
  const [biometricError, setBiometricError]         = useState('');
  const [biometricSuccess, setBiometricSuccess]     = useState(null);

  useEffect(() => { seedDemoData(); }, []);
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    checkBiometricSupport().then(setBiometricSupported);
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não suportada'); return;
    }
    setGettingLocation(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGettingLocation(false);
      },
      () => { setLocationError('Permita o acesso à localização.'); setGettingLocation(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  // ── Punch for logged-in user ─────────────────────────────────────────────
  const getNextPunchType = useCallback(() => {
    const user = getCurrentUser();
    if (!user) return { type: 'entrada', label: 'Entrada', icon: '🟢' };
    const today = new Date().toISOString().split('T')[0];
    const records = query('timeRecords', r => r.userId === user.id && r.date === today);
    if (records.length === 0) return { type: 'entrada', label: 'Entrada', icon: '🟢' };
    const rec = records[0];
    if (!rec.entrada)       return { type: 'entrada', label: 'Entrada', icon: '🟢' };
    if (!rec.almoco_ida)    return { type: 'almoco_ida', label: 'Almoço (Saída)', icon: '🍽️' };
    if (!rec.almoco_volta)  return { type: 'almoco_volta', label: 'Almoço (Retorno)', icon: '🍽️' };
    if (!rec.saida)         return { type: 'saida', label: 'Saída', icon: '🔴' };
    return { type: 'done', label: 'Completo', icon: '✅' };
  }, []);

  const handleClockIn = useCallback(() => {
    const user = getCurrentUser();
    if (!user) { navigate('/login'); return; }
    if (!location) { requestLocation(); return; }
    setClockingIn(true);
    setTimeout(() => {
      const result = registerPunchForUser(user, location);
      if (!result.done) {
        setLastPunch({ ...result.punch, location });
      }
      setClockingIn(false);
    }, 800);
  }, [location, navigate, requestLocation]);

  // ── Biometric punch (identifies user → registers punch, no login) ────────
  const handleBiometricPunch = async () => {
    setBiometricError('');
    setBiometricSuccess(null);
    setBiometricLoading(true);
    try {
      const authResult = await authenticateBiometric();
      const users = query('users', u => u.id === authResult.userId && u.active !== false);
      if (users.length === 0) throw new Error('Usuário não encontrado.');
      const user = users[0];
      const result = registerPunchForUser(user, location);
      if (result.done) {
        setBiometricError('Todos os registros do dia já foram feitos para ' + user.name + '.');
      } else {
        setBiometricSuccess(result.punch);
        setTimeout(() => setBiometricSuccess(null), 4000);
      }
    } catch (err) {
      setBiometricError(err.message);
    } finally {
      setBiometricLoading(false);
    }
  };

  const punchInfo = getNextPunchType();
  const user = getCurrentUser();

  const timeString = currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateString = currentTime.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15), transparent)', animation: 'pulse-glow 4s ease-in-out infinite' }} />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(67,56,202,0.12), transparent)', animation: 'pulse-glow 4s ease-in-out infinite 2s' }} />
      </div>

      {/* Logo */}
      <div className="text-center mb-6 slide-up relative z-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4"
          style={{ background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))', boxShadow: '0 12px 40px rgba(99,102,241,0.4)' }}>
          <span className="text-4xl">⏱️</span>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-[var(--color-brand-300)] to-[var(--color-brand-500)] bg-clip-text text-transparent">
          PontoFlow
        </h1>
        <p className="text-[var(--color-surface-300)] mt-1 text-sm">Sistema de Ponto Eletrônico</p>
      </div>

      {/* Clock */}
      <div className="text-center mb-6 slide-up relative z-10" style={{ animationDelay: '0.1s' }}>
        <p className="text-6xl lg:text-7xl font-bold text-white tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {timeString}
        </p>
        <p className="text-[var(--color-surface-300)] mt-2 capitalize text-sm">{dateString}</p>
      </div>

      {/* User greeting */}
      {user && (
        <div className="text-center mb-4 slide-up relative z-10" style={{ animationDelay: '0.15s' }}>
          <p className="text-sm text-[var(--color-surface-300)]">
            Olá, <span className="text-white font-semibold">{user.name?.split(' ')[0]}</span> 👋
          </p>
        </div>
      )}

      {/* Main clock-in button (for logged-in user only) */}
      {user && (
        <div className="slide-up relative z-10 mb-6" style={{ animationDelay: '0.2s' }}>
          {punchInfo.type !== 'done' ? (
            <button onClick={handleClockIn} disabled={clockingIn}
              className="group relative" style={{ outline: 'none', border: 'none', background: 'none', cursor: 'pointer' }}>
              <div className="absolute inset-0 rounded-full"
                style={{ background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))', animation: 'pulse-glow 2s ease-in-out infinite', transform: 'scale(1.15)', opacity: 0.3 }} />
              <div className="relative w-44 h-44 rounded-full flex flex-col items-center justify-center transition-all duration-300 group-hover:scale-105"
                style={{
                  background: clockingIn ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,var(--color-brand-600),var(--color-brand-500))',
                  boxShadow: clockingIn ? '0 12px 50px rgba(16,185,129,0.5)' : '0 12px 50px rgba(99,102,241,0.4)',
                }}>
                {clockingIn ? (
                  <span className="text-5xl animate-spin">⏳</span>
                ) : (
                  <>
                    <span className="text-4xl mb-1">{punchInfo.icon}</span>
                    <span className="text-white font-bold text-xl">BATER</span>
                    <span className="text-white/80 text-sm">{punchInfo.label}</span>
                  </>
                )}
              </div>
            </button>
          ) : (
            <div className="w-44 h-44 rounded-full flex flex-col items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#059669,#10b981)', boxShadow: '0 12px 50px rgba(16,185,129,0.3)' }}>
              <span className="text-4xl mb-1">✅</span>
              <span className="text-white font-bold text-base">COMPLETO</span>
              <span className="text-white/80 text-xs">Todos os registros feitos</span>
            </div>
          )}
        </div>
      )}

      {/* Biometric punch (no login needed — identifies and punches) */}
      {biometricSupported && !user && (
        <div className="slide-up relative z-10 mb-4 w-full max-w-xs" style={{ animationDelay: '0.2s' }}>
          <button
            onClick={handleBiometricPunch}
            disabled={biometricLoading}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-white transition-all duration-300"
            style={{ background: 'linear-gradient(135deg,#059669,#10b981)', boxShadow: '0 6px 25px rgba(16,185,129,0.3)' }}
          >
            <span className="text-2xl">{biometricLoading ? '⏳' : '👆'}</span>
            <span>{biometricLoading ? 'Identificando...' : 'Bater Ponto com Digital'}</span>
          </button>
          {biometricSuccess && (
            <div className="mt-3 text-center px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
              ✅ {biometricSuccess.userName} · {biometricSuccess.type} · {biometricSuccess.time}
            </div>
          )}
          {biometricError && (
            <div className="mt-3 text-center px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {biometricError}
            </div>
          )}
        </div>
      )}

      {/* Also show biometric punch for logged-in user (side button) */}
      {biometricSupported && user && (
        <div className="slide-up relative z-10 mb-4 w-full max-w-xs" style={{ animationDelay: '0.25s' }}>
          <button
            onClick={handleBiometricPunch}
            disabled={biometricLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7', cursor: 'pointer' }}
          >
            <span>{biometricLoading ? '⏳' : '👆'}</span>
            <span>{biometricLoading ? 'Identificando...' : 'Ponto por Digital (qualquer usuário)'}</span>
          </button>
          {biometricError && (
            <p className="text-xs text-[var(--color-danger)] text-center mt-1">{biometricError}</p>
          )}
        </div>
      )}

      {/* Location status */}
      <div className="mt-2 text-center slide-up relative z-10" style={{ animationDelay: '0.3s' }}>
        {gettingLocation ? (
          <p className="text-sm text-[var(--color-surface-300)] flex items-center gap-2 justify-center">
            <span className="animate-spin">📍</span> Obtendo localização...
          </p>
        ) : location ? (
          <p className="text-xs text-[var(--color-surface-300)] flex items-center gap-1 justify-center">
            📍 Localização capturada <span className="text-[var(--color-success)]">✓</span>
          </p>
        ) : locationError ? (
          <div>
            <p className="text-sm text-[var(--color-warning)]">{locationError}</p>
            <button onClick={requestLocation} className="text-xs text-[var(--color-brand-400)] hover:underline mt-1"
              style={{ background: 'none', border: 'none', minHeight: 'auto', cursor: 'pointer' }}>
              Tentar novamente
            </button>
          </div>
        ) : null}
      </div>

      {/* Last punch result (logged-in user) */}
      {lastPunch && (
        <div className="mt-4 glass-card-static text-center max-w-sm w-full slide-up relative z-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-[var(--color-success)] text-lg">✅</span>
            <p className="text-white font-semibold">Ponto Registrado!</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-[var(--color-surface-300)] text-xs">Tipo</p><p className="text-white font-medium">{lastPunch.type}</p></div>
            <div><p className="text-[var(--color-surface-300)] text-xs">Horário</p><p className="text-white font-medium">{lastPunch.time}</p></div>
            <div><p className="text-[var(--color-surface-300)] text-xs">Data</p><p className="text-white font-medium">{lastPunch.date}</p></div>
            <div><p className="text-[var(--color-surface-300)] text-xs">Local</p><p className="text-white font-medium text-xs">{lastPunch.location ? `${lastPunch.location.latitude.toFixed(4)}, ${lastPunch.location.longitude.toFixed(4)}` : '—'}</p></div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex flex-col items-center gap-3 slide-up relative z-10 w-full max-w-xs" style={{ animationDelay: '0.4s' }}>
        {/* Manual punch modal button */}
        <button
          onClick={() => setShowPunchModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-white transition-all duration-300"
          style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
        >
          🪪 Bater Ponto com Matrícula
        </button>

        {user ? (
          <button
            onClick={() => navigate(user.role === 'manager' || user.role === 'admin' ? '/gestor' : '/dashboard')}
            className="btn-primary flex items-center gap-2 px-8 py-3 w-full justify-center"
          >
            🖥️ Acessar Sistema
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="btn-primary flex items-center gap-2 px-8 py-3 w-full justify-center"
          >
            🔐 Fazer Login
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center relative z-10">
        <p className="text-xs text-[var(--color-surface-300)] opacity-50">
          PontoFlow © {new Date().getFullYear()} · Ponto Eletrônico
        </p>
      </div>

      {/* Punch modal */}
      {showPunchModal && (
        <PunchModal onClose={() => setShowPunchModal(false)} location={location} />
      )}
    </div>
  );
}
