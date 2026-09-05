/**
 * A route id that is safe to hand to Prisma. `Number('abc')` is NaN, which
 * Prisma rejects — and because Express 4 does not catch a rejected async
 * handler, that reads to the caller as a request that never answers. Better
 * to refuse the id up front.
 */
export function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
