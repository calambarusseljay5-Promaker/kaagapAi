import { supabase } from "../lib/supabaseClient";

const SETTINGS_KEY = "kaagapai_system_settings";
const AUDIT_LOG_KEY = "kaagapai_audit_logs";
const AI_LOG_KEY = "kaagapai_ai_logs";
const MAX_LOCAL_LOGS = 200;

export const DEFAULT_SYSTEM_SETTINGS = {
  systemName: "KaagapAI",
  barangayName: "Barangay Upper Mingading",
  adminUsername: "kaagapai",
  officeEmail: "uppermingading@gmail.com",
  officePhone: "09306259795",
  officeHours: "Monday to Friday, 8:00 AM - 5:00 PM",
  adminTheme: "favorite",
  residentPortalEnabled: true,
  aiAssistantEnabled: true,
  documentNotificationsEnabled: true,
};

const SETTINGS_UPDATED_EVENT = "kaagapai:system-settings-updated";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const readStoredItems = (key) => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const parsed = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStoredItems = (key, items) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(items));
};

const notifySettingsUpdated = (settings) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: settings }));
};

const getStoredObject = (key, fallback) => {
  const storage = getStorage();
  if (!storage) return fallback;

  try {
    return {
      ...fallback,
      ...JSON.parse(storage.getItem(key) || "{}"),
    };
  } catch {
    return fallback;
  }
};

const formatName = (value, fallback = "Unknown") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const shortId = (value) => {
  if (!value) return "No ID";
  return String(value).slice(0, 8);
};

const createActivity = ({ id, module, action, details, timestamp, source = "Database" }) => ({
  id: id || createId(),
  module,
  action,
  details,
  timestamp: timestamp || new Date().toISOString(),
  source,
});

const runQuery = async (label, query) => {
  try {
    const { data, error } = await query;
    if (error) throw error;
    return { label, data: data || [], error: null };
  } catch (error) {
    return { label, data: [], error };
  }
};

export async function fetchUserProfiles() {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,role,registration_status,resident_id,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export function getSystemSettings() {
  const settings = getStoredObject(SETTINGS_KEY, DEFAULT_SYSTEM_SETTINGS);
  return {
    ...settings,
    adminUsername: String(settings.adminUsername || DEFAULT_SYSTEM_SETTINGS.adminUsername || "kaagapai").trim(),
    adminTheme: settings.adminTheme === "light" ? "light" : "favorite",
  };
}

export function subscribeSystemSettings(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = (e) => callback(e?.detail || getSystemSettings());
  window.addEventListener(SETTINGS_UPDATED_EVENT, handler);
  return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, handler);
}

export function saveSystemSettings(settings) {
  const nextSettings = {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...settings,
    adminTheme: settings?.adminTheme === "light" ? "light" : "favorite",
    updatedAt: new Date().toISOString(),
  };

  const storage = getStorage();
  if (storage) {
    storage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
  }

  notifySettingsUpdated(nextSettings);

  recordAuditEvent({
    module: "System Settings",
    action: "Settings saved",
    details: `${nextSettings.systemName} settings were updated.`,
    source: "Local",
  });

  return nextSettings;
}

export function resetSystemSettings() {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(SETTINGS_KEY);
  }

  notifySettingsUpdated(DEFAULT_SYSTEM_SETTINGS);

  recordAuditEvent({
    module: "System Settings",
    action: "Settings reset",
    details: "System settings were restored to defaults.",
    source: "Local",
  });

  return DEFAULT_SYSTEM_SETTINGS;
}

export function getLocalAuditEvents() {
  return readStoredItems(AUDIT_LOG_KEY);
}

export function recordAuditEvent(event = {}) {
  const activity = createActivity({
    module: event.module || "System",
    action: event.action || "Activity",
    details: event.details || "",
    source: event.source || "Local",
  });

  const nextEvents = [activity, ...getLocalAuditEvents()].slice(0, MAX_LOCAL_LOGS);
  writeStoredItems(AUDIT_LOG_KEY, nextEvents);
  return activity;
}

export function clearLocalAuditEvents() {
  writeStoredItems(AUDIT_LOG_KEY, []);
}

export function getAiLogs() {
  return readStoredItems(AI_LOG_KEY);
}

export function recordAiLog(log = {}) {
  const item = {
    id: createId(),
    question: log.question || "",
    answer: log.answer || "",
    status: log.status || "success",
    durationMs: log.durationMs || 0,
    created_at: new Date().toISOString(),
  };

  const nextLogs = [item, ...getAiLogs()].slice(0, MAX_LOCAL_LOGS);
  writeStoredItems(AI_LOG_KEY, nextLogs);

  recordAuditEvent({
    module: "AI Assistant",
    action: item.status === "error" ? "Assistant error" : "Assistant answered",
    details: item.question,
    source: "AI Logs",
  });

  return item;
}

export function clearAiLogs() {
  writeStoredItems(AI_LOG_KEY, []);
}

export async function fetchAuditActivity(limit = 80) {
  const [residents, requests, announcements, livelihoodPosts, profiles] = await Promise.all([
    runQuery(
      "Residents",
      supabase
        .from("residents")
        .select("id,full_name,status,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(25)
    ),
    runQuery(
      "Document Requests",
      supabase
        .from("document_requests")
        .select("id,document_type,status,created_at,updated_at,residents(full_name)")
        .order("updated_at", { ascending: false })
        .limit(25)
    ),
    runQuery(
      "Announcements",
      supabase
        .from("announcements")
        .select("id,title,category,status,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(25)
    ),
    runQuery(
      "Livelihood",
      supabase
        .from("livelihood_posts")
        .select("id,title,category,status,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(25)
    ),
    runQuery(
      "User Profiles",
      supabase
        .from("user_profiles")
        .select("id,role,registration_status,resident_id,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(25)
    ),
  ]);

  const activities = [
    ...getLocalAuditEvents(),
    ...residents.data.map((resident) =>
      createActivity({
        id: `resident-${resident.id}`,
        module: "Residents",
        action: resident.status === "Archived" ? "Resident archived" : "Resident record saved",
        details: `${formatName(resident.full_name)} is marked ${formatName(resident.status)}.`,
        timestamp: resident.updated_at || resident.created_at,
      })
    ),
    ...requests.data.map((request) =>
      createActivity({
        id: `request-${request.id}`,
        module: "Document Requests",
        action: `${formatName(request.status)} request`,
        details: `${formatName(request.residents?.full_name, "Resident")} - ${formatName(request.document_type, "Document")}`,
        timestamp: request.updated_at || request.created_at,
      })
    ),
    ...announcements.data.map((announcement) =>
      createActivity({
        id: `announcement-${announcement.id}`,
        module: "Announcements",
        action: `${formatName(announcement.status)} announcement`,
        details: `${formatName(announcement.title)} (${formatName(announcement.category, "General")})`,
        timestamp: announcement.updated_at || announcement.created_at,
      })
    ),
    ...livelihoodPosts.data.map((post) =>
      createActivity({
        id: `livelihood-${post.id}`,
        module: "Livelihood",
        action: `${formatName(post.status)} post`,
        details: `${formatName(post.title)} (${formatName(post.category, "Program")})`,
        timestamp: post.updated_at || post.created_at,
      })
    ),
    ...profiles.data.map((profile) =>
      createActivity({
        id: `profile-${profile.id}`,
        module: "User Management",
        action: `${formatName(profile.role, "User")} profile`,
        details: `Profile ${shortId(profile.id)} is ${formatName(profile.registration_status, "Active")}.`,
        timestamp: profile.updated_at || profile.created_at,
      })
    ),
  ];

  const errors = [residents, requests, announcements, livelihoodPosts, profiles]
    .filter((result) => result.error)
    .map((result) => `${result.label}: ${result.error.message}`);

  return {
    activities: activities
      .filter((activity) => activity.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit),
    errors,
  };
}
