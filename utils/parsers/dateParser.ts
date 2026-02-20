/**
 * Utilidades de parseo de fechas
 * Extraído de useCloudSync.ts para mejor modularidad
 */

const MONTHS: Record<string, string> = {
  'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
  'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
  'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
};

/**
 * Parsea fechas del Sheet en varios formatos posibles
 * @param dateStr - String de fecha en formato variado
 * @returns Fecha en formato ISO (YYYY-MM-DD) o string vacío si no es válida
 */
export const parseDateFromSheet = (dateStr: string): string => {
  if (!dateStr) return '';

  // Si ya está en formato ISO (YYYY-MM-DD), devolverlo
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.split('T')[0];
  }

  // Formato numérico: DD/MM/YYYY o DD-MM-YYYY
  const numericMatch = dateStr.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (numericMatch) {
    const dia = numericMatch[1].padStart(2, '0');
    const mes = numericMatch[2].padStart(2, '0');
    const año = numericMatch[3];
    return `${año}-${mes}-${dia}`;
  }

  // Formato largo: "martes, 06 de enero de 2026" o "06 de enero de 2026"
  const match = dateStr.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (match) {
    const dia = match[1].padStart(2, '0');
    const mes = MONTHS[match[2].toLowerCase()] || '01';
    const año = match[3];
    return `${año}-${mes}-${dia}`;
  }

  return '';
};

/**
 * Normaliza un valor de fecha
 */
export const normalizeDateValue = (value: string): string => {
  return parseDateFromSheet(String(value || ''));
};

/**
 * Normaliza un valor numérico con fallback
 */
export const normalizeNumberValue = (value: string | number, fallback: number): number => {
  const num = typeof value === 'number'
    ? value
    : parseFloat(String(value || '').replace(',', '.'));
  return Number.isNaN(num) ? fallback : num;
};

/**
 * Normaliza el valor de período
 */
export const normalizePeriodoValue = (value: string): string => {
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  return new Date().getFullYear().toString();
};

/**
 * Valida si una fecha está dentro del rango permitido
 */
export const isValidDateRange = (dateString: string, minYear = 2020, maxYear = 2030): boolean => {
  if (!dateString) return false;

  // Extraer el año directamente del string para evitar problemas de timezone
  const yearMatch = dateString.match(/^(\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    return year >= minYear && year <= maxYear;
  }

  // Fallback: intentar parsear como Date
  const date = new Date(dateString + 'T12:00:00');
  return !isNaN(date.getTime()) && date.getFullYear() >= minYear && date.getFullYear() <= maxYear;
};
