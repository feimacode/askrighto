# Ask Righto

Ask Righto answers everyday Australian questions from public data. This plugin adds the Ask Righto server to your assistant and a set of skills that tell it how to use the server: ask home or business first, read your latest bill, quote only figures that a tool returned, and always show the source link and as-of date.

Today it covers electricity and gas plans on the National Electricity Market (NSW, ACT, QLD, VIC, SA, TAS). It compares plans; it does not recommend one.

## Install

```
/plugin install askrighto --marketplace feimacode/askrighto
```

Or in Claude on the web and desktop: Customize > Plugins > Add > Add marketplace > `feimacode/askrighto`.

## What it runs, sends and fetches

- The plugin starts nothing on your computer. It declares one remote server, `https://askrighto.feimacode.com/mcp`, in `.mcp.json`. The skills are plain text.
- When you ask a question, your assistant sends the server the inputs of a tool call (a postcode, usage figures, the rates from a bill, or a smart meter readings file). The server does not store them. See the [privacy policy](https://github.com/feimacode/askrighto/blob/main/docs/legal/privacy.md).
- For a long readings file the assistant may upload it with a one-off address from `get_readings_upload_link` on the same host. The file is held in memory for the request only.
- No account, no sign-in, no ads.

## Skills

`ask-righto-grounding` (how to quote results), `energy-start`, `energy-current-plan`, `energy-readings`, `energy-compare` and `energy-plan-rates`.

## Links

[Documentation](https://github.com/feimacode/askrighto/blob/main/docs/install-plugin.md) · [Terms](https://github.com/feimacode/askrighto/blob/main/docs/legal/terms.md) · [Support](https://github.com/feimacode/askrighto/issues) · MIT licensed
