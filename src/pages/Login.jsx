import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getCurrentUser } from '../services/auth';
import { seedDemoData } from '../services/seedData';
import { query } from '../services/storage';
import {
  checkBiometricSupport,
  hasUserBiometric,
  registerBiometric,
  authenticateBiometric,
} from '../services/biometricAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricMessage, setBiometricMessage] = useState('');
  const [showBiometricRegister, setShowBiometricRegister] = useState(false);
  const navigate = useNavigate();

  // Seed demo data once on mount
  useEffect(() => {
    seedDemoData();
  }, []);

  // Check biometric support
  useEffect(() => {
    checkBiometricSupport().then(supported => {
      setBiometricSupported(supported);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const user = login(email, password);
      if (!user) {
        setError('Email ou senha inválidos');
        setLoading(false);
        return;
      }

      // Check if user has biometric registered
      if (biometricSupported && !hasUserBiometric(user.id)) {
        setShowBiometricRegister(true);
        setLoading(false);
        return;
      }

      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate(user.role === 'manager' ? '/gestor' : '/dashboard');
      }
    }, 500);
  };

  const handleBiometricLogin = async () => {
    setError('');
    setBiometricMessage('');
    setLoading(true);

    try {
      const result = await authenticateBiometric();
      
      // Find the user and login
      const users = query('users', u => u.id === result.userId && u.active !== false);
      if (users.length === 0) {
        setError('Usuário não encontrado');
        setLoading(false);
        return;
      }

      const user = users[0];
      // Login directly
      const loggedUser = login(user.email, user.password);
      if (!loggedUser) {
        setError('Erro ao autenticar');
        setLoading(false);
        return;
      }

      navigate(loggedUser.role === 'manager' ? '/gestor' : '/dashboard');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleRegisterBiometric = async () => {
    const user = getCurrentUser();
    if (!user) return;

    try {
      setBiometricMessage('Siga as instruções do seu dispositivo...');
      await registerBiometric(user);
      setBiometricMessage('✅ Biometria registrada com sucesso!');
      setTimeout(() => {
        navigate(user.role === 'manager' ? '/gestor' : '/dashboard');
      }, 1000);
    } catch (err) {
      setBiometricMessage('❌ ' + err.message);
    }
  };

  const skipBiometric = () => {
    const user = getCurrentUser();
    if (user) {
      navigate(user.role === 'manager' ? '/gestor' : '/dashboard');
    }
  };

  const quickLogin = (email) => {
    setEmail(email);
    setPassword('123456');
  };

  // Biometric registration modal
  if (showBiometricRegister) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 fade-in">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, var(--color-brand-500), transparent)' }} />
        </div>

        <div className="w-full max-w-md relative">
          <div className="glass-card-static text-center slide-up">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
              style={{
                background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))',
                boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
              }}>
              <span className="text-4xl">🔐</span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Cadastrar Digital</h2>
            <p className="text-sm text-[var(--color-surface-300)] mb-6">
              Deseja cadastrar sua digital para fazer login mais rápido pelo celular?
            </p>

            {biometricMessage && (
              <div className="text-sm px-4 py-3 rounded-xl mb-4 bg-[var(--color-brand-900)]/30 border border-[var(--color-brand-500)]/20 text-[var(--color-brand-300)]">
                {biometricMessage}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleRegisterBiometric}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                👆 Registrar Digital
              </button>
              <button
                onClick={skipBiometric}
                className="btn-secondary w-full py-3"
              >
                Pular por agora
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 fade-in">
      {/* Background decoration */}
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
            style={{
              background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))',
              boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
            }}>
            <span className="text-3xl">⏱️</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--color-brand-300)] to-[var(--color-brand-500)] bg-clip-text text-transparent">
            PontoFlow
          </h1>
          <p className="text-[var(--color-surface-300)] mt-2 text-sm">
            Sistema de Ponto Eletrônico
          </p>
        </div>

        {/* Biometric Login Button */}
        {biometricSupported && (
          <div className="mb-4 slide-up" style={{ animationDelay: '0.05s' }}>
            <button
              onClick={handleBiometricLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-white transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #059669, #10b981)',
                boxShadow: '0 6px 25px rgba(16, 185, 129, 0.3)',
              }}
            >
              <span className="text-2xl">👆</span>
              <span>Login com Digital</span>
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider">ou</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          </div>
        )}

        {/* Login Card */}
        <div className="glass-card-static slide-up" style={{ animationDelay: '0.1s' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••"
                required
              />
            </div>

            {error && (
              <div className="text-[var(--color-danger)] text-sm bg-[var(--color-danger)]/10 px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {loading ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <>Entrar</>
              )}
            </button>
          </form>
        </div>

        {/* Quick login (demo) */}
        <div className="mt-6 glass-card-static slide-up" style={{ animationDelay: '0.2s' }}>
          <p className="text-xs text-[var(--color-surface-300)] mb-3 font-medium uppercase tracking-wider">
            Acesso Rápido (Demo)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => quickLogin('ana@empresa.com')}
              className="btn-secondary text-xs py-2 flex items-center gap-1.5">
              <span>👑</span> Gestora Ana
            </button>
            <button onClick={() => quickLogin('carlos@empresa.com')}
              className="btn-secondary text-xs py-2 flex items-center gap-1.5">
              <span>👤</span> Carlos
            </button>
            <button onClick={() => quickLogin('juliana@empresa.com')}
              className="btn-secondary text-xs py-2 flex items-center gap-1.5">
              <span>👤</span> Juliana
            </button>
            <button onClick={() => quickLogin('rafael@empresa.com')}
              className="btn-secondary text-xs py-2 flex items-center gap-1.5">
              <span>👤</span> Rafael
            </button>
          </div>
          <p className="text-xs text-[var(--color-surface-300)] mt-3 text-center">
            Senha: <code className="text-[var(--color-brand-400)]">123456</code>
          </p>
        </div>

        {/* Back to ClockIn */}
        <div className="mt-4 text-center slide-up" style={{ animationDelay: '0.3s' }}>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-[var(--color-surface-300)] hover:text-white transition-colors"
          >
            ← Voltar para Batida de Ponto
          </button>
        </div>
      </div>
    </div>
  );
}
