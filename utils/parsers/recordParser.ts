/**
 * Parsers para registros de decretos PA y FL
 * Extraído de useCloudSync.ts para mejor modularidad
 */

import { PermitRecord, SolicitudType } from '../../types';
import { formatLongDate } from '../formatters';
import { 
  parseDateFromSheet, 
  normalizeDateValue, 
  normalizeNumberValue, 
  normalizePeriodoValue 
} from './dateParser';

// Valores válidos de jornada
export const JORNADA_VALUES = ['Jornada mañana', 'Jornada tarde', 'Jornada completa'];

/**
 * Normaliza el tipo de solicitud
 */
export const normalizeSolicitudType = (value: string): SolicitudType | null => {
  const upper = value.trim().toUpperCase();
  if (upper === 'FL') return 'FL';
  if (upper === 'PA') return 'PA';
  return null;
};

/**
 * Resuelve el tipo de solicitud de múltiples valores
 */
export const resolveSolicitudType = (...values: string[]): SolicitudType => {
  for (const value of values) {
    const normalized = normalizeSolicitudType(value);
    if (normalized) return normalized;
  }
  return 'PA';
};

/**
 * Verifica si un valor parece un correlativo
 */
export const looksLikeCorrelative = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\d{1,4}\s*\/\s*\d{4}$/.test(trimmed)) return true;
  return /^\d{1,4}$/.test(trimmed);
};

/**
 * Resuelve los campos acto y materia
 */
export const resolveActoMateria = (materiaCell: string, actoCell: string) => {
  const materiaValue = materiaCell.trim();
  const actoValue = actoCell.trim();
  const materiaIsCorrelative = looksLikeCorrelative(materiaValue);
  const actoIsCorrelative = looksLikeCorrelative(actoValue);
  const actoIsSolicitudType = normalizeSolicitudType(actoValue) !== null;
  const materiaIsSolicitudType = normalizeSolicitudType(materiaValue) !== null;

  const defaultMateria = 'Decreto Exento';

  if (materiaIsCorrelative && !actoIsCorrelative) {
    return { acto: materiaValue, materia: actoIsSolicitudType ? defaultMateria : (actoValue || defaultMateria) };
  }
  if (actoIsCorrelative && !materiaIsCorrelative) {
    return { acto: actoValue, materia: materiaIsSolicitudType ? defaultMateria : (materiaValue || defaultMateria) };
  }
  if (materiaIsCorrelative && actoIsCorrelative) {
    return { acto: materiaValue, materia: defaultMateria };
  }

  if (actoIsSolicitudType && !materiaIsSolicitudType) {
    return { acto: materiaValue || actoValue, materia: materiaValue || defaultMateria };
  }
  if (materiaIsSolicitudType && !actoIsSolicitudType) {
    return { acto: actoValue || materiaValue, materia: actoValue || defaultMateria };
  }

  return {
    acto: materiaValue || actoValue,
    materia: actoValue || materiaValue || defaultMateria
  };
};

/**
 * Normaliza el tipo de jornada
 */
export const normalizeJornada = (value: string): string => {
  const cleaned = value.replace(/[()]/g, '').trim();
  if (!cleaned) return 'Jornada completa';

  const lower = cleaned.toLowerCase();
  if (lower.includes('manana') || lower.includes('mañana')) return 'Jornada mañana';
  if (lower.includes('tarde')) return 'Jornada tarde';
  if (lower.includes('completa')) return 'Jornada completa';

  return cleaned;
};

/**
 * Parsea el número de acto de un string
 */
export const parseActoNumber = (acto: string): number | null => {
  const num = parseInt(acto.split('/')[0], 10);
  return Number.isNaN(num) ? null : num;
};

/**
 * Obtiene el número de acto de una fila
 */
export const parseActoNumberFromRow = (row: unknown[]): number | null => {
  const materiaCandidate = parseActoNumber(String(row?.[2] || ''));
  if (materiaCandidate !== null) return materiaCandidate;
  const actoCandidate = parseActoNumber(String(row?.[3] || ''));
  if (actoCandidate !== null) return actoCandidate;
  return parseActoNumber(String(row?.[1] || ''));
};

/**
 * Determina si las filas deben invertirse
 */
export const shouldReverseRows = (rows: unknown[][]): boolean => {
  if (rows.length < 2) return false;

  const first = rows[0];
  const last = rows[rows.length - 1];

  const firstDate = parseDateFromSheet(String(first?.[11] || ''));
  const lastDate = parseDateFromSheet(String(last?.[11] || ''));
  if (firstDate && lastDate) {
    return firstDate > lastDate;
  }

  const firstActo = parseActoNumberFromRow(first || []);
  const lastActo = parseActoNumberFromRow(last || []);
  if (firstActo !== null && lastActo !== null) {
    return firstActo > lastActo;
  }

  return false;
};

interface ParseResult {
  records: PermitRecord[];
  warnings: string[];
}

/**
 * Parser para registros PA (Permisos Administrativos)
 */
export const parsePARecords = (data: unknown[][]): ParseResult => {
  const warnings: string[] = [];
  const rawRows = data.filter((row: unknown[]) => row && row[4]);
  const normalizedRows = shouldReverseRows(rawRows) ? [...rawRows].reverse() : rawRows;
  const totalRows = normalizedRows.length;

  const records: PermitRecord[] = normalizedRows.map((row: unknown[], index: number) => {
    const rowLabel = `[PA] Fila ${index + 2}`;
    const materiaCell = String(row[2] || '');
    const actoCell = String(row[3] || '');
    const solicitudCell = String(row[1] || '');
    const fechaInicioRaw = String(row[8] || '');
    const fechaDecretoRaw = String(row[11] || '');
    const tipoJornadaRaw = String(row[9] || '');
    const cantidadDiasRaw = String(row[7] || '');
    const diasHaberRaw = String(row[10] || '');
    const periodoRaw = String(row[6] || '');

    const fechaInicio = normalizeDateValue(fechaInicioRaw);
    const fechaDecreto = normalizeDateValue(fechaDecretoRaw);
    const resolved = resolveActoMateria(materiaCell, actoCell);
    const tipoJornada = normalizeJornada(tipoJornadaRaw);
    const cantidadDias = normalizeNumberValue(cantidadDiasRaw, 0);
    const diasHaber = normalizeNumberValue(diasHaberRaw, 0);
    const periodo = normalizePeriodoValue(periodoRaw);

    if (!normalizeSolicitudType(solicitudCell) && !normalizeSolicitudType(materiaCell) && !normalizeSolicitudType(actoCell)) {
      warnings.push(`${rowLabel}: tipo de solicitud inválido`);
    }
    if (fechaInicioRaw && !fechaInicio) {
      warnings.push(`${rowLabel}: Fecha de inicio inválida (${fechaInicioRaw})`);
    }
    if (fechaDecretoRaw && !fechaDecreto) {
      warnings.push(`${rowLabel}: Fecha inválida (${fechaDecretoRaw})`);
    }
    if (tipoJornadaRaw && !JORNADA_VALUES.includes(tipoJornada)) {
      warnings.push(`${rowLabel}: Tipo de jornada inválido (${tipoJornadaRaw})`);
    }

    return {
      id: `PA-${String(row[0]) || index}-${Date.now()}`,
      acto: resolved.acto,
      solicitudType: 'PA' as SolicitudType,
      materia: resolved.materia,
      funcionario: String(row[4] || '').trim(),
      rut: String(row[5] || '').trim(),
      periodo,
      cantidadDias,
      fechaInicio,
      tipoJornada: JORNADA_VALUES.includes(tipoJornada) ? tipoJornada : 'Jornada completa',
      diasHaber,
      fechaDecreto,
      ra: String(row[13] || 'MGA'),
      emite: String(row[14] || 'mga'),
      observaciones: '',
      createdAt: Date.now() - ((totalRows - 1 - index) * 1000),
      decreto: ''
    };
  });

  return { records, warnings };
};

/**
 * Parser para registros FL (Feriados Legales)
 */
export const parseFLRecords = (data: unknown[][]): ParseResult => {
  const warnings: string[] = [];
  const rawRows = data.filter((row: unknown[]) => row && row[4]);
  const totalRows = rawRows.length;

  const records: PermitRecord[] = rawRows.map((row: unknown[], index: number) => {
    const rowLabel = `[FL] Fila ${index + 2}`;
    
    const actoRaw = String(row[1] || '').trim();
    const funcionario = String(row[4] || '').trim();
    const rut = String(row[5] || '').trim();
    const cantidadDiasRaw = String(row[6] || '');
    const periodo1Raw = String(row[7] || '').trim();
    const saldoDispP1Raw = String(row[8] || '');
    const solicitadoP1Raw = String(row[9] || '');
    const saldoFinalP1Raw = String(row[10] || '');
    const periodo2Raw = String(row[11] || '').trim();
    const saldoDispP2Raw = String(row[12] || '');
    const solicitadoP2Raw = String(row[13] || '');
    const saldoFinalP2Raw = String(row[14] || '');
    const fechaInicioRaw = String(row[15] || '');
    const fechaTerminoRaw = String(row[16] || '');
    const fechaEmisionRaw = String(row[17] || '');
    const ra = String(row[18] || 'MGA').trim();
    const emite = String(row[19] || 'mga').trim();
    const observaciones = String(row[20] || '').trim();

    const fechaInicio = normalizeDateValue(fechaInicioRaw);
    const fechaTermino = normalizeDateValue(fechaTerminoRaw);
    const fechaDecreto = normalizeDateValue(fechaEmisionRaw);
    const cantidadDias = normalizeNumberValue(cantidadDiasRaw, 0);
    const saldoDisponibleP1 = normalizeNumberValue(saldoDispP1Raw, 0);
    const solicitadoP1 = normalizeNumberValue(solicitadoP1Raw, 0);
    const saldoFinalP1 = normalizeNumberValue(saldoFinalP1Raw, 0);
    const saldoDisponibleP2 = normalizeNumberValue(saldoDispP2Raw, 0);
    const solicitadoP2 = normalizeNumberValue(solicitadoP2Raw, 0);
    const saldoFinalP2 = normalizeNumberValue(saldoFinalP2Raw, 0);

    const diasHaber = saldoDisponibleP1 + saldoDisponibleP2;

    if (fechaInicioRaw && !fechaInicio) {
      warnings.push(`${rowLabel}: Fecha de inicio inválida (${fechaInicioRaw})`);
    }
    if (fechaTerminoRaw && !fechaTermino) {
      warnings.push(`${rowLabel}: Fecha de término inválida (${fechaTerminoRaw})`);
    }
    if (!actoRaw) {
      warnings.push(`${rowLabel}: N° Acto Adm. vacío`);
    }

    return {
      id: `FL-${String(row[0]) || index}-${Date.now()}`,
      acto: actoRaw,
      solicitudType: 'FL' as SolicitudType,
      materia: 'Decreto Exento',
      funcionario,
      rut,
      periodo: new Date().getFullYear().toString(),
      cantidadDias,
      fechaInicio,
      fechaTermino,
      tipoJornada: 'Jornada completa',
      diasHaber,
      fechaDecreto,
      ra,
      emite,
      observaciones,
      periodo1: periodo1Raw,
      saldoDisponibleP1,
      solicitadoP1,
      saldoFinalP1,
      periodo2: periodo2Raw,
      saldoDisponibleP2,
      solicitadoP2,
      saldoFinalP2,
      createdAt: Date.now() - ((totalRows - 1 - index) * 1000),
      decreto: ''
    };
  });

  return { records, warnings };
};

/**
 * Prepara datos PA para envío a Google Sheets
 */
export const preparePADataForSync = (records: PermitRecord[]): { data: unknown[][]; warnings: string[] } => {
  const warnings: string[] = [];
  const filteredRecords = records.filter(r => r.solicitudType === 'PA');

  const data = filteredRecords.map((record, index) => {
    const rowLabel = `[PA] Registro ${index + 1}`;
    const funcionario = String(record.funcionario || '').trim();
    const rut = String(record.rut || '').trim();
    const acto = String(record.acto || '').trim();
    const periodo = normalizePeriodoValue(String(record.periodo || ''));
    const cantidadDias = normalizeNumberValue(record.cantidadDias, 0);
    const diasHaber = normalizeNumberValue(record.diasHaber, 0);
    const fechaInicio = normalizeDateValue(String(record.fechaInicio || ''));
    const fechaDecretoParsed = normalizeDateValue(String(record.fechaDecreto || ''));
    const fechaDecreto = fechaDecretoParsed || new Date().toISOString().split('T')[0];
    const tipoJornada = normalizeJornada(String(record.tipoJornada || ''));

    if (!funcionario) warnings.push(`${rowLabel}: Funcionario vacío`);
    if (!rut) warnings.push(`${rowLabel}: RUT vacío`);
    if (!acto) warnings.push(`${rowLabel}: N° Acto Adm. vacío`);

    return [
      index + 1,
      'PA',
      acto,
      'Decreto Exento',
      funcionario,
      rut,
      periodo,
      cantidadDias,
      fechaInicio,
      JORNADA_VALUES.includes(tipoJornada) ? tipoJornada : 'Jornada completa',
      diasHaber,
      formatLongDate(fechaDecreto),
      (diasHaber - cantidadDias),
      record.ra || 'MGA',
      record.emite || 'mga'
    ];
  });

  return { data, warnings };
};

/**
 * Prepara datos FL para envío a Google Sheets
 */
export const prepareFLDataForSync = (records: PermitRecord[]): { data: unknown[][]; warnings: string[] } => {
  const warnings: string[] = [];
  const filteredRecords = records.filter(r => r.solicitudType === 'FL');

  const data = filteredRecords.map((record, index) => {
    const rowLabel = `[FL] Registro ${index + 1}`;
    const funcionario = String(record.funcionario || '').trim();
    const rut = String(record.rut || '').trim();
    const acto = String(record.acto || '').trim();
    const cantidadDias = normalizeNumberValue(record.cantidadDias, 0);
    const fechaInicio = normalizeDateValue(String(record.fechaInicio || ''));
    const fechaTermino = normalizeDateValue(String(record.fechaTermino || ''));
    const fechaDecretoParsed = normalizeDateValue(String(record.fechaDecreto || ''));
    const fechaDecreto = fechaDecretoParsed || new Date().toISOString().split('T')[0];

    if (!funcionario) warnings.push(`${rowLabel}: Funcionario vacío`);
    if (!acto) warnings.push(`${rowLabel}: N° Acto Adm. vacío`);
    if (!fechaInicio) warnings.push(`${rowLabel}: Fecha de inicio vacía`);
    if (!fechaTermino) warnings.push(`${rowLabel}: Fecha de término vacía`);

    return [
      index + 1,
      acto,
      'FL',
      'Decreto Exento',
      funcionario,
      rut,
      cantidadDias,
      record.periodo1 || '',
      record.saldoDisponibleP1 || 0,
      record.solicitadoP1 || 0,
      record.saldoFinalP1 || 0,
      record.periodo2 || '',
      record.saldoDisponibleP2 || 0,
      record.solicitadoP2 || 0,
      record.saldoFinalP2 || 0,
      formatLongDate(fechaInicio),
      formatLongDate(fechaTermino),
      formatLongDate(fechaDecreto),
      record.ra || 'MGA',
      record.emite || 'mga',
      record.observaciones || ''
    ];
  });

  return { data, warnings };
};
