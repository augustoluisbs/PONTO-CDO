import { useState, useEffect, useMemo } from 'react';
import { getCurrentUser } from '../../services/auth';
import { getManagerCollaborators } from '../../services/companyService';
import { query } from '../../services/storage';
import { calculateDayMinutes, formatMinutes, calculateMonthSummary, getMonthName } from '../../services/timeCalculations';
import { generateMonthlyReport } from '../../services/pdfGenerator';

export default function MonthlyReport() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Signature API states
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [signStatus, setSignStatus] = useState(null);
  const manager = getCurrentUser();

  useEffect(() => {
    const collabs = getManagerCollaborators(manager);
    setEmployees(collabs);
    if (collabs.length > 0) {
      setSelectedEmployee(prev => prev || collabs[0]);
    }
  }, [manager]);

  const records = useMemo(() => {
    if (!selectedEmployee) return [];
    const allRecords = query('timeRecords', r => r.userId === selectedEmployee.id);
    return allRecords.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => a.date.localeCompare(b.date));
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

      // 1. Upload the Document
      const formData = new FormData();
      formData.append('file', pdfBlob, filename);

      const uploadRes = await fetch(`https://api.assinafy.com.br/v1/accounts/${workspaceId}/documents`, {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formData,
      });

      const documentJson = await uploadRes.json();
      if (!uploadRes.ok || documentJson.status >= 400) {
        throw new Error(`Upload falhou: ${documentJson.message || documentJson.status}`);
      }
      const documentId = documentJson.data?.id;
      if (!documentId) throw new Error(`ID do documento não encontrado na resposta: ${JSON.stringify(documentJson)}`);

      // 2. Create or Get Signers (Manager and Collaborator)
      const signersToRegister = [
        { name: managerName, email: managerEmail },
        { name: selectedEmployee.name, email: selectedEmployee.email }
      ];
      const registeredSignerIds = [];

      for (const signer of signersToRegister) {
        if (!signer.email) throw new Error(`E-mail ausente para o signatário: ${signer.name}`);
        
        const signerRes = await fetch(`https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers`, {
          method: 'POST',
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            full_name: signer.name,
            email: signer.email,
          }),
        });

        const signerJson = await signerRes.json();
        let currentSignerId = null;
        
        if (!signerRes.ok || signerJson.status >= 400) {
          if (signerJson.status === 400 && signerJson.message?.includes('já existe')) {
            // Fetch existing
            const getSignerRes = await fetch(`https://api.assinafy.com.br/v1/accounts/${workspaceId}/signers`, {
              method: 'GET',
              headers: { 'X-Api-Key': apiKey }
            });
            const getSignerJson = await getSignerRes.json();
            if (!getSignerRes.ok || getSignerJson.status >= 400) throw new Error(`Falha ao buscar signatário ${signer.email}`);
            
            let signersList = getSignerJson.data;
            if (signersList && Array.isArray(signersList.data)) signersList = signersList.data;
            if (!Array.isArray(signersList)) throw new Error(`Formato inesperado na listagem de signatários.`);
            
            const existingSigner = signersList.find(s => s.email === signer.email);
            if (!existingSigner) throw new Error(`Signatário ${signer.email} não encontrado na listagem.`);
            
            currentSignerId = existingSigner.id;
          } else {
            throw new Error(`Falha ao criar signatário ${signer.name}: ${signerJson.message || signerJson.status}`);
          }
        } else {
          currentSignerId = signerJson.data?.id;
        }
        
        if (!currentSignerId) throw new Error(`ID não retornado para ${signer.name}`);
        registeredSignerIds.push(currentSignerId);
      }

      // 2.5 Wait for document metadata processing (Polling)
      setSignStatus({ type: 'info', message: '⏳ Aguardando processamento do documento na Assinafy...' });
      let isReady = false;
      let attempts = 0;
      
      while (!isReady && attempts < 15) { // max ~45 seconds
        const checkDocRes = await fetch(`https://api.assinafy.com.br/v1/documents/${documentId}`, {
          method: 'GET',
          headers: { 'X-Api-Key': apiKey }
        });
        
        const checkDocJson = await checkDocRes.json();
        const docStatus = checkDocJson.data?.status;

        if (docStatus === 'metadata_ready' || docStatus === 'ready') {
          isReady = true;
        } else if (docStatus === 'failed') {
          throw new Error('O processamento do documento falhou internamente na Assinafy.');
        } else {
          attempts++;
          // Sleep for 3 seconds
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      if (!isReady) throw new Error('Tempo limite excedido aguardando o processamento do documento na Assinafy.');

      setSignStatus({ type: 'info', message: '✉️ Criando convite de assinatura...' });

      // 3. Request Signature (Assignment) for both Manager and Collaborator
      const signersPayload = registeredSignerIds.map(id => ({ id }));
      
      const assignRes = await fetch(`https://api.assinafy.com.br/v1/documents/${documentId}/assignments`, {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'virtual',
          signers: signersPayload,
        }),
      });

      const assignJson = await assignRes.json();
      if (!assignRes.ok || assignJson.status >= 400) {
        throw new Error(`Atribuição de assinatura falhou: ${assignJson.message || assignJson.status}`);
      }

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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">📋 Relatórios Mensais</h1>
          <p className="text-[var(--color-surface-300)] text-sm mt-1">
            Espelho de Ponto com assinatura digital
          </p>
        </div>
        <button onClick={exportPDF} className="btn-primary flex items-center gap-2" disabled={!selectedEmployee}>
          📄 Exportar PDF
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card-static flex items-center gap-4 flex-wrap">
        <select
          value={selectedEmployee?.id || ''}
          onChange={e => setSelectedEmployee(employees.find(em => em.id === e.target.value))}
          className="input-field w-auto"
        >
          {employees.map(emp => (
            <option key={emp.id} value={emp.id} style={{ background: '#1e293b' }}>{emp.name}</option>
          ))}
        </select>
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

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card text-center">
            <p className="text-xs text-[var(--color-surface-300)] uppercase mb-1">Trabalhadas</p>
            <p className="text-xl font-bold text-white">{formatMinutes(summary.totalWorked)}</p>
          </div>
          <div className="glass-card text-center">
            <p className="text-xs text-[var(--color-surface-300)] uppercase mb-1">Saldo</p>
            <p className={`text-xl font-bold ${summary.balance >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {formatMinutes(summary.balance)}
            </p>
          </div>
          <div className="glass-card text-center">
            <p className="text-xs text-[var(--color-surface-300)] uppercase mb-1">Dias</p>
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
                    <td className="text-xs">{r.status}</td>
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
        <h2 className="text-lg font-semibold text-white mb-4">✍️ Envio para Assinatura (Assinafy)</h2>
        <p className="text-sm text-[var(--color-surface-300)] mb-4">
          Preencha os dados do gestor para enviar o espelho de ponto para assinatura digital via e-mail.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-1">Nome do Gestor</label>
            <input
              type="text"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="Ex: João Silva"
              className="input-field"
              disabled={isSigning}
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-1">E-mail do Gestor</label>
            <input
              type="email"
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              placeholder="Ex: joao@empresa.com"
              className="input-field"
              disabled={isSigning}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-3 items-center">
          <button 
            onClick={requestAssinafySignature} 
            className="btn-success text-sm flex items-center justify-center gap-2 min-w-[200px]"
            disabled={isSigning || !selectedEmployee}
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
        </div>

        {signStatus && (
          <div className={`mt-4 p-3 rounded-lg border text-sm ${signStatus.type === 'success' ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]/20 text-[var(--color-success)]' : 'bg-[var(--color-danger)]/10 border-[var(--color-danger)]/20 text-[var(--color-danger)]'}`}>
            {signStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}
