/**
 * Outcome counters per route and tool. Counts only: never arguments, results, course ids,
 * IP addresses or session identifiers. In memory, reset on restart, shown on the token-protected
 * metrics path.
 */
const BUCKETS_MS = [50, 200, 1000, 5000] as const;

interface ToolStats {
  outcomes: Map<string, number>;
  latency: number[]; // counts per bucket, plus one overflow
  count: number;
  sumMs: number;
}

const stats = new Map<string, ToolStats>(); // key: route + "\u0000" + tool

export function recordOutcome(route: string, tool: string, outcome: string, ms: number): void {
  const key = `${route}\u0000${tool}`;
  let s = stats.get(key);
  if (!s) {
    s = { outcomes: new Map(), latency: Array<number>(BUCKETS_MS.length + 1).fill(0), count: 0, sumMs: 0 };
    stats.set(key, s);
  }
  s.outcomes.set(outcome, (s.outcomes.get(outcome) ?? 0) + 1);
  const i = BUCKETS_MS.findIndex((b) => ms <= b);
  s.latency[i === -1 ? BUCKETS_MS.length : i]!++;
  s.count++;
  s.sumMs += ms;
}

export function resetMetrics(): void {
  stats.clear();
}

export function metricsSnapshot(): Array<{ route: string; tool: string; outcomes: Record<string, number>; count: number }> {
  return [...stats].map(([key, s]) => {
    const [route, tool] = key.split("\u0000") as [string, string];
    return { route, tool, outcomes: Object.fromEntries(s.outcomes), count: s.count };
  });
}

/** Prometheus text exposition. */
export function metricsText(): string {
  const lines = ["# TYPE askrighto_tool_outcomes_total counter"];
  for (const [key, s] of stats) {
    const [route, tool] = key.split("\u0000") as [string, string];
    for (const [outcome, n] of s.outcomes) lines.push(`askrighto_tool_outcomes_total{route="${route}",tool="${tool}",outcome="${outcome}"} ${n}`);
  }
  lines.push("# TYPE askrighto_tool_latency_ms histogram");
  for (const [key, s] of stats) {
    const [route, tool] = key.split("\u0000") as [string, string];
    let cum = 0;
    BUCKETS_MS.forEach((b, i) => {
      cum += s.latency[i]!;
      lines.push(`askrighto_tool_latency_ms_bucket{route="${route}",tool="${tool}",le="${b}"} ${cum}`);
    });
    lines.push(`askrighto_tool_latency_ms_bucket{route="${route}",tool="${tool}",le="+Inf"} ${s.count}`);
    lines.push(`askrighto_tool_latency_ms_sum{route="${route}",tool="${tool}"} ${Math.round(s.sumMs)}`);
    lines.push(`askrighto_tool_latency_ms_count{route="${route}",tool="${tool}"} ${s.count}`);
  }
  return lines.join("\n") + "\n";
}
