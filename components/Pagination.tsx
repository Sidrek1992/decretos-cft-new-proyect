import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = React.memo(({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange
}) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const pageNumbers = useMemo(() => {
        const pages: (number | string)[] = [];
        const maxVisible = isMobile ? 3 : 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);

            if (currentPage > 3) pages.push('...');

            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) pages.push('...');

            pages.push(totalPages);
        }

        return pages;
    }, [currentPage, totalPages, isMobile]);

    const goToFirst = useCallback(() => onPageChange(1), [onPageChange]);
    const goToPrev = useCallback(() => onPageChange(currentPage - 1), [onPageChange, currentPage]);
    const goToNext = useCallback(() => onPageChange(currentPage + 1), [onPageChange, currentPage]);
    const goToLast = useCallback(() => onPageChange(totalPages), [onPageChange, totalPages]);

    if (totalPages <= 1) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-2">
            {/* Info */}
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Mostrando <span className="text-slate-700 dark:text-slate-200">{startItem}-{endItem}</span> de{' '}
                <span className="text-slate-700 dark:text-slate-200">{totalItems}</span> registros
            </div>

            {/* Controles */}
            <div className="flex items-center gap-1">
                {/* Primera página */}
                <button
                    onClick={goToFirst}
                    disabled={currentPage === 1}
                    className="hidden sm:block p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    aria-label="Primera página"
                >
                    <ChevronsLeft size={16} aria-hidden="true" />
                </button>

                {/* Anterior */}
                <button
                    onClick={goToPrev}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    aria-label="Página anterior"
                >
                    <ChevronLeft size={16} aria-hidden="true" />
                </button>

                {/* Números de página */}
                <div className="flex items-center gap-1 mx-2">
                    {pageNumbers.map((page, index) => (
                        typeof page === 'number' ? (
                            <button
                                key={index}
                                onClick={() => onPageChange(page)}
                                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${currentPage === page
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50'
                                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {page}
                            </button>
                        ) : (
                            <span key={index} className="px-2 text-slate-400">
                                {page}
                            </span>
                        )
                    ))}
                </div>

                {/* Siguiente */}
                <button
                    onClick={goToNext}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    aria-label="Página siguiente"
                >
                    <ChevronRight size={16} aria-hidden="true" />
                </button>

                {/* Última página */}
                <button
                    onClick={goToLast}
                    disabled={currentPage === totalPages}
                    className="hidden sm:block p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    aria-label="Última página"
                >
                    <ChevronsRight size={16} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
});

Pagination.displayName = 'Pagination';

export default Pagination;
