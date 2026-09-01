/**
 * Robust date utilities for timezone-aware local date handling
 */

/**
 * Returns YYYY-MM-DD in local browser/system calendar date
 * Avoids the UTC-offset bug caused by new Date().toISOString().split('T')[0]
 */
export function getLocalDateString(d: Date | string | number = new Date()): string {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a YYYY-MM-DD string or Date object into a full ISO string
 * using local time component so that local calendar day is preserved accurately.
 */
export function createLocalIsoString(dateInput?: string | Date | null, fallbackDate: Date = new Date()): string {
  if (!dateInput) return fallbackDate.toISOString();
  
  if (typeof dateInput === 'string' && dateInput.length <= 10) {
    const [y, m, d] = dateInput.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const now = new Date();
      const localDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      return localDate.toISOString();
    }
  }
  
  const parsed = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return isNaN(parsed.getTime()) ? fallbackDate.toISOString() : parsed.toISOString();
}

/**
 * Formats a Date or ISO string into "DD MMM YYYY" (e.g. "30 Aug 2026")
 */
export function formatLocalDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
