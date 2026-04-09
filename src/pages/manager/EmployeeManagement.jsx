import { useState, useMemo } from 'react';
import { getCurrentUser, isAdmin } from '../../services/auth';
import { add, update, generateId, query } from '../../services/storage';
import { getManagerCollaborators, getAllCompanies } from '../../services/companyService';

const emptyForm = {
  name: '', email: '', cpf: '', matricula: '', password: '123456',
  dailyHours: 8, weeklyHours: 40, lunchMinutes: 60, period: 'integral',
  companyId: '', assignedManagerIds: [],
};

export default function EmployeeManagement() {
  const manager = getCurrentUser();
  const _isAdmin = isAdmin();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [refreshKey, setRefreshKey] = useState(0);

  const companies = useMemo(() => getAllCompanies(), []);

  const employees = useMemo(() => {
    void refreshKey;
    return getManagerCollaborators(manager);
  }, [manager, refreshKey]);

  const companyManagers = useMemo(() => {
    if (_isAdmin) {
      return query('users', u => u.role === 'manager');
    }
    return query('users', u => u.role === 'manager' && u.companyId === manager?.companyId);
  }, [manager, _isAdmin]);

  const reload = () => setRefreshKey(k => k + 1);

  const openNew = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      companyId: manager?.companyId || '',
    });
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditingId(emp.id);
    setForm({
      name: emp.name, email: emp.email, cpf: emp.cpf || '', matricula: emp.matricula || '',
      password: emp.password || '123456', dailyHours: emp.dailyHours || 8,
      weeklyHours: emp.weeklyHours || 40, lunchMinutes: emp.lunchMinutes || 60,
      period: emp.period || 'integral',
      companyId: emp.companyId || manager?.companyId || '',
      assignedManagerIds: emp.assignedManagerIds || [],
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form, role: 'collaborator', active: true };
    if (editingId) {
      update('users', editingId, data);
    } else {
      add('users', { id: generateId(), ...data });
    }
    setShowModal(false);
    reload();
  };

  const toggleActive = (emp) => {
    update('users', emp.id, { active: !emp.active });
    reload();
  };

  const getPeriodLabel = (p) => {
    switch (p) {
      case 'integral': return '🕐 Integral';
      case 'matutino': return '🌅 Matutino';
      case 'vespertino': return '🌇 Vespertino';
      default: return p;
    }
  };

  const toggleManagerAssign = (mgrId) => {
    setForm(f => ({
      ...f,
      assignedManagerIds: f.assignedManagerIds.includes(mgrId)
        ? f.assignedManagerIds.filter(id => id !== mgrId)
        : [...f.assignedManagerIds, mgrId],
    }));
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">👥 Gestão de Colaboradores</h1>
          <p className="text-[var(--color-surface-300)] text-sm mt-1">
            Cadastre e gerencie seus colaboradores
          </p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          + Novo Colaborador
        </button>
      </div>

      {/* Employee list */}
      <div className="grid gap-4 lg:grid-cols-2">
        {employees.map(emp => (
          <div key={emp.id} className={`glass-card-static transition-opacity ${emp.active === false ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-brand-500)] to-[var(--color-brand-700)] flex items-center justify-center text-white font-bold text-sm">
                    {emp.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{emp.name}</p>
                    <p className="text-xs text-[var(--color-surface-300)]">{emp.email}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-[var(--color-surface-300)]">
                  <p>📋 {emp.matricula || 'N/A'} • 🪪 {emp.cpf || 'N/A'}</p>
                  <p>⏰ {emp.dailyHours || 8}h/dia • {emp.weeklyHours || 40}h/sem</p>
                  <p>{getPeriodLabel(emp.period)}</p>
                </div>
              </div>
              <span className={emp.active !== false ? 'status-approved' : 'status-rejected'}>
                {emp.active !== false ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => openEdit(emp)} className="btn-secondary text-xs flex-1">✏️ Editar</button>
              <button
                onClick={() => toggleActive(emp)}
                className={emp.active !== false ? 'btn-danger text-xs flex-1' : 'btn-success text-xs flex-1'}
              >
                {emp.active !== false ? '🚫 Desativar' : '✅ Ativar'}
              </button>
            </div>
          </div>
        ))}
        {employees.length === 0 && (
          <div className="col-span-2 glass-card-static text-center py-10">
            <p className="text-4xl mb-2">👥</p>
            <p className="text-[var(--color-surface-300)]">Nenhum colaborador visível para este gestor</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6">
              {editingId ? '✏️ Editar Colaborador' : '➕ Novo Colaborador'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--color-surface-300)] mb-1">Nome Completo</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Senha</label>
                  <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">CPF</label>
                  <input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} className="input-field" placeholder="000.000.000-00" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Matrícula</label>
                  <input value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} className="input-field" />
                </div>
              </div>

              {/* Company (admin can pick any, manager locked to their own) */}
              {_isAdmin ? (
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Empresa</label>
                  <select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })} className="input-field" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <option value="" style={{ background: '#1e293b' }}>Selecione...</option>
                    {companies.map(c => <option key={c.id} value={c.id} style={{ background: '#1e293b' }}>{c.name}</option>)}
                  </select>
                </div>
              ) : (
                <input type="hidden" value={form.companyId} />
              )}

              {/* Assigned managers */}
              {companyManagers.length > 0 && (
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-2">
                    👤 Gestores atribuídos
                    <span className="text-xs opacity-60 ml-1">(relevante se gestor tiver escopo &quot;atribuídos&quot;)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {companyManagers.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleManagerAssign(m.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          form.assignedManagerIds.includes(m.id)
                            ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/20 text-[var(--color-brand-300)]'
                            : 'border-white/10 text-[var(--color-surface-300)] hover:border-white/20'
                        }`}
                      >
                        {form.assignedManagerIds.includes(m.id) ? '✓ ' : ''}{m.name?.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <hr className="border-white/10" />
              <p className="text-sm font-medium text-[var(--color-brand-300)]">⏰ Configuração de Jornada</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Horas/Dia</label>
                  <input type="number" value={form.dailyHours} onChange={e => setForm({ ...form, dailyHours: Number(e.target.value) })} className="input-field" min="1" max="12" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Horas/Semana</label>
                  <input type="number" value={form.weeklyHours} onChange={e => setForm({ ...form, weeklyHours: Number(e.target.value) })} className="input-field" min="1" max="60" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Almoço (min)</label>
                  <input type="number" value={form.lunchMinutes} onChange={e => setForm({ ...form, lunchMinutes: Number(e.target.value) })} className="input-field" min="0" max="120" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[var(--color-surface-300)] mb-1">Período</label>
                <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className="input-field" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <option value="integral" style={{ background: '#1e293b' }}>🕐 Integral</option>
                  <option value="matutino" style={{ background: '#1e293b' }}>🌅 Matutino</option>
                  <option value="vespertino" style={{ background: '#1e293b' }}>🌇 Vespertino</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
