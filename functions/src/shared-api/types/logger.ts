/**
 * Logger interface for dependency injection.
 * Matches Firebase Functions logger API.
 */
export interface Logger {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug?(message: string, context?: Record<string, unknown>): void;
  log?(message: string, context?: Record<string, unknown>): void;
}
