/** Builds synthetic NEM12 text in the layout of a real distributor export. The NMI is made up. */
export const FAKE_NMI = "4001234567";
export const FAKE_SERIAL = "SERIAL0001";

export interface Stream {
  suffix: string;
  unit?: string;
  interval?: 5 | 15 | 30;
  /** kWh per half hour for a date; default is a flat 0.25. */
  value?: (date: string, slot: number) => number;
  flag?: (date: string) => string;
  events?: (date: string) => string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

export function datesFrom(start: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function makeNem12(opts: { dates: string[]; streams: Stream[]; header?: boolean; nmi?: string; shortLast?: boolean; skip?: string[] }): string {
  const lines: string[] = [];
  if (opts.header) lines.push("100,NEM12,202611191200,MDP1,Retailer1");
  for (const s of opts.streams) {
    const interval = s.interval ?? 30;
    const per = 30 / interval;
    lines.push(`200,${opts.nmi ?? FAKE_NMI},${s.suffix},${s.suffix},${s.suffix},,${FAKE_SERIAL},${s.unit ?? "KWH"},${interval},`);
    for (const date of opts.dates) {
      if (opts.skip?.includes(date)) continue;
      const vals: string[] = [];
      for (let k = 0; k < 48; k++) {
        const v = (s.value ?? (() => 0.25))(date, k);
        for (let j = 0; j < per; j++) vals.push((v / per).toFixed(3));
      }
      const flag = s.flag?.(date) ?? "A";
      lines.push(`300,${date.replaceAll("-", "")},${vals.join(",")},${flag},,,20261120010101,`);
      for (const e of s.events?.(date) ?? []) lines.push(e);
    }
  }
  if (opts.header) lines.push("900");
  let text = lines.join("\n");
  if (opts.shortLast) text = text.replace(/,\s*$/, "");
  return text;
}
