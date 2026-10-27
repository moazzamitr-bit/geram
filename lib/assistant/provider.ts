/**
 * Pluggable LLM adapter. Any OpenAI-compatible chat-completions endpoint works
 * (e.g. an Iranian gateway such as AvalAI, or OpenRouter). Configure with:
 *   AI_ASSISTANT_BASE_URL  e.g. https://api.avalai.ir/v1
 *   AI_ASSISTANT_API_KEY
 *   AI_ASSISTANT_MODEL     e.g. gpt-4o-mini
 */
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function providerConfigured(env = process.env): boolean {
  return Boolean(env.AI_ASSISTANT_BASE_URL && env.AI_ASSISTANT_API_KEY && env.AI_ASSISTANT_MODEL);
}

export class ProviderError extends Error {
  constructor(public code: "not_configured" | "timeout" | "upstream", message: string) {
    super(message);
  }
}

export async function completeChat(messages: ChatMessage[], timeoutMs = 25_000): Promise<string> {
  const base = process.env.AI_ASSISTANT_BASE_URL;
  const key = process.env.AI_ASSISTANT_API_KEY;
  const model = process.env.AI_ASSISTANT_MODEL;
  if (!base || !key || !model) throw new ProviderError("not_configured", "assistant provider not configured");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 600 }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new ProviderError("upstream", `upstream status ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new ProviderError("upstream", "empty completion");
    return text;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if ((err as Error)?.name === "AbortError") throw new ProviderError("timeout", "upstream timeout");
    throw new ProviderError("upstream", "upstream fetch failed");
  } finally {
    clearTimeout(timer);
  }
}
