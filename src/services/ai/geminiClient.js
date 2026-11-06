/**
 * Google Gemini API Provider Client (Free Tier)
 * Handles communications with the Gemini REST API, rate-limit retries,
 * model fallbacks, and provider error classification.
 */

const DEFAULT_MODEL = "gemini-2.0-flash";
const FALLBACK_MODEL = "gemini-1.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const getStoredApiKey = () => {
  if (typeof window !== "undefined") {
    // 1. Check localStorage override
    const local = localStorage.getItem("wt_gemini_api_key");
    if (local && local.trim().length > 10) return local.trim();
  }

  // 2. Check Vite environment variable
  const envKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_GEMINI_API_KEY)
    ? import.meta.env.VITE_GEMINI_API_KEY
    : (typeof process !== "undefined" ? process.env?.VITE_GEMINI_API_KEY : "");

  return envKey ? envKey.trim() : "";
};

export const setStoredApiKey = (key) => {
  if (typeof window !== "undefined") {
    if (key && key.trim()) {
      localStorage.setItem("wt_gemini_api_key", key.trim());
    } else {
      localStorage.removeItem("wt_gemini_api_key");
    }
  }
};

export const getStoredModel = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("wt_gemini_model") || DEFAULT_MODEL;
  }
  return DEFAULT_MODEL;
};

export const setStoredModel = (model) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("wt_gemini_model", model);
  }
};

/**
 * Test API key connectivity with Google Gemini
 */
export const testGeminiConnection = async (apiKey, model = DEFAULT_MODEL) => {
  const keyToTest = apiKey || getStoredApiKey();
  if (!keyToTest) {
    return { ok: false, error: "No API key provided. Please enter your Google Gemini API key." };
  }

  try {
    const url = `${API_BASE}/${model}:generateContent?key=${keyToTest}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: "Ping test. Reply with 'OK'." }] }
        ],
        generationConfig: { maxOutputTokens: 10 }
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const message = errData?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      if (res.status === 400 && message.includes("API key not valid")) {
        return { ok: false, error: "Invalid API key. Please check your key from Google AI Studio." };
      }
      if (res.status === 429) {
        return { ok: false, error: "Rate limit reached on Google Gemini free tier. Please wait a minute and retry." };
      }
      return { ok: false, error: message };
    }

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return { ok: true, model, reply: reply ? reply.trim() : "Connected" };
  } catch (err) {
    return { ok: false, error: err.message || "Network error connecting to Gemini API." };
  }
};

/**
 * Send a chat conversation to Google Gemini
 * Formats conversation history and system instructions.
 */
export const sendGeminiChat = async ({
  messages,
  systemInstruction,
  apiKey,
  model = getStoredModel(),
  temperature = 0.2
}) => {
  const activeKey = apiKey || getStoredApiKey();
  if (!activeKey) {
    throw new Error("KEY_REQUIRED: No Gemini API key found. Please configure your free Google AI Studio key.");
  }

  // Format messages for Gemini API
  // Roles must alternate user -> model -> user
  const formattedContents = [];
  messages.forEach((msg) => {
    const role = msg.role === "assistant" ? "model" : "user";
    formattedContents.push({
      role,
      parts: [{ text: msg.content }]
    });
  });

  const requestBody = {
    contents: formattedContents,
    generationConfig: {
      temperature,
      maxOutputTokens: 2500,
    }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const callApiWithModel = async (targetModel) => {
    const url = `${API_BASE}/${targetModel}:generateContent?key=${activeKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `HTTP ${res.status}: ${res.statusText}`;

      // Handle specific HTTP status codes
      if (res.status === 429) {
        throw new Error("RATE_LIMIT: Google Gemini free-tier rate limit reached (15 RPM / 1,500 RPD). Please wait a few seconds before trying again.");
      }
      if (res.status === 400 && errMsg.includes("API key not valid")) {
        throw new Error("INVALID_KEY: Your Google Gemini API key is invalid or has expired. Please update it in Settings.");
      }
      if (res.status === 404 && targetModel === DEFAULT_MODEL) {
        // Fallback to gemini-1.5-flash if 2.0 is not recognized in this region/key
        console.warn(`Model ${DEFAULT_MODEL} unavailable, falling back to ${FALLBACK_MODEL}...`);
        return callApiWithModel(FALLBACK_MODEL);
      }
      throw new Error(`API_ERROR: ${errMsg}`);
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];

    if (!candidate || !candidate.content?.parts?.[0]?.text) {
      if (candidate?.finishReason === "SAFETY") {
        throw new Error("SAFETY_BLOCK: The response was blocked by Google content safety filters.");
      }
      throw new Error("EMPTY_RESPONSE: No response content received from Gemini.");
    }

    return candidate.content.parts[0].text;
  };

  return callApiWithModel(model);
};
