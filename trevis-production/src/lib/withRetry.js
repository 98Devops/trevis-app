/**
 * Retry a transient async operation that returns a Supabase-style { data, error }
 * result (or throws). Linear backoff. READ-ONLY use only — never wrap a write
 * (a retried insert/update could double-apply). The billing engine is untouched;
 * this lives at the app's data-load boundary so a brief network blip self-heals
 * instead of surfacing as an error/blank screen.
 *
 * @param {() => Promise<any>} fn  async fn returning { data, error } (or throwing)
 * @param {{ tries?: number, baseDelayMs?: number }} [opts]
 */
export async function withRetry(fn, { tries = 3, baseDelayMs = 400 } = {}) {
  let last;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fn();
      if (!res || !res.error) return res; // success (or a non-error shape)
      last = res;
    } catch (err) {
      last = { data: null, error: err };
    }
    if (attempt < tries) {
      await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
    }
  }
  return last;
}
