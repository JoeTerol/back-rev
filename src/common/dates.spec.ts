import { daysInMonth, currentPeriod } from './dates';

describe('daysInMonth', () => {
  it('should return 30 for April', () => {
    expect(daysInMonth('2026-04')).toBe(30);
  });
  it('should return 31 for December', () => {
    expect(daysInMonth('2026-12')).toBe(31);
  });
  it('should return 28 for February in a regular year', () => {
    expect(daysInMonth('2026-02')).toBe(28);
  });
  it('should return 29 for February in a leap year', () => {
    expect(daysInMonth('2028-02')).toBe(29);
  });
});

describe('currentPeriod', () => {
  it('should use Argentina time (UTC-3), not UTC', () => {
    // 01:00 UTC del 1 de noviembre = 22:00 del 31 de octubre en Argentina
    expect(currentPeriod(new Date('2026-11-01T01:00:00Z'))).toBe('2026-10');
  });
  it('should switch to the new month at midnight Argentina time', () => {
    // 03:00 UTC = 00:00 en Argentina
    expect(currentPeriod(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11');
  });
});
