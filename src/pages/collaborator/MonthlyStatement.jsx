import { useState, useMemo } from 'react';
import { getCurrentUser } from '../../services/auth';
import { query } from '../../services/storage';
import { calculateDayMinutes, formatMinutes, calculateMonthSummary, getDayOfWeek, getMonthName } from '../../services/timeCalculations';
import { generateMonthlyReport } from '../../services/pdfGenerator';

export default function MonthlyStatement() {
  const user = getCurrentUser();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const records = useMemo(() => {
    const allRecords = query('timeRecords', r => r.userId === user.id);
    return allRecords.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [year, month, user.id]);

  const summary = useMemo(() => {
    if (records.length === 0) return null;
    return calculateMonthSummary(records, user.dailyHours || 8);
  }, [records, user.dailyHours]);

  const exportPDF = () => {
    const doc = generateMonthlyReport(records, user, month, year, summary);
    doc.save(`espelho_ponto_${user.matricula}_${year}_${String(month + 1).padStart(2, '0')}.pdf`);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return '🟢';
      case 'pending':  return '🟡';
      case 'rejected': return '🔴';
      case 'absence':  return '❌';
      case 'holiday':  return '🏖️';
      case 'medical':  return '🏥';
      default:         return '🟡';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved': return 'OK';
      case 'pending':  return 'Pend.';
      case 'absence':  return 'Falta';
      case 'holiday':  return 'Feriado';
      case 'medical':  return 'Atestado';
      default:         return status;
    }
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">📊 Extrato Mensal</h1>
          <p className="text-[var(--color-surface-300)] text-sm mt-1">
            Acompanhe seus registros e saldo de horas
          </p>
        </div>
        <button onClick={exportPDF} className="btn-primary flex items-center gap-2 text-sm">
          📄 Exportar PDF
        </button>
      </div>

      {/* Month / Year selector */}
      <div className="glass-card-static flex items-center gap-3 flex-wrap">
        <select
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          className="input-field flex-1 min-w-[120px]"
          style={{ minHeight: 'auto', padding: '8px 12px' }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i} style={{ background: '#1e293b' }}>{getMonthName(i)}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="input-field w-24"
          style={{ minHeight: 'auto', padding: '8px 12px' }}
        >
          {[2024, 2025, 2026].map(y => (
            <option key={y} value={y} style={{ background: '#1e293b' }}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Trabalhadas', value: formatMinutes(summary.totalWorked), color: 'text-white' },
            { label: 'Esperado',    value: formatMinutes(summary.totalExpected), color: 'text-white' },
            { label: 'Saldo',       value: formatMinutes(summary.balance), color: summary.balance >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]' },
            { label: 'Dias Trab.',  value: summary.daysWorked, color: 'text-white' },
            { label: 'Faltas',      value: summary.absences, color: 'text-[var(--color-warning)]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card text-center p-3">
              <p className="text-xs text-[var(--color-surface-300)] uppercase mb-1 tracking-wider">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Records — cards on mobile, table on desktop */}
      <div className="glass-card-static">
        <h2 className="text-base font-semibold text-white mb-4">
          📋 Registros de {getMonthName(month)} {year}
        </h2>

        {/* Mobile: card list */}
        <div className="lg:hidden space-y-2">
          {records.map(r => {
            const worked = calculateDayMinutes(r);
            const expected = (user.dailyHours || 8) * 60;
            const balance = worked - expected;
            const isSpecial = ['absence', 'holiday', 'medical'].includes(r.status);
            return (
              <div key={r.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{getStatusIcon(r.status)}</span>
                    <span className="text-sm font-semibold text-white">
                      {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-xs text-[var(--color-surface-300)]">{getDayOfWeek(r.date)}</span>
                  </div>
                  <span className={`text-xs font-medium ${balance >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                    {isSpecial ? getStatusLabel(r.status) : formatMinutes(balance)}
                  </span>
                </div>
                {!isSpecial && (
                  <div className="grid grid-cols-4 gap-1 text-center">
                    {[
                      { label: 'Entrada',   value: r.entrada },
                      { label: 'Alm.Saída', value: r.almoco_ida },
                      { label: 'Alm.Ret.',  value: r.almoco_volta },
                      { label: 'Saída',     value: r.saida },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-[var(--color-surface-300)]">{label}</p>
                        <p className="text-xs font-medium text-white">{value || '--:--'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {records.length === 0 && (
            <p className="text-center text-[var(--color-surface-300)] py-8 text-sm">Nenhum registro neste mês</p>
          )}
        </div>

        {/* Desktop: full table */}
        <div className="hidden lg:block table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Dia</th>
                <th>Entrada</th>
                <th>Alm. Saída</th>
                <th>Alm. Ret.</th>
                <th>Saída</th>
                <th>Trabalhadas</th>
                <th>Saldo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const worked = calculateDayMinutes(r);
                const expected = (user.dailyHours || 8) * 60;
                const balance = worked - expected;
                const isSpecial = ['absence', 'holiday', 'medical'].includes(r.status);
                return (
                  <tr key={r.id}>
                    <td className="text-white font-medium">
                      {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td>{getDayOfWeek(r.date)}</td>
                    <td>{isSpecial ? '-' : (r.entrada || '--:--')}</td>
                    <td>{isSpecial ? '-' : (r.almoco_ida || '--:--')}</td>
                    <td>{isSpecial ? '-' : (r.almoco_volta || '--:--')}</td>
                    <td>{isSpecial ? '-' : (r.saida || '--:--')}</td>
                    <td className="font-medium text-white">{isSpecial ? '-' : formatMinutes(worked)}</td>
                    <td className={balance >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                      {isSpecial ? '-' : formatMinutes(balance)}
                    </td>
                    <td>{getStatusIcon(r.status)} {getStatusLabel(r.status)}</td>
                  </tr>
                );
              })}
              {records.length === 0 && (
                <tr><td colSpan="9" className="text-center text-[var(--color-surface-300)] py-8">Nenhum registro neste mês</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
