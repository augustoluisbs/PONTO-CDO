import { useState } from 'react';
import { getCurrentUser } from '../../services/auth';
import { add, update, query, generateId } from '../../services/storage';
import { isFutureDate, getTodayStr, formatMinutes, calculateDayMinutes } from '../../services/timeCalculations';
import { generateRecordHash } from '../../services/hashService';
import { generateReceipt } from '../../services/pdfGenerator';

export default function TimeRegistration() {
  const user = getCurrentUser();
  const today = getTodayStr();
  const [date, setDate] = useState(today);
  const [entrada, setEntrada] = useState('');
  const [almocoIda, setAlmocoIda] = useState('');
  const [almocoVolta, setAlmocoVolta] = useState('');
  const [saida, setSaida] = useState('');
  const [message, setMessage] = useState(null);
  const [lastRecord, setLastRecord] = useState(null);

  // Load existing record when date changes
  const loadRecord = (d) => {
    setDate(d);
    setMessage(null);
    const existing = query('timeRecords', r => r.userId === user.id && r.date === d);
    if (existing.length > 0) {
      const rec = existing[0];
      setEntrada(rec.entrada || '');
      setAlmocoIda(rec.almoco_ida || '');
      setAlmocoVolta(rec.almoco_volta || '');
      setSaida(rec.saida || '');
    } else {
      setEntrada('');
      setAlmocoIda('');
      setAlmocoVolta('');
      setSaida('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isFutureDate(date)) {
      setMessage({ type: 'error', text: '🚫 Não é permitido registrar ponto para datas futuras!' });
      return;
    }

    if (!entrada) {
      setMessage({ type: 'error', text: 'Informe ao menos o horário de entrada.' });
      return;
    }

    const existing = query('timeRecords', r => r.userId === user.id && r.date === date);
    const now = new Date().toISOString();

    const recordData = {
      userId: user.id,
      date,
      entrada,
      almoco_ida: almocoIda || null,
      almoco_volta: almocoVolta || null,
      saida: saida || null,
      status: 'pending',
      homologated: false,
      homologatedBy: null,
      homologatedAt: null,
      loginTimestamp: now,
      registrationTimestamp: now,
    };

    let record;
    if (existing.length > 0) {
      record = update('timeRecords', existing[0].id, recordData);
    } else {
      record = add('timeRecords', { ...recordData, id: generateId() });
    }

    record.hash = generateRecordHash(record);
    update('timeRecords', record.id, { hash: record.hash });

    setLastRecord(record);
    setMessage({ type: 'success', text: '✅ Ponto registrado com sucesso!' });
  };

  const downloadReceipt = () => {
    if (!lastRecord) return;
    const { doc } = generateReceipt(lastRecord, user);
    doc.save(`comprovante_${lastRecord.date}_${user.matricula}.pdf`);
  };

  const shareWhatsApp = () => {
    if (!lastRecord) return;
    const worked = formatMinutes(calculateDayMinutes(lastRecord));
    const text = encodeURIComponent(
      `📋 Comprovante PontoFlow\n` +
      `👤 ${user.name}\n` +
      `📅 ${new Date(lastRecord.date + 'T12:00:00').toLocaleDateString('pt-BR')}\n` +
      `⏰ Entrada: ${lastRecord.entrada || '--:--'}\n` +
      `🍽️ Almoço: ${lastRecord.almoco_ida || '--:--'} - ${lastRecord.almoco_volta || '--:--'}\n` +
      `🏠 Saída: ${lastRecord.saida || '--:--'}\n` +
      `⏱️ Total: ${worked}\n` +
      `🔐 Hash: ${lastRecord.hash?.substring(0, 16)}...`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const workedMinutes = entrada && saida ? calculateDayMinutes({
    entrada, almoco_ida: almocoIda, almoco_volta: almocoVolta, saida
  }) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">⏱️ Registrar Ponto</h1>
        <p className="text-[var(--color-surface-300)] text-sm mt-1">
          Registre seus horários de entrada, almoço e saída
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card-static space-y-5">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">
            📅 Data
          </label>
          <input
            type="date"
            value={date}
            max={today}
            onChange={e => loadRecord(e.target.value)}
            className="input-field"
          />
          {isFutureDate(date) && (
            <p className="text-[var(--color-danger)] text-xs mt-1">
              ⚠️ Datas futuras não são permitidas
            </p>
          )}
        </div>

        {/* Time inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">
              🟢 Entrada
            </label>
            <input
              type="time"
              value={entrada}
              onChange={e => setEntrada(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">
              🍽️ Almoço (Saída)
            </label>
            <input
              type="time"
              value={almocoIda}
              onChange={e => setAlmocoIda(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">
              🍽️ Almoço (Retorno)
            </label>
            <input
              type="time"
              value={almocoVolta}
              onChange={e => setAlmocoVolta(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">
              🔴 Saída
            </label>
            <input
              type="time"
              value={saida}
              onChange={e => setSaida(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        {/* Preview */}
        {entrada && saida && (
          <div className="bg-[var(--color-brand-900)]/30 rounded-xl p-4 border border-[var(--color-brand-500)]/20">
            <p className="text-sm text-[var(--color-surface-300)]">Total estimado:</p>
            <p className="text-2xl font-bold text-[var(--color-brand-300)]">
              {formatMinutes(workedMinutes)}
            </p>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`text-sm px-4 py-3 rounded-xl ${
            message.type === 'error'
              ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20'
              : 'bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20'
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={isFutureDate(date)}
          className="btn-primary w-full py-3"
        >
          Registrar Ponto
        </button>

        {/* Receipt actions */}
        {lastRecord && message?.type === 'success' && (
          <div className="flex gap-3">
            <button type="button" onClick={downloadReceipt} className="btn-secondary flex-1 flex items-center justify-center gap-2">
              📄 Baixar PDF
            </button>
            <button type="button" onClick={shareWhatsApp} className="btn-success flex-1 flex items-center justify-center gap-2">
              📱 WhatsApp
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
