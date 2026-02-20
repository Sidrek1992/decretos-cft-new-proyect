import { Employee, PermitRecord } from '../../types';
import {
  findEmployeeByRut,
  findRutNameConflict,
  formatRutForStorage,
  isValidRutModulo11,
  normalizeIdentityName,
  normalizeRutCanonical,
} from '../../utils/rutIntegrity';

const buildRecord = (overrides: Partial<PermitRecord> = {}): PermitRecord => ({
  id: 'record-1',
  solicitudType: 'PA',
  decreto: '',
  materia: 'Decreto Exento',
  acto: '001/2026',
  funcionario: 'Juan Perez',
  rut: '12.345.678-5',
  periodo: '2026',
  cantidadDias: 2,
  fechaInicio: '2026-01-10',
  tipoJornada: 'Jornada completa',
  diasHaber: 6,
  fechaDecreto: '2026-01-01',
  ra: 'MGA',
  emite: 'mga',
  observaciones: '',
  createdAt: Date.now(),
  ...overrides,
});

describe('rutIntegrity utilities', () => {
  it('normalizes RUT to canonical format', () => {
    expect(normalizeRutCanonical('12.345.678-5')).toBe('12345678-5');
    expect(normalizeRutCanonical('12345678k')).toBe('12345678-K');
    expect(normalizeRutCanonical('  9.876.543-3  ')).toBe('9876543-3');
  });

  it('formats RUT for storage/display', () => {
    expect(formatRutForStorage('123456785')).toBe('12.345.678-5');
    expect(formatRutForStorage('9876543-3')).toBe('9.876.543-3');
  });

  it('validates RUT with modulo 11', () => {
    expect(isValidRutModulo11('12.345.678-5')).toBe(true);
    expect(isValidRutModulo11('9.876.543-3')).toBe(true);
    expect(isValidRutModulo11('12.345.678-4')).toBe(false);
    expect(isValidRutModulo11('abc')).toBe(false);
  });

  it('normalizes identity names consistently', () => {
    expect(normalizeIdentityName('  JUÁN   Pérez  ')).toBe('juan perez');
    expect(normalizeIdentityName('Juan Perez')).toBe('juan perez');
  });

  it('finds employees by RUT regardless of format', () => {
    const employees: Employee[] = [{ nombre: 'Juan Perez', rut: '12.345.678-5' }];
    const match = findEmployeeByRut(employees, '12345678-5');
    expect(match?.nombre).toBe('Juan Perez');
  });

  it('detects conflict when same RUT exists with different employee name', () => {
    const employees: Employee[] = [{ nombre: 'Maria Soto', rut: '12.345.678-5' }];
    const records: PermitRecord[] = [];

    const conflict = findRutNameConflict('12345678-5', 'Juan Perez', employees, records);
    expect(conflict).not.toBeNull();
    expect(conflict?.source).toBe('employees');
    expect(conflict?.existingName).toBe('Maria Soto');
  });

  it('detects conflict when same RUT exists with different name in records history', () => {
    const employees: Employee[] = [];
    const records: PermitRecord[] = [buildRecord({ funcionario: 'Maria Soto', rut: '12.345.678-5' })];

    const conflict = findRutNameConflict('12.345.678-5', 'Juan Perez', employees, records);
    expect(conflict).not.toBeNull();
    expect(conflict?.source).toBe('records');
    expect(conflict?.existingName).toBe('Maria Soto');
  });

  it('does not raise conflict for same person with case/accents differences', () => {
    const employees: Employee[] = [{ nombre: 'JUAN PEREZ', rut: '12.345.678-5' }];
    const records: PermitRecord[] = [];

    const conflict = findRutNameConflict('123456785', 'Juán Pérez', employees, records);
    expect(conflict).toBeNull();
  });

  it('supports ignore options for employee and record editing', () => {
    const employees: Employee[] = [{ nombre: 'Juan Perez', rut: '12.345.678-5' }];
    const records: PermitRecord[] = [buildRecord({ id: 'current-record', funcionario: 'Juan Perez' })];

    const conflict = findRutNameConflict('12.345.678-5', 'Juan Perez', employees, records, {
      ignoreEmployeeRut: '12.345.678-5',
      ignoreEmployeeName: 'Juan Perez',
      ignoreRecordId: 'current-record',
    });

    expect(conflict).toBeNull();
  });
});
