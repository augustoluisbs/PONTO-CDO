import { add, isSeeded, markSeeded, generateId } from './storage';
import { generateRecordHash } from './hashService';

export function seedDemoData() {
  if (isSeeded()) return;

  // ── Companies (Groups) ──────────────────────────────────────
  add('companies', {
    id: 'company-001',
    name: 'Empresa Alpha Ltda',
    cnpj: '12.345.678/0001-90',
    active: true,
    createdAt: new Date().toISOString(),
  });

  add('companies', {
    id: 'company-002',
    name: 'Beta Serviços S.A.',
    cnpj: '98.765.432/0001-10',
    active: true,
    createdAt: new Date().toISOString(),
  });

  // ── Admin master ─────────────────────────────────────────────
  add('users', {
    id: 'admin-master',
    name: 'Admin Master',
    email: 'augustoluis.bs@gmail.com',
    password: 'm172596*',
    cpf: '',
    matricula: 'ADM-000',
    role: 'admin',
    active: true,
  });

  // ── Managers ─────────────────────────────────────────────────
  // Manager 1 — Empresa Alpha, acesso a todos
  add('users', {
    id: 'manager-001',
    name: 'Ana Carolina Silva',
    email: 'ana@empresa.com',
    password: '123456',
    cpf: '123.456.789-00',
    matricula: 'GES-001',
    role: 'manager',
    companyId: 'company-001',
    accessScope: 'all',
    active: true,
  });

  // Manager 2 — Empresa Alpha, acesso somente a atribuídos
  add('users', {
    id: 'manager-002',
    name: 'Bruno Ferreira',
    email: 'bruno@empresa.com',
    password: '123456',
    cpf: '111.222.333-44',
    matricula: 'GES-002',
    role: 'manager',
    companyId: 'company-001',
    accessScope: 'assigned',
    active: true,
  });

  // Manager 3 — Empresa Beta, acesso a todos
  add('users', {
    id: 'manager-003',
    name: 'Carla Souza',
    email: 'carla@beta.com',
    password: '123456',
    cpf: '555.666.777-88',
    matricula: 'GES-003',
    role: 'manager',
    companyId: 'company-002',
    accessScope: 'all',
    active: true,
  });

  // ── Collaborators ─────────────────────────────────────────────
  const collabs = [
    {
      id: 'colab-001',
      name: 'Carlos Eduardo Santos',
      email: 'carlos@empresa.com',
      password: '123456',
      cpf: '234.567.890-11',
      matricula: 'COL-001',
      role: 'collaborator',
      companyId: 'company-001',
      assignedManagerIds: ['manager-001', 'manager-002'],
      dailyHours: 8, weeklyHours: 40, lunchMinutes: 60, period: 'integral', active: true,
    },
    {
      id: 'colab-002',
      name: 'Juliana Oliveira Costa',
      email: 'juliana@empresa.com',
      password: '123456',
      cpf: '345.678.901-22',
      matricula: 'COL-002',
      role: 'collaborator',
      companyId: 'company-001',
      assignedManagerIds: ['manager-001'],
      dailyHours: 8, weeklyHours: 40, lunchMinutes: 60, period: 'integral', active: true,
    },
    {
      id: 'colab-003',
      name: 'Rafael Mendes Lima',
      email: 'rafael@empresa.com',
      password: '123456',
      cpf: '456.789.012-33',
      matricula: 'COL-003',
      role: 'collaborator',
      companyId: 'company-001',
      assignedManagerIds: ['manager-002'],
      dailyHours: 6, weeklyHours: 30, lunchMinutes: 0, period: 'matutino', active: true,
    },
    {
      id: 'colab-004',
      name: 'Fernanda Alves',
      email: 'fernanda@beta.com',
      password: '123456',
      cpf: '789.012.345-66',
      matricula: 'COL-004',
      role: 'collaborator',
      companyId: 'company-002',
      assignedManagerIds: ['manager-003'],
      dailyHours: 8, weeklyHours: 40, lunchMinutes: 60, period: 'integral', active: true,
    },
  ];

  collabs.forEach(c => add('users', c));

  // ── Time Records (last 30 working days) ───────────────────────
  const today = new Date();
  for (let i = 30; i >= 1; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    const dateStr = date.toISOString().split('T')[0];

    collabs.forEach(c => {
      if (Math.random() < 0.08) {
        add('timeRecords', {
          id: generateId(),
          userId: c.id,
          companyId: c.companyId,
          date: dateStr,
          entrada: null, almoco_ida: null, almoco_volta: null, saida: null,
          status: 'absence',
          homologated: i > 5,
          homologatedBy: i > 5 ? 'manager-001' : null,
          homologatedAt: i > 5 ? new Date(date.getTime() + 86400000).toISOString() : null,
          loginTimestamp: date.toISOString(),
          registrationTimestamp: date.toISOString(),
        });
        return;
      }

      const entradaH = c.period === 'matutino' ? 7 : 8;
      const entradaM = Math.floor(Math.random() * 15);
      const saidaH = c.period === 'matutino' ? 13 : (17 + (Math.random() > 0.7 ? 1 : 0));
      const saidaM = Math.floor(Math.random() * 30);

      const record = {
        id: generateId(),
        userId: c.id,
        companyId: c.companyId,
        date: dateStr,
        entrada: `${String(entradaH).padStart(2, '0')}:${String(entradaM).padStart(2, '0')}`,
        almoco_ida: c.period === 'integral' ? '12:00' : null,
        almoco_volta: c.period === 'integral' ? `13:${String(Math.floor(Math.random() * 10)).padStart(2, '0')}` : null,
        saida: `${String(saidaH).padStart(2, '0')}:${String(saidaM).padStart(2, '0')}`,
        status: i > 5 ? 'approved' : 'pending',
        homologated: i > 5,
        homologatedBy: i > 5 ? 'manager-001' : null,
        homologatedAt: i > 5 ? new Date(date.getTime() + 86400000).toISOString() : null,
        loginTimestamp: date.toISOString(),
        registrationTimestamp: date.toISOString(),
      };
      record.hash = generateRecordHash(record);
      add('timeRecords', record);
    });
  }

  // ── Audit Log ─────────────────────────────────────────────────
  add('auditLogs', {
    id: generateId(),
    managerId: 'manager-001',
    managerName: 'Ana Carolina Silva',
    action: 'approve',
    recordId: 'sample',
    employeeName: 'Carlos Eduardo Santos',
    date: new Date(today.getTime() - 86400000 * 10).toISOString().split('T')[0],
    oldValue: 'pending',
    newValue: 'approved',
    timestamp: new Date(today.getTime() - 86400000 * 9).toISOString(),
  });

  // ── Vacations ─────────────────────────────────────────────────
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const vacStart1 = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 5);
  const vacEnd1   = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 19);

  add('vacations', {
    id: generateId(),
    userId: 'colab-001', companyId: 'company-001',
    userName: 'Carlos Eduardo Santos', userEmail: 'carlos@empresa.com',
    startDate: vacStart1.toISOString().split('T')[0],
    endDate: vacEnd1.toISOString().split('T')[0],
    days: 15, notes: 'Férias de meio de ano', status: 'pending',
    requestedAt: new Date(today.getTime() - 86400000 * 3).toISOString(),
    approvedBy: null, approvedAt: null,
  });

  add('vacations', {
    id: generateId(),
    userId: 'colab-002', companyId: 'company-001',
    userName: 'Juliana Oliveira Costa', userEmail: 'juliana@empresa.com',
    startDate: new Date(today.getFullYear(), today.getMonth(), 20).toISOString().split('T')[0],
    endDate: new Date(today.getFullYear(), today.getMonth(), 30).toISOString().split('T')[0],
    days: 11, notes: 'Viagem em família', status: 'approved',
    requestedAt: new Date(today.getTime() - 86400000 * 15).toISOString(),
    approvedBy: 'manager-001', approvedByName: 'Ana Carolina Silva',
    approvedAt: new Date(today.getTime() - 86400000 * 12).toISOString(),
  });

  add('vacations', {
    id: generateId(),
    userId: 'colab-003', companyId: 'company-001',
    userName: 'Rafael Mendes Lima', userEmail: 'rafael@empresa.com',
    startDate: vacStart1.toISOString().split('T')[0],
    endDate: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 14).toISOString().split('T')[0],
    days: 10, notes: null, status: 'pending',
    requestedAt: new Date(today.getTime() - 86400000 * 1).toISOString(),
    approvedBy: null, approvedAt: null,
  });

  markSeeded();
}
