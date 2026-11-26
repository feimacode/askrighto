# Tasks

## 1. Metadata and assets
- [x] 1.1 Extend the config; switch the domain to askrighto.feimacode.com in plugin files, `src/config.ts`, tool source strings and docs
- [x] 1.2 Add icon, LICENSE, privacy and terms pages, plugin README

## 2. Packages
- [x] 2.1 Render Claude, ChatGPT and Gemini manifests from the config and zip them
- [x] 2.2 Add `scripts/check-plugin-zips.mjs` and tests; run `claude plugin validate --profile directory`
- [x] 2.3 Release workflow attaches the zips

## 3. Routes and docs
- [x] 3.1 Add the Google Connected Apps route with tests
- [x] 3.2 Install guide, listing kit, Gemini findings, steps for Iven

## 4. Host checks (need Iven or a signed-in host)
- [ ] 4.1 Upload the Claude zip in Customize > Plugins; record the result
- [ ] 4.2 Upload the ChatGPT zip to the portal draft; record issues
- [ ] 4.3 Add the server in Gemini Connected Apps; record the result
