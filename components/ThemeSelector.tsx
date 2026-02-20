import React, { useState } from 'react';
import { useTheme, THEMES, ThemeColor } from '../hooks/useTheme';
import { Palette, X, Check } from 'lucide-react';

interface ThemeSelectorProps {
    isOpen: boolean;
    onClose: () => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ isOpen, onClose }) => {
    const { theme, setTheme } = useTheme();

    if (!isOpen) return null;

    const themeColors: Record<ThemeColor, string> = {
        default: 'bg-indigo-500',
        ocean: 'bg-cyan-500',
        forest: 'bg-emerald-500',
        sunset: 'bg-orange-500',
        purple: 'bg-violet-500',
        rose: 'bg-rose-500'
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 pointer-events-none">
                        <Palette size={100} />
                    </div>

                    <div className="flex items-center justify-between z-10 relative">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-lg">
                                <Palette className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-extrabold uppercase tracking-tight">
                                    Personalizar Tema
                                </h2>
                                <p className="text-[10px] font-bold uppercase opacity-60 tracking-[0.2em] mt-1">
                                    Elige tu color favorito
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-white/20 rounded-xl transition-all border border-white/20"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Color Grid */}
                <div className="p-6">
                    <div className="grid grid-cols-3 gap-4">
                        {(Object.keys(THEMES) as ThemeColor[]).map((themeKey) => {
                            const config = THEMES[themeKey];
                            const isActive = theme === themeKey;

                            return (
                                <button
                                    key={themeKey}
                                    onClick={() => setTheme(themeKey)}
                                    className={`group relative p-4 rounded-2xl border-2 transition-all duration-300 ${isActive
                                            ? 'border-slate-900 dark:border-white shadow-lg scale-105'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                >
                                    {/* Color Preview */}
                                    <div className={`w-12 h-12 mx-auto rounded-xl ${themeColors[themeKey]} shadow-lg mb-3 transition-transform group-hover:scale-110`} />

                                    {/* Name */}
                                    <p className={`text-xs font-black uppercase tracking-wider text-center ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                                        }`}>
                                        {config.name}
                                    </p>

                                    {/* Active Indicator */}
                                    {isActive && (
                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-900 dark:bg-white rounded-full flex items-center justify-center shadow-lg">
                                            <Check className="w-3.5 h-3.5 text-white dark:text-slate-900" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Preview Section */}
                    <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                            Vista previa
                        </p>
                        <div className="flex items-center gap-3">
                            <div className={`flex-1 h-2 rounded-full bg-gradient-to-r ${THEMES[theme].gradient}`} />
                            <button className={`px-4 py-2 ${THEMES[theme].primary} text-white text-[10px] font-black uppercase rounded-lg`}>
                                Botón
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                        El tema se guarda automáticamente
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ThemeSelector;
