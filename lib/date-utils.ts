import { format, subMonths, setDate, isAfter, isBefore, addMonths } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Parse a YYYY-MM-DD string as a LOCAL date (no timezone shift).
 * new Date("2026-03-07") in -3 timezone → March 6 21:00 (WRONG)
 * parseLocalDate("2026-03-07") → March 7 00:00 local (CORRECT)
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format a date as YYYY-MM-DD string (local).
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get the fiscal month label for a date (7-7 month).
 * If day < 7, belongs to previous month.
 */
export function getFiscalMonth(date: Date): string {
  const adjusted = date.getDate() < 7 ? subMonths(date, 1) : date;
  const raw = format(adjusted, "MMMM yyyy", { locale: es });
  // Capitalize first letter to match SQL get_month_7_7() output ("Marzo 2026")
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Get the start date of a fiscal month (always the 7th).
 */
export function getFiscalStart(date: Date = new Date()): Date {
  if (date.getDate() >= 7) {
    return setDate(date, 7);
  }
  return setDate(subMonths(date, 1), 7);
}

/**
 * Get the end date of a fiscal month (always the 6th of next month).
 */
export function getFiscalEnd(date: Date = new Date()): Date {
  const start = getFiscalStart(date);
  return setDate(addMonths(start, 1), 6);
}

/**
 * Check if a date is within the current fiscal month.
 */
export function isCurrentFiscal(date: Date): boolean {
  const start = getFiscalStart();
  const end = getFiscalEnd();
  return !isBefore(date, start) && !isAfter(date, end);
}

/**
 * Get previous fiscal month start/end.
 */
export function getPrevFiscalStart(): Date {
  return subMonths(getFiscalStart(), 1);
}

/**
 * Generate fiscal month options for a selector.
 * Values are YYYY-MM-DD strings that must be parsed with parseLocalDate().
 */
export function getFiscalMonthOptions(count: number = 6): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  let current = new Date();
  for (let i = 0; i < count; i++) {
    const start = getFiscalStart(current);
    const label = getFiscalMonth(current);
    options.push({ value: toDateString(start), label });
    current = subMonths(current, 1);
  }
  return options;
}
