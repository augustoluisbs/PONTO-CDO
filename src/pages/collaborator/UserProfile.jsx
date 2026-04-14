import { useState } from 'react';
import { getCurrentUser, changePassword, validatePassword } from '../../services/auth';
import { getById } from '../../services/storage';

export default function UserProfile() {
  const sessionUser = getCurrentUser();
  // Get fresh user data (with all fields)
  const user = getById('users', sessionUser?.id) || sessionUser;

  const [tab, setTab] = useState('info');

  // Password change state
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwError, setPwError]       = useState('');
  const [pwSuccess, setPwSuccess]   = useState('');
  const [loading, setLoading]       = useState(false);

  if (!user) return null;

  const roleLabel = {
    admin: '🛡️ Administrador',
    manager: '👑 Gestor',
    collaborator: '👤 Colaborador',
  }[user.role] || user.role;

  const statusLabel = user.accountLocked
    ? { label: '🔒 Bloqueada', color: 'text-[var(--color-danger)]', bg: 'bg-[var(--color-danger)]/10' }
    : { label: '✅ Ativa', color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/10' };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    const err = validatePassword(newPw);
    if (err) { setPwError(err); return; }
    if (newPw !== confirmPw) { setPwError('As senhas não coincidem.'); return; }

    setLoading(true);
    setTimeout(() => {
      const result = changePassword(user.id, currentPw, newPw);
      setLoading(false);
      if (!result.success) { setPwError(result.error); return; }
      setPwSuccess('✅ Senha alterada com sucesso!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    }, 400);
  };

  const pwStrength = (pw) => {
    if (!pw) return 0;
    if (pw.length >= 8) return 3;
    if (pw.length >= 6) return 2;
    return 1;
  };
  const strength = pwStrength(newPw);

  return (
    <div className="max-w-2xl mx-auto space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}>
          {user.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{user.name}</h1>
          <p className="text-[var(--color-surface-300)] text-sm mt-0.5">{roleLabel}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {[
          { id: 'info', label: '👤 Meus Dados' },
          { id: 'password', label: '🔑 Alterar Senha' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setPwError(''); setPwSuccess(''); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', minHeight: 'auto',
              padding: '10px 16px', borderBottom: tab === t.id ? '2px solid var(--color-brand-400)' : '2px solid transparent',
              color: tab === t.id ? 'var(--color-brand-400)' : '#94a3b8',
              fontWeight: tab === t.id ? '600' : '400',
              fontSize: '0.9rem', transition: 'all 0.2s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {tab === 'info' && (
        <div className="glass-card-static space-y-0 divide-y divide-white/5">
          {[
            { label: 'Nome completo',  value: user.name },
            { label: 'Matrícula',      value: user.matricula },
            { label: 'E-mail',         value: user.email },
            { label: 'CPF',            value: user.cpf || '—' },
            { label: 'Cargo',          value: roleLabel },
            { label: 'Carga horária',  value: user.dailyHours ? `${user.dailyHours}h/dia` : '—' },
            { label: 'Período',        value: user.period === 'integral' ? 'Integral' : user.period === 'matutino' ? 'Matutino' : (user.period || '—') },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-4 px-0 gap-4">
              <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider font-medium">{label}</p>
              <p className="text-sm text-white font-medium text-right">{value}</p>
            </div>
          ))}

          {/* Status */}
          <div className="flex items-center justify-between py-4 px-0 gap-4">
            <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider font-medium">Status da Conta</p>
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${statusLabel.bg} ${statusLabel.color}`}>
              {statusLabel.label}
            </span>
          </div>

          {user.accountLocked && (
            <div className="py-4">
              <div className="px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                🔒 Sua conta está bloqueada por excesso de tentativas de login incorretas.
                Entre em contato com seu gestor para desbloqueio.
              </div>
            </div>
          )}

          {/* Password changed at */}
          {user.passwordChangedAt && (
            <div className="flex items-center justify-between py-4 px-0 gap-4">
              <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider font-medium">Última troca de senha</p>
              <p className="text-sm text-[var(--color-surface-300)] text-right">
                {new Date(user.passwordChangedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Password tab */}
      {tab === 'password' && (
        <div className="glass-card-static">
          <h2 className="text-base font-semibold text-white mb-1">Alterar Senha</h2>
          <p className="text-sm text-[var(--color-surface-300)] mb-5">
            Mínimo 4 caracteres, máximo 10 caracteres.
          </p>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            {/* Current password */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">Senha Atual</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  className="input-field pr-12"
                  placeholder="Sua senha atual"
                  maxLength={10}
                  required
                />
                <button type="button" onClick={() => setShowCurrent(v => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', minHeight: 'auto', padding: 0, cursor: 'pointer', color: '#94a3b8' }}>
                  {showCurrent ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">Nova Senha</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  className="input-field pr-12"
                  placeholder="4 a 10 caracteres"
                  maxLength={10}
                  required
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', minHeight: 'auto', padding: 0, cursor: 'pointer', color: '#94a3b8' }}>
                  {showNew ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Strength bar */}
              {newPw && (
                <div className="flex gap-1 mt-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                      style={{ background: strength >= i ? (i === 3 ? '#10b981' : i === 2 ? '#f59e0b' : '#6366f1') : 'rgba(255,255,255,0.1)' }} />
                  ))}
                  <span className="text-xs text-[var(--color-surface-300)] ml-2 whitespace-nowrap">
                    {strength === 1 ? 'Fraca' : strength === 2 ? 'Média' : 'Forte'}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">Confirmar Nova Senha</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  className="input-field pr-12"
                  placeholder="Repita a nova senha"
                  maxLength={10}
                  required
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', minHeight: 'auto', padding: 0, cursor: 'pointer', color: '#94a3b8' }}>
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
              {confirmPw && newPw && (
                <p className={`text-xs mt-1 ${newPw === confirmPw ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                  {newPw === confirmPw ? '✓ As senhas coincidem' : '✗ As senhas não coincidem'}
                </p>
              )}
            </div>

            {/* Feedback */}
            {pwError && (
              <div className="text-sm px-4 py-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="text-sm px-4 py-3 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
                {pwSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || newPw !== confirmPw}
              className="btn-primary w-full py-3 mt-2"
            >
              {loading ? '⏳ Salvando...' : '🔑 Alterar Senha'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
