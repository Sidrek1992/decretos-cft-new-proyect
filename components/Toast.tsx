import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastProps {
    toast: ToastMessage;
    onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = React.memo(({ toast, onRemove }) => {
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const startTimeRef = useRef(Date.now());
    const durationRef = useRef(toast.duration || 4000);
    const animRef = useRef<number>(0);

    useEffect(() => {
        const duration = durationRef.current;
        const start = startTimeRef.current;

        const tick = () => {
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);

            if (remaining > 0) {
                animRef.current = requestAnimationFrame(tick);
            } else {
                setIsExiting(true);
                setTimeout(() => onRemove(toast.id), 350);
            }
        };

        animRef.current = requestAnimationFrame(tick);

        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [toast, onRemove]);

    const handleClose = useCallback(() => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 350);
    }, [toast.id, onRemove]);

    const icons = {
        success: CheckCircle,
        error: XCircle,
        warning: AlertTriangle,
        info: Info
    };

    const styles = {
        success: 'bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800',
        error: 'bg-white dark:bg-slate-800 border-red-200 dark:border-red-800',
        warning: 'bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-800',
        info: 'bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800'
    };

    const iconBgStyles = {
        success: 'bg-emerald-50 dark:bg-emerald-900/30',
        error: 'bg-red-50 dark:bg-red-900/30',
        warning: 'bg-amber-50 dark:bg-amber-900/30',
        info: 'bg-blue-50 dark:bg-blue-900/30'
    };

    const iconStyles = {
        success: 'text-emerald-600 dark:text-emerald-400',
        error: 'text-red-600 dark:text-red-400',
        warning: 'text-amber-600 dark:text-amber-400',
        info: 'text-blue-600 dark:text-blue-400'
    };

    const titleStyles = {
        success: 'text-emerald-800 dark:text-emerald-200',
        error: 'text-red-800 dark:text-red-200',
        warning: 'text-amber-800 dark:text-amber-200',
        info: 'text-blue-800 dark:text-blue-200'
    };

    const progressStyles = {
        success: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
        error: 'bg-gradient-to-r from-red-400 to-red-600',
        warning: 'bg-gradient-to-r from-amber-400 to-amber-600',
        info: 'bg-gradient-to-r from-blue-400 to-blue-600'
    };

    const Icon = icons[toast.type];

    return (
        <div
            role="alert"
            className={`
                relative overflow-hidden rounded-2xl border shadow-xl backdrop-blur-sm
                ${styles[toast.type]}
                ${isExiting ? 'toast-exit' : 'toast-enter'}
            `}
        >
            {/* Main content */}
            <div className="flex items-start gap-3 p-4">
                <div className={`p-2 rounded-xl shrink-0 ${iconBgStyles[toast.type]}`}>
                    <Icon className={`w-4 h-4 ${iconStyles[toast.type]}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${titleStyles[toast.type]}`}>
                        {toast.title}
                    </p>
                    {toast.message && (
                        <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400 leading-relaxed">
                            {toast.message}
                        </p>
                    )}
                </div>
                <button
                    onClick={handleClose}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 -mt-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    aria-label="Cerrar notificación"
                >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
            </div>

            {/* Progress bar */}
            <div className="h-[2px] bg-slate-100 dark:bg-slate-700">
                <div
                    className={`h-full transition-none ${progressStyles[toast.type]}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
});

Toast.displayName = 'Toast';

// Container de Toasts
interface ToastContainerProps {
    toasts: ToastMessage[];
    onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = React.memo(({ toasts, onRemove }) => {
    return (
        <div
            className="fixed bottom-6 right-6 z-[300] flex flex-col-reverse gap-3 max-w-sm w-full pointer-events-none"
            role="region"
            aria-label="Notificaciones"
            aria-live="polite"
        >
            {toasts.slice(-5).map((toast, index) => (
                <div
                    key={toast.id}
                    className="pointer-events-auto"
                    style={{
                        transform: `scale(${1 - (toasts.length - 1 - index) * 0.02})`,
                        opacity: 1 - (toasts.length - 1 - index) * 0.08,
                    }}
                >
                    <Toast toast={toast} onRemove={onRemove} />
                </div>
            ))}
        </div>
    );
});

ToastContainer.displayName = 'ToastContainer';

// Hook para manejar toasts
export const useToast = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, type, title, message, duration }]);
        return id;
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = {
        success: (title: string, message?: string) => addToast('success', title, message),
        error: (title: string, message?: string) => addToast('error', title, message, 6000),
        warning: (title: string, message?: string) => addToast('warning', title, message),
        info: (title: string, message?: string) => addToast('info', title, message)
    };

    return { toasts, toast, removeToast };
};

export default Toast;
