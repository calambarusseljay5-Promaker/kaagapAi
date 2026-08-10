/**
 * securityService.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Client-side security utilities: rate limiting, account lockout, and
 * security event logging.  All state is persisted in localStorage.
 *
 * NOTE: This is a defence-in-depth layer.  Backend-side enforcement (RLS,
 * Supabase Auth rate limits) remains the primary guard.  This module adds
 * visible UX feedback and deters casual abuse.
 * ──────────────────────────────────────────────────────────────────────────────
 */

// ─── Constants ──────────────────────────────────────────────────────────────────
const FAILED_ATTEMPTS_KEY = "kaagapai_failed_login_attempts";
const LOCKOUT_KEY = "kaagapai_account_lockouts";
const SECURITY_LOG_KEY = "kaagapai_security_logs";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_SECURITY_LOGS = 500;

// ─── Storage Helpers ────────────────────────────────────────────────────────────
const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const readJSON = (key, fallback) => {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
};

// ─── Failed Attempt Tracking ────────────────────────────────────────────────────

/**
 * Record a failed login attempt for an identifier (email / username).
 * Returns the updated count.
 */
export function recordFailedAttempt(identifier) {
  const id = normalizeId(identifier);
  const attempts = readJSON(FAILED_ATTEMPTS_KEY, {});

  const entry = attempts[id] || { count: 0, firstAttemptAt: Date.now() };
  entry.count += 1;
  entry.lastAttemptAt = Date.now();

  attempts[id] = entry;
  writeJSON(FAILED_ATTEMPTS_KEY, attempts);

  // Auto-lockout when threshold reached
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    lockAccount(id);
    logSecurityEvent("account_locked", {
      identifier: id,
      reason: `${MAX_FAILED_ATTEMPTS} consecutive failed login attempts`,
      failedCount: entry.count,
    });
  }

  return entry.count;
}

/**
 * Clear failed attempts on successful login.
 */
export function clearFailedAttempts(identifier) {
  const id = normalizeId(identifier);
  const attempts = readJSON(FAILED_ATTEMPTS_KEY, {});
  delete attempts[id];
  writeJSON(FAILED_ATTEMPTS_KEY, attempts);
}

/**
 * Get the current failed attempt count.
 */
export function getFailedAttemptCount(identifier) {
  const id = normalizeId(identifier);
  const attempts = readJSON(FAILED_ATTEMPTS_KEY, {});
  return attempts[id]?.count || 0;
}

// ─── Account Lockout ────────────────────────────────────────────────────────────

/**
 * Lock an account for the configured duration.
 */
export function lockAccount(identifier) {
  const id = normalizeId(identifier);
  const lockouts = readJSON(LOCKOUT_KEY, {});

  lockouts[id] = {
    lockedAt: Date.now(),
    expiresAt: Date.now() + LOCKOUT_DURATION_MS,
  };

  writeJSON(LOCKOUT_KEY, lockouts);
}

/**
 * Check whether an account is currently locked.
 */
export function isAccountLocked(identifier) {
  const id = normalizeId(identifier);
  const lockouts = readJSON(LOCKOUT_KEY, {});
  const entry = lockouts[id];

  if (!entry) return false;
  if (Date.now() >= entry.expiresAt) {
    // Lockout has expired — clean up
    unlockAccount(id);
    return false;
  }
  return true;
}

/**
 * Manually unlock an account (admin action or lockout expiry).
 */
export function unlockAccount(identifier) {
  const id = normalizeId(identifier);
  const lockouts = readJSON(LOCKOUT_KEY, {});
  delete lockouts[id];
  writeJSON(LOCKOUT_KEY, lockouts);

  // Also reset failed attempts
  clearFailedAttempts(id);
}

/**
 * Get the remaining lockout time in a human-readable string.
 */
export function getRemainingLockoutTime(identifier) {
  const id = normalizeId(identifier);
  const lockouts = readJSON(LOCKOUT_KEY, {});
  const entry = lockouts[id];

  if (!entry) return null;

  const remainingMs = Math.max(0, entry.expiresAt - Date.now());
  if (remainingMs <= 0) {
    unlockAccount(id);
    return null;
  }

  const minutes = Math.ceil(remainingMs / 60000);
  if (minutes <= 1) return "less than a minute";
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

/**
 * Get remaining lockout seconds (for countdown timers).
 */
export function getRemainingLockoutSeconds(identifier) {
  const id = normalizeId(identifier);
  const lockouts = readJSON(LOCKOUT_KEY, {});
  const entry = lockouts[id];

  if (!entry) return 0;

  const remainingMs = Math.max(0, entry.expiresAt - Date.now());
  if (remainingMs <= 0) {
    unlockAccount(id);
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

// ─── Security Event Logging ─────────────────────────────────────────────────────

/**
 * Log a security event.
 * @param {"login_success"|"login_failed"|"account_locked"|"account_unlocked"|"password_reset_requested"|"password_reset_completed"|"otp_sent"|"otp_verified"|"otp_failed"|"backup_created"|"backup_restored"|"backup_deleted"|"recaptcha_passed"|"recaptcha_failed"} eventType
 * @param {object} details
 */
export function logSecurityEvent(eventType, details = {}) {
  const logs = readJSON(SECURITY_LOG_KEY, []);

  const entry = {
    id: createId(),
    type: eventType,
    timestamp: new Date().toISOString(),
    details,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  };

  logs.unshift(entry);

  // Cap log size
  if (logs.length > MAX_SECURITY_LOGS) {
    logs.length = MAX_SECURITY_LOGS;
  }

  writeJSON(SECURITY_LOG_KEY, logs);
  return entry;
}

/**
 * Get all security logs.
 */
export function getSecurityLogs(limit = 100) {
  const logs = readJSON(SECURITY_LOG_KEY, []);
  return logs.slice(0, limit);
}

/**
 * Clear all security logs.
 */
export function clearSecurityLogs() {
  writeJSON(SECURITY_LOG_KEY, []);
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function normalizeId(identifier) {
  return String(identifier || "").trim().toLowerCase();
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ─── Login Gate (convenience wrapper) ───────────────────────────────────────────

/**
 * Check whether a login attempt should be allowed.
 * Returns { allowed: true } or { allowed: false, reason, remainingTime }.
 */
export function checkLoginAllowed(identifier) {
  const id = normalizeId(identifier);

  if (isAccountLocked(id)) {
    const remaining = getRemainingLockoutTime(id);
    return {
      allowed: false,
      reason: `Account temporarily locked due to too many failed login attempts. Please try again in ${remaining || "a few minutes"}.`,
      remainingTime: remaining,
    };
  }

  return { allowed: true };
}
