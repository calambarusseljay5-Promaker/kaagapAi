import { supabase } from "../lib/supabaseClient";
import {
  deleteKnowledgeForSource,
  syncKnowledgeFromLivelihood,
} from "./knowledgeService";
import { moveToRecycleBin } from "./recycleBinService";

const TABLE = "livelihood_posts";
const SETUP_MESSAGE =
  "Livelihood & Jobs table is missing in Supabase. Run supabase-new-modules.sql in the Supabase SQL Editor, then refresh the app.";

const normalizeSupabaseError = (error) => {
  const message = String(error?.message || "");
  if (
    error?.code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("livelihood_posts")
  ) {
    return new Error(SETUP_MESSAGE);
  }

  return error;
};

const preparePayload = (data = {}) => ({
  title: data.title?.trim(),
  category: data.category || "Program",
  organization: data.organization?.trim() || null,
  description: data.description?.trim() || null,
  eligibility: data.eligibility?.trim() || null,
  slots: data.slots === "" || data.slots == null ? null : Number(data.slots),
  location: data.location?.trim() || null,
  contact: data.contact?.trim() || null,
  status: data.status || "Open",
  deadline: data.deadline || null,
  updated_at: new Date().toISOString(),
});

export async function fetchLivelihoodPosts({ search = "", category = "", status = "", limit = 100 } = {}) {
  let query = supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);

  if (search?.trim()) {
    const escaped = search.trim().replace(/[%_]/g, (match) => `\\${match}`);
    query = query.or(
      `title.ilike.%${escaped}%,organization.ilike.%${escaped}%,description.ilike.%${escaped}%,location.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;
  if (error) throw normalizeSupabaseError(error);
  return data || [];
}

export async function createLivelihoodPost(postData) {
  const payload = preparePayload(postData);
  if (!payload.title) throw new Error("Title is required.");

  const { data, error } = await supabase
    .from(TABLE)
    .insert([payload])
    .select()
    .single();

  if (error) throw normalizeSupabaseError(error);
  syncKnowledgeFromLivelihood(data).catch((syncError) => {
    console.warn("Unable to sync livelihood post into AI knowledge:", syncError.message);
  });
  return data;
}

export async function updateLivelihoodPost(id, updates) {
  if (!id) throw new Error("Livelihood post ID is required.");
  const payload = preparePayload(updates);
  if (!payload.title) throw new Error("Title is required.");

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw normalizeSupabaseError(error);
  syncKnowledgeFromLivelihood(data).catch((syncError) => {
    console.warn("Unable to sync livelihood post into AI knowledge:", syncError.message);
  });
  return data;
}

export async function deleteLivelihoodPost(id) {
  if (!id) throw new Error("Livelihood post ID is required.");

  // Fetch the record snapshot first for the Recycle Bin
  const { data: record } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (record) {
    moveToRecycleBin("livelihood_posts", id, record);
  }

  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw normalizeSupabaseError(error);
  deleteKnowledgeForSource("livelihood", id).catch((syncError) => {
    console.warn("Unable to delete livelihood AI knowledge:", syncError.message);
  });
  return true;
}

// ------------------------------------------
// APPLICATIONS
// ------------------------------------------

export async function applyForLivelihood(livelihoodId, residentId) {
  if (!livelihoodId || !residentId) throw new Error("Missing required parameters.");

  // Check if already applied
  const { data: existing, error: checkError } = await supabase
    .from("livelihood_applications")
    .select("id")
    .eq("livelihood_post_id", livelihoodId)
    .eq("resident_id", residentId)
    .single();

  if (existing) {
    throw new Error("You have already applied for this opportunity.");
  }
  if (checkError && checkError.code !== "PGRST116") {
    throw normalizeSupabaseError(checkError);
  }

  const { data, error } = await supabase
    .from("livelihood_applications")
    .insert([{ livelihood_post_id: livelihoodId, resident_id: residentId, status: "Pending" }])
    .select()
    .single();

  if (error) throw normalizeSupabaseError(error);
  return data;
}

export async function fetchResidentLivelihoodApplications(residentId) {
  if (!residentId) return [];
  const { data, error } = await supabase
    .from("livelihood_applications")
    .select("*")
    .eq("resident_id", residentId);

  if (error) throw normalizeSupabaseError(error);
  return data || [];
}

export async function fetchLivelihoodApplications({ livelihoodId, status } = {}) {
  let query = supabase
    .from("livelihood_applications")
    .select(`
      *,
      residents(full_name, phone, email, purok, house_no)
    `)
    .order("created_at", { ascending: false });

  if (livelihoodId) query = query.eq("livelihood_post_id", livelihoodId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw normalizeSupabaseError(error);
  return data || [];
}

export async function updateLivelihoodApplicationStatus(id, newStatus, residentId, postTitle) {
  if (!id || !newStatus) throw new Error("Application ID and status are required.");

  const { data, error } = await supabase
    .from("livelihood_applications")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw normalizeSupabaseError(error);

  if (newStatus === "Approved" && residentId) {
    await supabase.from("resident_notifications").insert([{
      resident_id: residentId,
      title: "Application Approved",
      message: `You are listed. You need to visit the barangay for your verifications, and orientations etc.`
    }]);
  }

  return data;
}
