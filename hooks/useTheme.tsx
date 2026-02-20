import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeColor = 'default' | 'ocean' | 'forest' | 'sunset' | 'purple' | 'rose';

interface ThemeConfig {
    name: string;
    primary: string;
    primaryHover: string;
    primaryLight: string;
    accent: string;
    gradient: string;
}

export const THEMES: Record<ThemeColor, ThemeConfig> = {
    default: {
        name: 'Índigo',
        primary: 'bg-indigo-600',
        primaryHover: 'hover:bg-indigo-700',
        primaryLight: 'bg-indigo-50 dark:bg-indigo-900/30',
        accent: 'text-indigo-600 dark:text-indigo-400',
        gradient: 'from-indigo-500 to-sky-500'
    },
    ocean: {
        name: 'Océano',
        primary: 'bg-cyan-600',
        primaryHover: 'hover:bg-cyan-700',
        primaryLight: 'bg-cyan-50 dark:bg-cyan-900/30',
        accent: 'text-cyan-600 dark:text-cyan-400',
        gradient: 'from-cyan-500 to-blue-500'
    },
    forest: {
        name: 'Bosque',
        primary: 'bg-emerald-600',
        primaryHover: 'hover:bg-emerald-700',
        primaryLight: 'bg-emerald-50 dark:bg-emerald-900/30',
        accent: 'text-emerald-600 dark:text-emerald-400',
        gradient: 'from-emerald-500 to-teal-500'
    },
    sunset: {
        name: 'Atardecer',
        primary: 'bg-orange-600',
        primaryHover: 'hover:bg-orange-700',
        primaryLight: 'bg-orange-50 dark:bg-orange-900/30',
        accent: 'text-orange-600 dark:text-orange-400',
        gradient: 'from-orange-500 to-rose-500'
    },
    purple: {
        name: 'Violeta',
        primary: 'bg-violet-600',
        primaryHover: 'hover:bg-violet-700',
        primaryLight: 'bg-violet-50 dark:bg-violet-900/30',
        accent: 'text-violet-600 dark:text-violet-400',
        gradient: 'from-violet-500 to-purple-500'
    },
    rose: {
        name: 'Rosa',
        primary: 'bg-rose-600',
        primaryHover: 'hover:bg-rose-700',
        primaryLight: 'bg-rose-50 dark:bg-rose-900/30',
        accent: 'text-rose-600 dark:text-rose-400',
        gradient: 'from-rose-500 to-pink-500'
    }
};

interface ThemeContextType {
    theme: ThemeColor;
    setTheme: (theme: ThemeColor) => void;
    config: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeColor>(() => {
        const saved = localStorage.getItem('sgp_theme_color');
        return (saved as ThemeColor) || 'default';
    });

    const setTheme = (newTheme: ThemeColor) => {
        setThemeState(newTheme);
        localStorage.setItem('sgp_theme_color', newTheme);

        // Actualizar variables CSS custom
        const root = document.documentElement;
        root.setAttribute('data-theme', newTheme);
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, config: THEMES[theme] }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};
