import { useMemo } from 'react';
import { getCurrentUser } from '../../services/auth';
import { query } from '../../services/storage';
import { generateReceipt } from '../../services/pdfGenerator';
import { formatMinutes, calculateDayMinutes } from '../../services/timeCalculations';

export default function Receipts() {
  const user = getCurrentUser();
  const records = useMemo(() => {
    const allRecords = query('timeRecords', r => r.userId === user.id && r.entrada);
    return [...allRecords].sort((a, b) => b.date.localeCompare(a.date));
  }, [user.id]);

  const downloadReceipt = (record) => {
    const { doc } = generateReceipt(record, user);
    doc.save(`comprovante_${record.date}_${user.matricula}.pdf`);
  };

  const shareWhatsApp = (record) => {
    const worked = formatMinutes(calculateDayMinutes(record));
    const text = encodeURIComponent(
      `📋 Comprovante PontoFlow\n` +
      `👤 ${user.name}\n` +
      `📅 ${new Date(record.date + 'T12:00:00').toLocaleDateString('pt-BR')}\n` +
      `⏰ Entrada: ${record.entrada || '--:--'}\n` +
      `🍽️ Almoço: ${record.almoco_ida || '--:--'} - ${record.almoco_volta || '--:--'}\n` +
      `🏠 Saída: ${record.saida || '--:--'}\n` +
      `⏱️ Total: ${worked}\n` +
      `🔐 Hash: ${record.hash?.substring(0, 16)}...`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">📄 Comprovantes</h1>
        <p className="text-[var(--color-surface-300)] text-sm mt-1">
          Baixe ou compartilhe seus comprovantes de ponto
        </p>
      </div>

      <div className="space-y-3">
        {records.map(r => (
          <div key={r.id} className="glass-card-static flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-white font-medium">
                {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm text-[var(--color-surface-300)]">
                {r.entrada} - {r.saida || '--:--'} • {formatMinutes(calculateDayMinutes(r))} trabalhadas
              </p>
              {r.hash && (
                <p className="text-xs text-[var(--color-surface-300)] mt-1 font-mono">
                  🔐 {r.hash.substring(0, 24)}...
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => downloadReceipt(r)} className="btn-secondary text-sm flex items-center gap-1.5">
                📄 PDF
              </button>
              <button onClick={() => shareWhatsApp(r)} className="btn-success text-sm flex items-center gap-1.5">
                📱 WhatsApp
              </button>
            </div>
          </div>
        ))}
        {records.length === 0 && (
          <div className="glass-card-static text-center py-12">
            <p className="text-[var(--color-surface-300)]">Nenhum comprovante disponível</p>
          </div>
        )}
      </div>
    </div>
  );
}
