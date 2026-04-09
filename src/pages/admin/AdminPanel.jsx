import { useState, useMemo } from 'react';
import { getCurrentUser, isAdmin } from '../../services/auth';
import { query, add, update, generateId } from '../../services/storage';
import { getAllCompanies } from '../../services/companyService';

// ─── Default form states ───────────────────────────────────────────────────
const emptyCompanyForm = { name: '', cnpj: '' };
const emptyManagerForm = { name: '', email: '', password: '', cpf: '', matricula: '', companyId: '', accessScope: 'all' };
const emptyColForm = {
  name: '', email: '', cpf: '', matricula: '', password: '123456',
  dailyHours: 8, weeklyHours: 40, lunchMinutes: 60, period: 'integral',
  companyId: '', assignedManagerIds: [],
};

export default function AdminPanel() {
  const currentAdmin = getCurrentUser();
  const [tab, setTab] = useState('companies');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [managerForm, setManagerForm] = useState(emptyManagerForm);
  const [colForm, setColForm] = useState(emptyColForm);
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState(null);

  const companies = useMemo(() => { void refreshKey; return query('companies', () => true); }, [refreshKey]);
  const managers  = useMemo(() => { void refreshKey; return query('users', u => u.role === 'manager'); }, [refreshKey]);
  const collabs   = useMemo(() => { void refreshKey; return query('users', u => u.role === 'collaborator'); }, [refreshKey]);
  const allCompanies = useMemo(() => getAllCompanies(), [refreshKey]);

  const reload = () => setRefreshKey(k => k + 1);
  const flash  = (type, text) => { setMessage({ type, text }); setTimeout(() => setMessage(null), 4000); };

  // ─── Company actions ───────────────────────────────────────────────────────
  const openNewCompany = () => { setEditingId(null); setCompanyForm(emptyCompanyForm); setShowModal('company'); };
  const openEditCompany = (c) => { setEditingId(c.id); setCompanyForm({ name: c.name, cnpj: c.cnpj || '' }); setShowModal('company'); };

  const handleCompanySubmit = (e) => {
    e.preventDefault();
    if (!companyForm.name.trim()) { flash('error', 'Nome da empresa é obrigatório.'); return; }
    if (editingId) {
      update('companies', editingId, { ...companyForm });
      flash('success', '✅ Empresa atualizada!');
    } else {
      add('companies', { id: generateId(), ...companyForm, active: true, createdAt: new Date().toISOString() });
      flash('success', '✅ Empresa criada!');
    }
    setShowModal(false); reload();
  };

  const toggleCompanyActive = (c) => { update('companies', c.id, { active: !c.active }); reload(); };

  // ─── Manager actions ───────────────────────────────────────────────────────
  const openNewManager = () => { setEditingId(null); setManagerForm(emptyManagerForm); setShowModal('manager'); };
  const openEditManager = (m) => {
    setEditingId(m.id);
    setManagerForm({ name: m.name, email: m.email, password: m.password || '', cpf: m.cpf || '', matricula: m.matricula || '', companyId: m.companyId || '', accessScope: m.accessScope || 'all' });
    setShowModal('manager');
  };

  const handleManagerSubmit = (e) => {
    e.preventDefault();
    if (!managerForm.name || !managerForm.email || !managerForm.password) { flash('error', 'Nome, email e senha são obrigatórios.'); return; }
    if (editingId) {
      update('users', editingId, { ...managerForm, role: 'manager' });
      flash('success', '✅ Gestor atualizado!');
    } else {
      const exists = query('users', u => u.email === managerForm.email);
      if (exists.length > 0) { flash('error', 'Email já cadastrado.'); return; }
      add('users', { id: generateId(), ...managerForm, role: 'manager', active: true });
      flash('success', '✅ Gestor cadastrado!');
    }
    setShowModal(false); reload();
  };

  // ─── Collaborator actions ──────────────────────────────────────────────────
  const openNewCollab = () => { setEditingId(null); setColForm(emptyColForm); setShowModal('collaborator'); };
  const openEditCollab = (c) => {
    setEditingId(c.id);
    setColForm({ name: c.name, email: c.email, cpf: c.cpf||'', matricula: c.matricula||'', password: c.password||'123456', dailyHours: c.dailyHours||8, weeklyHours: c.weeklyHours||40, lunchMinutes: c.lunchMinutes||60, period: c.period||'integral', companyId: c.companyId||'', assignedManagerIds: c.assignedManagerIds||[] });
    setShowModal('collaborator');
  };

  const handleCollabSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      update('users', editingId, { ...colForm, role: 'collaborator' });
    } else {
      add('users', { id: generateId(), ...colForm, role: 'collaborator', active: true });
    }
    setShowModal(false); reload();
  };

  const toggleActive = (user) => { update('users', user.id, { active: !user.active }); reload(); };

  const toggleManagerAssign = (mgrId) => {
    setColForm(f => ({
      ...f,
      assignedManagerIds: f.assignedManagerIds.includes(mgrId)
        ? f.assignedManagerIds.filter(id => id !== mgrId)
        : [...f.assignedManagerIds, mgrId],
    }));
  };

  const getCompanyName = (id) => companies.find(c => c.id === id)?.name || '—';
  const getScopeLabel = (s) => s === 'assigned' ? '🔒 Atribuídos' : '🌐 Todos da empresa';
  const getPeriodLabel = (p) => ({ integral: '🕐 Integral', matutino: '🌅 Matutino', vespertino: '🌇 Vespertino' }[p] || p);

  const companyManagers = useMemo(() => {
    if (!colForm.companyId) return managers;
    return managers.filter(m => m.companyId === colForm.companyId);
  }, [colForm.companyId, managers]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Empresas', value: companies.filter(c => c.active !== false).length, color: 'text-[var(--color-brand-300)]' },
    { label: 'Gestores', value: managers.filter(m => m.active !== false).length, color: 'text-white' },
    { label: 'Colaboradores', value: collabs.filter(c => c.active !== false).length, color: 'text-[var(--color-success)]' },
    { label: 'Inativos', value: [...managers,...collabs].filter(u => u.active === false).length, color: 'text-[var(--color-danger)]' },
  ];

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">🛡️ Painel Admin Master</h1>
          <p className="text-[var(--color-surface-300)] text-sm mt-1">
            Logado como: <span className="text-[var(--color-brand-400)] font-medium">{currentAdmin?.email}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          ⚡ Admin Master
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="glass-card text-center">
            <p className="text-xs text-[var(--color-surface-300)] uppercase tracking-wider mb-2">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Message flash */}
      {message && (
        <div className={`text-sm px-4 py-3 rounded-xl flex items-center justify-between ${
          message.type === 'error'
            ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20'
            : 'bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20'
        }`}>
          {message.text}
          <button className="opacity-60 hover:opacity-100 ml-4" onClick={() => setMessage(null)}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'companies', label: `🏢 Empresas (${companies.length})` },
          { key: 'managers',  label: `👑 Gestores (${managers.length})` },
          { key: 'collaborators', label: `👥 Colaboradores (${collabs.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'btn-primary' : 'btn-secondary'}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ COMPANIES TAB ═══════════ */}
      {tab === 'companies' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openNewCompany} className="btn-primary">+ Nova Empresa</button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {companies.map(c => (
              <div key={c.id} className={`glass-card-static transition-opacity ${c.active === false ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(67,56,202,0.2))', border: '1px solid rgba(99,102,241,0.3)' }}>
                        🏢
                      </div>
                      <div>
                        <p className="text-white font-semibold text-lg">{c.name}</p>
                        <p className="text-xs text-[var(--color-surface-300)]">CNPJ: {c.cnpj || 'Não informado'}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-3 text-xs text-[var(--color-surface-300)]">
                      <span>👑 {managers.filter(m => m.companyId === c.id).length} gestor(es)</span>
                      <span>👥 {collabs.filter(u => u.companyId === c.id).length} colaborador(es)</span>
                    </div>
                  </div>
                  <span className={c.active !== false ? 'status-approved' : 'status-rejected'}>
                    {c.active !== false ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => openEditCompany(c)} className="btn-secondary text-xs flex-1">✏️ Editar</button>
                  <button onClick={() => toggleCompanyActive(c)} className={`text-xs flex-1 ${c.active !== false ? 'btn-danger' : 'btn-success'}`}>
                    {c.active !== false ? '🚫 Desativar' : '✅ Ativar'}
                  </button>
                </div>
              </div>
            ))}
            {companies.length === 0 && (
              <div className="col-span-2 glass-card-static text-center py-10">
                <p className="text-4xl mb-2">🏢</p>
                <p className="text-[var(--color-surface-300)]">Nenhuma empresa cadastrada</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ MANAGERS TAB ═══════════ */}
      {tab === 'managers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openNewManager} className="btn-primary">+ Novo Gestor</button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {managers.map(m => (
              <div key={m.id} className={`glass-card-static transition-opacity ${m.active === false ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                      {m.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{m.name}</p>
                      <p className="text-xs text-[var(--color-surface-300)]">{m.email}</p>
                      <p className="text-xs text-[var(--color-surface-300)] mt-0.5">
                        🏢 {getCompanyName(m.companyId)} • {getScopeLabel(m.accessScope)}
                      </p>
                    </div>
                  </div>
                  <span className={m.active !== false ? 'status-approved' : 'status-rejected'}>
                    {m.active !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => openEditManager(m)} className="btn-secondary text-xs flex-1">✏️ Editar</button>
                  <button onClick={() => toggleActive(m)} className={`text-xs flex-1 ${m.active !== false ? 'btn-danger' : 'btn-success'}`}>
                    {m.active !== false ? '🚫 Desativar' : '✅ Ativar'}
                  </button>
                </div>
              </div>
            ))}
            {managers.length === 0 && (
              <div className="col-span-2 glass-card-static text-center py-10">
                <p className="text-4xl mb-2">👑</p>
                <p className="text-[var(--color-surface-300)]">Nenhum gestor cadastrado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ COLLABORATORS TAB ═══════════ */}
      {tab === 'collaborators' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openNewCollab} className="btn-primary">+ Novo Colaborador</button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {collabs.map(c => (
              <div key={c.id} className={`glass-card-static transition-opacity ${c.active === false ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                      style={{ background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))' }}>
                      {c.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{c.name}</p>
                      <p className="text-xs text-[var(--color-surface-300)]">{c.email}</p>
                      <p className="text-xs text-[var(--color-surface-300)] mt-0.5">
                        🏢 {getCompanyName(c.companyId)} • {c.dailyHours}h/dia • {getPeriodLabel(c.period)}
                      </p>
                    </div>
                  </div>
                  <span className={c.active !== false ? 'status-approved' : 'status-rejected'}>
                    {c.active !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => openEditCollab(c)} className="btn-secondary text-xs flex-1">✏️ Editar</button>
                  <button onClick={() => toggleActive(c)} className={`text-xs flex-1 ${c.active !== false ? 'btn-danger' : 'btn-success'}`}>
                    {c.active !== false ? '🚫 Desativar' : '✅ Ativar'}
                  </button>
                </div>
              </div>
            ))}
            {collabs.length === 0 && (
              <div className="col-span-2 glass-card-static text-center py-10">
                <p className="text-4xl mb-2">👥</p>
                <p className="text-[var(--color-surface-300)]">Nenhum colaborador cadastrado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODAL: Company ═══ */}
      {showModal === 'company' && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6">{editingId ? '✏️ Editar Empresa' : '🏢 Nova Empresa'}</h2>
            <form onSubmit={handleCompanySubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--color-surface-300)] mb-1">Nome da Empresa *</label>
                <input value={companyForm.name} onChange={e => setCompanyForm({...companyForm, name: e.target.value})} className="input-field" required placeholder="Ex: Empresa Alpha Ltda" />
              </div>
              <div>
                <label className="block text-sm text-[var(--color-surface-300)] mb-1">CNPJ</label>
                <input value={companyForm.cnpj} onChange={e => setCompanyForm({...companyForm, cnpj: e.target.value})} className="input-field" placeholder="00.000.000/0001-00" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1">Salvar Empresa</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Manager ═══ */}
      {showModal === 'manager' && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6">{editingId ? '✏️ Editar Gestor' : '👑 Novo Gestor'}</h2>
            <form onSubmit={handleManagerSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--color-surface-300)] mb-1">Nome Completo *</label>
                <input value={managerForm.name} onChange={e => setManagerForm({...managerForm, name: e.target.value})} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Email *</label>
                  <input type="email" value={managerForm.email} onChange={e => setManagerForm({...managerForm, email: e.target.value})} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Senha *</label>
                  <input type="text" value={managerForm.password} onChange={e => setManagerForm({...managerForm, password: e.target.value})} className="input-field" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">CPF</label>
                  <input value={managerForm.cpf} onChange={e => setManagerForm({...managerForm, cpf: e.target.value})} className="input-field" placeholder="000.000.000-00" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Matrícula</label>
                  <input value={managerForm.matricula} onChange={e => setManagerForm({...managerForm, matricula: e.target.value})} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[var(--color-surface-300)] mb-1">Empresa *</label>
                <select value={managerForm.companyId} onChange={e => setManagerForm({...managerForm, companyId: e.target.value})} className="input-field" required style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <option value="" style={{ background: '#1e293b' }}>Selecione uma empresa...</option>
                  {allCompanies.map(c => <option key={c.id} value={c.id} style={{ background: '#1e293b' }}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--color-surface-300)] mb-2">Escopo de acesso</label>
                <div className="flex gap-2">
                  {[
                    { value: 'all', label: '🌐 Todos da empresa' },
                    { value: 'assigned', label: '🔒 Somente atribuídos' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setManagerForm({...managerForm, accessScope: opt.value})}
                      className={`flex-1 text-sm px-3 py-2 rounded-xl border transition-all ${
                        managerForm.accessScope === opt.value
                          ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/20 text-[var(--color-brand-300)]'
                          : 'border-white/10 text-[var(--color-surface-300)]'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[var(--color-surface-300)] mt-1.5 opacity-70">
                  {managerForm.accessScope === 'assigned'
                    ? 'Gestor vê apenas colaboradores com ele atribuído'
                    : 'Gestor vê todos os colaboradores da empresa'}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1">Salvar Gestor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Collaborator ═══ */}
      {showModal === 'collaborator' && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6">{editingId ? '✏️ Editar Colaborador' : '➕ Novo Colaborador'}</h2>
            <form onSubmit={handleCollabSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--color-surface-300)] mb-1">Nome Completo</label>
                <input value={colForm.name} onChange={e => setColForm({...colForm, name: e.target.value})} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Email</label>
                  <input type="email" value={colForm.email} onChange={e => setColForm({...colForm, email: e.target.value})} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Senha</label>
                  <input type="text" value={colForm.password} onChange={e => setColForm({...colForm, password: e.target.value})} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">CPF</label>
                  <input value={colForm.cpf} onChange={e => setColForm({...colForm, cpf: e.target.value})} className="input-field" placeholder="000.000.000-00" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Matrícula</label>
                  <input value={colForm.matricula} onChange={e => setColForm({...colForm, matricula: e.target.value})} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[var(--color-surface-300)] mb-1">Empresa</label>
                <select value={colForm.companyId} onChange={e => setColForm({...colForm, companyId: e.target.value, assignedManagerIds: []})} className="input-field" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <option value="" style={{ background: '#1e293b' }}>Selecione...</option>
                  {allCompanies.map(c => <option key={c.id} value={c.id} style={{ background: '#1e293b' }}>{c.name}</option>)}
                </select>
              </div>

              {companyManagers.length > 0 && (
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-2">
                    👤 Gestores atribuídos
                    <span className="text-xs opacity-60 ml-1">(para gestores com escopo &quot;atribuídos&quot;)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {companyManagers.map(m => (
                      <button key={m.id} type="button" onClick={() => toggleManagerAssign(m.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          colForm.assignedManagerIds.includes(m.id)
                            ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/20 text-[var(--color-brand-300)]'
                            : 'border-white/10 text-[var(--color-surface-300)] hover:border-white/20'
                        }`}>
                        {colForm.assignedManagerIds.includes(m.id) ? '✓ ' : ''}{m.name?.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <hr className="border-white/10" />
              <p className="text-sm font-medium text-[var(--color-brand-300)]">⏰ Jornada</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Horas/Dia</label>
                  <input type="number" value={colForm.dailyHours} onChange={e => setColForm({...colForm, dailyHours: Number(e.target.value)})} className="input-field" min="1" max="12" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Horas/Sem</label>
                  <input type="number" value={colForm.weeklyHours} onChange={e => setColForm({...colForm, weeklyHours: Number(e.target.value)})} className="input-field" min="1" max="60" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-surface-300)] mb-1">Almoço (min)</label>
                  <input type="number" value={colForm.lunchMinutes} onChange={e => setColForm({...colForm, lunchMinutes: Number(e.target.value)})} className="input-field" min="0" max="120" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[var(--color-surface-300)] mb-1">Período</label>
                <select value={colForm.period} onChange={e => setColForm({...colForm, period: e.target.value})} className="input-field" style={{ background: 'rgba(255,255,255,0.06)' }}>
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
