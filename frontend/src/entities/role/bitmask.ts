const asBigInt = (value: number): bigint => {
  if (!Number.isFinite(value)) return 0n;
  return BigInt(Math.trunc(value));
};

export const hasPermissionFlag = (mask: number, flag: number): boolean => {
  const maskBig = asBigInt(mask);
  const flagBig = asBigInt(flag);
  if (flagBig <= 0n) return false;
  return (maskBig & flagBig) === flagBig;
};

export const combinePermissionFlags = (flags: Iterable<number>): number => {
  let next = 0n;
  for (const flag of flags) {
    const flagBig = asBigInt(flag);
    if (flagBig > 0n) {
      next |= flagBig;
    }
  }
  return Number(next);
};

export const flagsFromMask = (
  mask: number,
  flags: readonly number[],
): number[] => flags.filter((flag) => hasPermissionFlag(mask, flag));
