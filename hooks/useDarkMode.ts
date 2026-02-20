import { useState, useEffect } from 'react';

export const useDarkMode = () => {
    const [isDark, setIsDark] = useState(() => {
        // Verificar preferencia guardada o del sistema
        const saved = localStorage.getItem('sgp_dark_mode');
        if (saved !== null) {
            return saved === 'true';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        const root = document.documentElement;

        if (isDark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        localStorage.setItem('sgp_dark_mode', String(isDark));
    }, [isDark]);

    // Escuchar cambios en la preferencia del sistema
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: MediaQueryListEvent) => {
            const saved = localStorage.getItem('sgp_dark_mode');
            if (saved === null) {
                setIsDark(e.matches);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const toggle = () => setIsDark(prev => !prev);

    return { isDark, toggle, setIsDark };
};
