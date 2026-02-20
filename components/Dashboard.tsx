
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { PermitRecord } from '../types';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    Users,
    Calendar,
    AlertTriangle,
    ChevronRight,
    FileDown,
    Loader2,
    Activity,
    Clock,
    X,
    Sun,
    Search,
    ArrowUpDown,
    ChevronLeft,
    FileSpreadsheet,
    FileText
} from 'lucide-react';
import { exportDashboardToPDF } from '../services/batchPdfGenerator';
import { compareRecordsByDateDesc } from '../utils/recordDates';
import { getFLSaldoFinal } from '../utils/flBalance';
import { normalizeSearchText } from '../utils/search';
import { CONFIG } from '../config';
import OperationalOverview from './OperationalOverview';

interface DashboardProps {
    records: PermitRecord[];
    employees: { nombre: string; rut: string }[];
}

const COLORS = {
    PA: '#6366f1',
    FL: '#f59e0b',
    positive: '#10b981',
    negative: '#ef4444',
    neutral: '#64748b',
    paLight: '#6366f120',
    flLight: '#f59e0b20'
};

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_NAMES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const getAnalyticsDays = (record: PermitRecord): number => {
    const cantidadDias = Number(record.cantidadDias || 0);

    // Priorizamos siempre cantidadDias si existe y es > 0
    if (cantidadDias > 0) return cantidadDias;

    if (record.solicitudType === 'FL') {
        const solicitadoP1 = Number(record.solicitadoP1 ?? 0);
        const solicitadoP2 = Number(record.solicitadoP2 ?? 0);
        const solicitadoTotal = solicitadoP1 + solicitadoP2;

        if (solicitadoTotal > 0) return solicitadoTotal;

        const saldoDispP1 = Number(record.saldoDisponibleP1 ?? 0);
        const saldoFinalP1 = Number(record.saldoFinalP1 ?? 0);
        const saldoDispP2 = Number(record.saldoDisponibleP2 ?? 0);
        const saldoFinalP2 = Number(record.saldoFinalP2 ?? 0);
        const usadoDesdeSaldos = Math.max(0, saldoDispP1 - saldoFinalP1) + Math.max(0, saldoDispP2 - saldoFinalP2);

        if (usadoDesdeSaldos > 0) return usadoDesdeSaldos;
    }

    return cantidadDias;
};

const getFLRequestedPeriodDays = (record: PermitRecord): number => {
    // Priorizamos cantidadDias para mantener consistencia con getAnalyticsDays
    if (record.cantidadDias > 0) return record.cantidadDias;

    const solicitadoP1 = Number(record.solicitadoP1 ?? 0);
    const solicitadoP2 = Number(record.solicitadoP2 ?? 0);
    return solicitadoP1 + solicitadoP2;
};

// ---------------------------------------------------------------------------
// Tipos para el panel de detalle
// ---------------------------------------------------------------------------
type KpiDetailType = 'solicitudes' | 'funcionarios' | 'dias' | 'usoPA' | 'feriados' | 'saldoBajo' | null;

interface DetailData {
    title: string;
    subtitle: string;
    items: Array<{
        id: string;
        primary: string;
        secondary?: string;
        value: string | number;
        sortValue?: number;
        valueColor?: string;
        extra?: string;
    }>;
}

// ---------------------------------------------------------------------------
// Componentes auxiliares reutilizables
// ---------------------------------------------------------------------------

interface KpiCardProps {
    label: string;
    value: string | number;
    sub?: string;
    tooltip?: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    borderColor?: string;
    trend?: { value: number; label: string };
    onClick?: () => void;
    highlight?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, tooltip, icon: Icon, iconBg, iconColor, borderColor = 'border-slate-200 dark:border-slate-700', trend, onClick, highlight }) => (
    <div
        onClick={onClick}
        title={tooltip}
        className={`bg-white dark:bg-slate-800 rounded-2xl p-4 border ${borderColor} transition-all hover:shadow-md ${onClick ? 'cursor-pointer group' : ''} ${highlight ? 'ring-2 ring-amber-400/60' : ''}`}
    >
        <div className="flex items-start justify-between">
            <div className={`${iconBg} ${iconColor} p-2.5 rounded-xl ${onClick ? 'group-hover:scale-110 transition-transform' : ''}`}>
                <Icon className="w-5 h-5" />
            </div>
            {trend && (
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${trend.value >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                    {trend.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {trend.label}
                </div>
            )}
        </div>
        <div className="mt-3">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
            <div className="flex items-center gap-2 mt-0.5">
                <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
                {onClick && <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />}
            </div>
            {sub && <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
        </div>
    </div>
);

// Tooltip personalizado para gráficos
interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900 dark:bg-slate-700 border border-slate-700 dark:border-slate-600 rounded-xl p-3 shadow-xl">
            <p className="text-[11px] font-black text-slate-300 mb-2 uppercase tracking-wider">{label}</p>
            {payload.map((entry, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-[11px] font-bold text-slate-400">{entry.name}</span>
                    </div>
                    <span className="text-[11px] font-black text-white">{entry.value} días</span>
                </div>
            ))}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Panel de Detalle para KPIs
// ---------------------------------------------------------------------------
interface KpiDetailPanelProps {
    data: DetailData | null;
    onClose: () => void;
}

const KpiDetailPanel: React.FC<KpiDetailPanelProps> = ({ data, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'valor' | 'nombre'>('valor');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(8);
    const [isExportingExcel, setIsExportingExcel] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    const items = data?.items ?? [];

    useEffect(() => {
        if (!data) return;
        setSearchTerm('');
        setSortBy('valor');
        setSortDirection('desc');
        setCurrentPage(1);
    }, [data?.title]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, sortBy, sortDirection, pageSize]);

    const normalizedItems = useMemo(() => {
        return items.map(item => {
            const rawValue = typeof item.value === 'number'
                ? item.value
                : Number(String(item.value).replace(',', '.').replace(/[^0-9.-]/g, ''));

            const computedSortValue = typeof item.sortValue === 'number'
                ? item.sortValue
                : Number.isFinite(rawValue)
                    ? rawValue
                    : 0;

            return {
                ...item,
                computedSortValue
            };
        });
    }, [items]);

    const filteredItems = useMemo(() => {
        const term = normalizeSearchText(searchTerm);
        if (!term) return normalizedItems;

        return normalizedItems.filter(item => {
            const haystack = normalizeSearchText(`${item.primary} ${item.secondary || ''} ${item.extra || ''}`);
            return haystack.includes(term);
        });
    }, [normalizedItems, searchTerm]);

    const sortedItems = useMemo(() => {
        const copy = [...filteredItems];

        copy.sort((a, b) => {
            let result = 0;

            if (sortBy === 'nombre') {
                result = a.primary.localeCompare(b.primary, 'es', { sensitivity: 'base' });
            } else {
                result = a.computedSortValue - b.computedSortValue;
            }

            return sortDirection === 'asc' ? result : -result;
        });

        return copy;
    }, [filteredItems, sortBy, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const pageStart = (currentPage - 1) * pageSize;
    const pageItems = sortedItems.slice(pageStart, pageStart + pageSize);
    const showingFrom = sortedItems.length === 0 ? 0 : pageStart + 1;
    const showingTo = Math.min(pageStart + pageItems.length, sortedItems.length);

    const safeTitle = useMemo(() => {
        return (data?.title || 'detalle_kpi')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
    }, [data?.title]);

    const escapeHtml = (value: string): string => {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const handleExportExcel = useCallback(async () => {
        if (!data || sortedItems.length === 0) return;

        setIsExportingExcel(true);
        try {
            const XLSX = await import('xlsx');
            const rows = sortedItems.map((item, idx) => ({
                '#': idx + 1,
                Nombre: item.primary,
                Detalle: item.secondary || '',
                Valor: item.value,
                Extra: item.extra || ''
            }));

            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [
                { wch: 6 },
                { wch: 30 },
                { wch: 36 },
                { wch: 18 },
                { wch: 22 }
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Detalle KPI');
            XLSX.writeFile(wb, `${safeTitle || 'detalle_kpi'}_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error('Error exportando detalle a Excel:', error);
        } finally {
            setIsExportingExcel(false);
        }
    }, [data, safeTitle, sortedItems]);

    const handleExportPdf = useCallback(() => {
        if (!data || sortedItems.length === 0) return;

        setIsExportingPdf(true);

        try {
            const printWindow = window.open('', '_blank', 'width=1100,height=800');
            if (!printWindow) return;

            const dateLabel = new Date().toLocaleString('es-CL');
            const rowsHtml = sortedItems
                .map((item, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${escapeHtml(item.primary)}</td>
                        <td>${escapeHtml(item.secondary || '—')}</td>
                        <td>${escapeHtml(String(item.value))}</td>
                        <td>${escapeHtml(item.extra || '—')}</td>
                    </tr>
                `)
                .join('');

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${escapeHtml(data.title)}</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 28px; color: #1e293b; }
                        h1 { margin: 0; font-size: 22px; font-weight: 800; }
                        .subtitle { margin: 6px 0 20px; font-size: 12px; color: #64748b; }
                        .meta { margin-bottom: 20px; font-size: 11px; color: #94a3b8; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
                        th { background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
                        tr:nth-child(even) { background: #f8fafc; }
                        @media print { body { padding: 12px; } }
                    </style>
                </head>
                <body>
                    <h1>${escapeHtml(data.title)}</h1>
                    <p class="subtitle">${escapeHtml(data.subtitle)}</p>
                    <p class="meta">Generado el ${escapeHtml(dateLabel)} · ${sortedItems.length} registros</p>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Nombre</th>
                                <th>Detalle</th>
                                <th>Valor</th>
                                <th>Extra</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.close();
                            }, 300);
                        };
                    <\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (error) {
            console.error('Error exportando detalle a PDF:', error);
        } finally {
            setIsExportingPdf(false);
        }
    }, [data, sortedItems]);

    if (!data) return null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-lg animate-in slide-in-from-top-2 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                        {data.title}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        {data.subtitle}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                    title="Cerrar detalle"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Controles */}
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800">
                <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-sm">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por nombre, detalle o extra"
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-700/60">
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as 'valor' | 'nombre')}
                                className="bg-transparent text-[11px] font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer"
                            >
                                <option value="valor">Ordenar por valor</option>
                                <option value="nombre">Ordenar por nombre</option>
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            title="Cambiar dirección de orden"
                        >
                            {sortDirection === 'asc' ? 'Asc' : 'Desc'}
                        </button>

                        <select
                            value={pageSize}
                            onChange={e => setPageSize(Number(e.target.value))}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-[11px] font-black text-slate-600 dark:text-slate-300 outline-none cursor-pointer"
                            title="Registros por página"
                        >
                            <option value={8}>8 / pág</option>
                            <option value={12}>12 / pág</option>
                            <option value={20}>20 / pág</option>
                        </select>

                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={isExportingExcel || sortedItems.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-[11px] font-black text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 transition-colors"
                            title="Exportar detalle a Excel"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            {isExportingExcel ? 'Exportando...' : 'Excel'}
                        </button>

                        <button
                            type="button"
                            onClick={handleExportPdf}
                            disabled={isExportingPdf || sortedItems.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-[11px] font-black text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-50 transition-colors"
                            title="Exportar detalle a PDF"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            {isExportingPdf ? 'Exportando...' : 'PDF'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-h-80 overflow-y-auto">
                {pageItems.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {pageItems.map((item, idx) => (
                            <div
                                key={`${item.id}-${pageStart + idx}`}
                                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-500 dark:text-slate-400">
                                        {pageStart + idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                                            {item.primary}
                                        </p>
                                        {item.secondary && (
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                                {item.secondary}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    <p className={`text-sm font-black ${item.valueColor || 'text-slate-800 dark:text-white'}`}>
                                        {item.value}
                                    </p>
                                    {item.extra && (
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                            {item.extra}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-12 text-center">
                        <p className="text-sm text-slate-400 dark:text-slate-500">
                            {searchTerm ? 'Sin resultados para la búsqueda actual' : 'Sin datos disponibles'}
                        </p>
                    </div>
                )}
            </div>

            {/* Footer con paginación */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    Mostrando {showingFrom}-{showingTo} de {sortedItems.length} {sortedItems.length === 1 ? 'registro' : 'registros'}
                </p>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage <= 1}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Página anterior"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 min-w-[64px] text-center">
                        {currentPage} / {totalPages}
                    </span>
                    <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage >= totalPages}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Página siguiente"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Dashboard principal
// ---------------------------------------------------------------------------

const Dashboard: React.FC<DashboardProps> = ({ records, employees }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [yearFilter, setYearFilter] = useState<number>(() => new Date().getFullYear());
    const [monthFilter, setMonthFilter] = useState<number | 'all'>('all');
    const [topFilter, setTopFilter] = useState<'todos' | 'PA' | 'FL'>('todos');
    const [activeDetail, setActiveDetail] = useState<KpiDetailType>(null);

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            await exportDashboardToPDF('dashboard-content', 'Reporte GDP Cloud - Resumen de Gestión');
        } catch (error) {
            console.error('Error al exportar Dashboard:', error);
        } finally {
            setIsExporting(false);
        }
    };

    // Años disponibles para filtro
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        records.forEach(r => {
            if (r.fechaInicio) {
                const y = new Date(r.fechaInicio + 'T12:00:00').getFullYear();
                if (y) years.add(y);
            }
        });
        years.add(new Date().getFullYear());
        return [...years].sort((a, b) => b - a);
    }, [records]);

    // Título dinámico del período seleccionado
    const periodLabel = useMemo(() => {
        if (monthFilter === 'all') return `${yearFilter}`;
        return `${MONTH_NAMES_FULL[monthFilter]} ${yearFilter}`;
    }, [yearFilter, monthFilter]);

    // ---------------------------------------------------------------------------
    // Cálculos centralizados
    // ---------------------------------------------------------------------------
    const stats = useMemo(() => {
        // Filtrar por año seleccionado
        const filteredByYear = records.filter(r => {
            if (!r.fechaInicio) return false;
            return new Date(r.fechaInicio + 'T12:00:00').getFullYear() === yearFilter;
        });

        // Filtrar también por mes si está seleccionado
        const filtered = monthFilter === 'all'
            ? filteredByYear
            : filteredByYear.filter(r => {
                const d = new Date(r.fechaInicio + 'T12:00:00');
                return d.getMonth() === monthFilter;
            });

        // --- Mensuales (12 meses del año filtrado) ---
        const months: Record<string, { PA: number; FL: number; total: number }> = {};
        for (let m = 0; m < 12; m++) {
            months[`${MONTH_NAMES[m]}`] = { PA: 0, FL: 0, total: 0 };
        }
        filteredByYear.forEach(r => {
            if (r.solicitudType !== 'PA' && r.solicitudType !== 'FL') return;
            const m = new Date(r.fechaInicio + 'T12:00:00').getMonth();
            const key = MONTH_NAMES[m];
            const days = getAnalyticsDays(r);
            months[key][r.solicitudType] += days;
            months[key].total += days;
        });
        const monthlyData = Object.entries(months).map(([name, data]) => ({ name, ...data }));

        // --- Datos del período filtrado (año o año+mes) ---
        let paCount = 0, flCount = 0, totalDays = 0;
        const uniqueRuts = new Set<string>();
        const byEmployee: Record<string, {
            nombre: string;
            rut: string;
            diasPA: number;
            diasFL: number;
            diasFLTop: number;
            totalDias: number;
            totalDiasTop: number;
            registros: number;
        }> = {};

        // Último registro por RUT por tipo → para saldo
        const lastByRutPA: Record<string, PermitRecord> = {};
        const lastByRutFL: Record<string, PermitRecord> = {};
        const sortedByCreated = [...records].sort((a, b) => compareRecordsByDateDesc(a, b));

        sortedByCreated.forEach(r => {
            if (r.solicitudType === 'PA') {
                if (!lastByRutPA[r.rut]) lastByRutPA[r.rut] = r;
            } else if (r.solicitudType === 'FL') {
                if (!lastByRutFL[r.rut]) lastByRutFL[r.rut] = r;
            }
        });

        // Contar sobre datos filtrados
        filtered.forEach(r => {
            const days = getAnalyticsDays(r);
            const topDays = r.solicitudType === 'FL' ? getFLRequestedPeriodDays(r) : days;
            if (r.solicitudType === 'PA') paCount++;
            else if (r.solicitudType === 'FL') flCount++;
            else return;
            totalDays += days;
            uniqueRuts.add(r.rut);

            if (!byEmployee[r.rut]) {
                byEmployee[r.rut] = {
                    nombre: r.funcionario,
                    rut: r.rut,
                    diasPA: 0,
                    diasFL: 0,
                    diasFLTop: 0,
                    totalDias: 0,
                    totalDiasTop: 0,
                    registros: 0
                };
            }
            if (r.solicitudType === 'PA') byEmployee[r.rut].diasPA += days;
            else if (r.solicitudType === 'FL') byEmployee[r.rut].diasFL += days;
            byEmployee[r.rut].totalDias += days;
            byEmployee[r.rut].totalDiasTop += topDays;
            if (r.solicitudType === 'FL') byEmployee[r.rut].diasFLTop += topDays;
            byEmployee[r.rut].registros++;
        });

        // --- Top funcionarios con saldo ---
        const allFuncionarios = Object.entries(byEmployee)
            .map(([rut, emp]) => {
                const lastPA = lastByRutPA[rut];
                const lastFL = lastByRutFL[rut];
                const saldoPA = lastPA ? (lastPA.diasHaber - lastPA.cantidadDias) : null;
                const saldoFL = lastFL ? getFLSaldoFinal(lastFL, null) : null;
                return { ...emp, saldoPA, saldoFL };
            })
            .sort((a, b) => b.totalDias - a.totalDias);

        // --- Saldo bajo (<2 días) - siempre global ---
        const lowBalance: Array<{ nombre: string; rut: string; saldo: number; tipo: string }> = [];
        Object.entries(lastByRutPA).forEach(([rut, r]) => {
            const saldo = r.diasHaber - r.cantidadDias;
            if (saldo < 2) {
                lowBalance.push({ nombre: r.funcionario, rut, saldo, tipo: 'PA' });
            }
        });
        Object.entries(lastByRutFL).forEach(([rut, r]) => {
            const saldo = getFLSaldoFinal(r, 0);
            if (saldo < 2) {
                lowBalance.push({ nombre: r.funcionario, rut, saldo, tipo: 'FL' });
            }
        });
        lowBalance.sort((a, b) => a.saldo - b.saldo);

        // --- Distribución por tipo (para pie) ---
        const typeDistribution = [
            { name: 'Permisos Admin.', value: paCount, color: COLORS.PA },
            { name: 'Feriados Legales', value: flCount, color: COLORS.FL }
        ];

        // --- Comparativa PA vs FL por empleado (top 5, barras horizontales) ---
        const comparativaEmpleados = Object.values(byEmployee)
            .sort((a, b) => b.totalDias - a.totalDias)
            .slice(0, 5)
            .map(e => ({ nombre: e.nombre.split(' ')[0], PA: e.diasPA, FL: e.diasFL }));

        // --- Tendencia dinámica según filtro (mes/año) ---
        const requestCount = paCount + flCount;
        const previousPeriodInfo = (() => {
            if (monthFilter === 'all') {
                const count = records.filter(r => {
                    if (!r.fechaInicio) return false;
                    if (r.solicitudType !== 'PA' && r.solicitudType !== 'FL') return false;
                    const d = new Date(r.fechaInicio + 'T12:00:00');
                    return d.getFullYear() === yearFilter - 1;
                }).length;
                return {
                    count,
                    label: `${yearFilter - 1}`,
                    comparisonLabel: 'vs año anterior'
                };
            }

            const previousMonth = monthFilter === 0 ? 11 : monthFilter - 1;
            const previousYear = monthFilter === 0 ? yearFilter - 1 : yearFilter;

            const count = records.filter(r => {
                if (!r.fechaInicio) return false;
                if (r.solicitudType !== 'PA' && r.solicitudType !== 'FL') return false;
                const d = new Date(r.fechaInicio + 'T12:00:00');
                return d.getFullYear() === previousYear && d.getMonth() === previousMonth;
            }).length;
            return {
                count,
                label: `${MONTH_NAMES_FULL[previousMonth]} ${previousYear}`,
                comparisonLabel: 'vs mes anterior'
            };
        })();

        const hasTrendBase = previousPeriodInfo.count > 0;
        const trendValue = hasTrendBase
            ? ((requestCount - previousPeriodInfo.count) / previousPeriodInfo.count) * 100
            : 0;
        const solicitudesTrend = hasTrendBase
            ? {
                value: trendValue,
                label: `${trendValue >= 0 ? '+' : ''}${trendValue.toFixed(0)}% ${previousPeriodInfo.comparisonLabel}`
            }
            : null;

        const currentPeriodLabel = monthFilter === 'all'
            ? `${yearFilter}`
            : `${MONTH_NAMES_FULL[monthFilter]} ${yearFilter}`;

        const solicitudesTrendTooltip = hasTrendBase
            ? `Período actual: ${currentPeriodLabel} (${requestCount} solicitudes). Comparado con ${previousPeriodInfo.label} (${previousPeriodInfo.count} solicitudes).`
            : `Período actual: ${currentPeriodLabel} (${requestCount} solicitudes). Sin base de comparación en ${previousPeriodInfo.label}.`;

        // --- % uso saldo PA (promedio sobre empleados con registros PA) ---
        const paEmployeesWithBalance = Object.keys(lastByRutPA);
        let totalUsagePercent = 0;
        paEmployeesWithBalance.forEach(rut => {
            const last = lastByRutPA[rut];
            const base = CONFIG.BASE_DAYS.PA;
            const used = base - last.diasHaber;
            totalUsagePercent += base > 0 ? (used / base) * 100 : 0;
        });
        const avgUsagePercent = paEmployeesWithBalance.length > 0 ? totalUsagePercent / paEmployeesWithBalance.length : 0;

        // --- Datos para paneles de detalle ---
        const filteredRecords = filtered;
        const paRecords = filteredRecords.filter(r => r.solicitudType === 'PA');
        const flRecords = filteredRecords.filter(r => r.solicitudType === 'FL');

        // Uso PA por empleado
        const usoPAByEmployee = paEmployeesWithBalance.map(rut => {
            const last = lastByRutPA[rut];
            const base = CONFIG.BASE_DAYS.PA;
            const used = base - last.diasHaber;
            const pct = base > 0 ? (used / base) * 100 : 0;
            return {
                rut,
                nombre: last.funcionario,
                usado: used,
                base,
                saldo: last.diasHaber - last.cantidadDias,
                porcentaje: pct
            };
        }).sort((a, b) => b.porcentaje - a.porcentaje);

        return {
            monthlyData,
            typeDistribution,
            allFuncionarios,
            lowBalance,
            comparativaEmpleados,
            paCount,
            flCount,
            totalDays,
            activeEmployees: uniqueRuts.size,
            averageDaysPerRequest: filtered.length === 0 ? '0' : (totalDays / filtered.length).toFixed(1),
            requestCount,
            solicitudesTrend,
            solicitudesTrendTooltip,
            avgUsagePercent,
            // Data for detail panels
            filteredRecords,
            paRecords,
            flRecords,
            usoPAByEmployee,
            byEmployee: Object.values(byEmployee)
        };
    }, [records, yearFilter, monthFilter]);

    const {
        monthlyData, typeDistribution, allFuncionarios,
        lowBalance, comparativaEmpleados,
        totalDays, activeEmployees, averageDaysPerRequest,
        requestCount, solicitudesTrend, solicitudesTrendTooltip, avgUsagePercent,
        filteredRecords, paRecords, flRecords, usoPAByEmployee, byEmployee
    } = stats;

    // Filtrado del Top según topFilter
    const { topFuncionarios, maxDias } = useMemo(() => {
        const filtered = allFuncionarios.filter(emp => {
            if (topFilter === 'PA') return emp.diasPA > 0;
            if (topFilter === 'FL') return emp.diasFLTop > 0;
            return true;
        }).sort((a, b) => {
            if (topFilter === 'PA') return b.diasPA - a.diasPA;
            if (topFilter === 'FL') return b.diasFLTop - a.diasFLTop;
            return b.totalDiasTop - a.totalDiasTop;
        }).slice(0, 6);

        const max = filtered.length > 0
            ? Math.max(...filtered.map(e => topFilter === 'PA' ? e.diasPA : topFilter === 'FL' ? e.diasFLTop : e.totalDiasTop))
            : 1;

        return { topFuncionarios: filtered, maxDias: max };
    }, [allFuncionarios, topFilter]);

    // ---------------------------------------------------------------------------
    // Datos para el panel de detalle
    // ---------------------------------------------------------------------------
    const detailData: DetailData | null = useMemo(() => {
        if (!activeDetail) return null;

        switch (activeDetail) {
            case 'solicitudes':
                return {
                    title: `Solicitudes — ${periodLabel}`,
                    subtitle: `${filteredRecords.length} registros en el período`,
                    items: filteredRecords.map(r => {
                        const days = getAnalyticsDays(r);
                        return {
                            id: r.id,
                            primary: r.funcionario,
                            secondary: `${r.solicitudType} · Acto ${r.acto || '—'}`,
                            value: `${days} días`,
                            sortValue: days,
                            valueColor: r.solicitudType === 'PA' ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400',
                            extra: r.fechaInicio
                        };
                    })
                };

            case 'funcionarios':
                return {
                    title: `Funcionarios Activos — ${periodLabel}`,
                    subtitle: `${activeEmployees} de ${employees.length} en base`,
                    items: byEmployee.map(emp => ({
                        id: emp.rut,
                        primary: emp.nombre,
                        secondary: `${emp.registros} solicitud${emp.registros > 1 ? 'es' : ''}`,
                        value: `${emp.totalDias} días`,
                        sortValue: emp.totalDias,
                        extra: `PA: ${emp.diasPA} · FL: ${emp.diasFL}`
                    }))
                };

            case 'dias':
                return {
                    title: `Días Otorgados — ${periodLabel}`,
                    subtitle: `Total: ${totalDays} días`,
                    items: byEmployee.map(emp => ({
                        id: emp.rut,
                        primary: emp.nombre,
                        secondary: `PA: ${emp.diasPA} días · FL: ${emp.diasFL} días`,
                        value: `${emp.totalDias} días`,
                        sortValue: emp.totalDias,
                        valueColor: emp.totalDias > 10 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                    }))
                };

            case 'usoPA':
                return {
                    title: 'Uso de Saldo PA',
                    subtitle: `Promedio: ${avgUsagePercent.toFixed(0)}% utilizado`,
                    items: usoPAByEmployee.map(emp => ({
                        id: emp.rut,
                        primary: emp.nombre,
                        secondary: `Usado: ${emp.usado.toFixed(1)} de ${emp.base} días`,
                        value: `${emp.porcentaje.toFixed(0)}%`,
                        sortValue: emp.porcentaje,
                        valueColor: emp.porcentaje > 80 ? 'text-red-600 dark:text-red-400' : emp.porcentaje > 50 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
                        extra: `Saldo: ${emp.saldo.toFixed(1)} días`
                    }))
                };

            case 'feriados':
                return {
                    title: `Feriados Legales — ${periodLabel}`,
                    subtitle: `${flRecords.length} registros FL`,
                    items: flRecords.map(r => {
                        const days = getAnalyticsDays(r);
                        return {
                            id: r.id,
                            primary: r.funcionario,
                            secondary: `Acto ${r.acto || '—'} · ${r.fechaInicio}`,
                            value: `${days} días`,
                            sortValue: days,
                            valueColor: 'text-amber-600 dark:text-amber-400',
                            extra: r.periodo || '—'
                        };
                    })
                };

            case 'saldoBajo':
                return {
                    title: 'Saldo Bajo Crítico',
                    subtitle: `${lowBalance.length} funcionarios con menos de 2 días disponibles`,
                    items: lowBalance.map(emp => ({
                        id: `${emp.rut}-${emp.tipo}`,
                        primary: emp.nombre,
                        secondary: `${emp.tipo} · ${emp.rut}`,
                        value: `${emp.saldo.toFixed(1)} días`,
                        sortValue: emp.saldo,
                        valueColor: emp.saldo < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400',
                        extra: emp.saldo < 0 ? 'Saldo negativo' : 'Disponible'
                    }))
                };

            default:
                return null;
        }
    }, [activeDetail, periodLabel, filteredRecords, byEmployee, activeEmployees, employees.length, totalDays, avgUsagePercent, usoPAByEmployee, flRecords, lowBalance]);

    // Handlers para abrir detalles
    const openDetail = useCallback((type: KpiDetailType) => {
        setActiveDetail(prev => prev === type ? null : type);
    }, []);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return (
        <div id="dashboard-content" className="space-y-6">

            {/* ─── Header ─── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Resumen de Gestión</h2>
                        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {periodLabel}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Filtro de año */}
                    <select
                        value={yearFilter}
                        onChange={e => {
                            setYearFilter(Number(e.target.value));
                            setActiveDetail(null);
                        }}
                        className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-black px-3 py-2 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
                    >
                        {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>

                    {/* Filtro de mes */}
                    <select
                        value={monthFilter}
                        onChange={e => {
                            setMonthFilter(e.target.value === 'all' ? 'all' : Number(e.target.value));
                            setActiveDetail(null);
                        }}
                        className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-black px-3 py-2 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
                    >
                        <option value="all">Todo el año</option>
                        {MONTH_NAMES_FULL.map((name, idx) => (
                            <option key={idx} value={idx}>{name}</option>
                        ))}
                    </select>

                    {/* Exportar PDF */}
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-black transition-colors shadow-lg"
                    >
                        {isExporting ? (
                            <><Loader2 size={16} className="animate-spin" /> Exportando...</>
                        ) : (
                            <><FileDown size={16} /> Exportar PDF</>
                        )}
                    </button>
                </div>
            </div>

            {/* ─── KPIs Row (6 cards, todas clickeables) ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <KpiCard
                    label={monthFilter === 'all' ? 'Solicitudes del año' : 'Solicitudes del mes'}
                    value={requestCount}
                    sub={`${totalDays} días solicitados`}
                    tooltip={solicitudesTrendTooltip}
                    icon={Calendar}
                    iconBg="bg-indigo-50 dark:bg-indigo-900/40"
                    iconColor="text-indigo-600 dark:text-indigo-400"
                    trend={solicitudesTrend ?? undefined}
                    onClick={() => openDetail('solicitudes')}
                />
                <KpiCard
                    label="Funcionarios activos"
                    value={activeEmployees}
                    sub={`de ${employees.length} en base`}
                    icon={Users}
                    iconBg="bg-slate-100 dark:bg-slate-700/50"
                    iconColor="text-slate-600 dark:text-slate-300"
                    onClick={() => openDetail('funcionarios')}
                />
                <KpiCard
                    label="Total días otorgados"
                    value={totalDays}
                    sub={`Promedio ${averageDaysPerRequest} días/solic.`}
                    icon={Activity}
                    iconBg="bg-emerald-50 dark:bg-emerald-900/40"
                    iconColor="text-emerald-600 dark:text-emerald-400"
                    onClick={() => openDetail('dias')}
                />
                <KpiCard
                    label="Uso saldo PA"
                    value={`${avgUsagePercent.toFixed(0)}%`}
                    sub={`Base: ${CONFIG.BASE_DAYS.PA} días`}
                    icon={Clock}
                    iconBg="bg-purple-50 dark:bg-purple-900/40"
                    iconColor="text-purple-600 dark:text-purple-400"
                    trend={{ value: 100 - avgUsagePercent, label: `${(100 - avgUsagePercent).toFixed(0)}% libre` }}
                    onClick={() => openDetail('usoPA')}
                />
                <KpiCard
                    label="Feriados Legales"
                    value={stats.flCount}
                    sub={`${flRecords.reduce((a, r) => a + getAnalyticsDays(r), 0)} días FL`}
                    icon={Sun}
                    iconBg="bg-amber-50 dark:bg-amber-900/40"
                    iconColor="text-amber-600 dark:text-amber-400"
                    onClick={() => openDetail('feriados')}
                />
                <KpiCard
                    label="Saldo bajo"
                    value={lowBalance.length}
                    sub="Menos de 2 días"
                    icon={AlertTriangle}
                    iconBg={lowBalance.length > 0 ? 'bg-amber-50 dark:bg-amber-900/40' : 'bg-slate-100 dark:bg-slate-700/50'}
                    iconColor={lowBalance.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}
                    borderColor={lowBalance.length > 0 ? 'border-amber-200 dark:border-amber-800' : 'border-slate-200 dark:border-slate-700'}
                    highlight={lowBalance.length > 0}
                    onClick={() => openDetail('saldoBajo')}
                />
            </div>

            {/* ─── Panel de Detalle (aparece al hacer click en un KPI) ─── */}
            {activeDetail && (
                <KpiDetailPanel
                    data={detailData}
                    onClose={() => setActiveDetail(null)}
                />
            )}



            {/* ─── Gráficos principales: Area (tendencia) + Pie (distribución) ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Area chart — Tendencia mensual */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                            Días otorgados por mes — {yearFilter}
                        </h3>
                        <div className="flex gap-3">
                            {[{ key: 'PA', label: 'Permisos', color: COLORS.PA }, { key: 'FL', label: 'Feriados', color: COLORS.FL }].map(t => (
                                <div key={t.key} className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="gradPA" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.PA} stopOpacity={0.25} />
                                        <stop offset="95%" stopColor={COLORS.PA} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradFL" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.FL} stopOpacity={0.25} />
                                        <stop offset="95%" stopColor={COLORS.FL} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="PA" name="Permisos" stroke={COLORS.PA} strokeWidth={2.5} fill="url(#gradPA)" />
                                <Area type="monotone" dataKey="FL" name="Feriados" stroke={COLORS.FL} strokeWidth={2.5} fill="url(#gradFL)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie — Distribución PA vs FL */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 flex flex-col">
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-2 uppercase tracking-wider">
                        Distribución — {periodLabel}
                    </h3>
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={typeDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={44}
                                        outerRadius={68}
                                        paddingAngle={4}
                                        dataKey="value"
                                        strokeWidth={0}
                                    >
                                        {typeDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Leyenda con porcentajes */}
                        <div className="flex gap-6 mt-1">
                            {typeDistribution.map((item, i) => {
                                const total = typeDistribution.reduce((s, d) => s + d.value, 0);
                                const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                                return (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                            {item.name}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200">
                                            {item.value} ({pct}%)
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Fila inferior: Top Funcionarios + Comparativa PA vs FL ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Top Funcionarios con saldo y barra de progreso */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700">
                    {/* Header + filtros */}
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <Users className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                Resumen de funcionarios — {periodLabel}
                            </h3>
                        </div>
                        {/* Filtro PA / FL / Todos */}
                        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 gap-0.5">
                            {(['todos', 'PA', 'FL'] as const).map(opt => {
                                const labels: Record<string, string> = { todos: 'PA + FL', PA: 'Solo PA', FL: 'Solo FL' };
                                const active = topFilter === opt;
                                const colors: Record<string, string> = {
                                    todos: active ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : '',
                                    PA: active ? 'bg-indigo-600 text-white shadow-sm' : '',
                                    FL: active ? 'bg-amber-500 text-white shadow-sm' : ''
                                };
                                return (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setTopFilter(opt)}
                                        className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${colors[opt]} ${!active ? 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200' : ''}`}
                                    >
                                        {labels[opt]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Header de la tabla mini */}
                    {topFilter === 'todos' ? (
                        <div className="grid grid-cols-[20px_minmax(0,1fr)_34px_34px_50px_50px] sm:grid-cols-[24px_minmax(0,1fr)_46px_46px_62px_62px] gap-x-1.5 sm:gap-x-3 items-center px-0.5 sm:px-1 mb-2">
                            <span />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">PA</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">FL</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Saldo PA</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Saldo FL</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-[20px_minmax(0,1fr)_56px_64px] sm:grid-cols-[24px_minmax(0,1fr)_72px_84px] gap-x-1.5 sm:gap-x-3 items-center px-0.5 sm:px-1 mb-2">
                            <span />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Días</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">{topFilter === 'PA' ? 'Saldo PA' : 'Saldo FL'}</span>
                        </div>
                    )}

                    <div className="space-y-2.5">
                        {topFuncionarios.map((emp, i) => {
                            const diasMostrar = topFilter === 'PA' ? emp.diasPA : topFilter === 'FL' ? emp.diasFLTop : emp.totalDiasTop;
                            const barPercent = maxDias > 0 ? (diasMostrar / maxDias) * 100 : 0;
                            const barColor = topFilter === 'PA' ? COLORS.PA : topFilter === 'FL' ? COLORS.FL : `linear-gradient(90deg, ${COLORS.PA}, ${COLORS.FL})`;
                            const barStyle = topFilter === 'todos'
                                ? { background: barColor }
                                : { backgroundColor: barColor };

                            const saldoPAValue = emp.saldoPA;
                            const saldoFLValue = emp.saldoFL;
                            const saldoPA = saldoPAValue !== null ? saldoPAValue.toFixed(1) : '—';
                            const saldoFL = saldoFLValue !== null ? saldoFLValue.toFixed(1) : '—';

                            const saldoPAColor = saldoPAValue === null
                                ? 'text-slate-400 dark:text-slate-500'
                                : saldoPAValue < 2
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400';

                            const saldoFLColor = saldoFLValue === null
                                ? 'text-slate-400 dark:text-slate-500'
                                : saldoFLValue < 2
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400';

                            const saldoCrossLabel = topFilter === 'PA' ? saldoPA : saldoFL;
                            const saldoCrossColor = topFilter === 'PA' ? saldoPAColor : saldoFLColor;

                            const rankColors = ['bg-amber-500', 'bg-slate-400', 'bg-amber-700', 'bg-slate-300', 'bg-slate-300', 'bg-slate-300'];

                            return (
                                <div key={emp.rut} className="group">
                                    {topFilter === 'todos' ? (
                                        <div className="grid grid-cols-[20px_minmax(0,1fr)_34px_34px_50px_50px] sm:grid-cols-[24px_minmax(0,1fr)_46px_46px_62px_62px] gap-x-1.5 sm:gap-x-3 items-center px-0.5 sm:px-1">
                                            <div className={`w-5 h-5 sm:w-6 sm:h-6 ${rankColors[i]} rounded-md flex items-center justify-center text-white text-[9px] font-black`}>
                                                {i + 1}
                                            </div>
                                            <p className="text-[11px] sm:text-sm font-bold text-slate-800 dark:text-white truncate min-w-0">{emp.nombre}</p>
                                            <p className="text-[11px] sm:text-sm font-black text-indigo-600 dark:text-indigo-400 text-center">{emp.diasPA}</p>
                                            <p className="text-[11px] sm:text-sm font-black text-amber-600 dark:text-amber-400 text-center">{emp.diasFLTop}</p>
                                            <p className={`text-[11px] sm:text-sm font-black text-center ${saldoPAColor}`}>{saldoPA}</p>
                                            <p className={`text-[11px] sm:text-sm font-black text-center ${saldoFLColor}`}>{saldoFL}</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-[20px_minmax(0,1fr)_56px_64px] sm:grid-cols-[24px_minmax(0,1fr)_72px_84px] gap-x-1.5 sm:gap-x-3 items-center px-0.5 sm:px-1">
                                            <div className={`w-5 h-5 sm:w-6 sm:h-6 ${rankColors[i]} rounded-md flex items-center justify-center text-white text-[9px] font-black`}>
                                                {i + 1}
                                            </div>
                                            <p className="text-[11px] sm:text-sm font-bold text-slate-800 dark:text-white truncate min-w-0">{emp.nombre}</p>
                                            <p className={`text-[11px] sm:text-sm font-black text-center ${topFilter === 'PA' ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>{diasMostrar}</p>
                                            <p className={`text-[11px] sm:text-sm font-black text-center ${saldoCrossColor}`}>{saldoCrossLabel}</p>
                                        </div>
                                    )}
                                    <div className="mt-1.5 ml-7 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${barPercent}%`, ...barStyle }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {topFuncionarios.length === 0 && (
                            <p className="text-center text-sm text-slate-400 py-6">Sin datos disponibles para este filtro</p>
                        )}
                    </div>

                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-4 px-1">
                        Saldo: {topFilter === 'todos' ? 'PA y FL por separado' : topFilter === 'PA' ? 'en Solo PA se muestra saldo PA' : 'en Solo FL se muestra saldo FL'}. Valor amarillo = menos de 2 días disponibles.
                    </p>
                </div>

                {/* Comparativa PA vs FL por empleado — BarChart horizontal */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                        <Activity className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                            Comparativa PA vs FL
                        </h3>
                    </div>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparativaEmpleados} layout="vertical" margin={{ top: 0, right: 10, left: 40, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} width={38} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="PA" name="Permisos" fill={COLORS.PA} radius={[0, 4, 4, 0]} barSize={10} />
                                <Bar dataKey="FL" name="Feriados" fill={COLORS.FL} radius={[0, 4, 4, 0]} barSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-2">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.PA }} />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">PA</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.FL }} />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">FL</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
