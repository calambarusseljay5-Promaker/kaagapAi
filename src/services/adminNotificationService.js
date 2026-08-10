import { supabase } from "../lib/supabaseClient";

const ADMIN_NOTIFICATION_READ_KEY = "kaagapai_admin_notification_read_ids";
const NOTIFICATION_LIMIT = 12;

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const getReadNotificationIds = () => {
  const storage = getStorage();
  if (!storage) return new Set();

  try {
    const parsed = JSON.parse(storage.getItem(ADMIN_NOTIFICATION_READ_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const saveReadNotificationIds = (ids) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(ADMIN_NOTIFICATION_READ_KEY, JSON.stringify([...ids]));
};

const formatResidentMeta = (resident) =>
  [
    resident?.purok ? `Purok ${resident.purok}` : "",
    resident?.house_no ? `House ${resident.house_no}` : "",
  ]
    .filter(Boolean)
    .join(" - ");

const getResidentName = (request) => {
  const resident = Array.isArray(request?.residents) ? request.residents[0] : request?.residents;
  return resident?.full_name || "Resident";
};

const getTimeValue = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const buildNotification = (payload, readIds) => {
  const id = `${payload.type}:${payload.recordId}`;

  return {
    ...payload,
    id,
    is_read: readIds.has(id),
    sortTime: getTimeValue(payload.created_at),
  };
};

const fetchPendingResidents = async (readIds) => {
  const { data, error } = await supabase
    .from("residents")
    .select("id,full_name,purok,house_no,status,created_at,updated_at")
    .eq("status", "Pending")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) throw error;

  return (data || []).map((resident) =>
    buildNotification(
      {
        type: "resident",
        recordId: resident.id,
        title: "Resident registration",
        message: `${resident.full_name || "A resident"} is waiting for admin review.${
          formatResidentMeta(resident) ? ` ${formatResidentMeta(resident)}.` : ""
        }`,
        created_at: resident.created_at || resident.updated_at,
        source: "Residents",
        path: "/residents-management",
        tone: "amber",
      },
      readIds
    )
  );
};

const fetchPendingActivationRequests = async (readIds) => {
  const { data, error } = await supabase
    .from("resident_activation_requests")
    .select(
      "id,status,request_date,created_at,requested_full_name,requested_household_no,residents(full_name,purok,house_no,household_no)"
    )
    .eq("status", "Pending Approval")
    .order("request_date", { ascending: false })
    .limit(8);

  if (error) throw error;

  return (data || []).map((request) => {
    const resident = Array.isArray(request.residents) ? request.residents[0] : request.residents;
    const householdNo =
      request.requested_household_no || resident?.household_no || resident?.house_no || "";
    const meta = [
      resident?.purok ? `Purok ${resident.purok}` : "",
      householdNo ? `Household ${householdNo}` : "",
    ]
      .filter(Boolean)
      .join(" - ");

    return buildNotification(
      {
        type: "resident-activation",
        recordId: request.id,
        title: "Resident registration",
        message: `${resident?.full_name || request.requested_full_name || "A resident"} submitted an online registration request.${
          meta ? ` ${meta}.` : ""
        }`,
        created_at: request.request_date || request.created_at,
        source: "Online Registration",
        path: "/resident-activations",
        tone: "amber",
      },
      readIds
    );
  });
};

const fetchPendingProfileUpdateRequests = async (readIds) => {
  const { data, error } = await supabase
    .from("resident_profile_update_requests")
    .select(
      "id,status,request_date,created_at,requested_username,requested_changes,residents(full_name,purok,house_no,household_no)"
    )
    .eq("status", "Pending Approval")
    .order("request_date", { ascending: false })
    .limit(8);

  if (error) throw error;

  return (data || []).map((request) => {
    const resident = Array.isArray(request.residents) ? request.residents[0] : request.residents;
    const changedFields = [
      request.requested_username ? "username" : "",
      ...Object.keys(request.requested_changes || {}),
    ]
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    const householdNo = resident?.household_no || resident?.house_no || "";
    const meta = [
      resident?.purok ? `Purok ${resident.purok}` : "",
      householdNo ? `Household ${householdNo}` : "",
    ]
      .filter(Boolean)
      .join(" - ");

    return buildNotification(
      {
        type: "resident-profile-update",
        recordId: request.id,
        title: "Resident profile update",
        message: `${resident?.full_name || "A resident"} requested ${changedFields || "profile"} changes.${
          meta ? ` ${meta}.` : ""
        }`,
        created_at: request.request_date || request.created_at,
        source: "Profile Updates",
        path: "/resident-profile-updates",
        tone: "amber",
      },
      readIds
    );
  });
};

const fetchPendingDocumentRequests = async (readIds) => {
  const { data, error } = await supabase
    .from("document_requests")
    .select("id,document_type,status,created_at,updated_at,residents(full_name)")
    .eq("status", "Pending")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) throw error;

  return (data || []).map((request) =>
    buildNotification(
      {
        type: "document",
        recordId: request.id,
        title: "Document request",
        message: `${getResidentName(request)} requested ${request.document_type || "a document"}.`,
        created_at: request.created_at || request.updated_at,
        source: "Documents",
        path: "/documents",
        tone: "blue",
      },
      readIds
    )
  );
};

const fetchOpenLivelihoodDeadlines = async (readIds) => {
  const today = new Date();
  const limitDate = new Date(today);
  limitDate.setDate(limitDate.getDate() + 7);

  const { data, error } = await supabase
    .from("livelihood_posts")
    .select("id,title,category,status,deadline,created_at")
    .eq("status", "Open")
    .gte("deadline", today.toISOString().slice(0, 10))
    .lte("deadline", limitDate.toISOString().slice(0, 10))
    .order("deadline", { ascending: true })
    .limit(4);

  if (error) throw error;

  return (data || []).map((post) =>
    buildNotification(
      {
        type: "livelihood",
        recordId: post.id,
        title: "Livelihood deadline",
        message: `${post.title || "A livelihood post"} closes on ${post.deadline}.`,
        created_at: post.deadline || post.created_at,
        source: post.category || "Livelihood",
        path: "/livelihood",
        tone: "emerald",
      },
      readIds
    )
  );
};

const fetchPendingLivelihoodApplications = async (readIds) => {
  const { data, error } = await supabase
    .from("livelihood_applications")
    .select("id,created_at,livelihood_post_id,residents(full_name),livelihood_posts(title,category)")
    .eq("status", "Pending")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) return []; // Prevent crashing if table is not migrated yet

  return (data || []).map((app) => {
    const resident = Array.isArray(app.residents) ? app.residents[0] : app.residents;
    const post = Array.isArray(app.livelihood_posts) ? app.livelihood_posts[0] : app.livelihood_posts;
    return buildNotification(
      {
        type: "livelihood-application",
        recordId: app.id,
        title: "Livelihood Application",
        message: `${resident?.full_name || "A resident"} applied for ${post?.title || "a livelihood/job"}.`,
        created_at: app.created_at,
        source: post?.category || "Livelihood",
        path: "/livelihood",
        tone: "blue",
      },
      readIds
    );
  });
};

export async function fetchAdminNotifications() {
  const readIds = getReadNotificationIds();
  const results = await Promise.allSettled([
    fetchPendingResidents(readIds),
    fetchPendingActivationRequests(readIds),
    fetchPendingProfileUpdateRequests(readIds),
    fetchPendingDocumentRequests(readIds),
    fetchOpenLivelihoodDeadlines(readIds),
    fetchPendingLivelihoodApplications(readIds),
  ]);
  const notifications = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, NOTIFICATION_LIMIT);
  const errors = results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "A notification source failed to load.");

  return {
    notifications,
    errors,
    unreadCount: notifications.filter((notification) => !notification.is_read).length,
  };
}

export function markAdminNotificationRead(notificationId) {
  if (!notificationId) return;
  const readIds = getReadNotificationIds();
  readIds.add(notificationId);
  saveReadNotificationIds(readIds);
}

export function markAllAdminNotificationsRead(notificationIds = []) {
  const readIds = getReadNotificationIds();
  notificationIds.forEach((id) => {
    if (id) readIds.add(id);
  });
  saveReadNotificationIds(readIds);
}

export function subscribeAdminNotificationChanges(onChange) {
  const uniqueId = Math.random().toString(36).substring(2, 10);
  const channel = supabase
    .channel(`admin-notification-feed-${uniqueId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "residents" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "resident_activation_requests" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "resident_profile_update_requests" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "document_requests" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "livelihood_posts" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "livelihood_applications" }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
