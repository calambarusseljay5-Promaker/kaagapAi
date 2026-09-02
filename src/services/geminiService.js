const DEFAULT_GEMINI_KEY = "";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Fast, ultra-responsive supported models on Google Gemini API v1beta
const DEFAULT_CANDIDATE_MODELS = [
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
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

export async function generateText(prompt, options = {}) {
  const apiKey = getActiveGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Please configure VITE_GEMINI_API_KEY or set your API key in System Settings."
    );
  }

  const {
    model = import.meta.env?.VITE_GEMINI_MODEL || "gemini-1.5-flash",
    temperature = 0.2,
    maxOutputTokens = 2048,
    systemInstruction = "",
    fileData = null,
    timeoutMs = 3500,
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

  const modelsToTry = Array.from(new Set([model, ...DEFAULT_CANDIDATE_MODELS])).filter(Boolean);
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
        // If key is invalid or leaked, stop loop immediately to avoid lagging
        if (response.status === 403 || response.status === 401) {
          throw new Error(`Gemini API Authentication Error (${response.status}): ${errorText}`);
        }
        throw new Error(`Gemini model ${currentModel} failed (${response.status}): ${errorText}`);
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
