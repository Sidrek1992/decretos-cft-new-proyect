import { PermitRecord } from '../types';

type RecordDateField = 'fechaDecreto' | 'fechaInicio';

const parseRecordDateValue = (value?: string): number | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  const time = parsed.getTime();
  return Number.isNaN(time) ? null : time;
};

export const getRecordDateValue = (
  record: Pick<PermitRecord, 'fechaDecreto' | 'fechaInicio' | 'createdAt'>,
  prefer: RecordDateField = 'fechaDecreto'
): number => {
  const primary = prefer === 'fechaDecreto' ? record.fechaDecreto : record.fechaInicio;
  const fallback = prefer === 'fechaDecreto' ? record.fechaInicio : record.fechaDecreto;

  const primaryValue = parseRecordDateValue(primary);
  if (primaryValue !== null) return primaryValue;

  const fallbackValue = parseRecordDateValue(fallback);
  if (fallbackValue !== null) return fallbackValue;

  return record.createdAt || 0;
};

export const compareRecordsByDateDesc = (
  a: Pick<PermitRecord, 'fechaDecreto' | 'fechaInicio' | 'createdAt'>,
  b: Pick<PermitRecord, 'fechaDecreto' | 'fechaInicio' | 'createdAt'>,
  prefer: RecordDateField = 'fechaDecreto'
): number => getRecordDateValue(b, prefer) - getRecordDateValue(a, prefer);

export const sortRecordsByDateDesc = <T extends Pick<PermitRecord, 'fechaDecreto' | 'fechaInicio' | 'createdAt'>>(
  records: T[],
  prefer: RecordDateField = 'fechaDecreto'
): T[] => records.slice().sort((a, b) => compareRecordsByDateDesc(a, b, prefer));
