/**
 * One CSV cell. A value starting with = + - @ (or tab/CR) would run as a formula
 * in Excel/Sheets, so it gets a leading apostrophe; then quote if needed.
 */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export const toCsv = (rows: (string | number)[][]): string => rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
