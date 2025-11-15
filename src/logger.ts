import { appConfig } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const currentLevel = appConfig.LOG_LEVEL;

const shouldLog = (level: LogLevel): boolean => levelOrder[level] >= levelOrder[currentLevel];

const timestamp = (): string => new Date().toISOString();

const formatMessage = (level: LogLevel, message: string): string => `[${timestamp()}] [${level.toUpperCase()}] ${message}`;

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message), ...args);
    }
  },
  info(message: string, ...args: unknown[]) {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message), ...args);
    }
  },
  warn(message: string, ...args: unknown[]) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message), ...args);
    }
  },
  error(message: string, ...args: unknown[]) {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message), ...args);
    }
  }
};
