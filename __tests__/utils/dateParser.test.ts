import {
  parseDateFromSheet,
  normalizeDateValue,
  normalizeNumberValue,
  normalizePeriodoValue,
  isValidDateRange,
} from '../../utils/parsers/dateParser';

describe('dateParser utilities', () => {
  describe('parseDateFromSheet', () => {
    it('should return empty string for empty input', () => {
      expect(parseDateFromSheet('')).toBe('');
      expect(parseDateFromSheet(null as unknown as string)).toBe('');
      expect(parseDateFromSheet(undefined as unknown as string)).toBe('');
    });

    it('should return ISO date if already in ISO format', () => {
      expect(parseDateFromSheet('2024-01-15')).toBe('2024-01-15');
      expect(parseDateFromSheet('2024-01-15T10:30:00')).toBe('2024-01-15');
    });

    it('should parse DD/MM/YYYY format', () => {
      expect(parseDateFromSheet('15/01/2024')).toBe('2024-01-15');
      expect(parseDateFromSheet('1/1/2024')).toBe('2024-01-01');
      expect(parseDateFromSheet('31-12-2024')).toBe('2024-12-31');
    });

    it('should parse Spanish long date format', () => {
      expect(parseDateFromSheet('06 de enero de 2026')).toBe('2026-01-06');
      expect(parseDateFromSheet('martes, 06 de enero de 2026')).toBe('2026-01-06');
      expect(parseDateFromSheet('15 de diciembre de 2024')).toBe('2024-12-15');
    });

    it('should handle all Spanish months', () => {
      const months = [
        { name: 'enero', num: '01' },
        { name: 'febrero', num: '02' },
        { name: 'marzo', num: '03' },
        { name: 'abril', num: '04' },
        { name: 'mayo', num: '05' },
        { name: 'junio', num: '06' },
        { name: 'julio', num: '07' },
        { name: 'agosto', num: '08' },
        { name: 'septiembre', num: '09' },
        { name: 'octubre', num: '10' },
        { name: 'noviembre', num: '11' },
        { name: 'diciembre', num: '12' },
      ];

      months.forEach(({ name, num }) => {
        expect(parseDateFromSheet(`15 de ${name} de 2024`)).toBe(`2024-${num}-15`);
      });
    });

    it('should return empty string for invalid format', () => {
      expect(parseDateFromSheet('invalid date')).toBe('');
      expect(parseDateFromSheet('2024')).toBe('');
    });
  });

  describe('normalizeDateValue', () => {
    it('should normalize date values', () => {
      expect(normalizeDateValue('2024-01-15')).toBe('2024-01-15');
      expect(normalizeDateValue('15/01/2024')).toBe('2024-01-15');
      expect(normalizeDateValue('')).toBe('');
    });
  });

  describe('normalizeNumberValue', () => {
    it('should return number if input is number', () => {
      expect(normalizeNumberValue(5, 0)).toBe(5);
      expect(normalizeNumberValue(3.5, 0)).toBe(3.5);
    });

    it('should parse string to number', () => {
      expect(normalizeNumberValue('5', 0)).toBe(5);
      expect(normalizeNumberValue('3.5', 0)).toBe(3.5);
      expect(normalizeNumberValue('3,5', 0)).toBe(3.5);
    });

    it('should return fallback for invalid input', () => {
      expect(normalizeNumberValue('', 10)).toBe(10);
      expect(normalizeNumberValue('abc', 5)).toBe(5);
      expect(normalizeNumberValue(NaN, 0)).toBe(0);
    });
  });

  describe('normalizePeriodoValue', () => {
    it('should return 4-digit year if valid', () => {
      expect(normalizePeriodoValue('2024')).toBe('2024');
      expect(normalizePeriodoValue('2025')).toBe('2025');
    });

    it('should return current year for invalid period', () => {
      const currentYear = new Date().getFullYear().toString();
      expect(normalizePeriodoValue('')).toBe(currentYear);
      expect(normalizePeriodoValue('invalid')).toBe(currentYear);
      expect(normalizePeriodoValue('24')).toBe(currentYear);
    });
  });

  describe('isValidDateRange', () => {
    it('should return true for dates within range', () => {
      expect(isValidDateRange('2024-06-15')).toBe(true);
      expect(isValidDateRange('2020-01-01')).toBe(true);
      expect(isValidDateRange('2030-12-31')).toBe(true);
    });

    it('should return false for dates outside range', () => {
      expect(isValidDateRange('2019-12-31')).toBe(false);
      expect(isValidDateRange('2031-01-01')).toBe(false);
    });

    it('should return false for invalid dates', () => {
      expect(isValidDateRange('')).toBe(false);
      expect(isValidDateRange('invalid')).toBe(false);
    });
  });
});
