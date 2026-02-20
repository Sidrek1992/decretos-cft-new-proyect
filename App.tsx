
import React, { useState, useMemo, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import PermitForm from './components/PermitForm';
import PermitTable from './components/PermitTable';
import StatsCards from './components/StatsCards';
import ErrorBoundary from './components/ErrorBoundary';
import NotificationCenter from './components/NotificationCenter';
import ConfirmModal from './components/ConfirmModal';
import LoginPage from './components/LoginPage';
import AdminPanel from './components/AdminPanel';
import CommandPalette from './components/CommandPalette';
import ScrollToTop from './components/ScrollToTop';
import WelcomeBanner from './components/WelcomeBanner';
import OperationalOverview from './components/OperationalOverview';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Lazy load heavy modals for better initial performance
const EmployeeManagement = lazy(() => import('./components/EmployeeManagement'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const LowBalanceModal = lazy(() => import('./components/LowBalanceModal'));
const DecreeBookModal = lazy(() => import('./components/DecreeBookModal'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const ThemeSelector = lazy(() => import('./components/ThemeSelector'));

// Loading fallback component
const ModalLoader = () => (
  <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/50 backdrop-blur-md notification-backdrop-enter">
    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl page-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg">
        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
      </div>
      <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-4 text-center">Cargando</p>
      <div className="flex justify-center gap-1.5 mt-2">
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full loading-dot" />
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full loading-dot" />
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full loading-dot" />
      </div>
    </div>
  </div>
);
import { ToastContainer, useToast } from './components/Toast';
import { useKeyboardShortcuts, ShortcutsHelpModal } from './hooks/useKeyboardShortcuts';
import { ThemeProvider } from './hooks/useTheme';
import { useModals } from './hooks/useModals';
import { PermitRecord, PermitFormData, SolicitudType, Employee } from './types';
import { exportToExcel } from './services/excelExport';
import { useCloudSync } from './hooks/useCloudSync';
import { useEmployeeSync } from './hooks/useEmployeeSync';
import { useDarkMode } from './hooks/useDarkMode';
import { calculateNextCorrelatives } from './utils/formatters';
import { getFLSaldoFinal } from './utils/flBalance';
import { appendAuditLog } from './utils/audit';
import { CONFIG } from './config';
import {
  Cloud, FileSpreadsheet, ExternalLink, RefreshCw, LayoutDashboard, BookOpen, BarChart3,
  Database, CheckCircle, Users, AlertCircle, Moon, Sun, Undo2, Keyboard, CalendarDays, Palette, Printer, LogOut, Settings,
  Menu, X, ChevronDown, ChevronRight, Zap, Shield, Eye, FileText, AlertTriangle
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE MENU COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  // Actions
  onSync: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onToggleDashboard: () => void;
  onNavigateDecretos: () => void;
  onNavigatePersonal: () => void;
  currentView: 'decretos' | 'dashboard' | 'personal';
  onOpenDecreeBook: () => void;
  onOpenCalendar: () => void;
  onOpenEmployeeList: () => void;
  onExportExcel: () => void;
  onOpenSheetPA: () => void;
  onOpenSheetFL: () => void;
  onOpenSheet2P: () => void;
  onPrint: () => void;
  onToggleDarkMode: () => void;
  isDark: boolean;
  onOpenThemeSelector: () => void;
  onOpenShortcuts: () => void;
  onOpenAdminPanel: () => void;
  onSignOut: () => void;
  // State
  isSyncing: boolean;
  syncError: boolean;
  isOnline: boolean;
  employeesCount: number;
  userEmail?: string;
  role: string;
  roleLabel: string;
  roleColors: { bg: string; text: string };
  canExportExcel: boolean;
  isAdmin: boolean;
}

const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  onSync,
  onUndo,
  canUndo,
  onToggleDashboard,
  onNavigateDecretos,
  onNavigatePersonal,
  currentView,
  onOpenDecreeBook,
  onOpenCalendar,
  onOpenEmployeeList,
  onExportExcel,
  onOpenSheetPA,
  onOpenSheetFL,
  onOpenSheet2P,
  onPrint,
  onToggleDarkMode,
  isDark,
  onOpenThemeSelector,
  onOpenShortcuts,
  onOpenAdminPanel,
  onSignOut,
  isSyncing,
  syncError,
  isOnline,
  employeesCount,
  userEmail,
  role,
  roleLabel,
  roleColors,
  canExportExcel,
  isAdmin,
}) => {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('vistas');

  const handleClose = useCallback(() => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      onClose();
      setIsAnimatingOut(false);
    }, 250);
  }, [onClose]);

  const handleAction = useCallback((action: () => void) => {
    action();
    handleClose();
  }, [handleClose]);

  if (!isOpen) return null;

  const sections = [
    {
      id: 'vistas',
      label: 'Vistas',
      icon: <Eye className="w-4 h-4" />,
      gradient: 'from-indigo-500 to-purple-500',
      items: [
        { label: 'Inicio', icon: <LayoutDashboard className="w-5 h-5" />, action: onToggleDashboard, active: currentView === 'dashboard', color: 'text-indigo-600 dark:text-indigo-400' },
        { label: 'Decretos', icon: <FileText className="w-5 h-5" />, action: onNavigateDecretos, active: currentView === 'decretos', color: 'text-indigo-600 dark:text-indigo-400' },
        { label: 'Personal', icon: <Users className="w-5 h-5" />, action: onNavigatePersonal, active: currentView === 'personal', color: 'text-indigo-600 dark:text-indigo-400' },
        { label: 'Libro de Decretos', icon: <BookOpen className="w-5 h-5" />, action: onOpenDecreeBook, color: 'text-amber-600 dark:text-amber-400' },
        { label: 'Calendario', icon: <CalendarDays className="w-5 h-5" />, action: onOpenCalendar, color: 'text-sky-600 dark:text-sky-400' },
      ]
    },
    {
      id: 'datos',
      label: 'Datos',
      icon: <Database className="w-4 h-4" />,
      gradient: 'from-emerald-500 to-teal-500',
      items: [
        { label: isSyncing ? 'Sincronizando...' : 'Sincronizar', icon: <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />, action: onSync, disabled: isSyncing, color: syncError ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-400' },
        ...(canUndo ? [{ label: 'Deshacer', icon: <Undo2 className="w-5 h-5" />, action: onUndo, color: 'text-amber-600 dark:text-amber-400' }] : []),
      ]
    },
    {
      id: 'exportar',
      label: 'Exportar',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      gradient: 'from-emerald-500 to-green-500',
      items: [
        { label: 'Exportar Excel', icon: <FileSpreadsheet className="w-5 h-5" />, action: onExportExcel, disabled: !canExportExcel, color: 'text-emerald-600 dark:text-emerald-400' },
        { label: 'Hoja PA (Google)', icon: <ExternalLink className="w-5 h-5" />, action: onOpenSheetPA, color: 'text-indigo-600 dark:text-indigo-400' },
        { label: 'Hoja FL (Google)', icon: <ExternalLink className="w-5 h-5" />, action: onOpenSheetFL, color: 'text-emerald-600 dark:text-emerald-400' },
        { label: 'Hoja 2P (Google)', icon: <ExternalLink className="w-5 h-5" />, action: onOpenSheet2P, color: 'text-amber-600 dark:text-amber-400' },
        { label: 'Imprimir', icon: <Printer className="w-5 h-5" />, action: onPrint, color: 'text-slate-600 dark:text-slate-400' },
      ]
    },
    {
      id: 'preferencias',
      label: 'Preferencias',
      icon: <Palette className="w-4 h-4" />,
      gradient: 'from-violet-500 to-purple-500',
      items: [
        { label: isDark ? 'Modo Claro' : 'Modo Oscuro', icon: isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />, action: onToggleDarkMode, color: 'text-amber-600 dark:text-amber-400' },
        { label: 'Personalizar Tema', icon: <Palette className="w-5 h-5" />, action: onOpenThemeSelector, color: 'text-violet-600 dark:text-violet-400' },
        { label: 'Atajos de Teclado', icon: <Keyboard className="w-5 h-5" />, action: onOpenShortcuts, color: 'text-slate-600 dark:text-slate-400' },
      ]
    },
  ];

  return (
    <div
      className={`fixed inset-0 z-[200] ${isAnimatingOut ? 'mobile-backdrop-exit' : 'mobile-backdrop-enter'}`}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />

      {/* Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col ${isAnimatingOut ? 'mobile-menu-exit' : 'mobile-menu-enter'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent" />

          <div className="relative p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Cloud className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight">GDP Cloud</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
                      {isOnline ? 'Conectado' : 'Sin conexión'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2.5 hover:bg-white/10 rounded-xl transition-all active:scale-90"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* User info */}
            <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                    <span className="text-white text-xs font-black">
                      {userEmail?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white truncate max-w-[160px]">{userEmail}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${roleColors.bg} ${roleColors.text}`}>
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sections.map((section, sectionIdx) => (
            <div key={section.id} className="menu-item-enter" style={{ animationDelay: `${sectionIdx * 50}ms` }}>
              {/* Section header */}
              <button
                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${section.gradient} text-white`}>
                    {section.icon}
                  </div>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    {section.label}
                  </span>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${expandedSection === section.id ? 'rotate-180' : ''}`} />
              </button>

              {/* Section items */}
              {expandedSection === section.id && (
                <div className="mt-1 ml-4 space-y-1">
                  {section.items.map((item, itemIdx) => (
                    <button
                      key={itemIdx}
                      onClick={() => !item.disabled && handleAction(item.action)}
                      disabled={item.disabled}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${item.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : item.active
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-200 dark:ring-indigo-800'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98]'
                        }`}
                    >
                      <span className={item.color}>{item.icon}</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
                      {item.active && (
                        <span className="ml-auto w-2 h-2 rounded-full bg-indigo-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Admin Panel - Solo para admins */}
          {isAdmin && (
            <div className="menu-item-enter" style={{ animationDelay: '200ms' }}>
              <button
                onClick={() => handleAction(onOpenAdminPanel)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all active:scale-[0.98]"
              >
                <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  <Settings className="w-4 h-4" />
                </div>
                <span className="text-sm font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                  Panel Admin
                </span>
                <ChevronRight className="w-5 h-5 text-purple-400 ml-auto" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
          <button
            onClick={() => handleAction(onSignOut)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-all active:scale-[0.98]"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-black text-sm uppercase tracking-wider">Cerrar Sesión</span>
          </button>

          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 text-center uppercase tracking-widest">
            GDP Cloud Engine 2026
          </p>
        </div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const USER_PROFILES_STORAGE_KEY = 'gdp_user_profiles';

  // ★ Autenticación y Permisos
  const { user, profile, signOut, permissions, role, roleLabel, roleColors } = useAuth();

  // Employees sincronizados con Google Sheets
  const {
    employees,
    isSyncing: isEmployeeSyncing,
    addEmployee: handleAddEmployee,
    updateEmployee: handleUpdateEmployee,
    deleteEmployee: handleDeleteEmployee,
    fetchEmployeesFromCloud,
    syncEmployeesToCloud
  } = useEmployeeSync(
    () => { }, // onSuccess silencioso para empleados
    (error) => console.warn('Error empleados:', error),
    user?.email
  );

  const {
    records,
    setRecords,
    isSyncing,
    syncError,
    lastSync,
    isOnline,
    syncWarnings,
    pendingSync,
    isRetryScheduled,
    fetchFromCloud,
    fetchModuleFromCloud,
    syncToCloud,
    undo,
    canUndo,
    moduleSync
  } = useCloudSync(
    () => toast.success('Sincronizado', 'Datos actualizados correctamente'),
    (error) => toast.error('Error de sincronización', error),
    user?.email
  );

  const [editingRecord, setEditingRecord] = useState<PermitRecord | null>(null);
  const [activeTab, setActiveTab] = useState<SolicitudType | 'ALL'>('ALL');
  const [currentView, setCurrentView] = useState<'decretos' | 'dashboard' | 'personal'>('dashboard');
  const [searchFilter, setSearchFilter] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [selectedEmployeeForForm, setSelectedEmployeeForForm] = useState<Employee | null>(null);
  const [requestedSolicitudType, setRequestedSolicitudType] = useState<SolicitudType | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auditor Data State - Ahora declarado DESPUÉS de records y employees
  const auditIssues = useMemo(() => {
    if (role !== 'admin') return [];
    try {
      const { auditRecords } = require('./utils/dataAuditor');
      return auditRecords(records || [], employees || []);
    } catch (e) {
      console.error("Auditor error:", e);
      return [];
    }
  }, [records, employees, role]);

  const criticalIssuesCount = useMemo(() =>
    Array.isArray(auditIssues) ? auditIssues.filter((i: any) => i.type === 'error').length : 0,
    [auditIssues]);

  // Hook centralizado para modales
  const { modals, openModal, closeModal } = useModals();

  const formRef = useRef<HTMLElement>(null);

  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const { toasts, toast, removeToast } = useToast();

  const lastWarningsRef = useRef('');

  useEffect(() => {
    if (syncWarnings.length === 0) return;
    const key = syncWarnings.join('|');
    if (key === lastWarningsRef.current) return;
    lastWarningsRef.current = key;
    const preview = syncWarnings.slice(0, 3).join(' · ');
    const extra = syncWarnings.length > 3 ? ` (+${syncWarnings.length - 3} más)` : '';
    toast.warning('Datos con formato inesperado', `${preview}${extra}`);
  }, [syncWarnings, toast]);

  // Correlativos independientes para PA y FL
  const nextCorrelatives = useMemo(() => {
    const year = new Date().getFullYear();
    return calculateNextCorrelatives(records, year);
  }, [records]);

  // Conteo de alertas críticas para el WelcomeBanner
  const notifications_criticalCount = useMemo(() => {
    let count = 0;
    employees.forEach(emp => {
      const paRecs = records.filter(r => r.rut === emp.rut && r.solicitudType === 'PA');
      if (paRecs.length > 0) {
        const sorted = [...paRecs].sort((a, b) => b.createdAt - a.createdAt);
        const saldo = sorted[0].diasHaber - sorted[0].cantidadDias;
        if (saldo <= 0) count++;
      }
      const flRecs = records.filter(r => r.rut === emp.rut && r.solicitudType === 'FL');
      if (flRecs.length > 0) {
        const sorted = [...flRecs].sort((a, b) => b.createdAt - a.createdAt);
        const saldoFL = getFLSaldoFinal(sorted[0], 0);
        if (saldoFL <= 0) count++;
      }
    });
    return count;
  }, [records, employees]);

  const handleSubmit = (formData: PermitFormData) => {
    const actor = user?.email || 'sistema';
    let updated: PermitRecord[];
    if (editingRecord) {
      updated = records.map(r =>
        r.id === editingRecord.id ? { ...formData, id: r.id, createdAt: r.createdAt } : r
      );
      setEditingRecord(null);
      toast.success('Decreto actualizado', `${formData.acto} modificado correctamente`);
      appendAuditLog({
        scope: 'decree',
        action: 'update_decree',
        actor,
        target: `${formData.solicitudType} ${formData.acto}`,
        target_id: editingRecord.id,
        details: `Funcionario: ${formData.funcionario}`,
        old_data: editingRecord,
        new_data: formData
      });
    } else {
      const newId = crypto.randomUUID();
      const newRecord = { ...formData, id: newId, createdAt: Date.now() };
      updated = [...records, newRecord];
      toast.success('Decreto emitido', `Resolución ${formData.acto} creada exitosamente`);
      appendAuditLog({
        scope: 'decree',
        action: 'create_decree',
        actor,
        target: `${formData.solicitudType} ${formData.acto}`,
        target_id: newId,
        details: `Funcionario: ${formData.funcionario}`,
        new_data: newRecord
      });
    }
    setRecords(updated);
    syncToCloud(updated);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
    openModal('confirmDelete');
  };

  const confirmDelete = useCallback(() => {
    if (deleteTargetId) {
      const deleted = records.find(r => r.id === deleteTargetId);
      const updated = records.filter(r => r.id !== deleteTargetId);
      setRecords(updated);
      syncToCloud(updated);
      toast.warning('Decreto eliminado', 'Puedes deshacer esta acción');
      appendAuditLog({
        scope: 'decree',
        action: 'delete_decree',
        actor: user?.email || 'sistema',
        target: deleted ? `${deleted.solicitudType} ${deleted.acto}` : deleteTargetId,
        target_id: deleteTargetId,
        details: deleted ? `Funcionario: ${deleted.funcionario}` : 'Eliminado por ID',
        old_data: deleted
      });
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, records, setRecords, syncToCloud, toast, user?.email]);

  const handleUndo = () => {
    undo();
    toast.info('Acción deshecha', 'Se restauró el estado anterior');
  };

  const handleFilterByEmployee = (funcionario: string) => {
    setSearchFilter(funcionario);
    // Scroll to table
    setTimeout(() => {
      document.querySelector('section.space-y-6')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleViewEmployeeFromNotification = (rut: string) => {
    const match = employees.find(e => e.rut === rut);
    setSearchFilter(match?.nombre || rut);
    openModal('employeeList');
  };

  const handleQuickDecree = (employee: Employee, type?: SolicitudType) => {
    // Preparar el formulario con el empleado seleccionado
    setSelectedEmployeeForForm(employee);
    if (type) {
      setRequestedSolicitudType(type);
    }
    setCurrentView('decretos'); // El formulario está en la vista de decretos
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    toast.info('Nuevo decreto', type ? `Preparando ${type === 'PA' ? 'Permiso Administrativo' : 'Feriado Legal'} para ${employee.nombre}` : `Preparando decreto para ${employee.nombre}`);
  };

  const handleViewDecreesFromWelcome = useCallback(() => {
    document.querySelector('section.space-y-6')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleViewEmployeesFromWelcome = useCallback(() => {
    openModal('employeeList');
  }, [openModal]);

  const handleViewUrgentFromWelcome = useCallback(() => {
    openModal('lowBalance');
  }, [openModal]);

  const handleExportData = useCallback(async () => {
    if (!permissions.canExportExcel) {
      toast.warning('Sin permiso', 'Tu rol no permite exportar a Excel');
      return;
    }
    const result = await exportToExcel(records);
    if (result.success) {
      toast.success('Exportado', 'Excel generado');
    } else {
      toast.error('Error', result.error || 'No se pudo exportar');
    }
  }, [permissions.canExportExcel, records, toast]);

  const handleNewDecreeFromPalette = (type?: SolicitudType) => {
    if (!permissions.canCreateDecree) {
      toast.warning('Sin permiso', 'Tu rol no permite crear decretos');
      return;
    }
    if (type) {
      setRequestedSolicitudType(type);
    }
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast.info('Nuevo decreto', type ? `Preparando ${type === 'PA' ? 'Permiso Administrativo' : 'Feriado Legal'}` : 'Preparando nuevo decreto');
  };

  const handleSelectRecordFromPalette = (record: PermitRecord) => {
    setActiveTab(record.solicitudType);
    setSearchFilter(record.acto || record.funcionario);
    setTimeout(() => {
      document.querySelector('section.space-y-6')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Atajos de teclado (memoizados para evitar re-renders)
  const shortcuts = useMemo(() => [
    { key: 'n', ctrlKey: true, action: () => formRef.current?.scrollIntoView({ behavior: 'smooth' }), description: 'Nuevo decreto' },
    { key: 's', ctrlKey: true, action: () => fetchFromCloud(), description: 'Sincronizar' },
    { key: 'e', ctrlKey: true, action: handleExportData, description: 'Exportar Excel' },
    { key: 'd', ctrlKey: true, action: toggleDarkMode, description: 'Cambiar tema' },
    { key: 'b', ctrlKey: true, action: () => openModal('decreeBook'), description: 'Libro de decretos' },
    { key: 'g', ctrlKey: true, action: () => setCurrentView(p => p === 'dashboard' ? 'decretos' : 'dashboard'), description: 'Ver gráficos' },
    { key: 'c', ctrlKey: true, action: () => openModal('calendar'), description: 'Calendario' },
    { key: 'z', ctrlKey: true, action: handleUndo, description: 'Deshacer' },
    { key: 'k', ctrlKey: true, action: () => setCommandPaletteOpen(true), description: 'Buscar comandos' },
    { key: '?', action: () => openModal('shortcuts'), description: 'Mostrar atajos' },
  ], [fetchFromCloud, handleExportData, toggleDarkMode, openModal, handleUndo]);

  useKeyboardShortcuts(shortcuts);

  const syncStatusLabel = isSyncing
    ? 'Sincronizando...'
    : !isOnline
      ? pendingSync
        ? 'Pendiente (offline)'
        : 'Offline'
      : syncError
        ? 'Error de sincronización'
        : pendingSync
          ? isRetryScheduled
            ? 'Reintentando...'
            : 'Pendiente'
          : 'Sincronizado';

  const syncStatusDotClass = isSyncing
    ? 'bg-indigo-500 animate-ping'
    : pendingSync
      ? 'bg-amber-500'
      : syncError
        ? 'bg-red-500'
        : isOnline
          ? 'bg-emerald-500'
          : 'bg-red-500';

  const welcomeUserName = useMemo(() => {
    const firstFromProfile = String(profile?.firstName || '').trim();
    const lastFromProfile = String(profile?.lastName || '').trim();
    const fullFromProfile = `${firstFromProfile} ${lastFromProfile}`.trim();
    if (fullFromProfile) return fullFromProfile;

    const metadata = user?.user_metadata as Record<string, unknown> | undefined;
    const firstFromMetadata = String(metadata?.first_name || '').trim();
    const lastFromMetadata = String(metadata?.last_name || '').trim();
    const fullFromMetadata = `${firstFromMetadata} ${lastFromMetadata}`.trim();
    if (fullFromMetadata) return fullFromMetadata;

    const email = user?.email?.toLowerCase();
    if (!email) return undefined;

    try {
      const raw = localStorage.getItem(USER_PROFILES_STORAGE_KEY);
      if (raw) {
        const profiles = JSON.parse(raw) as Record<string, { firstName?: string; lastName?: string }>;
        const localProfile = profiles[email];
        const firstName = String(localProfile?.firstName || '').trim();
        const lastName = String(localProfile?.lastName || '').trim();
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) return fullName;
      }
    } catch {
      // ignore invalid local data
    }

    return user?.email;
  }, [profile, user]);

  const shouldHideSummaryCards =
    showAdminPanel ||
    modals.employeeList ||
    modals.decreeBook ||
    modals.calendar ||
    modals.themeSelector ||
    modals.shortcuts;

  return (
    <div className="min-h-screen">
      {/* ═══════════════════════════════════════════════════════════════════════════
          HEADER MEJORADO - Diseño responsive con menú hamburguesa en móvil
          ═══════════════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-[100] w-full border-b border-slate-200/80 dark:border-white/5 bg-white/70 dark:bg-[#020617]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

          {/* ═══ LOGO Y TÍTULO ═══ */}
          <div className="flex items-center gap-3">
            {/* Logo Premium con gradiente */}
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 ${isSyncing ? 'logo-syncing' : 'shadow-indigo-200 dark:shadow-indigo-900/50'
                }`}
            >
              <Cloud className="text-white w-5 h-5" />
            </div>

            {/* Título */}
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              GDP Cloud
            </h1>
          </div>

          {/* ═══ ACCIONES ═══ */}
          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* ─── GRUPO: SYNC (visible en tablet+) ─── */}
            <div className="hidden sm:flex items-center gap-0.5">
              <button
                onClick={() => fetchFromCloud()}
                disabled={isSyncing}
                className={`p-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 ${isSyncing
                  ? 'text-slate-300 dark:text-slate-600'
                  : syncError
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                title={typeof syncError === 'string' ? syncError : 'Sincronizar datos'}
              >
                {syncError ? <AlertCircle className="w-5 h-5" /> : <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />}
              </button>
            </div>

            {/* ─── GRUPO: EXPORTAR (visible en lg+) ─── */}
            <div className="hidden lg:flex items-center gap-0.5">
              <button
                onClick={handleExportData}
                className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-all duration-200 hover:scale-105 active:scale-95"
                title="Exportar a Excel"
              >
                <FileSpreadsheet className="w-5 h-5" />
              </button>

              <button
                onClick={() => window.print()}
                className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-all duration-200 hover:scale-105 active:scale-95"
                title="Imprimir página"
              >
                <Printer className="w-5 h-5" />
              </button>
            </div>

            {/* Separador */}
            <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700" />

            {/* ─── GRUPO: PREFERENCIAS ─── */}
            <div className="flex items-center gap-1">
              {/* Dark Mode - visible en sm+ */}
              <button
                onClick={toggleDarkMode}
                className="hidden sm:flex p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-all duration-200 hover:scale-105 active:scale-95"
                title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Notificaciones */}
              <NotificationCenter
                records={records}
                employees={employees}
                onViewEmployee={handleViewEmployeeFromNotification}
              />
            </div>

            {/* Separador antes de sesión */}
            <div className="hidden md:block w-px h-8 bg-slate-200 dark:bg-slate-700" />

            {/* ─── GRUPO: SESIÓN (visible en md+) ─── */}
            <div className="hidden md:flex items-center gap-2">
              {/* Badge del rol - Premium style */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${role === 'admin' ? 'bg-purple-500' : role === 'editor' ? 'bg-amber-500' : 'bg-sky-500'
                  }`} />
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 tracking-wide">
                  {roleLabel}
                </span>
                <span className="hidden lg:block text-[10px] text-slate-400 dark:text-slate-500">
                  {user?.email?.split('@')[0]}
                </span>
              </div>

              {/* Admin Panel - Solo para admins */}
              {role === 'admin' && (
                <button
                  onClick={() => setShowAdminPanel(true)}
                  className="relative p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-all duration-200 hover:scale-105 active:scale-95"
                  title="Panel de Administración"
                >
                  <Settings className="w-5 h-5" />
                  {criticalIssuesCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse">
                      {criticalIssuesCount > 9 ? '+9' : criticalIssuesCount}
                    </span>
                  )}
                </button>
              )}

              {/* Logout */}
              <button
                onClick={() => signOut()}
                className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-all duration-200 hover:scale-105 active:scale-95"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* ─── MENÚ HAMBURGUESA (visible en móvil/tablet) ─── */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-all duration-200 hover:scale-105 active:scale-95"
              title="Menú"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress bar de sincronización */}
        {isSyncing && (
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-indigo-100 dark:bg-indigo-900/50 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-600 bg-[length:200%_100%] animate-sync-progress" />
          </div>
        )}
      </header>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onSync={() => fetchFromCloud()}
        onUndo={handleUndo}
        canUndo={canUndo}
        onToggleDashboard={() => setCurrentView('dashboard')}
        onNavigateDecretos={() => setCurrentView('decretos')}
        onNavigatePersonal={() => setCurrentView('personal')}
        currentView={currentView}
        onOpenDecreeBook={() => openModal('decreeBook')}
        onOpenCalendar={() => openModal('calendar')}
        onOpenEmployeeList={() => openModal('employeeList')}
        onExportExcel={handleExportData}
        onOpenSheetPA={() => window.open(`https://docs.google.com/spreadsheets/d/${CONFIG.DECRETOS_SHEET_ID}`, '_blank')}
        onOpenSheetFL={() => window.open(`https://docs.google.com/spreadsheets/d/${CONFIG.FERIADOS_SHEET_ID}`, '_blank')}
        onOpenSheet2P={() => window.open(`https://docs.google.com/spreadsheets/d/${CONFIG.FERIADOS_2P_SHEET_ID}`, '_blank')}
        onPrint={() => window.print()}
        onToggleDarkMode={toggleDarkMode}
        isDark={isDark}
        onOpenThemeSelector={() => openModal('themeSelector')}
        onOpenShortcuts={() => openModal('shortcuts')}
        onOpenAdminPanel={() => setShowAdminPanel(true)}
        onSignOut={() => signOut()}
        isSyncing={isSyncing}
        syncError={syncError}
        isOnline={isOnline}
        employeesCount={employees.length}
        userEmail={user?.email}
        role={role}
        roleLabel={roleLabel}
        roleColors={roleColors}
        canExportExcel={permissions.canExportExcel}
        isAdmin={role === 'admin'}
      />

      {/* Main Content */}
      <main className="w-full lg:max-w-full lg:px-2 px-4 sm:px-6 pt-8 sm:pt-10 pb-0 page-fade-in">
        <div className="lg:grid lg:grid-cols-[170px_minmax(0,1fr)] lg:gap-4">
          {/* Panel vertical izquierdo (desktop) */}
          <aside className="hidden lg:block w-[170px] shrink-0">
            <div className="sticky top-24">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Navegación</p>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mt-1">Panel principal</h3>
                </div>

                <div className="p-1.5 space-y-1.5">
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all duration-200 ${currentView === 'dashboard'
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                      }`}
                  >
                    <div className={`p-1.5 rounded-lg ${currentView === 'dashboard' ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                      <LayoutDashboard className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide leading-tight">Inicio</p>
                      <p className="text-[10px] opacity-70 leading-tight">Resumen y Analítica</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setCurrentView('decretos')}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all duration-200 ${currentView === 'decretos'
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                      }`}
                  >
                    <div className={`p-1.5 rounded-lg ${currentView === 'decretos' ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide leading-tight">Decretos</p>
                      <p className="text-[10px] opacity-70 leading-tight">Emisión y Registro</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setCurrentView('personal')}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all duration-200 ${currentView === 'personal'
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                      }`}
                  >
                    <div className={`p-1.5 rounded-lg ${currentView === 'personal' ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black uppercase tracking-wide leading-tight">Personal</p>
                      <p className="text-[10px] opacity-70 leading-tight">Funcionarios</p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600">
                      {employees.length}
                    </span>
                  </button>

                  <button
                    onClick={() => openModal('decreeBook')}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all duration-200 ${modals.decreeBook
                      ? 'bg-amber-50 dark:bg-amber-900/25 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                      }`}
                  >
                    <div className={`p-1.5 rounded-lg ${modals.decreeBook ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide leading-tight">Libro de decretos</p>
                      <p className="text-[10px] opacity-70 leading-tight">Historial institucional</p>
                    </div>
                  </button>

                  <button
                    onClick={() => openModal('calendar')}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all duration-200 ${modals.calendar
                      ? 'bg-sky-50 dark:bg-sky-900/25 text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                      }`}
                  >
                    <div className={`p-1.5 rounded-lg ${modals.calendar ? 'bg-sky-100 dark:bg-sky-900/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide leading-tight">Calendario</p>
                      <p className="text-[10px] opacity-70 leading-tight">Ausencias y programación</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-8 sm:space-y-10 min-w-0">
            {currentView === 'dashboard' && (
              <>
                <WelcomeBanner
                  userName={welcomeUserName}
                  totalRecords={records.length}
                  totalEmployees={employees.length}
                  criticalAlerts={notifications_criticalCount}
                  onClickDecrees={handleViewDecreesFromWelcome}
                  onClickEmployees={handleViewEmployeesFromWelcome}
                  onClickUrgent={handleViewUrgentFromWelcome}
                  isSyncing={isSyncing}
                  isOnline={isOnline}
                  lastSync={lastSync}
                  syncStatusDotClass={syncStatusDotClass}
                />

                <OperationalOverview records={records} variant="compact" />
              </>
            )}

            {currentView === 'decretos' && !shouldHideSummaryCards && (
              <>
                <StatsCards records={records} totalDatabaseEmployees={employees.length} employees={employees} />
              </>
            )}

            {/* Dashboard condicional (lazy loaded) */}
            {currentView === 'dashboard' && (
              <Suspense fallback={<ModalLoader />}>
                <Dashboard
                  records={records}
                  employees={employees}
                />
              </Suspense>
            )}

            {/* Gestión de Personal (NUEVA PESTAÑA) */}
            {currentView === 'personal' && (
              <Suspense fallback={<ModalLoader />}>
                <EmployeeManagement
                  employees={employees}
                  records={records}
                  onAddEmployee={permissions.canManageEmployees ? handleAddEmployee : undefined}
                  onUpdateEmployee={permissions.canManageEmployees ? handleUpdateEmployee : undefined}
                  onDeleteEmployee={permissions.canManageEmployees ? handleDeleteEmployee : undefined}
                  onFilterByEmployee={(nombre) => {
                    setCurrentView('decretos');
                    setSearchFilter(nombre);
                  }}
                  onQuickDecree={(emp) => {
                    setCurrentView('decretos');
                    // El formulario se desplazará automáticamente o podemos forzarlo
                    // handleQuickDecree ya pone el funcionario si existiera pero aquí simplemente cambiamos de vista
                    setSearchFilter(emp.nombre);
                  }}
                />
              </Suspense>
            )}

            {currentView === 'decretos' && (
              <div className="space-y-10 sm:space-y-12">
                {/* Formulario - Solo para administradores */}
                {permissions.canCreateDecree && (
                  <section ref={formRef}>
                    <PermitForm
                      onSubmit={handleSubmit}
                      editingRecord={editingRecord}
                      onCancelEdit={() => setEditingRecord(null)}
                      nextCorrelatives={nextCorrelatives}
                      employees={employees}
                      records={records}
                      requestedSolicitudType={requestedSolicitudType}
                      onRequestedSolicitudTypeHandled={() => setRequestedSolicitudType(null)}
                      initialEmployee={selectedEmployeeForForm}
                      onInitialEmployeeHandled={() => setSelectedEmployeeForForm(null)}
                    />
                  </section>
                )}

                {/* Mensaje para lectores */}
                {!permissions.canCreateDecree && (
                  <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${roleColors.bg} ${roleColors.text}`}>
                        {roleLabel}
                      </div>
                      <p className="text-sm text-sky-700 dark:text-sky-300">
                        Tu rol es de <strong>lectura</strong>. Puedes consultar los registros y generar documentos PDF, pero no crear ni modificar decretos.
                      </p>
                    </div>
                  </div>
                )}

                {/* Tabla */}
                <section className="space-y-6 sm:space-y-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/50">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                          Registro de Decretos
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Historial Institucional
                          </span>
                          {lastSync && !isSyncing && (
                            <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 rounded-full text-[8px] font-black uppercase tracking-tighter">
                              <CheckCircle className="w-2.5 h-2.5" /> Sincronizado
                            </span>
                          )}
                        </div>
                        <div className="mt-1 hidden sm:flex items-center gap-2">
                          {(['PA', 'FL'] as const).map((module) => (
                            <button
                              key={module}
                              onClick={() => fetchModuleFromCloud(module)}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-colors ${moduleSync[module].status === 'error'
                                ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                                : moduleSync[module].status === 'syncing'
                                  ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                }`}
                              title={moduleSync[module].lastError || `Reintentar sincronización ${module}`}
                            >
                              {module} {moduleSync[module].status === 'syncing' ? '...' : 'sync'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Tabs de filtro */}
                    <div className="flex bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur p-1.5 rounded-2xl gap-1 border border-slate-200/50 dark:border-slate-700 shadow-inner w-full sm:w-auto">
                      {(['ALL', 'PA', 'FL'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`flex-1 sm:flex-none px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black tracking-wider sm:tracking-widest transition-all duration-300 uppercase ${activeTab === tab
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-600'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                        >
                          {tab === 'ALL' ? 'Todos' : tab === 'PA' ? 'Permisos' : 'Feriados'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <PermitTable
                    data={records}
                    activeTab={activeTab}
                    onDelete={handleDelete}
                    onEdit={setEditingRecord}
                    searchTerm={searchFilter}
                    onSearchTermChange={setSearchFilter}
                    canEdit={permissions.canEditDecree}
                    canDelete={permissions.canDeleteDecree}
                  />
                </section>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modales eliminados o mantenidos */}


      {/* Modal saldo bajo (lazy loaded) */}
      {modals.lowBalance && (
        <Suspense fallback={<ModalLoader />}>
          <LowBalanceModal
            isOpen={modals.lowBalance}
            onClose={() => closeModal('lowBalance')}
            records={records}
          />
        </Suspense>
      )}

      {/* Modal libro de decretos (lazy loaded) */}
      {modals.decreeBook && (
        <Suspense fallback={<ModalLoader />}>
          <DecreeBookModal
            isOpen={modals.decreeBook}
            onClose={() => closeModal('decreeBook')}
            records={records}
          />
        </Suspense>
      )}

      {/* Modal atajos de teclado */}
      <ShortcutsHelpModal
        isOpen={modals.shortcuts}
        onClose={() => closeModal('shortcuts')}
        shortcuts={shortcuts}
      />

      {/* Vista de Calendario (lazy loaded) */}
      {modals.calendar && (
        <Suspense fallback={<ModalLoader />}>
          <CalendarView
            isOpen={modals.calendar}
            onClose={() => closeModal('calendar')}
            records={records}
            employees={employees}
          />
        </Suspense>
      )}

      {/* Modal de confirmación de eliminación */}
      <ConfirmModal
        isOpen={modals.confirmDelete}
        onClose={() => {
          closeModal('confirmDelete');
          setDeleteTargetId(null);
        }}
        onConfirm={confirmDelete}
        title="Eliminar decreto"
        message="¿Estás seguro de que deseas eliminar este decreto? Esta acción se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* ★ Panel de Administración */}
      <AdminPanel
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        records={records}
        employees={employees}
        onSelectRecord={(record) => {
          setEditingRecord(record);
          setCurrentView('decretos');
          setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        records={records}
        employees={employees}
        onNavigate={(view) => {
          if (view === 'dashboard') {
            setCurrentView('dashboard');
          } else if (view === 'personal') {
            setCurrentView('personal');
          } else if (view === 'calendar') {
            openModal('calendar');
          } else if (view === 'settings') {
            if (role === 'admin') {
              setShowAdminPanel(true);
            } else {
              openModal('themeSelector');
            }
          }
        }}
        onNewDecree={handleNewDecreeFromPalette}
        onSelectEmployee={(employee) => handleFilterByEmployee(employee.nombre)}
        onSelectRecord={handleSelectRecordFromPalette}
        onExportData={handleExportData}
      />

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-6 border-t border-slate-200 dark:border-slate-700 mt-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-8 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            <span className="text-[10px] sm:text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em]">
              GDP Cloud Engine 2026
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <button
              onClick={() => openModal('shortcuts')}
              className="hidden sm:flex items-center gap-1.5 text-[9px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-wider"
            >
              <Keyboard className="w-3 h-3" aria-hidden="true" /> Atajos
            </button>
            <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em] sm:tracking-[0.2em] text-center leading-relaxed">
              Herramienta Desarrollada para Gestión de Personas por Maximiliano Guzmán
            </p>
          </div>
        </div>
      </footer>

      {/* Selector de Tema (lazy loaded) */}
      {modals.themeSelector && (
        <Suspense fallback={<ModalLoader />}>
          <ThemeSelector
            isOpen={modals.themeSelector}
            onClose={() => closeModal('themeSelector')}
          />
        </Suspense>
      )}

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Scroll to Top */}
      <ScrollToTop />
    </div>
  );
};

// ★ Componente que maneja la autenticación
const AuthenticatedApp: React.FC = () => {
  const { user, loading } = useAuth();

  // Mostrar loader mientras se verifica la sesión
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center page-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-xl shadow-indigo-200 dark:shadow-indigo-900/50">
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
          </div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-4">Verificando sesión</p>
          <div className="flex justify-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full loading-dot" />
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full loading-dot" />
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full loading-dot" />
          </div>
        </div>
      </div>
    );
  }

  // Mostrar login si no hay usuario
  if (!user) {
    return <LoginPage />;
  }

  // Usuario autenticado, mostrar la app
  return <AppContent />;
};

// Wrapper con ErrorBoundary, ThemeProvider y AuthProvider
const App: React.FC = () => (
  <ThemeProvider>
    <ErrorBoundary>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </ErrorBoundary>
  </ThemeProvider>
);

export default App;
