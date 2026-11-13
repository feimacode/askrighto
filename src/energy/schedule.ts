/** Next wall-clock time (hh:mm) in an IANA time zone, without a date library. */
function offsetMs(at: Date, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const local = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  return local - Math.floor(at.getTime() / 1000) * 1000;
}

export function nextRunAt(now: Date, hh: number, mm: number, tz: string): Date {
  for (let add = 0; add < 3; add++) {
    const probe = new Date(now.getTime() + add * 86_400_000);
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-AU", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts(probe)
        .map((x) => [x.type, x.value]),
    );
    const guess = Date.UTC(+p.year!, +p.month! - 1, +p.day!, hh, mm);
    // Two passes settle the offset across a daylight-saving change.
    let instant = guess - offsetMs(new Date(guess), tz);
    instant = guess - offsetMs(new Date(instant), tz);
    if (instant > now.getTime()) return new Date(instant);
  }
  throw new Error("could not compute next run");
}
