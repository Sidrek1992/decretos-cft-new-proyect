/**
 * Procesador de IA para extracción de datos de PDFs
 * Soporta tanto procesamiento en backend (GAS) como frontend (fallback)
 */

import { GoogleGenAI, Type } from "@google/genai";
import { PermitFormData } from "../types";
import { CONFIG } from "../config";
import { logger } from "./logger";

const aiLogger = logger.create('AI');

const parseAiNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (value === null || value === undefined) return undefined;

  const text = String(value).trim();
  if (!text) return undefined;

  const match = text.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return undefined;

  const num = parseFloat(match[0].replace(',', '.'));
  return Number.isNaN(num) ? undefined : num;
};

const coalesceAiNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    const parsed = parseAiNumber(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
};

const findAiNumberByKey = (data: Record<string, unknown>, patterns: RegExp[]): number | undefined => {
  for (const [key, value] of Object.entries(data)) {
    if (patterns.some(pattern => pattern.test(key))) {
      const parsed = parseAiNumber(value);
      if (parsed !== undefined) return parsed;
    }
  }
  return undefined;
};

const normalizeFLData = (data: Record<string, unknown>): FLExtractedData => {
  const saldoDisponible = coalesceAiNumber(
    data.saldoDisponible,
    findAiNumberByKey(data, [
      /saldo\s*disponible/i,
      /saldo\s*anterior/i,
      /total\s*d[ií]as?\s*h[aá]biles?/i,
      /d[ií]as?\s*a\s*su\s*haber/i,
      /dias?\s*haber/i
    ])
  );
  const solicitado = coalesceAiNumber(data.solicitado, data.cantidadDias);
  const cantidadDias = coalesceAiNumber(data.cantidadDias, data.solicitado);

  return {
    ...data,
    ...(saldoDisponible !== undefined ? { saldoDisponible } : {}),
    ...(solicitado !== undefined ? { solicitado } : {}),
    ...(cantidadDias !== undefined ? { cantidadDias } : {})
  } as FLExtractedData;
};

// Tipos para respuestas estructuradas
export interface AIProcessResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FLExtractedData {
  funcionario?: string;
  rut?: string;
  periodo?: string;
  saldoDisponible?: number;
  solicitado?: number;
  fechaInicio?: string;
  fechaTermino?: string;
  fechaDecreto?: string;
  cantidadDias?: number;
}

// Flag para usar backend (más seguro) o frontend (fallback)
const USE_BACKEND_AI = import.meta.env.VITE_USE_BACKEND_AI !== 'false';

// API Key solo se usa como fallback si el backend no está disponible
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Procesa un PDF usando el backend de Google Apps Script (recomendado)
 * Esto mantiene la API key segura en el servidor
 */
const BACKEND_TIMEOUT_MS = 10000; // 10 segundos

const processWithBackend = async (base64Pdf: string, solicitudType: 'PA' | 'FL'): Promise<Record<string, unknown>> => {
  aiLogger.info('Procesando PDF con backend GAS...');
  
  const url = solicitudType === 'PA' ? CONFIG.WEB_APP_URL : CONFIG.WEB_APP_URL_FL;
  aiLogger.debug('Backend URL (' + solicitudType + '):', url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'processAI',
        pdfBase64: base64Pdf,
        solicitudType
      }),
      signal: controller.signal
    });
  } catch (fetchError) {
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error('Timeout: el backend GAS no respondió en 30 segundos');
    }
    throw new Error('Error de red al conectar con backend: ' + (fetchError instanceof Error ? fetchError.message : String(fetchError)));
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error('Backend respondió con HTTP ' + response.status);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Error procesando con backend');
  }
  
  return result.data;
};

/**
 * Procesa un PDF usando la API de Gemini directamente (fallback)
 * Solo se usa si el backend no está disponible
 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2 segundos entre reintentos

const processWithFrontend = async (base64Pdf: string, solicitudType: 'PA' | 'FL'): Promise<Record<string, unknown>> => {
  aiLogger.info('Procesando PDF con frontend (fallback)...');
  
  if (!ai) {
    aiLogger.error('Gemini API Key no configurada');
    return {};
  }

  const prompt = solicitudType === 'PA' 
    ? `Actúa como un experto administrativo. Analiza esta SOLICITUD DE PERMISO O FERIADO. 
        Extrae con precisión los siguientes campos del documento:
        - funcionario: Nombre completo del solicitante.
        - rut: RUT del solicitante (con puntos y guion).
        - solicitudType: 'PA' si es Permiso Administrativo, 'FL' si es Feriado Legal.
        - cantidadDias: Número de días solicitados (ej. 1, 0.5, 3).
        - fechaInicio: Fecha de inicio del permiso en formato YYYY-MM-DD.
        - tipoJornada: Identifica si es 'Jornada completa', 'Jornada mañana', o 'Jornada tarde'.
        - fechaDecreto: Fecha de la solicitud que aparece en la parte superior del documento, en formato YYYY-MM-DD.
        
        Responde estrictamente en formato JSON siguiendo el esquema proporcionado.`
    : `Actúa como un experto administrativo. Analiza este FORMULARIO DE SOLICITUD DE FERIADO LEGAL.
        Extrae con precisión los siguientes campos del documento:
        - funcionario: Nombre completo del solicitante.
        - rut: RUT del solicitante (con puntos y guion).
        - periodo: El período al que corresponde el feriado (ej: "2024-2025" o "2025-2026").
        - saldoDisponible: Días de saldo disponible que tenía el funcionario ANTES de esta solicitud. Este valor puede aparecer en el documento etiquetado como "Total días hábiles", "Saldo disponible", "Días a su haber" o similar. Es el número de días que el funcionario tenía disponibles al momento de hacer la solicitud.
        - solicitado: Cantidad de días solicitados en ESTE formulario para ESTE período.
        - cantidadDias: Total de días solicitados (igual que solicitado).
        - fechaInicio: Fecha de inicio del feriado en formato YYYY-MM-DD.
        - fechaTermino: Fecha de término del feriado en formato YYYY-MM-DD.
        - fechaDecreto: Fecha de la solicitud que aparece en la parte superior del documento, en formato YYYY-MM-DD.
        
        Responde estrictamente en formato JSON siguiendo el esquema proporcionado.`;

  const schema = solicitudType === 'PA' 
    ? {
        type: Type.OBJECT,
        properties: {
          solicitudType: { type: Type.STRING, description: "Tipo de solicitud: PA o FL" },
          funcionario: { type: Type.STRING, description: "Nombre completo del funcionario" },
          rut: { type: Type.STRING, description: "RUT del funcionario" },
          cantidadDias: { type: Type.NUMBER, description: "Días solicitados" },
          fechaInicio: { type: Type.STRING, description: "Fecha de inicio del permiso" },
          tipoJornada: { type: Type.STRING, description: "Detalle de la jornada elegida" },
          fechaDecreto: { type: Type.STRING, description: "Fecha de la solicitud en formato YYYY-MM-DD" }
        },
        required: ["funcionario", "rut", "solicitudType", "cantidadDias", "fechaInicio"]
      }
    : {
        type: Type.OBJECT,
        properties: {
          funcionario: { type: Type.STRING, description: "Nombre completo del funcionario" },
          rut: { type: Type.STRING, description: "RUT del funcionario" },
          periodo: { type: Type.STRING, description: "Período del feriado (ej: 2024-2025)" },
          saldoDisponible: { type: Type.NUMBER, description: "Saldo disponible antes de la solicitud. Puede aparecer como 'Total días hábiles', 'Saldo disponible' o 'Días a su haber' en el documento." },
          solicitado: { type: Type.NUMBER, description: "Días solicitados en este formulario" },
          cantidadDias: { type: Type.NUMBER, description: "Total días solicitados" },
          fechaInicio: { type: Type.STRING, description: "Fecha de inicio del feriado" },
          fechaTermino: { type: Type.STRING, description: "Fecha de término del feriado" },
          fechaDecreto: { type: Type.STRING, description: "Fecha de la solicitud" }
        },
        required: ["funcionario", "rut", "solicitado"]
      };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Pdf
              }
            },
            { text: prompt }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      const textOutput = response.text;
      if (!textOutput) {
        aiLogger.warn('La IA no devolvió texto en la respuesta');
        return {};
      }

      return JSON.parse(textOutput.trim());
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const is503 = lastError.message.includes('503') || lastError.message.includes('UNAVAILABLE') || lastError.message.includes('overloaded');
      if (is503 && attempt < MAX_RETRIES) {
        aiLogger.warn(`Modelo sobrecargado (intento ${attempt}/${MAX_RETRIES}). Reintentar en ${RETRY_DELAY_MS}ms...`);
        await delay(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError!;
};

/**
 * Extrae datos de un PDF de Permiso Administrativo
 * @returns Resultado estructurado con success, data y error
 */
export const extractDataFromPdf = async (base64Pdf: string): Promise<AIProcessResult<Partial<PermitFormData>>> => {
  aiLogger.info('Iniciando procesamiento de PDF PA...');
  aiLogger.debug('Tamaño del PDF (base64):', base64Pdf.length, 'caracteres');

  try {
    // Intentar con backend primero (más seguro)
    if (USE_BACKEND_AI) {
      try {
        const data = await processWithBackend(base64Pdf, 'PA');
        return { success: true, data: data as Partial<PermitFormData> };
      } catch (backendError) {
        aiLogger.warn('Backend no disponible, usando fallback frontend:', backendError);
      }
    }
    
    // Fallback a frontend
    const data = await processWithFrontend(base64Pdf, 'PA');
    
    // Verificar que se extrajo al menos algún dato útil
    if (Object.keys(data).length === 0) {
      return { success: false, error: 'No se pudieron extraer datos del PDF' };
    }
    
    return { success: true, data: data as Partial<PermitFormData> };
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
    aiLogger.error('Error crítico en el procesamiento de IA:', err);
    return { success: false, error: errorMessage };
  }
};

/**
 * Extrae datos de un PDF de Feriado Legal
 * @returns Resultado estructurado con success, data y error
 */
export const extractFLDataFromPdf = async (base64Pdf: string): Promise<AIProcessResult<FLExtractedData>> => {
  aiLogger.info('Iniciando procesamiento de PDF FL...');

  try {
    // Intentar con backend primero (más seguro)
    if (USE_BACKEND_AI) {
      try {
        const data = await processWithBackend(base64Pdf, 'FL');
        aiLogger.info('[FL] Respuesta del BACKEND:', JSON.stringify(data, null, 2));
        aiLogger.info('[FL] saldoDisponible extraído:', data.saldoDisponible);
        aiLogger.info('[FL] Todas las propiedades:', Object.keys(data));

        const normalized = normalizeFLData(data);
        aiLogger.info('[FL] saldoDisponible normalizado:', normalized.saldoDisponible);
        return { success: true, data: normalized };
      } catch (backendError) {
        aiLogger.warn('Backend no disponible, usando fallback frontend:', backendError);
      }
    }
    
    // Fallback a frontend
    const data = await processWithFrontend(base64Pdf, 'FL');
    aiLogger.info('[FL] Respuesta del FRONTEND:', JSON.stringify(data, null, 2));
    aiLogger.info('[FL] saldoDisponible extraído:', data.saldoDisponible);
    aiLogger.info('[FL] Todas las propiedades:', Object.keys(data));
    
    // Verificar que se extrajo al menos algún dato útil
    if (Object.keys(data).length === 0) {
      return { success: false, error: 'No se pudieron extraer datos del PDF' };
    }
    
    const normalized = normalizeFLData(data);
    aiLogger.info('[FL] saldoDisponible normalizado:', normalized.saldoDisponible);
    return { success: true, data: normalized };
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
    aiLogger.error('Error crítico en el procesamiento FL de IA:', err);
    return { success: false, error: errorMessage };
  }
};
