import { endOfDayInArgentina } from './expiry-date';

describe('endOfDayInArgentina', () => {
  it.each([
    ['2027-12-31', '2028-01-01T03:00:00.000Z'],
    ['2026-02-28', '2026-03-01T03:00:00.000Z'],
    ['2028-02-29', '2028-03-01T03:00:00.000Z'],
    ['2026-12-31', '2027-01-01T03:00:00.000Z'],
  ])('should end the day %s at %s (00:00 in Argentina)', (date, expected) => {
    expect(endOfDayInArgentina(date)?.toISOString()).toBe(expected);
  });

  it.each([
    '',
    'mañana',
    '2027-1-1',
    '2027/12/31',
    '31-12-2027',
    '2027-12-31T10:00:00Z',
    '2027-13-01',
    '2027-02-30',
    '2027-02-29',
  ])('should answer null for %j', (date) => {
    expect(endOfDayInArgentina(date)).toBeNull();
  });
});