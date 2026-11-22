/**
 * Optional scheduled CRICOS refresh, inside the server. Off unless ASKRIGHTO_CRICOS_REFRESH=on. It checks once a day
 * (cheap: one metadata request) and loads only when data.gov.au has a newer file. An advisory lock lets one instance
 * work at a time. Logs hold counts, dates and outcomes, never file content.
 */
import { createDb, dbConfig } from "../energy/db.js";
import { nextRunAt } from "../energy/schedule.js";
import { refreshCricos } from "./refresh.js";

export function startCricosSchedule(
  env: NodeJS.ProcessEnv = process.env,
  fetchFn: typeof fetch = fetch,
): (() => Promise<void>) | undefined {
  if (env.ASKRIGHTO_CRICOS_REFRESH !== "on") return undefined;
  const cfg = dbConfig(env);
  if (!cfg) return undefined;
  const db = createDb({ ...cfg, statementTimeoutMs: 60_000 });
  const [hh, mm] = (env.ASKRIGHTO_CRICOS_AT ?? "03:30")
    .split(":")
    .map(Number) as [number, number];
  const tz = env.ASKRIGHTO_SYNC_TZ ?? "Australia/Sydney";
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  const arm = () => {
    if (stopped) return;
    const wait = nextRunAt(new Date(), hh, mm, tz).getTime() - Date.now();
    timer = setTimeout(
      async () => {
        try {
          const r = await refreshCricos({
            db,
            fetch: fetchFn as never,
            log: (m) => console.error(`cricos refresh: ${m}`),
          });
          console.error(
            `cricos refresh: ${r.status}${"sourceDate" in r ? ` (file dated ${r.sourceDate})` : ""}${r.status === "aborted" ? `: ${r.reasons.join("; ")}` : ""}`,
          );
        } catch (e) {
          console.error(`cricos refresh failed: ${(e as Error).message}`);
        }
        arm();
      },
      Math.min(wait, 2 ** 31 - 1),
    );
    timer.unref();
  };
  arm();
  return async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    await db.close();
  };
}
