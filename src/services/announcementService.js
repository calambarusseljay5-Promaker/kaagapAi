import { supabase } from "../lib/supabaseClient";
import {
  deleteKnowledgeForSource,
  syncKnowledgeFromAnnouncement,
} from "./knowledgeService";
import { moveToRecycleBin } from "./recycleBinService";

const TABLE = "announcements";
const SETUP_MESSAGE =
  "Announcements table is missing in Supabase. Run supabase-new-modules.sql in the Supabase SQL Editor, then refresh the app.";
const SMS_SETUP_MESSAGE =
  "Announcement SMS phone support is missing. Run supabase/fixes/add-announcement-sms-phone.sql in the Supabase SQL Editor, then refresh the app.";

const normalizeSupabaseError = (error) => {
  const message = String(error?.message || "");
  if (
    message.includes("sms_recipient_phones") ||
    message.includes("'sms_recipient_phones'")
  ) {
    return new Error(SMS_SETUP_MESSAGE);
  }

  if (
    error?.code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("announcements")
  ) {
    return new Error(SETUP_MESSAGE);
  }

  return error;
};

const preparePayload = (data = {}) => ({
  title: data.title?.trim(),
  body: data.body?.trim(),
  category: data.category || "General",
  audience: data.audience || "All Residents",
  status: data.status || "Draft",
  publish_date: data.publish_date || new Date().toISOString().slice(0, 10),
  expires_at: data.expires_at || null,
  sms_recipient_phones: data.sms_recipient_phones?.trim() || null,
  updated_at: new Date().toISOString(),
});

export async function fetchAnnouncements({ search = "", status = "", category = "", limit = 100 } = {}) {
  let query = supabase
    .from(TABLE)
    .select("*")
    .order("publish_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (category) query = query.eq("category", category);

  if (search?.trim()) {
    const escaped = search.trim().replace(/[%_]/g, (match) => `\\${match}`);
    query = query.or(`title.ilike.%${escaped}%,body.ilike.%${escaped}%,category.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw normalizeSupabaseError(error);
  return data || [];
}

export async function fetchPublishedAnnouncements(limit = 10) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .neq("status", "Archived")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      const { data: fallback, error: fbError } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (fbError) throw normalizeSupabaseError(error);
      return fallback || [];
    }
    return data || [];
  } catch (err) {
    console.warn("fetchPublishedAnnouncements fallback:", err.message);
    return [];
  }
}

export async function createAnnouncement(announcementData) {
  const payload = preparePayload(announcementData);
  if (!payload.title || !payload.body) throw new Error("Title and message are required.");

  const { data, error } = await supabase
    .from(TABLE)
    .insert([payload])
    .select()
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeSupabaseError(error);
  syncKnowledgeFromAnnouncement(data).catch((syncError) => {
    console.warn("Unable to sync announcement into AI knowledge:", syncError.message);
  });
  return data;
}

export async function updateAnnouncement(id, updates) {
  if (!id) throw new Error("Announcement ID is required.");
  const payload = preparePayload(updates);
  if (!payload.title || !payload.body) throw new Error("Title and message are required.");

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq("id", id)
    .select()
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeSupabaseError(error);
  syncKnowledgeFromAnnouncement(data).catch((syncError) => {
    console.warn("Unable to sync announcement into AI knowledge:", syncError.message);
  });
  return data;
}

export async function deleteAnnouncement(id) {
  if (!id) throw new Error("Announcement ID is required.");

  // Fetch the record snapshot first for the Recycle Bin
  const { data: record } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (record) {
    moveToRecycleBin("announcements", id, record);
  }

  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw normalizeSupabaseError(error);
  deleteKnowledgeForSource("announcement", id).catch((syncError) => {
    console.warn("Unable to delete announcement AI knowledge:", syncError.message);
  });
  return true;
}
