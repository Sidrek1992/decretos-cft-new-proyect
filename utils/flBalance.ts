import { PermitRecord } from '../types';

type FLBalanceRecord = Pick<PermitRecord, 'periodo2' | 'saldoFinalP1' | 'saldoFinalP2'>;

export const hasFLSecondPeriod = (record: Pick<PermitRecord, 'periodo2'>): boolean =>
  Boolean(record.periodo2 && record.periodo2.trim() !== '');

export function getFLSaldoFinal(record: FLBalanceRecord): number | null;
export function getFLSaldoFinal(record: FLBalanceRecord, fallback: number): number;
export function getFLSaldoFinal(record: FLBalanceRecord, fallback: null): number | null;
export function getFLSaldoFinal(record: FLBalanceRecord, fallback: number | null = null): number | null {
  const saldo = hasFLSecondPeriod(record)
    ? (record.saldoFinalP2 ?? record.saldoFinalP1)
    : (record.saldoFinalP1 ?? record.saldoFinalP2);

  return saldo ?? fallback;
}
