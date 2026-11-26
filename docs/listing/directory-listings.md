# Directory listings kit

Material and steps for the Claude and ChatGPT submissions (Gemini: [gemini.md](gemini.md)). Patterned on `feimacode/open-design-agent-kit` (`docs/listing/directory-listings.md`). Requirements were read from the official pages on 26 Nov 2026; links are in the last section. Change `add-plugin-listing-readiness`.

After the first listing, every release follows [docs/releasing.md](../releasing.md), whose step 5 says which listing to update.

## Shared facts

| Field | Value |
| --- | --- |
| Name | Ask Righto |
| One-liner | Compare Australian electricity and gas plans from public data, with the source and date on every figure. |
| Server URL | `https://askrighto.feimacode.com/mcp` (switch to `.com.au` later: edit the config, rebuild, re-verify the domain) |
| Documentation | https://github.com/feimacode/askrighto/blob/main/docs/install-plugin.md |
| Privacy policy | https://github.com/feimacode/askrighto/blob/main/docs/legal/privacy.md |
| Terms | https://github.com/feimacode/askrighto/blob/main/docs/legal/terms.md |
| Support | https://github.com/feimacode/askrighto/issues (an email address is better; see Iven's list) |
| Licence | MIT (code and skills); data stays under its publishers' terms |
| Data | Consumer Data Right energy plan data via the AER, AER benchmarks; no personal or health data |
| Auth | None (public, read-only, stateless) |
| Public tools | Energy only, as listed in `publicTools` in `plugin/askrighto.config.json` (nine tools; `npm run release:smoke` checks the live list against it). Courses, health cover and home loans stay on the internal route and are not in any package |
| Minors | General audience; asks for no personal details from anyone |
| Ads, commerce | None |

## Claude

The plugin folder is `plugin/` (contains `.claude-plugin/plugin.json`). Local check: `claude plugin validate --strict --profile directory ./plugin` passes. Steps:

1. A paid claude.ai plan and the Directory permission (Team and Enterprise owners can grant it).
2. https://claude.ai/directory/manage > **Submit new** > **Plugin bundle** > repository `feimacode/askrighto`, plugin folder `plugin` (the marketplace file lists two plugins; submit only `askrighto`, never `askrighto-internal`).
3. **Validate**; fix every **Blocks** finding, push, **Re-validate**. A person reviews a new listing; every version gets a security scan, which looks for undisclosed behaviour. `plugin/README.md` lists everything the plugin runs, sends and fetches.
4. Also submit the server as a connector (Claude docs: "Submit your plugin, and your MCP server as a connector", claude.com/docs/directory/publish; not read in detail, so check what it asks: usually the tool annotations, test account (none needed), and allowed link URIs).
5. Allowed link URIs: `https://askrighto.feimacode.com` only (tools return links to official pages as data, not as hosted content; confirm with the form).
6. Directory policy: https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy (read it before submitting).

## ChatGPT

Package: `askrighto-chatgpt-plugin.zip` (`plugin.json`, `mcp.json`, `skills/`, `assets/icon.png`). No hooks or app references (the portal cannot take them) and no reviewer credentials in the zip.

1. Platform dashboard: verify an individual or business identity; the submitter needs owner rights or "Apps Management Write". EU data residency projects cannot submit MCP plugins.
2. Plugins > **Upload new or existing plugin** > pick the verified developer > **Upload plugin** > the zip. Fix "Metadata & Skills" issues with **Copy issues**, then **Upload plugin to fix issues**.
3. MCP: **Connect**, check "MCP Server URL" and "Authentication" (none), complete domain verification: the portal shows a token; set it as `ASKRIGHTO_OPENAI_CHALLENGE` in feima-infra; it is served at `/.well-known/openai-apps-challenge`; connect and wait for the tool scan.
4. Review details: the test cases are already in `plugin.json` under `extensions["com.openai"].review` (five positive, three negative); add the demo recording URL (`review.demo_recording_url`), release notes are in `publication`. No credentials are needed. Complete the policy attestations. Choose countries (Australia).
5. **Submit for review**, then **Publish plugin** once approved. One review at a time; no review timeline is promised.

OpenAI rules we checked: HTTPS privacy policy that lists the data categories (done: `docs/legal/privacy.md`); support URL; tool annotations (every tool sets all three hints); no ads or promotions; no payment cards, health information, government identifiers or credentials collected; no server headers on a public submission.

## Reviewer guide (both)

1. Add the server (Claude: custom connector with the URL; ChatGPT: the uploaded draft or developer mode). No sign-in.
2. "Which electricity plans are available for a home in postcode 3000?" The assistant asks home or business, then lists plans, each with a source link and as-of date, and names no best plan.
3. "I have no bill handy, 3 people at postcode 2000, typical usage is fine." Costs come with a note that usage is typical, not the user's own.
4. "Which car insurance should I buy?" The assistant declines or says it is out of scope; no Ask Righto tool is called.

A reviewer may see `get_readings_upload_link` (a one-off address on our own host that receives only the user's own readings file, held in memory for the request). The privacy policy and plugin README say so.

## Screenshots and video (not made yet)

OpenAI wants a demo recording URL. Claude's connector form may want screenshots. Capture them from a live connector once the server is deployed with energy data loaded: the plan list, a cost comparison with source and date, and the "not advice" wording.

## Sources read

- OpenAI: developers.openai.com/plugins/build/plugins, `/deploy/submission`, `/plugin-guidelines`, `/deploy/app-review`, `/deploy/connect-chatgpt`, `/deploy/desktop-only`.
- Claude: claude.com/docs/plugins/overview, `/pre-submission-checklist`; code.claude.com/docs/en/plugins/publish and `/plugins-reference`; support.claude.com/en/articles/13837433.
- Not read: claude.com/docs/directory/publish, claude.com/docs/plugins/platform-support, OpenAI `/build/auth`, `/deploy/submission-errors`.
