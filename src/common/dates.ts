export const daysInMonth = (period: string): number => {
  const [year, month] = period.split('-').map(Number); // '2026-04' pasa a [2026, 4]
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};
export const currentPeriod = (now: Date): string => {
  // Argentina time is UTC-3, so we need to adjust the date to that timezone
  const argentinaDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return argentinaDate.toISOString().slice(0, 7);
};
