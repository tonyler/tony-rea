import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import { Logger } from '../types';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
};

const RESET = '\x1b[0m';

// Log directory
const LOG_DIR = path.join(__dirname, '../../logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Get the current date string for log file name
 */
function getDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get the log file path for today
 */
function getLogFilePath(): string {
  return path.join(LOG_DIR, `${getDateString()}.log`);
}

/**
 * Format a log message
 */
function formatMessage(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
}

/**
 * Write to log file
 */
function writeToFile(formattedMessage: string): void {
  try {
    fs.appendFileSync(getLogFilePath(), formattedMessage + '\n');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

/**
 * Check if the current level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[env.LOG_LEVEL];
}

/**
 * Create a logger instance
 */
export function createLogger(context?: string): Logger {
  const prefix = context ? `[${context}] ` : '';

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(level)) return;

    const fullMessage = prefix + message;
    const formatted = formatMessage(level, fullMessage, meta);

    // Console output with colors
    console.log(`${COLORS[level]}${formatted}${RESET}`);

    // File output without colors
    writeToFile(formatted);
  };

  return {
    debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
    info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  };
}

// Default logger instance
export const logger = createLogger();
