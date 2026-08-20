const DEFAULT_GEMINI_KEY = "AIzaSyBzwJArwOpDnKgTNHldjWlpMoYIXCUPpn4";
const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY || DEFAULT_GEMINI_KEY;
const GEMINI_MODEL = import.meta.env?.VITE_GEMINI_MODEL || "gemini-flash-lite-latest";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const CANDIDATE_MODELS = Array.from(
  new Set([
    GEMINI_MODEL,
    "gemini-flash-lite-latest",
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
  ])
).filter(Boolean);

export async function generateText(prompt, options = {}) {
  const apiKey = GEMINI_API_KEY || (typeof process !== "undefined" ? process.env?.VITE_GEMINI_API_KEY : "");
  if (!apiKey) {
    throw new Error(
      "Missing Gemini environment variable. Add VITE_GEMINI_API_KEY to your .env file."
    );
  }

  const {
    model = GEMINI_MODEL || "gemini-flash-lite-latest",
    temperature = 0.2,
    maxOutputTokens = 2048,
    systemInstruction = "",
    fileData = null,
    timeoutMs = 6000,
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

  const modelsToTry = Array.from(new Set([model, ...CANDIDATE_MODELS]));
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
        throw new Error(`Gemini model ${currentModel} failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`Model ${currentModel} attempt note:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed to generate content.");
}

