import { useState, useEffect, useMemo } from 'react';
import { getCurrentUser } from '../../services/auth';
import { getManagerCollaborators } from '../../services/companyService';
import { query } from '../../services/storage';
import { calculateDayMinutes, formatMinutes, calculateMonthSummary, getMonthName } from '../../services/timeCalculations';
import { generateMonthlyReport } from '../../services/pdfGenerator';

const STATUS_ICON = {
  approved: '🟢', pending: '🟡', rejected: '🔴',
  absence: '❌', holiday: '🏖️', medical: '🏥',
};
const STATUS_LABEL = {
  approved: 'OK', pending: 'Pend.', rejected: 'Ajuste',
  absence: 'Falta', holiday: 'Feriado', medical: 'Atestado',
};

export default function MonthlyReport() {
  const manager = getCurrentUser();
  const now = new Date();

  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Assinafy signature states
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [signStatus, setSignStatus] = useState(null);

  // Load collaborators on mount — always reset to first one (fixes navigation stale state)
  useEffect(() => {
    const collabs = getManagerCollaborators(manager);
    setEmployees(collabs);
    // Always reset selection when mounting/returning to this page
    if (collabs.length > 0) {
      setSelectedEmployeeId(collabs[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs once on mount

  const selectedEmployee = useMemo(
    () => employees.find(e => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const records = useMemo(() => {
    if (!selectedEmployee) return [];
    return query('timeRecords', r => r.userId === selectedEmployee.id)
      .filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedEmployee, year, month]);

  const summary = useMemo(() => {
    if (!selectedEmployee || records.length === 0) return null;
    return calculateMonthSummary(records, selectedEmployee.dailyHours || 8);
  }, [records, selectedEmployee]);

  const generateCurrentPDF = () => {
    if (!selectedEmployee || !summary) return null;
    return generateMonthlyReport(records, selectedEmployee, month, year, summary);
  };

  const exportPDF = () => {
    const doc = generateCurrentPDF();
    if (!doc) return;
    doc.save(`espelho_ponto_${selectedEmployee.matricula}_${year}_${String(month + 1).padStart(2, '0')}.pdf`);
  };

  const requestAssinafySignature = async () => {
    setSignStatus(null);
    if (!managerName || !managerEmail) {
      setSignStatus({ type: 'error', message: 'Preencha o nome e e-mail do gestor.' });
      return;
    }
    const apiKey = import.meta.env.VITE_ASSINAFY_API_KEY;
    const workspaceId = import.meta.env.VITE_ASSINAFY_WORKSPACE_ID;
    if (!apiKey || !workspaceId) {
      setSignStatus({ type: 'error', message: 'Faltam credenciais da Assinafy API (.env).' });
      return;
    }
    const doc = generateCurrentPDF();
    if (!doc) return;

    setIsSigning(true);
    try {
      const pdfBlob = doc.output('blob');
      const filename = `espelho_${selectedEmployee.matricula}_${year}_${String(month + 1).padStart(2, '0')}.pdf`;

      // 1. Upload
      const formData = new FormData();
      formData.append('file', pdfBlob, filename);
      const uploadRes = await fetch(`https://api.assinafy.com.br/v1/accounts/${workspaceId}/documents`, {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formData,
      });
      const documentJson = await uploadRes.json();
      if (!uploadRes.ok || documentJson.status >= 400) throw new Error(`Upload falhou: ${documentJson.message || documentJson.status}`);
      const documentId = documentJson.data?.id;
      if (!documentId) throw new Error(`ID do documento não encontrado: ${JSON.stringify(documentJson)}`);

      // 2. Create/Get Signers
      const signersToRegister = [
        { name: managerName, email: managerEmail },
        { name: selectedEmployee.name, email: selectedEmployee.email },
      ];
      const registeredSignerIds = [];
      for (const signer of signersToRegister) {
        if (!signer.email) throw new Error(`E-mail ausente para: ${signer.name}`);
        const signerRes = await fetch(`https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers`, {
          method: 'POST',
          headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: signer.name, email: signer.email }),
        });
        const signerJson = await signerRes.json();
        let currentSignerId = null;
        if (!signerRes.ok || signerJson.status >= 400) {
          if (signerJson.status === 400 && signerJson.message?.includes('já existe')) {
            const getRes = await fetch(`https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers`, {
              headers: { 'X-Api-Key': apiKey },
            });
            const getJson = await getRes.json();
            let list = getJson.data;
            if (list && Array.isArray(list.data)) list = list.data;
            if (!Array.isArray(list)) throw new Error('Formato inesperado na listagem de signatários.');
            const existing = list.find(s => s.email === signer.email);
            if (!existing) throw new Error(`Signatário ${signer.email} não encontrado.`);
            currentSignerId = existing.id;
          } else {
            throw new Error(`Falha ao criar signatário ${signer.name}: ${signerJson.message || signerJson.status}`);
          }
        } else {
          currentSignerId = signerJson.data?.id;
        }
        if (!currentSignerId) throw new Error(`ID não retornado para ${signer.name}`);
        registeredSignerIds.push(currentSignerId);
      }

      // 3. Poll until ready
      setSignStatus({ type: 'info', message: '⏳ Aguardando processamento na Assinafy...' });
      let isReady = false, attempts = 0;
      while (!isReady && attempts < 15) {
        const checkRes = await fetch(`https://api.assinafy.com.br/v1/documents/${documentId}`, {
          headers: { 'X-Api-Key': apiKey },
        });
        const checkJson = await checkRes.json();
        const docStatus = checkJson.data?.status;
        if (docStatus === 'metadata_ready' || docStatus === 'ready') {
          isReady = true;
        } else if (docStatus === 'failed') {
          throw new Error('Processamento do documento falhou na Assinafy.');
        } else {
          attempts++;
          await new Promise(res => setTimeout(res, 3000));
        }
      }
      if (!isReady) throw new Error('Tempo limite excedido aguardando processamento.');

      // 4. Assign signatures
      setSignStatus({ type: 'info', message: '✉️ Criando convite de assinatura...' });
      const assignRes = await fetch(`https://api.assinafy.com.br/v1/documents/${documentId}/assignments`, {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'virtual', signers: registeredSignerIds.map(id => ({ id })) }),
      });
      const assignJson = await assignRes.json();
      if (!assignRes.ok || assignJson.status >= 400) throw new Error(`Atribuição falhou: ${assignJson.message || assignJson.status}`);

      setSignStatus({ type: 'success', message: '✅ Documento enviado para assinatura com sucesso!' });
      setManagerName('');
      setManagerEmail('');
    } catch (error) {
      console.error(error);
      setSignStatus({ type: 'error', message: `❌ Erro: ${error.message}` });
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">📋 Relatórios Mensais</h1>
          <p className="text-[var(--color-surface-300)] text-sm mt-1">
            Espelho de Ponto com assinatura digital
          </p>
        </div>
        <button
          onClick={exportPDF}
          className="btn-primary flex items-center gap-2 text-sm"
          disabled={!selectedEmployee || !summary}
          style={{ minHeight: 'auto', padding: '10px 20px' }}
        >
          📄 Exportar PDF
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card-static grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-[var(--color-surface-300)] mb-1.5 font-medium">Colaborador</label>
          <select
            value={selectedEmployeeId}
            onChange={e => setSelectedEmployeeId(e.target.value)}
            className="input-field"
            style={{ padding: '8px 12px', minHeight: 'auto' }}
          >
            {employees.map(emp => (
              <option key={emp.id} value={emp.id} style={{ background: '#1e293b' }}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-surface-300)] mb-1.5 font-medium">Mês</label>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="input-field"
            style={{ padding: '8px 12px', minHeight: 'auto' }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i} style={{ background: '#1e293b' }}>{getMonthName(i)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-surface-300)] mb-1.5 font-medium">Ano</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="input-field"
            style={{ padding: '8px 12px', minHeight: 'auto' }}
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y} style={{ background: '#1e293b' }}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employee info strip */}
      {selectedEmployee && (
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))' }}
          >
            {selectedEmployee.name?.charAt(0)}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{selectedEmployee.name}</p>
            <p className="text-xs text-[var(--color-surface-300)]">
              Matrícula: {selectedEmployee.matricula} · {selectedEmployee.dailyHours || 8}h/dia
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Trabalhadas', value: formatMinutes(summary.totalWorked), color: 'text-white' },
            { label: 'Saldo',       value: formatMinutes(summary.balance), color: summary.balance >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]' },
            { label: 'Dias',        value: summary.daysWorked, color: 'text-white' },
            { label: 'Faltas',      value: summary.absences, color: 'text-[var(--color-warning)]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card text-center p-3">
              <p className="text-xs text-[var(--color-surface-300)] uppercase mb-1 tracking-wider">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Records — mobile cards + desktop table */}
      <div className="glass-card-static">
        <h2 className="text-base font-semibold text-white mb-4">
          📅 Registros de {getMonthName(month)} {year}
          {selectedEmployee && <span className="text-[var(--color-surface-300)] font-normal"> · {selectedEmployee.name.split(' ')[0]}</span>}
        </h2>

        {/* MOBILE: card list */}
        <div className="lg:hidden space-y-2">
          {records.map(r => {
            const worked = calculateDayMinutes(r);
            const expected = (selectedEmployee?.dailyHours || 8) * 60;
            const balance = worked - expected;
            const isSpecial = ['absence', 'holiday', 'medical'].includes(r.status);
            return (
              <div key={r.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{STATUS_ICON[r.status] || '🟡'}</span>
                    <span className="text-sm font-semibold text-white">
                      {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${isSpecial ? 'text-[var(--color-surface-300)]' : balance >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                    {isSpecial ? STATUS_LABEL[r.status] : formatMinutes(balance)}
                  </span>
                </div>
                {!isSpecial && (
                  <div className="grid grid-cols-4 gap-1 text-center mt-1">
                    {[
                      { label: 'Entrada',    value: r.entrada },
                      { label: 'Alm.Saída',  value: r.almoco_ida },
                      { label: 'Alm.Ret.',   value: r.almoco_volta },
                      { label: 'Saída',      value: r.saida },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-[var(--color-surface-300)]">{label}</p>
                        <p className="text-xs font-medium text-white">{value || '--:--'}</p>
                      </div>
                    ))}
                  </div>
                )}
                {!isSpecial && (
                  <p className="text-xs text-[var(--color-surface-300)] mt-2 text-right">
                    Total: <span className="text-white font-medium">{formatMinutes(worked)}</span>
                  </p>
                )}
              </div>
            );
          })}
          {records.length === 0 && (
            <p className="text-center text-[var(--color-surface-300)] py-8 text-sm">Nenhum registro neste mês</p>
          )}
        </div>

        {/* DESKTOP: table */}
        <div className="hidden lg:block table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Entrada</th>
                <th>Alm. Saída</th>
                <th>Alm. Ret.</th>
                <th>Saída</th>
                <th>Trabalhadas</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const isSpecial = ['absence', 'holiday', 'medical'].includes(r.status);
                return (
                  <tr key={r.id}>
                    <td className="text-white font-medium">{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td>{isSpecial ? '-' : (r.entrada || '--:--')}</td>
                    <td>{isSpecial ? '-' : (r.almoco_ida || '--:--')}</td>
                    <td>{isSpecial ? '-' : (r.almoco_volta || '--:--')}</td>
                    <td>{isSpecial ? '-' : (r.saida || '--:--')}</td>
                    <td className="font-medium text-white">{isSpecial ? '-' : formatMinutes(calculateDayMinutes(r))}</td>
                    <td className="text-xs">{STATUS_ICON[r.status]} {STATUS_LABEL[r.status] || r.status}</td>
                  </tr>
                );
              })}
              {records.length === 0 && (
                <tr><td colSpan="7" className="text-center text-[var(--color-surface-300)] py-8">Nenhum registro</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Digital Signature */}
      <div className="glass-card-static">
        <h2 className="text-lg font-semibold text-white mb-1">✍️ Assinatura Digital (Assinafy)</h2>
        <p className="text-sm text-[var(--color-surface-300)] mb-4">
          Envie o espelho de ponto para assinatura digital via e-mail.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-1.5">Nome do Gestor</label>
            <input
              type="text"
              value={managerName}
              onChange={e => setManagerName(e.target.value)}
              placeholder="Ex: João Silva"
              className="input-field"
              disabled={isSigning}
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-1.5">E-mail do Gestor</label>
            <input
              type="email"
              value={managerEmail}
              onChange={e => setManagerEmail(e.target.value)}
              placeholder="Ex: joao@empresa.com"
              className="input-field"
              disabled={isSigning}
            />
          </div>
        </div>

        <button
          onClick={requestAssinafySignature}
          className="btn-success flex items-center justify-center gap-2 w-full sm:w-auto"
          disabled={isSigning || !selectedEmployee}
          style={{ padding: '10px 24px', minHeight: 'auto' }}
        >
          {isSigning ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              Enviando...
            </>
          ) : (
            '📤 Solicitar Assinatura'
          )}
        </button>

        {signStatus && (
          <div className={`mt-4 p-3 rounded-lg border text-sm ${
            signStatus.type === 'success'
              ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]/20 text-[var(--color-success)]'
              : signStatus.type === 'info'
                ? 'bg-[var(--color-info)]/10 border-[var(--color-info)]/20 text-[var(--color-info)]'
                : 'bg-[var(--color-danger)]/10 border-[var(--color-danger)]/20 text-[var(--color-danger)]'
          }`}>
            {signStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}
