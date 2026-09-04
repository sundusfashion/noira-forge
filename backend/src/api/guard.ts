import { z } from 'zod';

// All inbound payloads validated. Nothing touches the entity without a schema.
export const CommandSchema = z.object({ command: z.string().min(1).max(2000) });
export const ChatSchema = z.object({
  message: z.string().min(1).max(2000),
  visitorId: z.string().max(64).optional(),
});
export const InvestSchema = z.object({
  amountCents: z.number().int().min(1000).max(100000),
  buyer: z.string().min(1).max(80),
});
export const SpawnSchema = z.object({
  name: z.string().min(2).max(80),
  purpose: z.string().max(500).optional(),
  capitalCents: z.number().int().min(0).max(100_000_000),
});
export const DreamSchema = z.object({ iterations: z.number().int().min(10).max(1000).optional() });

// Token-bucket per IP. Free-tier friendly: in-memory, no Redis needed.
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; last: number }>();
  constructor(private capacity = 60, private refillPerSec = 1) {}

  allow(key: string): boolean {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) { b = { tokens: this.capacity, last: now }; this.buckets.set(key, b); }
    const elapsed = (now - b.last) / 1000;
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillPerSec);
    b.last = now;
    // periodic cleanup
    if (this.buckets.size > 5000 && Math.random() < 0.01) {
      for (const [k, v] of this.buckets) if (now - v.last > 600_000) this.buckets.delete(k);
    }
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }
}

export function clientIp(req: { headers: any; socket: any }): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim().slice(0, 64);
  return (req.socket?.remoteAddress || 'local').slice(0, 64);
}
