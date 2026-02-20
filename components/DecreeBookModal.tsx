import React, { useState, useMemo, useEffect } from 'react';
import { PermitRecord } from '../types';
import {
    X, FileText, Download, Calendar, Printer, Search,
    ArrowUpDown, ChevronRight, BookOpen, Users, Clock,
    Share2, ExternalLink, FileDown, Filter, LayoutDashboard,
    AlertCircle
} from 'lucide-react';
import { formatNumericDate, toProperCase } from '../utils/formatters';
import { getFLSaldoFinal } from '../utils/flBalance';
import { normalizeSearchText } from '../utils/search';

interface DecreeBookModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: PermitRecord[];
}

const DecreeBookModal: React.FC<DecreeBookModalProps> = ({ isOpen, onClose, records }) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedType, setSelectedType] = useState<'ALL' | 'PA' | 'FL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'acto' | 'nombre' | 'fecha'>('acto');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthsShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const years = useMemo(() => {
        const s = new Set<number>([currentYear]);
        records.forEach(r => {
            if (r.fechaDecreto) {
                const year = new Date(r.fechaDecreto + 'T12:00:00').getFullYear();
                if (year) s.add(year);
            }
        });
        return Array.from(s).sort((a, b) => b - a);
    }, [records, currentYear]);

    const filteredRecords = useMemo(() => {
        let result = records.filter(r => {
            if (!r.fechaDecreto) return false;
            const d = new Date(r.fechaDecreto + 'T12:00:00');
            const matchesTime = d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
            const matchesType = selectedType === 'ALL' || r.solicitudType === selectedType;

            if (!matchesTime || !matchesType) return false;

            if (searchTerm) {
                const term = normalizeSearchText(searchTerm);
                const haystack = normalizeSearchText(`${r.acto} ${r.funcionario} ${r.rut}`);
                return haystack.includes(term);
            }

            return true;
        });

        result.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'acto') {
                const numA = parseInt(a.acto) || 0;
                const numB = parseInt(b.acto) || 0;
                comparison = numA - numB;
            } else if (sortBy === 'nombre') {
                comparison = a.funcionario.localeCompare(b.funcionario);
            } else if (sortBy === 'fecha') {
                comparison = new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime();
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [records, selectedYear, selectedMonth, selectedType, searchTerm, sortBy, sortDirection]);

    const stats = useMemo(() => {
        const total = filteredRecords.length;
        const totalDays = filteredRecords.reduce((a, r) => a + (r.cantidadDias || 0), 0);
        const uniqueEmployees = new Set(filteredRecords.map(r => r.rut)).size;
        return { total, totalDays, uniqueEmployees };
    }, [filteredRecords]);

    const handlePrint = () => {
        const w = window.open('', '_blank');
        if (!w) return;
        const dateStr = `${months[selectedMonth]} ${selectedYear}`;
        const html = `<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Libro de Decretos - ${dateStr}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; padding: 40px; }
                header { text-align: center; border-bottom: 2px solid #e2e8f0; margin-bottom: 30px; padding-bottom: 20px; }
                h1 { margin: 0; font-size: 24px; color: #0f172a; }
                .meta { color: #64748b; font-size: 14px; margin-top: 5px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; border: 1px solid #e2e8f0; }
                th { background: #f8fafc; color: #475569; padding: 12px 15px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #e2e8f0; }
                td { padding: 10px 15px; border-bottom: 1px solid #e2e8f0; font-size: 12px; border: 1px solid #e2e8f0; }
                tr:nth-child(even) { background-color: #f8fafc; }
                .badge { padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; }
                .badge-pa { background: #e0e7ff; color: #4338ca; }
                .badge-fl { background: #fef3c7; color: #92400e; }
                .stats { display: flex; gap: 40px; justify-content: center; margin-bottom: 30px; }
                .stat-item { text-align: center; }
                .stat-value { font-size: 20px; font-weight: bold; color: #0f172a; }
                .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
                @media print { body { padding: 0; } .no-print { display: none; } }
            </style>
        </head>
        <body>
            <header>
                <h1>Libro de Decretos</h1>
                <div class="meta">Departamento de Gestión de Personas · ${dateStr}</div>
            </header>
            
            <div class="stats">
                <div class="stat-item"><div class="stat-value">${stats.total}</div><div class="stat-label">Decretos</div></div>
                <div class="stat-item"><div class="stat-value">${stats.totalDays.toFixed(1)}</div><div class="stat-label">Días Totales</div></div>
                <div class="stat-item"><div class="stat-value">${stats.uniqueEmployees}</div><div class="stat-label">Funcionarios</div></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th width="80">N° Acto</th>
                        <th width="60">Tipo</th>
                        <th>Funcionario</th>
                        <th>RUT</th>
                        <th width="80">Fecha Inicio</th>
                        <th width="50">Días</th>
                        <th width="60">Saldo</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredRecords.map(r => {
            const saldoFinal = r.solicitudType === 'FL'
                ? getFLSaldoFinal(r, 0)
                : (r.diasHaber - r.cantidadDias);
            return `<tr>
                            <td><strong>${r.acto}</strong></td>
                            <td><span class="badge ${r.solicitudType === 'PA' ? 'badge-pa' : 'badge-fl'}">${r.solicitudType}</span></td>
                            <td>${toProperCase(r.funcionario)}</td>
                            <td>${r.rut}</td>
                            <td>${formatNumericDate(r.fechaInicio)}</td>
                            <td>${r.cantidadDias}</td>
                            <td>${Number(saldoFinal).toFixed(1)}</td>
                        </tr>`;
        }).join('')}
                </tbody>
            </table>
            <footer style="margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center;">
                Generado por GDP Cloud - ${new Date().toLocaleString('es-CL')}
            </footer>
        </body>
        </html>`;
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
            {/* Background Backdrop */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl transition-opacity animate-in fade-in duration-300" />

            {/* Modal Container */}
            <div
                className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 dark:border-white/5 animate-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Premium */}
                <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-6 sm:p-8 text-white overflow-hidden">
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-4 sm:gap-6">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/30">
                                <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white uppercase">Libro de Decretos</h2>
                                <div className="flex items-center gap-3 mt-1 opacity-90">
                                    <div className="flex items-center gap-1 text-xs sm:text-sm font-bold bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>Período Institucional</span>
                                    </div>
                                    <span className="w-1 h-1 bg-white/30 rounded-full" />
                                    <p className="text-xs sm:text-sm font-medium">Registro Auxiliar de Resoluciones</p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 bg-white/10 hover:bg-white/20 active:scale-95 rounded-2xl transition-all border border-white/10 group"
                        >
                            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                </div>

                {/* Toolbar / Filters */}
                <div className="p-4 sm:p-6 bg-slate-50 dark:bg-[#0f172a]/50 border-b border-slate-200 dark:border-white/5">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            {/* Selecciones de Fecha */}
                            <div className="flex items-center gap-2 sm:gap-3 bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <select
                                    value={selectedYear}
                                    onChange={e => setSelectedYear(+e.target.value)}
                                    className="pl-3 pr-8 py-2 bg-transparent text-sm font-black text-slate-700 dark:text-slate-200 border-none focus:ring-0 cursor-pointer"
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
                                <select
                                    value={selectedMonth}
                                    onChange={e => setSelectedMonth(+e.target.value)}
                                    className="pl-3 pr-8 py-2 bg-transparent text-sm font-black text-slate-700 dark:text-slate-200 border-none focus:ring-0 cursor-pointer"
                                >
                                    {monthsShort.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                </select>
                            </div>

                            {/* Filtro de Tipo (Tabs) */}
                            <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                                {(['ALL', 'PA', 'FL'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setSelectedType(t)}
                                        className={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${selectedType === t
                                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        {t === 'ALL' ? 'Todos' : t === 'PA' ? 'Permisos' : 'Feriados'}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 min-w-[200px] relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Buscar funcionario o decreto..."
                                    className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-800 border-none rounded-2xl text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
                                />
                            </div>

                            <button
                                onClick={handlePrint}
                                disabled={!filteredRecords.length}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 text-white rounded-2xl text-sm font-black shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
                            >
                                <Printer size={18} />
                                <span className="hidden sm:inline">Imprimir Libro</span>
                            </button>
                        </div>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-200 dark:border-white/5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow group">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Decretos</p>
                                    <p className="text-xl font-black text-slate-800 dark:text-white">{stats.total}</p>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-200 dark:border-white/5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow group">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Días Totales</p>
                                    <p className="text-xl font-black text-slate-800 dark:text-white">{stats.totalDays.toFixed(1)}</p>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-200 dark:border-white/5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow group">
                                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Funcionarios</p>
                                    <p className="text-xl font-black text-slate-800 dark:text-white">{stats.uniqueEmployees}</p>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-200 dark:border-white/5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow group">
                                <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                                    <LayoutDashboard size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Promedio</p>
                                    <p className="text-xl font-black text-slate-800 dark:text-white">{stats.total > 0 ? (stats.totalDays / stats.total).toFixed(1) : 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-y-auto bg-white dark:bg-[#020617]">
                    {filteredRecords.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-500">
                            <div className="w-24 h-24 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-6">
                                <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Sin registros</h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-xs mt-2 font-medium">
                                No se encontraron decretos emitidos para {months[selectedMonth]} {selectedYear}. Prueba con otros filtros.
                            </p>
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setSelectedType('ALL');
                                }}
                                className="mt-8 px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-black transition-all"
                            >
                                Limpiar Filtros
                            </button>
                        </div>
                    ) : (
                        <div className="border-collapse w-full">
                            {/* Header Table */}
                            <div className="sticky top-0 z-10 grid grid-cols-[100px_80px_1fr_120px_100px_80px_80px] gap-4 px-6 py-4 bg-slate-50 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                <button onClick={() => {
                                    if (sortBy === 'acto') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                                    else { setSortBy('acto'); setSortDirection('asc'); }
                                }} className="flex items-center gap-1 hover:text-indigo-500 transition-colors">
                                    Acto {sortBy === 'acto' && <ArrowUpDown size={10} />}
                                </button>
                                <div>Tipo</div>
                                <button onClick={() => {
                                    if (sortBy === 'nombre') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                                    else { setSortBy('nombre'); setSortDirection('asc'); }
                                }} className="flex items-center gap-1 hover:text-indigo-500 transition-colors">
                                    Funcionario {sortBy === 'nombre' && <ArrowUpDown size={10} />}
                                </button>
                                <div>RUT</div>
                                <button onClick={() => {
                                    if (sortBy === 'fecha') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                                    else { setSortBy('fecha'); setSortDirection('asc'); }
                                }} className="flex items-center gap-1 hover:text-indigo-500 transition-colors">
                                    Fecha {sortBy === 'fecha' && <ArrowUpDown size={10} />}
                                </button>
                                <div className="text-right">Días</div>
                                <div className="text-right">Saldo</div>
                            </div>

                            {/* Body Rows */}
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredRecords.map((r, i) => {
                                    const saldoFinal = r.solicitudType === 'FL'
                                        ? getFLSaldoFinal(r, 0)
                                        : (r.diasHaber - r.cantidadDias);

                                    return (
                                        <div
                                            key={r.id}
                                            className="grid grid-cols-[100px_80px_1fr_120px_100px_80px_80px] gap-4 px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group"
                                        >
                                            <div className="flex items-center">
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-black border border-slate-200 dark:border-slate-700 group-hover:border-indigo-400 transition-colors">
                                                    {r.acto}
                                                </span>
                                            </div>
                                            <div className="flex items-center">
                                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${r.solicitudType === 'PA'
                                                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                        : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                                    }`}>
                                                    {r.solicitudType}
                                                </span>
                                            </div>
                                            <div className="flex flex-col justify-center min-w-0">
                                                <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                                                    {toProperCase(r.funcionario)}
                                                </p>
                                                {r.departamento && (
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.departamento}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                                                {r.rut}
                                            </div>
                                            <div className="flex items-center font-medium text-slate-600 dark:text-slate-300">
                                                <span className="flex items-center gap-1.5 text-xs">
                                                    <Clock size={12} className="text-slate-400" />
                                                    {formatNumericDate(r.fechaInicio)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-end font-black text-slate-900 dark:text-white">
                                                {r.cantidadDias}
                                            </div>
                                            <div className="flex items-center justify-end font-black text-slate-900 dark:text-indigo-400">
                                                {Number(saldoFinal).toFixed(1)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="px-8 py-5 bg-slate-50 dark:bg-[#0f172a]/80 border-t border-slate-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-3">
                            {filteredRecords.slice(0, 5).map((r, i) => (
                                <div key={i} className={`w-8 h-8 rounded-full ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[10px] font-black ${['bg-indigo-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500'][i % 5]
                                    } text-white`}>
                                    {r.funcionario.charAt(0)}
                                </div>
                            ))}
                            {stats.uniqueEmployees > 5 && (
                                <div className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-500 dark:text-slate-400">
                                    +{stats.uniqueEmployees - 5}
                                </div>
                            )}
                        </div>
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            Representación mensual del registro histórico institucional
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><AlertCircle size={14} /> Solo lectura</span>
                        <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
                        <span>Sincronizado con GCP Cloud Engine</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DecreeBookModal;
