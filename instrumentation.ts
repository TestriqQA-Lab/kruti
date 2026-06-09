// instrumentation.ts
// On Vercel, cron jobs are handled by vercel.json → /api/cron/* routes.
// This file is intentionally left as a no-op.

export async function register() {
  // No-op on Vercel - cron jobs run as separate HTTP invocations
}

