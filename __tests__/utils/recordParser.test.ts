import {
  normalizeSolicitudType,
  resolveSolicitudType,
  looksLikeCorrelative,
  resolveActoMateria,
  normalizeJornada,
  parseActoNumber,
  JORNADA_VALUES,
} from '../../utils/parsers/recordParser';

describe('recordParser utilities', () => {
  describe('normalizeSolicitudType', () => {
    it('should normalize PA type', () => {
      expect(normalizeSolicitudType('PA')).toBe('PA');
      expect(normalizeSolicitudType('pa')).toBe('PA');
      expect(normalizeSolicitudType(' PA ')).toBe('PA');
    });

    it('should normalize FL type', () => {
      expect(normalizeSolicitudType('FL')).toBe('FL');
      expect(normalizeSolicitudType('fl')).toBe('FL');
      expect(normalizeSolicitudType(' FL ')).toBe('FL');
    });

    it('should return null for invalid types', () => {
      expect(normalizeSolicitudType('')).toBe(null);
      expect(normalizeSolicitudType('INVALID')).toBe(null);
      expect(normalizeSolicitudType('P')).toBe(null);
    });
  });

  describe('resolveSolicitudType', () => {
    it('should return first valid type', () => {
      expect(resolveSolicitudType('PA', 'FL')).toBe('PA');
      expect(resolveSolicitudType('', 'FL')).toBe('FL');
      expect(resolveSolicitudType('invalid', 'pa')).toBe('PA');
    });

    it('should default to PA if no valid type found', () => {
      expect(resolveSolicitudType('', '')).toBe('PA');
      expect(resolveSolicitudType('invalid', 'also invalid')).toBe('PA');
    });
  });

  describe('looksLikeCorrelative', () => {
    it('should recognize correlative format XXX/YYYY', () => {
      expect(looksLikeCorrelative('001/2024')).toBe(true);
      expect(looksLikeCorrelative('123/2024')).toBe(true);
      expect(looksLikeCorrelative('1234 / 2024')).toBe(true);
    });

    it('should recognize simple numbers', () => {
      expect(looksLikeCorrelative('1')).toBe(true);
      expect(looksLikeCorrelative('123')).toBe(true);
      expect(looksLikeCorrelative('1234')).toBe(true);
    });

    it('should reject non-correlatives', () => {
      expect(looksLikeCorrelative('')).toBe(false);
      expect(looksLikeCorrelative('Decreto Exento')).toBe(false);
      expect(looksLikeCorrelative('PA')).toBe(false);
    });
  });

  describe('resolveActoMateria', () => {
    it('should handle materia as correlative', () => {
      const result = resolveActoMateria('001/2024', 'Decreto Exento');
      expect(result.acto).toBe('001/2024');
      expect(result.materia).toBe('Decreto Exento');
    });

    it('should handle acto as correlative', () => {
      const result = resolveActoMateria('Decreto Exento', '001/2024');
      expect(result.acto).toBe('001/2024');
      expect(result.materia).toBe('Decreto Exento');
    });

    it('should use default materia when both are correlatives', () => {
      const result = resolveActoMateria('001/2024', '002/2024');
      expect(result.acto).toBe('001/2024');
      expect(result.materia).toBe('Decreto Exento');
    });

    it('should handle empty values', () => {
      const result = resolveActoMateria('', '');
      expect(result.materia).toBe('Decreto Exento');
    });
  });

  describe('normalizeJornada', () => {
    it('should normalize morning shift', () => {
      expect(normalizeJornada('Jornada mañana')).toBe('Jornada mañana');
      expect(normalizeJornada('jornada manana')).toBe('Jornada mañana');
      expect(normalizeJornada('(mañana)')).toBe('Jornada mañana');
    });

    it('should normalize afternoon shift', () => {
      expect(normalizeJornada('Jornada tarde')).toBe('Jornada tarde');
      expect(normalizeJornada('jornada TARDE')).toBe('Jornada tarde');
      expect(normalizeJornada('(tarde)')).toBe('Jornada tarde');
    });

    it('should normalize full day shift', () => {
      expect(normalizeJornada('Jornada completa')).toBe('Jornada completa');
      expect(normalizeJornada('jornada COMPLETA')).toBe('Jornada completa');
      expect(normalizeJornada('completa')).toBe('Jornada completa');
    });

    it('should default to full day for empty', () => {
      expect(normalizeJornada('')).toBe('Jornada completa');
    });

    it('should return cleaned value for unknown', () => {
      expect(normalizeJornada('otra jornada')).toBe('otra jornada');
    });
  });

  describe('parseActoNumber', () => {
    it('should parse number from correlative', () => {
      expect(parseActoNumber('001/2024')).toBe(1);
      expect(parseActoNumber('123/2024')).toBe(123);
    });

    it('should parse plain numbers', () => {
      expect(parseActoNumber('123')).toBe(123);
    });

    it('should return null for invalid input', () => {
      expect(parseActoNumber('')).toBe(null);
      expect(parseActoNumber('abc')).toBe(null);
    });
  });

  describe('JORNADA_VALUES', () => {
    it('should contain all valid jornada values', () => {
      expect(JORNADA_VALUES).toContain('Jornada mañana');
      expect(JORNADA_VALUES).toContain('Jornada tarde');
      expect(JORNADA_VALUES).toContain('Jornada completa');
      expect(JORNADA_VALUES).toHaveLength(3);
    });
  });
});
