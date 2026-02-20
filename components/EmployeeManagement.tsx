
import React, { useState, useMemo, useRef } from 'react';
import { Employee, PermitRecord, SolicitudType } from '../types';
import {
    X, Search, Users, UserCircle, TrendingUp, TrendingDown,
    Calendar, FileText, Plus, Trash2, ChevronDown, ChevronUp,
    ArrowUpDown, Filter, Download, AlertTriangle, CheckCircle, Shield,
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
import { logger } from '../utils/logger';
import EmployeeTimeline from './EmployeeTimeline';

const employeeManagementLogger = logger.create('EmployeeManagement');

interface EmployeeManagementProps {
    employees: Employee[];
    records: PermitRecord[];
    onAddEmployee?: (employee: Employee) => void;
    onUpdateEmployee?: (oldRut: string, updatedEmployee: Employee) => void;
    onDeleteEmployee?: (rut: string) => void;
    onFilterByEmployee?: (funcionario: string) => void;
    onQuickDecree?: (employee: Employee, type: SolicitudType) => void;
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
    saldo: number;
    saldoFL: number;
    lastDecree: PermitRecord | null;
    decrees: PermitRecord[];
}

const ITEMS_PER_PAGE = 20;

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({
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
    const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ nombre: '', rut: '', departamento: '' });
    const [currentPage, setCurrentPage] = useState(1);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState<Employee[]>([]);
    const [importRejected, setImportRejected] = useState<Array<{ nombre: string; rut: string; reason: string }>>([]);
    const [quickDecreeType, setQuickDecreeType] = useState<SolicitudType>('PA');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const employeeStats = useMemo(() => {
        const stats: Record<string, EmployeeStats> = {};
        employees.forEach(emp => {
            const empRecords = records.filter(r =>
                r.rut === emp.rut || r.funcionario.toLowerCase() === emp.nombre.toLowerCase()
            );
            const diasPA = empRecords.filter(r => r.solicitudType === 'PA').reduce((sum, r) => sum + r.cantidadDias, 0);
            const diasFL = empRecords.filter(r => r.solicitudType === 'FL').reduce((sum, r) => sum + r.cantidadDias, 0);
            const sortedDecrees = [...empRecords].sort((a, b) => compareRecordsByDateDesc(a, b, 'fechaInicio'));
            const lastPA = empRecords.filter(r => r.solicitudType === 'PA').sort((a, b) => compareRecordsByDateDesc(a, b))[0];
            const diasHaber = lastPA ? lastPA.diasHaber : 6;
            const saldo = lastPA ? lastPA.diasHaber - lastPA.cantidadDias : 6;
            const lastFL = empRecords.filter(r => r.solicitudType === 'FL').sort((a, b) => compareRecordsByDateDesc(a, b))[0];
            const saldoFL = lastFL ? getFLSaldoFinal(lastFL, 0) : 0;
            stats[emp.rut] = { totalDecrees: empRecords.length, diasPA, diasFL, diasHaber, saldo, saldoFL, lastDecree: sortedDecrees[0] || null, decrees: sortedDecrees };
        });
        return stats;
    }, [employees, records]);

    const globalStats = useMemo(() => {
        const totalDecrees = records.length;
        const totalDiasPA = records.filter(r => r.solicitudType === 'PA').reduce((s, r) => s + r.cantidadDias, 0);
        const totalDiasFL = records.filter(r => r.solicitudType === 'FL').reduce((s, r) => s + r.cantidadDias, 0);
        const avgPerEmployee = employees.length > 0 ? (totalDecrees / employees.length).toFixed(1) : '0';
        const lowBalanceCount = Object.values(employeeStats).filter((s: EmployeeStats) => s.saldo < 2).length;
        return { totalDecrees, totalDiasPA, totalDiasFL, avgPerEmployee, lowBalanceCount };
    }, [records, employees, employeeStats]);

    const filteredEmployees = useMemo(() => {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).getTime();
        const normalizedSearch = normalizeSearchText(search);
        const normalizedRutSearch = normalizeRutForSearch(search);
        const hasSearchTerm = normalizedSearch.length > 0;
        const hasRutSearchTerm = normalizedRutSearch.length > 0;
        return employees.filter(e => {
            const matchesName = normalizeSearchText(e.nombre).includes(normalizedSearch);
            const matchesRut = hasRutSearchTerm && normalizeRutForSearch(e.rut).includes(normalizedRutSearch);
            const matchesSearch = !hasSearchTerm || matchesName || matchesRut;
            if (!matchesSearch) return false;
            const stats = employeeStats[e.rut];
            if (!stats) return balanceFilter === 'all' && dateFilter === 'all';
            if (balanceFilter === 'high' && stats.saldo < 4) return false;
            if (balanceFilter === 'medium' && (stats.saldo < 2 || stats.saldo >= 4)) return false;
            if (balanceFilter === 'low' && stats.saldo >= 2) return false;
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
        }).sort((a, b) => {
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

    const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
    const paginatedEmployees = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredEmployees.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredEmployees, currentPage]);

    React.useEffect(() => { setCurrentPage(1); }, [search, balanceFilter, dateFilter]);

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
        if (!normalizedName || !String(rut || '').trim()) { alert('Nombre y RUT son obligatorios.'); return null; }
        if (!isValidRutModulo11(rut) || !normalizedRut) { alert('RUT inválido. Verifica dígito verificador (Módulo 11).'); return null; }
        const duplicate = findEmployeeByRut(employees, normalizedRut, options.ignoreEmployeeRut);
        if (duplicate) { alert(`Ya existe un funcionario con ese RUT (${duplicate.nombre}).`); return null; }
        const conflict = findRutNameConflict(normalizedRut, normalizedName, employees, records, {
            ignoreEmployeeRut: options.ignoreEmployeeRut, ignoreEmployeeName: options.ignoreEmployeeName,
        });
        if (conflict) { alert(buildRutConflictMessage(conflict)); return null; }
        return { normalizedName, normalizedRut, normalizedDepto: String(options.departamento || '').trim() };
    };

    const handleAddEmployeeLocal = () => {
        if (!newEmployee.nombre.trim() || !newEmployee.rut.trim()) return;
        if (!onAddEmployee) return;
        const validated = validateEmployeeIdentity(newEmployee.nombre, newEmployee.rut, { departamento: newEmployee.departamento });
        if (!validated) return;
        onAddEmployee({ nombre: validated.normalizedName, rut: validated.normalizedRut, departamento: validated.normalizedDepto });
        setNewEmployee({ nombre: '', rut: '', departamento: '' });
        setShowAddForm(false);
    };

    const exportEmployeesToExcel = async () => {
        try {
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
        } catch (err) { }
    };

    const startEdit = (emp: Employee) => {
        setEditingEmployee(emp.rut);
        setEditForm({ nombre: emp.nombre, rut: emp.rut, departamento: emp.departamento || '' });
    };

    const saveEdit = (oldRut: string) => {
        if (!editForm.nombre.trim() || !editForm.rut.trim()) return;
        const previousEmployee = employees.find(e => normalizeRutCanonical(e.rut) === normalizeRutCanonical(oldRut));
        const validated = validateEmployeeIdentity(editForm.nombre, editForm.rut, {
            ignoreEmployeeRut: oldRut,
            ignoreEmployeeName: previousEmployee?.nombre,
            departamento: editForm.departamento
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
                const imported: Employee[] = [];
                const rejected: Array<{ nombre: string; rut: string; reason: string }> = [];
                const seenInFile = new Map<string, string>();
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length < 2) continue;
                    let nombre = ''; let rut = '';
                    if (typeof row[0] === 'string' && typeof row[1] === 'string') {
                        if (row[1].includes('-') || row[1].match(/^\d/)) { nombre = String(row[0]).trim().toUpperCase(); rut = String(row[1]).trim(); }
                        else if (row.length >= 3) { nombre = [row[0], row[1], row[2]].filter(Boolean).join(' ').trim().toUpperCase(); rut = String(row[3] || row[2] || '').trim(); }
                    }
                    if (!nombre || !rut) continue;
                    if (!isValidRutModulo11(rut)) { rejected.push({ nombre, rut, reason: 'RUT inválido (Módulo 11)' }); continue; }
                    const normalizedRut = formatRutForStorage(rut);
                    const canonicalRut = normalizeRutCanonical(normalizedRut);
                    const normalizedName = nombre.trim().toUpperCase();
                    if (!normalizedRut || !canonicalRut) { rejected.push({ nombre, rut, reason: 'RUT inválido' }); continue; }
                    const existingEmployee = findEmployeeByRut(employees, normalizedRut);
                    if (existingEmployee) { rejected.push({ nombre, rut: normalizedRut, reason: `RUT ya existe (${existingEmployee.nombre})` }); continue; }
                    const conflict = findRutNameConflict(normalizedRut, normalizedName, employees, records);
                    if (conflict) { rejected.push({ nombre, rut: normalizedRut, reason: buildRutConflictMessage(conflict) }); continue; }
                    const existingInFile = seenInFile.get(canonicalRut);
                    if (existingInFile) {
                        if (normalizeIdentityName(existingInFile) !== normalizeIdentityName(normalizedName)) { rejected.push({ nombre, rut: normalizedRut, reason: `RUT duplicado con distinto nombre (${existingInFile})` }); }
                        else { rejected.push({ nombre, rut: normalizedRut, reason: 'RUT duplicado en archivo' }); }
                        continue;
                    }
                    seenInFile.set(canonicalRut, normalizedName);
                    imported.push({ nombre: normalizedName, rut: normalizedRut });
                }
                setImportData(imported); setImportRejected(rejected); setShowImportModal(true);
            };
            reader.readAsArrayBuffer(file);
        } catch (err) { alert('Error al procesar el archivo.'); }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const processImport = () => {
        if (!onAddEmployee) return;
        importData.forEach(emp => onAddEmployee(emp));
        setImportData([]); setImportRejected([]); setShowImportModal(false);
    };

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
        <div className="space-y-6 sm:space-y-10 animate-in fade-in duration-700">
            {/* Header de Sección con estilo Decretos */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-200/50 dark:shadow-emerald-950/30">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Gestión de Personal
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                Dirección de Administración y Finanzas
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                            <span className="text-[10px] sm:text-[11px] font-black text-emerald-500 uppercase tracking-widest">
                                {employees.length} Funcionarios
                            </span>
                        </div>
                    </div>
                </div>

                {onAddEmployee && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                        <Plus size={18} />
                        <span>Nuevo Funcionario</span>
                    </button>
                )}
            </div>

            {/* Toolbar y Filtros - Estilo similar a Dashboard/Decretos cards */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm overflow-hidden p-2">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[280px]">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            placeholder="Buscar por nombre o RUT..."
                            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 text-sm font-black text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 px-2">
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                            className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl px-4 py-3 text-xs font-black text-slate-600 dark:text-slate-300 cursor-pointer outline-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                        >
                            <option value="all">Todos los periodos</option>
                            <option value="thisMonth">Este Mes</option>
                            <option value="thisYear">Este Año</option>
                            <option value="noRecent">Sin Actividad (+3m)</option>
                        </select>

                        <select
                            value={`${sortField}-${sortOrder}`}
                            onChange={(e) => {
                                const [field, order] = e.target.value.split('-');
                                setSortField(field as SortField);
                                setSortOrder(order as SortOrder);
                            }}
                            className="bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl px-4 py-3 text-xs font-black text-slate-600 dark:text-slate-300 cursor-pointer outline-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                        >
                            <option value="nombre-asc">Nombre (A-Z)</option>
                            <option value="totalDecrees-desc">Más Decretos</option>
                            <option value="saldo-asc">Menor Saldo PA</option>
                        </select>

                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

                        <div className="flex gap-1.5">
                            <button
                                onClick={exportEmployeesToExcel}
                                className="p-3.5 bg-slate-50 dark:bg-slate-900/50 text-emerald-600 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all active:scale-95"
                                title="Exportar Excel"
                            >
                                <Download size={20} />
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-3.5 bg-slate-50 dark:bg-slate-900/50 text-blue-600 rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all active:scale-95"
                                title="Importar Excel"
                            >
                                <Upload size={20} />
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Formulario de Alta Inline - Estilo similar a PermitForm */}
            {showAddForm && (
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-3xl p-6 sm:p-8 animate-in slide-in-from-top-4 duration-300 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-600 text-white rounded-xl">
                            <Plus size={20} />
                        </div>
                        <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">
                            Registrar Nuevo Funcionario
                        </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                            <input
                                placeholder="Ej: JUAN PEREZ SOTO"
                                value={newEmployee.nombre}
                                onChange={e => setNewEmployee({ ...newEmployee, nombre: e.target.value })}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border-none shadow-sm text-sm font-bold uppercase focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Departamento</label>
                            <input
                                placeholder="Ej: FINANZAS"
                                value={newEmployee.departamento}
                                onChange={e => setNewEmployee({ ...newEmployee, departamento: e.target.value })}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border-none shadow-sm text-sm font-bold uppercase focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">RUT</label>
                            <input
                                placeholder="12.345.678-9"
                                value={newEmployee.rut}
                                onChange={e => setNewEmployee({ ...newEmployee, rut: e.target.value })}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border-none shadow-sm text-sm font-bold font-mono focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-300 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleAddEmployeeLocal}
                            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                        >
                            <CheckCircle size={16} /> Guardar Funcionario
                        </button>
                    </div>
                </div>
            )}

            {/* Lista Principal - Adaptada al estilo Decretos */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        Directorio de Funcionarios
                    </h4>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Saldo Óptimo
                        </span>
                        <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-amber-500" /> Saldo Medio
                        </span>
                        <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" /> Crítico
                        </span>
                    </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {paginatedEmployees.map((emp, idx) => {
                        const stats = employeeStats[emp.rut] || { totalDecrees: 0, diasPA: 0, diasFL: 0, saldo: 6, saldoFL: 0, diasHaber: 6, lastDecree: null, decrees: [] };
                        const isExpanded = expandedEmployee === emp.rut;
                        const isEditing = editingEmployee === emp.rut;

                        return (
                            <div key={emp.rut} className={`transition-all duration-300 ${isExpanded ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/30'}`}>
                                <div
                                    onClick={() => setExpandedEmployee(isExpanded ? null : emp.rut)}
                                    className="flex flex-col sm:flex-row items-center gap-4 px-8 py-5 cursor-pointer"
                                >
                                    <div className="flex items-center gap-4 flex-1 w-full">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${isExpanded ? 'bg-emerald-600 text-white shadow-lg rotate-12' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                            <UserCircle size={28} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h3 className={`text-sm font-black uppercase tracking-tight truncate ${isExpanded ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                                    {emp.nombre}
                                                </h3>
                                                {emp.departamento && (
                                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-[8px] font-black text-slate-500 dark:text-slate-400 rounded-lg uppercase tracking-wider">
                                                        {emp.departamento}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter">{emp.rut}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stats.totalDecrees} Decretos Registrados</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/50">
                                        <div className="flex flex-col items-center sm:items-end min-w-[70px]">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Saldo PA</span>
                                            <div className={`px-3 py-1 rounded-xl font-black text-xs transition-all ${getSaldoColor(stats.saldo)}`}>
                                                {stats.saldo.toFixed(1)}
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center sm:items-end min-w-[70px]">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Saldo FL</span>
                                            <div className="flex items-center gap-1.5 h-6">
                                                <span className={`text-xs font-black ${stats.diasFL > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                                    {stats.diasFL > 0 ? stats.saldoFL.toFixed(1) : '—'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className={`p-2 rounded-xl transition-all duration-300 ${isExpanded ? 'bg-emerald-100 text-emerald-600 rotate-180' : 'text-slate-300 dark:text-slate-600'}`}>
                                            <ChevronDown size={18} />
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-8 pb-8 animate-in slide-in-from-top-4 duration-500">
                                        <div className="pt-2 grid grid-cols-1 lg:grid-cols-12 gap-8">
                                            {/* Línea de Tiempo y Acciones */}
                                            <div className="lg:col-span-8 space-y-6">
                                                <div className="bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-700/50 p-6 shadow-sm">
                                                    <EmployeeTimeline records={stats.decrees} />
                                                </div>

                                                {/* Botones de acción con estilo Decretos */}
                                                <div className="flex flex-wrap items-center gap-3">
                                                    {onQuickDecree && (
                                                        <div className="flex-1 min-w-[280px] flex items-stretch gap-2">
                                                            <div className="relative flex-1">
                                                                <select
                                                                    value={quickDecreeType}
                                                                    onChange={(e) => setQuickDecreeType(e.target.value as SolicitudType)}
                                                                    className="w-full h-full pl-4 pr-10 py-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer"
                                                                >
                                                                    <option value="PA">Permiso Adm. (PA)</option>
                                                                    <option value="FL">Feriado Legal (FL)</option>
                                                                </select>
                                                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                            </div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onQuickDecree(emp, quickDecreeType); }}
                                                                className="flex-[2] flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                                            >
                                                                <Plus size={16} /> Iniciar Decreto
                                                            </button>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); startEdit(emp); }}
                                                        className="px-6 py-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                    {onDeleteEmployee && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(emp.rut); }}
                                                            className="px-6 py-4 bg-rose-50 dark:bg-rose-900/10 text-rose-500 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95 shadow-sm"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>

                                                {deleteConfirm === emp.rut && (
                                                    <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-200 dark:border-red-800 animate-in shake-in duration-300">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <AlertTriangle className="text-red-500" />
                                                            <p className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-widest">Atención: Acción Irreversible</p>
                                                        </div>
                                                        <p className="text-sm text-red-600 dark:text-red-300 mb-6">Se eliminarán todos los datos asociados a este funcionario. ¿Deseas continuar?</p>
                                                        <div className="flex gap-3">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onDeleteEmployee?.(emp.rut); setDeleteConfirm(null); }}
                                                                className="flex-1 bg-red-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20"
                                                            >
                                                                Confirmar Eliminación
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                                                                className="flex-1 bg-white dark:bg-slate-800 text-slate-500 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Resumen Lateral */}
                                            <div className="lg:col-span-4 space-y-6">
                                                <div className="bg-slate-50/50 dark:bg-slate-900/40 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                                                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                        <TrendingUp size={12} className="text-emerald-500" /> Resumen de Utilización
                                                    </h4>
                                                    <div className="space-y-6">
                                                        <div>
                                                            <div className="flex justify-between items-end mb-2">
                                                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Permiso Administrativo</span>
                                                                <span className="text-xs font-black text-slate-700 dark:text-slate-200">{stats.diasPA} / {stats.diasHaber} días</span>
                                                            </div>
                                                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
                                                                <div
                                                                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                                                                    style={{ width: `${Math.min(100, (stats.diasPA / stats.diasHaber) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="flex justify-between items-end mb-2">
                                                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Feriado Legal</span>
                                                                <span className="text-xs font-black text-slate-700 dark:text-slate-200">{stats.diasFL} días tomados</span>
                                                            </div>
                                                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
                                                                <div
                                                                    className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                                                                    style={{ width: `${Math.min(100, (stats.diasFL / 15) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-white dark:bg-slate-900/40 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                                                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Registro más reciente</h4>
                                                    {stats.lastDecree ? (
                                                        <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                                            <div className="p-2.5 bg-white dark:bg-slate-700 rounded-xl text-emerald-600 shadow-sm">
                                                                <FileText size={18} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate leading-tight mb-1">{stats.lastDecree.acto}</p>
                                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                                    <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[8px]">{stats.lastDecree.solicitudType}</span>
                                                                    Inició el <span className="text-slate-900 dark:text-white">{formatNumericDate(stats.lastDecree.fechaInicio)}</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center py-6 text-slate-300">
                                                            <Clock size={24} className="mb-2 opacity-50" />
                                                            <p className="text-[10px] font-black uppercase tracking-widest italic">Sin historial de actividad</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {filteredEmployees.length === 0 && (
                        <div className="py-24 text-center">
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-200 dark:text-slate-700 border-2 border-dashed border-slate-200 dark:border-slate-800">
                                <Users size={40} />
                            </div>
                            <h5 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">
                                {search ? 'Búsqueda sin resultados' : 'Directorio vacío'}
                            </h5>
                            <p className="text-xs text-slate-400 mt-2">Prueba ajustando los filtros o el término de búsqueda</p>
                        </div>
                    )}
                </div>

                {/* Footer Paginación - Estilo Decretos */}
                <div className="px-8 py-6 bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-white dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-400 uppercase border border-slate-200 dark:border-slate-700">
                            {filteredEmployees.length} Registros
                        </span>
                        {search && (
                            <button onClick={() => setSearch('')} className="text-[10px] font-black text-emerald-600 uppercase hover:underline">
                                Limpiar búsqueda
                            </button>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <div className="px-6 h-10 flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                                <span className="text-xs font-black tracking-widest text-slate-600 dark:text-slate-300">
                                    {currentPage} <span className="text-slate-300 mx-2">/</span> {totalPages}
                                </span>
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Importación Compartido */}
            {showImportModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowImportModal(false)} />
                    <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-white/10">
                        <div className="bg-emerald-600 p-8 sm:p-10 text-white relative">
                            <div className="absolute top-0 right-0 p-8">
                                <Shield className="w-20 h-20 text-white/10 -rotate-12" />
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-tight relative z-10">Validación de Datos</h3>
                            <p className="text-xs font-bold text-emerald-100 mt-2 relative z-10 uppercase tracking-widest">
                                {importData.length} registros listos para incorporar al sistema
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 sm:p-10 space-y-8">
                            {importRejected.length > 0 && (
                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
                                        <XCircle size={14} /> Registros omitidos por inconsistencias ({importRejected.length})
                                    </h5>
                                    <div className="space-y-2">
                                        {importRejected.map((r, i) => (
                                            <div key={i} className="flex items-center gap-3 p-3 bg-rose-50/50 dark:bg-rose-900/10 rounded-xl border border-rose-100/50 dark:border-rose-900/20">
                                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate">{r.nombre}</p>
                                                    <p className="text-[9px] font-bold text-rose-500 uppercase tracking-tighter">{r.reason}</p>
                                                </div>
                                                <span className="text-[9px] font-mono text-slate-400 ml-4">{r.rut}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircle size={14} /> Registros válidos listos para importar
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {importData.map((d, i) => (
                                        <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:border-emerald-200 dark:hover:border-emerald-800 shadow-sm">
                                            <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-emerald-600 shadow-inner">
                                                <Users size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate">{d.nombre}</p>
                                                <p className="text-[9px] font-bold text-slate-400 font-mono">{d.rut}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 sm:p-10 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-4 bg-slate-50/30 dark:bg-slate-900/30">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="flex-1 px-8 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
                            >
                                Cancelar y Revisar
                            </button>
                            <button
                                onClick={processImport}
                                disabled={importData.length === 0}
                                className="flex-[1.5] px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                Confirmar e Importar {importData.length} Funcionarios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeManagement;
