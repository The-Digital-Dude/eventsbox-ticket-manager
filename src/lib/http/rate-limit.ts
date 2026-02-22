const bucket = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const hit = bucket.get(key);

  if (!hit || hit.resetAt < now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  if (hit.count >= max) {
    return { limited: true, retryAfterMs: hit.resetAt - now };
  }

  hit.count += 1;
  bucket.set(key, hit);
  return { limited: false };
}
