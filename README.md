# GDP Cloud - Gestor de Decretos v2.4

Sistema de gestion de decretos administrativos para recursos humanos. Permite gestionar Permisos Administrativos (PA) y Feriados Legales (FL).

## Stack Tecnologico

- **Frontend**: React 19 + TypeScript + Vite
- **Estilos**: Tailwind CSS (con purge)
- **Backend**: Google Apps Script (serverless)
- **Base de datos**: Google Sheets
- **IA**: Google Gemini (procesamiento OCR de PDFs)
- **Testing**: Jest + React Testing Library

## Arquitectura

```
decretos-cft/
├── App.tsx                    # Componente principal
├── components/                # Componentes React
│   ├── PermitForm/           # Formulario modularizado
│   │   ├── FormHeader.tsx
│   │   ├── SolicitudTypeSelector.tsx
│   │   ├── EmployeeSection.tsx
│   │   ├── PASection.tsx
│   │   ├── FLSection.tsx
│   │   └── index.ts
│   ├── PermitTable.tsx
│   ├── Dashboard.tsx
│   └── ...
├── hooks/                     # Custom hooks
│   ├── useCloudSync.ts       # Sincronizacion con Google Sheets
│   ├── useEmployeeSync.ts
│   ├── useModals.ts
│   └── ...
├── utils/                     # Utilidades
│   ├── logger.ts             # Logger condicional
│   ├── parsers/              # Parsers modulares
│   │   ├── dateParser.ts
│   │   ├── recordParser.ts
│   │   └── index.ts
│   └── formatters.ts
├── services/                  # Servicios
│   ├── pdfGenerator.ts
│   └── excelExport.ts
├── __tests__/                 # Tests
│   └── utils/
├── google_apps_script.js      # Backend (copiar a GAS)
└── .github/workflows/ci.yml   # CI/CD
```

## Flujo de Datos

```
[Usuario] → [React SPA] → [Google Apps Script] → [Google Sheets]
                ↓                    ↓
         [Gemini AI]          [Google Drive/Docs]
```

## Instalacion

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build de produccion
npm run build

# Tests
npm run test
npm run test:coverage

# Type check
npm run typecheck
```

## Variables de Entorno

Crear archivo `.env.local`:

```env
VITE_GEMINI_API_KEY=tu-api-key
VITE_GAS_WEB_APP_URL=url-del-web-app-pa
VITE_GAS_WEB_APP_URL_FL=url-del-web-app-fl
VITE_DECRETOS_SHEET_ID=id-del-sheet
VITE_FERIADOS_SHEET_ID=id-del-sheet-fl
VITE_EMPLOYEES_SHEET_ID=id-del-sheet-empleados
VITE_USE_BACKEND_AI=true  # Usar backend para IA (recomendado)
```

## Configuracion del Backend (Google Apps Script)

1. Crear un nuevo proyecto en [Google Apps Script](https://script.google.com)
2. Copiar el contenido de `google_apps_script.js`
3. Configurar la API key de Gemini:
   ```javascript
   configurarApiKey('tu-api-key-de-gemini');
   ```
4. Ejecutar `AUTORIZAR_CON_UN_CLIC()` para permisos
5. Desplegar como Web App (acceso: "Cualquiera")

## Seguridad

- Las API keys se almacenan en Google Apps Script (backend)
- Validacion de RUT y fechas tanto en frontend como backend
- CORS configurado para dominios autorizados
- Sin datos sensibles en el frontend

## Testing

```bash
# Ejecutar todos los tests
npm test

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

## CI/CD

El proyecto incluye GitHub Actions para:
- Lint y type checking
- Tests automatizados
- Build de produccion
- (Configurar) Deploy automatico

## Atajos de Teclado

| Atajo | Accion |
|-------|--------|
| `Ctrl+N` | Nuevo decreto |
| `Ctrl+S` | Sincronizar |
| `Ctrl+E` | Exportar Excel |
| `Ctrl+D` | Cambiar tema |
| `Ctrl+B` | Libro de decretos |
| `Ctrl+G` | Ver graficos |
| `Ctrl+C` | Calendario |
| `Ctrl+Z` | Deshacer |
| `?` | Mostrar atajos |

## Contribuir

1. Fork del repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit con mensaje descriptivo
4. Push y crear Pull Request

## Licencia

Desarrollado por Maximiliano Guzman para gestion de personas.
