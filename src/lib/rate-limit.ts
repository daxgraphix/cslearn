/** Minimal in-memory sliding-window limiter. Replace with Redis/Upstash when running multiple instances. */
const hits = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { hits.set(key, arr); return { ok: false, retryAfterMs: windowMs - (now - arr[0]) }; }
  arr.push(now); hits.set(key, arr);
  return { ok: true, retryAfterMs: 0 };
}
