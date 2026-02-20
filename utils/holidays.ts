
/**
 * Listado de feriados nacionales en Chile para los años 2024, 2025 y 2026.
 * Formato: YYYY-MM-DD
 */
export const CHILEAN_HOLIDAYS: string[] = [
    // 2024
    '2024-01-01',
    '2024-03-29',
    '2024-03-30',
    '2024-05-01',
    '2024-05-21',
    '2024-06-07',
    '2024-06-20',
    '2024-06-29',
    '2024-07-16',
    '2024-08-15',
    '2024-09-18',
    '2024-09-19',
    '2024-09-20',
    '2024-10-12',
    '2024-10-27',
    '2024-10-31',
    '2024-11-01',
    '2024-12-08',
    '2024-12-25',

    // 2025
    '2025-01-01',
    '2025-04-18',
    '2025-04-19',
    '2025-05-01',
    '2025-05-21',
    '2025-06-07',
    '2025-06-20',
    '2025-06-29',
    '2025-07-16',
    '2025-08-15',
    '2025-09-18',
    '2025-09-19',
    '2025-10-12',
    '2025-10-31',
    '2025-11-01',
    '2025-11-16',
    '2025-12-08',
    '2025-12-14',
    '2025-12-25',

    // 2026
    '2026-01-01',
    '2026-04-03',
    '2026-04-04',
    '2026-05-01',
    '2026-05-21',
    '2026-06-07',
    '2026-06-21',
    '2026-06-29',
    '2026-07-16',
    '2026-08-15',
    '2026-09-18',
    '2026-09-19',
    '2026-10-12',
    '2026-10-31',
    '2026-11-01',
    '2026-12-08',
    '2026-12-25',
];

/**
 * Verifica si una fecha dada es feriado en Chile.
 * @param date - Objeto Date o string en formato YYYY-MM-DD
 */
export const isHoliday = (date: Date | string): boolean => {
    const dateStr = typeof date === 'string'
        ? date
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return CHILEAN_HOLIDAYS.includes(dateStr);
};

/**
 * Verifica si una fecha es día hábil (Lunes a Viernes y no es feriado).
 * @param date - Objeto Date o string en formato YYYY-MM-DD
 */
export const isWorkingDay = (date: Date | string): boolean => {
    const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
    const day = d.getDay();
    // 0 = Domingo, 6 = Sábado
    if (day === 0 || day === 6) return false;
    return !isHoliday(date);
};
