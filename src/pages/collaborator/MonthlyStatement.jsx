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
      case 'pending': return '🟡';
      case 'rejected': return '🔴';
      case 'absence': return '❌';
      case 'holiday': return '🏖️';
      case 'medical': return '🏥';
      default: return '🟡';
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">📊 Extrato Mensal</h1>
          <p className="text-[var(--color-surface-300)] text-sm mt-1">
            Acompanhe seus registros e saldo de horas
          </p>
        </div>
        <button onClick={exportPDF} className="btn-primary flex items-center gap-2">
          📄 Exportar PDF
        </button>
      </div>

      {/* Month selector */}
      <div className="glass-card-static flex items-center gap-4 flex-wrap">
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input-field w-auto">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i} style={{ background: '#1e293b' }}>{getMonthName(i)}</option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-field w-auto">
          {[2024, 2025, 2026].map(y => (
            <option key={y} value={y} style={{ background: '#1e293b' }}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass-card text-center">
            <p className="text-xs text-[var(--color-surface-300)] uppercase mb-1">Trabalhadas</p>
            <p className="text-xl font-bold text-white">{formatMinutes(summary.totalWorked)}</p>
          </div>
          <div className="glass-card text-center">
            <p className="text-xs text-[var(--color-surface-300)] uppercase mb-1">Esperado</p>
            <p className="text-xl font-bold text-white">{formatMinutes(summary.totalExpected)}</p>
          </div>
          <div className="glass-card text-center">
            <p className="text-xs text-[var(--color-surface-300)] uppercase mb-1">Saldo</p>
            <p className={`text-xl font-bold ${summary.balance >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {formatMinutes(summary.balance)}
            </p>
          </div>
          <div className="glass-card text-center">
            <p className="text-xs text-[var(--color-surface-300)] uppercase mb-1">Dias Trab.</p>
            <p className="text-xl font-bold text-white">{summary.daysWorked}</p>
          </div>
          <div className="glass-card text-center">
            <p className="text-xs text-[var(--color-surface-300)] uppercase mb-1">Faltas</p>
            <p className="text-xl font-bold text-[var(--color-warning)]">{summary.absences}</p>
          </div>
        </div>
      )}

      {/* Records table */}
      <div className="glass-card-static">
        <div className="table-container">
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
                    <td className="font-medium text-white">
                      {isSpecial ? '-' : formatMinutes(worked)}
                    </td>
                    <td className={balance >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                      {isSpecial ? '-' : formatMinutes(balance)}
                    </td>
                    <td>{getStatusIcon(r.status)} {r.status === 'approved' ? 'OK' : r.status === 'pending' ? 'Pend.' : r.status}</td>
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
