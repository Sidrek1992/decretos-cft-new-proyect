import { Employee, PermitRecord } from '../types';
import { formatRut } from './formatters';
import { normalizeSearchText } from './search';

export interface RutNameConflict {
  canonicalRut: string;
  incomingName: string;
  existingName: string;
  source: 'employees' | 'records';
}

interface RutConflictOptions {
  ignoreEmployeeRut?: string;
  ignoreEmployeeName?: string;
  ignoreRecordId?: string;
}

export const sanitizeRut = (value: string | null | undefined): string => {
  return String(value || '')
    .replace(/[^0-9kK]/g, '')
    .toUpperCase();
};

export const normalizeRutCanonical = (value: string | null | undefined): string => {
  const cleaned = sanitizeRut(value);
  if (cleaned.length < 2) return '';

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!/^\d+$/.test(body)) return '';

  return `${body}-${dv}`;
};

export const formatRutForStorage = (value: string | null | undefined): string => {
  const canonical = normalizeRutCanonical(value);
  if (!canonical) return '';

  const compact = canonical.replace('-', '');
  return formatRut(compact).toUpperCase();
};

export const isValidRutModulo11 = (value: string | null | undefined): boolean => {
  const canonical = normalizeRutCanonical(value);
  if (!canonical) return false;

  const [body, dv] = canonical.split('-');
  if (!body || !dv || body.length < 7 || body.length > 8) return false;

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expected = 11 - (sum % 11);
  const expectedDv = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);

  return dv.toUpperCase() === expectedDv;
};

export const normalizeIdentityName = (value: string | null | undefined): string => {
  return normalizeSearchText(value).replace(/\s+/g, ' ').trim();
};

export const findEmployeeByRut = (
  employees: Employee[],
  rut: string,
  ignoreRut?: string
): Employee | null => {
  const targetRut = normalizeRutCanonical(rut);
  if (!targetRut) return null;

  const ignoredRut = normalizeRutCanonical(ignoreRut);

  for (const employee of employees) {
    const employeeRut = normalizeRutCanonical(employee.rut);
    if (!employeeRut || employeeRut !== targetRut) continue;
    if (ignoredRut && employeeRut === ignoredRut) continue;
    return employee;
  }

  return null;
};

export const findRutNameConflict = (
  rut: string,
  incomingName: string,
  employees: Employee[],
  records: PermitRecord[],
  options: RutConflictOptions = {}
): RutNameConflict | null => {
  const targetRut = normalizeRutCanonical(rut);
  const targetName = normalizeIdentityName(incomingName);

  if (!targetRut || !targetName) return null;

  const ignoredEmployeeRut = normalizeRutCanonical(options.ignoreEmployeeRut);
  const ignoredEmployeeName = normalizeIdentityName(options.ignoreEmployeeName);

  for (const employee of employees) {
    const employeeRut = normalizeRutCanonical(employee.rut);
    if (!employeeRut || employeeRut !== targetRut) continue;

    const employeeName = normalizeIdentityName(employee.nombre);
    const isIgnoredEmployee =
      Boolean(ignoredEmployeeRut) &&
      employeeRut === ignoredEmployeeRut &&
      (!ignoredEmployeeName || employeeName === ignoredEmployeeName);

    if (isIgnoredEmployee) continue;

    if (employeeName && employeeName !== targetName) {
      return {
        canonicalRut: targetRut,
        incomingName,
        existingName: employee.nombre,
        source: 'employees',
      };
    }
  }

  for (const record of records) {
    if (options.ignoreRecordId && record.id === options.ignoreRecordId) continue;

    const recordRut = normalizeRutCanonical(record.rut);
    if (!recordRut || recordRut !== targetRut) continue;

    const recordName = normalizeIdentityName(record.funcionario);
    if (recordName && recordName !== targetName) {
      return {
        canonicalRut: targetRut,
        incomingName,
        existingName: record.funcionario,
        source: 'records',
      };
    }
  }

  return null;
};

export const buildRutConflictMessage = (conflict: RutNameConflict): string => {
  const sourceLabel = conflict.source === 'employees'
    ? 'la base de personal'
    : 'el historial de decretos';

  return `El RUT ${formatRutForStorage(conflict.canonicalRut)} ya está asociado a "${conflict.existingName}" en ${sourceLabel}.`;
};
