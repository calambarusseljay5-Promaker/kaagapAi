import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Settings as SettingsIcon,
  Building2,
  Bell,
  Sun,
  Heart,
  DatabaseBackup,
  Download,
  Upload,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useConfirm } from "../context/ConfirmContext";
import {
  getSystemSettings,
  resetSystemSettings,
  saveSystemSettings,
} from "../services/adminActivityService";
import {
  createSystemBackup,
  downloadBackupFile,
  readBackupFile,
  restoreLocalBackup,
} from "../services/backupService";

const toggleItems = [
  {
    key: "residentPortalEnabled",
    label: "Resident Portal",
    description: "Allow residents to access their dashboard and submit document requests.",
    icon: Building2,
  },
  {
    key: "documentNotificationsEnabled",
    label: "Document Notifications",
    description: "Create resident notifications when document request statuses update.",
    icon: Bell,
  },
];

const themeOptions = [
  {
    key: "light",
    label: "Emerald Civic Glass",
    description: "Emerald navigation, blue & aqua accents, gold highlights, translucent white surfaces.",
    icon: Sun,
  },
  {
    key: "favorite",
    label: "Favorite Red",
    description: "Dark sidebar, clean white cards, and vibrant red government highlights.",
    icon: Heart,
  },
];

const SettingsDrawer = ({ isOpen, onClose }) => {
  const { confirm } = useConfirm();
  const [settings, setSettings] = useState(() => getSystemSettings());
  const [savedMessage, setSavedMessage] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  const [backupError, setBackupError] = useState("");
  const [backupLoading, setBackupLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getSystemSettings());
      setSavedMessage("");
      setBackupStatus("");
      setBackupError("");
    }
  }, [isOpen]);

  const updateField = (field, value) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = async (event) => {
    event?.preventDefault();
    const ok = await confirm({
      title: "Save System Settings",
      message: "Are you sure you want to update the system configuration?",
      confirmText: "Save Changes",
      cancelText: "Cancel",
      variant: "emerald",
      icon: Save,
    });
    if (!ok) return;

    const saved = saveSystemSettings(settings);
    setSettings(saved);
    setSavedMessage(`Settings saved successfully at ${new Date().toLocaleTimeString()}`);
    setTimeout(() => setSavedMessage(""), 4000);
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: "Reset Defaults",
      message: "Are you sure you want to reset all system settings to default values?",
      confirmText: "Reset",
      cancelText: "Cancel",
      variant: "danger",
      icon: RotateCcw,
    });
    if (!ok) return;

    const defaults = resetSystemSettings();
    setSettings(defaults);
    setSavedMessage(`Settings reset to default values.`);
    setTimeout(() => setSavedMessage(""), 4000);
  };

  const handleExportBackup = async () => {
    setBackupLoading(true);
    setBackupError("");
    setBackupStatus("");

    try {
      const backup = await createSystemBackup();
      downloadBackupFile(backup);
      const databaseWarnings = Object.values(backup.database || {}).filter((table) => table.error).length;
      setBackupStatus(
        databaseWarnings > 0
          ? `Backup downloaded with ${databaseWarnings} database warning(s).`
          : "Backup downloaded successfully."
      );
    } catch (error) {
      setBackupError(error.message || "Unable to create backup.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setBackupLoading(true);
    setBackupError("");
    setBackupStatus("");

    try {
      const backup = await readBackupFile(file);
      const result = restoreLocalBackup(backup);
      setSettings(getSystemSettings());
      setSavedMessage(`Restored ${result.restoredEntries} setting entries.`);
      setBackupStatus("Local settings restored successfully.");
    } catch (error) {
      setBackupError(error.message || "Unable to restore backup.");
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-slate-950/40 backdrop-blur-xs"
          />

          {/* Slide-over Drawer */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 h-full max-h-screen z-[100] flex w-full max-w-xl flex-col bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800"
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4.5 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <SettingsIcon size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-800 dark:text-white">System Settings</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Configure preferences & backups</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 transition"
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content Container (Guaranteed NO cut-off) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white dark:bg-slate-900">
              {savedMessage && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{savedMessage}</span>
                </div>
              )}

              {/* 1. System Identity */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-5 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                  <Building2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">System Identity</h3>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">System Name</label>
                    <input
                      type="text"
                      value={settings.systemName || ""}
                      onChange={(e) => updateField("systemName", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Barangay Name</label>
                    <input
                      type="text"
                      value={settings.barangayName || ""}
                      onChange={(e) => updateField("barangayName", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Office Email</label>
                    <input
                      type="email"
                      value={settings.officeEmail || ""}
                      onChange={(e) => updateField("officeEmail", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Office Phone</label>
                    <input
                      type="text"
                      value={settings.officePhone || ""}
                      onChange={(e) => updateField("officePhone", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Office Hours</label>
                    <input
                      type="text"
                      value={settings.officeHours || ""}
                      onChange={(e) => updateField("officeHours", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </section>

              {/* 2. Module Preferences */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-5 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                  <Bell size={18} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Module Preferences</h3>
                </div>

                <div className="space-y-3">
                  {toggleItems.map((item) => {
                    const Icon = item.icon;
                    const enabled = Boolean(settings[item.key]);

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => updateField(item.key, !enabled)}
                        className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition text-left ${
                          enabled
                            ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-3 pr-2">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${enabled ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800 dark:text-white">{item.label}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight">{item.description}</p>
                          </div>
                        </div>

                        <div className={`h-6 w-11 shrink-0 rounded-full p-1 transition ${enabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"}`}>
                          <div className={`h-4 w-4 rounded-full bg-white transition transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 3. Appearance */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-5 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                  <Sun size={18} className="text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Appearance</h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {themeOptions.map((item) => {
                    const Icon = item.icon;
                    const selected = (settings.adminTheme || "light") === item.key;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => updateField("adminTheme", item.key)}
                        className={`p-3.5 rounded-xl border text-left transition ${
                          selected
                            ? "border-emerald-500 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-950/30 ring-1 ring-emerald-500"
                            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                            <Icon size={16} />
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${selected ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                            {selected ? "Active" : "Select"}
                          </span>
                        </div>
                        <p className="text-xs font-black text-slate-800 dark:text-white">{item.label}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-1">{item.description}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 4. Backup & Restore */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-5 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                  <DatabaseBackup size={18} className="text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Backup & Restore</h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    disabled={backupLoading}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition text-slate-700 dark:text-slate-200 font-bold text-xs shadow-2xs disabled:opacity-50"
                  >
                    <Download size={20} className="text-emerald-600 dark:text-emerald-400" />
                    <span>{backupLoading ? "Preparing..." : "Download JSON Backup"}</span>
                  </button>

                  <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition text-slate-700 dark:text-slate-200 font-bold text-xs shadow-2xs cursor-pointer">
                    <Upload size={20} className="text-blue-600 dark:text-blue-400" />
                    <span>Restore Backup File</span>
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={handleRestoreBackup}
                      disabled={backupLoading}
                      className="sr-only"
                    />
                  </label>
                </div>

                {backupStatus && (
                  <p className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                    {backupStatus}
                  </p>
                )}

                {backupError && (
                  <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-bold">
                    {backupError}
                  </p>
                )}
              </section>
            </div>

            {/* Footer Action Buttons */}
            <div className="shrink-0 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition shadow-2xs"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md"
              >
                <Save size={14} />
                <span>Save Settings</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default SettingsDrawer;
