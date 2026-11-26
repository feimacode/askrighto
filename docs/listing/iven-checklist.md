# What only Iven can do before listing

Written 26 Nov 2026 for change `add-plugin-listing-readiness`.

**Decide**
1. Confirm the MIT licence for code and skills (`LICENSE`). Data licences are separate.
2. Give a monitored support email (privacy, terms and the forms ask for one; GitHub issues is the stand-in). Confirm the governing law line in `docs/legal/terms.md` and read `docs/legal/privacy.md` against what the deployed server does (log retention in particular).
3. Replace `plugin/assets/icon.png` (placeholder "AR" square, 512 px) with real branding before the first submission: Claude keeps the first icon it sees. Also check the OpenAI category (`Productivity` chosen).
4. Say whether Gemini CLI is worth a separate public repo for the extension gallery.

**Accounts and forms**
5. Claude: paid plan with Directory permission; https://claude.ai/directory/manage > Submit new > Plugin bundle (`plugin/` folder). Submit the connector too.
6. OpenAI: verify an individual or business identity in the Platform dashboard, then upload `askrighto-chatgpt-plugin.zip`, get the domain token and the review attestations done.
7. Google: apply for the Connected Apps preview (connected.google.com/console/help/?apply); later paste the `google-connected-apps.json` text to infra.

**Infra (feima-infra)**
8. Set `ASKRIGHTO_OPENAI_CHALLENGE` (after step 6) and `ASKRIGHTO_GOOGLE_CONNECTED_APPS` (after step 7); load energy data (`npm run sync:energy`) so reviewers see real plans; confirm `/mcp` is public and energy-only.

**Evidence still missing**
9. Real installs: upload the Claude zip in Customize > Plugins, the ChatGPT zip to a portal draft, the server in Gemini Connected Apps; record what each accepts. Run `docs/skills/activation-prompts.md` on each host.
10. Demo recording and screenshots; AER licence review and the energy legal view from project notes.

**Not for this listing:** courses, health cover and home loans stay internal (home loans need the credit legal view first).
