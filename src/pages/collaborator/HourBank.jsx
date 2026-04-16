import { useState, useMemo } from 'react';
import { getCurrentUser } from '../../services/auth';
import { query } from '../../services/storage';
import { getMonthName } from '../../services/timeCalculations';
import {
  calculateMonthOvertimeSummary,
  calculateDetailedDay,
  actionTypeLabel,
  formatBalance,
} from '../../services/overtimeService';

export default function HourBank() {
  const user = getCurrentUser();
  const now  = new Date();

  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const records = useMemo(() => {
    return query('timeRecords', r => {
      const d = new Date(r.date);
      return r.userId === user.id && d.getFullYear() === year && d.getMonth() === month;
    });
  }, [user.id, year, month]);

  const summary = useMemo(() => {
    return calculateMonthOvertimeSummary(records, user.dailyHours || 8, user.id, year, month);
  }, [records, user, year, month]);

  const years  = [now.getFullYear() - 1, now.getFullYear()];
  const months = [0,1,2,3,4,5,6,7,8,9,10,11];

  const balanceColor = (min) =>
    min > 0 ? 'text-[var(--color-success)]' : min < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-surface-300)]';

  return (
    <div className="max-w-3xl mx-auto space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">⏱️ Banco de Horas</h1>
        <p className="text-[var(--color-surface-300)] text-sm mt-1">
          Seu saldo de horas extras e negativas com carry-over mensal
        </p>
      </div>

      {/* Month/Year selector */}
      <div className="glass-card-static flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-[var(--color-surface-300)] mb-1.5 font-medium">Mês</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="input-field" style={{ padding: '8px 12px', minHeight: 'auto' }}>
            {months.map(m => (
              <option key={m} value={m} style={{ background: '#1e293b' }}>{getMonthName(m)}</option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <label className="block text-xs text-[var(--color-surface-300)] mb-1.5 font-medium">Ano</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="input-field" style={{ padding: '8px 12px', minHeight: 'auto' }}>
            {years.map(y => (
              <option key={y} value={y} style={{ background: '#1e293b' }}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card text-center p-4">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-1">Carry-over</p>
          <p className={`text-xl font-bold ${balanceColor(summary.carryOver)}`}>{formatBalance(summary.carryOver)}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">mês anterior</p>
        </div>
        <div className="glass-card text-center p-4">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-1">HE do Mês</p>
          <p className="text-xl font-bold text-[var(--color-success)]">+{formatBalance(summary.rawExtra)}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">bruto</p>
        </div>
        <div className="glass-card text-center p-4">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-1">Negativas</p>
          <p className="text-xl font-bold text-[var(--color-danger)]">-{formatBalance(summary.rawMissing)}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">bruto</p>
        </div>
        <div className="glass-card text-center p-4"
          style={{ border: `1px solid ${summary.effectiveBalance >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-1">Saldo Efetivo</p>
          <p className={`text-xl font-bold ${balanceColor(summary.effectiveBalance)}`}>{formatBalance(summary.effectiveBalance)}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">com carry-over</p>
        </div>
      </div>

      {/* HE Type breakdown */}
      <div className="glass-card-static">
        <h2 className="text-base font-semibold text-white mb-4">📊 Detalhamento — {getMonthName(month)} {year}</h2>
        <div className="space-y-3">
          {[
            { label: '⏰ Trabalhadas', value: formatBalance(summary.workedMinutes), color: 'text-white' },
            { label: '📋 Esperado', value: formatBalance(summary.expectedMinutes), color: 'text-white' },
            { label: '🌅 HE Diurnas (5h–22h)', value: `+${formatBalance(summary.extraDiurno)}`, color: 'text-[var(--color-success)]' },
            { label: '🌙 HE Noturnas (22h–5h)', value: `+${formatBalance(summary.extraNoturno)}`, color: 'text-[var(--color-brand-400)]' },
            { label: '📦 Carry-over anterior', value: formatBalance(summary.carryOver), color: balanceColor(summary.carryOver) },
            { label: '✅ HE aprovadas pelo gestor', value: `+${formatBalance(summary.approvedExtraMinutes)}`, color: 'text-[var(--color-success)]' },
            { label: '🟢 Horas abonadas', value: `+${formatBalance(summary.approvedNegativeAbonado)}`, color: 'text-[var(--color-success)]' },
            { label: '🔄 Compensações autorizadas', value: formatBalance(summary.compensatedMinutes), color: 'text-[var(--color-brand-400)]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-sm text-[var(--color-surface-300)]">{label}</span>
              <span className={`text-sm font-semibold ${color}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* Notice if negative without compensation */}
        {summary.effectiveMissing > 0 && (
          <div className="mt-4 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
            ⚠️ Você possui <strong>{formatBalance(summary.effectiveMissing)}</strong> de horas negativas sem autorização de compensação.
            Solicite ao seu gestor a autorização de compensação ou abono.
          </div>
        )}

        {/* Notice if extra pending approval */}
        {summary.rawExtra > summary.approvedExtraMinutes && (
          <div className="mt-3 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fcd34d' }}>
            🟡 Você possui <strong>{formatBalance(summary.rawExtra - summary.approvedExtraMinutes)}</strong> de horas extras aguardando aprovação do gestor.
          </div>
        )}
      </div>

      {/* Gestor actions for this month */}
      {summary.actions.length > 0 && (
        <div className="glass-card-static">
          <h2 className="text-base font-semibold text-white mb-4">📝 Autorizações do Gestor</h2>
          <div className="space-y-2">
            {[...summary.actions].sort((a,b) => b.createdAt?.localeCompare(a.createdAt)).map(action => (
              <div key={action.id}
                className="rounded-xl p-3 flex items-center justify-between gap-3"
                style={{ background: 'rgba(255,255,255,0.04)', opacity: action.status === 'revoked' ? 0.5 : 1 }}>
                <div>
                  <p className="text-sm text-white font-medium">{actionTypeLabel(action.type)}</p>
                  <p className="text-xs text-[var(--color-surface-300)] mt-0.5">
                    {formatBalance(action.minutes)}
                    {action.reason ? ` · ${action.reason}` : ''}
                    {' · '}{new Date(action.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  action.status === 'approved'
                    ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                    : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
                }`}>
                  {action.status === 'approved' ? '✅ Ativo' : '❌ Revogado'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily records */}
      <div className="glass-card-static">
        <h2 className="text-base font-semibold text-white mb-4">📅 Registros do Mês</h2>
        <div className="space-y-2">
          {[...records].sort((a,b) => a.date.localeCompare(b.date)).map(r => {
            const d = calculateDetailedDay(r, user.dailyHours || 8);
            const isSpecial = ['absence','holiday','medical','excused'].includes(r.status);
            return (
              <div key={r.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white">
                      {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    {!isSpecial && (
                      <span className="text-xs text-[var(--color-surface-300)] ml-2">
                        {r.entrada || '--'} – {r.saida || '--'}
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${isSpecial ? 'text-[var(--color-surface-300)]' : d.balanceMinutes >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                    {isSpecial ? r.status : formatBalance(d.balanceMinutes)}
                  </span>
                </div>
                {!isSpecial && (d.extraDiurnoMinutes > 0 || d.extraNoturnoMinutes > 0) && (
                  <div className="flex gap-3 mt-1">
                    {d.extraDiurnoMinutes > 0 && (
                      <span className="text-xs text-[var(--color-success)]">☀️ +{formatBalance(d.extraDiurnoMinutes)} diurna</span>
                    )}
                    {d.extraNoturnoMinutes > 0 && (
                      <span className="text-xs text-[var(--color-brand-400)]">🌙 +{formatBalance(d.extraNoturnoMinutes)} noturna</span>
                    )}
                  </div>
                )}
                {!isSpecial && d.missingMinutes > 0 && (
                  <span className="text-xs text-[var(--color-danger)] mt-0.5 block">
                    ⬇️ -{formatBalance(d.missingMinutes)} negativa
                  </span>
                )}
              </div>
            );
          })}
          {records.length === 0 && (
            <p className="text-center text-[var(--color-surface-300)] py-6 text-sm">Nenhum registro neste mês</p>
          )}
        </div>
      </div>
    </div>
  );
}
