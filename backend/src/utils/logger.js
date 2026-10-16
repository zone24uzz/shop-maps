/**
 * Minimal console logger. Kept dependency-free on purpose: swap the
 * implementation for pino/winston later without touching call sites.
 */
const isSilent = () => process.env.NODE_ENV === 'test' && !process.env.LOG_IN_TESTS;

function write(level, message) {
  if (isSilent()) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`;
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message) => write('info', message),
  warn: (message) => write('warn', message),
  error: (message) => write('error', message),
};
