
export const formatRut = (rut: string): string => {
  const value = rut.replace(/\./g, '').replace('-', '');
  if (value.length <= 1) return value;
  const dv = value.slice(-1);
  const cuerpo = value.slice(0, -1);
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + '-' + dv;
};

export const toProperCase = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const formatLongDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr + 'T12:00:00');
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(date);
};

export const formatNumericDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr + 'T12:00:00');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatSimpleDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr + 'T12:00:00');
  const day = date.getDate().toString().padStart(2, '0');
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${day} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
};

export const formatExcelDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr + 'T12:00:00');
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: 'long', year: 'numeric'
  }).format(date);
};

/**
 * Parses a correlative number from an "acto" string.
 * Supports formats like "123/2024" or plain numbers when period matches year.
 * 
 * @param acto - The act identifier string (e.g., "001/2024")
 * @param periodo - The period string
 * @param year - The year to match against
 * @returns The correlative number or null if not parseable
 */
export const parseCorrelativeFromActo = (acto: string, periodo: string, year: number): number | null => {
  const normalized = acto.trim();
  if (!normalized) return null;

  // Match format: "123/2024" or "123 / 2024"
  const slashMatch = normalized.match(/(\d{1,4})\s*\/\s*(\d{4})/);
  if (slashMatch) {
    const num = parseInt(slashMatch[1], 10);
    const actoYear = parseInt(slashMatch[2], 10);
    if (!Number.isNaN(num) && actoYear === year) return num;
  }

  // Match plain numbers when period equals year
  if (/^\d{1,4}$/.test(normalized) && String(periodo).trim() === String(year)) {
    const num = parseInt(normalized, 10);
    return Number.isNaN(num) ? null : num;
  }

  return null;
};

/**
 * Generates the next correlative number formatted as "XXX/YYYY"
 * 
 * @param currentMax - The current maximum correlative number
 * @param year - The year to use
 * @returns Formatted correlative string (e.g., "001/2024")
 */
export const generateNextCorrelative = (currentMax: number, year: number): string => {
  return `${(currentMax + 1).toString().padStart(3, '0')}/${year}`;
};

import { PermitRecord, SolicitudType } from '../types';

/**
 * Calculates the next correlative numbers for each solicitud type (PA and FL).
 * Each type maintains its own independent correlative sequence.
 * 
 * @param records - Array of permit records
 * @param year - The year to calculate correlatives for
 * @returns Object with next correlatives for PA and FL
 */
export const calculateNextCorrelatives = (
  records: PermitRecord[],
  year: number
): { PA: string; FL: string } => {
  const maxByType = { PA: 0, FL: 0 };

  records.forEach(record => {
    const type = record.solicitudType as SolicitudType;
    if (type === 'PA' || type === 'FL') {
      const candidate = parseCorrelativeFromActo(record.acto || '', record.periodo, year);
      if (candidate !== null && candidate > maxByType[type]) {
        maxByType[type] = candidate;
      }
    }
  });

  return {
    PA: generateNextCorrelative(maxByType.PA, year),
    FL: generateNextCorrelative(maxByType.FL, year),
  };
};
