
import React, { useMemo } from 'react';
import { PermitRecord } from '../types';
import { compareRecordsByDateDesc } from '../utils/recordDates';
import { getFLSaldoFinal } from '../utils/flBalance';
import { X, AlertTriangle, TrendingDown, User } from 'lucide-react';

interface LowBalanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: PermitRecord[];
}

const LowBalanceModal: React.FC<LowBalanceModalProps> = ({ isOpen, onClose, records }) => {
    const lowBalanceEmployees = useMemo(() => {
        const balanceByEmployee: Record<string, {
            nombre: string;
            rut: string;
            saldoPA: number | null;
            saldoFL: number | null;
        }> = {};

        const sorted = [...records].sort((a, b) => compareRecordsByDateDesc(a, b));

        // Procesar PA — saldo final = diasHaber - cantidadDias del último registro
        const seenPA = new Set<string>();
        sorted.filter(r => r.solicitudType === 'PA').forEach(r => {
            if (!seenPA.has(r.rut)) {
                if (!balanceByEmployee[r.rut]) {
                    balanceByEmployee[r.rut] = { nombre: r.funcionario, rut: r.rut, saldoPA: null, saldoFL: null };
                }
                balanceByEmployee[r.rut].saldoPA = r.diasHaber - r.cantidadDias;
                seenPA.add(r.rut);
            }
        });

        // Procesar FL — usar saldo final según 1 o 2 períodos
        const seenFL = new Set<string>();
        sorted.filter(r => r.solicitudType === 'FL').forEach(r => {
            if (!seenFL.has(r.rut)) {
                if (!balanceByEmployee[r.rut]) {
                    balanceByEmployee[r.rut] = { nombre: r.funcionario, rut: r.rut, saldoPA: null, saldoFL: null };
                }
                balanceByEmployee[r.rut].saldoFL = getFLSaldoFinal(r, 0);
                seenFL.add(r.rut);
            }
        });

        // Filtrar solo los que tienen saldo bajo en algún tipo
        return Object.values(balanceByEmployee)
            .filter(e => (e.saldoPA !== null && e.saldoPA < 2) || (e.saldoFL !== null && e.saldoFL < 2))
            .sort((a, b) => {
                const minA = Math.min(a.saldoPA ?? 999, a.saldoFL ?? 999);
                const minB = Math.min(b.saldoPA ?? 999, b.saldoFL ?? 999);
                return minA - minB;
            });
    }, [records]);

    if (!isOpen) return null;

    const getSaldoColor = (saldo: number | null) => {
        if (saldo === null) return 'text-slate-400 dark:text-slate-500';
        if (saldo < 0) return 'text-red-600 dark:text-red-400';
        if (saldo < 1) return 'text-red-500 dark:text-red-400';
        if (saldo < 2) return 'text-amber-600 dark:text-amber-400';
        return 'text-emerald-600 dark:text-emerald-400';
    };

    const getSaldoBg = (saldo: number | null) => {
        if (saldo === null) return 'bg-slate-50 dark:bg-slate-700/50';
        if (saldo < 0) return 'bg-red-50 dark:bg-red-900/30';
        if (saldo < 2) return 'bg-amber-50 dark:bg-amber-900/30';
        return 'bg-emerald-50 dark:bg-emerald-900/30';
    };

    return (
        <div
            className="fixed inset-0 z-[150] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

            <div
                className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 sm:p-8 text-white relative overflow-hidden flex-shrink-0">
                    <div className="absolute top-0 right-0 p-4 opacity-20 scale-150 pointer-events-none">
                        <AlertTriangle size={100} />
                    </div>

                    <div className="flex items-center justify-between z-10 relative">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-lg">
                                <TrendingDown className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-tight">
                                    Alerta de Saldo Bajo
                                </h2>
                                <p className="text-[10px] sm:text-[11px] font-bold uppercase opacity-80 tracking-wider mt-1">
                                    {lowBalanceEmployees.length} funcionarios con menos de 2 días
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-white/20 rounded-xl transition-all border border-white/20"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {lowBalanceEmployees.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <TrendingDown className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                                ¡Todo en orden!
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                No hay funcionarios con saldo bajo en este momento.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {lowBalanceEmployees.map((emp, i) => (
                                <div
                                    key={emp.rut}
                                    className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-600"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white dark:bg-slate-600 rounded-xl flex items-center justify-center shadow-sm">
                                            <User className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-slate-800 dark:text-white uppercase truncate">
                                                {emp.nombre}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                                                {emp.rut}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {emp.saldoPA !== null && emp.saldoPA < 2 && (
                                                <div className={`px-3 py-2 rounded-xl text-center ${getSaldoBg(emp.saldoPA)}`}>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">PA</p>
                                                    <p className={`text-lg font-black ${getSaldoColor(emp.saldoPA)}`}>
                                                        {emp.saldoPA.toFixed(1)}
                                                    </p>
                                                </div>
                                            )}
                                            {emp.saldoFL !== null && emp.saldoFL < 2 && (
                                                <div className={`px-3 py-2 rounded-xl text-center ${getSaldoBg(emp.saldoFL)}`}>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">FL</p>
                                                    <p className={`text-lg font-black ${getSaldoColor(emp.saldoFL)}`}>
                                                        {emp.saldoFL.toFixed(1)}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                        Los funcionarios listados tienen menos de 2 días disponibles
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LowBalanceModal;
