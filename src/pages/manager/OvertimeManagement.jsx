import { useState, useMemo, useEffect, useCallback } from 'react';
import { getCurrentUser } from '../../services/auth';
import { query } from '../../services/storage';
import { getManagerCollaborators } from '../../services/companyService';
import { getMonthName } from '../../services/timeCalculations';
import {
  calculateMonthOvertimeSummary,
  calculateDetailedDay,
  createOvertimeAction,
  revokeOvertimeAction,
  actionTypeLabel,
  formatBalance,
} from '../../services/overtimeService';

// ── Action Modal ────────────────────────────────────────────────────────────
function ActionModal({ collaborator, year, month, summary, type, onClose, onDone }) {
  const [minutes, setMinutes] = useState('');
  const [reason, setReason]  = useState('');
  const [error, setError]    = useState('');
  const manager = getCurrentUser();

  const maxMap = {
    approve_extra:  summary.rawExtra,
    abono_negative: summary.rawMissing,
    compensate:     Math.min(summary.rawExtra, summary.rawMissing),
  };
  const maxMinutes = maxMap[type] || 0;

  const labels = {
    approve_extra:  { title: '✅ Aprovar Horas Extras', hint: `Máx disponível: ${formatBalance(summary.rawExtra)}`, btnColor: 'btn-success' },
    abono_negative: { title: '🟢 Abonar Horas Negativas', hint: `Máx negativo: ${formatBalance(summary.rawMissing)}`, btnColor: 'btn-success' },
    compensate:     { title: '🔄 Compensar: Extra → Negativo', hint: `Máx compensável: ${formatBalance(maxMinutes)}`, btnColor: 'btn-primary' },
  };
  const label = labels[type];

  // Helper: "01:30" → 90 minutes
  const parseInput = (val) => {
    if (!val) return 0;
    if (val.includes(':')) {
      const [h, m] = val.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    }
    return parseInt(val, 10) || 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const mins = parseInput(minutes);
    if (mins <= 0) { setError('Informe um valor válido.'); return; }
    if (mins > maxMinutes) { setError(`Valor excede o máximo permitido (${formatBalance(maxMinutes)}).`); return; }

    createOvertimeAction({
      managerId: manager.id,
      managerName: manager.name,
      userId: collaborator.id,
      userName: collaborator.name,
      year,
      month,
      type,
      minutes: mins,
      reason,
    });
    onDone();
  };

  return (
    <div className="modal-overlay" onPointerDown={onClose}>
      <div className="modal-content" onPointerDown={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-1">{label.title}</h2>
        <p className="text-sm text-[var(--color-surface-300)] mb-1">
          {collaborator.name} · {getMonthName(month)} {year}
        </p>
        <p className="text-xs text-[var(--color-brand-400)] mb-5">{label.hint}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--color-surface-300)] mb-2">
              Quantidade de horas <span className="text-xs opacity-70">(ex: 02:30 ou 150 minutos)</span>
            </label>
            <input
              type="text"
              value={minutes}
              onChange={e => setMinutes(e.target.value)}
              className="input-field"
              placeholder="02:30"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-surface-300)] mb-2">Observação (opcional)</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="input-field"
              placeholder="Motivo ou justificativa"
            />
          </div>
          {error && (
            <div className="text-sm px-3 py-2 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className={`${label.btnColor} flex-1`}>Confirmar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Desktop table ────────────────────────────────────────────────────────────
function DailyTable({ records, dailyHours }) {
  if (records.length === 0) return null;

  return (
    <div className="hidden lg:block table-container">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Entrada</th>
            <th>Saída</th>
            <th>Trabalhadas</th>
            <th>Saldo dia</th>
            <th>HE Diurna</th>
            <th>HE Noturna</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {[...records].sort((a,b) => a.date.localeCompare(b.date)).map(r => {
            const d = calculateDetailedDay(r, dailyHours);
            const isSpecial = ['absence','holiday','medical','excused'].includes(r.status);
            return (
              <tr key={r.id}>
                <td className="text-white font-medium">{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                <td>{r.entrada || '--:--'}</td>
                <td>{r.saida || '--:--'}</td>
                <td className="text-white font-medium">{isSpecial ? '-' : formatBalance(d.workedMinutes)}</td>
                <td className={d.balanceMinutes >= 0 ? 'text-[var(--color-success)] font-semibold' : 'text-[var(--color-danger)] font-semibold'}>
                  {isSpecial ? '-' : formatBalance(d.balanceMinutes)}
                </td>
                <td className="text-[var(--color-success)]">{d.extraDiurnoMinutes > 0 ? `+${formatBalance(d.extraDiurnoMinutes)}` : '-'}</td>
                <td className="text-[var(--color-brand-400)]">{d.extraNoturnoMinutes > 0 ? `+${formatBalance(d.extraNoturnoMinutes)}` : '-'}</td>
                <td className="text-xs">{r.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function OvertimeManagement() {
  const manager  = getCurrentUser();
  const now      = new Date();

  const [selectedYear, setSelectedYear]  = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [refreshKey, setRefreshKey]       = useState(0);
  const [modalType, setModalType]         = useState(null); // 'approve_extra'|'abono_negative'|'compensate'

  const employees = useMemo(() => getManagerCollaborators(manager), [manager]);

  // Auto-select first employee
  useEffect(() => {
    if (employees.length > 0 && !selectedEmpId) setSelectedEmpId(employees[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees.length]);

  const selectedEmp = useMemo(() => employees.find(e => e.id === selectedEmpId), [employees, selectedEmpId]);

  const records = useMemo(() => {
    if (!selectedEmp) return [];
    return query('timeRecords', r =>
      r.userId === selectedEmp.id &&
      (() => { const d = new Date(r.date); return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth; })()
    );
  }, [selectedEmp, selectedYear, selectedMonth, refreshKey]);

  const summary = useMemo(() => {
    if (!selectedEmp) return null;
    return calculateMonthOvertimeSummary(
      records,
      selectedEmp.dailyHours || 8,
      selectedEmp.id,
      selectedYear,
      selectedMonth
    );
  }, [records, selectedEmp, selectedYear, selectedMonth, refreshKey]);

  const reload = useCallback(() => setRefreshKey(k => k + 1), []);

  const openModal = (type) => {
    setModalType(null);
    setTimeout(() => setModalType(type), 0);
  };
  const closeModal = () => setModalType(null);
  const handleDone = () => { closeModal(); reload(); };

  const months = [0,1,2,3,4,5,6,7,8,9,10,11];
  const years  = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  // Color helpers
  const balanceColor = (min) => min > 0 ? 'text-[var(--color-success)]' : min < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-surface-300)]';

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">⏱️ Banco de Horas</h1>
        <p className="text-[var(--color-surface-300)] text-sm mt-1">
          Gerencie horas extras, negativas e compensações
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card-static grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-[var(--color-surface-300)] mb-1.5 font-medium">Colaborador</label>
          <select value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}
            className="input-field" style={{ padding: '8px 12px', minHeight: 'auto' }}>
            {employees.map(e => (
              <option key={e.id} value={e.id} style={{ background: '#1e293b' }}>{e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-surface-300)] mb-1.5 font-medium">Mês</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
            className="input-field" style={{ padding: '8px 12px', minHeight: 'auto' }}>
            {months.map(m => (
              <option key={m} value={m} style={{ background: '#1e293b' }}>{getMonthName(m)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-surface-300)] mb-1.5 font-medium">Ano</label>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="input-field" style={{ padding: '8px 12px', minHeight: 'auto' }}>
            {years.map(y => (
              <option key={y} value={y} style={{ background: '#1e293b' }}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Carry-over */}
            <div className="glass-card text-center p-4">
              <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-1">Carry-over</p>
              <p className={`text-xl font-bold ${balanceColor(summary.carryOver)}`}>
                {formatBalance(summary.carryOver)}
              </p>
              <p className="text-xs text-[var(--color-surface-300)] mt-1">saldo anterior</p>
            </div>

            {/* Extra bruto */}
            <div className="glass-card text-center p-4">
              <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-1">HE do mês</p>
              <p className="text-xl font-bold text-[var(--color-success)]">
                +{formatBalance(summary.rawExtra)}
              </p>
              <p className="text-xs text-[var(--color-surface-300)] mt-1">bruto</p>
            </div>

            {/* Negativo bruto */}
            <div className="glass-card text-center p-4">
              <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-1">H. Negativas</p>
              <p className="text-xl font-bold text-[var(--color-danger)]">
                -{formatBalance(summary.rawMissing)}
              </p>
              <p className="text-xs text-[var(--color-surface-300)] mt-1">bruto</p>
            </div>

            {/* Saldo efetivo */}
            <div className="glass-card text-center p-4" style={{
              border: `1px solid ${summary.effectiveBalance >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-1">Saldo Efetivo</p>
              <p className={`text-xl font-bold ${balanceColor(summary.effectiveBalance)}`}>
                {formatBalance(summary.effectiveBalance)}
              </p>
              <p className="text-xs text-[var(--color-surface-300)] mt-1">com carry-over</p>
            </div>
          </div>

          {/* HE breakdown */}
          <div className="glass-card-static">
            <h2 className="text-base font-semibold text-white mb-4">📊 Detalhamento do Mês</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-[var(--color-surface-300)]">⏰ Trabalhadas</span>
                  <span className="text-sm font-semibold text-white">{formatBalance(summary.workedMinutes)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-[var(--color-surface-300)]">📋 Esperado</span>
                  <span className="text-sm font-semibold text-white">{formatBalance(summary.expectedMinutes)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-[var(--color-surface-300)]">🌅 HE Diurnas</span>
                  <span className="text-sm font-semibold text-[var(--color-success)]">+{formatBalance(summary.extraDiurno)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-[var(--color-surface-300)]">🌙 HE Noturnas <span className="text-xs opacity-60">(×60/52,5)</span></span>
                  <span className="text-sm font-semibold text-[var(--color-brand-400)]">+{formatBalance(summary.extraNoturno)}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-[var(--color-surface-300)]">✅ HE aprovadas</span>
                  <span className="text-sm font-semibold text-[var(--color-success)]">+{formatBalance(summary.approvedExtraMinutes)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-[var(--color-surface-300)]">🟢 Abonos</span>
                  <span className="text-sm font-semibold text-[var(--color-success)]">+{formatBalance(summary.approvedNegativeAbonado)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-[var(--color-surface-300)]">🔄 Compensações</span>
                  <span className="text-sm font-semibold text-[var(--color-brand-400)]">{formatBalance(summary.compensatedMinutes)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-[var(--color-surface-300)]">📦 Carry-over anterior</span>
                  <span className={`text-sm font-semibold ${balanceColor(summary.carryOver)}`}>{formatBalance(summary.carryOver)}</span>
                </div>
              </div>
            </div>

            {/* Alert: negative without compensation */}
            {summary.effectiveMissing > 0 && (
              <div className="mt-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                <span>⚠️</span>
                <span>
                  {formatBalance(summary.effectiveMissing)} de horas negativas não autorizadas.
                  Sem autorização do gestor, extras não compensam negativas automaticamente.
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="glass-card-static">
            <h2 className="text-base font-semibold text-white mb-4">🎯 Ações do Gestor</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => openModal('approve_extra')}
                disabled={summary.rawExtra <= 0}
                className="btn-success flex flex-col items-center gap-1 py-4 rounded-2xl disabled:opacity-40"
                style={{ minHeight: 'auto' }}
              >
                <span className="text-2xl">✅</span>
                <span className="font-semibold text-sm">Aprovar HE</span>
                <span className="text-xs opacity-70">Confirma horas extras</span>
              </button>

              <button
                onClick={() => openModal('abono_negative')}
                disabled={summary.rawMissing <= 0}
                className="btn-primary flex flex-col items-center gap-1 py-4 rounded-2xl disabled:opacity-40"
                style={{ minHeight: 'auto', background: 'linear-gradient(135deg, #059669, #10b981)' }}
              >
                <span className="text-2xl">🟢</span>
                <span className="font-semibold text-sm">Abonar Negativas</span>
                <span className="text-xs opacity-70">Perdoa horas negativas</span>
              </button>

              <button
                onClick={() => openModal('compensate')}
                disabled={summary.rawExtra <= 0 || summary.rawMissing <= 0}
                className="btn-secondary flex flex-col items-center gap-1 py-4 rounded-2xl disabled:opacity-40"
                style={{ minHeight: 'auto' }}
              >
                <span className="text-2xl">🔄</span>
                <span className="font-semibold text-sm">Compensar</span>
                <span className="text-xs opacity-70">Extra cobre negativo</span>
              </button>
            </div>
          </div>

          {/* Actions history */}
          {summary.actions.length > 0 && (
            <div className="glass-card-static">
              <h2 className="text-base font-semibold text-white mb-4">📝 Histórico de Ações</h2>
              <div className="space-y-2">
                {[...summary.actions].sort((a, b) => b.createdAt?.localeCompare(a.createdAt)).map(action => (
                  <div key={action.id}
                    className="rounded-xl p-3 flex items-center justify-between gap-3"
                    style={{ background: action.status === 'revoked' ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.04)', opacity: action.status === 'revoked' ? 0.5 : 1 }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{actionTypeLabel(action.type)}</p>
                      <p className="text-xs text-[var(--color-surface-300)] mt-0.5">
                        {formatBalance(action.minutes)} · {action.reason || 'sem observação'} · {new Date(action.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                      {action.status === 'revoked' && (
                        <span className="text-xs text-[var(--color-danger)]">Revogado</span>
                      )}
                    </div>
                    {action.status !== 'revoked' && (
                      <button
                        onClick={() => { revokeOvertimeAction(action.id); reload(); }}
                        className="text-xs px-2 py-1 rounded-lg shrink-0"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', minHeight: 'auto', cursor: 'pointer' }}>
                        Revogar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily breakdown table */}
          <div className="glass-card-static">
            <h2 className="text-base font-semibold text-white mb-4">📅 Registros do Mês</h2>

            {/* Mobile */}
            <div className="lg:hidden space-y-2">
              {records.sort((a,b) => a.date.localeCompare(b.date)).map(r => {
                const d = calculateDetailedDay(r, selectedEmp.dailyHours || 8);
                const isSpecial = ['absence','holiday','medical','excused'].includes(r.status);
                return (
                  <div key={r.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white">
                        {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')} · {r.entrada || '--'} – {r.saida || '--'}
                      </span>
                      <span className={`text-sm font-bold ${d.balanceMinutes >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                        {isSpecial ? r.status : formatBalance(d.balanceMinutes)}
                      </span>
                    </div>
                    {!isSpecial && (d.extraDiurnoMinutes > 0 || d.extraNoturnoMinutes > 0) && (
                      <p className="text-xs text-[var(--color-surface-300)]">
                        {d.extraDiurnoMinutes > 0 && `☀️ HE Diurna: +${formatBalance(d.extraDiurnoMinutes)}`}
                        {d.extraDiurnoMinutes > 0 && d.extraNoturnoMinutes > 0 && ' · '}
                        {d.extraNoturnoMinutes > 0 && `🌙 HE Noturna: +${formatBalance(d.extraNoturnoMinutes)}`}
                      </p>
                    )}
                  </div>
                );
              })}
              {records.length === 0 && <p className="text-center text-[var(--color-surface-300)] py-4 text-sm">Nenhum registro</p>}
            </div>

            {/* Desktop */}
            <DailyTable records={records} dailyHours={selectedEmp?.dailyHours || 8} />
          </div>
        </>
      )}

      {/* Modal */}
      {modalType && selectedEmp && summary && (
        <ActionModal
          collaborator={selectedEmp}
          year={selectedYear}
          month={selectedMonth}
          summary={summary}
          type={modalType}
          onClose={closeModal}
          onDone={handleDone}
        />
      )}
    </div>
  );
}

