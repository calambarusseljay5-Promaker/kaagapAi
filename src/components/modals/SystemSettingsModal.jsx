import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Loader2,
  RefreshCw,
  X,
  Pencil,
  Lock,
  Brain,
  Sparkles,
  EyeOff,
  Cpu,
  Key,
} from "lucide-react";
import FloatingModal from "../FloatingModal";
import { useConfirm } from "../../context/ConfirmContext";
import { showAdminSystemToast } from "../../utils/toast";
import {
  getSystemSettings,
  resetSystemSettings,
  saveSystemSettings,
} from "../../services/adminActivityService";
import {
  AVAILABLE_GEMINI_MODELS,
  testGeminiConnection,
  getActiveGeminiApiKey,
  getActiveGeminiModel,
} from "../../services/geminiService";
import { getBarangayLogo, setBarangayLogo } from "../../services/logoService";
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
  runDailyAutoBackupRoutine,
} from "../../services/backupService";

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

const TYPE_BADGE = {
  Automatic: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Manual: "bg-blue-100 text-blue-800 border-blue-300",
  Safety: "bg-amber-100 text-amber-800 border-amber-300",
};

const ITEMS_PER_PAGE = 8;

const SystemSettingsModal = ({ isOpen, onClose }) => {
  const { confirm } = useConfirm();
  const logoInputRef = useRef(null);
  const restoreFileRef = useRef(null);

  const [activeTab, setActiveTab] = useState("general"); // "general" | "backup"
  const [settings, setSettings] = useState(() => getSystemSettings());
  const [logoPreview, setLogoPreview] = useState(() => getBarangayLogo());
  const [isEditingGeneral, setIsEditingGeneral] = useState(false);
  const [logoConfirmModal, setLogoConfirmModal] = useState({ isOpen: false, dataUrl: "", file: null });
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);
  const [savedMessage, _setSavedMessage] = useState("");
  const setSavedMessage = useCallback((msg) => {
    if (msg) {
      if (typeof msg === "string") {
        showAdminSystemToast(msg, "success");
      } else if (msg.text) {
        showAdminSystemToast(msg.text, msg.type || "success", msg.title);
      }
    }
  }, []);

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

  // ─── Load Backup Data & Trigger Daily Auto-Backup ───────────────────────────
  const refreshBackupData = useCallback(async () => {
    await runDailyAutoBackupRoutine().catch(() => {});
    setBackupHistory(getBackupHistory());
    setBackupStatsData(getBackupStats());
    setBkSettings(getBackupSettings());
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSettings(getSystemSettings());
      refreshBackupData();
    }
  }, [isOpen, refreshBackupData]);

  useEffect(() => {
    if (activeTab === "backup" && isOpen) {
      refreshBackupData();
    }
  }, [activeTab, isOpen, refreshBackupData]);

  useEffect(() => {
    const handleBackupUpdated = () => {
      setBackupHistory(getBackupHistory());
      setBackupStatsData(getBackupStats());
      setBkSettings(getBackupSettings());
    };

    window.addEventListener("kaagapai:backup-updated", handleBackupUpdated);
    return () => {
      window.removeEventListener("kaagapai:backup-updated", handleBackupUpdated);
    };
  }, []);

  // ─── General Settings Handlers ──────────────────────────────────────────────
  const updateField = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = String(e.target?.result || "");
        setLogoConfirmModal({ isOpen: true, dataUrl, file });
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    }
  };

  const handleConfirmLogoUpdate = () => {
    if (logoConfirmModal.dataUrl) {
      setBarangayLogo(logoConfirmModal.dataUrl);
      setLogoPreview(logoConfirmModal.dataUrl);
      updateField("barangayLogoUrl", logoConfirmModal.dataUrl);
      showAdminSystemToast({
        type: "success",
        title: "Barangay Logo Updated",
        text: "Official Barangay Logo updated successfully across all admin and resident portals.",
      });
    }
    setLogoConfirmModal({ isOpen: false, dataUrl: "", file: null });
  };

  const handleTestAi = async () => {
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const activeKey = settings.geminiApiKey || getActiveGeminiApiKey();
      const activeModel = settings.geminiModel || getActiveGeminiModel();
      const res = await testGeminiConnection(activeKey, activeModel);
      setAiTestResult(res);
      if (res.success) {
        showAdminSystemToast({
          type: "success",
          title: "Gemini AI Connected",
          text: `Successfully connected to ${res.model || "Gemini AI"}!`,
        });
      } else {
        showAdminSystemToast({
          type: "error",
          title: "Gemini Connection Failed",
          text: res.message || "Failed to reach Google Gemini API.",
        });
      }
    } catch (err) {
      setAiTestResult({ success: false, message: err.message });
    } finally {
      setTestingAi(false);
    }
  };

  const handleSave = async (event) => {
    event?.preventDefault();
    const saved = saveSystemSettings(settings);
    setSettings(saved);
    setIsEditingGeneral(false);
    setSavedMessage("System settings saved successfully!");
    showAdminSystemToast({
      type: "success",
      title: "Settings Saved",
      text: "Official Barangay contact information updated successfully.",
    });
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
    showAdminSystemToast({
      type: "info",
      title: "Settings Reset",
      text: "System settings reset to defaults.",
    });
    setTimeout(() => setSavedMessage(""), 4000);
  };

  // ─── Backup Handlers ───────────────────────────────────────────────────────
  const clearMessages = () => {
    setBackupStatus("");
    setBackupError("");
  };

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    clearMessages();
    try {
      const entry = await createAndUploadBackup("manual");
      setBackupStatus(`Backup Version ${entry.version} created successfully (${entry.sizeFormatted}).`);
      showAdminSystemToast({
        type: "success",
        title: "Backup Created",
        text: `Backup Version ${entry.version} saved (${entry.sizeFormatted}).`,
      });
      await refreshBackupData();
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
      message: `Are you sure you want to delete Version ${entry?.version || "?"} backup? This action cannot be undone.`,
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
      await refreshBackupData();
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
      message: "Current local settings and database records will be replaced with the backup data. A safety backup of your current system state will be automatically created first. Continue?",
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
      setBackupStatus(`Restored Version ${result.version} successfully.`);
      showAdminSystemToast({
        type: "success",
        title: "Backup Restored",
        text: `Version ${result.version} restored successfully.`,
      });
      await refreshBackupData();
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
      const ok = await confirm({
        title: "Restore from Local File",
        message: `Restore backup "${file.name}" (Version ${backup.version || "?"})? Current state will be overwritten (safety backup will be saved first).`,
        confirmText: "Restore File",
        cancelText: "Cancel",
        variant: "warning",
        icon: RotateCcw,
      });
      if (!ok) return;

      const result = await restoreLocalBackup(backup);
      setSettings(getSystemSettings());
      setBackupStatus(`Restored Version ${result.version} successfully.`);
      showAdminSystemToast({
        type: "success",
        title: "Local Backup Restored",
        text: `Version ${result.version} applied successfully.`,
      });
      await refreshBackupData();
    } catch (error) {
      setBackupError(error.message || "Invalid backup file.");
    } finally {
      setBackupLoading(false);
    }
  };

  // ─── Settings Modal ────────────────────────────────────────────────────────
  const openSettingsModal = () => {
    setBkSettings(getBackupSettings());
    setSettingsModal({ open: true });
  };

  const handleSaveBackupSettings = () => {
    saveBackupSettings(bkSettings);
    setSettingsModal({ open: false });
    refreshBackupData();
    setBackupStatus("Backup settings saved.");
    showAdminSystemToast({
      type: "success",
      title: "Backup Settings",
      text: "Automatic daily backup configuration updated.",
    });
  };

  // ─── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(backupHistory.length / ITEMS_PER_PAGE) || 1;
  const paginatedHistory = backupHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <>
      <FloatingModal
        open={isOpen}
        onClose={onClose}
        title="System Settings"
        eyebrow="Barangay Office & System Settings"
        description="Configure official barangay office information and manage automatic daily data backups"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-3.5">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-white px-2.5 pt-1.5 rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "general"
                  ? "border-[#00552E] text-[#00552E]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Building2 size={15} />
              <span>Barangay Profile & System Settings</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("backup")}
              className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "backup"
                  ? "border-[#00552E] text-[#00552E]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <DatabaseBackup size={15} />
              <span>Backup & Restore</span>
            </button>
          </div>

          {activeTab === "general" ? (
            /* ═══════════════════════════════════════════════════════════════════ */
            /* 1. GENERAL SETTINGS TAB                                             */
            /* ═══════════════════════════════════════════════════════════════════ */
            <form onSubmit={handleSave} className="space-y-3.5">
              <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00552E]/10 text-[#00552E] shrink-0">
                      <Building2 size={16} />
                    </span>
                    <div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">General Information</h3>
                      <p className="text-[11px] text-slate-500">
                        Official contact information and branding for Barangay Upper Mingading.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isEditingGeneral ? (
                      <button
                        type="button"
                        onClick={() => setIsEditingGeneral(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#00552E] px-3 py-1.5 text-xs font-black shadow-2xs transition active:scale-95 cursor-pointer"
                      >
                        <Pencil size={12} />
                        <span>Edit Settings</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 text-[11px] font-black animate-pulse">
                        <Lock size={12} /> Editing Mode
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 space-y-3">
                  {/* Barangay Logo Box */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-200 bg-white p-0.5 shadow-xs">
                        <img src={logoPreview || "/logo.png"} alt="Barangay Logo" className="h-full w-full rounded-full object-cover" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Barangay Logo</p>
                        <p className="text-[10px] text-slate-500">Official seal displayed on documents, resident dashboard & headers.</p>
                      </div>
                    </div>

                    <div className="shrink-0">
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
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#00552E] px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#004224] cursor-pointer active:scale-95"
                      >
                        <ImageIcon size={12} />
                        Change Logo
                      </button>
                    </div>
                  </div>

                  {/* Fields Grid */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                      Barangay Name
                      <input
                        type="text"
                        disabled={!isEditingGeneral}
                        value={settings.barangayName || "Barangay Upper Mingading"}
                        onChange={(e) => updateField("barangayName", e.target.value)}
                        placeholder="Enter barangay name"
                        className={`mt-1 w-full h-8.5 rounded-lg border px-3 text-xs font-semibold outline-none transition ${
                          !isEditingGeneral
                            ? "border-slate-200 bg-slate-100/70 text-slate-600 cursor-not-allowed select-none"
                            : "border-slate-300 bg-white text-slate-900 focus:border-[#00552E] focus:ring-2 focus:ring-[#00552E]/20"
                        }`}
                      />
                    </label>

                    <label className="block text-xs font-bold text-slate-700">
                      Office Email
                      <input
                        type="email"
                        disabled={!isEditingGeneral}
                        value={settings.officeEmail || ""}
                        onChange={(e) => updateField("officeEmail", e.target.value)}
                        placeholder="e.g. uppermingading@gmail.com (leave blank to hide)"
                        className={`mt-1 w-full h-8.5 rounded-lg border px-3 text-xs font-semibold outline-none transition ${
                          !isEditingGeneral
                            ? "border-slate-200 bg-slate-100/70 text-slate-600 cursor-not-allowed select-none"
                            : "border-slate-300 bg-white text-slate-900 focus:border-[#00552E] focus:ring-2 focus:ring-[#00552E]/20"
                        }`}
                      />
                    </label>

                    <label className="block text-xs font-bold text-slate-700">
                      Office Phone (Max 11 Digits)
                      <input
                        type="tel"
                        maxLength={11}
                        disabled={!isEditingGeneral}
                        value={settings.officePhone || ""}
                        onChange={(e) => updateField("officePhone", e.target.value.replace(/\D/g, "").slice(0, 11))}
                        placeholder="e.g. 09306259795 (leave blank to hide)"
                        className={`mt-1 w-full h-8.5 rounded-lg border px-3 text-xs font-semibold font-mono tracking-wide outline-none transition ${
                          !isEditingGeneral
                            ? "border-slate-200 bg-slate-100/70 text-slate-600 cursor-not-allowed select-none"
                            : "border-slate-300 bg-white text-slate-900 focus:border-[#00552E] focus:ring-2 focus:ring-[#00552E]/20"
                        }`}
                      />
                    </label>

                    <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                      Office Hours
                      <input
                        type="text"
                        disabled={!isEditingGeneral}
                        value={settings.officeHours || "Monday to Friday, 8:00 AM - 5:00 PM"}
                        onChange={(e) => updateField("officeHours", e.target.value)}
                        placeholder="e.g. Monday to Friday, 8:00 AM - 5:00 PM"
                        className={`mt-1 w-full h-8.5 rounded-lg border px-3 text-xs font-semibold outline-none transition ${
                          !isEditingGeneral
                            ? "border-slate-200 bg-slate-100/70 text-slate-600 cursor-not-allowed select-none"
                            : "border-slate-300 bg-white text-slate-900 focus:border-[#00552E] focus:ring-2 focus:ring-[#00552E]/20"
                        }`}
                      />
                    </label>
                  </div>
                </div>
              </section>

              {/* ─── Google Gemini AI Configuration ────────────────────────────── */}
              <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-white shrink-0 shadow-xs">
                      <Brain size={16} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">Google Gemini AI Engine</h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-850 border border-emerald-300 px-2 py-0.5 text-[10px] font-black">
                          <Sparkles size={10} /> Pro & High-Tier
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Configure the active Gemini model and API key powering the Resident Chatbot, Copilot & Document OCR.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Active Gemini Model */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700">
                        Active Gemini AI Model
                        <select
                          disabled={!isEditingGeneral}
                          value={settings.geminiModel || "gemini-2.0-flash"}
                          onChange={(e) => updateField("geminiModel", e.target.value)}
                          className={`mt-1 w-full h-8.5 rounded-lg border px-3 text-xs font-semibold outline-none transition ${
                            !isEditingGeneral
                              ? "border-slate-200 bg-slate-100/70 text-slate-600 cursor-not-allowed select-none"
                              : "border-slate-300 bg-white text-slate-900 focus:border-[#00552E] focus:ring-2 focus:ring-[#00552E]/20"
                          }`}
                        >
                          {AVAILABLE_GEMINI_MODELS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} - {m.description}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Select <strong>Gemini 2.0 Flash</strong> for high speed or <strong>Gemini 1.5 Pro / 2.5 Pro</strong> for deep reasoning.
                      </p>
                    </div>

                    {/* Gemini API Key */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700">
                        Google Gemini API Key
                        <div className="relative mt-1">
                          <input
                            type={showApiKey ? "text" : "password"}
                            disabled={!isEditingGeneral}
                            value={settings.geminiApiKey || ""}
                            onChange={(e) => updateField("geminiApiKey", e.target.value)}
                            placeholder="AIzaSy... (leave blank to use .env key)"
                            className={`w-full h-8.5 rounded-lg border pl-3 pr-9 text-xs font-mono font-semibold outline-none transition ${
                              !isEditingGeneral
                                ? "border-slate-200 bg-slate-100/70 text-slate-600 cursor-not-allowed select-none"
                                : "border-slate-300 bg-white text-slate-900 focus:border-[#00552E] focus:ring-2 focus:ring-[#00552E]/20"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </label>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Get your API key for free from <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline">Google AI Studio</a>.
                      </p>
                    </div>
                  </div>

                  {/* Test Connection Button & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestAi}
                        disabled={testingAi}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-[#00552E] px-3 py-1 text-xs font-bold shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {testingAi ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                        <span>{testingAi ? "Testing API..." : "Test AI Connection"}</span>
                      </button>

                      {aiTestResult && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            aiTestResult.success
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-rose-100 text-rose-800 border border-rose-300"
                          }`}
                        >
                          {aiTestResult.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                          {aiTestResult.success ? `Connected (${aiTestResult.model})` : `Failed: ${aiTestResult.message}`}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-500 font-medium">
                      High reasoning intelligence enabled
                    </span>
                  </div>
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  Reset Defaults
                </button>

                {isEditingGeneral ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSettings(getSystemSettings());
                        setIsEditingGeneral(false);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-2xs transition hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#00552E] px-4 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#004224] cursor-pointer active:scale-98"
                    >
                      <Save size={13} />
                      Save Changes
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingGeneral(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#00552E] px-4 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#004224] cursor-pointer active:scale-98"
                  >
                    <Pencil size={13} />
                    Edit Information
                  </button>
                )}
              </div>
            </form>
          ) : (
            /* ═══════════════════════════════════════════════════════════════════ */
            /* 2. BACKUP & RESTORE TAB                                             */
            /* ═══════════════════════════════════════════════════════════════════ */
            <div className="space-y-3.5">
              {backupStatus && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 shadow-2xs">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                  <span className="flex-1">{backupStatus}</span>
                  <button onClick={() => setBackupStatus("")} className="text-emerald-700 hover:text-emerald-950 cursor-pointer">
                    ✕
                  </button>
                </div>
              )}

              {backupError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 shadow-2xs">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span className="flex-1">{backupError}</span>
                  <button onClick={() => setBackupError("")} className="text-rose-700 hover:text-rose-950 cursor-pointer">
                    ✕
                  </button>
                </div>
              )}

              {/* Dashboard Card */}
              <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00552E]/10 text-[#00552E] shrink-0">
                      <DatabaseBackup size={16} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">Database Backup</h3>
                        <span className="rounded bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 text-[9px] font-black uppercase">
                          Daily Auto-Backup Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Automatic daily snapshot with auto-delete retention to prevent heavy storage.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openSettingsModal}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 cursor-pointer shrink-0 self-start sm:self-center"
                  >
                    <Settings2 size={13} />
                    Backup Settings
                  </button>
                </div>

                {/* Stats Grid */}
                {backupStatsData && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
                        <div key={stat.label} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2 text-center">
                          <div className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded ${stat.color}`}>
                            <Icon size={12} />
                          </div>
                          <p className="text-xs font-black text-slate-900 leading-tight">{stat.value}</p>
                          <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
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
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#00552E] px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#004224] disabled:opacity-60 cursor-pointer"
                  >
                    {backupLoading ? <Loader2 size={13} className="animate-spin" /> : <CloudUpload size={13} />}
                    <span>{backupLoading ? "Creating..." : "Create Backup"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => restoreFileRef.current?.click()}
                    disabled={backupLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                  >
                    <Upload size={13} className="text-[#00552E]" />
                    Upload & Restore
                  </button>
                </div>
              </section>

              {/* Backup History Table */}
              <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <History size={15} className="text-[#00552E]" />
                    <h3 className="text-xs font-extrabold text-slate-900">Backup History</h3>
                    <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-600">
                      {backupHistory.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={refreshBackupData}
                    className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
                    title="Refresh"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>

                {backupHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-2">
                      <DatabaseBackup size={20} />
                    </div>
                    <p className="text-xs font-bold text-slate-700">No backups yet</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 max-w-xs">
                      Click "Create Backup" or daily auto-backup will save a snapshot automatically.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase text-[10px] text-slate-500">
                          <tr>
                            <th className="px-3 py-2 w-12">Ver</th>
                            <th className="px-3 py-2">File Name</th>
                            <th className="px-3 py-2">Date Created</th>
                            <th className="px-3 py-2">Size</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Records</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                          {paginatedHistory.map((item) => (
                            <tr key={item.id} className="transition hover:bg-slate-50/60 group text-xs">
                              <td className="px-3 py-2">
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#00552E]/10 text-[10px] font-black text-[#00552E]">
                                  {item.version}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                  <FileSpreadsheet size={13} className="shrink-0 text-[#00552E]" />
                                  <span className="font-bold text-slate-900 truncate max-w-[180px]">{item.filename}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-slate-500 text-[11px]">
                                {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                                <span className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px]">{item.sizeFormatted}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold border ${TYPE_BADGE[item.typeLabel] || TYPE_BADGE.Manual}`}>
                                  {item.typeLabel === "Automatic" && <Zap size={8} />}
                                  {item.typeLabel === "Safety" && <Shield size={8} />}
                                  {item.typeLabel}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-500 text-[11px]">
                                {item.totalRows?.toLocaleString() || "—"}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openPreview(item.id)}
                                    className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
                                    title="Preview"
                                  >
                                    <Eye size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadBackup(item.id)}
                                    className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer"
                                    title="Download"
                                  >
                                    <Download size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openRestoreFromCloud(item.id)}
                                    className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-amber-50 hover:text-amber-600 cursor-pointer"
                                    title="Restore"
                                  >
                                    <RotateCcw size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBackup(item.id)}
                                    className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-slate-100 px-3.5 py-2">
                        <p className="text-[10px] font-semibold text-slate-500">
                          Page {currentPage} of {totalPages}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                          >
                            <ChevronLeft size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                          >
                            <ChevronRight size={12} />
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
      </FloatingModal>

      {/* ─── Compact Backup Settings Modal ─── */}
      <FloatingModal
        open={settingsModal.open}
        onClose={() => setSettingsModal({ open: false })}
        title="Backup Configuration"
        eyebrow="System Storage"
        description="Automatic backup schedule and storage optimization"
        maxWidth="max-w-md"
      >
        <div className="space-y-3.5 text-xs">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="font-extrabold text-slate-900">Daily Auto-Backup</p>
              <p className="text-[10px] text-slate-500">Automatically creates daily snapshot & purges old backups.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={bkSettings.autoBackupEnabled}
                onChange={(e) => setBkSettings((p) => ({ ...p, autoBackupEnabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00552E]" />
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Backup Retention Period (Days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={bkSettings.retentionDays}
              onChange={(e) => setBkSettings((p) => ({ ...p, retentionDays: Math.max(1, Number(e.target.value)) }))}
              className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#00552E]"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              Backups older than this period are automatically removed to save storage.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSettingsModal({ open: false })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveBackupSettings}
              className="rounded-lg bg-[#00552E] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#004224] cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </FloatingModal>

      {/* ─── Compact Backup Preview Modal ─── */}
      <FloatingModal
        open={previewModal.open}
        onClose={() => setPreviewModal({ open: false, data: null, loading: false })}
        title="Backup Contents Preview"
        eyebrow="Database Snapshot"
        description="Review tables and records stored in this backup"
        maxWidth="max-w-md"
      >
        {previewModal.loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-[#00552E]" />
            <p className="mt-2 text-xs font-semibold text-slate-500">Loading preview...</p>
          </div>
        ) : previewModal.data ? (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-emerald-50/60 p-2.5 border border-emerald-200">
              <div>
                <span className="text-[10px] text-slate-500 block">Version & Date</span>
                <span className="font-bold text-slate-800">Version {previewModal.data.version} ({new Date(previewModal.data.createdAt).toLocaleDateString()})</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Total Records</span>
                <span className="font-bold text-emerald-900">{previewModal.data.totalRows?.toLocaleString()} rows</span>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Database Tables</p>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {Object.entries(previewModal.data.tables || {}).map(([tbl, info]) => {
                  const Icon = TABLE_ICONS[tbl] || Database;
                  return (
                    <div key={tbl} className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-2 py-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <Icon size={12} className="text-[#00552E] shrink-0" />
                        <span className="truncate text-[11px] font-medium text-slate-700">{tbl}</span>
                      </div>
                      <span className="font-bold text-slate-900 font-mono text-[10px]">{info.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewModal({ open: false, data: null, loading: false })}
                className="rounded-lg bg-[#00552E] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#004224] cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        ) : null}
      </FloatingModal>

      {/* ─── Compact Backup Restore Modal ─── */}
      <FloatingModal
        open={restoreModal.open}
        onClose={() => setRestoreModal({ open: false, backupId: null, preview: null, loading: false, step: "preview" })}
        title="Restore Database Backup"
        eyebrow="Database Recovery"
        description="Replace current records with this backup snapshot"
        maxWidth="max-w-md"
      >
        {restoreModal.loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-[#00552E]" />
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {restoreModal.step === "restoring" ? "Restoring database snapshot..." : "Loading backup preview..."}
            </p>
          </div>
        ) : restoreModal.preview ? (
          <div className="space-y-3 text-xs">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-900 flex items-start gap-2">
              <Shield size={16} className="shrink-0 text-amber-600 mt-0.5" />
              <p className="text-[11px] leading-snug">
                A safety backup of your current database will be automatically created before restoring.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex justify-between items-center">
              <span className="font-bold text-slate-800">Version {restoreModal.preview.version}</span>
              <span className="font-black text-emerald-900 font-mono">{restoreModal.preview.totalRows?.toLocaleString()} rows</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRestoreModal({ open: false, backupId: null, preview: null, loading: false, step: "preview" })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRestore}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#00552E] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#004224] cursor-pointer"
              >
                <RotateCcw size={12} />
                Proceed with Restore
              </button>
            </div>
          </div>
        ) : null}
      </FloatingModal>

      {/* ─── Change Logo Confirmation Modal ─── */}
      <FloatingModal
        open={logoConfirmModal.isOpen}
        onClose={() => setLogoConfirmModal({ isOpen: false, dataUrl: "", file: null })}
        title="Confirm Official Seal Update"
        eyebrow="Barangay Branding"
        description="Verify the new seal before applying it across the entire system"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
            <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-emerald-400 bg-white p-1 shadow-lg">
              <img
                src={logoConfirmModal.dataUrl}
                alt="New Logo Preview"
                className="h-full w-full rounded-full object-contain"
              />
            </div>
            <p className="mt-3 text-xs font-black text-slate-800 text-center">
              New Official Barangay Seal
            </p>
            <p className="mt-1 text-[11px] text-slate-500 text-center max-w-xs">
              This logo will immediately appear on all document templates, admin headers, sidebar navigation, and resident portals.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setLogoConfirmModal({ isOpen: false, dataUrl: "", file: null })}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmLogoUpdate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#00552E] px-4 py-2 text-xs font-black text-white shadow-md hover:bg-[#004224] transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 size={14} />
              Confirm & Apply Logo
            </button>
          </div>
        </div>
      </FloatingModal>
    </>
  );
};

export default SystemSettingsModal;
