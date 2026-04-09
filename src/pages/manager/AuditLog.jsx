import { useState, useMemo } from 'react';
import { getCurrentUser } from '../../services/auth';
import { getManagerAuditLogs } from '../../services/companyService';

export default function AuditLog() {
  const manager = getCurrentUser();
  const [filterAction, setFilterAction] = useState('all');

  const logs = useMemo(() => {
    let allLogs = getManagerAuditLogs(manager);
    if (filterAction !== 'all') {
      allLogs = allLogs.filter(l => l.action === filterAction);
    }
    return allLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [filterAction, manager]);

  const getActionBadge = (action) => {
    const styles = {
      approve: { bg: 'bg-[var(--color-success)]/15', text: 'text-[var(--color-success)]', label: '✅ Aprovação' },
      adjust: { bg: 'bg-[var(--color-brand-500)]/15', text: 'text-[var(--color-brand-400)]', label: '✏️ Ajuste' },
      excuse: { bg: 'bg-[var(--color-success)]/15', text: 'text-[var(--color-success)]', label: '🟢 Abono' },
      absence: { bg: 'bg-[var(--color-danger)]/15', text: 'text-[var(--color-danger)]', label: '❌ Falta' },
      holiday: { bg: 'bg-[var(--color-warning)]/15', text: 'text-[var(--color-warning)]', label: '🏖️ Feriado' },
      medical: { bg: 'bg-[var(--color-info)]/15', text: 'text-[var(--color-info)]', label: '🏥 Atestado' },
    };
    const s = styles[action] || { bg: 'bg-white/10', text: 'text-white', label: action };
    return <span className={`${s.bg} ${s.text} px-2 py-1 rounded-lg text-xs font-medium`}>{s.label}</span>;
  };

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">🔍 Log de Auditoria</h1>
        <p className="text-[var(--color-surface-300)] text-sm mt-1">
          Registro imutável de todas as alterações
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'Todos' },
          { value: 'approve', label: '✅ Aprovações' },
          { value: 'adjust', label: '✏️ Ajustes' },
          { value: 'absence', label: '❌ Faltas' },
          { value: 'excuse', label: '🟢 Abonos' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilterAction(f.value)}
            className={filterAction === f.value ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Log entries */}
      <div className="space-y-3">
        {logs.map(log => (
          <div key={log.id} className="glass-card-static">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {getActionBadge(log.action)}
                  <span className="text-white font-medium">{log.employeeName}</span>
                </div>
                <p className="text-sm text-[var(--color-surface-300)]">
                  📅 Referente a: {log.date ? new Date(log.date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                </p>
                <p className="text-sm text-[var(--color-surface-300)]">
                  👤 Por: {log.managerName}
                </p>
                {log.action === 'adjust' && (
                  <div className="mt-2 text-sm">
                    <span className="text-[var(--color-danger)]">Antes: {log.oldEntrada} - {log.oldSaida}</span>
                    <span className="mx-2 text-[var(--color-surface-300)]">→</span>
                    <span className="text-[var(--color-success)]">Depois: {log.newEntrada} - {log.newSaida}</span>
                  </div>
                )}
                {log.action !== 'adjust' && (
                  <p className="text-sm mt-1">
                    <span className="text-[var(--color-surface-300)]">Status: </span>
                    <span className="text-[var(--color-danger)]">{log.oldValue}</span>
                    <span className="mx-2 text-[var(--color-surface-300)]">→</span>
                    <span className="text-[var(--color-success)]">{log.newValue}</span>
                  </p>
                )}
              </div>
              <p className="text-xs text-[var(--color-surface-300)]">
                🕐 {new Date(log.timestamp).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="glass-card-static text-center py-12">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-[var(--color-surface-300)]">Nenhum registro de auditoria</p>
          </div>
        )}
      </div>
    </div>
  );
}
