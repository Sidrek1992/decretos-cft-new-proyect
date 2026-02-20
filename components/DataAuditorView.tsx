
import React, { useMemo, useState } from 'react';
import { PermitRecord, Employee } from '../types';
import { auditRecords, AuditIssue } from '../utils/dataAuditor';
import {
    X, Search, Users, Shield, AlertTriangle, CheckCircle,
    ChevronRight, LayoutDashboard, Database, RefreshCw, Undo2,
    Calendar, Filter, FileText, Settings, BarChart3, AlertCircle, Info, ArrowRight, Activity, Globe, Zap, History, Bell, CalendarCheck, Clock, Layers, UserPlus, HelpCircle, Download, User, UserX, Hash, XCircle
} from 'lucide-react';
import { formatNumericDate } from '../utils/formatters';

interface DataAuditorViewProps {
    records: PermitRecord[];
    employees?: Employee[];
    onSelectRecord?: (record: PermitRecord) => void;
}

const DataAuditorView: React.FC<DataAuditorViewProps> = ({ records, employees = [], onSelectRecord }) => {
    const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');
    const [categoryFilter, setCategoryFilter] = useState<'all' | AuditIssue['category'] | 'overlap'>('all');
    const [search, setSearch] = useState('');

    const issues = useMemo(() => auditRecords(records, employees), [records, employees]);

    const filteredIssues = useMemo(() => {
        return issues.filter(issue => {
            const matchesType = filter === 'all' || issue.type === filter;
            const matchesCategory = categoryFilter === 'all' || issue.category === categoryFilter;
            const matchesSearch = !search ||
                issue.record.funcionario.toLowerCase().includes(search.toLowerCase()) ||
                issue.record.acto.toLowerCase().includes(search.toLowerCase()) ||
                issue.message.toLowerCase().includes(search.toLowerCase());

            return matchesType && matchesCategory && matchesSearch;
        });
    }, [issues, filter, categoryFilter, search]);

    const stats = useMemo(() => {
        return {
            total: issues.length,
            errors: issues.filter(i => i.type === 'error').length,
            warnings: issues.filter(i => i.type === 'warning').length,
            overlaps: issues.filter(i => i.category === 'overlap').length,
            validRecords: records.length - new Set(issues.map(i => i.record.id)).size
        };
    }, [issues, records]);

    const handleExportAudit = () => {
        const headers = ["Tipo", "Categoría", "Funcionario", "RUT", "Acto", "Mensaje", "Detalles"];
        const rows = filteredIssues.map(i => [
            i.type.toUpperCase(),
            i.category.toUpperCase(),
            i.record.funcionario,
            i.record.rut,
            i.record.acto || "N/A",
            i.message,
            i.details || ""
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `auditoria_datos_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (records.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <FileText size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-black uppercase tracking-widest">No hay registros para analizar</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Dashboard Minimalista Mejorado */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><AlertCircle size={10} /> Hallazgos</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{stats.total}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-3xl border border-red-100 dark:border-red-900/30 shadow-sm">
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><XCircle size={10} /> Errores</p>
                    <p className="text-2xl font-black text-red-600 dark:text-red-400">{stats.errors}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-3xl border border-orange-100 dark:border-orange-900/30 shadow-sm">
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Layers size={10} /> Colisiones</p>
                    <p className="text-2xl font-black text-orange-600 dark:text-orange-400">{stats.overlaps}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-3xl border border-amber-100 dark:border-amber-900/30 shadow-sm">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><AlertTriangle size={10} /> Avisos</p>
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.warnings}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm col-span-2 md:col-span-1">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><CheckCircle size={10} /> Sanos</p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.validRecords}</p>
                </div>
            </div>

            {/* Controles de Filtrado */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-[2rem] border border-slate-200 dark:border-slate-700/50">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        placeholder="Buscar funcionario o mensaje..."
                        className="w-full pl-10 pr-4 py-2 bg-transparent text-sm font-bold outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-black uppercase tracking-wider outline-none cursor-pointer px-2"
                >
                    <option value="all">Todo el Riesgo</option>
                    <option value="error">Solo Errores</option>
                    <option value="warning">Solo Advertencias</option>
                </select>
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-black uppercase tracking-wider outline-none cursor-pointer px-2"
                >
                    <option value="all">Todas las Categorías</option>
                    <option value="dates">Fechas y Días</option>
                    <option value="missing_info">Datos Faltantes</option>
                    <option value="consistency">Identidad y RUT</option>
                    <option value="balance">Saldos</option>
                    <option value="overlap">Superposiciones</option>
                </select>

                <button
                    onClick={handleExportAudit}
                    className="p-2 bg-white dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:shadow-sm rounded-xl transition-all border border-slate-200 dark:border-slate-700"
                    title="Exportar Reporte CSV"
                >
                    <Download size={16} />
                </button>
            </div>

            {/* Lista de Hallazgos */}
            <div className="space-y-3">
                {filteredIssues.length > 0 ? (
                    filteredIssues.map((issue, idx) => (
                        <div
                            key={`${issue.id}-${idx}`}
                            className={`group p-5 bg-white dark:bg-slate-900/40 border rounded-3xl transition-all hover:shadow-md ${issue.type === 'error'
                                ? 'border-red-100 dark:border-red-900/20 hover:border-red-200'
                                : 'border-amber-100 dark:border-amber-900/20 hover:border-amber-200'
                                }`}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`p-2.5 rounded-2xl mt-1 ${issue.category === 'overlap' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' :
                                    issue.category === 'dates' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' :
                                        issue.category === 'balance' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-500' :
                                            issue.category === 'consistency' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500' :
                                                'bg-slate-50 dark:bg-slate-800 text-slate-400'
                                    }`}>
                                    {issue.category === 'overlap' ? <Layers size={20} /> :
                                        issue.type === 'error' ? <AlertCircle size={20} /> : <AlertTriangle size={20} />}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${issue.category === 'overlap' ? 'bg-orange-500 text-white' :
                                            issue.type === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' :
                                                'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
                                            }`}>
                                            {issue.category === 'overlap' ? 'Colisión de Fechas' :
                                                issue.type === 'error' ? 'Error Crítico' : 'Advertencia'}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            {issue.category === 'consistency' && <UserX size={10} />}
                                            {issue.category === 'missing_info' && <Hash size={10} />}
                                            {issue.category}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-1">
                                        {issue.message}
                                    </h4>
                                    {issue.details && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/30 leading-relaxed italic">
                                            {issue.details}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                            <User size={12} className="text-slate-300" />
                                            <span className="text-slate-600 dark:text-slate-300 md:max-w-[150px] truncate">{issue.record.funcionario}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                            <FileText size={12} className="text-slate-300" />
                                            <span className="text-slate-600 dark:text-slate-300">Acto: {issue.record.acto || '---'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-indigo-500 dark:text-indigo-400 rounded-lg">
                                            <Calendar size={12} />
                                            <span>{formatNumericDate(issue.record.fechaInicio)}</span>
                                        </div>
                                    </div>
                                </div>

                                {onSelectRecord && (
                                    <button
                                        onClick={() => onSelectRecord(issue.record)}
                                        className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-2xl transition-all self-center group/btn border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/40"
                                        title="Ver y corregir registro"
                                    >
                                        <ChevronRight size={20} className="group-hover/btn:translate-x-1 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-emerald-50/20 dark:bg-emerald-900/5 rounded-[3rem] border border-dashed border-emerald-100 dark:border-emerald-800/30">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mb-4 animate-pulse">
                            <CheckCircle size={32} className="text-emerald-500" />
                        </div>
                        <h5 className="text-sm font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-[0.2em]">Cero Inconsistencias</h5>
                        <p className="text-xs text-emerald-600/60 dark:text-emerald-400/40 mt-1">El set de datos analizado cumple con todas las reglas de integridad.</p>
                    </div>
                )}
            </div>

            <div className="p-6 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-800/30 flex items-start gap-4">
                <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                    <Info className="text-white" size={20} />
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">Información del Auditor</p>
                    <p className="text-[11px] text-indigo-600/70 dark:text-indigo-300/60 leading-relaxed">
                        Este sistema realiza verificaciones de cruce contra el maestro de personal, detecta superposición de fechas (colisiones),
                        valida el cálculo de días hábiles omitiendo feriados y fines de semana, y detecta anomalías en la numeración de actos.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DataAuditorView;
