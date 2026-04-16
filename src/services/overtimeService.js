// overtimeService.js
// Gerenciamento do banco de horas: extras, negativas, carry-over mensal e aprovações.
//
// REGRAS:
//  - Horas extras diurnas: trabalhadas entre 05:00 e 22:00 além da jornada diária
//  - Horas extras noturnas: trabalhadas entre 22:00 e 05:00 (hora noturna = 52,5 min → fator 1.1428)
//  - Sem autorização do gestor, horas extras NÃO compensam horas negativas
//  - O saldo acumulado passa de um mês para o outro (carry-over)
//  - Ações do gestor: APROVAÇÃO de HE, ABONO de negativas, COMPENSAÇÃO (usa extra para cobrir negativa)

import { getAll, add, update, query, generateId, getById } from './storage';
import { parseTime } from './timeCalculations';

// ── Constantes legais (CLT) ────────────────────────────────────────────────
export const NIGHT_SHIFT_START = 22 * 60; // 22:00 em minutos
export const NIGHT_SHIFT_END   = 5  * 60; //  5:00 em minutos
export const NIGHT_HOUR_FACTOR = 7 / 8;   // hora noturna = 52,5 min → vale 1h normal / fator redução
// Na prática: 1 hora noturna real = 52,5 minutos → cada 52.5 min noturnos = 60 min normais
// Logo o multiplicador da hora noturna = 60/52.5 ≈ 1.1428 (adicional de 14,28%)

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Retorna quantos minutos de um intervalo [startMin, endMin] caem dentro do
 * período noturno [22h, 5h]. Lida com virada do dia.
 */
function nightMinutesInInterval(startMin, endMin) {
  if (endMin <= startMin) return 0;

  // Night period spans two calendar segments: [22*60, 24*60) and [0, 5*60)
  const nightRanges = [
    [22 * 60, 24 * 60],
    [0       , 5  * 60],
  ];

  let night = 0;
  for (const [ns, ne] of nightRanges) {
    const overlapStart = Math.max(startMin, ns);
    const overlapEnd   = Math.min(endMin,   ne);
    if (overlapEnd > overlapStart) night += overlapEnd - overlapStart;
  }
  return night;
}

/**
 * Calcula detalhes de um registro de ponto:
 *  - workedMinutes: total trabalhado (desconta almoço)
 *  - expectedMinutes: jornada esperada
 *  - balanceMinutes: diferença raw (positivo = extra, negativo = negativo)
 *  - extraDiurnoMinutes: minutos extras diurnos
 *  - extraNoturnoMinutes: minutos extras noturnos (já convertidos para equivalência normal)
 *  - missingMinutes: horas negativas (falta)
 */
export function calculateDetailedDay(record, dailyHours = 8) {
  const expected = dailyHours * 60;

  if (!record.entrada || !record.saida) {
    const isSpecial = ['absence', 'holiday', 'medical', 'excused'].includes(record.status);
    return {
      workedMinutes: 0,
      expectedMinutes: isSpecial ? 0 : expected,
      balanceMinutes: isSpecial ? 0 : -expected,
      extraDiurnoMinutes: 0,
      extraNoturnoMinutes: 0,
      missingMinutes: isSpecial ? 0 : expected,
    };
  }

  const entradaMin = parseTime(record.entrada);
  const saidaMin   = parseTime(record.saida);
  let worked = saidaMin - entradaMin;

  if (record.almoco_ida && record.almoco_volta) {
    worked -= parseTime(record.almoco_volta) - parseTime(record.almoco_ida);
  }
  worked = Math.max(0, worked);

  const balance = worked - expected;
  const missing = balance < 0 ? Math.abs(balance) : 0;
  let extraDiurno  = 0;
  let extraNoturno = 0;

  if (balance > 0) {
    // Calculate night minutes within the worked period
    const nightWorked = nightMinutesInInterval(entradaMin, saidaMin);
    // Lunch break is assumed daytime — subtract from day total only
    const dayWorked = worked - nightWorked;

    const dayExpected   = Math.min(expected, dayWorked + (expected - worked)); // approx
    const extraTotal    = balance;

    // Split extra proportionally between day and night
    const nightFraction = worked > 0 ? nightWorked / worked : 0;
    const extraNightRaw = Math.round(extraTotal * nightFraction);
    const extraDayRaw   = extraTotal - extraNightRaw;

    // Night minutes are worth more: multiply by 60/52.5
    extraNoturno = Math.round(extraNightRaw * (60 / 52.5));
    extraDiurno  = extraDayRaw;
  }

  return {
    workedMinutes: worked,
    expectedMinutes: expected,
    balanceMinutes: balance,
    extraDiurnoMinutes: extraDiurno,
    extraNoturnoMinutes: extraNoturno,
    missingMinutes: missing,
  };
}

// ── Banco de horas (carry-over entre meses) ────────────────────────────────

const BANK_COLLECTION = 'hourBankEntries';
const ACTION_COLLECTION = 'overtimeActions';

/**
 * Retorna o saldo acumulado de um colaborador até o mês anterior ao indicado
 * (carry-over). Considera apenas ações APROVADAS pelo gestor.
 */
export function getCarryOverBalance(userId, upToYear, upToMonth) {
  const entries = getAll(BANK_COLLECTION).filter(e =>
    e.userId === userId &&
    (e.year < upToYear || (e.year === upToYear && e.month < upToMonth))
  );
  return entries.reduce((sum, e) => sum + (e.balanceMinutes || 0), 0);
}

/**
 * Calcula o saldo do mês corrente do colaborador incluindo carry-over.
 * @param records time records do mês
 * @param dailyHours jornada diária do colaborador
 * @param userId id do colaborador
 * @param year
 * @param month
 * @returns { workedMinutes, expectedMinutes, rawBalance, approvedExtra,
 *             approvedNegative, pendingExtra, pendingNegative,
 *             carryOver, effectiveBalance, extraDiurno, extraNoturno }
 */
export function calculateMonthOvertimeSummary(records, dailyHours, userId, year, month) {
  const monthRecords = records.filter(r => {
    const d = new Date(r.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  let workedMinutes = 0;
  let expectedMinutes = 0;
  let extraDiurno = 0;
  let extraNoturno = 0;
  let missing = 0;

  monthRecords.forEach(r => {
    const detail = calculateDetailedDay(r, dailyHours);
    workedMinutes    += detail.workedMinutes;
    expectedMinutes  += detail.expectedMinutes;
    extraDiurno      += detail.extraDiurnoMinutes;
    extraNoturno     += detail.extraNoturnoMinutes;
    missing          += detail.missingMinutes;
  });

  const rawBalance = workedMinutes - expectedMinutes;

  // Gestor actions for this month
  const actions = getAll(ACTION_COLLECTION).filter(a =>
    a.userId === userId && a.year === year && a.month === month
  );

  let approvedExtraMinutes    = 0; // gestor autorizou como HE
  let approvedNegativeAbonado = 0; // gestor abonounhoras negativas
  let compensatedMinutes      = 0; // gestor autorizou usar extra p/ cobrir negativo

  actions.forEach(a => {
    if (a.type === 'approve_extra'   && a.status === 'approved') approvedExtraMinutes    += a.minutes;
    if (a.type === 'abono_negative'  && a.status === 'approved') approvedNegativeAbonado += a.minutes;
    if (a.type === 'compensate'      && a.status === 'approved') compensatedMinutes      += a.minutes;
  });

  const carryOver = getCarryOverBalance(userId, year, month);

  // Effective balance = raw + carry-over + abono - (extra only counts if approved)
  // Negative hours are NOT auto-reduced by positive extras without authorization
  const authorizedPositive = approvedExtraMinutes + compensatedMinutes;
  const authorizedNegative = approvedNegativeAbonado + compensatedMinutes;

  // Raw positive and negative buckets
  const rawExtra   = Math.max(0, rawBalance);
  const rawMissing = Math.max(0, -rawBalance);

  // Effective: negatives reduced only by authorized compensation/abono
  const effectiveMissing  = Math.max(0, rawMissing - authorizedNegative);
  const effectiveExtra    = Math.max(0, rawExtra); // extras still accumulate (pending if not approved)
  const effectiveBalance  = carryOver + effectiveExtra - effectiveMissing;

  return {
    workedMinutes,
    expectedMinutes,
    rawBalance,
    rawExtra,
    rawMissing,
    effectiveMissing,
    effectiveExtra,
    approvedExtraMinutes,
    approvedNegativeAbonado,
    compensatedMinutes,
    extraDiurno,
    extraNoturno,
    carryOver,
    effectiveBalance,     // saldo final que aparece para o colaborador
    actions,
  };
}

// ── Banco de horas por mês (snapshot persistente) ─────────────────────────
/**
 * Salva ou atualiza o snapshot do saldo mensal para carry-over futuro.
 * Deve ser chamado ao homologar todos os registros do mês.
 */
export function saveMonthSnapshot(userId, year, month, balanceMinutes) {
  const existing = getAll(BANK_COLLECTION).find(
    e => e.userId === userId && e.year === year && e.month === month
  );
  if (existing) {
    update(BANK_COLLECTION, existing.id, { balanceMinutes, updatedAt: new Date().toISOString() });
  } else {
    add(BANK_COLLECTION, {
      id: generateId(),
      userId,
      year,
      month,
      balanceMinutes,
    });
  }
}

// ── Ações do gestor sobre o banco de horas ─────────────────────────────────

/**
 * Cria uma ação de gestão do banco de horas.
 * tipos: 'approve_extra' | 'abono_negative' | 'compensate'
 */
export function createOvertimeAction({ managerId, managerName, userId, userName, year, month, type, minutes, reason }) {
  return add(ACTION_COLLECTION, {
    id: generateId(),
    managerId,
    managerName,
    userId,
    userName,
    year,
    month,
    type,
    minutes,
    reason: reason || '',
    status: 'approved',  // manager action = immediately approved
    createdAt: new Date().toISOString(),
  });
}

export function getOvertimeActions(userId) {
  return getAll(ACTION_COLLECTION).filter(a => a.userId === userId);
}

export function getManagerOvertimeActions(managerId) {
  return getAll(ACTION_COLLECTION).filter(a => a.managerId === managerId);
}

export function getAllOvertimeActionsForCollab(userId, year, month) {
  return getAll(ACTION_COLLECTION).filter(a =>
    a.userId === userId && a.year === year && a.month === month
  );
}

export function revokeOvertimeAction(actionId) {
  update(ACTION_COLLECTION, actionId, { status: 'revoked', revokedAt: new Date().toISOString() });
}

// ── Helpers para UI ────────────────────────────────────────────────────────
export function actionTypeLabel(type) {
  const map = {
    approve_extra:   '✅ Aprovação de HE',
    abono_negative:  '🟢 Abono de Negativas',
    compensate:      '🔄 Compensação',
  };
  return map[type] || type;
}

export function formatBalance(minutes) {
  const sign = minutes < 0 ? '-' : minutes > 0 ? '+' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
}
