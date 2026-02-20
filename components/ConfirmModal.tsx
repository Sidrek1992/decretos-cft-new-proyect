import React, { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar acción',
  message = '¿Estás seguro de que deseas continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap y restauración de foco
  useEffect(() => {
    if (isOpen) {
      // Guardar el elemento que tenía el foco
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // Enfocar el botón de confirmar después de que se monte
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);

      // Prevenir scroll del body
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = '';
      // Restaurar foco al cerrar
      if (previousFocusRef.current && !isOpen) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  // Manejar tecla Escape y Tab para focus trap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    // Focus trap
    if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: Trash2,
      iconBg: 'bg-red-100 dark:bg-red-900/50',
      iconColor: 'text-red-600 dark:text-red-400',
      confirmBg: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-amber-100 dark:bg-amber-900/50',
      iconColor: 'text-amber-600 dark:text-amber-400',
      confirmBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    },
    info: {
      icon: AlertTriangle,
      iconBg: 'bg-blue-100 dark:bg-blue-900/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
      confirmBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
  };

  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8">
          <div className="flex flex-col items-center text-center">
            {/* Icon */}
            <div className={`w-16 h-16 ${styles.iconBg} rounded-full flex items-center justify-center mb-4`}>
              <Icon className={`w-8 h-8 ${styles.iconColor}`} />
            </div>

            {/* Title */}
            <h2
              id="confirm-modal-title"
              className="text-xl font-bold text-slate-900 dark:text-white mb-2"
            >
              {title}
            </h2>

            {/* Message */}
            <p
              id="confirm-modal-description"
              className="text-sm text-slate-600 dark:text-slate-400 mb-6"
            >
              {message}
            </p>

            {/* Actions */}
            <div className="flex gap-3 w-full">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
              >
                {cancelText}
              </button>
              <button
                ref={confirmButtonRef}
                onClick={handleConfirm}
                className={`flex-1 px-4 py-3 ${styles.confirmBg} text-white font-bold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 active:scale-95`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ConfirmModal);
