import { useState, useMemo } from 'react';
import { getCurrentUser } from '../../services/auth';
import { query, add, generateId } from '../../services/storage';

export default function Justifications() {
  const user = getCurrentUser();
  const [showModal, setShowModal] = useState(false);
  const [date, setDate] = useState('');
  const [type, setType] = useState('atestado');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const justifications = useMemo(() => {
    void refreshKey;
    const items = query('justifications', j => j.userId === user.id);
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [user.id, refreshKey]);

  const loadJustifications = () => setRefreshKey(k => k + 1);

  const handleSubmit = (e) => {
    e.preventDefault();
    add('justifications', {
      id: generateId(),
      userId: user.id,
      userName: user.name,
      date,
      type,
      description,
      fileName: fileName || 'documento.pdf',
      status: 'pending',
    });
    setShowModal(false);
    setDate('');
    setType('atestado');
    setDescription('');
    setFileName('');
    loadJustifications();
  };

  const getTypeLabel = (t) => {
    switch (t) {
      case 'atestado': return '🏥 Atestado Médico';
      case 'declaracao': return '📄 Declaração';
      case 'outro': return '📎 Outro';
      default: return t;
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">📎 Justificativas</h1>
          <p className="text-[var(--color-surface-300)] text-sm mt-1">
            Envie atestados e documentos de justificativa
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          + Nova Justificativa
        </button>
      </div>

      <div className="space-y-3">
        {justifications.map(j => (
          <div key={j.id} className="glass-card-static">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-white font-medium">{getTypeLabel(j.type)}</p>
                <p className="text-sm text-[var(--color-surface-300)] mt-1">
                  📅 {new Date(j.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
                <p className="text-sm text-[var(--color-surface-300)]">{j.description}</p>
                {j.fileName && (
                  <p className="text-xs text-[var(--color-brand-400)] mt-1">📁 {j.fileName}</p>
                )}
              </div>
              <span className={j.status === 'approved' ? 'status-approved' : 'status-pending'}>
                {j.status === 'approved' ? '🟢 Aprovada' : '🟡 Pendente'}
              </span>
            </div>
          </div>
        ))}
        {justifications.length === 0 && (
          <div className="glass-card-static text-center py-12">
            <p className="text-4xl mb-3">📎</p>
            <p className="text-[var(--color-surface-300)]">Nenhuma justificativa enviada</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6">Nova Justificativa</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">Data</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">Tipo</label>
                <select value={type} onChange={e => setType(e.target.value)} className="input-field" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <option value="atestado" style={{ background: '#1e293b' }}>🏥 Atestado Médico</option>
                  <option value="declaracao" style={{ background: '#1e293b' }}>📄 Declaração</option>
                  <option value="outro" style={{ background: '#1e293b' }}>📎 Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">Descrição</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="input-field" rows="3" placeholder="Descreva a justificativa..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-surface-300)] mb-2">Documento (simulado)</label>
                <input
                  type="file"
                  onChange={e => setFileName(e.target.files?.[0]?.name || '')}
                  className="input-field"
                  accept="image/*,.pdf"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1">Enviar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
