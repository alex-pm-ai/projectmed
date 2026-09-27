export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

export function getWeekDays(referenceDate?: string): string[] {
  const ref = referenceDate ? new Date(referenceDate + 'T12:00:00') : new Date();
  const day = ref.getDay(); // 0 = sunday
  const sunday = new Date(ref);
  sunday.setDate(ref.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

export function getMonthDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push(`${year}-${mm}-${dd}`);
  }
  return cells;
}

export function isToday(dateStr: string): boolean {
  return dateStr === today();
}

export function isPast(dateStr: string): boolean {
  return dateStr < today();
}

export function isFuture(dateStr: string): boolean {
  return dateStr > today();
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00');
  const db = new Date(b + 'T12:00:00');
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

export function startOfWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
}

export function endOfWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 6);
  return d.toISOString().split('T')[0];
}

export function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function minutesToHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
