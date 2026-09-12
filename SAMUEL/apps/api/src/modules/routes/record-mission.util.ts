export const RECORD_SESSION_SHELL_NAME = 'Sessão de gravação';
export const MAX_RECORD_POINTS = 25;

export function normalizeRecordCustomerName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (name.length < 2 || name.length > 200) return null;
  return name;
}
