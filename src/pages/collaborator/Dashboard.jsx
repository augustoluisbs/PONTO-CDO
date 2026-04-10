import { useMemo } from 'react';
import { getCurrentUser } from '../../services/auth';
import { query } from '../../services/storage';
import { calculateDayMinutes, formatMinutes, calculateMonthSummary, getTodayStr } from '../../services/timeCalculations';

export default function CollaboratorDashboard() {
  const user = getCurrentUser();
  const allRecords = useMemo(() => {
    return query('timeRecords', r => r.userId === user.id);
  }, [user.id]);

  const todayRecord = useMemo(() => {
    const today = getTodayStr();
    return allRecords.find(r => r.date === today) || null;
  }, [allRecords]);

  const recentRecords = useMemo(() => {
    const sorted = [...allRecords].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.slice(0, 7);
  }, [allRecords]);

  const monthSummary = useMemo(() => {
    const now = new Date();
    const monthRecords = allRecords.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return calculateMonthSummary(monthRecords, user.dailyHours || 8);
  }, [allRecords, user.dailyHours]);

  const getStatusBadge = (record) => {
    if (!record) return null;
    switch (record.status) {
      case 'approved': return <span className="status-approved">🟢 Homologado</span>;
      case 'pending': return <span className="status-pending">🟡 Pendente</span>;
      case 'rejected': return <span className="status-rejected">🔴 Ajuste</span>;
      case 'absence': return <span className="status-rejected">❌ Falta</span>;
      case 'holiday': return <span className="status-approved">🏖️ Feriado</span>;
      case 'medical': return <span className="status-approved">🏥 Atestado</span>;
      default: return <span className="status-pending">🟡 Pendente</span>;
    }
  };

  const todayWorked = todayRecord ? calculateDayMinutes(todayRecord) : 0;

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Olá, {user.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-[var(--color-surface-300)] text-sm mt-1">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card text-center">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-2">Hoje</p>
          <p className="text-2xl font-bold text-white">{formatMinutes(todayWorked)}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">trabalhadas</p>
        </div>
        <div className="glass-card text-center">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-2">Mês</p>
          <p className="text-2xl font-bold text-white">{formatMinutes(monthSummary?.totalWorked || 0)}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">trabalhadas</p>
        </div>
        <div className="glass-card text-center">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-2">Saldo</p>
          <p className={`text-2xl font-bold ${(monthSummary?.balance || 0) >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
            {formatMinutes(monthSummary?.balance || 0)}
          </p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">horas</p>
        </div>
        <div className="glass-card text-center">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-2">Faltas</p>
          <p className="text-2xl font-bold text-[var(--color-warning)]">{monthSummary?.absences || 0}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">no mês</p>
        </div>
      </div>

      {/* Today's Status */}
      <div className="glass-card-static">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          ⏰ Registro de Hoje
        </h2>
        {todayRecord ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-[var(--color-surface-300)] mb-1">Entrada</p>
              <p className="text-lg font-semibold text-white">{todayRecord.entrada || '--:--'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-surface-300)] mb-1">Alm. Saída</p>
              <p className="text-lg font-semibold text-white">{todayRecord.almoco_ida || '--:--'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-surface-300)] mb-1">Alm. Retorno</p>
              <p className="text-lg font-semibold text-white">{todayRecord.almoco_volta || '--:--'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-surface-300)] mb-1">Saída</p>
              <p className="text-lg font-semibold text-white">{todayRecord.saida || '--:--'}</p>
            </div>
          </div>
        ) : (
          <p className="text-[var(--color-surface-300)] text-sm">
            Nenhum registro hoje. <a href="/registrar" className="text-[var(--color-brand-400)] hover:underline">Registrar agora →</a>
          </p>
        )}
      </div>

      {/* Recent Records */}
      <div className="glass-card-static">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          📋 Últimos Registros
        </h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Entrada</th>
                <th>Saída</th>
                <th>Trabalhadas</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentRecords.map(r => (
                <tr key={r.id}>
                  <td className="text-white font-medium">
                    {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td>{r.entrada || '--:--'}</td>
                  <td>{r.saida || '--:--'}</td>
                  <td className="font-medium text-white">{formatMinutes(calculateDayMinutes(r))}</td>
                  <td>{getStatusBadge(r)}</td>
                </tr>
              ))}
              {recentRecords.length === 0 && (
                <tr><td colSpan="5" className="text-center text-[var(--color-surface-300)] py-4">Nenhum registro encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly Hours Bar */}
      <div className="glass-card-static">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          📊 Horas da Semana
        </h2>
        <div className="flex items-end gap-2 h-32">
          {recentRecords.slice(0, 5).reverse().map((r, i) => {
            const worked = calculateDayMinutes(r);
            const expected = (user.dailyHours || 8) * 60;
            const pct = Math.min(100, (worked / expected) * 100);
            const dayLabel = new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' });
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-[var(--color-surface-300)]">{formatMinutes(worked)}</span>
                <div className="w-full rounded-t-lg transition-all duration-500"
                  style={{
                    height: `${pct}%`,
                    minHeight: '4px',
                    background: pct >= 100
                      ? 'linear-gradient(to top, var(--color-success), #34d399)'
                      : pct >= 80
                        ? 'linear-gradient(to top, var(--color-brand-600), var(--color-brand-400))'
                        : 'linear-gradient(to top, var(--color-warning), #fbbf24)',
                  }}
                />
                <span className="text-xs text-[var(--color-surface-300)]">{dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
