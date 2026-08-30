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

export async function cleanupExpiredLivelihoodPosts() {
  try {
    const { data: posts, error } = await supabase
      .from(TABLE)
      .select("*");

    if (error || !Array.isArray(posts) || posts.length === 0) return 0;

    const todayStr = new Date().toLocaleDateString("en-CA");
    const nowTime = Date.now();

    const expiredPosts = posts.filter((post) => {
      if (!post.deadline) return false;
      const deadlineDate = new Date(post.deadline.includes("T") ? post.deadline : `${post.deadline}T23:59:59`);
      if (isNaN(deadlineDate.getTime())) return false;
      return post.deadline <= todayStr || deadlineDate.getTime() <= nowTime;
    });

    if (expiredPosts.length === 0) return 0;

    for (const post of expiredPosts) {
      try {
        moveToRecycleBin(TABLE, post.id, post, `Auto-expired deadline (${post.deadline})`);
        await supabase.from(TABLE).delete().eq("id", post.id);
        deleteKnowledgeForSource("livelihood", post.id).catch(() => {});
      } catch (postErr) {
        console.warn("Failed to auto-clean single livelihood post:", postErr);
      }
    }

    return expiredPosts.length;
  } catch (err) {
    console.warn("Notice during livelihood auto-expiration cleanup:", err);
    return 0;
  }
}

export async function fetchLivelihoodPosts({ search = "", category = "", status = "", limit = 100 } = {}) {
  // Automatically cleanup expired livelihood posts into the Recycle Bin
  try {
    await cleanupExpiredLivelihoodPosts();
  } catch (e) {
    console.warn("Auto-clean livelihood notice:", e);
  }

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
    .limit(1)
    .maybeSingle();

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
    .limit(1)
    .maybeSingle();

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
    .limit(1)
    .maybeSingle();

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
    .limit(1)
    .maybeSingle();

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
    .limit(1)
    .maybeSingle();

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
    .limit(1)
    .maybeSingle();

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

export async function notifyResidentsForLivelihoodPost(post, residents = []) {
  if (!post || !residents || residents.length === 0) return 0;
  try {
    const notifications = residents
      .filter((r) => r && r.id)
      .map((r) => ({
        resident_id: r.id,
        title: `Livelihood Alert: ${post.title}`,
        message: `A new ${post.category || "Livelihood"} opportunity is now open: "${post.title}". Organization: ${post.organization || "Barangay"}. Deadline: ${post.deadline || "Open"}. Log in to your portal to apply.`,
        is_read: false,
      }));

    if (notifications.length === 0) return 0;

    // Batch insert up to 100 at a time
    const chunkSize = 100;
    for (let i = 0; i < notifications.length; i += chunkSize) {
      const chunk = notifications.slice(i, i + chunkSize);
      await supabase.from("resident_notifications").insert(chunk);
    }
    return notifications.length;
  } catch (err) {
    console.warn("Error creating resident notifications for livelihood:", err);
    return 0;
  }
}

export async function fetchPendingLivelihoodApplicationsCount() {
  try {
    const { count, error } = await supabase
      .from("livelihood_applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "Pending");

    if (error) {
      const { count: fallbackCount, error: fbErr } = await supabase
        .from("livelihood_applications")
        .select("*", { count: "exact", head: true });
      if (fbErr) return 0;
      return fallbackCount || 0;
    }
    return count || 0;
  } catch (err) {
    console.warn("Unable to fetch pending livelihood applications count:", err);
    return 0;
  }
}

export async function fetchLivelihoodApplicationsCountsGrouped() {
  try {
    const { data, error } = await supabase
      .from("livelihood_applications")
      .select("id, livelihood_post_id, status");

    if (error) {
      console.warn("Unable to fetch grouped livelihood applications counts:", error);
      return {};
    }

    const map = {};
    (data || []).forEach((app) => {
      const pId = app.livelihood_post_id;
      if (!pId) return;
      if (!map[pId]) {
        map[pId] = { total: 0, pending: 0, approved: 0, rejected: 0 };
      }
      map[pId].total += 1;
      if (app.status === "Pending") map[pId].pending += 1;
      if (app.status === "Approved") map[pId].approved += 1;
      if (app.status === "Rejected") map[pId].rejected += 1;
    });

    return map;
  } catch (err) {
    console.warn("Error calculating grouped livelihood application counts:", err);
    return {};
  }
}

