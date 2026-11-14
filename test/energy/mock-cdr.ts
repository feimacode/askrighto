/** A small in-process stand-in for the CDR API, serving the fixtures. */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIX = join(import.meta.dirname, "..", "fixtures", "energy");
export const fixture = (name: string): Record<string, any> => JSON.parse(readFileSync(join(FIX, `${name}.json`), "utf8"));

export interface MockPlan {
  detail: Record<string, any>;
  /** Overrides for the list item, e.g. a changed lastUpdated. */
  list?: Record<string, any>;
  /** When "FUTURE" the plan is only listed under effective=FUTURE. */
  effective?: "CURRENT" | "FUTURE";
}

export interface MockOptions {
  /** retailer slug -> plans */
  retailers: Record<string, MockPlan[]>;
  pageSize?: number;
  /** Return a status to inject for a request, or undefined to serve normally. */
  inject?: (req: { slug: string; path: string; n: number }) => { status: number; headers?: Record<string, string> } | undefined;
}

export interface MockCdr {
  url: string;
  server: Server;
  log: Array<{ slug: string; path: string; at: number; v: string | undefined }>;
  state: MockOptions;
  close(): Promise<void>;
}

export async function startMockCdr(state: MockOptions): Promise<MockCdr> {
  const log: MockCdr["log"] = [];
  let n = 0;
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const u = new URL(req.url!, "http://x");
    const m = /^\/([^/]+)\/cds-au\/v1\/energy\/plans(?:\/(.+))?$/.exec(u.pathname);
    const send = (status: number, body?: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    if (!m) return send(404);
    const slug = decodeURIComponent(m[1]!);
    log.push({ slug, path: u.pathname + u.search, at: Date.now(), v: req.headers["x-v"] as string | undefined });
    const inj = state.inject?.({ slug, path: u.pathname, n: ++n });
    if (inj) return send(inj.status, { error: "injected" }, inj.headers);
    const plans = state.retailers[slug];
    if (!plans) return send(404);
    if (m[2]) {
      const p = plans.find((x) => x.detail.planId === decodeURIComponent(m[2]!));
      return p ? send(200, { data: p.detail }) : send(404);
    }
    const eff = u.searchParams.get("effective") ?? "CURRENT";
    const items = plans
      .filter((p) => (p.effective ?? "CURRENT") === eff)
      .map((p) => ({ ...fixtureListItem(p.detail), ...p.list }));
    const size = state.pageSize ?? Number(u.searchParams.get("page-size") ?? 100);
    const page = Number(u.searchParams.get("page") ?? 1);
    const slice = items.slice((page - 1) * size, page * size);
    const next = page * size < items.length ? `http://${req.headers.host}${u.pathname}?effective=${eff}&page=${page + 1}&page-size=${size}` : undefined;
    send(200, { data: { plans: slice }, links: { self: "x", ...(next ? { next } : {}) }, meta: { totalRecords: items.length } });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}`, server, log, state, close: () => new Promise((ok) => server.close(() => ok())) };
}

function fixtureListItem(d: Record<string, any>) {
  const { planId, displayName, brandName, fuelType, type, customerType, effectiveFrom, effectiveTo, lastUpdated, geography } = d;
  return { planId, displayName, brandName, fuelType, type, customerType, effectiveFrom, effectiveTo, lastUpdated, geography };
}
