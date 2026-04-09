import CryptoJS from 'crypto-js';

export function generateHash(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return CryptoJS.SHA256(str).toString();
}

export function generateRecordHash(record) {
  const payload = {
    userId: record.userId,
    date: record.date,
    entrada: record.entrada,
    almoco_ida: record.almoco_ida,
    almoco_volta: record.almoco_volta,
    saida: record.saida,
    timestamp: record.createdAt,
  };
  return generateHash(payload);
}

export function verifyHash(data, expectedHash) {
  return generateHash(data) === expectedHash;
}
