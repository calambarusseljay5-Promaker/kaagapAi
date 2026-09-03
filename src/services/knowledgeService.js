import { supabase } from "../lib/supabaseClient.js";
import { moveToRecycleBin } from "./recycleBinService.js";

const TABLE = "ai_knowledge_items";
const SETUP_MESSAGE =
  "AI Knowledge Trainer table is missing. Run supabase/fixes/add-ai-knowledge.sql in the Supabase SQL Editor, then refresh the app.";

const normalizeKnowledgeError = (error) => {
  const message = String(error?.message || "");
  if (
    error?.code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes(TABLE)
  ) {
    return new Error(SETUP_MESSAGE);
  }

  return error;
};

const normalizeDate = (value) => {
  if (!value) return null;
  try {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  } catch {}
  return String(value);
};

const compactText = (...values) =>
  values
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
    .map((value) => String(value).trim())
    .join("\n");

const prepareKnowledgePayload = (item = {}) => ({
  title: item.title?.trim(),
  content: item.content?.trim(),
  category: item.category || "General",
  audience: item.audience || "All Residents",
  status: item.status || "Active",
  source_type: item.source_type || "manual",
  source_id: item.source_id || null,
  effective_date: normalizeDate(item.effective_date),
  expires_at: normalizeDate(item.expires_at),
  updated_at: new Date().toISOString(),
});

const buildAnnouncementKnowledgePayload = (announcement = {}) => ({
  title: announcement.title || "Untitled announcement",
  category: announcement.category || "Announcement",
  audience: announcement.audience || "All Residents",
  status:
    announcement.status === "Published"
      ? "Active"
      : announcement.status === "Archived"
        ? "Archived"
        : "Draft",
  source_type: "announcement",
  source_id: announcement.id,
  effective_date: announcement.publish_date || null,
  expires_at: announcement.expires_at || null,
  content: compactText(
    `Announcement: ${announcement.title || "Untitled announcement"}`,
    announcement.body ? `Message: ${announcement.body}` : "",
    announcement.category ? `Category: ${announcement.category}` : "",
    announcement.audience ? `Audience: ${announcement.audience}` : "",
    announcement.publish_date ? `Publish date: ${announcement.publish_date}` : "",
    announcement.expires_at ? `Expires: ${announcement.expires_at}` : ""
  ),
});

const buildLivelihoodKnowledgePayload = (post = {}) => ({
  title: post.title || "Untitled livelihood post",
  category: post.category || "Livelihood",
  audience: "All Residents",
  status: post.status === "Open" ? "Active" : post.status === "Draft" ? "Draft" : "Archived",
  source_type: "livelihood",
  source_id: post.id,
  effective_date: null,
  expires_at: post.deadline || null,
  content: compactText(
    `${post.category || "Opportunity"}: ${post.title || "Untitled livelihood post"}`,
    post.description ? `Details: ${post.description}` : "",
    post.organization ? `Organization: ${post.organization}` : "",
    post.eligibility ? `Eligibility: ${post.eligibility}` : "",
    post.slots !== undefined && post.slots !== null ? `Slots: ${post.slots}` : "",
    post.location ? `Location: ${post.location}` : "",
    post.contact ? `Contact: ${post.contact}` : "",
    post.deadline ? `Deadline: ${post.deadline}` : "",
    post.status ? `Status: ${post.status}` : ""
  ),
});

export const isAdminInstructionItem = (item = {}) => {
  const title = String(item?.title || "").toLowerCase();
  const content = String(item?.content || "").toLowerCase();
  return (
    title.includes("administrative rules") ||
    title.includes("admin ai") ||
    title.includes("system prompt") ||
    title.includes("system instruction") ||
    title.includes("ai rules") ||
    content.includes("the barangay admin ai must follow these rules") ||
    content.includes("must follow these rules:") ||
    content.includes("do not invent information")
  );
};

export async function fetchKnowledgeItems({
  search = "",
  status = "",
  category = "",
  sourceType = "",
  residentVisible = false,
  limit = 100,
} = {}) {
  let query = supabase
    .from(TABLE)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (residentVisible) {
    query = query
      .eq("status", "Active")
      .neq("audience", "Admin Only");
  } else {
    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category", category);
    if (sourceType) query = query.eq("source_type", sourceType);
  }

  if (search?.trim()) {
    const escaped = search.trim().replace(/[%_]/g, (match) => `\\${match}`);
    query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%,category.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw normalizeKnowledgeError(error);
  if (!data) return [];

  if (residentVisible) {
    return data.filter((item) => {
      if (item.status && item.status !== "Active") return false;
      if (item.audience === "Admin Only") return false;
      if (isAdminInstructionItem(item)) return false;
      // If expires_at is set, check if expired
      if (item.expires_at) {
        try {
          const exp = new Date(item.expires_at).getTime();
          if (!isNaN(exp) && exp < Date.now() - 24 * 60 * 60 * 1000) return false;
        } catch {}
      }
      return true;
    });
  }

  return data;
}

export async function fetchResidentKnowledge(limit = 30) {
  return fetchKnowledgeItems({ residentVisible: true, limit });
}

export async function createKnowledgeItem(item) {
  const payload = prepareKnowledgePayload(item);
  if (!payload.title || !payload.content) throw new Error("Title and knowledge content are required.");

  const { data, error } = await supabase
    .from(TABLE)
    .insert([payload])
    .select()
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeKnowledgeError(error);
  return data;
}

export async function updateKnowledgeItem(id, updates) {
  if (!id) throw new Error("Knowledge item ID is required.");
  const payload = prepareKnowledgePayload(updates);
  if (!payload.title || !payload.content) throw new Error("Title and knowledge content are required.");

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq("id", id)
    .select()
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeKnowledgeError(error);
  return data;
}

export async function deleteKnowledgeItem(id) {
  if (!id) throw new Error("Knowledge item ID is required.");

  try {
    const { data: snapshot } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .limit(1)
      .maybeSingle();

    if (snapshot) {
      moveToRecycleBin("ai_knowledge_items", id, snapshot, "Admin");
    }
  } catch (err) {
    console.warn("Could not snapshot knowledge item for recycle bin:", err);
  }

  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw normalizeKnowledgeError(error);
  return true;
}

export async function deleteKnowledgeForSource(sourceType, sourceId) {
  if (!sourceType || !sourceId) return true;

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);

  if (error) throw normalizeKnowledgeError(error);
  return true;
}

export async function upsertKnowledgeItem(item) {
  const payload = prepareKnowledgePayload(item);
  if (!payload.title || !payload.content) throw new Error("Title and knowledge content are required.");
  if (!payload.source_type || !payload.source_id) {
    throw new Error("Synced knowledge needs source type and source ID.");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "source_type,source_id" })
    .select()
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeKnowledgeError(error);
  return data;
}

export async function syncKnowledgeFromAnnouncement(announcement) {
  if (!announcement?.id) return null;
  return upsertKnowledgeItem(buildAnnouncementKnowledgePayload(announcement));
}

export async function syncKnowledgeFromLivelihood(post) {
  if (!post?.id) return null;
  return upsertKnowledgeItem(buildLivelihoodKnowledgePayload(post));
}
