// ISO date helpers (YYYY-MM-DD compares correctly as strings; local time, no time zones)

export const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseIso = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
export const addDays = (iso: string, n: number) => { const d = parseIso(iso); d.setDate(d.getDate() + n); return toIso(d); };
/** Days from a to b inclusive (a = b → 1) */
export const daysInclusive = (a: string, b: string) => Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000) + 1;
/** First day of the month before the one `iso` is in */
export const prevMonthStart = (iso: string) => { const d = parseIso(iso); return toIso(new Date(d.getFullYear(), d.getMonth() - 1, 1)); };
