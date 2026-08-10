import { supabase } from "../lib/supabaseClient";
import { recordAuditEvent } from "./adminActivityService";

// ─── Constants ──────────────────────────────────────────────────────────────────
const BACKUP_VERSION = 2;
const BACKUP_APP = "KaagapAI";
const LOCAL_KEY_PREFIX = "kaagapai_";
const LOCAL_KEY_EXCLUSIONS = new Set(["kaagapai_resident_session"]);

const BACKUP_REGISTRY_KEY = "kaagapai_backup_registry";
const BACKUP_SETTINGS_KEY = "kaagapai_backup_settings";
const BACKUP_LAST_SNAPSHOT_KEY = "kaagapai_backup_last_snapshot";
const BACKUP_CACHE_PREFIX = "kaagapai_backup_cache_";
const STORAGE_BUCKET = "system-backups";
const MAX_REGISTRY_ENTRIES = 200;
const MAX_LOCAL_CACHES = 10;

const DATABASE_TABLES = [
  "residents",
  "user_profiles",
  "document_templates",
  "document_requests",
  "resident_notifications",
  "livelihood_posts",
  "announcements",
  "ai_knowledge_items",
];

const DEFAULT_BACKUP_SETTINGS = {
  autoBackupEnabled: true,
  retentionDays: 30,
  lastAutoBackupAt: null,
};

// ─── Utility Helpers ────────────────────────────────────────────────────────────
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

const readJSON = (key, fallback) => {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
};

const removeKey = (key) => {
  const storage = getStorage();
  if (storage) storage.removeItem(key);
};

// ─── Local Backup Cache (fallback when cloud is unavailable) ────────────────
const cacheBackupLocally = (backupId, payload) => {
  try {
    writeJSON(`${BACKUP_CACHE_PREFIX}${backupId}`, payload);

    // Enforce max local caches — remove oldest if exceeded
    const storage = getStorage();
    if (!storage) return;
    const cacheKeys = Object.keys(storage)
      .filter((k) => k.startsWith(BACKUP_CACHE_PREFIX))
      .sort();
    while (cacheKeys.length > MAX_LOCAL_CACHES) {
      storage.removeItem(cacheKeys.shift());
    }
  } catch (e) {
    console.warn("Unable to cache backup locally (storage may be full):", e.message);
  }
};

const getCachedBackup = (backupId) => {
  return readJSON(`${BACKUP_CACHE_PREFIX}${backupId}`, null);
};

const removeCachedBackup = (backupId) => {
  removeKey(`${BACKUP_CACHE_PREFIX}${backupId}`);
};

const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const formatRelativeTime = (dateString) => {
  if (!dateString) return "Never";
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// ─── localStorage Snapshot ──────────────────────────────────────────────────────
const getLocalStorageSnapshot = () => {
  const storage = getStorage();
  if (!storage) return {};

  return Object.keys(storage)
    .filter((key) => key.startsWith(LOCAL_KEY_PREFIX) && !LOCAL_KEY_EXCLUSIONS.has(key))
    .sort()
    .reduce((snapshot, key) => {
      snapshot[key] = storage.getItem(key);
      return snapshot;
    }, {});
};

const restoreLocalStorageSnapshot = (snapshot = {}) => {
  const storage = getStorage();
  if (!storage) throw new Error("Browser storage is not available.");

  Object.entries(snapshot).forEach(([key, value]) => {
    if (!key.startsWith(LOCAL_KEY_PREFIX) || LOCAL_KEY_EXCLUSIONS.has(key)) return;

    if (value === null || value === undefined) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, String(value));
    }
  });

  window.dispatchEvent(new CustomEvent("kaagapai:system-settings-updated"));
  window.dispatchEvent(new StorageEvent("storage"));
};

// ─── Database Snapshot ──────────────────────────────────────────────────────────
const fetchTableSnapshot = async (tableName) => {
  try {
    const { data, error } = await supabase.from(tableName).select("*").limit(10000);
    if (error) throw error;
    return { rows: data || [], error: null };
  } catch (error) {
    return { rows: [], error: error.message || `Unable to back up ${tableName}.` };
  }
};

const fetchAllTableSnapshots = async () => {
  const entries = await Promise.all(
    DATABASE_TABLES.map(async (tableName) => [tableName, await fetchTableSnapshot(tableName)])
  );
  return Object.fromEntries(entries);
};

// ─── Backup Registry (localStorage) ────────────────────────────────────────────
const getRegistry = () => {
  const items = readJSON(BACKUP_REGISTRY_KEY, []);
  return Array.isArray(items) ? items : [];
};

const saveRegistry = (items) => {
  const capped = Array.isArray(items) ? items.slice(0, MAX_REGISTRY_ENTRIES) : [];
  writeJSON(BACKUP_REGISTRY_KEY, capped);
};

const addRegistryEntry = (entry) => {
  const registry = getRegistry();
  saveRegistry([entry, ...registry]);
};

const removeRegistryEntry = (backupId) => {
  const registry = getRegistry();
  saveRegistry(registry.filter((e) => e.id !== backupId));
};

const getNextVersionNumber = () => {
  const registry = getRegistry();
  if (registry.length === 0) return 1;
  const maxVersion = Math.max(...registry.map((e) => e.version || 0));
  return maxVersion + 1;
};

// ─── Backup Settings ────────────────────────────────────────────────────────────
export function getBackupSettings() {
  return { ...DEFAULT_BACKUP_SETTINGS, ...readJSON(BACKUP_SETTINGS_KEY, {}) };
}

export function saveBackupSettings(settings) {
  const next = { ...DEFAULT_BACKUP_SETTINGS, ...settings };
  writeJSON(BACKUP_SETTINGS_KEY, next);

  recordAuditEvent({
    module: "System Settings",
    action: "Backup settings updated",
    details: `Auto-backup: ${next.autoBackupEnabled ? "ON" : "OFF"}, Retention: ${next.retentionDays} days`,
    source: "Local",
  });

  return next;
}

// ─── Supabase Storage Helpers ───────────────────────────────────────────────────
const buildStoragePath = (backupId, createdAt) => {
  const dateStr = new Date(createdAt).toISOString().slice(0, 10);
  return `backups/${dateStr}_${backupId}.json`;
};

const uploadToStorage = async (storagePath, backupPayload) => {
  const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: "application/json" });

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, {
      cacheControl: "3600",
      contentType: "application/json",
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return blob.size;
};

const downloadFromStorage = async (storagePath) => {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);

  if (error) throw new Error(`Storage download failed: ${error.message}`);
  const text = await data.text();
  return JSON.parse(text);
};

const deleteFromStorage = async (storagePath) => {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.warn(`Storage delete warning for ${storagePath}:`, error.message);
  }
};

// ─── Backup Payload Retrieval (cloud → local cache fallback) ────────────────────

/**
 * Retrieve a backup payload. Tries Supabase Storage first, falls back to local cache.
 * @param {object} entry - The backup registry entry.
 * @returns {Promise<object>} The parsed backup payload.
 */
const getBackupPayload = async (entry) => {
  // Try cloud storage first (if marked as uploaded)
  if (entry.cloudUploaded && entry.storagePath) {
    try {
      return await downloadFromStorage(entry.storagePath);
    } catch (cloudError) {
      console.warn("Cloud download failed, trying local cache:", cloudError.message);
    }
  }

  // Fallback: try local cache
  const cached = getCachedBackup(entry.id);
  if (cached) return cached;

  // Last resort: try cloud even if not marked (legacy entries)
  if (entry.storagePath) {
    try {
      return await downloadFromStorage(entry.storagePath);
    } catch {
      // Exhausted all options
    }
  }

  throw new Error(
    "Backup data is unavailable. The cloud storage bucket may not be configured, and the local cache has expired. Please create a new backup."
  );
};

// ─── Core Backup Operations ─────────────────────────────────────────────────────

/**
 * Create a full system backup, upload to Supabase Storage, and register in metadata.
 * @param {"manual"|"automatic"|"safety"} type
 * @param {string} [triggerAction]
 * @returns {Promise<object>} The backup metadata entry.
 */
export async function createAndUploadBackup(type = "manual", triggerAction = "") {
  const database = await fetchAllTableSnapshots();
  const version = getNextVersionNumber();
  const createdAt = new Date().toISOString();
  const backupId = createId();

  const backupPayload = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    backupId,
    createdAt,
    backupType: type,
    triggerAction: triggerAction || undefined,
    localStorage: getLocalStorageSnapshot(),
    database,
  };

  const storagePath = buildStoragePath(backupId, createdAt);

  // Upload to Supabase Storage
  let sizeBytes = 0;
  let cloudUploaded = false;
  try {
    sizeBytes = await uploadToStorage(storagePath, backupPayload);
    cloudUploaded = true;
  } catch (storageError) {
    // If storage upload fails, cache locally as fallback
    console.warn("Cloud upload failed, backup cached locally:", storageError.message);
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)]);
    sizeBytes = blob.size;
  }

  // Always cache locally so download/restore works even without cloud
  cacheBackupLocally(backupId, backupPayload);

  // Build table summary for display
  const tableSummary = {};
  let totalRows = 0;
  DATABASE_TABLES.forEach((tableName) => {
    const count = database[tableName]?.rows?.length || 0;
    tableSummary[tableName] = count;
    totalRows += count;
  });

  const typeLabels = { manual: "Manual", automatic: "Automatic", safety: "Safety" };

  const entry = {
    id: backupId,
    version,
    filename: `kaagapai-backup-${createdAt.slice(0, 10)}-v${version}.json`,
    storagePath,
    cloudUploaded,
    createdAt,
    type,
    typeLabel: typeLabels[type] || "Manual",
    triggerAction: triggerAction || null,
    sizeBytes,
    sizeFormatted: formatBytes(sizeBytes),
    tableSummary,
    totalRows,
    status: "Completed",
  };

  addRegistryEntry(entry);

  // Update last auto-backup timestamp if automatic
  if (type === "automatic") {
    const settings = getBackupSettings();
    saveBackupSettings({ ...settings, lastAutoBackupAt: createdAt });
  }

  // Save snapshot hash for change detection
  writeJSON(BACKUP_LAST_SNAPSHOT_KEY, tableSummary);

  // Audit log
  const detailParts = [`Version ${version}`, `Type: ${entry.typeLabel}`, `Size: ${entry.sizeFormatted}`, `${totalRows} total rows`];
  if (triggerAction) detailParts.push(`Trigger: ${triggerAction}`);

  recordAuditEvent({
    module: "System Settings",
    action: "Backup created",
    details: detailParts.join(" · "),
    source: "Local",
  });

  return entry;
}

/**
 * Create a safety backup before a destructive action.
 * @param {string} actionLabel
 * @returns {Promise<object>} The backup metadata entry.
 */
export async function createSafetyBackup(actionLabel) {
  return createAndUploadBackup("safety", actionLabel);
}

// ─── Backup History ─────────────────────────────────────────────────────────────

/**
 * Get the full sorted backup history from the registry.
 * @returns {object[]}
 */
export function getBackupHistory() {
  return getRegistry().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get statistics about the backup history.
 */
export function getBackupStats() {
  const history = getBackupHistory();
  const totalSize = history.reduce((sum, e) => sum + (e.sizeBytes || 0), 0);
  const lastBackup = history.length > 0 ? history[0] : null;
  const settings = getBackupSettings();

  return {
    totalBackups: history.length,
    totalSizeFormatted: formatBytes(totalSize),
    totalSizeBytes: totalSize,
    lastBackupAt: lastBackup?.createdAt || null,
    lastBackupRelative: formatRelativeTime(lastBackup?.createdAt),
    lastBackupType: lastBackup?.typeLabel || "—",
    autoBackupEnabled: settings.autoBackupEnabled,
    retentionDays: settings.retentionDays,
    manualCount: history.filter((e) => e.type === "manual").length,
    automaticCount: history.filter((e) => e.type === "automatic").length,
    safetyCount: history.filter((e) => e.type === "safety").length,
  };
}

// ─── Restore Operations ─────────────────────────────────────────────────────────

/**
 * Get a preview of a backup's contents without restoring it.
 * @param {string} backupId
 * @returns {Promise<object>}
 */
export async function getBackupPreview(backupId) {
  const entry = getRegistry().find((e) => e.id === backupId);
  if (!entry) throw new Error("Backup not found in registry.");

  // Try to get preview from stored metadata first (fast path)
  if (entry.tableSummary && entry.totalRows !== undefined) {
    return {
      backupId: entry.id,
      version: entry.version,
      createdAt: entry.createdAt,
      createdAtRelative: formatRelativeTime(entry.createdAt),
      type: entry.typeLabel,
      triggerAction: entry.triggerAction,
      sizeFormatted: entry.sizeFormatted,
      totalRows: entry.totalRows,
      tables: DATABASE_TABLES.map((name) => ({
        name,
        displayName: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        rowCount: entry.tableSummary[name] ?? 0,
      })),
    };
  }

  // Slow path: try cloud first, then local cache
  const backup = await getBackupPayload(entry);
  const tables = DATABASE_TABLES.map((name) => ({
    name,
    displayName: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    rowCount: backup.database?.[name]?.rows?.length ?? 0,
  }));

  return {
    backupId: entry.id,
    version: entry.version,
    createdAt: entry.createdAt,
    createdAtRelative: formatRelativeTime(entry.createdAt),
    type: entry.typeLabel,
    triggerAction: entry.triggerAction,
    sizeFormatted: entry.sizeFormatted,
    totalRows: tables.reduce((sum, t) => sum + t.rowCount, 0),
    tables,
  };
}

/**
 * Helper to restore database snapshots table by table in dependency order
 */
async function restoreDatabaseSnapshot(database) {
  if (!database || typeof database !== "object") return;

  const DELETION_ORDER = [
    "document_requests",
    "resident_notifications",
    "ai_knowledge_items",
    "livelihood_posts",
    "announcements",
    "user_profiles",
    "residents",
    "document_templates",
  ];

  const INSERTION_ORDER = [
    "residents",
    "user_profiles",
    "document_templates",
    "announcements",
    "livelihood_posts",
    "ai_knowledge_items",
    "resident_notifications",
    "document_requests",
  ];

  // 1. Delete existing rows
  for (const tableName of DELETION_ORDER) {
    if (database[tableName]) {
      const { error } = await supabase.from(tableName).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        console.warn(`Failed to clear table ${tableName}:`, error.message);
      }
    }
  }

  // 2. Insert backup rows
  for (const tableName of INSERTION_ORDER) {
    const tableData = database[tableName];
    if (tableData && Array.isArray(tableData.rows) && tableData.rows.length > 0) {
      // Chunk insertions to prevent oversized payload issues
      const chunkSize = 100;
      for (let i = 0; i < tableData.rows.length; i += chunkSize) {
        const chunk = tableData.rows.slice(i, i + chunkSize);
        const { error } = await supabase.from(tableName).insert(chunk);
        if (error) {
          throw new Error(`Failed to insert restored rows for ${tableName}: ${error.message}`);
        }
      }
    }
  }
}

/**
 * Validate backup integrity before restoring.
 */
function validateBackupIntegrity(backup) {
  if (!backup || backup.app !== BACKUP_APP) {
    throw new Error("This is not a valid KaagapAI backup file.");
  }
  if (!backup.localStorage || typeof backup.localStorage !== "object") {
    throw new Error("Backup file is missing system settings configuration.");
  }
  if (!backup.database || typeof backup.database !== "object") {
    throw new Error("Backup file does not contain a database snapshot.");
  }
}

/**
 * Restore local settings and database from a cloud backup.
 * @param {string} backupId
 * @returns {Promise<object>}
 */
export async function restoreFromCloudBackup(backupId) {
  const entry = getRegistry().find((e) => e.id === backupId);
  if (!entry) throw new Error("Backup not found in registry.");

  const backup = await getBackupPayload(entry);
  validateBackupIntegrity(backup);

  // Automatically create safety backup before restoring
  try {
    await createSafetyBackup(`Safety backup before restoring V${entry.version}`);
  } catch (safetyErr) {
    console.warn("Failed to create pre-restore safety backup:", safetyErr.message);
  }

  // Restore local storage settings
  restoreLocalStorageSnapshot(backup.localStorage);

  // Restore database tables
  await restoreDatabaseSnapshot(backup.database);

  recordAuditEvent({
    module: "System Settings",
    action: "Backup restored",
    details: `Restored Version ${entry.version} (${entry.typeLabel}) — settings & database rows successfully restored.`,
    source: "Local",
  });

  return {
    restoredEntries: Object.keys(backup.localStorage).length,
    databaseTables: Object.keys(backup.database).length,
    version: entry.version,
    type: entry.typeLabel,
  };
}

// ─── Delete & Download ──────────────────────────────────────────────────────────

/**
 * Delete a backup from cloud storage and registry.
 * @param {string} backupId
 */
export async function deleteCloudBackup(backupId) {
  const entry = getRegistry().find((e) => e.id === backupId);
  if (!entry) throw new Error("Backup not found.");

  if (entry.storagePath && entry.cloudUploaded) {
    await deleteFromStorage(entry.storagePath);
  }

  // Remove local cache too
  removeCachedBackup(backupId);

  removeRegistryEntry(backupId);

  recordAuditEvent({
    module: "System Settings",
    action: "Backup deleted",
    details: `Deleted Version ${entry.version} (${entry.typeLabel}) — ${entry.sizeFormatted}`,
    source: "Local",
  });
}

/**
 * Download a backup from cloud storage as a browser file download.
 * @param {string} backupId
 */
export async function downloadCloudBackup(backupId) {
  const entry = getRegistry().find((e) => e.id === backupId);
  if (!entry) throw new Error("Backup not found.");

  const backup = await getBackupPayload(entry);

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = entry.filename || `kaagapai-backup-${entry.createdAt?.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  recordAuditEvent({
    module: "System Settings",
    action: "Backup downloaded",
    details: `Downloaded Version ${entry.version} (${entry.typeLabel})`,
    source: "Local",
  });
}

// ─── Auto-Backup & Retention ────────────────────────────────────────────────────

/**
 * Check if data has changed since the last backup by comparing row counts.
 * @returns {Promise<boolean>}
 */
export async function hasDataChangedSinceLastBackup() {
  const lastSnapshot = readJSON(BACKUP_LAST_SNAPSHOT_KEY, null);
  if (!lastSnapshot) return true;

  for (const tableName of DATABASE_TABLES) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select("*", { count: "exact", head: true });

      if (error) continue;
      if ((count || 0) !== (lastSnapshot[tableName] || 0)) return true;
    } catch {
      continue;
    }
  }

  return false;
}

/**
 * Check if auto-backup should run and execute it if conditions are met.
 * @returns {Promise<boolean>}
 */
export async function checkAndRunAutoBackup() {
  const settings = getBackupSettings();

  if (!settings.autoBackupEnabled) return false;

  const lastBackupAt = settings.lastAutoBackupAt;
  if (lastBackupAt) {
    const hoursSinceLastBackup = (Date.now() - new Date(lastBackupAt).getTime()) / 3600000;
    if (hoursSinceLastBackup < 24) return false;
  }

  const changed = await hasDataChangedSinceLastBackup();
  if (!changed) {
    recordAuditEvent({
      module: "System Settings",
      action: "Auto-backup skipped",
      details: "No data changes detected since last backup.",
      source: "Local",
    });
    return false;
  }

  try {
    await createAndUploadBackup("automatic");
    return true;
  } catch (error) {
    console.error("Auto-backup failed:", error);
    recordAuditEvent({
      module: "System Settings",
      action: "Auto-backup failed",
      details: error.message || "Unknown error during automatic backup.",
      source: "Local",
    });
    return false;
  }
}

/**
 * Delete backups older than the configured retention period.
 * @returns {Promise<number>}
 */
export async function enforceRetentionPolicy() {
  const settings = getBackupSettings();
  const retentionMs = settings.retentionDays * 86400000;
  const cutoff = Date.now() - retentionMs;

  const registry = getRegistry();
  const expired = registry.filter((e) => new Date(e.createdAt).getTime() < cutoff);

  if (expired.length === 0) return 0;

  for (const entry of expired) {
    if (entry.storagePath) {
      try {
        await deleteFromStorage(entry.storagePath);
      } catch {
        // Continue deleting others even if one fails
      }
    }
  }

  const remaining = registry.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
  saveRegistry(remaining);

  recordAuditEvent({
    module: "System Settings",
    action: "Retention policy enforced",
    details: `${expired.length} backup${expired.length !== 1 ? "s" : ""} older than ${settings.retentionDays} days removed.`,
    source: "Local",
  });

  return expired.length;
}

// ─── Legacy Exports (backward compatibility for SettingsDrawer.jsx) ─────────────

export async function createSystemBackup() {
  const database = await fetchAllTableSnapshots();

  const backup = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    backupType: "settings-local-and-database-snapshot",
    localStorage: getLocalStorageSnapshot(),
    database,
  };

  const tableSummary = DATABASE_TABLES.map((tableName) => {
    const table = database[tableName];
    return `${tableName}: ${table.rows.length}${table.error ? " (with warning)" : ""}`;
  }).join(", ");

  recordAuditEvent({
    module: "System Settings",
    action: "Backup exported",
    details: tableSummary,
    source: "Local",
  });

  return backup;
}

export function downloadBackupFile(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `kaagapai-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const readBackupFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || "{}")));
      } catch {
        reject(new Error("Backup file is not valid JSON."));
      }
    };

    reader.onerror = () => reject(new Error("Unable to read backup file."));
    reader.readAsText(file);
  });

export async function restoreLocalBackup(backup) {
  validateBackupIntegrity(backup);

  // Automatically create safety backup before restoring
  try {
    await createSafetyBackup("Safety backup before manual file restoration");
  } catch (safetyErr) {
    console.warn("Failed to create pre-restore safety backup:", safetyErr.message);
  }

  // Restore local storage settings
  restoreLocalStorageSnapshot(backup.localStorage);

  // Restore database tables
  await restoreDatabaseSnapshot(backup.database);

  recordAuditEvent({
    module: "System Settings",
    action: "Backup restored",
    details: `Restored manually uploaded backup file — ${Object.keys(backup.localStorage).length} settings entries and database rows successfully restored.`,
    source: "Local",
  });

  return {
    restoredEntries: Object.keys(backup.localStorage).length,
    databaseTables: Object.keys(backup.database).length,
  };
}

// ─── Exported Utilities ─────────────────────────────────────────────────────────
export { formatRelativeTime, formatBytes };
