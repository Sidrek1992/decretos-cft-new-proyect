
import React, { useState, useMemo, useCallback, memo } from 'react';
import { PermitRecord, SolicitudType } from '../types';
import { Search, ArrowUpDown, ChevronUp, ChevronDown, UserCircle, LayoutGrid, CheckSquare, Square, FileDown, Loader2, X, Archive, Download, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { formatNumericDate } from '../utils/formatters';
import { compareRecordsByDateDesc } from '../utils/recordDates';
import { getFLSaldoFinal } from '../utils/flBalance';
import { normalizeRutForSearch, normalizeSearchText } from '../utils/search';
import { generateBatchPDFs, BatchMode, BatchProgressInfo } from '../services/batchPdfGenerator';
import Pagination from './Pagination';
import ActionMenu from './ActionMenu';
import AdvancedFilters, { FilterState } from './AdvancedFilters';
import DecreePreviewModal from './DecreePreviewModal';
import { CONFIG } from '../config';

interface PermitTableProps {
  data: PermitRecord[];
  activeTab: SolicitudType | 'ALL';
  onDelete: (id: string) => void;
  onEdit: (record: PermitRecord) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

type SortField = 'acto' | 'funcionario' | 'solicitudType' | 'fechaInicio' | 'cantidadDias' | 'saldo' | 'fechaDecreto';
type SortOrder = 'asc' | 'desc';

const emptyFilters: FilterState = { dateFrom: '', dateTo: '', minDays: '', maxDays: '', materia: '' };

/** Saldo after the decree: PA uses diasHaber - cantidadDias; FL uses P1/P2 according to available periods. */
const getSaldo = (r: PermitRecord): number => {
  if (r.solicitudType !== 'FL') return r.diasHaber - r.cantidadDias;
  return getFLSaldoFinal(r, 0);
};

const PermitTable: React.FC<PermitTableProps> = ({
  data,
  activeTab,
  onDelete,
  onEdit,
  searchTerm,
  onSearchTermChange,
  canEdit = true,
  canDelete = true
}) => {
  const [search, setSearch] = useState(searchTerm || '');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [advFilters, setAdvFilters] = useState<FilterState>(emptyFilters);
  const [previewRecord, setPreviewRecord] = useState<PermitRecord | null>(null);

  // ★ Estado para selección múltiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgressInfo, setBatchProgressInfo] = useState<BatchProgressInfo | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    const normalizedTerm = normalizeSearchText(search);
    const normalizedRutTerm = normalizeRutForSearch(search);
    const hasSearchTerm = normalizedTerm.length > 0;
    const hasRutSearchTerm = normalizedRutTerm.length > 0;

    return data.filter(r => {
      const matchesTextSearch =
        normalizeSearchText(r.funcionario).includes(normalizedTerm) ||
        normalizeSearchText(r.acto).includes(normalizedTerm) ||
        normalizeSearchText(r.decreto).includes(normalizedTerm);
      const matchesRutSearch =
        hasRutSearchTerm && normalizeRutForSearch(r.rut).includes(normalizedRutTerm);
      const matchesSearch = !hasSearchTerm || matchesTextSearch || matchesRutSearch;
      const matchesTab = activeTab === 'ALL' || r.solicitudType === activeTab;

      let matchesAdvanced = true;
      if (advFilters.dateFrom && r.fechaInicio < advFilters.dateFrom) matchesAdvanced = false;
      if (advFilters.dateTo && r.fechaInicio > advFilters.dateTo) matchesAdvanced = false;
      if (advFilters.minDays && r.cantidadDias < Number(advFilters.minDays)) matchesAdvanced = false;
      if (advFilters.maxDays && r.cantidadDias > Number(advFilters.maxDays)) matchesAdvanced = false;
      if (advFilters.materia && r.materia !== advFilters.materia) matchesAdvanced = false;

      return matchesSearch && matchesTab && matchesAdvanced;
    }).sort((a, b) => {
      if (!sortField) return compareRecordsByDateDesc(a, b);

      let valA: string | number | Date;
      let valB: string | number | Date;

      switch (sortField) {
        case 'acto': valA = a.acto; valB = b.acto; break;
        case 'funcionario': valA = a.funcionario.toLowerCase(); valB = b.funcionario.toLowerCase(); break;
        case 'solicitudType': valA = a.solicitudType; valB = b.solicitudType; break;
        case 'fechaInicio': valA = new Date(a.fechaInicio).getTime(); valB = new Date(b.fechaInicio).getTime(); break;
        case 'cantidadDias': valA = a.cantidadDias; valB = b.cantidadDias; break;
        case 'saldo': valA = getSaldo(a); valB = getSaldo(b); break;
        case 'fechaDecreto': valA = new Date(a.fechaDecreto || '').getTime() || 0; valB = new Date(b.fechaDecreto || '').getTime() || 0; break;
        default: return 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, search, activeTab, sortField, sortOrder, advFilters]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / CONFIG.ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    return filtered.slice(start, start + CONFIG.ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  React.useEffect(() => {
    if (searchTerm !== undefined && searchTerm !== search) {
      setSearch(searchTerm);
    }
  }, [searchTerm, search]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab, advFilters]);

  // ★ Funciones de selección múltiple
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  }, [filtered, selectedIds.size]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ★ Generación masiva de PDFs
  const handleBatchGenerate = useCallback(async (mode: BatchMode) => {
    const selectedRecords = filtered.filter(r => selectedIds.has(r.id));
    if (selectedRecords.length === 0) return;

    setIsBatchGenerating(true);
    setBatchProgressInfo({ current: 0, total: selectedRecords.length, currentFile: '', status: 'generating' });

    try {
      await generateBatchPDFs(selectedRecords, mode, (info) => {
        setBatchProgressInfo(info);
      });
    } finally {
      // Mantener el modal abierto un momento para mostrar el resultado
      setTimeout(() => {
        setIsBatchGenerating(false);
        setBatchProgressInfo(null);
        clearSelection();
      }, 2500);
    }
  }, [filtered, selectedIds, clearSelection]);

  const SortIcon = useCallback(({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={10} className="opacity-20 ml-auto group-hover:opacity-100 transition-opacity" />;
    return sortOrder === 'asc'
      ? <ChevronUp size={12} className="ml-auto text-indigo-500" />
      : <ChevronDown size={12} className="ml-auto text-indigo-500" />;
  }, [sortField, sortOrder]);

  const handleGeneratePDF = useCallback(async (record: PermitRecord, _forcePdf: boolean) => {
    if (isBatchGenerating) return;

    setIsBatchGenerating(true);
    setBatchProgressInfo({ current: 0, total: 1, currentFile: '', status: 'generating' });

    try {
      await generateBatchPDFs([record], 'individual', (info) => {
        setBatchProgressInfo(info);
      });
    } finally {
      setTimeout(() => {
        setIsBatchGenerating(false);
        setBatchProgressInfo(null);
      }, 2500);
    }
  }, [isBatchGenerating]);

  const handlePreview = useCallback((record: PermitRecord) => {
    setPreviewRecord(record);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewRecord(null);
  }, []);

  const handleConfirmPreview = useCallback(() => {
    if (previewRecord) {
      handleGeneratePDF(previewRecord, true);
      setPreviewRecord(null);
    }
  }, [previewRecord, handleGeneratePDF]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ★ Toolbar de Selección Múltiple */}
      {selectedIds.size > 0 && (
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 sm:px-5 py-3.5 rounded-2xl flex items-center justify-between shadow-xl page-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-xl">
              <CheckSquare size={14} />
              <span className="text-xs font-black">{selectedIds.size}</span>
            </div>
            <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider hidden sm:inline">
              seleccionado{selectedIds.size > 1 ? 's' : ''}
            </span>
            <button
              onClick={clearSelection}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="Deseleccionar"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {!isBatchGenerating && (
              <>
                <button
                  onClick={() => handleBatchGenerate('individual')}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white text-indigo-600 rounded-xl text-[10px] sm:text-[11px] font-black hover:bg-indigo-50 transition-all active:scale-95 shadow-lg uppercase tracking-wider"
                  title="Cada decreto se descarga individualmente apenas se genera"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Descargar </span>Uno a uno
                </button>
                <button
                  onClick={() => handleBatchGenerate('zip')}
                  className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 text-white rounded-xl text-[10px] sm:text-[11px] font-black hover:bg-emerald-400 transition-all active:scale-95 shadow-lg uppercase tracking-wider"
                  title="Todos los decretos se descargan en un solo archivo ZIP"
                >
                  <Archive size={14} />
                  <span className="hidden sm:inline">Descargar </span>ZIP
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ★ Modal de Progreso de Generación */}
      {isBatchGenerating && batchProgressInfo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 notification-backdrop-enter">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden notification-panel-enter">
            {/* Header */}
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
              <div className="relative p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-white/10 backdrop-blur rounded-xl ring-1 ring-white/20">
                    {batchProgressInfo.status === 'done'
                      ? <CheckCircle className="w-5 h-5 text-emerald-300" />
                      : batchProgressInfo.status === 'zipping'
                        ? <Archive className="w-5 h-5 animate-pulse" />
                        : <FileText className="w-5 h-5" />
                    }
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider">GDP Cloud</h3>
                    <p className="text-[10px] font-bold text-white/80 tracking-wide mt-0.5">
                      Espere un momento se está generando el decreto
                    </p>
                  </div>
                </div>

                {/* Progress counter */}
                <div className="text-3xl font-black mb-3">
                  {batchProgressInfo.current} <span className="text-base font-bold text-white/40">/ {batchProgressInfo.total}</span>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(batchProgressInfo.current / batchProgressInfo.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Current file indicator */}
            <div className="p-5">
              {batchProgressInfo.status !== 'done' && batchProgressInfo.currentFile && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3.5 border border-blue-200 dark:border-blue-800/40">
                  <p className="text-[9px] font-black text-blue-600 dark:text-blue-300 uppercase tracking-widest mb-1">
                    {batchProgressInfo.status === 'downloading' ? '⬇️ Descargando' : batchProgressInfo.status === 'zipping' ? '📦 Empaquetando' : '📄 Procesando'}
                  </p>
                  <p className="text-[11px] font-bold text-blue-700 dark:text-blue-200 truncate">
                    {batchProgressInfo.currentFile}
                  </p>
                </div>
              )}

              {/* Result summary */}
              {batchProgressInfo.status === 'done' && batchProgressInfo.result && (
                <div className="space-y-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800/40">
                    <p className="text-[11px] font-bold text-blue-700 dark:text-blue-200 text-center">
                      GDP Cloud - Espere un momento se está generando el decreto
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center border border-blue-200 dark:border-blue-800/40">
                      <p className="text-lg font-black text-blue-700 dark:text-blue-300">{batchProgressInfo.result.success}</p>
                      <p className="text-[9px] font-bold text-blue-600/80 uppercase tracking-widest">Exitosos</p>
                    </div>
                    {batchProgressInfo.result.failed > 0 && (
                      <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center border border-red-100 dark:border-red-800/50">
                        <p className="text-lg font-black text-red-600 dark:text-red-400">{batchProgressInfo.result.failed}</p>
                        <p className="text-[9px] font-bold text-red-500/70 uppercase tracking-widest">Con error</p>
                      </div>
                    )}
                  </div>

                  {/* Error list */}
                  {batchProgressInfo.result.errors.length > 0 && (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {batchProgressInfo.result.errors.map((err, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800/50">
                          <AlertCircle size={12} className="text-red-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-red-700 dark:text-red-300 truncate">{err.decreto} — {err.funcionario}</p>
                            <p className="text-[9px] text-red-500/70 truncate">{err.error}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-bold uppercase tracking-wider">
                    Cerrando automáticamente...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-2xl">
        <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 bg-indigo-50 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
          <Search size={16} className="sm:hidden" />
          <Search size={18} className="hidden sm:block" />
        </div>
        <input
          placeholder="Buscar decreto, funcionario o RUT..."
          className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/50 focus:border-indigo-200 dark:focus:border-indigo-700 transition-all font-bold text-[11px] sm:text-xs uppercase tracking-wide sm:tracking-widest text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600"
          value={search}
          onChange={(e) => {
            const value = e.target.value;
            setSearch(value);
            onSearchTermChange?.(value);
          }}
        />
      </div>

      {/* Filtros Avanzados */}
      <AdvancedFilters
        filters={advFilters}
        onFiltersChange={setAdvFilters}
        onReset={() => setAdvFilters(emptyFilters)}
      />

      {/* Table Container */}
      <div className="glass-card rounded-[2rem] shadow-2xl border-white/5 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-white/5">
                {/* ★ Checkbox para seleccionar todos */}
                <th className="pl-4 sm:pl-6 py-4 sm:py-6 w-8">
                  <button
                    onClick={selectAll}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    {selectedIds.size > 0 && selectedIds.size === filtered.length ? (
                      <CheckSquare size={18} className="text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Square size={18} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => handleSort('acto')}
                  className="pr-1 sm:pr-2 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none"
                >
                  <div className="flex items-center gap-1.5">Decreto <SortIcon field="acto" /></div>
                </th>
                <th
                  onClick={() => handleSort('funcionario')}
                  className="px-1.5 sm:px-2 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none"
                >
                  <div className="flex items-center gap-1.5">Funcionario <SortIcon field="funcionario" /></div>
                </th>
                <th
                  onClick={() => handleSort('solicitudType')}
                  className="px-1.5 sm:px-2 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none hidden sm:table-cell"
                >
                  <div className="flex items-center gap-1.5">Tipo <SortIcon field="solicitudType" /></div>
                </th>
                {(activeTab === 'FL' || activeTab === 'ALL') && (
                  <th
                    className="px-1.5 sm:px-2 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 hidden md:table-cell"
                  >
                    <div className="flex items-center gap-1.5">Período</div>
                  </th>
                )}
                <th
                  onClick={() => handleSort('cantidadDias')}
                  className="px-1.5 sm:px-2 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none"
                >
                  <div className="flex items-center gap-1.5">Días <SortIcon field="cantidadDias" /></div>
                </th>
                <th
                  onClick={() => handleSort('saldo')}
                  className="px-1.5 sm:px-2 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none hidden sm:table-cell"
                >
                  <div className="flex items-center gap-1.5">Saldo <SortIcon field="saldo" /></div>
                </th>
                <th
                  onClick={() => handleSort('fechaInicio')}
                  className="px-1.5 sm:px-2 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none hidden sm:table-cell"
                >
                  <div className="flex items-center gap-1.5">Inicio <SortIcon field="fechaInicio" /></div>
                </th>
                {(activeTab === 'FL' || activeTab === 'ALL') && (
                  <th
                    className="px-1.5 sm:px-2 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 hidden lg:table-cell"
                  >
                    <div className="flex items-center gap-1.5">Término</div>
                  </th>
                )}
                <th
                  onClick={() => handleSort('fechaDecreto')}
                  className="px-1.5 sm:px-2 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none hidden lg:table-cell"
                >
                  <div className="flex items-center gap-1.5">Emisión <SortIcon field="fechaDecreto" /></div>
                </th>
                <th className="pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {paginatedData.map(record => {
                const isSelected = selectedIds.has(record.id);
                return (
                  <tr
                    key={record.id}
                    className={`hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-all group/row ${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-900/20' : ''}`}
                  >
                    {/* ★ Checkbox de selección individual */}
                    <td className="pl-4 sm:pl-6 py-4 sm:py-5 w-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(record.id); }}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare size={18} className="text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Square size={18} className="text-slate-300 dark:text-slate-600 hover:text-slate-400" />
                        )}
                      </button>
                    </td>
                    <td className="pr-1 sm:pr-2 py-3 sm:py-4">
                      <div className="flex flex-col">
                        <span className="font-black text-indigo-600 dark:text-indigo-400 text-xs sm:text-[12px] tracking-tight">{record.acto}</span>
                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter truncate max-w-[80px]">{record.materia}</span>
                      </div>
                    </td>
                    <td className="px-1.5 sm:px-2 py-3 sm:py-4">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="hidden sm:flex w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 dark:bg-slate-700 items-center justify-center text-slate-300 dark:text-slate-500 group-hover/row:bg-white dark:group-hover/row:bg-slate-600 group-hover/row:shadow-sm transition-all">
                          <UserCircle size={18} className="sm:hidden" />
                          <UserCircle size={20} className="hidden sm:block" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <p className="text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight truncate max-w-[100px] sm:max-w-[130px] lg:max-w-xs">
                            {record.funcionario}
                          </p>
                          <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 font-mono tracking-tighter">
                            {record.rut}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-1.5 sm:px-2 py-3 sm:py-4 hidden sm:table-cell">
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider border shadow-sm ${record.solicitudType === 'PA'
                        ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800'
                        : 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800'
                        }`}>
                        {record.solicitudType}
                      </span>
                    </td>
                    {(activeTab === 'FL' || activeTab === 'ALL') && (
                      <td className="px-1.5 sm:px-2 py-3 sm:py-4 hidden md:table-cell">
                        {record.solicitudType === 'FL' ? (
                          <div className="flex flex-col items-start gap-0.5">
                            {record.periodo1 && (
                              <span className="px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-black tracking-wide bg-sky-50 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-800 whitespace-nowrap">
                                {record.periodo1}
                              </span>
                            )}
                            {record.periodo2 && (
                              <span className="px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-black tracking-wide bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800 whitespace-nowrap">
                                {record.periodo2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-1.5 sm:px-2 py-3 sm:py-4">
                      <div className="flex items-center gap-1">
                        <span className="font-black text-slate-700 dark:text-slate-200 text-xs sm:text-[12px]">{record.cantidadDias}</span>
                      </div>
                    </td>
                    <td className="px-1.5 sm:px-2 py-3 sm:py-4 hidden sm:table-cell">
                      <span className={`font-black text-xs sm:text-[12px] ${getSaldo(record) < 0
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                        {getSaldo(record).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-1.5 sm:px-2 py-3 sm:py-4 hidden sm:table-cell">
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate whitespace-nowrap">
                        {formatNumericDate(record.fechaInicio)}
                      </span>
                    </td>
                    {(activeTab === 'FL' || activeTab === 'ALL') && (
                      <td className="px-1.5 sm:px-2 py-3 sm:py-4 hidden lg:table-cell">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate whitespace-nowrap">
                          {record.fechaTermino ? formatNumericDate(record.fechaTermino) : '-'}
                        </span>
                      </td>
                    )}
                    <td className="px-1.5 sm:px-2 py-3 sm:py-4 hidden lg:table-cell">
                      <span className="text-[10px] sm:text-[11px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-tight truncate whitespace-nowrap">
                        {record.fechaDecreto ? formatNumericDate(record.fechaDecreto) : '-'}
                      </span>
                    </td>
                    <td className="pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-3 sm:py-4 text-right">
                      <div className="flex justify-end">
                        <ActionMenu
                          record={record}
                          onEdit={canEdit ? onEdit : undefined}
                          onDelete={canDelete ? onDelete : undefined}
                          onGeneratePDF={handleGeneratePDF}
                          onPreview={handlePreview}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 sm:px-10 py-16 sm:py-24 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <LayoutGrid size={40} />
                      <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em]">
                        Sin registros que mostrar
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 sm:px-8 py-4 sm:py-6 border-t border-slate-100 dark:border-slate-700">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={CONFIG.ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Hint para móvil */}
      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider sm:tracking-widest text-center">
        {totalItems > 0
          ? `${totalItems} registro${totalItems !== 1 ? 's' : ''} encontrado${totalItems !== 1 ? 's' : ''}`
          : 'Desliza para ver más detalles en dispositivos móviles'
        }
      </p>

      {/* Modal de Previsualización */}
      <DecreePreviewModal
        isOpen={previewRecord !== null}
        onClose={handleClosePreview}
        record={previewRecord}
        onConfirm={handleConfirmPreview}
      />
    </div>
  );
};

export default memo(PermitTable);
