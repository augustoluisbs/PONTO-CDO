import { useState, useMemo } from 'react';
import { getCurrentUser } from '../../services/auth';
import { update, add, generateId } from '../../services/storage';
import { getManagerVacations } from '../../services/companyService';

export default function VacationManagement() {
  const manager = getCurrentUser();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filter, setFilter] = useState('pending');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedVacation, setSelectedVacation] = useState(null);
  const [actionType, setActionType] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const vacations = useMemo(() => {
    void refreshKey;
    let allVacations = getManagerVacations(manager);

    // Filter by selected year - show vacations that overlap with the year
    allVacations = allVacations.filter(v => {
      const start = new Date(v.startDate + 'T12:00:00');
      const end = new Date(v.endDate + 'T12:00:00');
      return start.getFullYear() === selectedYear || end.getFullYear() === selectedYear;
    });

    // Filter by status
    if (filter === 'pending') {
      allVacations = allVacations.filter(v => v.status === 'pending');
    } else if (filter === 'approved') {
      allVacations = allVacations.filter(v => v.status === 'approved');
    } else if (filter === 'rejected') {
      allVacations = allVacations.filter(v => v.status === 'rejected');
    }

    return allVacations.sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [selectedYear, filter, refreshKey, manager]);

  const pendingCount = useMemo(() => {
    void refreshKey;
    return getManagerVacations(manager).filter(v => {
      if (v.status !== 'pending') return false;
      const start = new Date(v.startDate + 'T12:00:00');
      const end = new Date(v.endDate + 'T12:00:00');
      return start.getFullYear() === selectedYear || end.getFullYear() === selectedYear;
    }).length;
  }, [selectedYear, refreshKey, manager]);

  const handleAction = (vacation, action) => {
    setSelectedVacation(vacation);
    setActionType(action);
    setRejectReason('');
  };

  const confirmAction = () => {
    if (!selectedVacation) return;
    const now = new Date().toISOString();

    if (actionType === 'approve') {
      update('vacations', selectedVacation.id, {
        status: 'approved',
        approvedBy: manager.id,
        approvedByName: manager.name,
        approvedAt: now,
      });

      add('auditLogs', {
        id: generateId(),
        managerId: manager.id,
        managerName: manager.name,
        action: 'approve_vacation',
        recordId: selectedVacation.id,
        employeeName: selectedVacation.userName,
        date: selectedVacation.startDate,
        oldValue: 'pending',
        newValue: 'approved',
        timestamp: now,
      });
    } else if (actionType === 'reject') {
      update('vacations', selectedVacation.id, {
        status: 'rejected',
        rejectedBy: manager.id,
        rejectedByName: manager.name,
        rejectedAt: now,
        rejectReason: rejectReason || null,
      });

      add('auditLogs', {
        id: generateId(),
        managerId: manager.id,
        managerName: manager.name,
        action: 'reject_vacation',
        recordId: selectedVacation.id,
        employeeName: selectedVacation.userName,
        date: selectedVacation.startDate,
        oldValue: 'pending',
        newValue: 'rejected',
        details: rejectReason,
        timestamp: now,
      });
    }

    setSelectedVacation(null);
    setActionType('');
    setRefreshKey(k => k + 1);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <span className="status-approved">✅ Homologado</span>;
      case 'pending': return <span className="status-pending">🟡 Pendente</span>;
      case 'rejected': return <span className="status-rejected">❌ Rejeitado</span>;
      default: return <span className="status-pending">{status}</span>;
    }
  };

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">🏖️ Gestão de Férias</h1>
        <p className="text-[var(--color-surface-300)] text-sm mt-1">
          Homologue e gerencie as solicitações de férias dos colaboradores
        </p>
      </div>

      {/* Year selector */}
      <div className="glass-card-static">
        <h2 className="text-sm font-semibold text-[var(--color-surface-300)] mb-3 uppercase tracking-wider">
          📅 Selecionar Ano
        </h2>
        <div className="flex flex-wrap gap-2 items-center">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-6 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${
                selectedYear === y
                  ? 'btn-primary'
                  : 'btn-secondary'
              }`}
            >
              {y}
            </button>
          ))}
          {pendingCount > 0 && (
            <span className="ml-2 text-xs px-3 py-1 rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)] font-semibold">
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'pending', label: '🟡 Pendentes' },
          { value: 'approved', label: '🟢 Homologados' },
          { value: 'rejected', label: '🔴 Rejeitados' },
          { value: 'all', label: '📋 Todos' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={filter === f.value ? 'btn-primary' : 'btn-secondary'}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Vacation list */}
      <div className="space-y-3">
        {vacations.map(v => (
          <div key={v.id} className="glass-card-static">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-white font-semibold">{v.userName}</p>
                  {getStatusBadge(v.status)}
                </div>
                <p className="text-sm text-[var(--color-surface-300)]">
                  📅 {new Date(v.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(v.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  <span className="mx-2">•</span>
                  <span className="text-white font-medium">{v.days} {v.days === 1 ? 'dia' : 'dias'}</span>
                </p>
                <p className="text-xs text-[var(--color-surface-300)] mt-1">
                  📝 Solicitado em {new Date(v.requestedAt).toLocaleDateString('pt-BR')}
                </p>
                {v.notes && (
                  <p className="text-xs text-[var(--color-surface-300)] mt-1 italic">
                    💬 &quot;{v.notes}&quot;
                  </p>
                )}
                {v.status === 'approved' && v.approvedByName && (
                  <p className="text-xs text-[var(--color-success)] mt-1">
                    ✅ Homologado por {v.approvedByName} em {new Date(v.approvedAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
                {v.status === 'rejected' && (
                  <p className="text-xs text-[var(--color-danger)] mt-1">
                    ❌ Rejeitado{v.rejectedByName ? ` por ${v.rejectedByName}` : ''}
                    {v.rejectReason ? `: "${v.rejectReason}"` : ''}
                  </p>
                )}
              </div>
              {v.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleAction(v, 'approve')} className="btn-success text-xs">
                    ✅ Homologar
                  </button>
                  <button onClick={() => handleAction(v, 'reject')} className="btn-danger text-xs">
                    ❌ Rejeitar
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {vacations.length === 0 && (
          <div className="glass-card-static text-center py-12">
            <p className="text-4xl mb-3">🏖️</p>
            <p className="text-[var(--color-surface-300)]">
              {filter === 'pending'
                ? `Nenhuma solicitação pendente para ${selectedYear}`
                : `Nenhuma solicitação encontrada para ${selectedYear}`
              }
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {selectedVacation && (
        <div className="modal-overlay" onClick={() => setSelectedVacation(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-2">
              {actionType === 'approve' ? '✅ Homologar Férias' : '❌ Rejeitar Férias'}
            </h2>
            <p className="text-sm text-[var(--color-surface-300)] mb-2">
              {selectedVacation.userName}
            </p>
            <p className="text-sm text-white mb-4">
              {new Date(selectedVacation.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(selectedVacation.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
              <span className="text-[var(--color-brand-300)] ml-2">({selectedVacation.days} dias)</span>
            </p>

            {actionType === 'approve' ? (
              <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-[var(--color-success)]">
                  Ao homologar, as férias ficarão válidas para os dias escolhidos.
                </p>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 rounded-xl p-4">
                  <p className="text-sm text-[var(--color-danger)]">
                    Ao rejeitar, o colaborador será informado e poderá solicitar novamente.
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-2">
                    Motivo da rejeição (opcional)
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    className="input-field"
                    rows="2"
                    placeholder="Informe o motivo..."
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setSelectedVacation(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={confirmAction}
                className={`flex-1 ${actionType === 'approve' ? 'btn-success' : 'btn-danger'}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
