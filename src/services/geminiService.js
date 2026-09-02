const DEFAULT_GEMINI_KEY = "AIzaSyBzwJArwOpDnKgTNHldjWlpMoYIXCUPpn4";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Highly capable, top-tier supported models on Google Gemini API v1beta
export const AVAILABLE_GEMINI_MODELS = [
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Ultra-fast, high intelligence & responsive (Recommended)" },
  { id: "gemini-1.5-flash-latest", name: "Gemini 1.5 Flash (Latest)", description: "Standard lightweight & fast" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Deep reasoning, comprehensive logic & long context" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Next-gen fast multi-step task execution" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Next-gen ultra reasoning & high complexity" },
];

const DEFAULT_CANDIDATE_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

export function getActiveGeminiApiKey() {
  if (typeof window !== "undefined") {
    const customKey = window.localStorage.getItem("kaagapai_gemini_api_key");
    if (customKey && customKey.trim()) return customKey.trim();
  }
  return (
    import.meta.env?.VITE_GEMINI_API_KEY ||
    (typeof process !== "undefined" ? process.env?.VITE_GEMINI_API_KEY : "") ||
    DEFAULT_GEMINI_KEY
  );
}

export function setCustomGeminiApiKey(key) {
  if (typeof window !== "undefined") {
    if (key && key.trim()) {
      window.localStorage.setItem("kaagapai_gemini_api_key", key.trim());
    } else {
      window.localStorage.removeItem("kaagapai_gemini_api_key");
    }
  }
}

export function getActiveGeminiModel() {
  let model = "gemini-2.0-flash";
  if (typeof window !== "undefined") {
    const customModel = window.localStorage.getItem("kaagapai_gemini_model");
    if (customModel && customModel.trim()) model = customModel.trim();
    else if (import.meta.env?.VITE_GEMINI_MODEL) model = import.meta.env.VITE_GEMINI_MODEL;
  } else if (import.meta.env?.VITE_GEMINI_MODEL) {
    model = import.meta.env.VITE_GEMINI_MODEL;
  }

  // Normalize deprecated model names to prevent 404s
  if (model === "gemini-1.5-flash") return "gemini-2.0-flash";
  if (model === "gemini-1.5-flash-8b") return "gemini-2.0-flash";
  return model;
}

export function setCustomGeminiModel(model) {
  if (typeof window !== "undefined") {
    if (model && model.trim()) {
      const normalized = model === "gemini-1.5-flash" ? "gemini-2.0-flash" : model.trim();
      window.localStorage.setItem("kaagapai_gemini_model", normalized);
    } else {
      window.localStorage.removeItem("kaagapai_gemini_model");
    }
  }
}

/**
 * Quick connectivity and key validity test against Gemini API
 */
export async function testGeminiConnection(key, modelToTest) {
  const apiKey = key || getActiveGeminiApiKey();
  if (!apiKey) {
    return { success: false, message: "No API key provided." };
  }

  const model = modelToTest || getActiveGeminiModel();
  const testUrl = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(testUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Hello! Reply with 'OK'." }] }],
        generationConfig: { maxOutputTokens: 10, temperature: 0.1 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        status: response.status,
        message: `API returned ${response.status}: ${errText.slice(0, 120)}`,
      };
    }

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "OK";
    return { success: true, model, reply };
  } catch (err) {
    return { success: false, message: err.message || "Connection timed out." };
  }
}

export async function generateText(prompt, options = {}) {
  const apiKey = getActiveGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Please configure VITE_GEMINI_API_KEY or set your API key in System Settings."
    );
  }

  const activeModel = getActiveGeminiModel();
  const {
    model = activeModel,
    temperature = 0.2,
    maxOutputTokens = 2048,
    systemInstruction = "",
    fileData = null,
    timeoutMs = 8500,
  } = options;

  const userParts = [];
  if (fileData) {
    if (Array.isArray(fileData)) {
      fileData.forEach((f) => {
        if (f?.data && f?.mimeType) {
          userParts.push({
            inlineData: {
              mimeType: f.mimeType,
              data: f.data.replace(/^data:[^;]+;base64,/, ""),
            },
          });
        }
      });
    } else if (fileData.data && fileData.mimeType) {
      userParts.push({
        inlineData: {
          mimeType: fileData.mimeType,
          data: fileData.data.replace(/^data:[^;]+;base64,/, ""),
        },
      });
    }
  }

  if (prompt) {
    userParts.push({ text: prompt });
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: userParts.length > 0 ? userParts : [{ text: prompt || "" }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  // Model fallback chain: user selected model -> top tier models
  const modelsToTry = Array.from(new Set([model, ...DEFAULT_CANDIDATE_MODELS]))
    .filter(Boolean)
    .filter((m) => m !== "gemini-2.0-flash-lite");
  let lastError = null;

  for (const currentModel of modelsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${GEMINI_BASE_URL}/models/${currentModel}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        // If key is invalid or unauthorized, stop loop immediately
        if (response.status === 403 || response.status === 401) {
          throw new Error(`Gemini API Authentication Error (${response.status}): ${errorText}`);
        }
        console.warn(`Gemini model ${currentModel} returned ${response.status}, trying next model...`);
        lastError = new Error(`Gemini model ${currentModel} failed (${response.status}): ${errorText}`);
        continue;
      }

      const result = await response.json();
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      // If authentication error, no need to retry other models with same invalid key
      if (err.message?.includes("403") || err.message?.includes("401") || err.message?.includes("leaked")) {
        break;
      }
    }
  }

  throw lastError || new Error("All Gemini models failed to generate content.");
}
