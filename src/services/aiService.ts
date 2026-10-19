import { Page, ProviderStatus } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { searchableNoteText } from "./inlineImages";

export const isTauri = (): boolean => {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
};

export interface ChatServiceMessage {
  role: string;
  content: string;
}

export interface ChatServiceRequest {
  provider: string;
  endpoint?: string | null;
  api_key?: string | null;
  model: string;
  messages: ChatServiceMessage[];
  context?: string | null;
}

export interface ChatServiceResponse {
  message: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  estimated_cost_usd: number;
  model: string;
}

export interface KnowledgeSnippet {
  note_id: string;
  title: string;
  snippet: string;
  score: number;
}

/**
 * Checks connection status and retrieves available models from the local or cloud AI provider.
 */
export async function checkAIProviderStatus(
  provider: string,
  endpoint?: string
): Promise<ProviderStatus> {
  if (isTauri()) {
    try {
      return await invoke<ProviderStatus>("check_ai_provider", {
        provider,
        endpoint: endpoint || null,
      });
    } catch (e) {
      console.warn("Tauri invoke check_ai_provider failed, falling back to HTTP:", e);
    }
  }

  // Fallback for Web Browser mode
  const cleanEndpoint = endpoint?.trim().replace(/\/+$/, "") || getDefaultEndpoint(provider);

  if (provider === "ollama") {
    // Try direct localhost first, then fallback to Vite proxy if CORS intervenes
    const urls = [
      `${cleanEndpoint}/api/tags`,
      `/ollama-proxy/api/tags`,
    ];

    let lastError = "";
    for (const url of urls) {
      try {
        const res = await fetch(url, { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          const models: string[] = (data.models || []).map((m: any) => m.name || m.model);
          return {
            provider: "ollama",
            online: true,
            models,
            message: `Connected via ${url.startsWith("/") ? "Vite Proxy" : "Local Direct"}. ${models.length} model(s) ready.`,
          };
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
      }
    }

    return {
      provider: "ollama",
      online: false,
      models: [],
      message: `Failed to connect to Ollama: ${lastError}`,
    };
  }

  if (provider === "lmstudio") {
    const urls = [`${cleanEndpoint}/v1/models`, `/lmstudio-proxy/v1/models`];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const models = (data.data || []).map((m: any) => m.id);
          return {
            provider: "lmstudio",
            online: true,
            models,
            message: "Connected to LM Studio.",
          };
        }
      } catch {
        // try next
      }
    }
    return {
      provider: "lmstudio",
      online: false,
      models: [],
      message: "LM Studio offline.",
    };
  }

  if (provider === "jan") {
    const urls = [`${cleanEndpoint}/v1/models`, `/jan-proxy/v1/models`];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const models = (data.data || []).map((m: any) => m.id);
          return {
            provider: "jan",
            online: true,
            models,
            message: "Connected to Jan.",
          };
        }
      } catch {
        // try next
      }
    }
    return {
      provider: "jan",
      online: false,
      models: [],
      message: "Jan offline.",
    };
  }

  return {
    provider,
    online: true,
    models: provider === "gemini" ? ["gemini-2.5-flash"] : provider === "openai" ? ["gpt-4o-mini"] : [],
    message: "Cloud provider ready.",
  };
}

/**
 * Searches user's workspace notes using local keyword/semantic scoring.
 */
export async function searchWorkspaceNotes(
  query: string,
  pages: Page[],
  maxResults: number = 3,
  embeddingEndpoint?: string | null
): Promise<KnowledgeSnippet[]> {
  if (isTauri()) {
    try {
      const notesPayload = pages.map((p) => ({
        id: p.id,
        title: p.title,
        content: searchableNoteText(p.content),
        updated_at: p.updatedAt,
      }));
      return await invoke<KnowledgeSnippet[]>("search_workspace_knowledge", {
        query,
        notes: notesPayload,
        maxResults,
        endpoint: embeddingEndpoint || null,
      });
    } catch (e) {
      console.warn("Tauri RAG search fallback:", e);
    }
  }

  // Client-side RAG search
  const terms = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(term => term.length > 1);
  if (terms.length === 0 || pages.length === 0) return [];

  const scored: KnowledgeSnippet[] = [];

  for (const page of pages) {
    const titleLower = page.title.toLowerCase();
    const searchableContent = searchableNoteText(page.content);
    const contentLower = searchableContent.toLowerCase();
    let score = 0;

    for (const term of terms) {
      if (titleLower.includes(term)) {
        score += 5.0;
      }
      let matches = 0;
      for (let at = contentLower.indexOf(term); at !== -1; at = contentLower.indexOf(term, at + term.length)) matches++;
      score += matches * 1.5;
    }

    if (score > 0) {
      // Find matching index to extract snippet
      let matchIdx = -1;
      for (const term of terms) {
        const idx = contentLower.indexOf(term);
        if (idx !== -1) {
          matchIdx = idx;
          break;
        }
      }

      const start = Math.max(0, matchIdx - 50);
      const end = Math.min(searchableContent.length, (matchIdx === -1 ? 0 : matchIdx) + 180);
      const prefix = start > 0 ? "..." : "";
      const suffix = end < page.content.length ? "..." : "";
      const snippet = `${prefix}${searchableContent.substring(start, end).trim()}${suffix}`;

      scored.push({
        note_id: page.id,
        title: page.title,
        snippet,
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

/**
 * Sends chat request with RAG context to the selected AI provider.
 */
export async function sendAIChatRequest(
  request: ChatServiceRequest
): Promise<ChatServiceResponse> {
  if (isTauri()) {
    return invoke<ChatServiceResponse>("chat_with_ai", { request });
  }

  if (request.provider === "gemini") throw new Error("Use Gemini in the desktop app. Browser preview does not support the Gemini protocol.");

  // Web Browser fallback
  const start = performance.now();
  const endpoint = request.endpoint?.trim().replace(/\/+$/, "") || getDefaultEndpoint(request.provider);

  if (request.provider === "ollama") {
    const messages = [...request.messages];
    if (request.context && request.context.trim()) {
      messages.unshift({
        role: "system",
        content: `You are Smart Time AI Assistant. Use the following relevant knowledge from the user's workspace notes to answer accurately:\n\n---\n${request.context}\n---\nAnswer clearly and directly. If the context does not contain the answer, state so politely.`,
      });
    }

    const payload = {
      model: request.model || "llama3.2",
      messages,
      stream: false,
    };

    const urls = [
      `${endpoint}/api/chat`,
      `/ollama-proxy/api/chat`,
    ];

    let lastErr = "";
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const json = await res.json();
          const latency_ms = Math.round(performance.now() - start);
          const promptTokens = json.prompt_eval_count || 0;
          const completionTokens = json.eval_count || 0;
          const totalTokens = promptTokens + completionTokens || Math.round((json.message?.content?.length || 0) / 3);

          return {
            message: json.message?.content || "(Empty response)",
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
            latency_ms,
            estimated_cost_usd: 0,
            model: request.model,
          };
        } else {
          lastErr = await res.text();
        }
      } catch (e: any) {
        lastErr = e?.message || String(e);
      }
    }

    throw new Error(`Ollama request failed: ${lastErr}`);
  }

  // OpenAI / Compatible standard (LM Studio, Jan, OpenAI)
  const messages = [...request.messages];
  if (request.context && request.context.trim()) {
    messages.unshift({
      role: "system",
      content: `Workspace Context:\n${request.context}`,
    });
  }

  const urls = [
    `${endpoint}/v1/chat/completions`,
    `/${request.provider}-proxy/v1/chat/completions`,
  ];

  let lastErr = "";
  for (const url of urls) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (request.api_key) {
        headers["Authorization"] = `Bearer ${request.api_key}`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: request.model,
          messages,
          stream: false,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const latency_ms = Math.round(performance.now() - start);
        const choice = json.choices?.[0];
        const content = choice?.message?.content || "";
        const usage = json.usage || {};

        return {
          message: content,
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0,
          latency_ms,
          estimated_cost_usd: 0,
          model: request.model,
        };
      } else {
        lastErr = await res.text();
      }
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }

  throw new Error(`AI Request failed: ${lastErr}`);
}

function getDefaultEndpoint(provider: string): string {
  switch (provider) {
    case "ollama":
      return "http://localhost:11434";
    case "lmstudio":
      return "http://localhost:1234";
    case "jan":
      return "http://localhost:1337";
    default:
      return "https://api.openai.com";
  }
}
