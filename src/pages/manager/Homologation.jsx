import { useState, useMemo } from 'react';
import { getCurrentUser } from '../../services/auth';
import { update, add, generateId, query } from '../../services/storage';
import { calculateDayMinutes, formatMinutes } from '../../services/timeCalculations';
import { getManagerCollaborators, getAllManagerTimeRecords } from '../../services/companyService';

export default function Homologation() {
  const manager = getCurrentUser();
  const now = new Date();

  const [filter, setFilter] = useState('pending');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [actionType, setActionType] = useState('');
  const [newEntrada, setNewEntrada] = useState('');
  const [newSaida, setNewSaida] = useState('');

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  const employees = useMemo(() => {
    return getManagerCollaborators(manager);
  }, [manager]);

  const records = useMemo(() => {
    void refreshKey;
    let allRecords = getAllManagerTimeRecords(manager);

    // Filter by selected month/year
    allRecords = allRecords.filter(r => {
      const d = new Date(r.date + 'T12:00:00');
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });

    // Filter by employee
    if (selectedEmployee !== 'all') {
      allRecords = allRecords.filter(r => r.userId === selectedEmployee);
    }

    // Filter by status
    if (filter === 'pending') {
      allRecords = allRecords.filter(r => r.status === 'pending');
    } else if (filter === 'approved') {
      allRecords = allRecords.filter(r => r.status === 'approved');
    }

    return allRecords.map(r => {
      const user = query('users', u => u.id === r.userId)[0];
      return { ...r, userName: user?.name || 'Desconhecido' };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [filter, selectedMonth, selectedYear, selectedEmployee, refreshKey, manager]);

  const pendingCount = useMemo(() => {
    void refreshKey;
    let allRecords = getAllManagerTimeRecords(manager).filter(r => r.status === 'pending');
    allRecords = allRecords.filter(r => {
      const d = new Date(r.date + 'T12:00:00');
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
    if (selectedEmployee !== 'all') {
      allRecords = allRecords.filter(r => r.userId === selectedEmployee);
    }
    return allRecords.length;
  }, [selectedMonth, selectedYear, selectedEmployee, refreshKey, manager]);

  const loadRecords = () => setRefreshKey(k => k + 1);

  const handleAction = (record, action) => {
    setSelectedRecord(record);
    setActionType(action);
    if (action === 'adjust') {
      setNewEntrada(record.entrada || '');
      setNewSaida(record.saida || '');
    }
  };

  const confirmAction = () => {
    if (!selectedRecord) return;
    const now = new Date().toISOString();
    const oldStatus = selectedRecord.status;
    let newStatus = '';
    let updateData = {};

    switch (actionType) {
      case 'approve':
        newStatus = 'approved';
        updateData = { status: 'approved', homologated: true, homologatedBy: manager.id, homologatedAt: now };
        break;
      case 'adjust':
        newStatus = 'approved';
        updateData = { status: 'approved', entrada: newEntrada, saida: newSaida, homologated: true, homologatedBy: manager.id, homologatedAt: now, adjusted: true };
        break;
      case 'excuse':
        newStatus = 'excused';
        updateData = { status: 'excused', homologated: true, homologatedBy: manager.id, homologatedAt: now };
        break;
      case 'absence':
        newStatus = 'absence';
        updateData = { status: 'absence', entrada: null, almoco_ida: null, almoco_volta: null, saida: null, homologated: true, homologatedBy: manager.id, homologatedAt: now };
        break;
      case 'holiday':
        newStatus = 'holiday';
        updateData = { status: 'holiday', homologated: true, homologatedBy: manager.id, homologatedAt: now };
        break;
      case 'medical':
        newStatus = 'medical';
        updateData = { status: 'medical', homologated: true, homologatedBy: manager.id, homologatedAt: now };
        break;
    }

    update('timeRecords', selectedRecord.id, updateData);

    add('auditLogs', {
      id: generateId(),
      managerId: manager.id,
      managerName: manager.name,
      action: actionType,
      recordId: selectedRecord.id,
      employeeName: selectedRecord.userName,
      date: selectedRecord.date,
      oldValue: oldStatus,
      newValue: newStatus,
      oldEntrada: selectedRecord.entrada,
      oldSaida: selectedRecord.saida,
      newEntrada: actionType === 'adjust' ? newEntrada : undefined,
      newSaida: actionType === 'adjust' ? newSaida : undefined,
      timestamp: now,
    });

    setSelectedRecord(null);
    setActionType('');
    loadRecords();
  };

  const getActionLabel = (action) => {
    const labels = {
      approve: '✅ Aprovar',
      adjust: '✏️ Alterar Horário',
      excuse: '🟢 Abonar',
      absence: '❌ Falta',
      holiday: '🏖️ Feriado',
      medical: '🏥 Atestado',
    };
    return labels[action] || action;
  };

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">✅ Homologação de Pontos</h1>
        <p className="text-[var(--color-surface-300)] text-sm mt-1">
          Aprove, ajuste ou justifique os registros dos colaboradores
        </p>
      </div>

      {/* Filters card */}
      <div className="glass-card-static space-y-4">
        <h2 className="text-sm font-semibold text-[var(--color-surface-300)] uppercase tracking-wider">
          🔍 Filtros
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Month */}
          <div>
            <label className="block text-xs text-[var(--color-surface-300)] mb-1.5 font-medium">Mês</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="input-field"
              style={{ padding: '8px 12px' }}
            >
              {months.map((m, i) => (
                <option key={i} value={i} style={{ background: 'var(--color-surface-900)', color: 'white' }}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-xs text-[var(--color-surface-300)] mb-1.5 font-medium">Ano</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="input-field"
              style={{ padding: '8px 12px' }}
            >
              {years.map(y => (
                <option key={y} value={y} style={{ background: 'var(--color-surface-900)', color: 'white' }}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Collaborator */}
          <div>
            <label className="block text-xs text-[var(--color-surface-300)] mb-1.5 font-medium">Colaborador</label>
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="input-field"
              style={{ padding: '8px 12px' }}
            >
              <option value="all" style={{ background: 'var(--color-surface-900)', color: 'white' }}>
                👥 Todos
              </option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id} style={{ background: 'var(--color-surface-900)', color: 'white' }}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary badge */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)] font-semibold">
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''} em {months[selectedMonth]} {selectedYear}
            </span>
          </div>
        )}
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'pending', label: '🟡 Pendentes' },
          { value: 'approved', label: '🟢 Aprovados' },
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

      {/* Records list */}
      <div className="space-y-3">
        {records.map(r => (
          <div key={r.id} className="glass-card-static">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-white font-semibold">{r.userName}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === 'approved' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                    : r.status === 'pending' ? 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]'
                    : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
                  }`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-surface-300)]">
                  📅 {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')} •
                  ⏰ {r.entrada || '--:--'} - {r.saida || '--:--'} •
                  ⏱️ {formatMinutes(calculateDayMinutes(r))}
                </p>
                <p className="text-xs text-[var(--color-surface-300)] mt-1">
                  📝 Registrado em: {new Date(r.registrationTimestamp).toLocaleString('pt-BR')}
                </p>
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => handleAction(r, 'approve')} className="btn-success text-xs">✅ Aprovar</button>
                  <button onClick={() => handleAction(r, 'adjust')} className="btn-primary text-xs">✏️ Ajustar</button>
                  <button onClick={() => handleAction(r, 'excuse')} className="btn-secondary text-xs">🟢 Abonar</button>
                  <button onClick={() => handleAction(r, 'absence')} className="btn-danger text-xs">❌ Falta</button>
                  <button onClick={() => handleAction(r, 'holiday')} className="btn-warning text-xs">🏖️ Feriado</button>
                  <button onClick={() => handleAction(r, 'medical')} className="btn-secondary text-xs">🏥 Atestado</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {records.length === 0 && (
          <div className="glass-card-static text-center py-12">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-[var(--color-surface-300)]">
              {filter === 'pending'
                ? `Todos os pontos estão homologados para ${months[selectedMonth]} ${selectedYear}`
                : 'Nenhum registro encontrado para os filtros selecionados'}
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {selectedRecord && (
        <div className="modal-overlay" onClick={() => setSelectedRecord(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-2">
              {getActionLabel(actionType)}
            </h2>
            <p className="text-sm text-[var(--color-surface-300)] mb-6">
              {selectedRecord.userName} - {new Date(selectedRecord.date + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>

            {actionType === 'adjust' && (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-2">Nova Entrada</label>
                  <input type="time" value={newEntrada} onChange={e => setNewEntrada(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-2">Nova Saída</label>
                  <input type="time" value={newSaida} onChange={e => setNewSaida(e.target.value)} className="input-field" />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setSelectedRecord(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={confirmAction} className="btn-primary flex-1">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
