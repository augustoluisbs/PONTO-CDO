/**
 * companyService.js
 * Centralized multi-tenant filtering service for SaaS isolation.
 * All manager pages should use these functions instead of querying directly.
 */
import { query, getAll } from './storage';

/**
 * Returns the list of collaborators visible to a given manager.
 * - accessScope 'all': all active collaborators in the manager's company
 * - accessScope 'assigned': only collaborators whose assignedManagerIds includes the manager's id
 * - Admin (role === 'admin'): sees all collaborators regardless of company
 */
export function getManagerCollaborators(manager) {
  if (!manager) return [];

  // Admin sees everyone
  if (manager.role === 'admin') {
    return query('users', u => u.role === 'collaborator' && u.active !== false);
  }

  if (!manager.companyId) {
    // Unassigned manager: fallback to empty (safety guard)
    return [];
  }

  const companyCollabs = query(
    'users',
    u => u.role === 'collaborator' && u.active !== false && u.companyId === manager.companyId
  );

  if (manager.accessScope === 'assigned') {
    return companyCollabs.filter(u =>
      Array.isArray(u.assignedManagerIds) && u.assignedManagerIds.includes(manager.id)
    );
  }

  // Default: 'all'
  return companyCollabs;
}

/**
 * Filters time records to only those belonging to the manager's visible collaborators.
 */
export function getManagerRecords(manager, records) {
  const visibleCollabs = getManagerCollaborators(manager);
  const visibleIds = new Set(visibleCollabs.map(u => u.id));
  return records.filter(r => visibleIds.has(r.userId));
}

/**
 * Returns all time records visible to a manager (from storage + scoped).
 */
export function getAllManagerTimeRecords(manager) {
  return getManagerRecords(manager, getAll('timeRecords'));
}

/**
 * Checks if a manager can see a specific user.
 */
export function canManagerSeeUser(manager, userId) {
  if (!manager || !userId) return false;
  if (manager.role === 'admin') return true;
  const collabs = getManagerCollaborators(manager);
  return collabs.some(u => u.id === userId);
}

/**
 * Returns all vacations visible to a manager.
 */
export function getManagerVacations(manager) {
  const visibleCollabs = getManagerCollaborators(manager);
  const visibleIds = new Set(visibleCollabs.map(u => u.id));
  const all = getAll('vacations');
  return all.filter(v => visibleIds.has(v.userId));
}

/**
 * Returns audit logs visible to a manager (logs created by this manager or about their collaborators).
 */
export function getManagerAuditLogs(manager) {
  if (manager.role === 'admin') return getAll('auditLogs');
  const all = getAll('auditLogs');
  const visibleCollabs = getManagerCollaborators(manager);
  const visibleNames = new Set(visibleCollabs.map(u => u.name));
  return all.filter(log =>
    log.managerId === manager.id ||
    visibleNames.has(log.employeeName)
  );
}

/**
 * Returns a company by id.
 */
export function getCompany(companyId) {
  if (!companyId) return null;
  const results = query('companies', c => c.id === companyId);
  return results[0] || null;
}

/**
 * Returns all active companies.
 */
export function getAllCompanies() {
  return query('companies', c => c.active !== false);
}
