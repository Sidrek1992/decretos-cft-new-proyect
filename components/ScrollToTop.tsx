import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';

const ScrollToTop: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    const handleScroll = useCallback(() => {
        setIsVisible(window.scrollY > 400);
    }, []);

    useEffect(() => {
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    const scrollToTop = useCallback(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    if (!isVisible) return null;

    return (
        <button
            onClick={scrollToTop}
            className="fixed bottom-20 right-6 z-[100] p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl hover:shadow-2xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-90 scroll-top-enter hover:-translate-y-0.5"
            aria-label="Volver arriba"
            title="Volver al inicio"
        >
            <ArrowUp className="w-5 h-5" />
        </button>
    );
};

export default ScrollToTop;
