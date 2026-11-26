// Post-deploy check of a running Ask Righto server.
//
//   npm run release:smoke -- <base url> [expected version]
//   npm run release:smoke -- https://askrighto.feimacode.com 0.2.0
//
// Fails unless /healthz is ok (and reports the expected version when given) and /mcp lists exactly
// the public tools in plugin/askrighto.config.json, each read-only and not destructive. A tool from
// an internal vertical on the public route fails the check by name.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const ROOT = resolve(import.meta.dirname, "..");

export async function smoke(base, expectedVersion, publicTools) {
  const problems = [];
  const url = base.replace(/\/+$/, "");
  const health = await fetch(`${url}/healthz`).catch((e) => ({ ok: false, statusText: e.message }));
  if (!health.ok) problems.push(`/healthz: ${health.status ?? ""} ${health.statusText}`);
  else {
    const h = await health.json();
    if (!h.ok) problems.push("/healthz: ok is not true");
    if (expectedVersion && h.version !== expectedVersion)
      problems.push(`/healthz: version ${h.version}, expected ${expectedVersion}`);
  }
  const client = new Client({ name: "release-smoke", version: "0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`)));
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    const want = [...publicTools].sort();
    for (const n of names) if (!want.includes(n)) problems.push(`/mcp lists ${n}, which is not public`);
    for (const n of want) if (!names.includes(n)) problems.push(`/mcp is missing ${n}`);
    for (const t of tools)
      if (t.annotations?.readOnlyHint !== true || t.annotations?.destructiveHint !== false)
        problems.push(`${t.name}: must be readOnlyHint true and destructiveHint false`);
    await client.close();
  } catch (e) {
    problems.push(`/mcp: ${e.message}`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [base, version] = process.argv.slice(2);
  if (!base) {
    console.error("usage: npm run release:smoke -- <base url> [expected version]");
    process.exit(1);
  }
  const config = JSON.parse(readFileSync(join(ROOT, "plugin/askrighto.config.json"), "utf8"));
  const problems = await smoke(base, version, config.publicTools);
  if (problems.length) {
    console.error(problems.map((p) => `- ${p}`).join("\n"));
    process.exit(1);
  }
  console.log(`smoke ok: ${base}${version ? ` at ${version}` : ""}, ${config.publicTools.length} public tools`);
}
