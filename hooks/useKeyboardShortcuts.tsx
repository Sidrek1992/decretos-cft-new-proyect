import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
    key: string;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    action: () => void;
    description: string;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[], enabled: boolean = true) => {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return;

        // Ignorar si está en un input/textarea/select
        const target = event.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

        for (const shortcut of shortcuts) {
            const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
            const ctrlMatch = shortcut.ctrlKey ? (event.ctrlKey || event.metaKey) : true;
            const shiftMatch = shortcut.shiftKey === undefined ? true : shortcut.shiftKey === event.shiftKey;
            const altMatch = shortcut.altKey === undefined ? true : shortcut.altKey === event.altKey;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                event.preventDefault();
                shortcut.action();
                return;
            }
        }
    }, [shortcuts, enabled]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
};

// Componente para mostrar atajos disponibles
import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    shortcuts: { key: string; ctrlKey?: boolean; shiftKey?: boolean; description: string }[];
}

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({ isOpen, onClose, shortcuts }) => {
    if (!isOpen) return null;

    const formatKey = (s: typeof shortcuts[0]) => {
        const parts = [];
        if (s.ctrlKey) parts.push('⌘/Ctrl');
        if (s.shiftKey) parts.push('Shift');
        parts.push(s.key.toUpperCase());
        return parts.join(' + ');
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-slate-900 dark:bg-slate-950 p-6 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Keyboard className="w-6 h-6" />
                        <h2 className="text-lg font-bold">Atajos de Teclado</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-3">
                    {shortcuts.map((s, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                            <span className="text-sm text-slate-600 dark:text-slate-300">{s.description}</span>
                            <kbd className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-mono font-bold">
                                {formatKey(s)}
                            </kbd>
                        </div>
                    ))}
                </div>
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-400 text-center uppercase tracking-wider">
                        Presiona <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[9px]">?</kbd> para ver esta ayuda
                    </p>
                </div>
            </div>
        </div>
    );
};
