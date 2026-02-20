/**
 * EmployeeTimeline - Componente de línea de tiempo para el historial de permisos
 */

import React, { useMemo } from 'react';
import { PermitRecord } from '../types';
import { Calendar, Sun, Clock, ChevronRight } from 'lucide-react';

interface EmployeeTimelineProps {
    records: PermitRecord[];
    year?: number;
}

const EmployeeTimeline: React.FC<EmployeeTimelineProps> = ({ records, year = new Date().getFullYear() }) => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Filtrar registros del año y ordenar por fecha
    const yearRecords = useMemo(() => {
        return records
            .filter(r => {
                if (!r.fechaInicio) return false;
                const date = new Date(r.fechaInicio + 'T12:00:00');
                return date.getFullYear() === year;
            })
            .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
    }, [records, year]);

    // Crear estructura de meses con sus registros
    const monthsData = useMemo(() => {
        const data: { month: number; records: PermitRecord[] }[] = [];

        for (let i = 0; i < 12; i++) {
            const monthRecords = yearRecords.filter(r => {
                const date = new Date(r.fechaInicio + 'T12:00:00');
                return date.getMonth() === i;
            });
            data.push({ month: i, records: monthRecords });
        }

        return data;
    }, [yearRecords]);

    // Calcular totales del año
    const totals = useMemo(() => {
        return yearRecords.reduce((acc, r) => {
            if (r.solicitudType === 'PA') {
                acc.pa += r.cantidadDias;
            } else {
                acc.fl += r.cantidadDias;
            }
            return acc;
        }, { pa: 0, fl: 0 });
    }, [yearRecords]);

    if (yearRecords.length === 0) {
        return (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold">Sin permisos registrados en {year}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header con totales */}
            <div className="flex items-center justify-between px-2">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Línea de Tiempo {year}
                </h4>
                <div className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                        <Clock size={10} /> PA: {totals.pa}d
                    </span>
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Sun size={10} /> FL: {totals.fl}d
                    </span>
                </div>
            </div>

            {/* Timeline horizontal */}
            <div className="relative">
                {/* Línea base */}
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700" />

                {/* Meses */}
                <div className="flex justify-between relative">
                    {monthsData.map(({ month, records: monthRecords }) => {
                        const hasRecords = monthRecords.length > 0;
                        const totalDays = monthRecords.reduce((sum, r) => sum + r.cantidadDias, 0);
                        const hasPa = monthRecords.some(r => r.solicitudType === 'PA');
                        const hasFl = monthRecords.some(r => r.solicitudType === 'FL');

                        return (
                            <div key={month} className="flex flex-col items-center relative group">
                                {/* Punto del mes */}
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all cursor-pointer ${hasRecords
                                        ? hasPa && hasFl
                                            ? 'bg-gradient-to-br from-indigo-500 to-amber-500 text-white shadow-lg'
                                            : hasPa
                                                ? 'bg-indigo-500 text-white shadow-md'
                                                : 'bg-amber-500 text-white shadow-md'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                                        }`}
                                >
                                    {hasRecords ? totalDays : months[month]}
                                </div>

                                {/* Nombre del mes */}
                                <span className={`mt-1 text-[8px] font-bold uppercase ${hasRecords ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'
                                    }`}>
                                    {months[month]}
                                </span>

                                {/* Tooltip con detalles */}
                                {hasRecords && (
                                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                        <div className="bg-slate-900 text-white text-[9px] px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                                            {monthRecords.map((r, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${r.solicitudType === 'PA' ? 'bg-indigo-400' : 'bg-amber-400'}`} />
                                                    <span>{r.solicitudType}: {r.cantidadDias}d</span>
                                                    <span className="text-slate-400">
                                                        {new Date(r.fechaInicio + 'T12:00:00').getDate()}/{month + 1}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="w-2 h-2 bg-slate-900 rotate-45 absolute -top-1 left-1/2 -translate-x-1/2" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Lista detallada compacta */}
            <div className="mt-4 space-y-1 max-h-32 overflow-y-auto">
                {[...yearRecords].reverse().map((record, idx) => {
                    const date = new Date(record.fechaInicio + 'T12:00:00');
                    const dayLabel = new Intl.DateTimeFormat('es-CL', { weekday: 'long' }).format(date);

                    return (
                        <div
                            key={idx}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] ${record.solicitudType === 'PA'
                                ? 'bg-indigo-50/50 dark:bg-indigo-900/30 border border-indigo-100/50 dark:border-indigo-800/20 text-indigo-700 dark:text-indigo-300'
                                : 'bg-amber-50/50 dark:bg-amber-900/30 border border-amber-100/50 dark:border-amber-800/20 text-amber-700 dark:text-amber-300'
                                }`}
                        >
                            <div className="flex flex-col min-w-[32px]">
                                <span className="font-black leading-none">{record.solicitudType}</span>
                                <span className="text-[7px] opacity-70 uppercase tracking-tighter">Tipo</span>
                            </div>
                            <div className="w-px h-6 bg-current opacity-10 mx-1" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="font-bold capitalize">{dayLabel}</span>
                                    <span className="w-1 h-1 rounded-full bg-current opacity-20" />
                                    <span className="font-black tracking-tight">{date.toLocaleDateString('es-CL')}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[8px] opacity-70 font-bold uppercase tracking-tight">
                                    <span>Inicia el {date.getDate()}</span>
                                    <span>·</span>
                                    <span>{record.cantidadDias} días</span>
                                    {record.tipoJornada !== 'Completa' && <span>· {record.tipoJornada}</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default EmployeeTimeline;
