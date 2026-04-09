import { useState, useMemo } from 'react';
import { getCurrentUser } from '../../services/auth';
import { add, query, generateId } from '../../services/storage';

export default function VacationRequest() {
  const user = getCurrentUser();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const vacations = useMemo(() => {
    void refreshKey;
    return query('vacations', v => v.userId === user.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [user.id, refreshKey]);

  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const s = new Date(start + 'T12:00:00');
    const e = new Date(end + 'T12:00:00');
    const diffTime = e - s;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const totalUsedDays = useMemo(() => {
    return vacations
      .filter(v => v.status === 'approved')
      .reduce((sum, v) => sum + calculateDays(v.startDate, v.endDate), 0);
  }, [vacations]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage(null);

    if (!startDate || !endDate) {
      setMessage({ type: 'error', text: 'Informe as datas de início e fim.' });
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setMessage({ type: 'error', text: 'A data de fim deve ser após a data de início.' });
      return;
    }

    const days = calculateDays(startDate, endDate);
    if (days > 30) {
      setMessage({ type: 'error', text: 'O período máximo de férias é de 30 dias.' });
      return;
    }

    if (totalUsedDays + days > 30) {
      setMessage({ type: 'error', text: `Saldo insuficiente. Você tem ${30 - totalUsedDays} dias restantes.` });
      return;
    }

    add('vacations', {
      id: generateId(),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      startDate,
      endDate,
      days,
      notes: notes || null,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
    });

    setMessage({ type: 'success', text: '✅ Solicitação de férias enviada com sucesso!' });
    setStartDate('');
    setEndDate('');
    setNotes('');
    setRefreshKey(k => k + 1);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <span className="status-approved">✅ Aprovado</span>;
      case 'pending': return <span className="status-pending">🟡 Pendente</span>;
      case 'rejected': return <span className="status-rejected">❌ Rejeitado</span>;
      default: return <span className="status-pending">{status}</span>;
    }
  };

  const daysPreview = calculateDays(startDate, endDate);

  return (
    <div className="max-w-3xl mx-auto space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">🏖️ Férias</h1>
        <p className="text-[var(--color-surface-300)] text-sm mt-1">
          Solicite e acompanhe suas férias
        </p>
      </div>

      {/* Balance card */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card text-center">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-2">Direito</p>
          <p className="text-2xl font-bold text-white">30</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">dias</p>
        </div>
        <div className="glass-card text-center">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-2">Utilizados</p>
          <p className="text-2xl font-bold text-[var(--color-warning)]">{totalUsedDays}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">dias</p>
        </div>
        <div className="glass-card text-center">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-2">Saldo</p>
          <p className="text-2xl font-bold text-[var(--color-success)]">{30 - totalUsedDays}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">dias</p>
        </div>
      </div>

      {/* Request form */}
      <form onSubmit={handleSubmit} className="glass-card-static space-y-5">
        <h2 className="text-lg font-semibold text-white">📝 Nova Solicitação</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">
              📅 Data Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">
              📅 Data Fim
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="input-field"
              required
            />
          </div>
        </div>

        {startDate && endDate && daysPreview > 0 && (
          <div className="bg-[var(--color-brand-900)]/30 rounded-xl p-4 border border-[var(--color-brand-500)]/20">
            <p className="text-sm text-[var(--color-surface-300)]">Período solicitado:</p>
            <p className="text-2xl font-bold text-[var(--color-brand-300)]">
              {daysPreview} {daysPreview === 1 ? 'dia' : 'dias'}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">
            📋 Observações (opcional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="input-field"
            rows="2"
            placeholder="Alguma observação sobre o pedido..."
            style={{ resize: 'vertical' }}
          />
        </div>

        {message && (
          <div className={`text-sm px-4 py-3 rounded-xl ${
            message.type === 'error'
              ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20'
              : 'bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20'
          }`}>
            {message.text}
          </div>
        )}

        <button type="submit" className="btn-primary w-full py-3">
          Solicitar Férias
        </button>
      </form>

      {/* Vacation list */}
      <div className="glass-card-static">
        <h2 className="text-lg font-semibold text-white mb-4">📋 Minhas Solicitações</h2>

        {vacations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🏖️</p>
            <p className="text-[var(--color-surface-300)]">Nenhuma solicitação de férias</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vacations.map(v => (
              <div key={v.id} className="bg-white/5 rounded-xl p-4 border border-white/5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-white font-medium">
                      {new Date(v.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(v.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-sm text-[var(--color-surface-300)] mt-1">
                      {v.days} {v.days === 1 ? 'dia' : 'dias'} • Solicitado em {new Date(v.requestedAt).toLocaleDateString('pt-BR')}
                    </p>
                    {v.notes && (
                      <p className="text-xs text-[var(--color-surface-300)] mt-1 italic">"{v.notes}"</p>
                    )}
                  </div>
                  {getStatusBadge(v.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
