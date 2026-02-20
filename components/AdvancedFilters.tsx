
import React, { useState } from 'react';
import { Filter, X, Calendar, RotateCcw } from 'lucide-react';

export interface FilterState {
    dateFrom: string;
    dateTo: string;
    minDays: string;
    maxDays: string;
    materia: string;
}

interface AdvancedFiltersProps {
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
    onReset: () => void;
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({ filters, onFiltersChange, onReset }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const hasActiveFilters = Object.values(filters).some(v => v !== '');

    const handleChange = (key: keyof FilterState, value: string) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Toggle button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${hasActiveFilters ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                        <Filter size={16} />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        Filtros Avanzados
                    </span>
                    {hasActiveFilters && (
                        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-full uppercase">
                            Activos
                        </span>
                    )}
                </div>
                <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {/* Filters panel */}
            {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-4">
                    {/* Fecha desde/hasta */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                                Fecha desde
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => handleChange('dateFrom', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 dark:focus:ring-indigo-900/50"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                                Fecha hasta
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => handleChange('dateTo', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 dark:focus:ring-indigo-900/50"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Días min/max */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                                Días mín.
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={filters.minDays}
                                onChange={(e) => handleChange('minDays', e.target.value)}
                                placeholder="0"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 dark:focus:ring-indigo-900/50 text-center"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                                Días máx.
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={filters.maxDays}
                                onChange={(e) => handleChange('maxDays', e.target.value)}
                                placeholder="30"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 dark:focus:ring-indigo-900/50 text-center"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                                Materia
                            </label>
                            <select
                                value={filters.materia}
                                onChange={(e) => handleChange('materia', e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 dark:focus:ring-indigo-900/50 cursor-pointer"
                            >
                                <option value="">Todas las materias</option>
                                <option value="Decreto Exento">Decreto Exento</option>
                                <option value="Resolución Exenta">Resolución Exenta</option>
                                <option value="Decreto">Decreto</option>
                                <option value="Resolución">Resolución</option>
                            </select>
                        </div>
                    </div>

                    {/* Reset button */}
                    {hasActiveFilters && (
                        <button
                            onClick={onReset}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl transition-colors text-sm font-bold"
                        >
                            <RotateCcw size={14} />
                            Limpiar filtros
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdvancedFilters;
