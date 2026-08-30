import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Bot,
  Brain,
  BrainCircuit,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  Download,
  Edit2,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FileUp,
  GraduationCap,
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
  Search,
  Send,
  Shield,
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
import { generateText } from "../services/geminiService";
import { showAdminSystemToast } from "../utils/toast";

const initialForm = {
  title: "",
  content: "",
  category: "General",
  audience: "All Residents",
  status: "Active",
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
  document_upload: { label: "Doc Upload / OCR", icon: FileUp, color: "bg-purple-50 text-purple-700 border-purple-200" },
  announcement: { label: "Announcement", icon: Megaphone, color: "bg-rose-50 text-rose-700 border-rose-200" },
  livelihood: { label: "Livelihood & Jobs", icon: Briefcase, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const formatDate = (dateValue) => {
  if (!dateValue) return "-";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const AIKnowledge = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, _setMessage] = useState(null);
  const setMessage = useCallback((msg) => {
    if (msg) {
      if (typeof msg === "string") {
        showAdminSystemToast(msg, "success");
      } else if (msg.text) {
        showAdminSystemToast(msg.text, msg.type || "success", msg.title);
      }
    }
  }, []);
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

  // File Ingestion & AI Processing State
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const fileInputRef = useRef(null);

  // Interactive Chatbot Testing Simulator
  const [showSimulator, setShowSimulator] = useState(false);
  const [simQuestion, setSimQuestion] = useState("");
  const [simLoading, setSimLoading] = useState(false);
  const [simHistory, setSimHistory] = useState([
    {
      role: "bot",
      text: "Magandang araw! Ako si KaagapAI. Subukan mo akong tanungin tungkol sa mga ordinansa, requirements, curfew, o mga bagong upload na dokumento sa ating barangay knowledge base.",
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
        sourceType: sourceFilter,
      });
      setItems(data || []);
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to load resident knowledge." });
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, search, sourceFilter, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(loadKnowledge, 150);
    return () => window.clearTimeout(timer);
  }, [loadKnowledge]);

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((item) => item.status === "Active").length,
      synced: items.filter((item) => item.source_type !== "manual" && item.source_type !== "document_upload").length,
      uploaded: items.filter((item) => item.source_type === "document_upload" || item.source_type === "manual").length,
    }),
    [items]
  );

  const openCreate = () => {
    setEditingItem(null);
    setFormData(initialForm);
    setUploadedFileInfo(null);
    setAiSuggestions(null);
    setMessage(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title || "",
      content: item.content || "",
      category: item.category || "General",
      audience: item.audience || "All Residents",
      status: item.status || "Active",
      effective_date: item.effective_date || "",
      expires_at: item.expires_at || "",
    });
    setUploadedFileInfo(null);
    setAiSuggestions(null);
    setMessage(null);
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
    setUploadedFileInfo(null);
    setAiSuggestions(null);
  };

  const handleInput = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  // Upload & Ingest File (Word, PDF, TXT, MD, Image)
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setMessage(null);

    try {
      // 1. Extract raw text / base64 from file
      const parsed = await parseFileToKnowledgeText(file);
      setUploadedFileInfo({
        name: parsed.fileName || file.name,
        sizeKb: parsed.sizeKb || Math.round(file.size / 1024),
        type: file.type || "Document",
      });

      // 2. Pass to Gemini AI Auto-Structure Engine
      const aiResult = await analyzeAndStructureKnowledgeWithAi(parsed);
      setAiSuggestions(aiResult);

      // 3. Populate form with structured data
      setFormData((prev) => ({
        ...prev,
        title: aiResult.title || parsed.title || prev.title,
        category: aiResult.category || prev.category,
        audience: aiResult.audience || prev.audience,
        content: aiResult.content || parsed.text || prev.content,
      }));

      setMessage({
        type: "success",
        text: `✨ Successfully analyzed "${file.name}" with AI! Knowledge structured & ready to save into Chatbot.`,
      });
    } catch (err) {
      console.error("File ingestion error:", err);
      setMessage({
        type: "error",
        text: `File processing notice: ${err.message || "Failed to process document."}`,
      });
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!formData.title?.trim()) {
      setMessage({ type: "error", text: "Knowledge title is required." });
      return;
    }
    if (!formData.content?.trim()) {
      setMessage({ type: "error", text: "Knowledge content is required." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const sourceType = uploadedFileInfo ? "document_upload" : editingItem?.source_type || "manual";

      if (editingItem) {
        await updateKnowledgeItem(editingItem.id, {
          ...formData,
          source_type: sourceType,
          source_id: editingItem.source_id || null,
        });
        setMessage({ type: "success", text: "Barangay knowledge updated & synced to chatbot." });
      } else {
        await createKnowledgeItem({
          ...formData,
          source_type: sourceType,
        });
        setMessage({
          type: "success",
          text: `🎉 New Knowledge "${formData.title}" saved! Resident Chatbot is now trained on this data.`,
        });
      }

      closeModal();
      await loadKnowledge();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to save knowledge record." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.title}" from AI knowledge base?`)) return;

    try {
      await deleteKnowledgeItem(item.id);
      setMessage({ type: "success", text: "Knowledge item deleted." });
      await loadKnowledge();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to delete knowledge item." });
    }
  };

  const syncPublishedContent = async () => {
    setSyncing(true);
    setMessage(null);

    try {
      const [announcements, livelihoodPosts] = await Promise.all([
        fetchAnnouncements({ limit: 200 }).catch(() => []),
        fetchLivelihoodPosts({ limit: 200 }).catch(() => []),
      ]);

      const syncResults = await Promise.allSettled([
        ...announcements.map(syncKnowledgeFromAnnouncement),
        ...livelihoodPosts.map(syncKnowledgeFromLivelihood),
      ]);

      const failed = syncResults.filter((result) => result.status === "rejected");
      const synced = syncResults.length - failed.length;

      setMessage({
        type: failed.length ? "error" : "success",
        text: failed.length
          ? `${synced} item(s) synced, ${failed.length} failed. ${failed[0].reason?.message || ""}`.trim()
          : `⚡ Complete Sync: ${synced} announcement & livelihood record(s) indexed into AI Chatbot knowledge base.`,
      });
      await loadKnowledge();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to sync resident knowledge." });
    } finally {
      setSyncing(false);
    }
  };

  // Test Chatbot Playground
  const handleTestChatbot = async (e) => {
    e.preventDefault();
    const q = simQuestion.trim();
    if (!q) return;

    setSimHistory((prev) => [...prev, { role: "user", text: q }]);
    setSimQuestion("");
    setSimLoading(true);

    try {
      // Find top relevant knowledge items from loaded items
      const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const scoredItems = items.map((it) => {
        let score = 0;
        const text = `${it.title} ${it.content} ${it.category}`.toLowerCase();
        words.forEach((w) => {
          if (text.includes(w)) score += 2;
        });
        return { item: it, score };
      });
      scoredItems.sort((a, b) => b.score - a.score);
      const topMatches = scoredItems.filter((s) => s.score > 0).slice(0, 3).map((s) => s.item);

      const knowledgeContext = topMatches.length > 0
        ? topMatches.map((m, idx) => `[Source ${idx + 1}: ${m.title} (${m.category})]\n${m.content}`).join("\n\n")
        : "No direct knowledge match found. Use standard polite barangay assistant knowledge.";

      const prompt = `You are KaagapAI, the official Virtual Assistant of Barangay Upper Mingading, Aleosan, Cotabato.
Answer the following resident inquiry accurately based on the provided Barangay Knowledge Context.
If the information is in the knowledge context, cite facts clearly in conversational Tagalog/English.

BARANGAY KNOWLEDGE CONTEXT:
${knowledgeContext}

RESIDENT QUESTION:
"${q}"`;

      const res = await generateText(prompt, {
        temperature: 0.3,
        maxOutputTokens: 1024,
      });

      const replyText =
        res?.candidates?.[0]?.content?.parts?.[0]?.text ||
        res?.text ||
        "Pasensya na po, hindi ko nahanap ang impormasyon sa ating barangay knowledge base. Maaari ninyong bisitahin ang Barangay Hall.";

      const matchedSource = topMatches.length > 0
        ? topMatches.map((m) => m.title).join(", ")
        : "General AI Knowledge";

      setSimHistory((prev) => [
        ...prev,
        { role: "bot", text: replyText, matchedSource },
      ]);
    } catch (err) {
      setSimHistory((prev) => [
        ...prev,
        {
          role: "bot",
          text: `⚠️ Chatbot query error: ${err.message || "Failed to generate answer."}`,
          matchedSource: "Error",
        },
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FDF4]/30 pb-20">
      <Header
        title="AI Knowledge & Chatbot Trainer"
        subtitle="Upload documents, files, and policies to automatically train the KaagapAI Resident Chatbot"
      />

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* CLEAN TOP ACTION BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-[#023B28] via-[#035237] to-[#023B28] p-4 sm:p-5 text-white shadow-xl">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/20 text-amber-300 shadow-inner">
              <Sparkles size={22} className="text-amber-300 drop-shadow-sm" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight drop-shadow-xs">
                Barangay Knowledge Base
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 font-semibold drop-shadow-2xs">
                Manage policies, FAQs, and guidelines for the KaagapAI resident chatbot
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Add New Knowledge Manually */}
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-[#00552E] font-black text-xs sm:text-sm shadow-md border border-emerald-200 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Plus size={16} className="stroke-[3] text-[#00552E]" />
              <span>New Knowledge</span>
            </button>

            {/* Re-Sync All Content */}
            <button
              type="button"
              onClick={syncPublishedContent}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#004D2A] hover:bg-[#006034] text-white font-black text-xs sm:text-sm shadow-md border border-emerald-400/60 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-60"
              title="Re-sync all announcements and livelihood items"
            >
              {syncing ? <Loader size={16} className="animate-spin text-emerald-200" /> : <RefreshCw size={16} className="stroke-[2.5] text-emerald-200" />}
              <span className="text-white font-black">{syncing ? "Syncing..." : "Re-Sync All"}</span>
            </button>

            {/* Test Chatbot Playground Button */}
            <button
              type="button"
              onClick={() => setShowSimulator(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFB800] hover:bg-[#F59E0B] text-slate-950 font-black text-xs sm:text-sm shadow-md border border-amber-400 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              title="Open Interactive Chatbot Simulator to test live responses"
            >
              <Bot size={16} className="stroke-[2.5] text-slate-950" />
              <span>Test Chatbot</span>
            </button>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
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
            <option value="Active">Active</option>
            <option value="Draft">Draft</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        {/* KNOWLEDGE RECORDS GRID */}
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
                Click &quot;Upload &amp; Ingest File&quot; to upload your documents, or apply one of the quick starter templates to train the chatbot.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white font-black text-xs hover:bg-emerald-800 cursor-pointer shadow-sm"
              >
                <Upload size={15} /> Upload First File
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const meta = sourceMeta[item.source_type] || sourceMeta.manual;
                const SourceIcon = meta.icon;

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
                        <span className="text-slate-500 font-bold">Effective:</span>
                        <span className="font-black text-slate-800">{formatDate(item.effective_date)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200 mt-auto">
                      <button
                        type="button"
                        onClick={() => openView(item)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-xs font-black transition cursor-pointer"
                        title="View Full Knowledge Record"
                      >
                        <Eye size={14} />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 transition cursor-pointer"
                        title="Edit Record"
                      >
                        <Edit2 size={14} />
                      </button>
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
      </main>

      {/* NEW / EDIT KNOWLEDGE MODAL */}
      <FloatingModal
        open={showModal}
        onClose={closeModal}
        title={editingItem ? "Edit AI Knowledge Record" : "Add AI Knowledge to Chatbot"}
        subtitle="Ingest documents or enter guidelines to train the resident virtual assistant"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5">
          {/* Upload File Inside Modal */}
          <div className="p-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-xs">
                <FileUp size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-800">
                  {uploadedFileInfo ? `Uploaded: ${uploadedFileInfo.name} (${uploadedFileInfo.sizeKb} KB)` : "Upload Document / Word / PDF / Image"}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isProcessingFile ? "AI is reading and structuring the document..." : "AI will automatically extract titles, categories, policies, and sample resident questions."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition shrink-0 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
            >
              {isProcessingFile ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
              <span>{uploadedFileInfo ? "Change File" : "Choose File"}</span>
            </button>
          </div>

          {/* AI Structured Notification Box */}
          {aiSuggestions && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-1.5 font-black text-amber-800">
                <Sparkles size={14} />
                <span>AI Ingestion Summary:</span>
              </div>
              <p className="text-[11.5px] leading-relaxed font-medium">{aiSuggestions.summary}</p>
              {aiSuggestions.sampleQuestions?.length > 0 && (
                <div className="pt-1.5 border-t border-amber-200/60">
                  <p className="text-[10px] font-black uppercase text-amber-800 tracking-wider mb-1">
                    Sample questions residents can now ask the chatbot:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] font-semibold text-amber-900/90">
                    {aiSuggestions.sampleQuestions.map((q, qIdx) => (
                      <li key={qIdx}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Inputs */}
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
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInput}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-semibold outline-none focus:border-emerald-600 focus:bg-white"
              >
                <option value="Active">Active (Injected into Chatbot)</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
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

          {/* Modal Action Buttons */}
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

      {/* FULL KNOWLEDGE RECORD VIEWER MODAL */}
      <FloatingModal
        open={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={viewingItem?.title || "Knowledge Record"}
        subtitle={`Category: ${viewingItem?.category} • Source: ${viewingItem?.source_type}`}
        maxWidth="max-w-3xl"
      >
        {viewingItem && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100">
              <span className="rounded-full bg-emerald-100 text-emerald-900 px-3 py-1 text-xs font-black">
                {viewingItem.category}
              </span>
              <span className="rounded-full bg-blue-100 text-blue-900 px-3 py-1 text-xs font-bold">
                Audience: {viewingItem.audience || "All Residents"}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(viewingItem.status)}`}>
                {viewingItem.status}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <pre className="text-xs sm:text-sm font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                {viewingItem.content}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (navigator?.clipboard?.writeText) {
                      await navigator.clipboard.writeText(viewingItem.content);
                    }
                  } catch {}
                  setMessage({ type: "success", text: "Knowledge content copied to clipboard!" });
                  setShowViewModal(false);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <Copy size={14} />
                <span>Copy Content</span>
              </button>
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </FloatingModal>

      {/* INTERACTIVE CHATBOT PLAYGROUND MODAL */}
      <FloatingModal
        open={showSimulator}
        onClose={() => setShowSimulator(false)}
        title="KaagapAI Chatbot Training Simulator"
        subtitle="Test live answers generated directly from your uploaded documents and AI knowledge"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          {/* Chat Transcript Area */}
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
                <span>KaagapAI is retrieving knowledge & typing answer...</span>
              </div>
            )}
          </div>

          {/* Quick Prompts to Test */}
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

          {/* Input Form */}
          <form onSubmit={handleTestChatbot} className="flex gap-2">
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

export default AIKnowledge;
