import { supabase } from '../lib/supabase';

export type AuditScope = 'decree' | 'admin' | 'auth';

export interface AuditEntry {
  id: string;
  scope: AuditScope;
  action: string;
  actor: string;
  target?: string;
  target_id?: string;
  details?: string;
  timestamp: number;
  old_data?: any;
  new_data?: any;
}

const AUDIT_STORAGE_KEY = 'gdp_audit_log';
const AUDIT_MAX = 500;

const readAuditLog = (): AuditEntry[] => {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuditEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.timestamp === 'number')
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
};

const writeAuditLog = (entries: AuditEntry[]) => {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(entries.slice(0, AUDIT_MAX)));
  } catch {
    // ignore storage failures
  }
};

export const appendAuditLog = async (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
  const timestamp = Date.now();
  const next: AuditEntry = {
    id: crypto.randomUUID(),
    timestamp,
    ...entry,
  };

  // 1. Guardar localmente
  const current = readAuditLog();
  writeAuditLog([next, ...current]);

  // 2. Intentar guardar en Supabase (si hay conexión)
  try {
    if (navigator.onLine) {
      await supabase.from('audit_logs').insert({
        scope: entry.scope,
        action: entry.action,
        actor_email: entry.actor,
        target_id: entry.target_id,
        target_name: entry.target,
        old_data: entry.old_data,
        new_data: entry.new_data,
        details: entry.details,
      });
    }
  } catch (e) {
    console.warn('No se pudo guardar el log de auditoría en la nube:', e);
  }
};

export const getAuditLog = (scope?: AuditScope): AuditEntry[] => {
  const all = readAuditLog();
  return scope ? all.filter((e) => e.scope === scope) : all;
};

export const fetchRemoteAuditLogs = async (limit = 100): Promise<AuditEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      scope: row.scope as AuditScope,
      action: row.action,
      actor: row.actor_email,
      target: row.target_name,
      target_id: row.target_id,
      details: row.details,
      timestamp: new Date(row.created_at).getTime(),
      old_data: row.old_data,
      new_data: row.new_data
    }));
  } catch (e) {
    console.error('Error al recuperar logs remotos:', e);
    return [];
  }
};
