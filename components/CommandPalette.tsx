/**
 * Command Palette - Barra de búsqueda global estilo Spotlight
 * Acceso rápido con Ctrl+K o ⌘+K
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Search, X, FileText, User, Calendar, Settings, Plus,
    BarChart3, Download, Clock, ArrowRight, Command, Hash
} from 'lucide-react';
import { PermitRecord, Employee } from '../types';
import { compareRecordsByDateDesc } from '../utils/recordDates';
import { normalizeSearchText } from '../utils/search';

// Tipos de comandos disponibles
interface CommandItem {
    id: string;
    type: 'action' | 'employee' | 'decree' | 'navigation';
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    keywords?: string[];
    action: () => void;
    shortcut?: string;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    records: PermitRecord[];
    employees: Employee[];
    onNavigate: (view: 'dashboard' | 'calendar' | 'personal' | 'settings') => void;
    onNewDecree: (type?: 'PA' | 'FL') => void;
    onSelectEmployee: (employee: Employee) => void;
    onSelectRecord: (record: PermitRecord) => void;
    onExportData: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen,
    onClose,
    records,
    employees,
    onNavigate,
    onNewDecree,
    onSelectEmployee,
    onSelectRecord,
    onExportData,
}) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Focus input cuando se abre
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Comandos de acción rápida
    const actionCommands: CommandItem[] = useMemo(() => [
        {
            id: 'new-pa',
            type: 'action',
            icon: <Plus className="w-4 h-4" />,
            title: 'Nuevo Permiso Administrativo',
            subtitle: 'Crear un nuevo decreto de PA',
            keywords: ['nuevo', 'crear', 'permiso', 'administrativo', 'pa'],
            action: () => { onNewDecree('PA'); onClose(); },
            shortcut: 'N',
        },
        {
            id: 'new-fl',
            type: 'action',
            icon: <Plus className="w-4 h-4" />,
            title: 'Nuevo Feriado Legal',
            subtitle: 'Crear un nuevo decreto de FL',
            keywords: ['nuevo', 'crear', 'feriado', 'legal', 'fl', 'vacaciones'],
            action: () => { onNewDecree('FL'); onClose(); },
            shortcut: 'F',
        },
        {
            id: 'nav-dashboard',
            type: 'navigation',
            icon: <BarChart3 className="w-4 h-4" />,
            title: 'Ir al Inicio',
            subtitle: 'Ver resumen general y estadísticas',
            keywords: ['inicio', 'home', 'dashboard', 'estadisticas', 'reportes'],
            action: () => { onNavigate('dashboard'); onClose(); },
            shortcut: 'D',
        },
        {
            id: 'nav-calendar',
            type: 'navigation',
            icon: <Calendar className="w-4 h-4" />,
            title: 'Ver Calendario',
            subtitle: 'Visualizar decretos en calendario',
            keywords: ['calendario', 'fechas', 'mes', 'semana'],
            action: () => { onNavigate('calendar'); onClose(); },
            shortcut: 'C',
        },
        {
            id: 'nav-employees',
            type: 'navigation',
            icon: <User className="w-4 h-4" />,
            title: 'Lista de Funcionarios',
            subtitle: 'Gestionar empleados',
            keywords: ['funcionarios', 'empleados', 'personas', 'lista'],
            action: () => { onNavigate('personal'); onClose(); },
            shortcut: 'E',
        },
        {
            id: 'nav-settings',
            type: 'navigation',
            icon: <Settings className="w-4 h-4" />,
            title: 'Configuración',
            subtitle: 'Preferencias y administración',
            keywords: ['configuracion', 'ajustes', 'settings', 'admin'],
            action: () => { onNavigate('settings'); onClose(); },
            shortcut: 'S',
        },
        {
            id: 'export-data',
            type: 'action',
            icon: <Download className="w-4 h-4" />,
            title: 'Exportar Datos',
            subtitle: 'Descargar datos a Excel',
            keywords: ['exportar', 'descargar', 'excel', 'datos'],
            action: () => { onExportData(); onClose(); },
            shortcut: 'X',
        },
    ], [onNewDecree, onNavigate, onExportData, onClose]);

    // Comandos de empleados
    const employeeCommands: CommandItem[] = useMemo(() =>
        employees.map(emp => ({
            id: `emp-${emp.rut}`,
            type: 'employee' as const,
            icon: <User className="w-4 h-4" />,
            title: emp.nombre,
            subtitle: `RUT: ${emp.rut}`,
            keywords: [normalizeSearchText(emp.nombre), normalizeSearchText(emp.rut)],
            action: () => { onSelectEmployee(emp); onClose(); },
        })),
        [employees, onSelectEmployee, onClose]
    );

    // Comandos de decretos recientes
    const recentDecreeCommands: CommandItem[] = useMemo(() =>
        records
            .slice()
            .sort((a, b) => compareRecordsByDateDesc(a, b))
            .slice(0, 120)
            .map(r => ({
                id: `rec-${r.id}`,
                type: 'decree' as const,
                icon: <FileText className="w-4 h-4" />,
                title: `${r.solicitudType} N° ${r.acto}`,
                subtitle: `${r.funcionario} — ${r.cantidadDias} días`,
                keywords: [
                    normalizeSearchText(r.funcionario),
                    normalizeSearchText(r.acto),
                    normalizeSearchText(r.solicitudType),
                    normalizeSearchText(r.rut),
                ],
                action: () => { onSelectRecord(r); onClose(); },
            })),
        [records, onSelectRecord, onClose]
    );

    // Filtrar resultados basados en la búsqueda
    const filteredResults = useMemo(() => {
        const normalizedQuery = normalizeSearchText(query);
        const searchTerms = normalizedQuery.split(/\s+/).filter(Boolean);

        if (!normalizedQuery) {
            // Sin búsqueda, mostrar acciones principales
            return actionCommands;
        }

        const allItems = [...actionCommands, ...employeeCommands, ...recentDecreeCommands];

        return allItems
            .filter(item => {
                const searchableText = [
                    normalizeSearchText(item.title),
                    normalizeSearchText(item.subtitle || ''),
                    ...(item.keywords || []).map(normalizeSearchText),
                ].join(' ');

                return searchTerms.every(term => searchableText.includes(term));
            })
            .slice(0, 60); // Limitar resultados visibles
    }, [query, actionCommands, employeeCommands, recentDecreeCommands]);

    // Navegar con teclado
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < filteredResults.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev > 0 ? prev - 1 : filteredResults.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredResults[selectedIndex]) {
                    filteredResults[selectedIndex].action();
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [filteredResults, selectedIndex, onClose]);

    // Scroll al elemento seleccionado
    useEffect(() => {
        const selectedElement = listRef.current?.children[selectedIndex] as HTMLElement;
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex]);

    // Reset del índice cuando cambian los resultados
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    if (!isOpen) return null;

    const getTypeLabel = (type: CommandItem['type']) => {
        switch (type) {
            case 'action': return 'ACCIÓN';
            case 'employee': return 'FUNCIONARIO';
            case 'decree': return 'DECRETO';
            case 'navigation': return 'NAVEGACIÓN';
        }
    };

    const getTypeColor = (type: CommandItem['type']) => {
        switch (type) {
            case 'action': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400';
            case 'employee': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400';
            case 'decree': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400';
            case 'navigation': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400';
        }
    };

    return (
        <div
            className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh]"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

            {/* Command Palette */}
            <div
                className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden mx-4 animate-in zoom-in-95 slide-in-from-top-4 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                    <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Buscar decretos, funcionarios o comandos..."
                        className="flex-1 bg-transparent text-slate-900 dark:text-white text-base placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                    />
                    <div className="flex items-center gap-2">
                        <kbd className="hidden sm:flex items-center gap-0.5 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                            <Command className="w-3 h-3" />K
                        </kbd>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Results */}
                <div
                    ref={listRef}
                    className="max-h-[50vh] overflow-y-auto custom-scrollbar"
                >
                    {filteredResults.length > 0 ? (
                        <div className="py-2">
                            {filteredResults.map((item, index) => (
                                <button
                                    key={item.id}
                                    onClick={item.action}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${index === selectedIndex
                                        ? 'bg-indigo-50 dark:bg-indigo-900/30'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                        }`}
                                >
                                    {/* Icon */}
                                    <div className={`p-2 rounded-xl ${index === selectedIndex
                                        ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400'
                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                                        }`}>
                                        {item.icon}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-semibold truncate ${index === selectedIndex
                                            ? 'text-indigo-900 dark:text-indigo-100'
                                            : 'text-slate-800 dark:text-slate-200'
                                            }`}>
                                            {item.title}
                                        </p>
                                        {item.subtitle && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                {item.subtitle}
                                            </p>
                                        )}
                                    </div>

                                    {/* Type Badge */}
                                    <span className={`hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${getTypeColor(item.type)}`}>
                                        {getTypeLabel(item.type)}
                                    </span>

                                    {/* Shortcut */}
                                    {item.shortcut && (
                                        <kbd className="hidden sm:block px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                                            {item.shortcut}
                                        </kbd>
                                    )}

                                    {/* Arrow */}
                                    <ArrowRight className={`w-4 h-4 flex-shrink-0 transition-transform ${index === selectedIndex
                                        ? 'text-indigo-500 translate-x-0.5'
                                        : 'text-slate-300 dark:text-slate-600'
                                        }`} />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <Hash className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                                Sin resultados para "{query}"
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
                                Intenta con otro término de búsqueda
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px]">↑↓</kbd>
                            Navegar
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px]">↵</kbd>
                            Seleccionar
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px]">ESC</kbd>
                            Cerrar
                        </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        GDP Cloud v2.5
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
