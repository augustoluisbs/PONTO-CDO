import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { attemptLogin, loginByBiometricResult, getCurrentUser } from '../services/auth';
import { seedDemoData } from '../services/seedData';
import { query } from '../services/storage';
import {
  checkBiometricSupport,
  hasUserBiometric,
  registerBiometric,
  authenticateBiometric,
} from '../services/biometricAuth';
import ForcePasswordChangeModal from '../components/ForcePasswordChangeModal';

export default function Login() {
  const [identifier, setIdentifier] = useState(''); // email ou matrícula
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricMessage, setBiometricMessage]     = useState('');
  const [showBiometricRegister, setShowBiometricRegister] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);      // user após login, aguardando biometric register
  const [forceChange, setForceChange] = useState(false);     // mustChangePassword flag
  const navigate = useNavigate();

  useEffect(() => { seedDemoData(); }, []);
  useEffect(() => {
    checkBiometricSupport().then(setBiometricSupported);
  }, []);

  // Navigate after login (checks mustChangePassword)
  const navigateAfterLogin = (user, mustChange) => {
    if (mustChange) {
      setForceChange(true);
      return;
    }
    if (user.role === 'admin')    navigate('/admin');
    else if (user.role === 'manager') navigate('/gestor');
    else navigate('/dashboard');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const result = attemptLogin(identifier.trim(), password);
      setLoading(false);

      if (!result.success) {
        setError(result.error || 'Credenciais inválidas.');
        return;
      }

      const user = result.user;

      // Check biometric registration
      if (biometricSupported && !hasUserBiometric(user.id)) {
        setPendingUser(user);
        setShowBiometricRegister(true);
        if (result.mustChangePassword) setForceChange(true);
        return;
      }

      navigateAfterLogin(user, result.mustChangePassword);
    }, 400);
  };

  const handleBiometricLogin = async () => {
    setError('');
    setBiometricMessage('');
    setLoading(true);
    try {
      const result = await authenticateBiometric();
      const user = loginByBiometricResult(result.userId);
      if (!user) {
        setError('Usuário não encontrado.');
        setLoading(false);
        return;
      }
      // Reload fresh user data to check mustChangePassword
      const freshUsers = query('users', u => u.id === user.id);
      const fresh = freshUsers[0];
      setLoading(false);
      navigateAfterLogin(user, fresh?.mustChangePassword === true);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleRegisterBiometric = async () => {
    const user = getCurrentUser() || pendingUser;
    if (!user) return;
    try {
      setBiometricMessage('Siga as instruções do seu dispositivo...');
      await registerBiometric(user);
      setBiometricMessage('✅ Biometria registrada com sucesso!');
      setTimeout(() => {
        const fresh = query('users', u => u.id === user.id)[0];
        navigateAfterLogin(user, fresh?.mustChangePassword === true);
      }, 800);
    } catch (err) {
      setBiometricMessage('❌ ' + err.message);
    }
  };

  const skipBiometric = () => {
    const user = getCurrentUser() || pendingUser;
    if (user) {
      const fresh = query('users', u => u.id === user.id)[0];
      navigateAfterLogin(user, fresh?.mustChangePassword === true);
    }
  };

  const quickLogin = (id) => {
    const identifiers = {
      'manager': 'GES-001', 'carlos': 'COL-001',
      'juliana': 'COL-002', 'rafael': 'COL-003',
    };
    setIdentifier(identifiers[id] || id);
    setPassword('123456');
  };

  // ─── Force password change modal ────────────────────────────────────────
  const user = getCurrentUser() || pendingUser;
  if (forceChange && user) {
    return (
      <ForcePasswordChangeModal
        user={user}
        onDone={() => {
          setForceChange(false);
          navigateAfterLogin(user, false);
        }}
      />
    );
  }

  // ─── Biometric register screen ──────────────────────────────────────────
  if (showBiometricRegister) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 fade-in">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, var(--color-brand-500), transparent)' }} />
        </div>
        <div className="w-full max-w-md">
          <div className="glass-card-static text-center slide-up">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))', boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}>
              <span className="text-4xl">🔐</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Cadastrar Digital</h2>
            <p className="text-sm text-[var(--color-surface-300)] mb-6">
              Deseja cadastrar sua digital para um login mais rápido no celular?
            </p>
            {biometricMessage && (
              <div className="text-sm px-4 py-3 rounded-xl mb-4"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                {biometricMessage}
              </div>
            )}
            <div className="space-y-3">
              <button onClick={handleRegisterBiometric} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                👆 Registrar Digital
              </button>
              <button onClick={skipBiometric} className="btn-secondary w-full py-3">
                Pular por agora
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main login screen ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4 fade-in">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, var(--color-brand-500), transparent)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, var(--color-brand-700), transparent)' }} />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8 slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))', boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}>
            <span className="text-3xl">⏱️</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--color-brand-300)] to-[var(--color-brand-500)] bg-clip-text text-transparent">
            PontoFlow
          </h1>
          <p className="text-[var(--color-surface-300)] mt-2 text-sm">Sistema de Ponto Eletrônico</p>
        </div>

        {/* Biometric login button */}
        {biometricSupported && (
          <div className="mb-4 slide-up" style={{ animationDelay: '0.05s' }}>
            <button onClick={handleBiometricLogin} disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-white transition-all duration-300 hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 6px 25px rgba(16,185,129,0.3)' }}>
              <span className="text-2xl">👆</span>
              <span>Entrar com Digital</span>
            </button>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider">ou</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          </div>
        )}

        {/* Login form */}
        <div className="glass-card-static slide-up" style={{ animationDelay: '0.1s' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Identifier field */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">
                Matrícula ou E-mail
              </label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="input-field"
                placeholder="Ex: COL-001 ou seu@email.com"
                autoComplete="username"
                required
              />
            </div>

            {/* Password field */}
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
                  autoComplete="current-password"
                  required
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', minHeight: 'auto', padding: 0, cursor: 'pointer', color: '#94a3b8', fontSize: '1rem' }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-sm px-4 py-3 rounded-xl flex items-start gap-2"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {loading ? <span className="animate-spin">⏳</span> : 'Entrar'}
            </button>
          </form>
        </div>

        {/* Quick login (demo) */}
        <div className="mt-6 glass-card-static slide-up" style={{ animationDelay: '0.2s' }}>
          <p className="text-xs text-[var(--color-surface-300)] mb-3 font-medium uppercase tracking-wider">
            Acesso Rápido (Demo)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => quickLogin('manager')} className="btn-secondary text-xs py-2 flex items-center justify-start gap-1.5 px-3">
              <span>👑</span> Gestora Ana
            </button>
            <button onClick={() => quickLogin('carlos')} className="btn-secondary text-xs py-2 flex items-center justify-start gap-1.5 px-3">
              <span>👤</span> Carlos
            </button>
            <button onClick={() => quickLogin('juliana')} className="btn-secondary text-xs py-2 flex items-center justify-start gap-1.5 px-3">
              <span>👤</span> Juliana
            </button>
            <button onClick={() => quickLogin('rafael')} className="btn-secondary text-xs py-2 flex items-center justify-start gap-1.5 px-3">
              <span>👤</span> Rafael
            </button>
          </div>
          <p className="text-xs text-[var(--color-surface-300)] mt-3 text-center">
            Senha: <code className="text-[var(--color-brand-400)]">123456</code>
            {' '}· Use a matrícula (ex: <code className="text-[var(--color-brand-400)]">COL-001</code>)
          </p>
        </div>

        {/* Back to ClockIn */}
        <div className="mt-4 text-center slide-up" style={{ animationDelay: '0.3s' }}>
          <button onClick={() => navigate('/')}
            className="text-sm text-[var(--color-surface-300)] hover:text-white transition-colors"
            style={{ background: 'none', border: 'none', minHeight: 'auto' }}>
            ← Voltar para Batida de Ponto
          </button>
        </div>
      </div>
    </div>
  );
}
