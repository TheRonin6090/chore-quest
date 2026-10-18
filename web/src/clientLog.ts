export function clientLog(level: 'info' | 'warn' | 'error', kind: string, message: string, data?: unknown): void {
  if (window.__cqLog) window.__cqLog(level, kind, message, data);
}
