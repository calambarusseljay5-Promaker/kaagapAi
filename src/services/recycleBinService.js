/**
 * recycleBinService.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Client-side Recycle Bin system for soft-deleting records.
 *
 * How it works:
 *   1. Before a record is permanently deleted from Supabase, a snapshot of it
 *      is saved to localStorage keyed by table name + record ID.
 *   2. The record is then deleted from Supabase as normal.
 *   3. The admin can browse the recycle bin, restore items (re-insert into
 *      Supabase), or permanently clear them.
 *   4. Items older than the retention period are auto-purged on load.
 *
 * Supported tables: announcements, livelihood_posts, document_requests
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from "../lib/supabaseClient";
import { recordAuditEvent } from "./adminActivityService";

// ─── Constants ──────────────────────────────────────────────────────────────────
const RECYCLE_BIN_KEY = "kaagapai_recycle_bin";
const RECYCLE_BIN_SETTINGS_KEY = "kaagapai_recycle_bin_settings";
const MAX_RECYCLE_ITEMS = 500;

const DEFAULT_SETTINGS = {
  retentionDays: 30,
  autoCleanEnabled: true,
};

const TABLE_DISPLAY_NAMES = {
  announcements: "Announcement",
  livelihood_posts: "Livelihood & Jobs",
  document_requests: "Document Request",
  document_templates: "Document Template",
  ai_knowledge_items: "AI Knowledge Item",
  residents: "Resident Record",
};

const TABLE_RESTORE_EXCLUDE_COLUMNS = new Set([
  "created_at",
  "updated_at",
]);

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

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// ─── Recycle Bin Settings ───────────────────────────────────────────────────────

export function getRecycleBinSettings() {
  return { ...DEFAULT_SETTINGS, ...readJSON(RECYCLE_BIN_SETTINGS_KEY, {}) };
}

export function saveRecycleBinSettings(settings) {
  const next = { ...DEFAULT_SETTINGS, ...settings };
  writeJSON(RECYCLE_BIN_SETTINGS_KEY, next);
  return next;
}

// ─── Core Operations ────────────────────────────────────────────────────────────

/**
 * Move a record to the recycle bin (soft delete).
 * Call this BEFORE actually deleting from Supabase.
 *
 * @param {string} tableName - The Supabase table name
 * @param {string} recordId - The record's primary key (id)
 * @param {object} recordSnapshot - The full record data to preserve
 * @param {string} [deletedBy] - Optional identifier of who deleted it
 */
export function moveToRecycleBin(tableName, recordId, recordSnapshot, deletedBy = "Admin") {
  const bin = readJSON(RECYCLE_BIN_KEY, []);

  // Check for duplicate
  const alreadyExists = bin.some(
    (item) => item.tableName === tableName && item.recordId === String(recordId)
  );
  if (alreadyExists) return;

  const entry = {
    id: createId(),
    tableName,
    recordId: String(recordId),
    displayName: TABLE_DISPLAY_NAMES[tableName] || tableName,
    title: extractTitle(tableName, recordSnapshot),
    snapshot: recordSnapshot,
    deletedAt: new Date().toISOString(),
    deletedBy,
    expiresAt: new Date(
      Date.now() + getRecycleBinSettings().retentionDays * 86400000
    ).toISOString(),
  };

  bin.unshift(entry);

  // Cap size
  if (bin.length > MAX_RECYCLE_ITEMS) {
    bin.length = MAX_RECYCLE_ITEMS;
  }

  writeJSON(RECYCLE_BIN_KEY, bin);

  recordAuditEvent({
    module: "Recycle Bin",
    action: "Record moved to Recycle Bin",
    details: `${entry.displayName}: "${entry.title}" (ID: ${recordId})`,
    source: "Local",
  });
}

/**
 * Restore a record from the recycle bin back to Supabase.
 * @param {string} binEntryId - The recycle bin entry ID
 * @returns {Promise<object>} The restored record
 */
export async function restoreFromRecycleBin(binEntryId) {
  const bin = readJSON(RECYCLE_BIN_KEY, []);
  const entryIndex = bin.findIndex((item) => item.id === binEntryId);

  if (entryIndex === -1) {
    throw new Error("Item not found in Recycle Bin.");
  }

  const entry = bin[entryIndex];
  const payload = prepareRestorePayload(entry.snapshot);

  // Re-insert into Supabase using upsert (in case the ID still exists)
  const { data, error } = await supabase
    .from(entry.tableName)
    .upsert([payload], { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw new Error(
      `Unable to restore ${entry.displayName}: ${error.message}`
    );
  }

  // Remove from recycle bin
  bin.splice(entryIndex, 1);
  writeJSON(RECYCLE_BIN_KEY, bin);

  recordAuditEvent({
    module: "Recycle Bin",
    action: "Record restored from Recycle Bin",
    details: `${entry.displayName}: "${entry.title}" (ID: ${entry.recordId})`,
    source: "Local",
  });

  return data;
}

/**
 * Permanently delete an item from the recycle bin (no Supabase action needed
 * since it was already deleted from the database).
 * @param {string} binEntryId
 */
export function permanentlyDeleteFromRecycleBin(binEntryId) {
  const bin = readJSON(RECYCLE_BIN_KEY, []);
  const entry = bin.find((item) => item.id === binEntryId);

  if (!entry) {
    throw new Error("Item not found in Recycle Bin.");
  }

  const filtered = bin.filter((item) => item.id !== binEntryId);
  writeJSON(RECYCLE_BIN_KEY, filtered);

  recordAuditEvent({
    module: "Recycle Bin",
    action: "Record permanently deleted",
    details: `${entry.displayName}: "${entry.title}" (ID: ${entry.recordId})`,
    source: "Local",
  });
}

/**
 * Empty the entire recycle bin.
 */
export function emptyRecycleBin() {
  const bin = readJSON(RECYCLE_BIN_KEY, []);
  const count = bin.length;
  writeJSON(RECYCLE_BIN_KEY, []);

  if (count > 0) {
    recordAuditEvent({
      module: "Recycle Bin",
      action: "Recycle Bin emptied",
      details: `${count} item${count !== 1 ? "s" : ""} permanently deleted.`,
      source: "Local",
    });
  }

  return count;
}

// ─── Query Functions ────────────────────────────────────────────────────────────

/**
 * Get all items in the recycle bin, optionally filtered by table name.
 * @param {object} [filters]
 * @param {string} [filters.tableName] - Filter by table
 * @param {string} [filters.search] - Search title/display name
 * @returns {object[]}
 */
export function getRecycleBinItems({ tableName, search } = {}) {
  let bin = readJSON(RECYCLE_BIN_KEY, []);

  // Auto-clean expired items
  const settings = getRecycleBinSettings();
  if (settings.autoCleanEnabled) {
    const now = Date.now();
    const before = bin.length;
    bin = bin.filter((item) => new Date(item.expiresAt).getTime() > now);
    if (bin.length < before) {
      writeJSON(RECYCLE_BIN_KEY, bin);
    }
  }

  // Apply filters
  if (tableName) {
    bin = bin.filter((item) => item.tableName === tableName);
  }

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    bin = bin.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.displayName?.toLowerCase().includes(q) ||
        item.recordId?.toLowerCase().includes(q)
    );
  }

  return bin.sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
  );
}

/**
 * Get recycle bin statistics.
 */
export function getRecycleBinStats() {
  const bin = readJSON(RECYCLE_BIN_KEY, []);
  const settings = getRecycleBinSettings();

  const byTable = {};
  for (const item of bin) {
    byTable[item.tableName] = (byTable[item.tableName] || 0) + 1;
  }

  const now = Date.now();
  const expiringSoon = bin.filter(
    (item) =>
      new Date(item.expiresAt).getTime() - now < 3 * 86400000 && // within 3 days
      new Date(item.expiresAt).getTime() > now
  ).length;

  return {
    totalItems: bin.length,
    byTable,
    expiringSoon,
    retentionDays: settings.retentionDays,
  };
}

/**
 * Get the count of items in the recycle bin.
 */
export function getRecycleBinCount() {
  const bin = readJSON(RECYCLE_BIN_KEY, []);
  return bin.length;
}

/**
 * Auto-clean expired items (called on app start or periodically).
 * @returns {number} Number of items cleaned
 */
export function autoCleanExpiredItems() {
  const bin = readJSON(RECYCLE_BIN_KEY, []);
  const now = Date.now();
  const remaining = bin.filter(
    (item) => new Date(item.expiresAt).getTime() > now
  );
  const cleaned = bin.length - remaining.length;

  if (cleaned > 0) {
    writeJSON(RECYCLE_BIN_KEY, remaining);
    recordAuditEvent({
      module: "Recycle Bin",
      action: "Auto-cleanup completed",
      details: `${cleaned} expired item${cleaned !== 1 ? "s" : ""} permanently removed.`,
      source: "Local",
    });
  }

  return cleaned;
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

function extractTitle(tableName, record) {
  if (!record) return "Unknown";

  switch (tableName) {
    case "announcements":
      return record.title || "Untitled Announcement";
    case "livelihood_posts":
      return record.title || "Untitled Post";
    case "document_requests":
      return `${record.document_type || "Document"} Request`;
    case "document_templates":
      return record.template_name || record.document_type || "Template";
    case "ai_knowledge_items":
      return record.title || record.question || "Knowledge Item";
    default:
      return record.title || record.name || record.full_name || `Record #${record.id}`;
  }
}

function prepareRestorePayload(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Invalid record snapshot.");
  }

  // Clone and remove auto-generated timestamps to let DB set them
  const payload = { ...snapshot };
  for (const col of TABLE_RESTORE_EXCLUDE_COLUMNS) {
    delete payload[col];
  }

  // Remove any nested relation objects/arrays that are not database columns
  for (const key of Object.keys(payload)) {
    if (payload[key] && typeof payload[key] === "object") {
      delete payload[key];
    }
  }

  // Ensure updated_at is refreshed
  payload.updated_at = new Date().toISOString();

  return payload;
}

/**
 * Calculate days remaining until an item expires.
 */
export function getDaysUntilExpiry(expiresAt) {
  if (!expiresAt) return 0;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 86400000));
}

/**
 * Format the time since deletion in a human-readable way.
 */
export function formatTimeSinceDeletion(deletedAt) {
  if (!deletedAt) return "Unknown";
  const diff = Date.now() - new Date(deletedAt).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(deletedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
