import { format, subMonths, startOfMonth, endOfMonth, setDate, isAfter, isBefore, addMonths } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Get the fiscal month label for a date (7-7 month).
 * If day < 7, belongs to previous month.
 */
export function getFiscalMonth(date: Date): string {
  const adjusted = date.getDate() < 7 ? subMonths(date, 1) : date;
  return format(adjusted, "MMMM yyyy", { locale: es });
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
 */
export function getFiscalMonthOptions(count: number = 6): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  let current = new Date();
  for (let i = 0; i < count; i++) {
    const start = getFiscalStart(current);
    const label = getFiscalMonth(current);
    options.push({ value: start.toISOString().split("T")[0], label });
    current = subMonths(current, 1);
  }
  return options;
}
