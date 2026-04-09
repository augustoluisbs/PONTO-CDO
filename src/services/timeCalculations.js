// timeCalculations.js - Work hours calculation engine

export function parseTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutes(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined) return '--:--';
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function calculateDayMinutes(record) {
  const { entrada, almoco_ida, almoco_volta, saida } = record;

  if (!entrada || !saida) return 0;

  const entradaMin = parseTime(entrada);
  const saidaMin = parseTime(saida);

  let worked = saidaMin - entradaMin;

  if (almoco_ida && almoco_volta) {
    const almocoIdaMin = parseTime(almoco_ida);
    const almocoVoltaMin = parseTime(almoco_volta);
    worked -= (almocoVoltaMin - almocoIdaMin);
  }

  return Math.max(0, worked);
}

export function calculateBalance(workedMinutes, expectedMinutes) {
  return workedMinutes - expectedMinutes;
}

export function getMonthRecords(records, year, month) {
  return records.filter(r => {
    const d = new Date(r.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function calculateMonthSummary(records, dailyHours = 8) {
  const expectedMinutesPerDay = dailyHours * 60;
  let totalWorked = 0;
  let totalExpected = 0;
  let daysWorked = 0;
  let absences = 0;

  records.forEach(r => {
    if (r.status === 'holiday' || r.status === 'medical') {
      // These don't count against the employee
      return;
    }
    if (r.status === 'absence') {
      absences++;
      totalExpected += expectedMinutesPerDay;
      return;
    }
    const worked = calculateDayMinutes(r);
    if (worked > 0) {
      daysWorked++;
      totalWorked += worked;
    }
    totalExpected += expectedMinutesPerDay;
  });

  return {
    totalWorked,
    totalExpected,
    balance: totalWorked - totalExpected,
    daysWorked,
    absences,
    overtime: Math.max(0, totalWorked - totalExpected),
  };
}

export function getDayOfWeek(dateStr) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

export function isWeekend(dateStr) {
  const day = new Date(dateStr + 'T12:00:00').getDay();
  return day === 0 || day === 6;
}

export function isFutureDate(dateStr) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return new Date(dateStr + 'T23:59:59') > today;
}

export function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

export function getMonthName(month) {
  const names = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return names[month];
}
