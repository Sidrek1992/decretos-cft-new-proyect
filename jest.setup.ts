import '@testing-library/jest-dom';

// Mock de import.meta.env para tests
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        DEV: true,
        PROD: false,
        VITE_GEMINI_API_KEY: 'test-api-key',
        VITE_GAS_WEB_APP_URL: 'https://test.googleusercontent.com/macros',
        VITE_GAS_WEB_APP_URL_FL: 'https://test.googleusercontent.com/macros/fl',
        VITE_DECRETOS_SHEET_ID: 'test-sheet-id',
        VITE_FERIADOS_SHEET_ID: 'test-feriados-sheet-id',
        VITE_EMPLOYEES_SHEET_ID: 'test-employees-sheet-id',
      },
    },
  },
  writable: true,
});

// Mock de crypto.randomUUID
Object.defineProperty(globalThis.crypto, 'randomUUID', {
  value: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
});

// Mock de navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
});

// Mock de fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: [] }),
  } as Response)
);

// Limpiar mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});
