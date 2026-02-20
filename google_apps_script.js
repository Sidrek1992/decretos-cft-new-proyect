/**
 * SGP CLOUD - MOTOR UNIFICADO v5.0 (Con Validaciones y Soporte IA)
 * Soporta: Lectura de Datos, Sincronización, Generación de PDFs/Documentos y Procesamiento IA.
 * Mejoras: Validación de RUT y fechas en backend, procesamiento de PDFs con Gemini.
 */

const TEMPLATE_DOC_ID = '1BvJanZb0936sPvV0oEZw-E0sro_02ibm_BFQuXa6F24';
const FOLDER_DESTINATION_ID = '1sX722eJuMnnrhqPO-zJF9ccCqlktLDo8';
const DEFAULT_SHEET_ID = '1BmMABAHk8ZgpUlXzsyI33qQGtsk5mrKnf5qzgQp4US0';

// Configuración de Gemini - Añadir la API key en las propiedades del script
// PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', 'tu-api-key');
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

/**
 * ============================================
 * FUNCIONES DE VALIDACIÓN
 * ============================================
 */

/**
 * Valida un RUT chileno
 * @param {string} rut - RUT a validar (con o sin puntos y guión)
 * @returns {boolean} - true si es válido
 */
function validateRut(rut) {
  if (!rut || rut.length < 8) return false;

  var cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
  var body = cleanRut.slice(0, -1);
  var dv = cleanRut.slice(-1);

  if (!/^\d+$/.test(body)) return false;

  var sum = 0;
  var multiplier = 2;

  for (var i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  var expectedDv = 11 - (sum % 11);
  var calculatedDv = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();

  return dv === calculatedDv;
}

/**
 * Valida que una fecha esté en el rango permitido
 * @param {string} dateString - Fecha en formato YYYY-MM-DD
 * @returns {boolean} - true si es válida
 */
function validateDate(dateString) {
  if (!dateString) return false;
  var date = new Date(dateString);
  if (isNaN(date.getTime())) return false;
  var year = date.getFullYear();
  return year >= 2020 && year <= 2030;
}

/**
 * Valida los datos de un registro antes de guardarlo
 * @param {object} record - Registro a validar
 * @returns {object} - { valid: boolean, errors: string[] }
 */
function validateRecord(record) {
  var errors = [];

  if (!record.funcionario || record.funcionario.trim() === '') {
    errors.push('Funcionario es requerido');
  }

  if (!record.rut || !validateRut(record.rut)) {
    errors.push('RUT inválido');
  }

  if (!record.fechaInicio || !validateDate(record.fechaInicio)) {
    errors.push('Fecha de inicio inválida');
  }

  if (record.solicitudType === 'FL') {
    if (!record.fechaTermino || !validateDate(record.fechaTermino)) {
      errors.push('Fecha de término es requerida para Feriado Legal');
    }
  }

  if (!record.cantidadDias || record.cantidadDias <= 0 || record.cantidadDias > 30) {
    errors.push('Cantidad de días debe estar entre 1 y 30');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * ============================================
 * LECTURA DE DATOS (doGet)
 * ============================================
 */
function doGet(e) {
  try {
    var sheetId = (e && e.parameter && e.parameter.sheetId) ? e.parameter.sheetId : DEFAULT_SHEET_ID;
    var isEmployees = (e && e.parameter && e.parameter.type === 'employees');

    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheets()[0];
    var lastRow = sheet.getLastRow();

    // Verificar si hay datos (mínimo fila 2 para tener al menos un registro)
    if (lastRow < 2) return createJsonResponse({ success: true, data: [] });

    // Leer todas las columnas con datos (sin limitar a un número fijo)
    var lastCol = sheet.getLastColumn();
    var numCols = isEmployees ? 5 : lastCol;

    // Leer desde fila 2 hasta la última fila
    var rows = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

    // Filtrar filas vacías y formatear fechas
    var formattedData = rows
      .filter(function (row) {
        // Para empleados: verificar que tenga nombre (col 1)
        if (isEmployees) return row[1];
        // Para decretos: verificar columnas clave
        return row[0] || row[1] || row[4];
      })
      .map(function (row) {
        return row.map(function (cell) {
          if (cell instanceof Date) return Utilities.formatDate(cell, Session.getScriptTimeZone(), "yyyy-MM-dd");
          return cell;
        });
      });

    return createJsonResponse({ success: true, data: formattedData });
  } catch (err) {
    return createJsonResponse({ success: false, error: "Error de lectura: " + err.toString() });
  }
}

/**
 * ============================================
 * ESCRITURA DE DATOS (doPost)
 * ============================================
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    
    // Procesar según el tipo de acción
    if (payload.action === 'processAI') {
      return handleAIProcessing(payload);
    }
    if (payload.sheetId) {
      return handleSpreadsheetSync(payload);
    }
    return handleDocumentCreation(payload);
  } catch (err) {
    return createJsonResponse({ success: false, error: "Error POST: " + err.toString() });
  }
}

/**
 * Sincronización con Google Sheets
 */
function handleSpreadsheetSync(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(payload.sheetId);
    var sheet = ss.getSheets()[0];
    var lastRow = sheet.getLastRow();

    // Detectar tipo de sheet por el payload
    var isEmployees = payload.type === 'employees';
    var lastCol = sheet.getLastColumn();
    var numCols = isEmployees ? 5 : Math.max(lastCol, payload.data && payload.data[0] ? payload.data[0].length : lastCol);

    // Validar registros si no son empleados
    if (!isEmployees && payload.validateRecords) {
      var validationErrors = [];
      payload.data.forEach(function(row, index) {
        var record = {
          funcionario: row[4],
          rut: row[5],
          fechaInicio: row[8],
          fechaTermino: row[16],
          cantidadDias: row[7],
          solicitudType: row[1] === 'PA' ? 'PA' : 'FL'
        };
        var validation = validateRecord(record);
        if (!validation.valid) {
          validationErrors.push('Fila ' + (index + 2) + ': ' + validation.errors.join(', '));
        }
      });
      
      if (validationErrors.length > 0) {
        lock.releaseLock();
        return createJsonResponse({ 
          success: false, 
          error: 'Errores de validación', 
          validationErrors: validationErrors 
        });
      }
    }

    // Limpiar datos desde fila 2 (preservar encabezado en fila 1)
    if (lastRow >= 2) {
      sheet.getRange(2, 1, lastRow - 1, numCols).clearContent();
    }

    // Escribir nuevos datos desde fila 2
    if (payload.data && payload.data.length > 0) {
      sheet.getRange(2, 1, payload.data.length, payload.data[0].length).setValues(payload.data);
    }

    SpreadsheetApp.flush();
    lock.releaseLock();
    return createJsonResponse({ success: true, message: "Sincronizado" });
  } catch (error) {
    if (lock.hasLock()) lock.releaseLock();
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Creación de documentos
 */
function handleDocumentCreation(data) {
  try {
    // Usar plantilla específica si se envía en el payload, sino la por defecto
    var templateId = data.templateId || TEMPLATE_DOC_ID;
    var templateFile = DriveApp.getFileById(templateId);
    var destinationFolder = DriveApp.getFolderById(FOLDER_DESTINATION_ID);
    var fileName = data.fileName || "DECRETO_" + new Date().getTime();

    // Crear copia
    var copy = templateFile.makeCopy(fileName, destinationFolder);
    var doc = DocumentApp.openById(copy.getId());
    var body = doc.getBody();

    // Reemplazar campos
    for (var key in data) {
      if (key === "fileName" || key === "templateId") continue;
      var val = (data[key] !== undefined && data[key] !== null) ? data[key].toString() : "";

      // Soporta formatos {{campo}} y «campo»
      body.replaceText('«' + key + '»', val);
      body.replaceText('{{' + key + '}}', val);

      var keyWithSpaces = key.replace(/_/g, ' ');
      if (key !== keyWithSpaces) {
        body.replaceText('«' + keyWithSpaces + '»', val);
        body.replaceText('{{' + keyWithSpaces + '}}', val);
      }
    }

    doc.saveAndClose();

    // Exportar como PDF
    var docId = copy.getId();
    var pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
    var pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());

    // Configurar permisos de visualización
    var file = DriveApp.getFileById(docId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return createJsonResponse({
      success: true,
      url: file.getUrl(),
      id: docId,
      pdfBase64: pdfBase64
    });
  } catch (e) {
    return createJsonResponse({ success: false, error: "Fallo en motor Drive: " + e.toString() });
  }
}

/**
 * ============================================
 * PROCESAMIENTO IA CON GEMINI
 * ============================================
 */

/**
 * Procesa un PDF con Gemini para extraer datos estructurados
 */
function handleAIProcessing(payload) {
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return createJsonResponse({ 
        success: false, 
        error: 'API Key de Gemini no configurada. Ejecuta configurarApiKey() primero.' 
      });
    }

    var pdfBase64 = payload.pdfBase64;
    var solicitudType = payload.solicitudType || 'PA';

    var prompt = solicitudType === 'PA' 
      ? getPromptPA() 
      : getPromptFL();

    var requestBody = {
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: pdfBase64
            }
          },
          {
            text: prompt
          }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    var response = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    });

    var result = JSON.parse(response.getContentText());
    
    if (result.error) {
      return createJsonResponse({ 
        success: false, 
        error: 'Error de Gemini: ' + result.error.message 
      });
    }

    var extractedText = result.candidates[0].content.parts[0].text;
    var extractedData = JSON.parse(extractedText);

    // Validar RUT extraído
    if (extractedData.rut && !validateRut(extractedData.rut)) {
      extractedData.rutWarning = 'RUT extraído podría ser inválido';
    }

    return createJsonResponse({
      success: true,
      data: extractedData
    });

  } catch (e) {
    return createJsonResponse({ 
      success: false, 
      error: 'Error procesando IA: ' + e.toString() 
    });
  }
}

/**
 * Prompt para extracción de Permisos Administrativos
 */
function getPromptPA() {
  return `Actúa como un experto administrativo. Analiza esta SOLICITUD DE PERMISO ADMINISTRATIVO. 
Extrae con precisión los siguientes campos del documento:
- funcionario: Nombre completo del solicitante.
- rut: RUT del solicitante (con puntos y guion).
- solicitudType: 'PA' para Permiso Administrativo.
- cantidadDias: Número de días solicitados (ej. 1, 0.5, 3).
- fechaInicio: Fecha de inicio del permiso en formato YYYY-MM-DD.
- tipoJornada: Identifica si es 'Jornada completa', 'Jornada mañana', o 'Jornada tarde'.
- fechaDecreto: Fecha de la solicitud que aparece en la parte superior del documento, en formato YYYY-MM-DD.

Responde estrictamente en formato JSON con estas propiedades.`;
}

/**
 * Prompt para extracción de Feriado Legal
 */
function getPromptFL() {
  return `Actúa como un experto administrativo. Analiza este FORMULARIO DE SOLICITUD DE FERIADO LEGAL.
Extrae con precisión los siguientes campos del documento:
- funcionario: Nombre completo del solicitante.
- rut: RUT del solicitante (con puntos y guion).
- periodo: El período al que corresponde el feriado (ej: "2024-2025").
- saldoDisponible: Días de saldo disponible que tenía el funcionario ANTES de esta solicitud. Este valor puede aparecer en el documento etiquetado como "Total días hábiles", "Saldo disponible", "Días a su haber" o similar. Es el número de días que el funcionario tenía disponibles al momento de hacer la solicitud.
- solicitado: Cantidad de días solicitados en este formulario.
- cantidadDias: Total de días solicitados (igual que solicitado).
- fechaInicio: Fecha de inicio del feriado en formato YYYY-MM-DD.
- fechaTermino: Fecha de término del feriado en formato YYYY-MM-DD.
- fechaDecreto: Fecha de la solicitud que aparece en la parte superior del documento, en formato YYYY-MM-DD.

Responde estrictamente en formato JSON con estas propiedades.`;
}

/**
 * ============================================
 * UTILIDADES
 * ============================================
 */

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Configura la API Key de Gemini en las propiedades del script
 * Ejecutar esta función manualmente desde el editor de Apps Script
 * @param {string} apiKey - La API key de Gemini
 */
function configurarApiKey(apiKey) {
  if (!apiKey) {
    Logger.log('Error: Debes proporcionar una API key');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
  Logger.log('✅ API Key configurada exitosamente');
}

/**
 * Verifica si la API Key está configurada
 */
function verificarApiKey() {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (apiKey) {
    Logger.log('✅ API Key configurada: ' + apiKey.substring(0, 8) + '...');
    return true;
  }
  Logger.log('❌ API Key NO configurada');
  return false;
}

/**
 * IMPORTANTE: Ejecuta esta función una vez en el editor de Apps Script 
 * para autorizar los permisos de Drive y DocumentApp.
 */
function AUTORIZAR_CON_UN_CLIC() {
  // Forzar autorización de lectura
  var file = DriveApp.getFileById(TEMPLATE_DOC_ID);
  var folder = DriveApp.getFolderById(FOLDER_DESTINATION_ID);
  
  // Forzar autorización de escritura/copia
  var testCopy = file.makeCopy("_TEST_AUTORIZACION_BORRAR", folder);
  DriveApp.getFileById(testCopy.getId()).setTrashed(true); // Eliminar copia de prueba
  
  // Forzar autorización de DocumentApp
  DocumentApp.openById(TEMPLATE_DOC_ID);
  
  // Verificar API Key
  verificarApiKey();
  
  Logger.log("✅ Autorización completa (lectura, copia y documentos) exitosa");
}
