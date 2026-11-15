/** Helpers for the internal route: path matching, token comparison and log masking. */
import { createHash, timingSafeEqual } from "node:crypto";

export const INTERNAL_PATH =
  /^\/(mcp-internal|readyz-internal|metrics-internal)(?:\/([^/]+))?\/?$/;

/** The token never reaches a log: `/mcp-internal/<token>` is written as `/mcp-internal/***`. */
export function maskInternalPath(path: string): string {
  return path.replace(
    /^\/(mcp-internal|readyz-internal|metrics-internal)\/[^/]+/,
    "/$1/***",
  );
}

export function tokenMatches(given: string, expected: string): boolean {
  // Compare fixed-length digests so neither length nor content leaks through timing.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
