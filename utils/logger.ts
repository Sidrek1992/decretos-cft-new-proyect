/**
 * Logger condicional para la aplicación
 * Solo muestra logs en desarrollo, silencia en producción
 */

// Compatible con Vite y Jest
const isDevelopment = (() => {
  try {
    // En Vite
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.DEV;
    }
  } catch {
    // Ignorar error
  }
  // En Jest o Node
  return process.env.NODE_ENV !== 'production';
})();

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  prefix?: string;
  showTimestamp?: boolean;
}

const formatMessage = (level: LogLevel, message: string, options: LoggerOptions = {}): string => {
  const parts: string[] = [];

  if (options.showTimestamp) {
    parts.push(`[${new Date().toISOString()}]`);
  }

  if (options.prefix) {
    parts.push(`[${options.prefix}]`);
  }

  parts.push(`[${level.toUpperCase()}]`);
  parts.push(message);

  return parts.join(' ');
};

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(formatMessage('debug', message), ...args);
    }
  },

  info: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.info(formatMessage('info', message), ...args);
    }
  },

  warn: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(formatMessage('warn', message), ...args);
    }
  },

  error: (message: string, ...args: unknown[]) => {
    // Errors always show, even in production
    console.error(formatMessage('error', message), ...args);
  },

  // Create a namespaced logger
  create: (namespace: string): typeof logger => ({
    debug: (message: string, ...args: unknown[]) => {
      if (isDevelopment) {
        console.debug(formatMessage('debug', message, { prefix: namespace }), ...args);
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (isDevelopment) {
        console.info(formatMessage('info', message, { prefix: namespace }), ...args);
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (isDevelopment) {
        console.warn(formatMessage('warn', message, { prefix: namespace }), ...args);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(formatMessage('error', message, { prefix: namespace }), ...args);
    },
    create: (ns: string) => logger.create(`${namespace}:${ns}`),
  }),
};

export default logger;
