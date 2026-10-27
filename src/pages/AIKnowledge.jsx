import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Bot,
  Brain,
  BrainCircuit,
  Briefcase,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  Edit2,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FileUp,
  Filter,
  GraduationCap,
  History,
  Image as ImageIcon,
  Info,
  Layers,
  Lightbulb,
  Loader,
  Megaphone,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  User,
  Users,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import Header from "../components/Header";
import FloatingModal from "../components/FloatingModal";
import { fetchAnnouncements } from "../services/announcementService";
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  fetchKnowledgeItems,
  syncKnowledgeFromAnnouncement,
  syncKnowledgeFromLivelihood,
  updateKnowledgeItem,
} from "../services/knowledgeService";
import { fetchLivelihoodPosts } from "../services/livelihoodService";
import {
  parseFileToKnowledgeText,
  analyzeAndStructureKnowledgeWithAi,
} from "../utils/fileKnowledgeParser";
import { askResidentAssistant } from "../services/residentAssistantService";
import { showAdminSystemToast } from "../utils/toast";
import {
  getAiSettings,
  saveAiSettings,
  resetAiSettings,
  fetchAiLogs,
  clearAllAiLogs,
  deleteSingleAiLog,
  recordKnowledgeVersionSnapshot,
  fetchKnowledgeVersions,
  rollbackKnowledgeToVersion,
  toggleKnowledgePublishStatus,
  DEFAULT_AI_SETTINGS,
} from "../services/aiAdminService";

const initialForm = {
  title: "",
  content: "",
  category: "General",
  audience: "All Residents",
  status: "Active",
  version: "1.0",
  effective_date: new Date().toISOString().slice(0, 10),
  expires_at: "",
};

const categoryOptions = [
  "General",
  "Governance",
  "Health & Sanitation",
  "Public Safety & Disaster",
  "Social Welfare",
  "Ordinances & Policies",
  "Agriculture & Livelihood",
  "Document Processing",
];

const audienceOptions = [
  "All Residents",
  "Registered Residents",
  "Senior Citizens",
  "Youth",
  "PWD/PWED Residents",
  "Family Household Representatives",
  "Admin Only",
];

const statusClass = (status) => {
  if (status === "Active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "Archived") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
};

const sourceMeta = {
  manual: { label: "Manual Input", icon: FileText, color: "bg-blue-50 text-blue-700 border-blue-200" },
  document_upload: { label: "Doc Upload / AI Ingest", icon: FileUp, color: "bg-purple-50 text-purple-700 border-purple-200" },
  announcement: { label: "Announcement", icon: Megaphone, color: "bg-rose-50 text-rose-700 border-rose-200" },
  livelihood: { label: "Livelihood & Jobs", icon: Briefcase, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const formatDate = (dateValue) => {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatTime = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const AIKnowledge = ({ defaultTab }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab") || defaultTab || "knowledge";

  // ─── MAIN 3 PILLARS: "knowledge" | "settings" | "logs" ───
  const [activePillar, setActivePillar] = useState(
    ["knowledge", "settings", "logs"].includes(urlTab) ? urlTab : "knowledge"
  );

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["knowledge", "settings", "logs"].includes(tab) && tab !== activePillar) {
      setActivePillar(tab);
    }
  }, [searchParams, activePillar]);

  const handleSelectPillar = (pillarKey) => {
    setActivePillar(pillarKey);
    setSearchParams({ tab: pillarKey });
  };

  // ─────────────────────────────────────────────────────────────
  // 1. KNOWLEDGE BASE STATE & LOGIC
  // ─────────────────────────────────────────────────────────────
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  // Modals & Drawers
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(initialForm);

  // Version History & Rollback Modal
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rollbackItem, setRollbackItem] = useState(null);
  const [versionHistory, setVersionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  // Document Upload & AI Parsing State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [savingUpload, setSavingUpload] = useState(false);
  const [uploadFormData, setUploadFormData] = useState({
    title: "",
    category: "General",
    audience: "All Residents",
    status: "Active",
    effective_date: new Date().toISOString().slice(0, 10),
    content: "",
    sampleQuestions: [],
  });
  const fileInputRef = useRef(null);

  // Interactive Chatbot Simulator
  const [showSimulator, setShowSimulator] = useState(false);
  const [simQuestion, setSimQuestion] = useState("");
  const [simLoading, setSimLoading] = useState(false);
  const [simHistory, setSimHistory] = useState([
    {
      role: "bot",
      text: "Magandang araw! Ako si KaagapAI. Handa akong sumagot base sa lahat ng mga patakaran, ordinansa, at gabay na nakatala sa ating AI Knowledge Base!",
      matchedSource: "System Initialization",
    },
  ]);

  const loadKnowledge = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKnowledgeItems({
        search,
        status: statusFilter,
        category: categoryFilter,
        source_type: sourceFilter,
        limit: 150,
      });
      setItems(data || []);
    } catch (error) {
      showAdminSystemToast(error.message || "Failed to load knowledge records.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, sourceFilter]);

  useEffect(() => {
    if (activePillar === "knowledge") {
      loadKnowledge();
    }
  }, [loadKnowledge, activePillar]);

  // Upload handler
  const processFile = async (file) => {
    setUploadFile(file);
    setParsingFile(true);
    try {
      showAdminSystemToast(`Reading & extracting text from ${file.name}...`, "info");
      const parsed = await parseFileToKnowledgeText(file);
      showAdminSystemToast("Structuring policies & knowledge with AI...", "info");
      const structured = await analyzeAndStructureKnowledgeWithAi(parsed);
      setUploadFormData({
        title: structured.title || parsed.title || "Imported Knowledge Record",
        category: structured.category || "General",
        audience: structured.audience || "All Residents",
        status: "Active",
        effective_date: new Date().toISOString().slice(0, 10),
        content: structured.content || parsed.text || "",
        sampleQuestions: structured.sampleQuestions || [],
      });
      showAdminSystemToast("Document parsed successfully! Review and click Train Chatbot.", "success");
    } catch (err) {
      console.error("File parsing error:", err);
      showAdminSystemToast(err.message || "Failed to process file.", "error");
    } finally {
      setParsingFile(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleSaveUploadedDocument = async () => {
    if (!uploadFormData.title?.trim()) {
      showAdminSystemToast("Please enter a title for the document.", "error");
      return;
    }
    if (!uploadFormData.content?.trim()) {
      showAdminSystemToast("Knowledge content cannot be empty.", "error");
      return;
    }
    setSavingUpload(true);
    try {
      const created = await createKnowledgeItem({
        ...uploadFormData,
        version: "1.0",
        source_type: "document_upload",
      });
      if (created?.id) {
        await recordKnowledgeVersionSnapshot(created, "Initial upload & AI ingestion");
      }
      showAdminSystemToast(`Document "${uploadFormData.title}" successfully trained into Chatbot!`, "success");
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadFormData({
        title: "",
        category: "General",
        audience: "All Residents",
        status: "Active",
        effective_date: new Date().toISOString().slice(0, 10),
        content: "",
        sampleQuestions: [],
      });
      await loadKnowledge();
    } catch (err) {
      showAdminSystemToast(err.message || "Failed to save uploaded document.", "error");
    } finally {
      setSavingUpload(false);
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormData(initialForm);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title || "",
      category: item.category || "General",
      audience: item.audience || "All Residents",
      status: item.status || "Active",
      version: item.version || "1.0",
      effective_date: item.effective_date || new Date().toISOString().slice(0, 10),
      expires_at: item.expires_at || "",
      content: item.content || "",
    });
    setShowModal(true);
  };

  const openView = (item) => {
    setViewingItem(item);
    setShowViewModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData(initialForm);
  };

  const handleInput = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.title?.trim()) {
      showAdminSystemToast("Title is required.", "error");
      return;
    }
    if (!formData.content?.trim()) {
      showAdminSystemToast("Content is required to train the Chatbot.", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        // Record version snapshot before update
        await recordKnowledgeVersionSnapshot(
          editingItem,
          `Snapshot before updating to version ${formData.version || "1.1"}`
        );

        await updateKnowledgeItem(editingItem.id, {
          title: formData.title.trim(),
          category: formData.category,
          audience: formData.audience,
          status: formData.status,
          version: formData.version || "1.1",
          effective_date: formData.effective_date || null,
          expires_at: formData.expires_at || null,
          content: formData.content.trim(),
        });
        showAdminSystemToast(`Knowledge record "${formData.title}" updated & re-trained!`, "success");
      } else {
        const created = await createKnowledgeItem({
          title: formData.title.trim(),
          category: formData.category,
          audience: formData.audience,
          status: formData.status,
          version: formData.version || "1.0",
          effective_date: formData.effective_date || null,
          expires_at: formData.expires_at || null,
          content: formData.content.trim(),
          source_type: "manual",
        });
        if (created?.id) {
          await recordKnowledgeVersionSnapshot(created, "Initial version created");
        }
        showAdminSystemToast(`New knowledge record "${formData.title}" successfully added to Chatbot!`, "success");
      }

      closeModal();
      await loadKnowledge();
    } catch (error) {
      showAdminSystemToast(error.message || "Failed to save knowledge record.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${item.title}"? This will remove its memory from the Chatbot.`);
    if (!confirmed) return;

    try {
      await deleteKnowledgeItem(item.id);
      showAdminSystemToast(`"${item.title}" deleted from AI knowledge base.`, "success");
      await loadKnowledge();
    } catch (error) {
      showAdminSystemToast(error.message || "Failed to delete item.", "error");
    }
  };

  // Publish / Unpublish Toggle
  const handleTogglePublish = async (item) => {
    try {
      const updated = await toggleKnowledgePublishStatus(item.id, item.status);
      const isNowActive = updated?.status === "Active";
      showAdminSystemToast(
        isNowActive
          ? `"${item.title}" is now Published & Active in the Chatbot!`
          : `"${item.title}" is now Archived / Paused.`,
        "success"
      );
      await loadKnowledge();
    } catch (err) {
      showAdminSystemToast(err.message || "Failed to toggle status.", "error");
    }
  };

  // Rollback Modal Open & Fetch
  const openRollbackModal = async (item) => {
    setRollbackItem(item);
    setShowRollbackModal(true);
    setLoadingHistory(true);
    try {
      const history = await fetchKnowledgeVersions(item.id);
      setVersionHistory(history);
    } catch (err) {
      console.error("Error fetching version history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExecuteRollback = async (versionSnapshot) => {
    if (!rollbackItem || !versionSnapshot) return;
    const ok = window.confirm(
      `Rollback "${rollbackItem.title}" to version ${versionSnapshot.version} from ${formatDate(versionSnapshot.created_at)}?`
    );
    if (!ok) return;

    setRollingBack(true);
    try {
      await rollbackKnowledgeToVersion(rollbackItem.id, versionSnapshot);
      showAdminSystemToast(`Successfully restored "${rollbackItem.title}" to version ${versionSnapshot.version}!`, "success");
      setShowRollbackModal(false);
      await loadKnowledge();
    } catch (err) {
      showAdminSystemToast(err.message || "Failed to rollback version.", "error");
    } finally {
      setRollingBack(false);
    }
  };

  // Re-sync all content
  const syncPublishedContent = async () => {
    setSyncing(true);
    try {
      const [announcements, livelihood] = await Promise.all([
        fetchAnnouncements({ status: "Published", limit: 30 }).catch(() => []),
        fetchLivelihoodPosts({ status: "Open", limit: 30 }).catch(() => []),
      ]);

      const tasks = [
        ...announcements.map((item) => syncKnowledgeFromAnnouncement(item)),
        ...livelihood.map((item) => syncKnowledgeFromLivelihood(item)),
      ];

      const results = await Promise.allSettled(tasks);
      const synced = results.filter((r) => r.status === "fulfilled").length;
      showAdminSystemToast(`Synced ${synced} announcements and livelihood items into AI memory!`, "success");
      await loadKnowledge();
    } catch (error) {
      showAdminSystemToast(error.message || "Failed to sync content.", "error");
    } finally {
      setSyncing(false);
    }
  };

  // Chatbot Simulator Playground Query
  const handleTestChatbot = async (e, customQuery = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const q = (customQuery || simQuestion).trim();
    if (!q) return;

    setSimHistory((prev) => [...prev, { role: "user", text: q }]);
    setSimQuestion("");
    setSimLoading(true);

    try {
      const STOP_WORDS = new Set([
        "ang", "mga", "sa", "ng", "at", "na", "o", "kay", "para", "ni", "ito", "iyon", "doon", "dito",
        "ba", "po", "opo", "ko", "mo", "siya", "kami", "tayo", "sila", "saan", "paano", "kailan",
        "ano", "sino", "bakit", "pwede", "pede", "kuha", "kumuha", "mag", "natin", "inyo", "aking",
        "the", "is", "at", "which", "on", "a", "an", "and", "or", "in", "to", "for", "with", "from",
        "can", "how", "what", "where", "when", "who", "why"
      ]);
      const normQ = q.toLowerCase().trim();
      const qWords = normQ.split(/\s+/).filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

      const scoredItems = items.map((it) => {
        let score = 0;
        const titleNorm = (it.title || "").toLowerCase();
        const contentNorm = (it.content || "").toLowerCase();

        // Exact / title inclusion
        if (normQ.includes(titleNorm) && titleNorm.length >= 3) score += 60;
        if (titleNorm.includes(normQ) && normQ.length >= 3) score += 50;

        qWords.forEach((w) => {
          if (titleNorm.includes(w)) score += 30;
          else if (contentNorm.includes(w)) score += 10;
        });
        return { item: it, score };
      });
      scoredItems.sort((a, b) => b.score - a.score);
      const topMatches = scoredItems.filter((s) => s.score >= 10).slice(0, 2).map((s) => s.item);

      const replyText = await askResidentAssistant(q, {
        knowledgeItems: items,
        conversationHistory: simHistory,
        isSimulator: true,
        source: "AI Playground",
      });

      const matchedSource = topMatches.length > 0
        ? topMatches.map((m) => m.title).join(", ")
        : "Dynamic Admin Knowledge Base";

      setSimHistory((prev) => [
        ...prev,
        { role: "bot", text: replyText || "I'm here to help with Barangay Upper Mingading services, document requests, announcements, and livelihoods.", matchedSource },
      ]);
    } catch (err) {
      console.warn("AI Playground query error, falling back gracefully:", err);
      const fallbackReply = await askResidentAssistant(q, {
        knowledgeItems: items,
        conversationHistory: simHistory,
        isSimulator: true,
        source: "AI Playground",
      });
      setSimHistory((prev) => [
        ...prev,
        {
          role: "bot",
          text: fallbackReply || "I apologize, but I am currently assisting with Barangay Upper Mingading public services, document requests, and announcements. How can I help you?",
          matchedSource: "Local Assistant Engine",
        },
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 2. AI SETTINGS STATE & LOGIC
  // ─────────────────────────────────────────────────────────────
  const [aiSettings, setAiSettings] = useState(DEFAULT_AI_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [bannedWordInput, setBannedWordInput] = useState("");

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const data = await getAiSettings();
      setAiSettings(data);
    } catch (err) {
      console.error("Error loading AI settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (activePillar === "settings") {
      loadSettings();
    }
  }, [loadSettings, activePillar]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await saveAiSettings(aiSettings);
      showAdminSystemToast("AI Settings & System Prompt saved successfully!", "success");
    } catch (err) {
      showAdminSystemToast(err.message || "Failed to save AI Settings.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSettings = async () => {
    const ok = window.confirm("Reset all AI Settings, System Prompt, and Safety Rules to system defaults?");
    if (!ok) return;

    setSavingSettings(true);
    try {
      const res = await resetAiSettings();
      setAiSettings(res.settings);
      showAdminSystemToast("AI Settings restored to defaults!", "success");
    } catch (err) {
      showAdminSystemToast(err.message || "Failed to reset AI settings.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddBannedWord = () => {
    const word = bannedWordInput.trim().toLowerCase();
    if (!word) return;
    if (!aiSettings.customBannedWords.includes(word)) {
      setAiSettings((prev) => ({
        ...prev,
        customBannedWords: [...prev.customBannedWords, word],
      }));
    }
    setBannedWordInput("");
  };

  const handleRemoveBannedWord = (wordToRemove) => {
    setAiSettings((prev) => ({
      ...prev,
      customBannedWords: prev.customBannedWords.filter((w) => w !== wordToRemove),
    }));
  };

  // ─────────────────────────────────────────────────────────────
  // 3. AI LOGS STATE & LOGIC
  // ─────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState("all"); // 'all' | 'answered' | 'failed' | 'unanswered'
  const [logSearch, setLogSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const data = await fetchAiLogs({
        filter: logFilter,
        search: logSearch,
        limit: 200,
      });
      setLogs(data);
    } catch (err) {
      console.error("Error loading AI logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, [logFilter, logSearch]);

  useEffect(() => {
    if (activePillar === "logs") {
      loadLogs();
    }
  }, [loadLogs, activePillar]);

  const handleClearLogs = async () => {
    const ok = window.confirm("Are you sure you want to clear all recorded AI logs?");
    if (!ok) return;

    try {
      await clearAllAiLogs();
      showAdminSystemToast("AI logs cleared.", "success");
      setLogs([]);
    } catch (err) {
      showAdminSystemToast(err.message || "Failed to clear logs.", "error");
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      await deleteSingleAiLog(logId);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
      showAdminSystemToast("Log entry removed.", "success");
    } catch (err) {
      showAdminSystemToast(err.message || "Failed to delete log.", "error");
    }
  };

  // Convert an Unanswered Question into a New Knowledge Record
  const handleTrainFromUnansweredQuestion = (log) => {
    setActivePillar("knowledge");
    setSearchParams({ tab: "knowledge" });
    setEditingItem(null);
    setFormData({
      ...initialForm,
      title: `Policy on: ${log.question.slice(0, 70)}`,
      category: "General",
      content: `Official policy / guidelines regarding:\n"${log.question}"\n\n[Enter official barangay instructions, requirements, or steps here]`,
      version: "1.0",
      status: "Active",
    });
    setShowModal(true);
  };

  // Stats Computations
  const stats = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((i) => i.status === "Active").length,
      uploaded: items.filter((i) => i.source_type === "document_upload").length,
      synced: items.filter((i) => ["announcement", "livelihood"].includes(i.source_type)).length,
    };
  }, [items]);

  const logStats = useMemo(() => {
    const total = logs.length;
    const answered = logs.filter((l) => l.status === "success").length;
    const failed = logs.filter((l) => l.status === "failed").length;
    const unanswered = logs.filter((l) => l.status === "unanswered" || l.is_unanswered).length;
    return { total, answered, failed, unanswered };
  }, [logs]);

  return (
    <div className="min-h-screen bg-[#F0FDF4]/30 pb-24">
      <Header
        title="AI Control Center"
        subtitle="Manage the Knowledge Base, customize AI Settings & System Prompt, and monitor Live Resident AI Logs"
      />

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* ═══════════════════════════════════════════════════════════
            MASTER TOP NAVIGATION PILLARS (TREE BLUEPRINT)
            ADMIN -> Knowledge Base | AI Settings | AI Logs
        ══════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl border-2 border-emerald-950/10 bg-white p-2 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* 1. Knowledge Base Tab */}
            <button
              type="button"
              onClick={() => handleSelectPillar("knowledge")}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
                activePillar === "knowledge"
                  ? "bg-[#00552E] text-white shadow-md shadow-emerald-900/20 scale-[1.02]"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Database size={16} className={activePillar === "knowledge" ? "text-[#FFD700]" : "text-slate-400"} />
              <span>Knowledge Base</span>
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                activePillar === "knowledge" ? "bg-emerald-800 text-emerald-100" : "bg-slate-100 text-slate-600"
              }`}>
                {items.length}
              </span>
            </button>

            {/* 2. AI Settings Tab */}
            <button
              type="button"
              onClick={() => handleSelectPillar("settings")}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
                activePillar === "settings"
                  ? "bg-[#00552E] text-white shadow-md shadow-emerald-900/20 scale-[1.02]"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Sliders size={16} className={activePillar === "settings" ? "text-[#FFD700]" : "text-slate-400"} />
              <span>AI Settings</span>
              <span className="hidden sm:inline text-[10px] uppercase font-extrabold text-emerald-200/80 tracking-wider">
                • Behavior & Rules
              </span>
            </button>

            {/* 3. AI Logs Tab */}
            <button
              type="button"
              onClick={() => handleSelectPillar("logs")}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
                activePillar === "logs"
                  ? "bg-[#00552E] text-white shadow-md shadow-emerald-900/20 scale-[1.02]"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <MessageSquare size={16} className={activePillar === "logs" ? "text-[#FFD700]" : "text-slate-400"} />
              <span>AI Logs</span>
              {logStats.unanswered > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#FFB800] text-slate-950 text-[10px] font-black animate-pulse shadow-xs">
                  {logStats.unanswered} Gaps
                </span>
              )}
            </button>
          </div>

          {/* Quick simulator shortcut button */}
          <button
            type="button"
            onClick={() => setShowSimulator(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-xs border border-amber-500 transition hover:scale-105 active:scale-95 cursor-pointer ml-auto"
            title="Open Interactive Chatbot Simulator"
          >
            <Bot size={15} className="text-slate-950" />
            <span>Test Chatbot</span>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            PILLAR 1: KNOWLEDGE BASE (Add, Edit, Upload, Publish, Version, Rollback)
        ══════════════════════════════════════════════════════════════ */}
        {activePillar === "knowledge" && (
          <div className="space-y-6 animate-fadeIn">
            {/* 1. Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-xs flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Database size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Knowledge</p>
                  <p className="text-xl font-black text-slate-900">{stats.total} records</p>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-xs flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
                  <BrainCircuit size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active & Published</p>
                  <p className="text-xl font-black text-teal-900">{stats.active} trained</p>
                </div>
              </div>

              <div className="rounded-2xl border border-purple-100 bg-white p-4 shadow-xs flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                  <FileUp size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Doc Uploads / Files</p>
                  <p className="text-xl font-black text-purple-900">{stats.uploaded} documents</p>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-xs flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                  <RefreshCw size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Auto-Synced Feeds</p>
                  <p className="text-xl font-black text-blue-900">{stats.synced} feeds</p>
                </div>
              </div>
            </div>

            {/* 2. Top Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                  Knowledge Actions:
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Upload Document Button */}
                <button
                  type="button"
                  onClick={() => {
                    setUploadFile(null);
                    setShowUploadModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs sm:text-sm shadow-md transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                  title="Upload Word, PDF, Text, or Image files to train the chatbot"
                >
                  <FileUp size={16} className="stroke-[2.5] text-white" />
                  <span>Upload Document</span>
                </button>

                {/* Add New Knowledge */}
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00552E] hover:bg-[#004224] text-white font-black text-xs sm:text-sm shadow-md transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <Plus size={16} className="stroke-[3] text-white" />
                  <span>New Knowledge</span>
                </button>

                {/* Re-Sync All Content */}
                <button
                  type="button"
                  onClick={syncPublishedContent}
                  disabled={syncing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-black text-xs sm:text-sm shadow-xs border border-slate-300 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-60"
                  title="Re-sync all announcements and livelihood items"
                >
                  {syncing ? <Loader size={16} className="animate-spin text-emerald-700" /> : <RefreshCw size={16} className="stroke-[2.5] text-emerald-700" />}
                  <span>{syncing ? "Syncing..." : "Re-Sync All"}</span>
                </button>
              </div>
            </div>

            {/* 3. Search & Filter Bar */}
            <div className="rounded-2xl bg-white border-2 border-slate-200 p-4 shadow-xs grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_200px_180px_180px]">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 text-slate-500" size={17} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search knowledge title, policy, or keywords..."
                  className="w-full h-10 rounded-xl border-2 border-slate-200 bg-white pl-10 pr-4 text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-xs sm:text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-600"
              >
                <option value="">All Categories</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-xs sm:text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-600"
              >
                <option value="">All Sources</option>
                <option value="document_upload">Document Upload / OCR</option>
                <option value="manual">Manual Input</option>
                <option value="announcement">Announcements</option>
                <option value="livelihood">Livelihood & Jobs</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-xs sm:text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-600"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active (Published)</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            {/* 4. Knowledge Cards Grid */}
            <div className="space-y-4">
              {loading ? (
                <div className="p-16 text-center text-slate-600 font-bold bg-white rounded-3xl border-2 border-slate-200 shadow-sm">
                  <Loader className="mx-auto mb-3 animate-spin text-emerald-700" size={30} />
                  <p className="text-sm">Loading AI Knowledge items...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="p-16 text-center text-slate-600 font-bold bg-white rounded-3xl border-2 border-slate-200 shadow-sm space-y-3">
                  <BrainCircuit size={44} className="mx-auto text-emerald-600" />
                  <h4 className="text-base font-black text-slate-900">No Knowledge Records Found</h4>
                  <p className="text-xs text-slate-600 max-w-md mx-auto font-medium">
                    Upload documents to extract policies or create records manually to train the KaagapAI resident chatbot.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadFile(null);
                        setShowUploadModal(true);
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 text-white font-black text-xs hover:bg-purple-800 cursor-pointer shadow-sm"
                    >
                      <FileUp size={15} /> Upload & Train Document
                    </button>
                    <button
                      type="button"
                      onClick={openCreate}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white font-black text-xs hover:bg-emerald-800 cursor-pointer shadow-sm"
                    >
                      <Plus size={15} /> Create First Knowledge Record
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => {
                    const meta = sourceMeta[item.source_type] || sourceMeta.manual;
                    const SourceIcon = meta.icon;
                    const isPublished = item.status === "Active";

                    return (
                      <article
                        key={item.id}
                        className="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs hover:shadow-md hover:border-emerald-500 transition-all flex flex-col group relative overflow-hidden"
                      >
                        {/* Top Chips */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black border ${meta.color}`}>
                            <SourceIcon size={13} />
                            {meta.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-1 text-[11px] font-black text-emerald-950">
                              {item.category}
                            </span>
                            <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-black text-blue-800">
                              v{item.version || "1.0"}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${statusClass(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-black text-slate-900 line-clamp-2 mb-2 group-hover:text-emerald-900 transition-colors leading-snug">
                          {item.title}
                        </h3>

                        {/* Content Preview */}
                        <p className="text-xs text-slate-700 font-medium line-clamp-3 leading-relaxed mb-4 flex-1 whitespace-pre-line">
                          {item.content}
                        </p>

                        {/* Metadata Footer */}
                        <div className="pt-3 border-t border-slate-200 text-[11px] font-medium text-slate-600 space-y-1.5 mb-4">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold">Audience:</span>
                            <span className="font-black text-slate-800">{item.audience || "All Residents"}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold">Effective Date:</span>
                            <span className="font-black text-slate-800">{formatDate(item.effective_date)}</span>
                          </div>
                        </div>

                        {/* Action Buttons: View, Edit, Publish/Unpublish, Version History & Rollback, Delete */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 mt-auto">
                          {/* View */}
                          <button
                            type="button"
                            onClick={() => openView(item)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-xs font-black transition cursor-pointer"
                            title="View Full Knowledge Record"
                          >
                            <Eye size={14} />
                            <span>View</span>
                          </button>

                          {/* Publish / Unpublish Toggle */}
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(item)}
                            className={`inline-flex items-center justify-center gap-1 h-9 px-2.5 rounded-xl border-2 text-xs font-black transition cursor-pointer ${
                              isPublished
                                ? "border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
                                : "border-emerald-300 bg-emerald-600 hover:bg-emerald-700 text-white"
                            }`}
                            title={isPublished ? "Unpublish to Draft/Archive" : "Publish to Chatbot"}
                          >
                            {isPublished ? <X size={13} /> : <Check size={13} />}
                            <span className="hidden sm:inline">{isPublished ? "Pause" : "Publish"}</span>
                          </button>

                          {/* Rollback & Version History */}
                          <button
                            type="button"
                            onClick={() => openRollbackModal(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 transition cursor-pointer"
                            title="Version History & Rollback"
                          >
                            <History size={14} />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 transition cursor-pointer"
                            title="Edit Record"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-900 transition cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            PILLAR 2: AI SETTINGS (System Prompt, AI Behavior, Safety Rules)
        ══════════════════════════════════════════════════════════════ */}
        {activePillar === "settings" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border-2 border-slate-200">
              <div>
                <h3 className="text-base font-black text-slate-900">AI Intelligence & Assistant Configuration</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Configure KaagapAI&apos;s system prompt, reasoning model, temperature, and strict safety guidelines.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetSettings}
                  disabled={savingSettings || loadingSettings}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition"
                >
                  Restore Defaults
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={savingSettings || loadingSettings}
                  className="px-5 py-2.5 rounded-xl bg-[#00552E] hover:bg-[#004224] text-white font-black text-xs shadow-md transition transform active:scale-95 cursor-pointer disabled:opacity-60 flex items-center gap-2"
                >
                  {savingSettings ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  <span>{savingSettings ? "Saving Settings..." : "Save AI Settings"}</span>
                </button>
              </div>
            </div>

            {loadingSettings ? (
              <div className="p-16 text-center text-slate-600 font-bold bg-white rounded-3xl border-2 border-slate-200 shadow-sm">
                <Loader className="mx-auto mb-3 animate-spin text-emerald-700" size={30} />
                <p className="text-sm">Loading AI settings...</p>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-3">
                {/* ── Pillar 2.1: System Prompt ── */}
                <div className="lg:col-span-2 space-y-6">
                  <section className="rounded-3xl border-2 border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Brain size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">1. System Prompt</h4>
                          <p className="text-xs text-slate-500 font-medium">Foundational persona and operational instructions</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-black text-[10px] uppercase">
                        Master Prompt
                      </span>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Master Persona & Barangay Identity
                      </label>
                      <textarea
                        rows={7}
                        value={aiSettings.systemPrompt}
                        onChange={(e) => setAiSettings({ ...aiSettings, systemPrompt: e.target.value })}
                        placeholder="Enter the primary system instructions..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-mono leading-relaxed outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
                      />
                      <p className="text-[11px] text-slate-400">
                        Defines who KaagapAI is, its respectful demeanor, and its dedication to Barangay Upper Mingading.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Custom Directives / Special Instructions (Override)
                      </label>
                      <textarea
                        rows={4}
                        value={aiSettings.customInstructions}
                        onChange={(e) => setAiSettings({ ...aiSettings, customInstructions: e.target.value })}
                        placeholder="e.g. Always remind residents that barangay office closes at 12:00 PM for lunch; highlight that Cedula is free for students."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-mono leading-relaxed outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
                      />
                      <p className="text-[11px] text-slate-400">
                        Injected directly into every prompt as high-priority admin instructions.
                      </p>
                    </div>
                  </section>

                  {/* ── Pillar 2.2: Safety Rules ── */}
                  <section className="rounded-3xl border-2 border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-800 border border-rose-200">
                          <ShieldAlert size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">3. Safety Rules & Ethics</h4>
                          <p className="text-xs text-slate-500 font-medium">Protect resident privacy and prevent hallucinations</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 font-black text-[10px] uppercase">
                        Active Guardrails
                      </span>
                    </div>

                    {/* Toggle: Profanity */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-slate-900">Profanity & Abuse Interception</p>
                        <p className="text-[11px] text-slate-500">
                          Politely warns residents: &quot;Maging magalang po sa ating pakikipag-usap...&quot;
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={aiSettings.profanityFilterEnabled}
                        onChange={(e) => setAiSettings({ ...aiSettings, profanityFilterEnabled: e.target.checked })}
                        className="h-5 w-5 rounded text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Toggle: Anti-Hallucination */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-slate-900">Strict Anti-Hallucination Mode</p>
                        <p className="text-[11px] text-slate-500">
                          AI must only use verified Admin Knowledge & live database fees. Never invents requirements.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={aiSettings.antiHallucinationEnabled}
                        onChange={(e) => setAiSettings({ ...aiSettings, antiHallucinationEnabled: e.target.checked })}
                        className="h-5 w-5 rounded text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Toggle: Data Privacy */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-slate-900">Data Privacy Protection (RA 10173)</p>
                        <p className="text-[11px] text-slate-500">
                          Strictly prohibits revealing passwords, system hashes, or third-party resident records.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={aiSettings.dataPrivacyEnabled}
                        onChange={(e) => setAiSettings({ ...aiSettings, dataPrivacyEnabled: e.target.checked })}
                        className="h-5 w-5 rounded text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Custom Banned Words */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Custom Prohibited Keywords / Topics
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={bannedWordInput}
                          onChange={(e) => setBannedWordInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddBannedWord();
                            }
                          }}
                          placeholder="Type restricted term and press Add..."
                          className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold outline-none focus:border-emerald-600 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleAddBannedWord}
                          className="px-4 h-10 rounded-xl bg-slate-800 text-white font-black text-xs hover:bg-slate-900 cursor-pointer"
                        >
                          Add Term
                        </button>
                      </div>
                      {aiSettings.customBannedWords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {aiSettings.customBannedWords.map((word) => (
                            <span
                              key={word}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold"
                            >
                              <span>{word}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveBannedWord(word)}
                                className="text-rose-500 hover:text-rose-700 font-black cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* ── Pillar 2.3: AI Behavior ── */}
                <div className="space-y-6">
                  <section className="rounded-3xl border-2 border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
                        <SlidersHorizontal size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">2. AI Behavior</h4>
                        <p className="text-xs text-slate-500 font-medium">Model parameters & tuning</p>
                      </div>
                    </div>

                    {/* Model Provider & Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        LLM Model & Provider
                      </label>
                      <select
                        value={aiSettings.modelName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAiSettings({
                            ...aiSettings,
                            modelName: val,
                            modelProvider: val.includes("gemini") ? "gemini" : "groq",
                          });
                        }}
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white"
                      >
                        <option value="qwen/qwen3.8-27b">Groq - Qwen 2.5 72B (Ultra Fast & Smart)</option>
                        <option value="openai/gpt-oss-120b">Groq - Llama 3.3 70B (High Reasoning)</option>
                        <option value="gemini-2.0-flash">Google - Gemini 2.0 Flash</option>
                      </select>
                      <p className="text-[11px] text-slate-400">
                        Groq Qwen delivers instant ~200ms responses with advanced Tagalog and Bisaya comprehension.
                      </p>
                    </div>

                    {/* Temperature Slider */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                          Temperature ({aiSettings.temperature})
                        </label>
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {aiSettings.temperature <= 0.2 ? "Strictly Factual" : aiSettings.temperature <= 0.5 ? "Balanced" : "Creative"}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={aiSettings.temperature}
                        onChange={(e) => setAiSettings({ ...aiSettings, temperature: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-700 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                        <span>0.0 (Factual)</span>
                        <span>0.5 (Balanced)</span>
                        <span>1.0 (Creative)</span>
                      </div>
                    </div>

                    {/* Tone Selector */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Response Tone & Language
                      </label>
                      <select
                        value={aiSettings.tone}
                        onChange={(e) => setAiSettings({ ...aiSettings, tone: e.target.value })}
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white"
                      >
                        <option value="Taglish / Professional">Taglish / Professional (Recommended)</option>
                        <option value="Strictly Formal">Strictly Formal & Official</option>
                        <option value="Friendly Community">Friendly Community / Warm</option>
                        <option value="Bisaya / Taglish Friendly">Bisaya / Taglish Capable</option>
                      </select>
                    </div>

                    {/* Max Tokens */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Max Output Tokens
                      </label>
                      <select
                        value={aiSettings.maxTokens}
                        onChange={(e) => setAiSettings({ ...aiSettings, maxTokens: parseInt(e.target.value, 10) })}
                        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white"
                      >
                        <option value="1024">1,024 Tokens (Concise)</option>
                        <option value="2048">2,048 Tokens (Recommended Standard)</option>
                        <option value="4096">4,096 Tokens (In-depth Detailed)</option>
                      </select>
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            PILLAR 3: AI LOGS (Questions, Answers, Failed Queries, Unanswered Questions)
        ══════════════════════════════════════════════════════════════ */}
        {activePillar === "logs" && (
          <div className="space-y-6 animate-fadeIn">
            {/* 1. Metric Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                onClick={() => setLogFilter("all")}
                className={`rounded-2xl border p-4 shadow-xs flex items-center gap-3.5 cursor-pointer transition ${
                  logFilter === "all" ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">All Questions</p>
                  <p className="text-xl font-black text-slate-900">{logStats.total} inquiries</p>
                </div>
              </div>

              <div
                onClick={() => setLogFilter("answered")}
                className={`rounded-2xl border p-4 shadow-xs flex items-center gap-3.5 cursor-pointer transition ${
                  logFilter === "answered" ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Answers (Success)</p>
                  <p className="text-xl font-black text-emerald-800">{logStats.answered} answered</p>
                </div>
              </div>

              <div
                onClick={() => setLogFilter("failed")}
                className={`rounded-2xl border p-4 shadow-xs flex items-center gap-3.5 cursor-pointer transition ${
                  logFilter === "failed" ? "border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Failed Queries</p>
                  <p className="text-xl font-black text-rose-800">{logStats.failed} errors</p>
                </div>
              </div>

              <div
                onClick={() => setLogFilter("unanswered")}
                className={`rounded-2xl border p-4 shadow-xs flex items-center gap-3.5 cursor-pointer transition ${
                  logFilter === "unanswered" ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <HelpCircleIcon size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unanswered Questions</p>
                  <p className="text-xl font-black text-amber-800">{logStats.unanswered} gaps</p>
                </div>
              </div>
            </div>

            {/* 2. Sub-filters & Search Bar */}
            <div className="rounded-2xl bg-white border-2 border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setLogFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    logFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All Questions ({logStats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter("answered")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    logFilter === "answered" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  Answers ({logStats.answered})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter("failed")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    logFilter === "failed" ? "bg-rose-700 text-white" : "bg-rose-50 text-rose-800 hover:bg-rose-100"
                  }`}
                >
                  Failed Queries ({logStats.failed})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilter("unanswered")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    logFilter === "unanswered" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-900 hover:bg-amber-100"
                  }`}
                >
                  Unanswered Questions ({logStats.unanswered})
                </button>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <input
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search query or answer..."
                    className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-bold outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={loadLogs}
                  disabled={loadingLogs}
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  title="Refresh logs"
                >
                  <RefreshCw size={13} className={loadingLogs ? "animate-spin" : ""} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearLogs}
                  disabled={logs.length === 0}
                  className="h-9 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Clear all logs"
                >
                  <Trash2 size={13} />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>

            {/* 3. Log Items List */}
            <div className="space-y-3">
              {loadingLogs ? (
                <div className="p-16 text-center text-slate-600 font-bold bg-white rounded-3xl border-2 border-slate-200 shadow-sm">
                  <Loader className="mx-auto mb-3 animate-spin text-emerald-700" size={30} />
                  <p className="text-sm">Loading AI logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="p-16 text-center text-slate-600 font-bold bg-white rounded-3xl border-2 border-slate-200 shadow-sm space-y-2">
                  <MessageSquare size={36} className="mx-auto text-slate-300" />
                  <h4 className="text-base font-black text-slate-900">No Logs Found</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Resident inquiries and test interactions with KaagapAI will be recorded here in real-time.
                  </p>
                </div>
              ) : (
                logs.map((log) => {
                  const isUnans = log.status === "unanswered" || log.is_unanswered;
                  const isFail = log.status === "failed";

                  return (
                    <article
                      key={log.id}
                      className={`rounded-2xl border-2 bg-white p-4 shadow-xs transition hover:shadow-md ${
                        isFail
                          ? "border-rose-200 hover:border-rose-400"
                          : isUnans
                          ? "border-amber-200 hover:border-amber-400 bg-amber-50/20"
                          : "border-slate-200 hover:border-emerald-400"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        {/* Resident & Timestamp */}
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-black text-[11px]">
                            <User size={13} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 leading-tight">
                              {log.resident_name || "Resident"}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {formatDate(log.created_at)} at {formatTime(log.created_at)} • Source: {log.source || "Portal"}
                            </p>
                          </div>
                        </div>

                        {/* Status Chip & Delete */}
                        <div className="flex items-center gap-1.5">
                          {isFail ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-black uppercase">
                              Failed Query
                            </span>
                          ) : isUnans ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black uppercase flex items-center gap-1">
                              <AlertCircle size={11} />
                              Unanswered / Knowledge Gap
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase">
                              Answered
                            </span>
                          )}

                          {log.duration_ms > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono">
                              {log.duration_ms}ms
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                            title="Delete log"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Question */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                          Question Asked:
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-900">
                          {log.question}
                        </p>
                      </div>

                      {/* Answer */}
                      <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block mb-0.5">
                          KaagapAI Response:
                        </span>
                        <p>{log.answer || "(No response recorded)"}</p>
                      </div>

                      {/* SPECIAL ACTION: Add to Knowledge Base if Unanswered */}
                      {isUnans && (
                        <div className="mt-3 pt-2.5 border-t border-amber-200/70 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-amber-900">
                            💡 KaagapAI lacked sufficient policy details for this query. Train the chatbot on this topic now!
                          </p>
                          <button
                            type="button"
                            onClick={() => handleTrainFromUnansweredQuestion(log)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-xs cursor-pointer transition transform active:scale-95"
                          >
                            <Plus size={13} />
                            <span>Add to Knowledge Base</span>
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════
          MODAL 1: NEW / EDIT KNOWLEDGE RECORD (With Version Tag)
      ══════════════════════════════════════════════════════════════ */}
      <FloatingModal
        open={showModal}
        onClose={closeModal}
        title={editingItem ? "Edit Barangay Knowledge Record" : "Add Barangay Knowledge to Chatbot"}
        subtitle="Enter barangay policies, guidelines, and ordinances with semantic versioning"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Knowledge Title <span className="text-rose-500">*</span>
              </label>
              <input
                name="title"
                value={formData.title}
                onChange={handleInput}
                placeholder="e.g. Barangay Ordinance No. 2026-02: Solid Waste Management Guidelines"
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs sm:text-sm font-semibold outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInput}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-semibold outline-none focus:border-emerald-600 focus:bg-white"
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Target Audience</label>
              <select
                name="audience"
                value={formData.audience}
                onChange={handleInput}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-semibold outline-none focus:border-emerald-600 focus:bg-white"
              >
                {audienceOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Status (Publish)</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInput}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-semibold outline-none focus:border-emerald-600 focus:bg-white"
              >
                <option value="Active">Active (Published to Chatbot)</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived / Paused</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Knowledge Version
              </label>
              <input
                name="version"
                value={formData.version || "1.0"}
                onChange={handleInput}
                placeholder="e.g. 1.0, 1.1, 2.0"
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-semibold outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Effective Date</label>
              <input
                type="date"
                name="effective_date"
                value={formData.effective_date}
                onChange={handleInput}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-semibold outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Knowledge Content / Policies / Rules <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">
                  {formData.content.length} characters
                </span>
              </div>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleInput}
                rows={9}
                placeholder="Enter detailed facts, policies, steps, or rules. The resident chatbot directly reads this content when formulating answers."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs sm:text-sm font-mono outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 leading-relaxed"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs shadow-md transition transform active:scale-95 cursor-pointer disabled:opacity-60 flex items-center gap-2"
            >
              {saving ? <Loader size={15} className="animate-spin" /> : <Bot size={15} />}
              <span>{saving ? "Saving & Training..." : "Save & Train Chatbot"}</span>
            </button>
          </div>
        </div>
      </FloatingModal>

      {/* ═══════════════════════════════════════════════════════════
          MODAL 2: VERSION HISTORY & ROLLBACK MODAL
      ══════════════════════════════════════════════════════════════ */}
      <FloatingModal
        open={showRollbackModal}
        onClose={() => setShowRollbackModal(false)}
        title={rollbackItem ? `Version History: ${rollbackItem.title}` : "Version History"}
        subtitle="View previous versions of this policy and rollback instantly"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="font-bold text-slate-500">Active Version:</span>{" "}
              <span className="font-black text-slate-900">v{rollbackItem?.version || "1.0"}</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px]">
              Live in Chatbot
            </span>
          </div>

          {loadingHistory ? (
            <div className="p-8 text-center text-slate-500 font-bold">
              <Loader className="mx-auto mb-2 animate-spin text-emerald-700" size={24} />
              <p className="text-xs">Fetching version history snapshots...</p>
            </div>
          ) : versionHistory.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
              <History size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">No previous version snapshots recorded yet.</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Version snapshots are automatically created whenever an admin edits and saves changes to a knowledge record.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {versionHistory.map((snap) => (
                <div
                  key={snap.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2 hover:border-purple-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-900 font-black text-xs">
                        v{snap.version}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {formatDate(snap.created_at)} at {formatTime(snap.created_at)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExecuteRollback(snap)}
                      disabled={rollingBack}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs shadow-xs cursor-pointer transition transform active:scale-95 disabled:opacity-50"
                    >
                      <RotateCcw size={12} />
                      <span>Rollback to this Version</span>
                    </button>
                  </div>

                  <p className="text-xs font-bold text-slate-600">
                    Note: <span className="font-normal">{snap.change_summary || "Version update"}</span>
                  </p>

                  <p className="text-[11px] text-slate-500 font-mono bg-slate-50 p-2.5 rounded-xl line-clamp-3 leading-relaxed border border-slate-100">
                    {snap.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => setShowRollbackModal(false)}
              className="px-5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </FloatingModal>

      {/* ═══════════════════════════════════════════════════════════
          MODAL 3: VIEW KNOWLEDGE RECORD
      ══════════════════════════════════════════════════════════════ */}
      <FloatingModal
        open={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={viewingItem?.title || "Knowledge Record"}
        subtitle={`Category: ${viewingItem?.category} • Version: v${viewingItem?.version || "1.0"}`}
        maxWidth="max-w-3xl"
      >
        {viewingItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <p className="text-slate-400 font-bold">Status</p>
                <p className="font-black text-slate-800">{viewingItem.status}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold">Version</p>
                <p className="font-black text-blue-700">v{viewingItem.version || "1.0"}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold">Audience</p>
                <p className="font-black text-slate-800">{viewingItem.audience || "All"}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold">Effective Date</p>
                <p className="font-black text-slate-800">{formatDate(viewingItem.effective_date)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Full Policy & Procedure Content:
              </span>
              <p className="text-xs sm:text-sm font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                {viewingItem.content}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowViewModal(false);
                  openRollbackModal(viewingItem);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-purple-200 bg-purple-50 text-purple-900 font-bold text-xs hover:bg-purple-100 cursor-pointer"
              >
                <History size={14} />
                <span>View Version History</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowViewModal(false);
                    openEdit(viewingItem);
                  }}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 cursor-pointer"
                >
                  Edit Record
                </button>
                <button
                  type="button"
                  onClick={() => setShowViewModal(false)}
                  className="px-5 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </FloatingModal>

      {/* ═══════════════════════════════════════════════════════════
          MODAL 4: DOCUMENT UPLOAD & AI INGESTION
      ══════════════════════════════════════════════════════════════ */}
      <FloatingModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Document & AI Train Chatbot"
        subtitle="Ingest PDF, Word, or image policies with automatic text extraction and vector chunking"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="hidden"
          />

          {!uploadFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-purple-300 hover:border-purple-500 rounded-3xl p-8 text-center bg-purple-50/40 hover:bg-purple-50/80 transition cursor-pointer space-y-2"
            >
              <FileUp size={40} className="mx-auto text-purple-600" />
              <p className="text-sm font-black text-slate-900">
                Click to browse or drag &amp; drop document here
              </p>
              <p className="text-xs text-slate-500">
                Supports PDF, Word (.docx), Text (.txt), and Images (.png, .jpg)
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="text-purple-700" size={20} />
                <div>
                  <p className="text-xs font-black text-slate-900">{uploadFile.name}</p>
                  <p className="text-[10px] text-slate-500">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUploadFile(null);
                  setUploadFormData({ ...uploadFormData, title: "", content: "" });
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
              >
                Change
              </button>
            </div>
          )}

          {parsingFile && (
            <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200 text-center font-bold text-xs text-purple-900 flex items-center justify-center gap-2 animate-pulse">
              <Loader size={16} className="animate-spin text-purple-700" />
              <span>Analyzing and extracting knowledge with AI...</span>
            </div>
          )}

          {uploadFormData.content && (
            <div className="space-y-3 pt-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-black text-slate-700 uppercase">Knowledge Title</label>
                  <input
                    value={uploadFormData.title}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-purple-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 uppercase">Category</label>
                  <select
                    value={uploadFormData.category}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, category: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-purple-600"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 uppercase">Target Audience</label>
                  <select
                    value={uploadFormData.audience}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, audience: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-purple-600"
                  >
                    {audienceOptions.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 uppercase">Extracted Knowledge Content</label>
                <textarea
                  rows={6}
                  value={uploadFormData.content}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, content: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs font-mono outline-none focus:border-purple-600 leading-relaxed"
                />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveUploadedDocument}
              disabled={savingUpload || parsingFile || !uploadFormData.content?.trim()}
              className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs shadow-md transition transform active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {savingUpload ? <Loader size={14} className="animate-spin" /> : <Bot size={14} />}
              <span>{savingUpload ? "Training..." : "Save & Train Chatbot"}</span>
            </button>
          </div>
        </div>
      </FloatingModal>

      {/* ═══════════════════════════════════════════════════════════
          MODAL 5: TEST CHATBOT SIMULATOR PLAYGROUND
      ══════════════════════════════════════════════════════════════ */}
      <FloatingModal
        open={showSimulator}
        onClose={() => setShowSimulator(false)}
        title="KaagapAI Chatbot Training Simulator"
        subtitle="Test live answers generated directly from your uploaded documents and AI knowledge"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5">
            {simHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "bot" && (
                  <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Bot size={16} />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-emerald-700 text-white rounded-tr-none font-semibold shadow-xs"
                      : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none shadow-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.matchedSource && msg.role === "bot" && (
                    <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <Zap size={11} className="text-[#FFD700]" />
                      <span>RAG Source: {msg.matchedSource}</span>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <User size={16} />
                  </div>
                )}
              </div>
            ))}
            {simLoading && (
              <div className="flex gap-3 justify-start items-center text-xs text-slate-500 font-bold pl-2 animate-pulse">
                <Bot size={16} className="text-emerald-600 animate-spin" />
                <span>KaagapAI is retrieving knowledge & formulating answer...</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">Sample Prompts:</span>
            {[
              "Anong oras ang curfew sa barangay?",
              "Ano ang requirements sa Certificate of Indigency?",
              "Saan ang evacuation center kapag may bagyo?",
              "May ayuda ba para sa senior citizen?",
            ].map((promptText, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => setSimQuestion(promptText)}
                className="shrink-0 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 transition cursor-pointer"
              >
                {promptText}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => handleTestChatbot(e)} className="flex gap-2">
            <input
              value={simQuestion}
              onChange={(e) => setSimQuestion(e.target.value)}
              placeholder="Ask the chatbot anything about your uploaded barangay knowledge..."
              className="flex-1 h-12 rounded-xl border border-slate-200 bg-white px-4 text-xs sm:text-sm font-medium outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 shadow-xs"
            />
            <button
              type="submit"
              disabled={simLoading || !simQuestion.trim()}
              className="px-5 h-12 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <Send size={15} />
              <span>Ask</span>
            </button>
          </form>
        </div>
      </FloatingModal>
    </div>
  );
};

// Simple HelpCircle fallback icon
const HelpCircleIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export default AIKnowledge;
