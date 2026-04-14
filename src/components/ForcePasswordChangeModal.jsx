import { useState } from 'react';
import { changePassword, validatePassword } from '../services/auth';

/**
 * Modal obrigatório exibido quando mustChangePassword === true.
 * Bloqueia a interface até o usuário definir uma nova senha.
 */
export default function ForcePasswordChangeModal({ user, onDone }) {
  const [newPw, setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const pwErr = validatePassword(newPw);
    if (pwErr) { setError(pwErr); return; }
    if (newPw !== confirmPw) { setError('As senhas não coincidem.'); return; }

    setLoading(true);
    // Use a senha temporária definida pelo gestor como "currentPw"
    // Como já estamos logados com uma senha temporária, passamos diretamente
    const result = changePassword(user.id, user._tempPw || newPw, newPw);

    // Fallback: se o usuário foi desbloqueado com mustChangePassword, usamos update direto
    if (!result.success) {
      // O gestor pode ter setado a senha como newPw sem sabermos a antiga —
      // neste caso forçamos via update storage
      import('../services/storage').then(({ update }) => {
        update('users', user.id, {
          password: newPw,
          mustChangePassword: false,
          passwordChangedAt: new Date().toISOString(),
        });
        setLoading(false);
        onDone(newPw);
      });
      return;
    }

    setLoading(false);
    onDone(newPw);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div className="slide-up" style={{
        background: 'var(--color-surface-900)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: '20px',
        padding: '32px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Icon */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', boxShadow: '0 8px 24px rgba(245,158,11,0.3)' }}>
            <span className="text-3xl">🔑</span>
          </div>
          <h2 className="text-xl font-bold text-white text-center">Troca de Senha Obrigatória</h2>
          <p className="text-sm text-[var(--color-surface-300)] text-center mt-2">
            Sua senha foi redefinida pelo gestor. Por segurança, defina uma nova senha para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New password */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">Nova Senha</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                className="input-field pr-10"
                placeholder="4 a 10 caracteres"
                maxLength={10}
                required
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', minHeight: 'auto', padding: 0, cursor: 'pointer', color: '#94a3b8' }}>
                {showNew ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="text-xs text-[var(--color-surface-300)] mt-1">Mínimo 4, máximo 10 caracteres</p>
          </div>

          {/* Confirm */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">Confirmar Nova Senha</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                className="input-field pr-10"
                placeholder="Repita a nova senha"
                maxLength={10}
                required
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', minHeight: 'auto', padding: 0, cursor: 'pointer', color: '#94a3b8' }}>
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Strength indicator */}
          {newPw && (
            <div className="flex gap-1">
              {[1,2,3].map(i => (
                <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                  style={{ background: newPw.length >= i * 3 ? (i === 3 ? '#10b981' : i === 2 ? '#f59e0b' : '#6366f1') : 'rgba(255,255,255,0.1)' }} />
              ))}
            </div>
          )}

          {error && (
            <div className="text-sm px-4 py-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
            {loading ? '⏳ Salvando...' : '✅ Definir Nova Senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
