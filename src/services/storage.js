// storage.js - localStorage-based storage service (Firestore-like structure)

const STORAGE_PREFIX = 'pontoflow_';

function getCollection(name) {
  const data = localStorage.getItem(STORAGE_PREFIX + name);
  return data ? JSON.parse(data) : [];
}

function setCollection(name, data) {
  localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(data));
}

export function getAll(collection) {
  return getCollection(collection);
}

export function getById(collection, id) {
  return getCollection(collection).find(item => item.id === id) || null;
}

export function query(collection, filterFn) {
  return getCollection(collection).filter(filterFn);
}

export function add(collection, item) {
  const items = getCollection(collection);
  const newItem = {
    ...item,
    id: item.id || generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  items.push(newItem);
  setCollection(collection, items);
  return newItem;
}

export function update(collection, id, updates) {
  const items = getCollection(collection);
  const idx = items.findIndex(item => item.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
  setCollection(collection, items);
  return items[idx];
}

export function remove(collection, id) {
  const items = getCollection(collection);
  const filtered = items.filter(item => item.id !== id);
  setCollection(collection, filtered);
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function clearAll() {
  Object.keys(localStorage)
    .filter(key => key.startsWith(STORAGE_PREFIX))
    .forEach(key => localStorage.removeItem(key));
}

export function isSeeded() {
  return localStorage.getItem(STORAGE_PREFIX + 'seeded') === 'true';
}

export function markSeeded() {
  localStorage.setItem(STORAGE_PREFIX + 'seeded', 'true');
}
