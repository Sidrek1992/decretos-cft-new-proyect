import React, { useMemo, useState, useEffect } from 'react';
import { Sparkles, X, Shield, TrendingUp, Clock } from 'lucide-react';

interface WelcomeBannerProps {
    userName?: string;
    totalRecords: number;
    totalEmployees: number;
    criticalAlerts: number;
    onClickDecrees?: () => void;
    onClickEmployees?: () => void;
    onClickUrgent?: () => void;
    // Sync status
    isSyncing?: boolean;
    isOnline?: boolean;
    lastSync?: Date | null;
    syncStatusDotClass?: string;
}

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
    userName,
    totalRecords,
    totalEmployees,
    criticalAlerts,
    onClickDecrees,
    onClickEmployees,
    onClickUrgent,
    isSyncing = false,
    isOnline = true,
    lastSync,
    syncStatusDotClass = 'bg-emerald-500',
}) => {
    const [isDismissed, setIsDismissed] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [currentTime, setCurrentTime] = useState(() => new Date());

    // Check if already dismissed today
    useEffect(() => {
        const key = `gdp-banner-dismissed-${new Date().toDateString()}`;
        if (localStorage.getItem(key)) {
            setIsDismissed(true);
        }
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setCurrentTime(new Date());
        }, 60_000);

        return () => window.clearInterval(timer);
    }, []);

    const dismiss = () => {
        setIsAnimating(true);
        const key = `gdp-banner-dismissed-${new Date().toDateString()}`;
        localStorage.setItem(key, 'true');
        setTimeout(() => setIsDismissed(true), 300);
    };

    const greeting = useMemo(() => {
        const hour = currentTime.getHours();
        if (hour < 12) return 'Buenos días';
        if (hour < 20) return 'Buenas tardes';
        return 'Buenas noches';
    }, [currentTime]);

    const todayStr = useMemo(() => {
        return currentTime.toLocaleDateString('es-CL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }, [currentTime]);

    const displayName = userName?.trim() || null;

    if (isDismissed) return null;

    return (
        <div className={`relative overflow-hidden rounded-2xl p-5 glass-card page-fade-in ${isAnimating ? 'toast-exit' : ''}`}>
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 dark:from-indigo-500/10 dark:via-purple-500/5 dark:to-transparent" />
            <div className="absolute inset-0 border border-indigo-100/50 dark:border-indigo-800/30 rounded-2xl" />

            <div className="relative flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        <span className="text-[10px] font-black text-indigo-500/70 dark:text-indigo-400/70 uppercase tracking-widest">
                            {todayStr}
                        </span>
                        {/* Sync status inline */}
                        <span className="text-slate-400 dark:text-slate-500">·</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'} ${isSyncing ? 'animate-pulse' : ''}`} />
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            {isSyncing ? 'Sincronizando...' : isOnline ? 'Conectado' : 'Sin conexión'}
                            {lastSync && !isSyncing && (
                                <span className="text-slate-500 dark:text-slate-400">
                                    {' · '}{new Date(lastSync).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white tracking-tight">
                        {greeting}{displayName ? `, ${displayName}` : ''}
                    </h2>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-lg">
                        {criticalAlerts > 0
                            ? `Tienes ${criticalAlerts} alerta${criticalAlerts > 1 ? 's' : ''} que requiere${criticalAlerts > 1 ? 'n' : ''} atención.`
                            : 'Todo en orden. Los saldos y registros están actualizados.'
                        }
                    </p>

                    {/* Quick stats pills */}
                    <div className="flex flex-wrap gap-2 mt-3">
                        <button
                            type="button"
                            onClick={onClickDecrees}
                            title="Ver decretos"
                            aria-label="Ver decretos"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                        >
                            <TrendingUp className="w-3 h-3 text-indigo-500" />
                            {totalRecords} decretos
                        </button>
                        <button
                            type="button"
                            onClick={onClickEmployees}
                            title="Ver funcionarios"
                            aria-label="Ver funcionarios"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                        >
                            <Shield className="w-3 h-3 text-emerald-500" />
                            {totalEmployees} funcionarios
                        </button>
                        {criticalAlerts > 0 && (
                            <button
                                type="button"
                                onClick={onClickUrgent}
                                title="Ver alertas urgentes"
                                aria-label="Ver alertas urgentes"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50 rounded-lg text-[10px] font-bold text-red-600 dark:text-red-400 hover:bg-red-100/70 dark:hover:bg-red-900/30 transition-colors"
                            >
                                <Clock className="w-3 h-3" />
                                {criticalAlerts} urgente{criticalAlerts > 1 ? 's' : ''}
                            </button>
                        )}
                    </div>
                </div>

                <button
                    onClick={dismiss}
                    className="p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                    aria-label="Cerrar banner"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default WelcomeBanner;
