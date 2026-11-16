/** Readiness checks for /readyz. Data modules add a check; liveness (/healthz) never uses them. */

export interface ReadinessResult {
  ok: boolean;
  /** Short machine-readable reason when not ok, e.g. "database_unreachable". */
  reason?: string;
}

type Check = () => Promise<ReadinessResult>;

const checks = new Map<string, { check: Check; vertical?: string }>();

/** `vertical` ties a check to a vertical, so a route can report only the verticals it serves. */
export function addReadinessCheck(
  name: string,
  check: Check,
  vertical?: string,
): void {
  checks.set(name, { check, ...(vertical ? { vertical } : {}) });
}

export function clearReadinessChecks(): void {
  checks.clear();
}

/** Runs the checks that belong to no vertical plus those of the given verticals (all when omitted). */
export async function runReadiness(only?: readonly string[]): Promise<{
  ok: boolean;
  checks: Record<string, ReadinessResult & { vertical?: string }>;
}> {
  const results: Record<string, ReadinessResult & { vertical?: string }> = {};
  let ok = true;
  for (const [name, { check, vertical }] of checks) {
    if (only && vertical && !only.includes(vertical)) continue;
    try {
      const r = { ...(await check()), ...(vertical ? { vertical } : {}) };
      results[name] = r;
      if (!r.ok) ok = false;
    } catch {
      results[name] = {
        ok: false,
        reason: "check_failed",
        ...(vertical ? { vertical } : {}),
      };
      ok = false;
    }
  }
  return { ok, checks: results };
}
