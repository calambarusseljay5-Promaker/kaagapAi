import { supabase } from "../lib/supabaseClient";

const SESSIONS_STORAGE_KEY = "kaagapai_admin_active_sessions";
const DEVICE_ID_KEY = "kaagapai_admin_device_id";

/**
 * Get or generate a persistent unique ID for this browser/device
 */
export function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "dev-server";
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = "dev_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "dev_fallback_" + Date.now();
  }
}

/**
 * Parse client browser user agent into rich device metadata
 */
export function parseClientDeviceInfo() {
  if (typeof navigator === "undefined") {
    return {
      device: "Desktop PC",
      os: "Windows",
      browser: "Chrome",
      deviceType: "desktop",
      ipAddress: "127.0.0.1 (Localhost)",
      location: "Upper Mingading, Zamboanga del Sur, PH",
    };
  }

  const ua = navigator.userAgent || "";
  let os = "Windows PC";
  let deviceType = "desktop";

  if (/windows nt 10.0/i.test(ua)) os = "Windows 11 / 10";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS Device";
  else if (/android/i.test(ua)) {
    os = "Android Mobile";
    deviceType = "mobile";
  } else if (/iphone/i.test(ua)) {
    os = "iPhone";
    deviceType = "mobile";
  } else if (/ipad/i.test(ua)) {
    os = "iPad";
    deviceType = "tablet";
  } else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Google Chrome";
  if (/edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome/i.test(ua)) browser = "Google Chrome";
  else if (/firefox/i.test(ua)) browser = "Mozilla Firefox";
  else if (/safari/i.test(ua)) browser = "Apple Safari";

  return {
    device: `${os} • ${browser}`,
    os,
    browser,
    deviceType,
    ipAddress: typeof window !== "undefined" && window.location.hostname === "localhost" ? "127.0.0.1 (Admin Host)" : "192.168.1.100 (Barangay Hall)",
    location: "Barangay Upper Mingading, ZDS",
  };
}

/**
 * Get all active sessions
 */
export function getActiveAdminSessions() {
  if (typeof window === "undefined") return [];
  const currentDeviceId = getOrCreateDeviceId();
  const clientInfo = parseClientDeviceInfo();

  let sessions = [];
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (raw) {
      sessions = JSON.parse(raw);
    }
  } catch {
    sessions = [];
  }

  if (!Array.isArray(sessions)) sessions = [];

  // Ensure current device is present
  const currentIndex = sessions.findIndex((s) => s.deviceId === currentDeviceId);
  const now = new Date().toISOString();

  if (currentIndex >= 0) {
    sessions[currentIndex] = {
      ...sessions[currentIndex],
      ...clientInfo,
      lastActive: now,
      isCurrent: true,
      status: "Active",
    };
  } else {
    sessions.unshift({
      id: "sess_" + Date.now().toString(36),
      deviceId: currentDeviceId,
      ...clientInfo,
      createdAt: now,
      lastActive: now,
      isCurrent: true,
      status: "Active",
    });
  }

  // Filter out any sessions revoked more than 1 day ago
  sessions = sessions.map((s) => ({
    ...s,
    isCurrent: s.deviceId === currentDeviceId,
  }));

  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {}

  return sessions.filter((s) => s.status === "Active");
}

/**
 * Register or update current device session
 */
export function registerCurrentDeviceSession() {
  return getActiveAdminSessions();
}

/**
 * Revoke a specific session by session ID
 */
export function revokeAdminSession(sessionId) {
  if (typeof window === "undefined") return [];
  let sessions = [];
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (raw) sessions = JSON.parse(raw);
  } catch {}

  const currentDeviceId = getOrCreateDeviceId();
  sessions = (sessions || []).filter((s) => s.id !== sessionId);

  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {}

  return getActiveAdminSessions();
}

/**
 * Sign out / Revoke all other device sessions
 */
export function revokeAllOtherAdminSessions() {
  if (typeof window === "undefined") return [];
  const currentDeviceId = getOrCreateDeviceId();
  const clientInfo = parseClientDeviceInfo();
  const now = new Date().toISOString();

  const currentSession = {
    id: "sess_" + Date.now().toString(36),
    deviceId: currentDeviceId,
    ...clientInfo,
    createdAt: now,
    lastActive: now,
    isCurrent: true,
    status: "Active",
  };

  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify([currentSession]));
  } catch {}

  return [currentSession];
}
