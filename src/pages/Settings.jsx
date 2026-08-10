import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  DatabaseBackup,
  Download,
  Upload,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Image as ImageIcon,
  HardDrive,
  Clock,
  Shield,
  Trash2,
  Eye,
  Settings2,
  Zap,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  History,
  Database,
  Users,
  FileText,
  Bell,
  Briefcase,
  Megaphone,
  Brain,
  Loader2,
  UploadCloud,
  RefreshCw,
  X,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import FloatingModal from "../components/FloatingModal";
import { useConfirm } from "../context/ConfirmContext";
import {
  getSystemSettings,
  resetSystemSettings,
  saveSystemSettings,
} from "../services/adminActivityService";
import {
  createAndUploadBackup,
  getBackupHistory,
  getBackupStats,
  getBackupSettings,
  saveBackupSettings,
  getBackupPreview,
  restoreFromCloudBackup,
  deleteCloudBackup,
  downloadCloudBackup,
  readBackupFile,
  restoreLocalBackup,
  formatRelativeTime,
} from "../services/backupService";

// ─── Table Icon Map ─────────────────────────────────────────────────────────────
const TABLE_ICONS = {
  residents: Users,
  user_profiles: Users,
  document_templates: FileText,
  document_requests: FileText,
  resident_notifications: Bell,
  livelihood_posts: Briefcase,
  announcements: Megaphone,
  ai_knowledge_items: Brain,
};

// ─── Type Badge Colors ──────────────────────────────────────────────────────────
const TYPE_BADGE = {
  Automatic: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Manual: "bg-blue-50 text-blue-700 ring-blue-200",
  Safety: "bg-amber-50 text-amber-700 ring-amber-200",
};

const ITEMS_PER_PAGE = 8;

const Settings = () => {
  const { confirm } = useConfirm();
  const logoInputRef = useRef(null);
  const restoreFileRef = useRef(null);

  const [activeTab, setActiveTab] = useState("general"); // "general" | "backup"
  const [settings, setSettings] = useState(() => getSystemSettings());
  const [logoPreview, setLogoPreview] = useState("/logo.png");
  const [savedMessage, setSavedMessage] = useState("");

  // ─── Backup State ───────────────────────────────────────────────────────────
  const [backupHistory, setBackupHistory] = useState([]);
  const [backupStatsData, setBackupStatsData] = useState(null);
  const [backupStatus, setBackupStatus] = useState("");
  const [backupError, setBackupError] = useState("");
  const [backupLoading, setBackupLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Modal States ───────────────────────────────────────────────────────────
  const [previewModal, setPreviewModal] = useState({ open: false, data: null, loading: false });
  const [restoreModal, setRestoreModal] = useState({ open: false, backupId: null, preview: null, loading: false, step: "preview" });
  const [settingsModal, setSettingsModal] = useState({ open: false });
  const [bkSettings, setBkSettings] = useState(() => getBackupSettings());

  // ─── Load Backup Data ───────────────────────────────────────────────────────
  const refreshBackupData = useCallback(() => {
    setBackupHistory(getBackupHistory());
    setBackupStatsData(getBackupStats());
    setBkSettings(getBackupSettings());
  }, []);

  useEffect(() => {
    if (activeTab === "backup") refreshBackupData();
  }, [activeTab, refreshBackupData]);

  // ─── General Settings Handlers ──────────────────────────────────────────────
  const updateField = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
      setSavedMessage("Barangay logo updated in preview.");
    }
  };

  const handleSave = async (event) => {
    event?.preventDefault();
    const ok = await confirm({
      title: "Save System Settings",
      message: "Are you sure you want to update the official Barangay system information?",
      confirmText: "Save Changes",
      cancelText: "Cancel",
      variant: "emerald",
      icon: Save,
    });
    if (!ok) return;

    const saved = saveSystemSettings(settings);
    setSettings(saved);
    setSavedMessage(`System settings saved successfully at ${new Date().toLocaleTimeString()}`);
    setTimeout(() => setSavedMessage(""), 4000);
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: "Reset Settings",
      message: "Are you sure you want to reset system settings to default values?",
      confirmText: "Reset Defaults",
      cancelText: "Cancel",
      variant: "danger",
      icon: RotateCcw,
    });
    if (!ok) return;

    const defaults = resetSystemSettings();
    setSettings(defaults);
    setSavedMessage("System settings reset to default values.");
    setTimeout(() => setSavedMessage(""), 4000);
  };

  // ─── Backup Handlers ───────────────────────────────────────────────────────
  const clearMessages = () => { setBackupStatus(""); setBackupError(""); };

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    clearMessages();
    try {
      const entry = await createAndUploadBackup("manual");
      setBackupStatus(`Backup Version ${entry.version} created successfully — ${entry.sizeFormatted} uploaded to cloud storage.`);
      refreshBackupData();
    } catch (error) {
      setBackupError(error.message || "Unable to create backup.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDeleteBackup = async (backupId) => {
    const entry = backupHistory.find((e) => e.id === backupId);
    const ok = await confirm({
      title: "Delete Backup",
      message: `Are you sure you want to permanently delete Version ${entry?.version || "?"} backup? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
      icon: Trash2,
    });
    if (!ok) return;

    clearMessages();
    try {
      await deleteCloudBackup(backupId);
      setBackupStatus("Backup deleted successfully.");
      refreshBackupData();
    } catch (error) {
      setBackupError(error.message || "Unable to delete backup.");
    }
  };

  const handleDownloadBackup = async (backupId) => {
    clearMessages();
    try {
      await downloadCloudBackup(backupId);
      setBackupStatus("Backup downloaded successfully.");
    } catch (error) {
      setBackupError(error.message || "Unable to download backup.");
    }
  };

  // ─── Preview Modal ─────────────────────────────────────────────────────────
  const openPreview = async (backupId) => {
    setPreviewModal({ open: true, data: null, loading: true });
    try {
      const preview = await getBackupPreview(backupId);
      setPreviewModal({ open: true, data: preview, loading: false });
    } catch (error) {
      setPreviewModal({ open: false, data: null, loading: false });
      setBackupError(error.message || "Unable to load backup preview.");
    }
  };

  // ─── Restore Flow ──────────────────────────────────────────────────────────
  const openRestoreFromCloud = async (backupId) => {
    setRestoreModal({ open: true, backupId, preview: null, loading: true, step: "preview" });
    try {
      const preview = await getBackupPreview(backupId);
      setRestoreModal({ open: true, backupId, preview, loading: false, step: "preview" });
    } catch (error) {
      setRestoreModal({ open: false, backupId: null, preview: null, loading: false, step: "preview" });
      setBackupError(error.message || "Unable to load backup for restore.");
    }
  };

  const executeRestore = async () => {
    const { backupId } = restoreModal;
    const ok = await confirm({
      title: "Restore Backup",
      message: "Current local settings and database records will be replaced with the backup data. A safety backup of your current system state will be automatically created first. Are you sure?",
      confirmText: "Restore Backup",
      cancelText: "Cancel",
      variant: "warning",
      icon: RotateCcw,
    });
    if (!ok) return;

    setRestoreModal((prev) => ({ ...prev, loading: true, step: "restoring" }));
    clearMessages();
    try {
      const result = await restoreFromCloudBackup(backupId);
      setSettings(getSystemSettings());
      setRestoreModal({ open: false, backupId: null, preview: null, loading: false, step: "preview" });
      setBackupStatus(`Restored Version ${result.version} — ${result.restoredEntries} settings and database tables restored successfully.`);
      refreshBackupData();
    } catch (error) {
      setRestoreModal((prev) => ({ ...prev, loading: false }));
      setBackupError(error.message || "Unable to restore backup.");
    }
  };

  const handleFileRestore = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBackupLoading(true);
    clearMessages();
    try {
      const backup = await readBackupFile(file);
      const result = await restoreLocalBackup(backup);
      setSettings(getSystemSettings());
      setBackupStatus(`Restored ${result.restoredEntries} settings entries and database records from uploaded file.`);
      refreshBackupData();
    } catch (error) {
      setBackupError(error.message || "Unable to restore backup file.");
    } finally {
      setBackupLoading(false);
    }
  };

  // ─── Backup Settings Modal ─────────────────────────────────────────────────
  const openSettingsModal = () => {
    setBkSettings(getBackupSettings());
    setSettingsModal({ open: true });
  };

  const handleSaveBackupSettings = () => {
    saveBackupSettings(bkSettings);
    setSettingsModal({ open: false });
    setBackupStatus("Backup settings saved successfully.");
    refreshBackupData();
    setTimeout(() => setBackupStatus(""), 4000);
  };

  // ─── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(backupHistory.length / ITEMS_PER_PAGE));
  const paginatedHistory = backupHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  const actions = (
    <Link
      to="/dashboard"
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-rose-600"
    >
      <X size={14} />
      Exit
    </Link>
  );

  return (
    <PageWrapper
      title="System Settings"
      description="Configure official barangay office information and manage system data backups"
      actions={actions}
    >
      <div className="max-w-5xl space-y-6 pb-20">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-3 pt-3 rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
              activeTab === "general"
                ? "border-[#00552E] text-[#00552E]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 size={18} />
            Barangay Profile & System Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("backup")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
              activeTab === "backup"
                ? "border-[#00552E] text-[#00552E]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <DatabaseBackup size={18} />
            Backup & Restore
          </button>
        </div>

        {savedMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 shadow-2xs">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{savedMessage}</span>
          </div>
        )}

        {activeTab === "general" ? (
          /* ═══════════════════════════════════════════════════════════════════ */
          /* GENERAL SETTINGS TAB                                              */
          /* ═══════════════════════════════════════════════════════════════════ */
          <form onSubmit={handleSave} className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00552E]/10 text-[#00552E]">
                  <Building2 size={24} />
                </span>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">General Information</h2>
                  <p className="text-sm font-medium text-slate-500">
                    Official contact information and branding for Barangay Upper Mingading.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-6">
                {/* Barangay Logo */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                  <p className="text-sm font-bold text-slate-800">Barangay Logo</p>
                  <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white p-1 shadow-md">
                      <img src={logoPreview} alt="Barangay Logo" className="h-full w-full rounded-full object-cover" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-600">
                        Official seal displayed on public documents and headers.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#00552E] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#004224]"
                        >
                          <ImageIcon size={14} />
                          Change Barangay Logo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fields Grid */}
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block text-sm font-bold text-slate-700 md:col-span-2">
                    Barangay Name
                    <input
                      type="text"
                      value={settings.barangayName || "Barangay Upper Mingading"}
                      onChange={(e) => updateField("barangayName", e.target.value)}
                      placeholder="Enter barangay name"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-[#00552E]/20"
                    />
                  </label>

                  <label className="block text-sm font-bold text-slate-700">
                    Office Email
                    <input
                      type="email"
                      value={settings.officeEmail || "mingading.aleosan@gmail.com"}
                      onChange={(e) => updateField("officeEmail", e.target.value)}
                      placeholder="office@barangay.gov.ph"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-[#00552E]/20"
                    />
                  </label>

                  <label className="block text-sm font-bold text-slate-700">
                    Office Phone
                    <input
                      type="text"
                      value={settings.officePhone || "+63 912 345 6789"}
                      onChange={(e) => updateField("officePhone", e.target.value)}
                      placeholder="+63 9XX XXX XXXX"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-[#00552E]/20"
                    />
                  </label>

                  <label className="block text-sm font-bold text-slate-700 md:col-span-2">
                    Office Hours
                    <input
                      type="text"
                      value={settings.officeHours || "Monday – Friday: 8:00 AM – 5:00 PM"}
                      onChange={(e) => updateField("officeHours", e.target.value)}
                      placeholder="e.g. Mon - Fri 8:00 AM - 5:00 PM"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-[#00552E]/20"
                    />
                  </label>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
              >
                <RotateCcw size={15} />
                Reset Defaults
              </button>

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-[#00552E] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#004224]"
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════ */
          /* BACKUP & RESTORE TAB                                              */
          /* ═══════════════════════════════════════════════════════════════════ */
          <div className="space-y-6">
            {/* ─── Status Messages ──────────────────────────────────────────── */}
            {backupStatus && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 animate-in fade-in duration-300">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span className="flex-1">{backupStatus}</span>
                <button onClick={() => setBackupStatus("")} className="text-emerald-600 hover:text-emerald-800 transition">
                  <span className="sr-only">Dismiss</span>✕
                </button>
              </div>
            )}

            {backupError && (
              <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 animate-in fade-in duration-300">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span className="flex-1">{backupError}</span>
                <button onClick={() => setBackupError("")} className="text-rose-600 hover:text-rose-800 transition">
                  <span className="sr-only">Dismiss</span>✕
                </button>
              </div>
            )}

            {/* ─── 1. Backup Dashboard Card ─────────────────────────────────── */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00552E]/10 text-[#00552E]">
                    <DatabaseBackup size={24} />
                  </span>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">Database Backup</h2>
                    <p className="text-sm font-medium text-slate-500">
                      Cloud-persistent backups with automatic scheduling & version history.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openSettingsModal}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
                >
                  <Settings2 size={15} />
                  Backup Settings
                </button>
              </div>

              {/* Stats Grid */}
              {backupStatsData && (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    { label: "Last Backup", value: backupStatsData.lastBackupRelative, icon: Clock, color: "text-blue-600 bg-blue-50" },
                    { label: "Auto Backup", value: backupStatsData.autoBackupEnabled ? "ON" : "OFF", icon: Zap, color: backupStatsData.autoBackupEnabled ? "text-emerald-600 bg-emerald-50" : "text-slate-400 bg-slate-50" },
                    { label: "Schedule", value: "Daily", icon: RefreshCw, color: "text-violet-600 bg-violet-50" },
                    { label: "Retention", value: `${backupStatsData.retentionDays} Days`, icon: History, color: "text-amber-600 bg-amber-50" },
                    { label: "Storage Used", value: backupStatsData.totalSizeFormatted, icon: HardDrive, color: "text-indigo-600 bg-indigo-50" },
                    { label: "Total Backups", value: String(backupStatsData.totalBackups), icon: Database, color: "text-teal-600 bg-teal-50" },
                  ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 text-center">
                        <div className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${stat.color}`}>
                          <Icon size={16} />
                        </div>
                        <p className="text-lg font-black text-slate-900 leading-tight">{stat.value}</p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Actions */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <input
                  ref={restoreFileRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileRestore}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleCreateBackup}
                  disabled={backupLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#00552E] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#004224] disabled:opacity-60"
                >
                  {backupLoading ? <Loader2 size={15} className="animate-spin" /> : <CloudUpload size={15} />}
                  {backupLoading ? "Creating Backup..." : "Create Backup"}
                </button>

                <button
                  type="button"
                  onClick={() => restoreFileRef.current?.click()}
                  disabled={backupLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <Upload size={15} className="text-[#00552E]" />
                  Upload & Restore
                </button>

                {backupHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleDownloadBackup(backupHistory[0].id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50"
                  >
                    <Download size={15} className="text-[#00552E]" />
                    Download Latest
                  </button>
                )}
              </div>
            </section>

            {/* ─── 2. Backup History Table ───────────────────────────────────── */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <History size={18} className="text-[#00552E]" />
                  <h3 className="text-sm font-extrabold text-slate-900">Backup History</h3>
                  <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {backupHistory.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={refreshBackupData}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  title="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {backupHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
                    <DatabaseBackup size={28} />
                  </div>
                  <p className="text-sm font-bold text-slate-700">No backups yet</p>
                  <p className="mt-1 text-xs text-slate-500 max-w-xs">
                    Create your first backup to start protecting your barangay data. Backups are stored securely in the cloud.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50/80 font-extrabold uppercase text-slate-500">
                        <tr>
                          <th className="px-6 py-3 w-16">Ver</th>
                          <th className="px-4 py-3">File Name</th>
                          <th className="px-4 py-3">Date Created</th>
                          <th className="px-4 py-3">Size</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Records</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-semibold text-slate-700">
                        {paginatedHistory.map((item) => (
                          <tr key={item.id} className="transition hover:bg-slate-50/60 group">
                            <td className="px-6 py-3">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#00552E]/10 text-xs font-black text-[#00552E]">
                                {item.version}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <FileSpreadsheet size={14} className="shrink-0 text-[#00552E]" />
                                <span className="font-bold text-slate-900 truncate max-w-[200px]">{item.filename}</span>
                              </div>
                              {item.triggerAction && (
                                <p className="mt-0.5 text-[10px] text-slate-500 font-medium">{item.triggerAction}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              <div>{new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                              <div className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
                            </td>
                            <td className="px-4 py-3">{item.sizeFormatted}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ${TYPE_BADGE[item.typeLabel] || TYPE_BADGE.Manual}`}>
                                {item.typeLabel === "Automatic" && <Zap size={9} />}
                                {item.typeLabel === "Safety" && <Shield size={9} />}
                                {item.typeLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {item.totalRows?.toLocaleString() || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition">
                                <button
                                  type="button"
                                  onClick={() => openPreview(item.id)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                                  title="Preview"
                                >
                                  <Eye size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadBackup(item.id)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                                  title="Download"
                                >
                                  <Download size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openRestoreFromCloud(item.id)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200"
                                  title="Restore"
                                >
                                  <RotateCcw size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBackup(item.id)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
                      <p className="text-[11px] font-semibold text-slate-500">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, backupHistory.length)} of {backupHistory.length}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition ${
                              page === currentPage
                                ? "bg-[#00552E] text-white shadow-sm"
                                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* MODALS                                                                  */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}

      {/* ─── Preview Modal ─────────────────────────────────────────────────────── */}
      <FloatingModal
        open={previewModal.open}
        title="Backup Preview"
        description="Inspect the contents of this backup before restoring."
        onClose={() => setPreviewModal({ open: false, data: null, loading: false })}
        maxWidth="max-w-lg"
        footer={
          <button
            type="button"
            onClick={() => setPreviewModal({ open: false, data: null, loading: false })}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        }
      >
        {previewModal.loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 size={28} className="animate-spin text-[#00552E] mb-3" />
            <p className="text-xs font-bold">Loading backup preview…</p>
          </div>
        ) : previewModal.data ? (
          <div className="space-y-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Version", value: `Version ${previewModal.data.version}` },
                { label: "Type", value: previewModal.data.type },
                { label: "Created", value: previewModal.data.createdAtRelative },
                { label: "Size", value: previewModal.data.sizeFormatted },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{m.label}</p>
                  <p className="mt-0.5 text-sm font-black text-slate-900">{m.value}</p>
                </div>
              ))}
            </div>

            {previewModal.data.triggerAction && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800">
                <Shield size={12} className="inline mr-1.5" />
                Safety trigger: {previewModal.data.triggerAction}
              </div>
            )}

            {/* Table Breakdown */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">Database Tables</p>
              </div>
              <div className="divide-y divide-slate-100">
                {previewModal.data.tables.map((table) => {
                  const Icon = TABLE_ICONS[table.name] || Database;
                  return (
                    <div key={table.name} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Icon size={14} className="text-[#00552E]" />
                        <span className="text-xs font-bold text-slate-700">{table.displayName}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900">{table.rowCount.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 bg-[#00552E]/5 px-4 py-2.5">
                <span className="text-xs font-extrabold text-[#00552E]">Total Records</span>
                <span className="text-sm font-black text-[#00552E]">{previewModal.data.totalRows.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ) : null}
      </FloatingModal>

      {/* ─── Restore Modal ─────────────────────────────────────────────────────── */}
      <FloatingModal
        open={restoreModal.open}
        title="Restore Backup"
        description="Review the backup contents before restoring your system."
        onClose={() => setRestoreModal({ open: false, backupId: null, preview: null, loading: false, step: "preview" })}
        maxWidth="max-w-lg"
        closeOnBackdropClick={!restoreModal.loading}
        footer={
          restoreModal.step === "preview" && restoreModal.preview ? (
            <>
              <button
                type="button"
                onClick={() => setRestoreModal({ open: false, backupId: null, preview: null, loading: false, step: "preview" })}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRestore}
                disabled={restoreModal.loading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition hover:from-amber-500 hover:to-amber-800 disabled:opacity-60"
              >
                {restoreModal.loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                {restoreModal.loading ? "Restoring..." : "Restore This Backup"}
              </button>
            </>
          ) : null
        }
      >
        {restoreModal.loading && !restoreModal.preview ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 size={28} className="animate-spin text-[#00552E] mb-3" />
            <p className="text-xs font-bold">Loading backup data…</p>
          </div>
        ) : restoreModal.loading && restoreModal.step === "restoring" ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 size={28} className="animate-spin text-amber-600 mb-3" />
            <p className="text-xs font-bold">Restoring backup…</p>
            <p className="text-[11px] text-slate-400 mt-1">Please do not close this window.</p>
          </div>
        ) : restoreModal.preview ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800">
              <AlertCircle size={14} className="inline mr-1.5 -mt-0.5" />
              Current local settings will be replaced with data from this backup. This action can be undone by restoring a different backup.
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Version", value: `Version ${restoreModal.preview.version}` },
                { label: "Type", value: restoreModal.preview.type },
                { label: "Created", value: new Date(restoreModal.preview.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
                { label: "Total Records", value: restoreModal.preview.totalRows.toLocaleString() },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{m.label}</p>
                  <p className="mt-0.5 text-sm font-black text-slate-900">{m.value}</p>
                </div>
              ))}
            </div>

            {/* Table Breakdown */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">Data Snapshot</p>
              </div>
              <div className="divide-y divide-slate-100">
                {restoreModal.preview.tables.map((table) => {
                  const Icon = TABLE_ICONS[table.name] || Database;
                  return (
                    <div key={table.name} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Icon size={14} className="text-[#00552E]" />
                        <span className="text-xs font-bold text-slate-700">{table.displayName}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900">{table.rowCount.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </FloatingModal>

      {/* ─── Backup Settings Modal ─────────────────────────────────────────────── */}
      <FloatingModal
        open={settingsModal.open}
        title="Backup Settings"
        description="Configure automatic backup schedule and data retention."
        onClose={() => setSettingsModal({ open: false })}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSettingsModal({ open: false })}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveBackupSettings}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00552E] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#004224]"
            >
              <Save size={14} />
              Save Settings
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Auto-Backup Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div>
              <p className="text-xs font-black text-slate-800">Automatic Daily Backup</p>
              <p className="mt-0.5 text-[11px] text-slate-500 font-medium leading-tight">
                Automatically create a backup when you open the system if the last backup is more than 24 hours old and data has changed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBkSettings((prev) => ({ ...prev, autoBackupEnabled: !prev.autoBackupEnabled }))}
              className={`h-6 w-11 shrink-0 rounded-full p-1 transition ml-3 ${bkSettings.autoBackupEnabled ? "bg-emerald-600" : "bg-slate-300"}`}
            >
              <div className={`h-4 w-4 rounded-full bg-white transition transform ${bkSettings.autoBackupEnabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {/* Retention Period */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-xs font-black text-slate-800">Retention Period</p>
            <p className="mt-0.5 text-[11px] text-slate-500 font-medium leading-tight">
              Backups older than this period will be automatically deleted.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[30, 60, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setBkSettings((prev) => ({ ...prev, retentionDays: days }))}
                  className={`rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                    bkSettings.retentionDays === days
                      ? "bg-[#00552E] text-white shadow-sm ring-2 ring-[#00552E]/20"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-[11px] font-semibold text-blue-800 leading-relaxed">
            <strong className="font-black">How it works:</strong> When you open the admin dashboard, the system checks if a backup is needed. If auto-backup is ON and 24+ hours have passed since the last backup, a new backup is created silently in the background — only when data has actually changed.
          </div>
        </div>
      </FloatingModal>
    </PageWrapper>
  );
};

export default Settings;
