import React, { useState, useMemo } from 'react';
import { PermitRecord, Employee } from '../types';
import { ChevronLeft, ChevronRight, Calendar, X, FileText, Search, RotateCcw } from 'lucide-react';
import { normalizeRutForSearch, normalizeSearchText } from '../utils/search';

interface CalendarViewProps {
    isOpen: boolean;
    onClose: () => void;
    records: PermitRecord[];
    employees: Employee[];
}

type TypeFilter = 'todos' | 'PA' | 'FL';

const CalendarView: React.FC<CalendarViewProps> = ({ isOpen, onClose, records, employees }) => {
    const today = new Date();
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));


    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [selectedRecord, setSelectedRecord] = useState<PermitRecord | null>(null);
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [showInsights, setShowInsights] = useState(true);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    // Años disponibles
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        records.forEach(r => {
            if (r.fechaInicio) years.add(new Date(r.fechaInicio + 'T12:00:00').getFullYear());
        });
        years.add(today.getFullYear());
        return [...years].sort((a, b) => b - a);
    }, [records]);



    // Filtrar registros según tipo + búsqueda de empleado + depto
    const filteredRecords = useMemo(() => {
        const normalizedEmployeeSearch = normalizeSearchText(employeeSearch);
        const normalizedRutSearch = normalizeRutForSearch(employeeSearch);

        return records.filter(r => {
            if (typeFilter !== 'todos' && r.solicitudType !== typeFilter) return false;
            if (normalizedEmployeeSearch) {
                const matchesEmployee = normalizeSearchText(r.funcionario).includes(normalizedEmployeeSearch);
                const matchesRut = normalizedRutSearch
                    ? normalizeRutForSearch(r.rut).includes(normalizedRutSearch)
                    : false;
                if (!matchesEmployee && !matchesRut) return false;
            }
            return true;
        });
    }, [records, typeFilter, employeeSearch]);

    // Agrupar por día con info de rango
    const decreesByDay = useMemo(() => {
        const grouped: Record<number, { record: PermitRecord; isStart: boolean; isEnd: boolean; isMid: boolean; dayNumber: number }[]> = {};

        filteredRecords.forEach(r => {
            if (!r.fechaInicio) return;
            const startDate = new Date(r.fechaInicio + 'T12:00:00');
            // Para FL usar fechaTermino si existe para calcular rango real
            let calendarDays: number;
            if (r.solicitudType === 'FL' && r.fechaTermino) {
                const end = new Date(r.fechaTermino + 'T12:00:00');
                calendarDays = Math.round((end.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            } else {
                calendarDays = Math.max(Math.ceil(r.cantidadDias || 1), 1);
            }

            for (let i = 0; i < calendarDays; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                if (d.getFullYear() === year && d.getMonth() === month) {
                    const day = d.getDate();
                    if (!grouped[day]) grouped[day] = [];
                    grouped[day].push({
                        record: r,
                        isStart: i === 0,
                        isEnd: i === calendarDays - 1,
                        isMid: i > 0 && i < calendarDays - 1,
                        dayNumber: i + 1
                    });
                }
            }
        });
        return grouped;
    }, [filteredRecords, year, month]);

    // Cálculos para Dashboard (Insights) - Ahora respetan el filtro de búsqueda
    const insights = useMemo(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString().split('T')[0];

        const onLeaveToday: PermitRecord[] = [];
        const startsToday: PermitRecord[] = [];
        const upcomingNextWeek: PermitRecord[] = [];

        // Usar filteredRecords para que el panel lateral también se filtre al buscar
        filteredRecords.forEach(r => {
            if (!r.fechaInicio) return;

            const start = new Date(r.fechaInicio + 'T12:00:00');
            let end: Date;
            if (r.solicitudType === 'FL' && r.fechaTermino) {
                end = new Date(r.fechaTermino + 'T12:00:00');
            } else {
                end = new Date(start);
                end.setDate(start.getDate() + Math.max(Math.ceil(r.cantidadDias || 1), 1) - 1);
            }

            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            // Inician Hoy
            if (startStr === todayStr) {
                startsToday.push(r);
            }

            // En curso Hoy (incluye los que inician hoy)
            if (todayStr >= startStr && todayStr <= endStr) {
                onLeaveToday.push(r);
            }

            // Próxima semana (a partir de mañana)
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            if (startStr >= tomorrowStr && startStr <= nextWeekStr) {
                upcomingNextWeek.push(r);
            }
        });

        return { onLeaveToday, startsToday, upcomingNextWeek };
    }, [filteredRecords]);

    // Resumen mensual (respetando depto)
    const monthlySummary = useMemo(() => {
        let totalPA = 0, totalFL = 0, countPA = 0, countFL = 0;
        const seen = new Set<string>();
        filteredRecords.forEach(r => {
            if (!r.fechaInicio) return;
            const d = new Date(r.fechaInicio + 'T12:00:00');
            if (d.getFullYear() !== year || d.getMonth() !== month) return;
            const key = r.id || `${r.funcionario}-${r.fechaInicio}-${r.solicitudType}`;
            if (seen.has(key)) return;
            seen.add(key);
            if (r.solicitudType === 'PA') { totalPA += r.cantidadDias; countPA++; }
            else { totalFL += r.cantidadDias; countFL++; }
        });
        return { totalPA, totalFL, countPA, countFL };
    }, [filteredRecords, year, month]);

    // Nav
    const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); };
    const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); };
    const goToday = () => { setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(null); };

    const isWeekend = (day: number) => {
        const d = new Date(year, month, day);
        return d.getDay() === 0 || d.getDay() === 6;
    };
    const isToday = (day: number) =>
        day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    // Badge de rango: esquinas según posición
    const badgeRadius = (isStart: boolean, isEnd: boolean) => {
        if (isStart && isEnd) return 'rounded-md';
        if (isStart) return 'rounded-l-md';
        if (isEnd) return 'rounded-r-md';
        return 'rounded-none';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-7xl max-h-[92vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

                {/* ─── Header ─── */}
                <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 p-5 sm:px-8 sm:py-6 text-white shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl shadow-inner border border-white/20">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">Calendario de Decretos</h2>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <p className="text-[10px] sm:text-xs opacity-70 font-black uppercase tracking-[0.2em]">Dashboard Operativo 2026</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowInsights(!showInsights)}
                                className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${showInsights ? 'bg-white text-indigo-700 border-white' : 'bg-transparent text-white border-white/30 hover:bg-white/10'}`}
                            >
                                <span className="w-2 h-2 rounded-full border border-current" />
                                {showInsights ? 'Ocultar Panel' : 'Ver Insights'}
                            </button>
                            <button onClick={onClose} className="p-2.5 hover:bg-white/20 rounded-xl transition-all active:scale-95 border border-white/10">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* ─── Sidebar: Insights ─── */}
                    {showInsights && (
                        <div className="hidden lg:flex w-72 flex-col border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 overflow-y-auto custom-scrollbar animate-in slide-in-from-left duration-300">
                            <div className="p-6 space-y-8">


                                {/* Inician Hoy */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Inician Hoy</p>
                                        </div>
                                        <span className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                            {insights.startsToday.length}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {insights.startsToday.length > 0 ? insights.startsToday.map(r => (
                                            <div
                                                key={r.id}
                                                onClick={() => {
                                                    setSelectedRecord(r);
                                                    setSelectedDay(null);
                                                }}
                                                className="p-3 bg-white dark:bg-slate-800 rounded-xl border-l-4 border-l-indigo-500 border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group cursor-pointer active:scale-[0.98]"
                                            >
                                                <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase truncate group-hover:text-indigo-600">{r.funcionario}</p>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${r.solicitudType === 'PA' ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-500' : 'bg-amber-50 dark:bg-amber-900/40 text-amber-500'}`}>{r.solicitudType === 'PA' ? 'Permiso Admin.' : 'Feriado Legal'}</span>
                                                    <span className="text-[9px] font-black text-slate-400">+{r.cantidadDias}d</span>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="py-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                                <p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Sin inicios hoy</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Today's Status (En curso) */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ausentes / En curso Hoy</p>
                                        <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                                            {insights.onLeaveToday.length}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {insights.onLeaveToday.length > 0 ? insights.onLeaveToday.map(r => (
                                            <div
                                                key={r.id}
                                                onClick={() => {
                                                    setSelectedRecord(r);
                                                    setSelectedDay(null);
                                                }}
                                                className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:border-indigo-200 transition-colors group cursor-pointer active:scale-[0.98]"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase truncate group-hover:text-indigo-600">{r.funcionario}</p>
                                                    {insights.startsToday.some(s => s.id === r.id) && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${r.solicitudType === 'PA' ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-500' : 'bg-amber-50 dark:bg-amber-900/40 text-amber-500'}`}>{r.solicitudType}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight italic">
                                                        {r.fechaInicio === new Date().toISOString().split('T')[0] ? 'Inicia hoy' : 'En curso'}
                                                    </span>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="py-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                                <p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Sin ausencias hoy</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Upcoming Next Week */}
                                <div className="space-y-4 pb-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Inician Próx. Semana</p>
                                        <span className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                            {insights.upcomingNextWeek.length}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {insights.upcomingNextWeek.length > 0 ? insights.upcomingNextWeek.map(r => (
                                            <div key={r.id} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:border-purple-200 transition-colors group">
                                                <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase truncate group-hover:text-purple-600">{r.funcionario}</p>
                                                <div className="flex items-center justify-between mt-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                                        <p className="text-[9px] font-black text-slate-400 uppercase">{r.fechaInicio}</p>
                                                    </div>
                                                    <span className="text-[9px] font-black text-purple-500">+{r.cantidadDias}d</span>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="py-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                                <p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Sin próximos ingresos</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Main Content: Calendar ─── */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 overflow-hidden relative">
                        {/* ─── Filtros Superiores ─── */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm z-20 shrink-0">
                            <div className="flex items-center gap-4">
                                {/* Tipo Permit Filter */}
                                <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl shadow-inner border border-slate-200 dark:border-slate-600">
                                    {(['todos', 'PA', 'FL'] as const).map(opt => {
                                        const labels: Record<string, string> = { todos: 'Todos', PA: 'PA', FL: 'FL' };
                                        const active = typeFilter === opt;
                                        const theme = {
                                            todos: active ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-md' : 'text-slate-400 dark:text-slate-500',
                                            PA: active ? 'bg-indigo-600 text-white shadow-indigo-200' : 'text-slate-400 dark:text-slate-500',
                                            FL: active ? 'bg-amber-500 text-white shadow-amber-200' : 'text-slate-400 dark:text-slate-500'
                                        };
                                        return (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => { setTypeFilter(opt); setSelectedDay(null); }}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${theme[opt]} hover:scale-[1.02] active:scale-[0.98] uppercase tracking-wide`}
                                            >
                                                {labels[opt]}
                                            </button>
                                        );
                                    })}
                                </div>


                            </div>

                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className="relative flex-1 sm:w-64">
                                    <Search className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre o RUT..."
                                        value={employeeSearch}
                                        onChange={e => { setEmployeeSearch(e.target.value); setSelectedDay(null); }}
                                        className="w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ─── Control de Calendario ─── */}
                        <div className="px-6 py-4 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-6">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-3">
                                    <span className="text-indigo-600">{monthNames[month]}</span>
                                    <span className="text-slate-300 dark:text-slate-600">/</span>
                                    <span className="text-slate-400">{year}</span>
                                </h3>
                                <div className="flex items-center bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                                    <button onClick={prevMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-all">
                                        <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                    </button>
                                    <button onClick={nextMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-all">
                                        <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={goToday}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 rounded-xl transition-all shadow-sm active:scale-95 text-[10px] font-black uppercase"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Hoy
                            </button>
                        </div>

                        {/* ─── Grid ─── */}
                        <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
                            <div className="grid grid-cols-7 gap-2">
                                {dayNames.map((name, i) => (
                                    <div key={name} className={`text-center py-2 text-[10px] font-black uppercase tracking-[0.2em] ${i === 0 || i === 6 ? 'text-rose-500/60' : 'text-slate-400'}`}>
                                        {name}
                                    </div>
                                ))}

                                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                                    <div key={`empty-${i}`} className="h-32 bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl" />
                                ))}

                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const dayRecords = decreesByDay[day] || [];
                                    const hasRecords = dayRecords.length > 0;
                                    const weekend = isWeekend(day);
                                    const isSelected = selectedDay === day;
                                    const activeToday = isToday(day);

                                    return (
                                        <div
                                            key={day}
                                            onClick={() => {
                                                if (hasRecords) {
                                                    setSelectedDay(isSelected ? null : day);
                                                    setSelectedRecord(null);
                                                } else {
                                                    setSelectedDay(null);
                                                    setSelectedRecord(null);
                                                }
                                            }}
                                            className={[
                                                'min-h-[140px] p-3 rounded-2xl border-2 transition-all relative overflow-hidden group',
                                                activeToday ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : weekend ? 'border-transparent bg-slate-50/30 dark:bg-slate-900/5' : 'border-transparent bg-slate-50/80 dark:bg-slate-800/40',
                                                hasRecords ? 'cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-xl hover:-translate-y-1' : '',
                                                isSelected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 shadow-lg ring-4 ring-indigo-500/10 z-10' : ''
                                            ].join(' ')}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span className={[
                                                    'text-sm font-black transition-colors',
                                                    activeToday || isSelected ? 'text-indigo-600 dark:text-indigo-400' : weekend ? 'text-rose-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white'
                                                ].join(' ')}>
                                                    {day.toString().padStart(2, '0')}
                                                </span>
                                                {(activeToday || isSelected) && <span className={`w-1.5 h-1.5 rounded-full bg-indigo-600 ${activeToday ? 'animate-ping' : ''}`} />}
                                            </div>

                                            {hasRecords && (
                                                <div className="space-y-1.5">
                                                    {dayRecords.slice(0, 4).map((entry, idx) => {
                                                        const isPA = entry.record.solicitudType === 'PA';
                                                        const bg = isPA ? 'bg-indigo-600 text-white shadow-sm' : 'bg-amber-500 text-white shadow-sm';
                                                        const radius = badgeRadius(entry.isStart, entry.isEnd);

                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`${bg} ${radius} text-[9px] px-2 py-1 font-black shadow-sm flex items-center justify-between gap-1 min-w-0 transition-transform hover:scale-105`}
                                                            >
                                                                <span className="truncate uppercase">{entry.record.funcionario.split(' ')[0]}</span>
                                                                {entry.isStart && <div className="w-1 h-1 rounded-full bg-white shrink-0" />}
                                                            </div>
                                                        );
                                                    })}
                                                    {dayRecords.length > 4 && (
                                                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 pt-1 text-center bg-slate-200/50 dark:bg-slate-700/50 rounded-lg py-1">
                                                            +{dayRecords.length - 4} más
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ─── Panel de Detalles (Sliding Right Panel) ─── */}
                        {(selectedDay || selectedRecord) && (
                            <div className="absolute top-0 right-0 bottom-0 w-full sm:w-96 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-l border-slate-200 dark:border-slate-700 shadow-2xl z-[100] animate-in slide-in-from-right duration-300 flex flex-col">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                            {selectedRecord ? 'Detalle de Decreto' : 'Decretos Registrados'}
                                        </h4>
                                        <p className="text-[10px] font-bold text-indigo-600 uppercase mt-1">
                                            {selectedRecord
                                                ? `Funcionario: ${selectedRecord.funcionario}`
                                                : `${selectedDay} de ${monthNames[month]} de ${year}`
                                            }
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedDay(null); setSelectedRecord(null); }}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                                    >
                                        <X className="w-5 h-5 text-slate-400" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                    {(selectedRecord ? [{ record: selectedRecord, isStart: true, isEnd: false, isMid: false, dayNumber: 0 }] : (decreesByDay[selectedDay!] || [])).map((entry, idx) => {
                                        const isPA = entry.record.solicitudType === 'PA';
                                        return (
                                            <div
                                                key={idx}
                                                className={`p-4 rounded-2xl border ${isPA ? 'bg-indigo-50/30 border-indigo-100' : 'bg-amber-50/30 border-amber-100'} transition-all hover:shadow-md cursor-default group`}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${isPA ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'}`}>
                                                            {entry.record.solicitudType}
                                                        </span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase">#{entry.record.acto}</span>
                                                    </div>
                                                    <FileText className={`w-4 h-4 ${isPA ? 'text-indigo-400' : 'text-amber-400'} opacity-0 group-hover:opacity-100 transition-opacity`} />
                                                </div>

                                                <h5 className="text-xs font-black text-slate-800 dark:text-white uppercase leading-tight mb-1">
                                                    {entry.record.funcionario}
                                                </h5>
                                                {entry.record.materia && (
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-3 tracking-wide">{entry.record.materia}</p>
                                                )}

                                                <div className="grid grid-cols-2 gap-2 mt-4">
                                                    <div className="p-2 rounded-xl bg-white dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-tighter">Desde</p>
                                                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{entry.record.fechaInicio}</p>
                                                    </div>
                                                    <div className="p-2 rounded-xl bg-white dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-tighter">Hasta</p>
                                                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{entry.record.fechaTermino || entry.record.fechaInicio}</p>
                                                    </div>
                                                    <div className="p-2 rounded-xl bg-white dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-tighter">Duración</p>
                                                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{entry.record.cantidadDias} días</p>
                                                    </div>
                                                    <div className="p-2 rounded-xl bg-white dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-tighter">Jornada</p>
                                                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{entry.record.tipoJornada || 'Completa'}</p>
                                                    </div>
                                                </div>

                                                {entry.record.periodo && (
                                                    <div className="mt-3">
                                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                                                            P: {entry.record.periodo}
                                                        </span>
                                                    </div>
                                                )}

                                                {entry.record.observaciones && (
                                                    <div className="mt-3 p-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                                                        <p className="text-[9px] text-slate-500 dark:text-slate-400 italic">
                                                            "{entry.record.observaciones}"
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-600/50 flex items-center justify-between">
                                                    <span className={`text-[9px] font-black uppercase italic ${isPA ? 'text-indigo-500' : 'text-amber-600'}`}>
                                                        {entry.isStart ? '● Inicia hoy' : entry.isEnd ? '◆ Termina hoy' : '─ Continuando'}
                                                    </span>
                                                    {entry.dayNumber > 0 && (
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Día {entry.dayNumber}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
                                    <p className="text-[9px] font-black text-slate-400 uppercase text-center tracking-widest">
                                        {selectedRecord ? 'Información única del registro' : `Total del día: ${decreesByDay[selectedDay!]?.length || 0} registros`}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── Summary Bar ─── */}
                <div className="px-8 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-800">PA</div>
                                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-800">FL</div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Mes</p>
                                <p className="text-xs font-black text-slate-700 dark:text-slate-200 mt-1">
                                    {monthlySummary.totalPA + monthlySummary.totalFL} Días Registrados
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm" />
                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Permisos Admin.</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Feriado Legal</span>
                        </div>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
                        <p className="text-[10px] font-black text-slate-400 italic">● inicio · ─ medio · ◆ fin</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
