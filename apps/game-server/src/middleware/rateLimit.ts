import type { NextFunction, Request, Response } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Lightweight zero-dependency IP sliding-window rate limiter for Express REST endpoints.
 */
export function createRateLimiter(opts: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const buckets = new Map<string, Bucket>();

  // Sweep expired buckets every 5 minutes to prevent unbounded memory growth
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, b] of buckets.entries()) {
      if (now >= b.resetAt) buckets.delete(ip);
    }
  }, 300_000);
  timer.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const existing = buckets.get(ip);

    if (!existing || now >= existing.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }

    if (existing.count >= opts.maxRequests) {
      const retrySec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      res.status(429).json({
        error: opts.message || "Too many requests — please wait a moment and try again.",
      });
      return;
    }

    existing.count += 1;
    next();
  };
}
