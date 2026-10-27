import { supabase } from "../lib/supabaseClient";
import {
  indexKnowledgeItemWithChunks,
  chunkDocument,
  generateTextEmbedding,
} from "./aiKnowledgeRagService";
import { updateKnowledgeItem } from "./knowledgeService";

// ─── AI SETTINGS STORAGE & DEFAULTS ───
export const AI_SETTINGS_STORAGE_KEY = "kaagapai_ai_settings";
export const AI_LOGS_STORAGE_KEY = "kaagapai_ai_logs";
const AI_SETTINGS_CHANGED_EVENT = "kaagapai:ai-settings-updated";

export const DEFAULT_AI_SETTINGS = {
  id: "default",
  systemPrompt: `Ikaw si KaagapAI, ang opisyal at pinagkakatiwalaang AI Resident Virtual Assistant ng Barangay Upper Mingading, Aleosan, Cotabato.
Layunin mong tulungan ang bawat residente nang magalang, propesyonal, tumpak, at madaling maunawaan.
Gamitin ang pinakabagong kaalaman mula sa Admin Knowledge Base at mga live na talaan ng barangay upang gabayan sila sa mga serbisyo, pagkuha ng dokumento (Barangay Clearance, Certificate of Indigency, Certificate of Residency, Barangay ID, Cedula), anunsyo, at mga programang pangkabuhayan.
Igalang ang privacy ng bawat residente (RA 10173), huwag kailanman mag-imbento ng hindi umiiral na impormasyon, at panatilihin ang magalang na pakikipag-usap sa Tagalog, English, o Taglish.`,
  customInstructions: "",
  modelProvider: "groq", // "groq" | "gemini"
  modelName: "qwen/qwen3.8-27b", // Default high-intelligence model
  temperature: 0.2, // 0.0 - 1.0 (lower is more deterministic/factual)
  maxTokens: 2048,
  tone: "Taglish / Professional", // "Taglish / Professional" | "Strictly Formal" | "Friendly Community" | "Bisaya / Taglish"
  profanityFilterEnabled: true,
  antiHallucinationEnabled: true,
  dataPrivacyEnabled: true,
  customBannedWords: [],
};

// ─── 1. AI SETTINGS METHODS ───

/**
 * Loads the current AI settings from Supabase or localStorage fallback
 */
export async function getAiSettings() {
  try {
    const { data, error } = await supabase
      .from("ai_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (!error && data) {
      const parsed = {
        id: data.id,
        systemPrompt: data.system_prompt || DEFAULT_AI_SETTINGS.systemPrompt,
        customInstructions: data.custom_instructions || "",
        modelProvider: data.model_provider || DEFAULT_AI_SETTINGS.modelProvider,
        modelName: data.model_name || DEFAULT_AI_SETTINGS.modelName,
        temperature: typeof data.temperature === "number" ? data.temperature : DEFAULT_AI_SETTINGS.temperature,
        maxTokens: data.max_tokens || DEFAULT_AI_SETTINGS.maxTokens,
        tone: data.tone || DEFAULT_AI_SETTINGS.tone,
        profanityFilterEnabled: data.profanity_filter_enabled !== false,
        antiHallucinationEnabled: data.anti_hallucination_enabled !== false,
        dataPrivacyEnabled: data.data_privacy_enabled !== false,
        customBannedWords: Array.isArray(data.custom_banned_words) ? data.custom_banned_words : [],
      };
      try {
        localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
      return parsed;
    }
  } catch (err) {
    console.warn("Could not fetch ai_settings from Supabase, checking localStorage:", err.message);
  }

  // LocalStorage fallback
  try {
    const local = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (local) {
      return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(local) };
    }
  } catch {}

  return { ...DEFAULT_AI_SETTINGS };
}

/**
 * Saves updated AI settings to Supabase and localStorage
 */
export async function saveAiSettings(settings) {
  const payload = {
    id: "default",
    system_prompt: settings.systemPrompt,
    custom_instructions: settings.customInstructions || "",
    model_provider: settings.modelProvider || "groq",
    model_name: settings.modelName || "qwen/qwen3.8-27b",
    temperature: parseFloat(settings.temperature) || 0.2,
    max_tokens: parseInt(settings.maxTokens, 10) || 2048,
    tone: settings.tone || "Taglish / Professional",
    profanity_filter_enabled: settings.profanityFilterEnabled !== false,
    anti_hallucination_enabled: settings.antiHallucinationEnabled !== false,
    data_privacy_enabled: settings.dataPrivacyEnabled !== false,
    custom_banned_words: Array.isArray(settings.customBannedWords) ? settings.customBannedWords : [],
    updated_at: new Date().toISOString(),
  };

  try {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_AI_SETTINGS, ...settings }));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AI_SETTINGS_CHANGED_EVENT, { detail: settings }));
    }
  } catch {}

  try {
    const { error } = await supabase
      .from("ai_settings")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.warn("Supabase upsert ai_settings error (stored locally):", error.message);
    }
  } catch (err) {
    console.warn("Supabase ai_settings network issue:", err.message);
  }

  return { success: true, settings: { ...DEFAULT_AI_SETTINGS, ...settings } };
}

/**
 * Resets AI settings to pristine system defaults
 */
export async function resetAiSettings() {
  return await saveAiSettings(DEFAULT_AI_SETTINGS);
}

// ─── 2. AI LOGS METHODS ───

/**
 * Detects if an assistant response signifies an unanswered or low-knowledge query
 */
export function isUnansweredResponse(answerText) {
  if (!answerText) return true;
  const text = answerText.toLowerCase();

  const unknownPhrases = [
    "hindi ko pa po hawak",
    "wala pa pong patakaran",
    "hindi ko matagpuan sa aking kaalaman",
    "hindi nakatala",
    "walang nahanap na impormasyon",
    "humingi ng tulong sa barangay hall",
    "magtanong nang direkta sa tanggapan",
    "wala po sa aking kaalaman",
    "wala pa pong tala",
    "i do not have specific information",
    "no policy found",
    "please contact the barangay office directly",
    "hindi ko masagot sa kasalukuyan",
  ];

  return unknownPhrases.some((phrase) => text.includes(phrase));
}

/**
 * Records an AI conversation interaction into Supabase and local cache
 */
export async function recordAiLogEntry({
  question,
  answer = "",
  status = "success",
  residentName = "Resident",
  residentId = null,
  source = "Resident Portal",
  model = "qwen/qwen3.8-27b",
  durationMs = 0,
  matchedKnowledge = "",
}) {
  const isUnanswered = status === "unanswered" || isUnansweredResponse(answer);
  const finalStatus = status === "failed" ? "failed" : isUnanswered ? "unanswered" : "success";

  const logItem = {
    resident_id: residentId,
    resident_name: residentName,
    question: question.trim(),
    answer: (answer || "").trim(),
    status: finalStatus,
    is_unanswered: isUnanswered,
    source,
    model,
    duration_ms: durationMs,
    matched_knowledge: matchedKnowledge || null,
    created_at: new Date().toISOString(),
  };

  // 1. Cache locally for instant UI responsiveness
  try {
    const rawLogs = localStorage.getItem(AI_LOGS_STORAGE_KEY);
    const existing = rawLogs ? JSON.parse(rawLogs) : [];
    const updated = [{ ...logItem, id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` }, ...existing].slice(0, 300);
    localStorage.setItem(AI_LOGS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}

  // 2. Persist in Supabase ai_logs
  try {
    const { data, error } = await supabase
      .from("ai_logs")
      .insert([logItem])
      .select()
      .single();

    if (error) {
      console.warn("Could not insert log to Supabase ai_logs (cached locally):", error.message);
      return logItem;
    }
    return data || logItem;
  } catch (err) {
    console.warn("Record AI Log network warning:", err.message);
    return logItem;
  }
}

/**
 * Fetches AI logs with filtering by status/type
 * @param {string} filter 'all' | 'answered' | 'failed' | 'unanswered'
 * @param {string} search Keyword query
 */
export async function fetchAiLogs({ filter = "all", search = "", limit = 150 } = {}) {
  let dbLogs = [];
  try {
    let query = supabase
      .from("ai_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filter === "answered") {
      query = query.eq("status", "success");
    } else if (filter === "failed") {
      query = query.eq("status", "failed");
    } else if (filter === "unanswered") {
      query = query.or("status.eq.unanswered,is_unanswered.eq.true");
    }

    if (search.trim()) {
      query = query.or(`question.ilike.%${search.trim()}%,answer.ilike.%${search.trim()}%,resident_name.ilike.%${search.trim()}%`);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      dbLogs = data;
    }
  } catch (err) {
    console.warn("fetchAiLogs DB fallback:", err.message);
  }

  // Merge with local logs to ensure full recency
  let localLogs = [];
  try {
    const raw = localStorage.getItem(AI_LOGS_STORAGE_KEY);
    if (raw) localLogs = JSON.parse(raw);
  } catch {}

  // Combine & de-duplicate
  const combinedMap = new Map();
  dbLogs.forEach((l) => combinedMap.set(l.id || `${l.question}-${l.created_at}`, l));
  localLogs.forEach((l) => {
    const key = l.id || `${l.question}-${l.created_at}`;
    if (!combinedMap.has(key)) {
      combinedMap.set(key, l);
    }
  });

  let all = Array.from(combinedMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Apply in-memory filters if fetched with local fallback
  if (filter === "answered") {
    all = all.filter((l) => l.status === "success");
  } else if (filter === "failed") {
    all = all.filter((l) => l.status === "failed");
  } else if (filter === "unanswered") {
    all = all.filter((l) => l.status === "unanswered" || l.is_unanswered === true);
  }

  if (search.trim()) {
    const s = search.toLowerCase();
    all = all.filter(
      (l) =>
        l.question?.toLowerCase().includes(s) ||
        l.answer?.toLowerCase().includes(s) ||
        l.resident_name?.toLowerCase().includes(s)
    );
  }

  return all.slice(0, limit);
}

/**
 * Clears all AI Logs from Supabase and local storage
 */
export async function clearAllAiLogs() {
  try {
    localStorage.removeItem(AI_LOGS_STORAGE_KEY);
  } catch {}

  try {
    const { error } = await supabase.from("ai_logs").delete().neq("id", 0);
    if (error) console.warn("Clear ai_logs in Supabase warning:", error.message);
  } catch (err) {
    console.warn("Clear ai_logs network warning:", err.message);
  }

  return { success: true };
}

/**
 * Deletes a single AI log entry
 */
export async function deleteSingleAiLog(logId) {
  try {
    const raw = localStorage.getItem(AI_LOGS_STORAGE_KEY);
    if (raw) {
      const filtered = JSON.parse(raw).filter((l) => l.id !== logId);
      localStorage.setItem(AI_LOGS_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch {}

  if (typeof logId === "number" || (!String(logId).startsWith("local-") && !isNaN(Number(logId)))) {
    try {
      await supabase.from("ai_logs").delete().eq("id", logId);
    } catch {}
  }

  return { success: true };
}

// ─── 3. KNOWLEDGE VERSIONING & ROLLBACK METHODS ───

/**
 * Records a snapshot of a knowledge item into ai_knowledge_versions
 */
export async function recordKnowledgeVersionSnapshot(item, changeSummary = "Version update") {
  if (!item || !item.id) return { success: false };

  const snapshot = {
    knowledge_id: item.id,
    title: item.title,
    category: item.category || "General",
    audience: item.audience || "All Residents",
    content: item.content,
    version: item.version || "1.0",
    change_summary: changeSummary,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("ai_knowledge_versions")
      .insert([snapshot])
      .select()
      .single();

    if (error) {
      console.warn("Could not insert version snapshot to Supabase:", error.message);
    }
    return { success: true, snapshot: data || snapshot };
  } catch (err) {
    console.warn("recordKnowledgeVersionSnapshot error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Fetches all version snapshots recorded for a specific knowledge item
 */
export async function fetchKnowledgeVersions(knowledgeId) {
  if (!knowledgeId) return [];

  try {
    const { data, error } = await supabase
      .from("ai_knowledge_versions")
      .select("*")
      .eq("knowledge_id", knowledgeId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data;
    }
  } catch (err) {
    console.warn("fetchKnowledgeVersions error:", err.message);
  }

  return [];
}

/**
 * Rollback a knowledge item to a specific historical version snapshot
 */
export async function rollbackKnowledgeToVersion(currentKnowledgeId, versionSnapshot) {
  if (!currentKnowledgeId || !versionSnapshot) {
    throw new Error("Invalid parameters for version rollback.");
  }

  // 1. Take a snapshot of the current state before rolling back
  try {
    const { data: currentRecord } = await supabase
      .from("ai_knowledge")
      .select("*")
      .eq("id", currentKnowledgeId)
      .single();

    if (currentRecord) {
      await recordKnowledgeVersionSnapshot(
        currentRecord,
        `Pre-rollback snapshot before restoring v${versionSnapshot.version}`
      );
    }
  } catch {}

  // 2. Compute rollback version label (e.g. "v1.0 (Rollback from v2.0)")
  const rollbackVersionLabel = `${versionSnapshot.version} (Restored)`;

  // 3. Update active record in ai_knowledge
  const updatedItem = await updateKnowledgeItem(currentKnowledgeId, {
    title: versionSnapshot.title,
    category: versionSnapshot.category,
    audience: versionSnapshot.audience,
    content: versionSnapshot.content,
    version: rollbackVersionLabel,
    status: "Active",
    effective_date: new Date().toISOString().slice(0, 10),
  });

  // 4. Re-chunk & re-embed vector memory
  await indexKnowledgeItemWithChunks(currentKnowledgeId, versionSnapshot.title, versionSnapshot.content);

  return updatedItem;
}

/**
 * Toggles a knowledge item's publish status (Active vs Archived/Draft)
 */
export async function toggleKnowledgePublishStatus(knowledgeId, currentStatus) {
  const nextStatus = currentStatus === "Active" ? "Archived" : "Active";
  const updated = await updateKnowledgeItem(knowledgeId, {
    status: nextStatus,
    is_active: nextStatus === "Active",
  });
  return updated;
}
