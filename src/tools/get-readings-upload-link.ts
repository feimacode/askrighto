import { z } from "zod";
import { defineTool } from "../core/define-tool.js";
import { found, notFound } from "../core/grounded.js";
import { stateOfPostcode } from "../energy/benchmarks/state.js";
import { mintUploadToken, UPLOAD_TTL_SECONDS } from "../energy/readings/upload.js";
import { badPostcode, checkPostcode } from "./energy-common.js";
import { READINGS_SOURCE } from "./summarise-interval-readings.js";

const input = z.object({
  postcode: z.string().describe("Four-digit postcode of the property, so daylight saving can be applied to the readings"),
});

export interface UploadLinkData {
  postcode: string;
  uploadUrl: string;
  method: "PUT";
  expiresAt: string;
  expiresInSeconds: number;
  maxBytes: number;
  steps: string[];
}

export const getReadingsUploadLink = defineTool({
  name: "get_readings_upload_link",
  title: "Get a link to send a large readings file",
  description:
    "For a household's NEM12 interval readings file that is too long to pass to summarise_interval_readings (over about 2,000,000 characters, or longer than you can write out in one call), or when you cannot pass the file text yourself. Returns a one-off address valid for 5 minutes. Send the user's file to it with an HTTP PUT from your code environment (for example curl -T file.csv -H 'Content-Type: text/csv' ADDRESS); it answers with the profile string, which you pass unchanged as readingsProfile to compare_energy_plans. Needs your code environment to reach the address; many sandboxes block it until the user allows the domain, so if the connection is refused, tell the user and offer to retry once they have allowed it, otherwise build the profile as summarise_interval_readings describes. The file is read for the request only and not stored or logged; send nothing else to the address and never share it. Not advice.",
  inputSchema: input,
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  handler: (args) => {
    const postcode = checkPostcode(args.postcode);
    if (!postcode) return badPostcode();
    const state = stateOfPostcode(postcode);
    if (!state || state === "WA" || state === "NT") return notFound("outside_coverage", "Interval readings are used for NSW, VIC, QLD, SA, TAS and the ACT. Western Australia and the Northern Territory are outside the National Electricity Market and are not covered.");
    const t = mintUploadToken(postcode);
    const data: UploadLinkData = {
      postcode,
      uploadUrl: t.url,
      method: "PUT",
      expiresAt: t.expiresAt,
      expiresInSeconds: UPLOAD_TTL_SECONDS,
      maxBytes: t.maxBytes,
      steps: [
        `Send the user's readings file to the address with PUT within ${UPLOAD_TTL_SECONDS / 60} minutes, as text/csv, unchanged (curl -T file.csv -H 'Content-Type: text/csv' ADDRESS, or the same with your HTTP library). The file must be under ${Math.round(t.maxBytes / 1_000_000)} MB.`,
        "The reply is JSON with a profile string and a summary. Pass the profile unchanged as readingsProfile to compare_energy_plans with the same postcode and fuelType ELECTRICITY.",
        "If the connection is refused by a proxy (for example curl: (56) CONNECT tunnel failed, response 403, or a message that the host is not allowed), the host's sandbox blocks outside addresses. Tell the user plainly that the file cannot be sent until they allow this site's domain in the host's settings (in Claude on the web: Settings, Capabilities, allowed domains), and ask whether they want to do that and retry with a new address. If they do not, or the address has expired (ask again), say so and build the profile as summarise_interval_readings describes, or ask the user for a shorter period or 30-minute intervals.",
      ],
    };
    return found({ data, source: READINGS_SOURCE, asOf: new Date() });
  },
  render: (d) =>
    [
      `Upload address for the readings file (postcode ${d.postcode}), valid until ${d.expiresAt} (${d.expiresInSeconds / 60} minutes), file up to ${d.maxBytes} bytes:`,
      "",
      `${d.method} ${d.uploadUrl}`,
      "",
      ...d.steps.map((s, i) => `${i + 1}. ${s}`),
      "",
      "The file is read for this request only and not stored. Do not share the address or send anything else to it.",
    ].join("\n"),
});
