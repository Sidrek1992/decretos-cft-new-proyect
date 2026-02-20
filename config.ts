/// <reference types="vite/client" />

/**
 * Configuración centralizada de la aplicación GDP Cloud
 * Todas las URLs y constantes globales deben estar aquí
 */

// URLs de Google Apps Script - Centralizado para evitar duplicación
export const CONFIG = {
    // URL del Web App de Google Apps Script (PA - Permisos)
    WEB_APP_URL: import.meta.env.VITE_GAS_WEB_APP_URL || 'https://script.google.com/macros/s/AKfycbzFnXNBOFdSn6Gn0Y_uRAikrK6wcQlTCS2Qo-pGqeb_uTLgyrJAf50Rglgml1hzWscRSw/exec',

    // URL del Web App de Google Apps Script (FL - Feriados 1 período)
    WEB_APP_URL_FL: import.meta.env.VITE_GAS_WEB_APP_URL_FL || 'https://script.google.com/macros/s/AKfycbwJobNnBD1nV4_kt8gnBOVMNodznPuD8AGsxtTbUXF6E67RIWDm3Mxwxri3xdC4I9qM/exec',

    // URL del Web App de Google Apps Script (FL - Feriados 2 períodos)
    WEB_APP_URL_FL_2P: import.meta.env.VITE_GAS_WEB_APP_URL_FL_2P || 'https://script.google.com/macros/s/AKfycbwYzlkEQRVA7O6l0QhjgfQL51Uq_KFLImiiOUEeayge8c1J833AJwO07-nYoK_OviXEdg/exec',

    // ID de la hoja de cálculo de decretos (PA)
    DECRETOS_SHEET_ID: import.meta.env.VITE_DECRETOS_SHEET_ID || '1BmMABAHk8ZgpUlXzsyI33qQGtsk5mrKnf5qzgQp4US0',

    // ID de la hoja de cálculo de feriados 1 período (FL)
    FERIADOS_SHEET_ID: import.meta.env.VITE_FERIADOS_SHEET_ID || '1dSZ7v5WwP1w1WpwfP3hdWiTCF3pf2niXLKDK7GWIz0I',

    // ID de la hoja de cálculo de feriados 2 períodos (FL_2P)
    FERIADOS_2P_SHEET_ID: import.meta.env.VITE_FERIADOS_2P_SHEET_ID || '1dSZ7v5WwP1w1WpwfP3hdWiTCF3pf2niXLKDK7GWIz0I',

    // ID de la hoja de cálculo de funcionarios
    EMPLOYEES_SHEET_ID: import.meta.env.VITE_EMPLOYEES_SHEET_ID || '14qgHA7YP4qoSbzD8rgMPW6OmqLIVFi8V-1VPxoUEDbI',

    // ID de la carpeta de destino en Drive
    TARGET_FOLDER_ID: import.meta.env.VITE_TARGET_FOLDER_ID || '1sX722eJuMnnrhqPO-zJF9ccCqlktLDo8',

    // ID del documento plantilla (PA - Permisos)
    TEMPLATE_DOC_ID: import.meta.env.VITE_TEMPLATE_DOC_ID || '1BvJanZb0936sPvV0oEZw-E0sro_02ibm_BFQuXa6F24',

    // ID del documento plantilla FL - 1 período
    TEMPLATE_FL_1P_DOC_ID: import.meta.env.VITE_TEMPLATE_FL_1P_DOC_ID || '1gTjGkhmq-PWi5zmo_zMrpzysgs4d0SCTynbGaVC1YPw',

    // ID del documento plantilla FL - 2 períodos
    TEMPLATE_FL_2P_DOC_ID: import.meta.env.VITE_TEMPLATE_FL_2P_DOC_ID || '16w2phHHq1YE4ws-fSQO_EGnXcdKFrGGLQVTVW0zbPJs',

    // Versión de la aplicación
    APP_VERSION: '2.4',

    // Configuración de paginación
    ITEMS_PER_PAGE: 15,

    // Días base por tipo de solicitud
    BASE_DAYS: {
        PA: 6,
        FL: 15
    }
} as const;

// Validar RUT chileno
export const validateRut = (rut: string): boolean => {
    if (!rut || rut.length < 8) return false;

    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1);

    if (!/^\d+$/.test(body)) return false;

    let sum = 0;
    let multiplier = 2;

    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const expectedDv = 11 - (sum % 11);
    const calculatedDv = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();

    return dv === calculatedDv;
};

// Validar fecha
export const validateDate = (dateString: string): boolean => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date.getFullYear() >= 2020 && date.getFullYear() <= 2030;
};
