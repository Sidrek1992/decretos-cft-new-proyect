import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PermitRecord, Employee } from '../types';
import { compareRecordsByDateDesc, getRecordDateValue } from '../utils/recordDates';
import { getFLSaldoFinal } from '../utils/flBalance';
import {
    Bell, X, AlertTriangle, Calendar, User, ChevronRight, Clock, TrendingUp,
    Info, CheckCircle, AlertCircle, Zap, Shield, ChevronDown, Eye, EyeOff,
    Sparkles, BellRing, Archive, Filter
} from 'lucide-react';

interface Notification {
    id: string;
    type: 'warning' | 'info' | 'success' | 'critical';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    priority: number; // 1 = alta, 2 = media, 3 = baja
    category: 'saldo' | 'deadline' | 'info' | 'suggestion';
    data?: {
        employeeName?: string;
        employeeRut?: string;
        saldo?: number;
        actionType?: string;
    };
}

interface NotificationCenterProps {
    records: PermitRecord[];
    employees: Employee[];
    onViewEmployee?: (rut: string) => void;
}

// Helper: Tiempo relativo humano
const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
};

// Helper: Leer IDs leídos de localStorage
const getReadIds = (): Set<string> => {
    try {
        const stored = localStorage.getItem('gdp-notification-read-ids');
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
        return new Set();
    }
};

const saveReadIds = (ids: Set<string>) => {
    try {
        localStorage.setItem('gdp-notification-read-ids', JSON.stringify([...ids]));
    } catch { /* silently fail */ }
};

// Category metadata
const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; gradient: string }> = {
    saldo: {
        label: 'Saldos',
        icon: <Shield className="w-3.5 h-3.5" />,
        gradient: 'from-red-500 to-amber-500'
    },
    deadline: {
        label: 'Plazos',
        icon: <Calendar className="w-3.5 h-3.5" />,
        gradient: 'from-amber-500 to-orange-500'
    },
    info: {
        label: 'Actividad',
        icon: <Zap className="w-3.5 h-3.5" />,
        gradient: 'from-blue-500 to-cyan-500'
    },
    suggestion: {
        label: 'Sugerencias',
        icon: <Sparkles className="w-3.5 h-3.5" />,
        gradient: 'from-violet-500 to-purple-500'
    }
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({ records, employees, onViewEmployee }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasNewNotifications, setHasNewNotifications] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['saldo', 'deadline', 'info', 'suggestion']));
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);
    const [bellBounce, setBellBounce] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const readIdsRef = useRef<Set<string>>(getReadIds());

    // === ALERTAS INTELIGENTES ===
    const generateSmartAlerts = useCallback(() => {
        const newNotifications: Notification[] = [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // 🔴 1. ALERTAS DE SALDO BAJO Y NEGATIVO
        employees.forEach(emp => {
            // Alertas PA
            const paRecords = records.filter(r =>
                r.rut === emp.rut && r.solicitudType === 'PA'
            ).sort((a, b) => compareRecordsByDateDesc(a, b));

            if (paRecords.length > 0) {
                const lastRecord = paRecords[0];
                const saldo = lastRecord.diasHaber - lastRecord.cantidadDias;

                // Saldo crítico (0 o negativo)
                if (saldo <= 0) {
                    newNotifications.push({
                        id: `critical-pa-${emp.rut}`,
                        type: 'critical',
                        priority: 1,
                        category: 'saldo',
                        title: 'Saldo Agotado PA',
                        message: `${emp.nombre} no tiene días de permiso disponibles (${saldo.toFixed(1)} días)`,
                        timestamp: now,
                        read: false,
                        data: { employeeName: emp.nombre, employeeRut: emp.rut, saldo }
                    });
                }
                // Saldo bajo (1-2 días)
                else if (saldo < 2) {
                    newNotifications.push({
                        id: `low-pa-${emp.rut}`,
                        type: 'warning',
                        priority: 2,
                        category: 'saldo',
                        title: 'Saldo Bajo PA',
                        message: `${emp.nombre} tiene solo ${saldo.toFixed(1)} días de permiso`,
                        timestamp: now,
                        read: false,
                        data: { employeeName: emp.nombre, employeeRut: emp.rut, saldo }
                    });
                }
            }

            // Alertas FL - Feriado Legal
            const flRecords = records.filter(r =>
                r.rut === emp.rut && r.solicitudType === 'FL'
            ).sort((a, b) => compareRecordsByDateDesc(a, b));

            if (flRecords.length > 0) {
                const lastFL = flRecords[0];
                const saldoFL = getFLSaldoFinal(lastFL, 0);

                if (saldoFL <= 0) {
                    newNotifications.push({
                        id: `critical-fl-${emp.rut}`,
                        type: 'critical',
                        priority: 1,
                        category: 'saldo',
                        title: 'Feriado Legal Agotado',
                        message: `${emp.nombre} ha utilizado todo su feriado legal`,
                        timestamp: now,
                        read: false,
                        data: { employeeName: emp.nombre, employeeRut: emp.rut, saldo: saldoFL }
                    });
                }
            }
        });

        // 🟡 2. ALERTA DE FIN DE AÑO (Noviembre y Diciembre)
        if (currentMonth >= 10) {
            const daysUntilYearEnd = Math.ceil((new Date(currentYear, 11, 31).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            const employeesWithUnusedPA = employees.filter(emp => {
                const empRecords = records.filter(r =>
                    r.rut === emp.rut &&
                    r.solicitudType === 'PA' &&
                    new Date(r.fechaInicio + 'T12:00:00').getFullYear() === currentYear
                );
                const totalUsed = empRecords.reduce((sum, r) => sum + r.cantidadDias, 0);
                return totalUsed < 3;
            });

            if (employeesWithUnusedPA.length > 0 && daysUntilYearEnd <= 60) {
                newNotifications.push({
                    id: `year-end-warning-${currentYear}`,
                    type: 'warning',
                    priority: 1,
                    category: 'deadline',
                    title: 'Fin de Año Próximo',
                    message: `${employeesWithUnusedPA.length} funcionarios tienen permisos sin usar. Quedan ${daysUntilYearEnd} días para fin de año.`,
                    timestamp: now,
                    read: false,
                    data: { actionType: 'view-unused' }
                });
            }
        }

        // 🔵 3. INFORMACIÓN DE ACTIVIDAD RECIENTE
        const recentRecords = records.filter(r => {
            const recordTime = getRecordDateValue(r);
            const daysDiff = (now.getTime() - recordTime) / (1000 * 60 * 60 * 24);
            return daysDiff <= 1;
        });

        if (recentRecords.length > 0) {
            newNotifications.push({
                id: `recent-activity-${now.toDateString()}`,
                type: 'info',
                priority: 3,
                category: 'info',
                title: 'Actividad Reciente',
                message: `${recentRecords.length} decreto(s) registrados en las últimas 24 horas`,
                timestamp: now,
                read: false,
            });
        }

        // 📊 4. RESUMEN SEMANAL
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weekRecords = records.filter(r => {
            const recordTime = getRecordDateValue(r);
            return recordTime >= weekAgo.getTime();
        });

        if (weekRecords.length > 3) {
            const totalDays = weekRecords.reduce((sum, r) => sum + r.cantidadDias, 0);
            newNotifications.push({
                id: `weekly-summary-${now.toISOString().split('T')[0]}`,
                type: 'info',
                priority: 3,
                category: 'info',
                title: 'Resumen Semanal',
                message: `${weekRecords.length} decretos con ${totalDays} días otorgados esta semana`,
                timestamp: now,
                read: false,
            });
        }

        // 🟢 5. SUGERENCIAS INTELIGENTES basadas en patrones
        const thisMonthRecords = records.filter(r => {
            const d = new Date(r.fechaInicio + 'T12:00:00');
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        if (thisMonthRecords.length > 15) {
            newNotifications.push({
                id: `high-volume-${currentMonth}-${currentYear}`,
                type: 'info',
                priority: 3,
                category: 'suggestion',
                title: 'Alto Volumen',
                message: `Se han registrado ${thisMonthRecords.length} decretos este mes. Considera revisar el dashboard para análisis.`,
                timestamp: now,
                read: false,
            });
        }

        // 💡 6. SUGERENCIA: Empleados sin registros recientes
        const activeRuts = new Set(records.filter(r => {
            const d = new Date(r.fechaInicio + 'T12:00:00');
            return d.getFullYear() === currentYear;
        }).map(r => r.rut));

        const inactiveEmployees = employees.filter(e => !activeRuts.has(e.rut));
        if (inactiveEmployees.length > 0 && employees.length > 3) {
            newNotifications.push({
                id: `inactive-employees-${currentYear}`,
                type: 'info',
                priority: 3,
                category: 'suggestion',
                title: 'Funcionarios sin actividad',
                message: `${inactiveEmployees.length} funcionario(s) sin registros este año`,
                timestamp: now,
                read: false,
            });
        }

        return newNotifications;
    }, [records, employees]);

    // Calcular y actualizar notificaciones
    useEffect(() => {
        const alerts = generateSmartAlerts();

        setNotifications(prev => {
            const prevMap = new Map(prev.map(n => [n.id, n]));
            const merged = alerts.map(alert => ({
                ...alert,
                read: readIdsRef.current.has(alert.id) || (prevMap.get(alert.id)?.read ?? false)
            }));

            const combined = merged
                .sort((a, b) => a.priority - b.priority || b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, 50);

            const hasUnread = combined.some(n => !n.read);
            setHasNewNotifications(hasUnread);

            // Bounce the bell when new critical notifications appear
            if (hasUnread && combined.some(n => !n.read && (n.type === 'critical' || n.type === 'warning'))) {
                setBellBounce(true);
                setTimeout(() => setBellBounce(false), 1500);
            }

            return combined;
        });
    }, [generateSmartAlerts]);

    // Filtrar notificaciones
    const filteredNotifications = useMemo(() => {
        switch (filter) {
            case 'unread':
                return notifications.filter(n => !n.read);
            case 'critical':
                return notifications.filter(n => n.type === 'critical' || n.type === 'warning');
            default:
                return notifications;
        }
    }, [notifications, filter]);

    // Agrupar notificaciones por categoría
    const groupedNotifications = useMemo(() => {
        const groups: Record<string, Notification[]> = {};
        filteredNotifications.forEach(n => {
            if (!groups[n.category]) groups[n.category] = [];
            groups[n.category].push(n);
        });
        return groups;
    }, [filteredNotifications]);

    // Summary stats
    const stats = useMemo(() => {
        const critical = notifications.filter(n => n.type === 'critical' && !n.read).length;
        const warning = notifications.filter(n => n.type === 'warning' && !n.read).length;
        const info = notifications.filter(n => (n.type === 'info' || n.type === 'success') && !n.read).length;
        return { critical, warning, info, total: critical + warning + info };
    }, [notifications]);

    const markAsRead = useCallback((id: string) => {
        readIdsRef.current.add(id);
        saveReadIds(readIdsRef.current);
        setNotifications(prev => {
            const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
            setHasNewNotifications(updated.some(n => !n.read));
            return updated;
        });
    }, []);

    const markAllAsRead = useCallback(() => {
        notifications.forEach(n => readIdsRef.current.add(n.id));
        saveReadIds(readIdsRef.current);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setHasNewNotifications(false);
    }, [notifications]);

    const clearAll = useCallback(() => {
        setNotifications([]);
        setHasNewNotifications(false);
    }, []);

    const handleNotificationClick = useCallback((notification: Notification) => {
        markAsRead(notification.id);
        if (notification.data?.employeeRut && onViewEmployee) {
            onViewEmployee(notification.data.employeeRut);
            handleClose();
        }
    }, [markAsRead, onViewEmployee]);

    const handleClose = useCallback(() => {
        setIsAnimatingOut(true);
        setTimeout(() => {
            setIsOpen(false);
            setIsAnimatingOut(false);
        }, 250);
    }, []);

    const handleOpen = useCallback(() => {
        setIsOpen(true);
        setHasNewNotifications(false);
    }, []);

    const toggleCategory = useCallback((cat: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;
    const criticalCount = notifications.filter(n => n.type === 'critical' && !n.read).length;

    const getNotificationIcon = (notification: Notification) => {
        switch (notification.type) {
            case 'critical':
                return <AlertCircle className="w-4 h-4" />;
            case 'warning':
                return <AlertTriangle className="w-4 h-4" />;
            case 'success':
                return <CheckCircle className="w-4 h-4" />;
            default:
                return <Info className="w-4 h-4" />;
        }
    };

    const getNotificationStyle = (notification: Notification, isRead: boolean) => {
        if (isRead) {
            return 'bg-slate-50/60 dark:bg-slate-700/20 opacity-70';
        }
        switch (notification.type) {
            case 'critical':
                return 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-l-[3px] border-l-red-500';
            case 'warning':
                return 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-l-[3px] border-l-amber-500';
            case 'success':
                return 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-l-[3px] border-l-emerald-500';
            default:
                return 'bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 border-l-[3px] border-l-blue-500';
        }
    };

    const getIconStyle = (notification: Notification) => {
        switch (notification.type) {
            case 'critical':
                return 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400';
            case 'warning':
                return 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400';
            case 'success':
                return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400';
            default:
                return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';
        }
    };

    const categoryOrder = ['saldo', 'deadline', 'info', 'suggestion'];

    return (
        <>
            {/* Bell Button - Unified subtle style */}
            <button
                onClick={handleOpen}
                className={`relative p-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ${bellBounce ? 'notification-bell-ring' : ''}`}
                title="Notificaciones"
                aria-label={`Notificaciones: ${unreadCount} sin leer`}
            >
                <Bell className="w-5 h-5" />

                {/* Badge - Subtle and minimal */}
                {unreadCount > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 text-[9px] font-semibold rounded-full flex items-center justify-center ${
                        criticalCount > 0
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-500 dark:bg-slate-400 text-white dark:text-slate-900'
                    }`}>
                        {unreadCount > 99 ? '99' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Panel */}
            {isOpen && (
                <div
                    className={`fixed inset-0 z-[200] flex items-start justify-end p-4 sm:p-6 ${isAnimatingOut ? 'notification-backdrop-exit' : 'notification-backdrop-enter'}`}
                    onClick={handleClose}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" />

                    {/* Panel */}
                    <div
                        ref={panelRef}
                        className={`relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden mt-14 sm:mt-18 flex flex-col max-h-[85vh] ${isAnimatingOut ? 'notification-panel-exit' : 'notification-panel-enter'}`}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header - Glassmorphism Premium */}
                        <div className="relative overflow-hidden">
                            {/* Background gradient */}
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950" />
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent" />

                            <div className="relative p-5 text-white">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-white/10 backdrop-blur rounded-xl ring-1 ring-white/20">
                                            <BellRing className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black uppercase tracking-wider">Centro de Alertas</h3>
                                            <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mt-0.5">
                                                {stats.total > 0
                                                    ? `${stats.total} pendiente${stats.total > 1 ? 's' : ''}`
                                                    : 'Todo al día'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleClose}
                                        className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-90"
                                        aria-label="Cerrar notificaciones"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Quick summary pills */}
                                {stats.total > 0 && (
                                    <div className="flex gap-2 mb-4">
                                        {stats.critical > 0 && (
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 text-red-200 rounded-lg text-[10px] font-black uppercase tracking-wider ring-1 ring-red-500/30">
                                                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                                                {stats.critical} crítica{stats.critical > 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {stats.warning > 0 && (
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-200 rounded-lg text-[10px] font-black uppercase tracking-wider ring-1 ring-amber-500/30">
                                                {stats.warning} aviso{stats.warning > 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {stats.info > 0 && (
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 text-blue-200 rounded-lg text-[10px] font-black uppercase tracking-wider ring-1 ring-blue-500/30">
                                                {stats.info} info
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Filter tabs */}
                                <div className="flex gap-1.5 bg-white/5 rounded-xl p-1">
                                    {[
                                        { id: 'all' as const, label: 'Todas', count: notifications.length },
                                        { id: 'unread' as const, label: 'Sin leer', count: unreadCount },
                                        { id: 'critical' as const, label: 'Urgentes', count: notifications.filter(n => n.type === 'critical' || n.type === 'warning').length },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setFilter(tab.id)}
                                            className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filter === tab.id
                                                ? 'bg-white text-slate-900 shadow-lg'
                                                : 'text-white/60 hover:text-white hover:bg-white/10'
                                                }`}
                                        >
                                            {tab.label}
                                            {tab.count > 0 && (
                                                <span className={`ml-1 text-[9px] ${filter === tab.id ? 'text-slate-500' : 'text-white/40'}`}>
                                                    {tab.count}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions bar */}
                        {notifications.length > 0 && (
                            <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    {filteredNotifications.length} notificación{filteredNotifications.length !== 1 ? 'es' : ''}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={markAllAsRead}
                                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                    >
                                        <Eye className="w-3 h-3" />
                                        Leer todas
                                    </button>
                                    <button
                                        onClick={clearAll}
                                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                        <Archive className="w-3 h-3" />
                                        Limpiar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Notifications List - Grouped by category */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {filteredNotifications.length > 0 ? (
                                <div className="p-3 space-y-3">
                                    {categoryOrder.map(cat => {
                                        const items = groupedNotifications[cat];
                                        if (!items?.length) return null;
                                        const meta = CATEGORY_META[cat];
                                        const isExpanded = expandedCategories.has(cat);
                                        const unreadInGroup = items.filter(n => !n.read).length;

                                        return (
                                            <div key={cat} className="notification-group-enter">
                                                {/* Category header */}
                                                <button
                                                    onClick={() => toggleCategory(cat)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-700/30 transition-all group"
                                                >
                                                    <div className={`p-1.5 rounded-lg bg-gradient-to-r ${meta.gradient} text-white`}>
                                                        {meta.icon}
                                                    </div>
                                                    <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                                        {meta.label}
                                                    </span>
                                                    {unreadInGroup > 0 && (
                                                        <span className="text-[9px] font-black text-white bg-slate-400 dark:bg-slate-600 px-1.5 py-0.5 rounded-full">
                                                            {unreadInGroup}
                                                        </span>
                                                    )}
                                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 ml-auto mr-1">
                                                        {items.length}
                                                    </span>
                                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                                                </button>

                                                {/* Items */}
                                                {isExpanded && (
                                                    <div className="space-y-1.5 mt-1 ml-2">
                                                        {items.map((notification, idx) => (
                                                            <div
                                                                key={notification.id}
                                                                onClick={() => handleNotificationClick(notification)}
                                                                className={`group/item p-3.5 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] ${getNotificationStyle(notification, notification.read)}`}
                                                                style={{ animationDelay: `${idx * 50}ms` }}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <div className={`p-2 rounded-xl shrink-0 ${getIconStyle(notification)} transition-transform group-hover/item:scale-110`}>
                                                                        {getNotificationIcon(notification)}
                                                                    </div>

                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <p className={`text-[11px] font-black uppercase tracking-wider leading-tight ${notification.read
                                                                                ? 'text-slate-400 dark:text-slate-500'
                                                                                : notification.type === 'critical'
                                                                                    ? 'text-red-700 dark:text-red-300'
                                                                                    : notification.type === 'warning'
                                                                                        ? 'text-amber-700 dark:text-amber-300'
                                                                                        : 'text-blue-700 dark:text-blue-300'
                                                                                }`}>
                                                                                {notification.title}
                                                                            </p>
                                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                                {!notification.read && (
                                                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${notification.type === 'critical'
                                                                                        ? 'bg-red-500 animate-pulse'
                                                                                        : notification.type === 'warning'
                                                                                            ? 'bg-amber-500'
                                                                                            : 'bg-blue-500'
                                                                                        }`} />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                                                            {notification.message}
                                                                        </p>
                                                                        <div className="flex items-center gap-2 mt-2">
                                                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                                                {getRelativeTime(notification.timestamp)}
                                                                            </span>
                                                                            {notification.data?.employeeName && (
                                                                                <>
                                                                                    <span className="w-0.5 h-0.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
                                                                                    <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1 group-hover/item:underline">
                                                                                        <User className="w-2.5 h-2.5" />
                                                                                        Ver funcionario
                                                                                        <ChevronRight className="w-2.5 h-2.5 transition-transform group-hover/item:translate-x-0.5" />
                                                                                    </span>
                                                                                </>
                                                                            )}
                                                                            {notification.data?.saldo !== undefined && (
                                                                                <>
                                                                                    <span className="w-0.5 h-0.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
                                                                                    <span className={`text-[9px] font-black uppercase tracking-wider ${notification.data.saldo <= 0
                                                                                        ? 'text-red-500 dark:text-red-400'
                                                                                        : 'text-amber-500 dark:text-amber-400'
                                                                                        }`}>
                                                                                        {notification.data.saldo.toFixed(1)} días
                                                                                    </span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-20 text-center px-6">
                                    <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                                        <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                    </div>
                                    <p className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                        {filter === 'all' ? 'Sin notificaciones' : `Sin notificaciones ${filter === 'unread' ? 'sin leer' : 'urgentes'}`}
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-2 leading-relaxed">
                                        Te notificaremos sobre saldos bajos,<br />fechas importantes y actividad
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer - Enhanced */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/80 to-white/80 dark:from-slate-800/50 dark:to-slate-800/30 backdrop-blur-sm">
                            <div className="flex items-center justify-center gap-5 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-gradient-to-r from-red-500 to-rose-500 rounded-full" />
                                    Crítico
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" />
                                    Aviso
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full" />
                                    Info
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full" />
                                    OK
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default NotificationCenter;
