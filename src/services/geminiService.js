const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = import.meta.env?.VITE_GEMINI_MODEL;
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const CANDIDATE_MODELS = Array.from(
  new Set([
    GEMINI_MODEL,
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
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
    model = GEMINI_MODEL || "gemini-3.6-flash",
    temperature = 0.2,
    maxOutputTokens = 2048,
    systemInstruction = "",
  } = options;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
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
    try {
      const response = await fetch(
        `${GEMINI_BASE_URL}/models/${currentModel}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini model ${currentModel} failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.warn(`Model ${currentModel} error:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed to generate content.");
}

