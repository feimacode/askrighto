/** Readiness checks for /readyz. Data modules add a check; liveness (/healthz) never uses them. */

export interface ReadinessResult {
  ok: boolean;
  /** Short machine-readable reason when not ok, e.g. "database_unreachable". */
  reason?: string;
}

type Check = () => Promise<ReadinessResult>;

const checks = new Map<string, Check>();

export function addReadinessCheck(name: string, check: Check): void {
  checks.set(name, check);
}

export function clearReadinessChecks(): void {
  checks.clear();
}

export async function runReadiness(): Promise<{ ok: boolean; checks: Record<string, ReadinessResult> }> {
  const results: Record<string, ReadinessResult> = {};
  let ok = true;
  for (const [name, check] of checks) {
    try {
      const r = await check();
      results[name] = r;
      if (!r.ok) ok = false;
    } catch {
      results[name] = { ok: false, reason: "check_failed" };
      ok = false;
    }
  }
  return { ok, checks: results };
}
