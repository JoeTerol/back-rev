// El premium vence al terminar el día elegido, en hora de Argentina
// (UTC-3 todo el año, sin horario de verano). Ese instante es 00:00 del día
// siguiente en Argentina, o sea 03:00 UTC.
const ARGENTINA_OFFSET_HOURS = 3;

export function endOfDayInArgentina(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Rechaza fechas que no existen (2027-02-30): JavaScript las "corrige" solo.
  const start = new Date(Date.UTC(year, month - 1, day));
  const exists =
    start.getUTCFullYear() === year &&
    start.getUTCMonth() === month - 1 &&
    start.getUTCDate() === day;
  if (!exists) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day + 1, ARGENTINA_OFFSET_HOURS));
}