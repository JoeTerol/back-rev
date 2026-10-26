import { toCents, fromCents, applyBps, splitShare } from './money';

describe('toCents', () => {
  it('should convert a number to cents', () => {
    expect(toCents(100.1)).toBe(10010);
  });
});
it('should avoid floating point errors to cents', () => {
  expect(toCents(4.35)).toBe(435);
});

describe('fromCents', () => {
  it('should avoid floating point errors from cents', () => {
    expect(fromCents(10010)).toBe(100.1);
  });
});

describe('applyBps', () => {
  it('should calculate 50% of an amount', () => {
    expect(applyBps(100000, 5000)).toBe(50000);
  });
  it('should return a whole number of cents', () => {
    expect(applyBps(1001, 5000)).toBe(501);
  });
  it('should round half cents up even with awkward percentages', () => {
    expect(applyBps(25, 5800)).toBe(15);
  });
});
describe('splitShare', () => {
  it('should split an amount evenly', () => {
    expect(splitShare(100000, 5000)).toEqual({ platform: 50000, owner: 50000 });
  });
  it('should never lose or invent a cent', () => {
    expect(splitShare(1001, 5000)).toEqual({ platform: 501, owner: 500 });
  });
});
describe('toCents and fromCents together', () => {
  it('should return the original amount after converting there and back', () => {
    expect(fromCents(toCents(100.1))).toBe(100.1);
    expect(fromCents(toCents(4.35))).toBe(4.35);
    expect(fromCents(toCents(0.07))).toBe(0.07);
  });
});
