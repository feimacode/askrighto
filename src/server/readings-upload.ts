/**
 * PUT /readings-upload/<token>: takes an interval readings file by address (layer 2 of the readings ladder) and answers
 * with the signed profile to pass to compare_energy_plans. Nothing is stored or logged from the body; failures answer
 * with a fixed message only. The token is masked in the access log.
 */
import type { Request, Response } from "express";
import { checkUploadToken, profileFromUpload } from "../energy/readings/upload.js";
import { summaryOf } from "../tools/summarise-interval-readings.js";
import { decodeProfile } from "../energy/readings/profile.js";

export const UPLOAD_PATH = /^\/readings-upload\/([^/]+)\/?$/;

/** Reads the request body up to `max` bytes, or undefined when it is larger (the stream is then dropped). */
async function readBody(req: Request, max: number): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  let n = 0;
  for await (const c of req) {
    const b = c as Buffer;
    n += b.length;
    if (n > max) {
      req.destroy();
      return undefined;
    }
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}

const refuse = (res: Response, status: number, message: string) => {
  res.set("Cache-Control", "no-store");
  res.status(status).json({ error: message });
};

export async function handleReadingsUpload(req: Request, res: Response): Promise<void> {
  const token = UPLOAD_PATH.exec(req.path)?.[1] ?? "";
  const t = checkUploadToken(token);
  // One answer for a bad, altered or expired address, so nothing about it is confirmed.
  if (!t.ok) return refuse(res, 401, "This upload address is not valid or has expired. Ask for a new one with get_readings_upload_link.");
  if (req.method !== "PUT") {
    res.set("Allow", "PUT");
    return refuse(res, 405, "Send the file with PUT.");
  }
  // A JSON content type is consumed by the server's JSON parser before this handler runs.
  if (/json/i.test(req.headers["content-type"] ?? "")) return refuse(res, 415, "Send the file as text/csv or text/plain, not JSON.");
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > t.max) return refuse(res, 413, `The file is over ${t.max} bytes. Send a shorter period or 30-minute intervals.`);
  const body = await readBody(req, t.max);
  if (!body) return refuse(res, 413, `The file is over ${t.max} bytes. Send a shorter period or 30-minute intervals.`);
  const r = profileFromUpload(body.toString("utf8"), t.postcode, t.max);
  if (!r.ok) return refuse(res, 422, `The file could not be read: ${r.problem}.`);
  const d = decodeProfile(r.profile);
  res.set("Cache-Control", "no-store");
  const summary = d.ok ? summaryOf(d.profile, r.postcode) : undefined;
  const { profile: _p, ...rest } = summary ?? ({} as { profile?: string });
  void _p;
  res.status(200).json({ profile: r.profile, summary: rest });
}
