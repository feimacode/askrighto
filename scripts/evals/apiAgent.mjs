// A minimal host: an OpenAI-compatible /chat/completions loop whose function tools are the MCP
// server's tools. Not Claude, ChatGPT or Gemini; it checks the tools, their instructions and the
// grounding rules behind one model, the same way for every run.

/** One chat turn. Retries 429 and 5xx a few times. */
async function chat({ baseUrl, apiKey, body }) {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`The model endpoint returned a ${res.status} that is not JSON: ${text.slice(0, 300)}`);
      }
      // Some OpenAI-compatible endpoints answer 200 with an error object or a different shape.
      if (!data.choices?.[0]?.message) {
        const why = data.error ? JSON.stringify(data.error) : text;
        throw new Error(`The model endpoint (${url}) returned no message for model "${body.model}": ${why.slice(0, 400)}`);
      }
      return data;
    }
    lastError = new Error(`${res.status} from the model endpoint: ${(await res.text()).slice(0, 300)}`);
    if (res.status !== 429 && res.status < 500) break;
  }
  throw lastError;
}

function resultText(result) {
  const parts = (result.content ?? []).filter((c) => c.type === "text").map((c) => c.text);
  if (result.structuredContent && parts.length === 0) parts.push(JSON.stringify(result.structuredContent));
  return parts.join("\n");
}

/**
 * Runs one prompt. `callTool(name, args)` returns an MCP tool result.
 * Returns { answer, toolCalls, toolResults, turns }.
 */
export async function runPrompt({ baseUrl, apiKey, model, instructions, tools, callTool, prompt, maxTurns = 8 }) {
  const messages = [
    {
      role: "system",
      content: `${instructions ?? ""}\n\nThere is no interactive user in this run: if you need to ask something, ask it in your answer. Use the tools for every fact; never state a figure from memory.`.trim(),
    },
    { role: "user", content: prompt },
  ];
  const toolCalls = [];
  const toolResults = [];
  for (let turn = 1; turn <= maxTurns; turn++) {
    const data = await chat({ baseUrl, apiKey, body: { model, messages, tools, temperature: 0 } });
    const msg = data.choices[0].message;
    messages.push(msg);
    if (!msg.tool_calls?.length) return { answer: msg.content ?? "", toolCalls, toolResults, turns: turn };
    for (const call of msg.tool_calls) {
      let args = {};
      let text;
      try {
        args = JSON.parse(call.function.arguments || "{}");
        text = resultText(await callTool(call.function.name, args));
      } catch (e) {
        text = `Tool error: ${e instanceof Error ? e.message : e}`;
      }
      toolCalls.push({ name: call.function.name, args });
      toolResults.push(text);
      messages.push({ role: "tool", tool_call_id: call.id, content: text });
    }
  }
  const last = messages.filter((m) => m.role === "assistant").at(-1);
  return { answer: last?.content ?? "", toolCalls, toolResults, turns: maxTurns, hitTurnCap: true };
}

/** One tiny call, so a wrong URL, model id or key stops the run before it spends 80 prompts failing. */
export async function checkEndpoint({ baseUrl, apiKey, model }) {
  await chat({ baseUrl, apiKey, body: { model, messages: [{ role: "user", content: "Reply with the word ok." }], max_tokens: 16 } });
}
