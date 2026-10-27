/**
 * Open-Source Large Language Model (LLM) Service for KaagapAI
 * Supports:
 * 1. Meta Llama 3.3 / 3.1 & Mistral via Groq API (High-speed open-source inference)
 * 2. Self-hosted Local Ollama (100% offline open-source execution for Barangay desktop/server)
 * 3. OpenAI-compatible Open-Source endpoints (OpenRouter / HuggingFace)
 */

export const OPENSOURCE_MODELS = [
  {
    id: "qwen/qwen3.8-27b",
    name: "Qwen 3.8 27B (Recommended)",
    provider: "Alibaba / Groq",
    description: "Ultra-fast high-intelligence open-source model with exceptional Filipino, Taglish & English fluency",
    openSource: true,
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B (High Reasoning)",
    provider: "OpenAI / Groq",
    description: "Massive 120B parameter open-weight reasoning model hosted on Groq LPU",
    openSource: true,
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "Meta Llama 3.3 70B (Versatile)",
    provider: "Meta / Groq",
    description: "State-of-the-art open-source reasoning model by Meta, ultra-fast inference",
    openSource: true,
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Meta Llama 3.1 8B (Instant)",
    provider: "Meta / Groq",
    description: "Lightweight, ultra-low latency open-source model for quick barangay inquiries",
    openSource: true,
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Mistral 8x7B Instruct",
    provider: "Mistral AI / Groq",
    description: "Open-source mixture-of-experts model with deep instruction following",
    openSource: true,
  },
  {
    id: "ollama-local",
    name: "Ollama Local (Offline Llama / Mistral)",
    provider: "Local Server / Ollama",
    description: "100% offline self-hosted open-source model running on the barangay premises",
    openSource: true,
  },
];

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_OLLAMA_URL = "http://localhost:11434";
// Default public fallback key for Groq demonstration if user hasn't set one yet
const DEFAULT_GROQ_KEY = "gsk_KaagapAiOpenSourceLlmDefaultKey2026demo";

export function getActiveAiProvider() {
  if (typeof window !== "undefined") {
    const provider = window.localStorage.getItem("kaagapai_ai_provider");
    if (provider) return provider;
  }
  return import.meta.env?.VITE_DEFAULT_AI_PROVIDER || import.meta.env?.VITE_AI_PROVIDER || "gemini"; // "gemini" | "opensource" | "ollama"
}

export function setActiveAiProvider(provider) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("kaagapai_ai_provider", provider);
  }
}

export function getActiveOpenSourceModel() {
  if (typeof window !== "undefined") {
    const model = window.localStorage.getItem("kaagapai_opensource_model");
    if (model && model !== "llama-3.3-70b-versatile") return model;
  }
  const envModel = import.meta.env?.VITE_GROQ_MODEL || import.meta.env?.VITE_OPENSOURCE_MODEL;
  if (envModel && envModel !== "llama-3.3-70b-versatile") return envModel;
  return "qwen/qwen3.8-27b";
}

export function setActiveOpenSourceModel(model) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("kaagapai_opensource_model", model);
  }
}

export function getActiveOpenSourceApiKey() {
  if (typeof window !== "undefined") {
    const key = window.localStorage.getItem("kaagapai_opensource_api_key");
    if (key && key.trim()) return key.trim();
  }
  return import.meta.env?.VITE_GROQ_API_KEY || import.meta.env?.VITE_OPENSOURCE_API_KEY || "";
}

export function setActiveOpenSourceApiKey(key) {
  if (typeof window !== "undefined") {
    if (key && key.trim()) {
      window.localStorage.setItem("kaagapai_opensource_api_key", key.trim());
    } else {
      window.localStorage.removeItem("kaagapai_opensource_api_key");
    }
  }
}

export function getOllamaEndpoint() {
  if (typeof window !== "undefined") {
    const ep = window.localStorage.getItem("kaagapai_ollama_endpoint");
    if (ep && ep.trim()) return ep.trim();
  }
  return DEFAULT_OLLAMA_URL;
}

export function setOllamaEndpoint(endpoint) {
  if (typeof window !== "undefined") {
    if (endpoint && endpoint.trim()) {
      window.localStorage.setItem("kaagapai_ollama_endpoint", endpoint.trim());
    } else {
      window.localStorage.removeItem("kaagapai_ollama_endpoint");
    }
  }
}

/**
 * Test connectivity with selected Open-Source LLM
 */
export async function testOpenSourceConnection({ provider = "opensource", model = null, apiKey = null, endpoint = null } = {}) {
  const chosenModel = model || getActiveOpenSourceModel();

  if (provider === "ollama" || chosenModel === "ollama-local") {
    const ollamaUrl = endpoint || getOllamaEndpoint();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { success: false, message: `Ollama returned status ${res.status}. Is Ollama running on ${ollamaUrl}?` };
      }
      const data = await res.json();
      const installedModels = data?.models?.map((m) => m.name).join(", ") || "No models pulled yet";
      return {
        success: true,
        model: `Local Ollama (${installedModels.slice(0, 30)}...)`,
        message: "Ollama local open-source server connected successfully.",
      };
    } catch (err) {
      return {
        success: false,
        message: `Cannot connect to local Ollama at ${ollamaUrl}. Ensure 'ollama serve' is running.`,
      };
    }
  }

  // Cloud Open-Source inference (Groq / OpenAI compatible)
  const key = apiKey || getActiveOpenSourceApiKey();
  if (!key) {
    return {
      success: false,
      message: "No Open-Source / Groq API key configured. Provide a free key from console.groq.com.",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [{ role: "user", content: "Reply with 'OK'." }],
        max_tokens: 10,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        return {
          success: false,
          message: "Invalid Groq API Key. Please paste a free key from console.groq.com/keys, or switch to Google Gemini.",
        };
      }
      const errorText = await response.text();
      return {
        success: false,
        message: `API returned ${response.status}: ${errorText.slice(0, 100)}`,
      };
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "OK";
    return {
      success: true,
      model: chosenModel,
      reply,
      message: `Successfully connected to Open-Source model ${chosenModel}!`,
    };
  } catch (err) {
    return { success: false, message: err.message || "Connection timed out." };
  }
}

/**
 * Generates text using the configured Open-Source LLM (Groq or Ollama)
 */
export async function generateOpenSourceText(prompt, options = {}) {
  const {
    systemInstruction = "",
    temperature = 0.2,
    maxOutputTokens = 2048,
    model = getActiveOpenSourceModel(),
    timeoutMs = 9000,
  } = options;

  // 1. Ollama execution path
  if (model === "ollama-local" || getActiveAiProvider() === "ollama") {
    const endpoint = getOllamaEndpoint();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fullPrompt = systemInstruction
        ? `[SYSTEM]: ${systemInstruction}\n\n[USER]: ${prompt}`
        : prompt;

      const response = await fetch(`${endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3", // default local tag
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature,
            num_predict: maxOutputTokens,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Ollama failed with status ${response.status}`);
      }
      const data = await response.json();
      return {
        text: data.response || "",
        candidates: [{ content: { parts: [{ text: data.response || "" }] } }],
        model: "ollama-llama3",
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // 2. Groq Open-Source API path (Meta Llama 3 / Mistral)
  const apiKey = getActiveOpenSourceApiKey();
  if (!apiKey) {
    throw new Error("Missing Open-Source / Groq API key. Please configure in System Settings.");
  }

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const candidateModels = Array.from(
    new Set([model, "qwen/qwen3.8-27b", "openai/gpt-oss-20b", "openai/gpt-oss-120b", "groq/compound"])
  ).filter(Boolean);

  let lastError = null;

  for (const currentModel of candidateModels) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Qwen on Groq free tier enforces strict 1,000 OTPM; clamp to <= 750 tokens
    const clampedTokens = currentModel.includes("qwen")
      ? Math.min(maxOutputTokens || 700, 750)
      : Math.min(maxOutputTokens || 1024, 1500);

    try {
      const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: currentModel,
          messages,
          temperature,
          max_tokens: clampedTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Groq model ${currentModel} error (${response.status}): ${errText.slice(0, 140)}, trying next candidate...`);
        lastError = new Error(`Groq model ${currentModel} error (${response.status}): ${errText.slice(0, 100)}`);
        continue;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || "";
      if (content) {
        return {
          text: content,
          candidates: [{ content: { parts: [{ text: content }] } }],
          model: currentModel,
        };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      console.warn(`Groq model ${currentModel} attempt failed: ${err.message}, trying next candidate...`);
      continue;
    }
  }

  throw lastError || new Error("All open-source candidate models failed.");
}
