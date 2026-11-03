import { isPremium, pagesVisibleTo, PREVIEW_PAGES } from './premium-rules';

describe('isPremium', () => {
  const now = new Date('2026-11-03T12:00:00.000Z');

  it.each([null, undefined])(
    'should be false without an expiry date (%s)',
    (premiumUntil) => {
      expect(isPremium(premiumUntil, now)).toBe(false);
    },
  );

  it('should be true while the expiry date is in the future', () => {
    expect(isPremium(new Date('2026-12-03T12:00:00.000Z'), now)).toBe(true);
  });

  it('should be true one millisecond before the expiry', () => {
    expect(isPremium(new Date('2026-11-03T12:00:00.001Z'), now)).toBe(true);
  });

  it('should be false at the exact expiry instant', () => {
    expect(isPremium(new Date('2026-11-03T12:00:00.000Z'), now)).toBe(false);
  });

  it('should be false once the expiry date has passed', () => {
    expect(isPremium(new Date('2026-10-03T12:00:00.000Z'), now)).toBe(false);
  });
});

describe('pagesVisibleTo', () => {
  const pages = [1, 2, 3, 4, 5, 6];

  it.each([
    [false, false],
    [false, true],
    [true, true],
  ])(
    'should show every page (premium edition: %s, premium reader: %s)',
    (editionIsPremium, readerIsPremium) => {
      const result = pagesVisibleTo(pages, {
        editionIsPremium,
        readerIsPremium,
      });

      expect(result).toEqual({ pages, locked: false, totalPages: 6 });
    },
  );

  it('should show only the preview of a premium edition to a reader without premium', () => {
    const result = pagesVisibleTo(pages, {
      editionIsPremium: true,
      readerIsPremium: false,
    });

    expect(result.pages).toEqual(pages.slice(0, PREVIEW_PAGES));
    expect(result.locked).toBe(true);
    expect(result.totalPages).toBe(6);
  });

  it('should keep a short premium edition locked even if the preview covers it', () => {
    const result = pagesVisibleTo([1], {
      editionIsPremium: true,
      readerIsPremium: false,
    });

    expect(result).toEqual({ pages: [1], locked: true, totalPages: 1 });
  });

  it('should not hand back the same array it received', () => {
    const result = pagesVisibleTo(pages, {
      editionIsPremium: false,
      readerIsPremium: false,
    });

    result.pages.push(7);

    expect(pages).toEqual([1, 2, 3, 4, 5, 6]);
  });
});