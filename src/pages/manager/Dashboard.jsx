import { useMemo } from 'react';
import { getCurrentUser } from '../../services/auth';
import { getManagerCollaborators, getAllManagerTimeRecords, getCompany } from '../../services/companyService';
import { calculateDayMinutes, formatMinutes, calculateMonthSummary } from '../../services/timeCalculations';

export default function ManagerDashboard() {
  const manager = getCurrentUser();
  const company = getCompany(manager?.companyId);

  const stats = useMemo(() => {
    const now = new Date();
    const users = getManagerCollaborators(manager);
    const records = getAllManagerTimeRecords(manager);
    const pending = records.filter(r => r.status === 'pending');

    const monthRecords = records.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    const totalWorked = monthRecords.reduce((sum, r) => sum + calculateDayMinutes(r), 0);
    const absences = monthRecords.filter(r => r.status === 'absence').length;

    return {
      totalCollabs: users.length,
      pendingRecords: pending.length,
      absences,
      totalHours: totalWorked,
    };
  }, [manager]);

  const pendingList = useMemo(() => {
    const users = getManagerCollaborators(manager);
    const records = getAllManagerTimeRecords(manager);
    const pending = records.filter(r => r.status === 'pending');

    return pending.slice(0, 10).map(r => {
      const user = users.find(u => u.id === r.userId);
      return { ...r, userName: user?.name || 'Desconhecido' };
    });
  }, [manager]);

  const collabData = useMemo(() => {
    const now = new Date();
    const users = getManagerCollaborators(manager);
    const records = getAllManagerTimeRecords(manager);
    const monthRecords = records.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    return users.map(u => {
      const userMonthRec = monthRecords.filter(r => r.userId === u.id);
      const summary = calculateMonthSummary(userMonthRec, u.dailyHours || 8);
      return {
        name: u.name?.split(' ').slice(0, 2).join(' '),
        absences: summary.absences,
        overtime: summary.overtime,
        totalWorked: summary.totalWorked,
      };
    });
  }, [manager]);

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">👑 Painel do Gestor</h1>
        {company && (
          <p className="text-[var(--color-brand-400)] text-sm mt-0.5 font-medium">
            🏢 {company.name}
          </p>
        )}
        <p className="text-[var(--color-surface-300)] text-sm mt-0.5">
          Centro de controle e homologação
          {manager?.accessScope === 'assigned' && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)]">
              Acesso por atribuição
            </span>
          )}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card text-center">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-2">Colaboradores</p>
          <p className="text-3xl font-bold text-white">{stats.totalCollabs}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">visíveis</p>
        </div>
        <div className="glass-card text-center" style={{ animation: stats.pendingRecords > 0 ? 'pulse-glow 2s infinite' : 'none' }}>
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-2">Pendentes</p>
          <p className="text-3xl font-bold text-[var(--color-warning)]">{stats.pendingRecords}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">p/ homologar</p>
        </div>
        <div className="glass-card text-center">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-2">Faltas</p>
          <p className="text-3xl font-bold text-[var(--color-danger)]">{stats.absences}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">no mês</p>
        </div>
        <div className="glass-card text-center">
          <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-2">Horas Totais</p>
          <p className="text-3xl font-bold text-[var(--color-brand-300)]">{formatMinutes(stats.totalHours)}</p>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">no mês</p>
        </div>
      </div>

      {/* Absenteeism Chart */}
      <div className="glass-card-static">
        <h2 className="text-lg font-semibold text-white mb-4">📊 Absenteísmo por Colaborador</h2>
        <div className="space-y-3">
          {collabData.map((c, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-sm text-white w-40 truncate">{c.name}</span>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-6 rounded-lg overflow-hidden bg-white/5">
                  <div
                    className="h-full rounded-lg transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (c.totalWorked / ((c.totalWorked || 1) + (c.absences * 480))) * 100)}%`,
                      background: c.absences > 2
                        ? 'linear-gradient(90deg, #ef4444, #f87171)'
                        : 'linear-gradient(90deg, var(--color-brand-600), var(--color-brand-400))',
                    }}
                  />
                </div>
                {c.absences > 0 && (
                  <span className="text-xs text-[var(--color-danger)] font-medium whitespace-nowrap">
                    {c.absences} falta{c.absences > 1 ? 's' : ''}
                  </span>
                )}
                {c.overtime > 0 && (
                  <span className="text-xs text-[var(--color-success)] font-medium whitespace-nowrap">
                    +{formatMinutes(c.overtime)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {collabData.length === 0 && (
            <p className="text-[var(--color-surface-300)] text-sm">Nenhum colaborador visível para este gestor.</p>
          )}
        </div>
      </div>

      {/* Pending Records */}
      <div className="glass-card-static">
        <h2 className="text-lg font-semibold text-white mb-4">🟡 Registros Pendentes</h2>
        {pendingList.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Data</th>
                  <th>Entrada</th>
                  <th>Saída</th>
                  <th>Trabalhadas</th>
                </tr>
              </thead>
              <tbody>
                {pendingList.map(r => (
                  <tr key={r.id}>
                    <td className="text-white font-medium">{r.userName}</td>
                    <td>{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td>{r.entrada || '--:--'}</td>
                    <td>{r.saida || '--:--'}</td>
                    <td className="font-medium text-white">{formatMinutes(calculateDayMinutes(r))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[var(--color-surface-300)] text-sm">Nenhum registro pendente ✅</p>
        )}
      </div>
    </div>
  );
}
