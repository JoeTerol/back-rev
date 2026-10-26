export const toCents = (amount: number): number => {
  return Math.round(amount * 100);
};
export const fromCents = (cents: number): number => {
  return cents / 100;
};
export const applyBps = (amount: number, bps: number): number => {
  return Math.round((amount * bps) / 10000);
};
export const splitShare = (
  amount: number,
  bps: number,
): { platform: number; owner: number } => {
  const platform = applyBps(amount, bps);
  const owner = amount - platform;
  return { platform, owner };
};
