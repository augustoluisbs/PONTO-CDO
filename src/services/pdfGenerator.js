import jsPDF from 'jspdf';
import { generateRecordHash } from './hashService';
import { formatMinutes, calculateDayMinutes, getDayOfWeek, getMonthName } from './timeCalculations';

export function generateReceipt(record, user) {
  const doc = new jsPDF();
  const hash = generateRecordHash(record);

  // Header
  doc.setFillColor(67, 56, 202);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text('PontoFlow', 20, 25);
  doc.setFontSize(10);
  doc.text('Comprovante de Registro de Ponto', 20, 33);

  // Body
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  let y = 55;

  doc.setFont(undefined, 'bold');
  doc.text('Dados do Colaborador', 20, y);
  y += 10;
  doc.setFont(undefined, 'normal');
  doc.text(`Nome: ${user.name}`, 20, y); y += 7;
  doc.text(`Matrícula: ${user.matricula || 'N/A'}`, 20, y); y += 7;
  doc.text(`CPF: ${user.cpf || 'N/A'}`, 20, y); y += 15;

  doc.setFont(undefined, 'bold');
  doc.text('Registro do Dia', 20, y);
  y += 10;
  doc.setFont(undefined, 'normal');
  doc.text(`Data: ${formatDate(record.date)} (${getDayOfWeek(record.date)})`, 20, y); y += 7;
  doc.text(`Entrada: ${record.entrada || '--:--'}`, 20, y); y += 7;
  doc.text(`Almoço (Saída): ${record.almoco_ida || '--:--'}`, 20, y); y += 7;
  doc.text(`Almoço (Retorno): ${record.almoco_volta || '--:--'}`, 20, y); y += 7;
  doc.text(`Saída: ${record.saida || '--:--'}`, 20, y); y += 7;

  const worked = calculateDayMinutes(record);
  doc.setFont(undefined, 'bold');
  doc.text(`Total Trabalhado: ${formatMinutes(worked)}`, 20, y); y += 15;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(`Registro realizado em: ${new Date(record.createdAt).toLocaleString('pt-BR')}`, 20, y); y += 12;

  // Hash
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Token de Verificação (SHA-256):', 20, y); y += 5;
  doc.setFont(undefined, 'bold');
  doc.text(hash, 20, y);

  return { doc, hash };
}

export function generateMonthlyReport(records, user, month, year, summary) {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(67, 56, 202);
  doc.rect(0, 0, 210, 45, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('Espelho de Ponto', 20, 20);
  doc.setFontSize(11);
  doc.text(`${getMonthName(month)} / ${year}`, 20, 30);
  doc.setFontSize(9);
  doc.text(`Colaborador: ${user.name} | Matrícula: ${user.matricula || 'N/A'}`, 20, 38);

  // Table header
  let y = 55;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');

  const cols = [20, 45, 70, 90, 115, 140, 165];
  const headers = ['Data', 'Dia', 'Entrada', 'Alm. Saída', 'Alm. Ret.', 'Saída', 'Trabalhado'];
  headers.forEach((h, i) => doc.text(h, cols[i], y));

  y += 3;
  doc.setDrawColor(200);
  doc.line(20, y, 190, y);
  y += 6;

  doc.setFont(undefined, 'normal');
  records.forEach(r => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    const worked = calculateDayMinutes(r);
    const statusLabel = r.status === 'holiday' ? '🏖 Feriado'
      : r.status === 'medical' ? '🏥 Atestado'
      : r.status === 'absence' ? '❌ Falta'
      : '';

    doc.text(formatDate(r.date), cols[0], y);
    doc.text(getDayOfWeek(r.date), cols[1], y);

    if (statusLabel) {
      doc.text(statusLabel, cols[2], y);
    } else {
      doc.text(r.entrada || '--:--', cols[2], y);
      doc.text(r.almoco_ida || '--:--', cols[3], y);
      doc.text(r.almoco_volta || '--:--', cols[4], y);
      doc.text(r.saida || '--:--', cols[5], y);
      doc.text(formatMinutes(worked), cols[6], y);
    }
    y += 6;
  });

  // Summary
  y += 10;
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setDrawColor(200);
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text('Resumo do Mês', 20, y); y += 8;
  doc.setFont(undefined, 'normal');
  doc.text(`Total Trabalhado: ${formatMinutes(summary.totalWorked)}`, 20, y); y += 6;
  doc.text(`Carga Esperada: ${formatMinutes(summary.totalExpected)}`, 20, y); y += 6;
  doc.text(`Saldo: ${formatMinutes(summary.balance)}`, 20, y); y += 6;
  doc.text(`Dias Trabalhados: ${summary.daysWorked}`, 20, y); y += 6;
  doc.text(`Faltas: ${summary.absences}`, 20, y); y += 6;

  // Signature area
  y += 15;
  if (y > 240) { doc.addPage(); y = 20; }
  doc.line(20, y, 90, y);
  doc.line(120, y, 190, y);
  y += 5;
  doc.setFontSize(8);
  doc.text('Assinatura do Colaborador', 30, y);
  doc.text('Assinatura do Gestor', 135, y);

  return doc;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
