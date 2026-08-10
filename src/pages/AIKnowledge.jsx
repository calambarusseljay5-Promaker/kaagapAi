import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Briefcase,
  CheckCircle2,
  Database,
  Edit2,
  FileText,
  Loader,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Header from "../components/Header";
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

const initialForm = {
  title: "",
  content: "",
  category: "General",
  audience: "All Residents",
  status: "Active",
  effective_date: new Date().toISOString().slice(0, 10),
  expires_at: "",
};

const statusClass = (status) => {
  if (status === "Active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "Archived") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
};

const sourceMeta = {
  manual: { label: "Manual", icon: FileText, color: "bg-blue-50 text-blue-700" },
  announcement: { label: "Announcement", icon: Megaphone, color: "bg-rose-50 text-rose-700" },
  livelihood: { label: "Livelihood/Job", icon: Briefcase, color: "bg-indigo-50 text-indigo-700" },
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
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(initialForm);

  const loadKnowledge = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchKnowledgeItems({
        search,
        status: statusFilter,
        sourceType: sourceFilter,
      });
      setItems(data);
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to load resident knowledge." });
    } finally {
      setLoading(false);
    }
  }, [search, sourceFilter, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(loadKnowledge, 250);
    return () => window.clearTimeout(timer);
  }, [loadKnowledge]);

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((item) => item.status === "Active").length,
      synced: items.filter((item) => item.source_type !== "manual").length,
      manual: items.filter((item) => item.source_type === "manual").length,
    }),
    [items]
  );

  const openCreate = () => {
    setEditingItem(null);
    setFormData(initialForm);
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
    setMessage(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData(initialForm);
  };

  const handleInput = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      if (editingItem) {
        await updateKnowledgeItem(editingItem.id, {
          ...formData,
          source_type: editingItem.source_type || "manual",
          source_id: editingItem.source_id || null,
        });
        setMessage({ type: "success", text: "Resident knowledge updated." });
      } else {
        await createKnowledgeItem({
          ...formData,
          source_type: "manual",
        });
        setMessage({ type: "success", text: "Resident knowledge saved." });
      }

      closeModal();
      await loadKnowledge();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to save resident knowledge." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.title}" from resident knowledge?`)) return;

    try {
      await deleteKnowledgeItem(item.id);
      setMessage({ type: "success", text: "Resident knowledge deleted." });
      await loadKnowledge();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to delete resident knowledge." });
    }
  };

  const syncPublishedContent = async () => {
    setSyncing(true);
    setMessage(null);

    try {
      const [announcements, livelihoodPosts] = await Promise.all([
        fetchAnnouncements({ limit: 200 }),
        fetchLivelihoodPosts({ limit: 200 }),
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
          : `${synced} announcement, event, job, and training item(s) synced into resident knowledge.`,
      });
      await loadKnowledge();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to sync resident knowledge." });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef3f8]">
      <Header title="AI Knowledge Trainer" subtitle="Manage the data used by the resident assistant" />
      <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
        {message ? (
          <div
            className={`mb-5 rounded-lg border px-4 py-3 text-sm ${message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
          >
            {message.text}
          </div>
        ) : null}

        <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#17233c]">Knowledge Base</h2>
              <p className="mt-1 text-sm text-slate-500">
                Secretary inputs, published announcements, events, jobs, and trainings become the resident assistant basis.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={syncPublishedContent}
                disabled={syncing}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {syncing ? <Loader size={17} className="animate-spin" /> : <RefreshCw size={17} />}
                {syncing ? "Syncing..." : "Sync Content"}
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14532D] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0f3e21] shadow-sm hover:shadow active:scale-95"
              >
                <Plus size={18} />
                New Knowledge
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, content, category..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All sources</option>
              <option value="manual">Manual</option>
              <option value="announcement">Announcements</option>
              <option value="livelihood">Livelihood & Jobs</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All statuses</option>
              <option value="Active">Active</option>
              <option value="Draft">Draft</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </section>

        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Knowledge Items", stats.total, Database],
            ["Resident Active", stats.active, CheckCircle2],
            ["Synced Inputs", stats.synced, RefreshCw],
            ["Manual Notes", stats.manual, BrainCircuit],
          ].map(([label, value, Icon]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <Icon className="mb-3 text-blue-600" size={22} />
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-[#17233c]">{value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-slate-500">
              <Loader className="mx-auto mb-3 animate-spin" size={24} />
              Loading resident knowledge...
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-slate-500">No resident knowledge found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((item) => {
                const meta = sourceMeta[item.source_type] || sourceMeta.manual;
                const SourceIcon = meta.icon;

                return (
                  <article key={item.id} className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.color}`}>
                            <SourceIcon size={13} />
                            {meta.label}
                          </span>
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            {item.category}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-[#17233c]">{item.title}</h3>
                        <p className="mt-2 line-clamp-3 max-w-4xl whitespace-pre-line text-sm leading-6 text-slate-600">
                          {item.content}
                        </p>
                        <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 lg:grid-cols-3">
                          <p><span className="font-semibold text-slate-700">Audience:</span> {item.audience || "-"}</p>
                          <p><span className="font-semibold text-slate-700">Effective:</span> {formatDate(item.effective_date)}</p>
                          <p><span className="font-semibold text-slate-700">Expires:</span> {formatDate(item.expires_at)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 text-blue-700 transition hover:bg-blue-50"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-700 transition hover:bg-rose-50"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#17233c]">
                  {editingItem ? "Edit AI Knowledge" : "New AI Knowledge"}
                </h2>
                {editingItem?.source_type && editingItem.source_type !== "manual" ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Synced knowledge can be overwritten when its source record changes.
                  </p>
                ) : null}
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X size={22} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Title *
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleInput}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Category
                <input
                  name="category"
                  value={formData.category}
                  onChange={handleInput}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-600"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Status
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInput}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-600"
                >
                  <option>Active</option>
                  <option>Draft</option>
                  <option>Archived</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Audience
                <select
                  name="audience"
                  value={formData.audience}
                  onChange={handleInput}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-600"
                >
                  <option>All Residents</option>
                  <option>Registered Residents</option>
                  <option>Senior Citizens</option>
                  <option>PWD/PWED Residents</option>
                  <option>Youth</option>
                  <option>Admin Only</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Effective Date
                <input
                  name="effective_date"
                  type="date"
                  value={formData.effective_date}
                  onChange={handleInput}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-600"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Expiration Date
                <input
                  name="expires_at"
                  type="date"
                  value={formData.expires_at}
                  onChange={handleInput}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-600"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Knowledge Content *
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleInput}
                  rows="7"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-[#1f63ca] px-4 py-2 font-semibold text-white hover:bg-[#1854ad] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Knowledge"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AIKnowledge;
