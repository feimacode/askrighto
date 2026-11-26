# Privacy policy

Last updated: 26 November 2026. Draft for the owner's review before the first directory submission.

This policy covers Ask Righto: the hosted server at `askrighto.feimacode.com` that your AI assistant (ChatGPT, Claude, Gemini or another) calls, and the plugin files that tell the assistant how to use it. Ask Righto is published by feimacode at [github.com/feimacode/askrighto](https://github.com/feimacode/askrighto).

## The short version

Ask Righto has no accounts, no sign-in, no stored conversations and no user profiles. What your assistant sends to our tools is used to answer that one request and is not stored. We do not sell data, show ads or use anything you send to train AI models.

## What we receive

Your assistant sends us the inputs of a tool call, for example a postcode, a household size, the kWh and days from a bill, the rates printed on a bill, or a smart meter readings file. The skills tell the assistant not to send your name, address, account number or meter identifier (NMI), and no tool asks for them. If the assistant sends such details anyway, we do not look for them and do not store them.

We do not receive your conversation with the assistant. That stays with the assistant's provider under its own privacy policy.

## What we keep

- **Inputs and results:** held in memory while the request runs, then discarded. Readings files sent to the upload address are held in memory for the request only, never written to disk, never logged.
- **Technical logs:** time, request path (with upload tokens masked), status, how long it took, the tool name and the network address used for rate limiting. Logs never contain tool inputs or results. We keep them for up to 30 days to run and protect the service. <!-- Owner: confirm the retention period matches the deployed log settings. -->
- **Counters:** counts of outcomes (for example "found" and "not found"), with no personal data.
- **Public reference data:** published energy plans and similar public datasets, which we store so answers are fast. This holds no data about you.

## Who handles data

The server runs on Microsoft Azure in Australia East, behind Cloudflare, which processes requests as our hosting provider. Your assistant's provider (OpenAI, Anthropic, Google or another) handles your conversation.

## Children

Ask Righto is a general-audience information service. It does not ask for any personal information from anyone, including people under 18, and is not directed at children under 13.

## Your choices

There is nothing to delete because we keep no personal data about you. To ask a question about this policy or report a problem, [open an issue](https://github.com/feimacode/askrighto/issues) and leave out personal details.

## Changes

We will update the date above when this policy changes.
