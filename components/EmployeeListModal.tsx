
import React, { useState, useMemo, useRef } from 'react';
import { Employee, PermitRecord } from '../types';
import {
  X, Search, Users, UserCircle, TrendingUp, TrendingDown,
  Calendar, FileText, Plus, Trash2, ChevronDown, ChevronUp,
  ArrowUpDown, Filter, Download, AlertTriangle, CheckCircle,
  Clock, Award, Edit3, Eye, XCircle, Upload, Save, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatNumericDate } from '../utils/formatters';
import { compareRecordsByDateDesc, getRecordDateValue } from '../utils/recordDates';
import { getFLSaldoFinal } from '../utils/flBalance';
import { normalizeRutForSearch, normalizeSearchText } from '../utils/search';
import {
  buildRutConflictMessage,
  findEmployeeByRut,
  findRutNameConflict,
  formatRutForStorage,
  isValidRutModulo11,
  normalizeIdentityName,
  normalizeRutCanonical,
} from '../utils/rutIntegrity';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { logger } from '../utils/logger';
import EmployeeTimeline from './EmployeeTimeline';

const employeeModalLogger = logger.create('EmployeeModal');

interface EmployeeListModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  records: PermitRecord[];
  onAddEmployee?: (employee: Employee) => void;      // ★ Ahora opcional
  onUpdateEmployee?: (oldRut: string, updatedEmployee: Employee) => void;
  onDeleteEmployee?: (rut: string) => void;          // ★ Ahora opcional
  onFilterByEmployee?: (funcionario: string) => void;
  onQuickDecree?: (employee: Employee) => void;
}

type SortField = 'nombre' | 'totalDecrees' | 'diasPA' | 'diasFL' | 'saldo';
type SortOrder = 'asc' | 'desc';
type BalanceFilter = 'all' | 'high' | 'medium' | 'low';
type DateFilter = 'all' | 'thisMonth' | 'thisYear' | 'noRecent';

interface EmployeeStats {
  totalDecrees: number;
  diasPA: number;
  diasFL: number;
  diasHaber: number;
  saldo: number;    // PA saldo (diasHaber - cantidadDias of last PA record)
  saldoFL: number;  // FL saldo (P1/P2 según períodos del último registro FL)
  lastDecree: PermitRecord | null;
  decrees: PermitRecord[];
}

const ITEMS_PER_PAGE = 20;

const EmployeeListModal: React.FC<EmployeeListModalProps> = ({
  isOpen,
  onClose,
  employees,
  records,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onFilterByEmployee,
  onQuickDecree
}) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ nombre: '', rut: '', departamento: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // Edición in-line
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', rut: '', departamento: '' });
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  // Importación masiva
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<Employee[]>([]);
  const [importRejected, setImportRejected] = useState<Array<{ nombre: string; rut: string; reason: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calcular estadísticas por funcionario (ANTES del return condicional para cumplir reglas de hooks)
  const employeeStats = useMemo(() => {
    const stats: Record<string, EmployeeStats> = {};

    employees.forEach(emp => {
      const empRecords = records.filter(r =>
        r.rut === emp.rut || r.funcionario.toLowerCase() === emp.nombre.toLowerCase()
      );

      const diasPA = empRecords
        .filter(r => r.solicitudType === 'PA')
        .reduce((sum, r) => sum + r.cantidadDias, 0);

      const diasFL = empRecords
        .filter(r => r.solicitudType === 'FL')
        .reduce((sum, r) => sum + r.cantidadDias, 0);

      const sortedDecrees = [...empRecords].sort((a, b) => compareRecordsByDateDesc(a, b, 'fechaInicio'));

      // PA saldo: from the most recent PA record (diasHaber - cantidadDias)
      const lastPA = empRecords
        .filter(r => r.solicitudType === 'PA')
        .sort((a, b) => compareRecordsByDateDesc(a, b))[0];
      const diasHaber = lastPA ? lastPA.diasHaber : 6;
      const saldo = lastPA ? lastPA.diasHaber - lastPA.cantidadDias : 6;

      // FL saldo: from the most recent FL record (P1/P2 según períodos)
      const lastFL = empRecords
        .filter(r => r.solicitudType === 'FL')
        .sort((a, b) => compareRecordsByDateDesc(a, b))[0];
      const saldoFL = lastFL ? getFLSaldoFinal(lastFL, 0) : 0;

      stats[emp.rut] = {
        totalDecrees: empRecords.length,
        diasPA,
        diasFL,
        diasHaber,
        saldo,
        saldoFL,
        lastDecree: sortedDecrees[0] || null,
        decrees: sortedDecrees
      };
    });

    return stats;
  }, [employees, records]);

  // Totalizadores globales
  const globalStats = useMemo(() => {
    const totalDecrees = records.length;
    const totalDiasPA = records.filter(r => r.solicitudType === 'PA').reduce((s, r) => s + r.cantidadDias, 0);
    const totalDiasFL = records.filter(r => r.solicitudType === 'FL').reduce((s, r) => s + r.cantidadDias, 0);
    const avgPerEmployee = employees.length > 0 ? (totalDecrees / employees.length).toFixed(1) : '0';
    const lowBalanceCount = Object.values(employeeStats).filter((s: EmployeeStats) => s.saldo < 2).length;

    return { totalDecrees, totalDiasPA, totalDiasFL, avgPerEmployee, lowBalanceCount };
  }, [records, employees, employeeStats]);

  // Filtrar y ordenar
  const filteredEmployees = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).getTime();
    const normalizedSearch = normalizeSearchText(search);
    const normalizedRutSearch = normalizeRutForSearch(search);
    const hasSearchTerm = normalizedSearch.length > 0;
    const hasRutSearchTerm = normalizedRutSearch.length > 0;

    return employees
      .filter(e => {
        const matchesName = normalizeSearchText(e.nombre).includes(normalizedSearch);
        const matchesRut = hasRutSearchTerm && normalizeRutForSearch(e.rut).includes(normalizedRutSearch);
        const matchesSearch = !hasSearchTerm || matchesName || matchesRut;

        if (!matchesSearch) return false;

        const stats = employeeStats[e.rut];
        if (!stats) return balanceFilter === 'all' && dateFilter === 'all';

        // Filtro por saldo
        if (balanceFilter === 'high' && stats.saldo < 4) return false;
        if (balanceFilter === 'medium' && (stats.saldo < 2 || stats.saldo >= 4)) return false;
        if (balanceFilter === 'low' && stats.saldo >= 2) return false;

        // Filtro por fecha
        if (dateFilter !== 'all') {
          const lastDecreeDate = stats.lastDecree ? new Date(stats.lastDecree.fechaInicio + 'T12:00:00') : null;

          if (dateFilter === 'thisMonth') {
            if (!lastDecreeDate || lastDecreeDate.getMonth() !== thisMonth || lastDecreeDate.getFullYear() !== thisYear) return false;
          } else if (dateFilter === 'thisYear') {
            if (!lastDecreeDate || lastDecreeDate.getFullYear() !== thisYear) return false;
          } else if (dateFilter === 'noRecent') {
            const lastTime = stats.lastDecree ? getRecordDateValue(stats.lastDecree, 'fechaInicio') : null;
            if (lastTime && lastTime > threeMonthsAgo) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const statsA = employeeStats[a.rut] || { totalDecrees: 0, diasPA: 0, diasFL: 0, saldo: 6, saldoFL: 0 };
        const statsB = employeeStats[b.rut] || { totalDecrees: 0, diasPA: 0, diasFL: 0, saldo: 6, saldoFL: 0 };

        let valA: string | number;
        let valB: string | number;

        switch (sortField) {
          case 'nombre': valA = a.nombre.toLowerCase(); valB = b.nombre.toLowerCase(); break;
          case 'totalDecrees': valA = statsA.totalDecrees; valB = statsB.totalDecrees; break;
          case 'diasPA': valA = statsA.diasPA; valB = statsB.diasPA; break;
          case 'diasFL': valA = statsA.diasFL; valB = statsB.diasFL; break;
          case 'saldo': valA = statsA.saldo; valB = statsB.saldo; break;
          default: valA = a.nombre; valB = b.nombre;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [employees, search, sortField, sortOrder, balanceFilter, dateFilter, employeeStats]);

  // Paginación
  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEmployees, currentPage]);

  // Reset página cuando cambian filtros
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, balanceFilter, dateFilter]);

  // Focus trap para accesibilidad
  const { containerRef, handleKeyDown } = useFocusTrap({
    isActive: isOpen,
    onEscape: onClose,
    initialFocus: '[data-autofocus]',
  });

  // Return condicional DESPUÉS de todos los hooks
  if (!isOpen) return null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSaldoColor = (saldo: number) => {
    if (saldo >= 4) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30';
    if (saldo >= 2) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
  };

  const getSaldoIcon = (saldo: number) => {
    if (saldo >= 4) return <TrendingUp size={12} />;
    if (saldo >= 2) return <TrendingDown size={12} />;
    return <AlertTriangle size={12} />;
  };

  const validateEmployeeIdentity = (
    nombre: string,
    rut: string,
    options: { ignoreEmployeeRut?: string; ignoreEmployeeName?: string; departamento?: string } = {}
  ): { normalizedName: string; normalizedRut: string; normalizedDepto: string } | null => {
    const normalizedName = String(nombre || '').trim().toUpperCase();
    const normalizedRut = formatRutForStorage(rut);

    if (!normalizedName || !String(rut || '').trim()) {
      alert('Nombre y RUT son obligatorios.');
      return null;
    }

    if (!isValidRutModulo11(rut) || !normalizedRut) {
      alert('RUT inválido. Verifica dígito verificador (Módulo 11).');
      return null;
    }

    const duplicate = findEmployeeByRut(employees, normalizedRut, options.ignoreEmployeeRut);
    if (duplicate) {
      alert(`Ya existe un funcionario con ese RUT (${duplicate.nombre}).`);
      return null;
    }

    const conflict = findRutNameConflict(normalizedRut, normalizedName, employees, records, {
      ignoreEmployeeRut: options.ignoreEmployeeRut,
      ignoreEmployeeName: options.ignoreEmployeeName,
    });
    if (conflict) {
      alert(buildRutConflictMessage(conflict));
      return null;
    }

    return {
      normalizedName,
      normalizedRut,
      normalizedDepto: String(options.departamento || '').trim()
    };
  };

  const handleAddEmployee = () => {
    if (!newEmployee.nombre.trim() || !newEmployee.rut.trim()) return;
    if (!onAddEmployee) return;

    const validated = validateEmployeeIdentity(newEmployee.nombre, newEmployee.rut, { departamento: newEmployee.departamento });
    if (!validated) return;

    onAddEmployee({
      nombre: validated.normalizedName,
      rut: validated.normalizedRut,
      departamento: validated.normalizedDepto
    });
    setNewEmployee({ nombre: '', rut: '', departamento: '' });
    setShowAddForm(false);
  };

  const handleDeleteEmployee = (rut: string) => {
    if (!onDeleteEmployee) return; // ★ Verificar que existe
    onDeleteEmployee(rut);
    setDeleteConfirm(null);
  };

  const exportEmployeesToExcel = async () => {
    try {
      employeeModalLogger.info('Exportando lista de empleados...');

      // Dynamic import - XLSX solo se carga cuando se necesita
      const XLSX = await import('xlsx');

      const data = filteredEmployees.map(emp => {
        const stats = employeeStats[emp.rut] || { totalDecrees: 0, diasPA: 0, diasFL: 0, saldo: 6, saldoFL: 0, lastDecree: null };
        return {
          'Nombre': emp.nombre,
          'RUT': emp.rut,
          'Total Decretos': stats.totalDecrees,
          'Días PA': stats.diasPA,
          'Días FL': stats.diasFL,
          'Saldo PA': stats.saldo,
          'Saldo FL': stats.diasFL > 0 ? stats.saldoFL : '-',
          'Último Decreto': stats.lastDecree ? stats.lastDecree.acto : '-'
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Funcionarios');
      XLSX.writeFile(wb, `funcionarios_${new Date().toISOString().split('T')[0]}.xlsx`);

      employeeModalLogger.info('Exportación completada');
    } catch (err) {
      employeeModalLogger.error('Error exportando empleados:', err);
    }
  };

  // Funciones de edición in-line
  const startEdit = (emp: Employee) => {
    setEditingEmployee(emp.rut);
    setEditForm({ nombre: emp.nombre, rut: emp.rut, departamento: emp.departamento || '' });
  };

  const saveEdit = (oldRut: string) => {
    if (!editForm.nombre.trim() || !editForm.rut.trim()) return;

    const previousEmployee = employees.find(
      e => normalizeRutCanonical(e.rut) === normalizeRutCanonical(oldRut)
    );

    const validated = validateEmployeeIdentity(editForm.nombre, editForm.rut, {
      ignoreEmployeeRut: oldRut,
      ignoreEmployeeName: previousEmployee?.nombre,
    });
    if (!validated) return;

    if (onUpdateEmployee) {
      onUpdateEmployee(oldRut, {
        nombre: validated.normalizedName,
        rut: validated.normalizedRut,
        departamento: validated.normalizedDepto
      });
    }
    setEditingEmployee(null);
    setEditForm({ nombre: '', rut: '', departamento: '' });
  };

  const cancelEdit = () => {
    setEditingEmployee(null);
    setEditForm({ nombre: '', rut: '', departamento: '' });
  };

  // Importación masiva desde Excel
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();

      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

        // Procesar filas (asumiendo: Nombre en col 0/1, RUT en col 1/2)
        const imported: Employee[] = [];
        const rejected: Array<{ nombre: string; rut: string; reason: string }> = [];
        const seenInFile = new Map<string, string>();

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 2) continue;

          let nombre = '';
          let rut = '';

          // Intentar detectar estructura
          if (typeof row[0] === 'string' && typeof row[1] === 'string') {
            if (row[1].includes('-') || row[1].match(/^\d/)) {
              // Col 0 = nombre, Col 1 = RUT
              nombre = String(row[0]).trim().toUpperCase();
              rut = String(row[1]).trim();
            } else if (row.length >= 3) {
              // Múltiples columnas de nombre
              nombre = [row[0], row[1], row[2]].filter(Boolean).join(' ').trim().toUpperCase();
              rut = String(row[3] || row[2] || '').trim();
            }
          }

          if (!nombre || !rut) continue;

          if (!isValidRutModulo11(rut)) {
            rejected.push({ nombre, rut, reason: 'RUT inválido (Módulo 11)' });
            continue;
          }

          const normalizedRut = formatRutForStorage(rut);
          const canonicalRut = normalizeRutCanonical(normalizedRut);
          const normalizedName = nombre.trim().toUpperCase();

          if (!normalizedRut || !canonicalRut) {
            rejected.push({ nombre, rut, reason: 'RUT inválido' });
            continue;
          }

          const existingEmployee = findEmployeeByRut(employees, normalizedRut);
          if (existingEmployee) {
            rejected.push({
              nombre,
              rut: normalizedRut,
              reason: `RUT ya existe (${existingEmployee.nombre})`,
            });
            continue;
          }

          const conflict = findRutNameConflict(normalizedRut, normalizedName, employees, records);
          if (conflict) {
            rejected.push({
              nombre,
              rut: normalizedRut,
              reason: buildRutConflictMessage(conflict),
            });
            continue;
          }

          const existingInFile = seenInFile.get(canonicalRut);
          if (existingInFile) {
            if (normalizeIdentityName(existingInFile) !== normalizeIdentityName(normalizedName)) {
              rejected.push({
                nombre,
                rut: normalizedRut,
                reason: `RUT duplicado con distinto nombre dentro del archivo (${existingInFile})`,
              });
            } else {
              rejected.push({
                nombre,
                rut: normalizedRut,
                reason: 'RUT duplicado dentro del archivo',
              });
            }
            continue;
          }

          seenInFile.set(canonicalRut, normalizedName);
          imported.push({ nombre: normalizedName, rut: normalizedRut });
        }

        setImportData(imported);
        setImportRejected(rejected);
        setShowImportModal(true);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      employeeModalLogger.error('Error importando archivo:', err);
      alert('Error al procesar el archivo. Asegúrese de que sea un Excel válido.');
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processImport = () => {
    if (!onAddEmployee) return; // ★ Verificar que existe
    importData.forEach(emp => onAddEmployee(emp));
    setImportData([]);
    setImportRejected([]);
    setShowImportModal(false);
    employeeModalLogger.info(`Importados ${importData.length} funcionarios`);
  };

  // Calcular tasa de uso mensual para proyección
  const getMonthlyRate = (stats: EmployeeStats) => {
    if (stats.totalDecrees === 0) return 0;
    const oldestDecree = stats.decrees[stats.decrees.length - 1];
    if (!oldestDecree) return 0;
    const oldestTime = getRecordDateValue(oldestDecree, 'fechaInicio');
    if (!oldestTime) return 0;
    const months = Math.max(1, (Date.now() - oldestTime) / (1000 * 60 * 60 * 24 * 30));
    return stats.diasPA / months;
  };

  const getProjectedExhaustion = (stats: EmployeeStats) => {
    const rate = getMonthlyRate(stats);
    if (rate <= 0) return null;
    const monthsRemaining = stats.saldo / rate;
    if (monthsRemaining > 12) return null;
    const exhaustionDate = new Date();
    exhaustionDate.setMonth(exhaustionDate.getMonth() + Math.floor(monthsRemaining));
    return exhaustionDate;
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Compacto */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 px-4 sm:px-6 py-3 text-white flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            {/* Título */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 id="employee-modal-title" className="text-sm sm:text-base font-extrabold uppercase tracking-tight">
                  Gestión de Personal
                </h2>
                <p className="text-[9px] font-bold uppercase opacity-60 tracking-wider">
                  {employees.length} funcionarios
                </p>
              </div>
            </div>

            {/* Stats Inline */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 rounded-lg">
                <FileText size={10} className="opacity-60" />
                <span className="text-xs font-black">{globalStats.totalDecrees}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/30 rounded-lg">
                <span className="text-[9px] font-bold opacity-70">PA</span>
                <span className="text-xs font-black text-indigo-300">{globalStats.totalDiasPA}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/30 rounded-lg">
                <span className="text-[9px] font-bold opacity-70">FL</span>
                <span className="text-xs font-black text-amber-300">{globalStats.totalDiasFL}</span>
              </div>
              {globalStats.lowBalanceCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/30 rounded-lg">
                  <AlertTriangle size={10} className="text-red-300" />
                  <span className="text-xs font-black text-red-300">{globalStats.lowBalanceCount}</span>
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2">
              {/* ★ Solo mostrar Añadir si tiene permisos */}
              {onAddEmployee && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  <Plus size={12} />
                  <span className="hidden sm:inline">Añadir</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar Compacto */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Buscar por nombre o RUT..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/50 focus:border-indigo-300 dark:focus:border-indigo-600 font-bold text-[11px] uppercase tracking-wide text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 hidden sm:block" />

            {/* Saldo Filter */}
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 gap-0.5">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'high', label: '●', color: 'text-emerald-500', title: 'Alto' },
                { key: 'medium', label: '●', color: 'text-amber-500', title: 'Medio' },
                { key: 'low', label: '●', color: 'text-red-500', title: 'Bajo' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setBalanceFilter(f.key as BalanceFilter)}
                  title={f.title || f.label}
                  className={`px-2 py-1 rounded text-[10px] font-black transition-all ${balanceFilter === f.key
                    ? 'bg-white dark:bg-slate-600 shadow-sm ' + (f.color || 'text-slate-700 dark:text-white')
                    : (f.color || 'text-slate-400') + ' hover:opacity-80'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Date Filter Select */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="px-2 py-1.5 bg-slate-100 dark:bg-slate-700 border-0 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="all">📅 Todos</option>
              <option value="thisMonth">Este Mes</option>
              <option value="thisYear">Este Año</option>
              <option value="noRecent">Sin Actividad</option>
            </select>

            {/* Sort Select */}
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortField(field as SortField);
                setSortOrder(order as SortOrder);
              }}
              className="px-2 py-1.5 bg-slate-100 dark:bg-slate-700 border-0 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="nombre-asc">A-Z</option>
              <option value="nombre-desc">Z-A</option>
              <option value="totalDecrees-desc">+ Decretos</option>
              <option value="saldo-asc">- Saldo</option>
              <option value="saldo-desc">+ Saldo</option>
            </select>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={exportEmployeesToExcel}
                className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all"
                title="Exportar a Excel"
              >
                <Download size={14} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all"
                title="Importar desde Excel"
              >
                <Upload size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Add Employee Form - Compacto */}
        {showAddForm && (
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Plus size={14} className="text-emerald-600 flex-shrink-0" />
              <input
                placeholder="Nombre completo"
                value={newEmployee.nombre}
                onChange={e => setNewEmployee({ ...newEmployee, nombre: e.target.value })}
                className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 placeholder:text-slate-300"
              />
              <input
                placeholder="Departamento/Área"
                value={newEmployee.departamento}
                onChange={e => setNewEmployee({ ...newEmployee, departamento: e.target.value })}
                className="w-48 px-3 py-1.5 bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 placeholder:text-slate-300"
              />
              <input
                placeholder="RUT"
                value={newEmployee.rut}
                onChange={e => setNewEmployee({ ...newEmployee, rut: e.target.value })}
                className="w-32 px-3 py-1.5 bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 text-[11px] font-bold tracking-wide text-slate-700 dark:text-slate-200 placeholder:text-slate-300 font-mono"
              />
              <button
                onClick={handleAddEmployee}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1"
              >
                <CheckCircle size={12} /> Guardar
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewEmployee({ nombre: '', rut: '', departamento: '' }); }}
                className="p-1.5 bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-300 transition-all"
              >
                <XCircle size={14} />
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-2">
          <div className="grid gap-1">
            {paginatedEmployees.map((emp, index) => {
              const stats = employeeStats[emp.rut] || {
                totalDecrees: 0, diasPA: 0, diasFL: 0, saldo: 6, saldoFL: 0, diasHaber: 6, lastDecree: null, decrees: []
              };
              const isExpanded = expandedEmployee === emp.rut;
              const isEditing = editingEmployee === emp.rut;
              const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;

              return (
                <div key={emp.rut} className="group">
                  {/* Main Row - Compacto */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer ${isExpanded
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-200 dark:ring-indigo-700'
                      : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                      }`}
                    onClick={() => setExpandedEmployee(isExpanded ? null : emp.rut)}
                  >
                    {/* Avatar pequeño */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isExpanded
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-600 text-slate-300 dark:text-slate-400 group-hover:text-indigo-500'
                      }`}>
                      <UserCircle size={18} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isExpanded ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-white'}`}>
                          {emp.nombre}
                        </p>
                        {emp.departamento && (
                          <span className="text-[8px] font-black bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 uppercase">
                            {emp.departamento}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                        {emp.rut}
                      </p>
                    </div>

                    {/* Stats inline */}
                    <div className="hidden sm:flex items-center gap-1.5 text-[9px] font-bold">
                      <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-600 rounded text-slate-500 dark:text-slate-300">
                        {stats.totalDecrees}
                      </span>
                      <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 rounded text-indigo-600 dark:text-indigo-400">
                        PA:{stats.diasPA}
                      </span>
                      <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/40 rounded text-amber-600 dark:text-amber-400">
                        FL:{stats.diasFL}
                      </span>
                    </div>

                    {/* Saldo */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ${getSaldoColor(stats.saldo)}`}>
                      {getSaldoIcon(stats.saldo)}
                      <span>{stats.saldo.toFixed(1)}</span>
                    </div>

                    {/* Number */}
                    <span className="text-[8px] font-bold text-slate-300 dark:text-slate-600 w-6 text-right">
                      #{(globalIndex + 1).toString().padStart(2, '0')}
                    </span>

                    {/* Expand */}
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-2 ml-4 sm:ml-16 p-4 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 space-y-4 animate-in slide-in-from-top-2 duration-200">
                      {/* Quick Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-600 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Decretos</p>
                          <p className="text-lg font-black text-slate-700 dark:text-white">{stats.totalDecrees}</p>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Días PA Usados</p>
                          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{stats.diasPA}</p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">Días FL Usados</p>
                          <p className="text-lg font-black text-amber-600 dark:text-amber-400">{stats.diasFL}</p>
                        </div>
                        <div className={`rounded-lg p-3 ${getSaldoColor(stats.saldo)}`}>
                          <p className="text-[9px] font-bold opacity-70 uppercase tracking-wider mb-1">Saldo PA</p>
                          <p className="text-lg font-black">{stats.saldo.toFixed(1)} / {stats.diasHaber}</p>
                        </div>
                        <div className={`rounded-lg p-3 ${stats.diasFL > 0 ? getSaldoColor(stats.saldoFL) : 'bg-slate-50 dark:bg-slate-600'}`}>
                          <p className="text-[9px] font-bold opacity-70 uppercase tracking-wider mb-1">Saldo FL</p>
                          <p className={`text-lg font-black ${stats.diasFL === 0 ? 'text-slate-400' : ''}`}>
                            {stats.diasFL > 0 ? stats.saldoFL.toFixed(1) : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Proyección y Mini Gráfico */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Mini Gráfico de Barras */}
                        <div className="bg-slate-50 dark:bg-slate-600 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Uso por Tipo</p>
                          <div className="flex items-end gap-2 h-16">
                            <div className="flex flex-col items-center flex-1">
                              <div
                                className="w-full bg-indigo-500 rounded-t transition-all"
                                style={{ height: `${Math.min(100, (stats.diasPA / Math.max(stats.diasPA + stats.diasFL, 1)) * 100)}%`, minHeight: stats.diasPA > 0 ? '8px' : '0' }}
                              />
                              <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">PA</span>
                              <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">{stats.diasPA}</span>
                            </div>
                            <div className="flex flex-col items-center flex-1">
                              <div
                                className="w-full bg-amber-500 rounded-t transition-all"
                                style={{ height: `${Math.min(100, (stats.diasFL / Math.max(stats.diasPA + stats.diasFL, 1)) * 100)}%`, minHeight: stats.diasFL > 0 ? '8px' : '0' }}
                              />
                              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-1">FL</span>
                              <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">{stats.diasFL}</span>
                            </div>
                          </div>
                        </div>

                        {/* Proyección de Agotamiento */}
                        <div className="bg-slate-50 dark:bg-slate-600 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Proyección</p>
                          {(() => {
                            const rate = getMonthlyRate(stats);
                            const exhaustion = getProjectedExhaustion(stats);
                            return (
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-[10px] text-slate-500">Uso mensual:</span>
                                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{rate.toFixed(1)} días/mes</span>
                                </div>
                                {exhaustion ? (
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-red-500">Agotamiento:</span>
                                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                                      <AlertTriangle size={10} />
                                      {exhaustion.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex justify-between">
                                    <span className="text-[10px] text-emerald-500">Estado:</span>
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Saldo estable</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Last Decree */}
                      {stats.lastDecree && (
                        <div className="bg-slate-50 dark:bg-slate-600 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Clock size={10} /> Último Decreto
                          </p>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{stats.lastDecree.acto}</span>
                              <span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400">
                                {stats.lastDecree.solicitudType} · {stats.lastDecree.cantidadDias} día(s)
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">
                              {formatNumericDate(stats.lastDecree.fechaInicio)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Recent Decrees List */}
                      {stats.decrees.length > 1 && (
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Historial Reciente ({Math.min(stats.decrees.length, 5)} de {stats.decrees.length})
                          </p>
                          <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {stats.decrees.slice(0, 5).map(d => (
                              <div key={d.id} className="flex items-center justify-between py-1.5 px-2 bg-slate-50 dark:bg-slate-600/50 rounded-lg text-[10px]">
                                <div className="flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${d.solicitudType === 'PA'
                                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                                    }`}>
                                    {d.solicitudType}
                                  </span>
                                  <span className="font-bold text-slate-700 dark:text-slate-200">{d.acto}</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-400">
                                  <span>{d.cantidadDias}d</span>
                                  <span>{formatNumericDate(d.fechaInicio)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ★ Línea de Tiempo Anual */}
                      {stats.decrees.length > 0 && (
                        <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
                          <EmployeeTimeline records={stats.decrees} />
                        </div>
                      )}

                      {/* Edit Form (inline) */}
                      {isEditing && onUpdateEmployee && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 animate-in fade-in duration-200">
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                            <Edit3 size={12} /> Editar Funcionario
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <input
                              placeholder="Nombre completo"
                              value={editForm.nombre}
                              onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
                              onClick={e => e.stopPropagation()}
                              className="flex-1 px-4 py-2 bg-white dark:bg-slate-700 border border-blue-200 dark:border-blue-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200"
                            />
                            <input
                              placeholder="RUT"
                              value={editForm.rut}
                              onChange={e => setEditForm({ ...editForm, rut: e.target.value })}
                              onClick={e => e.stopPropagation()}
                              className="flex-1 sm:max-w-[160px] px-4 py-2 bg-white dark:bg-slate-700 border border-blue-200 dark:border-blue-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 text-xs font-bold tracking-wide text-slate-700 dark:text-slate-200 font-mono"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); saveEdit(emp.rut); }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                              >
                                <Save size={12} /> Guardar
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider"
                              >
                                <XCircle size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-600">
                        {onQuickDecree && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onQuickDecree(emp); onClose(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                          >
                            <Plus size={12} /> Nuevo Decreto
                          </button>
                        )}
                        {onFilterByEmployee && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onFilterByEmployee(emp.nombre); onClose(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                          >
                            <Eye size={12} /> Ver Decretos
                          </button>
                        )}
                        {onUpdateEmployee && !isEditing && (
                          <button
                            onClick={(e) => { e.stopPropagation(); startEdit(emp); }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                          >
                            <Edit3 size={12} /> Editar
                          </button>
                        )}
                        {/* ★ Solo mostrar Eliminar si tiene permisos */}
                        {onDeleteEmployee && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(emp.rut); }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ml-auto"
                          >
                            <Trash2 size={12} /> Eliminar
                          </button>
                        )}
                      </div>

                      {/* Delete Confirmation */}
                      {deleteConfirm === emp.rut && onDeleteEmployee && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 animate-in fade-in duration-200">
                          <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-3">
                            ¿Eliminar a {emp.nombre}? Esta acción no se puede deshacer.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp.rut); }}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                            >
                              Sí, eliminar
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                              className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredEmployees.length === 0 && (
              <div className="py-12 sm:py-16 text-center">
                <Users className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-[11px] sm:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {search ? `Sin resultados para "${search}"` : 'No hay funcionarios registrados'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Pagination */}
        <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Mostrando {paginatedEmployees.length} de {filteredEmployees.length} funcionarios
              {filteredEmployees.length !== employees.length && ` (${employees.length} total)`}
            </p>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition-all"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 px-3">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-600 transition-all"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            <p className="text-[9px] sm:text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest hidden sm:block">
              Clic para expandir detalles
            </p>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div
          className="absolute inset-0 z-[160] flex items-center justify-center p-4"
          onClick={() => { setShowImportModal(false); setImportRejected([]); }}
        >
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <Upload size={24} />
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Importar Funcionarios</h3>
                  <p className="text-[10px] font-bold opacity-70">
                    {importData.length} válidos · {importRejected.length} rechazados
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 max-h-72 overflow-y-auto custom-scrollbar space-y-4">
              {importData.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-4">No se encontraron nuevos funcionarios para importar</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Registros válidos
                  </p>
                  {importData.slice(0, 20).map((emp, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                      <span className="text-xs font-bold text-slate-700 dark:text-white truncate flex-1">{emp.nombre}</span>
                      <span className="text-[10px] font-mono text-slate-400 ml-2">{emp.rut}</span>
                    </div>
                  ))}
                  {importData.length > 20 && (
                    <p className="text-center text-[10px] text-slate-400">...y {importData.length - 20} más</p>
                  )}
                </div>
              )}

              {importRejected.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                    Rechazados por validación
                  </p>
                  {importRejected.slice(0, 12).map((item, i) => (
                    <div key={`${item.rut}-${i}`} className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                      <p className="text-[10px] font-black text-red-700 dark:text-red-300 truncate">{item.nombre} · {item.rut}</p>
                      <p className="text-[10px] text-red-600 dark:text-red-400 truncate">{item.reason}</p>
                    </div>
                  ))}
                  {importRejected.length > 12 && (
                    <p className="text-center text-[10px] text-red-400">...y {importRejected.length - 12} rechazados más</p>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => { setShowImportModal(false); setImportData([]); setImportRejected([]); }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-black uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={processImport}
                disabled={importData.length === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-2"
              >
                <CheckCircle size={14} /> Importar Todos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeListModal;
