import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Calendar,
  Edit2,
  GraduationCap,
  Loader,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Header from "../components/Header";
import Drawer from "../components/Drawer";
import {
  createLivelihoodPost,
  deleteLivelihoodPost,
  fetchLivelihoodPosts,
  updateLivelihoodPost,
  fetchLivelihoodApplications,
  updateLivelihoodApplicationStatus,
} from "../services/livelihoodService";

const initialForm = {
  title: "",
  category: "Program",
  organization: "",
  description: "",
  eligibility: "",
  slots: "",
  location: "",
  contact: "",
  status: "Open",
  deadline: "",
};

const statusClass = (status) => {
  if (status === "Open") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "Closed") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
};

const formatDate = (dateValue) => {
  if (!dateValue) return "No deadline";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No deadline";
  return date.toLocaleDateString();
};

const Livelihood = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [formData, setFormData] = useState(initialForm);

  const [showAppsModal, setShowAppsModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);

  const openApplications = async (post) => {
    setSelectedPost(post);
    setShowAppsModal(true);
    setAppsLoading(true);
    try {
      const data = await fetchLivelihoodApplications({ livelihoodId: post.id });
      setApplications(data);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load applications." });
    } finally {
      setAppsLoading(false);
    }
  };

  const handleApproveApplication = async (appId, residentId) => {
    try {
      await updateLivelihoodApplicationStatus(appId, "Approved", residentId, selectedPost?.title);
      setApplications(applications.map(app => app.id === appId ? { ...app, status: "Approved" } : app));
      setMessage({ type: "success", text: "Application approved." });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to approve application." });
    }
  };

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLivelihoodPosts({
        search,
        category: categoryFilter,
        status: statusFilter,
      });
      setPosts(data);
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to load livelihood posts." });
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(loadPosts, 0);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  const stats = useMemo(
    () => ({
      total: posts.length,
      open: posts.filter((post) => post.status === "Open").length,
      jobs: posts.filter((post) => post.category === "Job").length,
      programs: posts.filter((post) => post.category === "Program").length,
    }),
    [posts]
  );

  const openCreate = () => {
    setEditingPost(null);
    setFormData(initialForm);
    setMessage(null);
    setShowModal(true);
  };

  const openEdit = (post) => {
    setEditingPost(post);
    setFormData({
      title: post.title || "",
      category: post.category || "Program",
      organization: post.organization || "",
      description: post.description || "",
      eligibility: post.eligibility || "",
      slots: post.slots?.toString() || "",
      location: post.location || "",
      contact: post.contact || "",
      status: post.status || "Open",
      deadline: post.deadline || "",
    });
    setMessage(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPost(null);
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
      if (editingPost) {
        await updateLivelihoodPost(editingPost.id, formData);
      } else {
        await createLivelihoodPost(formData);
      }

      setMessage({
        type: "success",
        text: editingPost ? "Livelihood post updated." : "Livelihood post created.",
      });

      closeModal();
      await loadPosts();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to save livelihood post." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    if (!window.confirm(`Delete "${post.title}"?`)) return;

    try {
      await deleteLivelihoodPost(post.id);
      setMessage({ type: "success", text: "Livelihood post deleted." });
      await loadPosts();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to delete livelihood post." });
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Header
        title="Livelihood & Jobs"
        subtitle="Manage programs, trainings, and job opportunities"
      />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {message ? (
          <div
            className={`glass-panel mb-5 p-4 text-sm font-semibold shadow-soft ${message.type === "success"
                ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/50"
                : "bg-rose-50/80 text-rose-700 border-rose-200/50"
              }`}
          >
            {message.text}
          </div>
        ) : null}

        <div className="glass-container mt-6">
          <div className="flex items-center justify-between border-b border-slate-200/50 bg-slate-50/50 px-6 py-4">
            <div className="text-sm font-semibold text-slate-500">Livelihood Board</div>
            <div>
              <button
                type="button"
                onClick={openCreate}
                className="strict-button-hover inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#14532D] hover:bg-[#0f3e21] px-4 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                Add Post
              </button>
            </div>
          </div>

          <div className="p-6 border-b border-slate-200/50 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px] bg-white/20">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 text-emerald-500" size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, organization, location..."
                className="w-full h-[46px] rounded-[12px] border border-slate-200 bg-white/60 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-[46px] rounded-[12px] border border-slate-200 bg-white/60 px-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm"
            >
              <option value="">All categories</option>
              <option value="Program">Program</option>
              <option value="Job">Job</option>
              <option value="Training">Training</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-[46px] rounded-[12px] border border-slate-200 bg-white/60 px-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm"
            >
              <option value="">All statuses</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 p-6 border-b border-slate-200/50 bg-slate-50/20">
            {[
              ["Total Posts", stats.total, Briefcase, "bg-slate-100 text-slate-600"],
              ["Open", stats.open, Calendar, "bg-emerald-100 text-emerald-600"],
              ["Jobs", stats.jobs, Briefcase, "bg-blue-100 text-blue-600"],
              ["Programs", stats.programs, GraduationCap, "bg-amber-100 text-amber-600"],
            ].map(([label, value, Icon, colorClass]) => (
              <div key={label} className="relative overflow-hidden group">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-110 ${colorClass}`}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-black text-slate-900 leading-none">{value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6">
            {loading ? (
              <div className="p-10 text-center text-slate-500 font-semibold bg-white/40 rounded-xl">
                <Loader className="mx-auto mb-3 animate-spin" size={24} />
                Loading livelihood posts...
              </div>
            ) : posts.length === 0 ? (
              <div className="p-10 text-center text-slate-500 font-semibold bg-white/40 rounded-xl">No livelihood or job posts found.</div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {posts.map((post) => {
                  const borderColor = post.status === "Open" ? "#10B981" : post.status === "Draft" ? "#F59E0B" : "#94A3B8";

                  return (
                    <article key={post.id} className="relative rounded-[20px] bg-white/60 border border-slate-200/60 p-6 flex flex-col group overflow-hidden border-l-[6px] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all" style={{ borderLeftColor: borderColor }}>
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                          {post.category}
                        </span>
                        <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${statusClass(post.status)}`}>
                          {post.status}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-slate-800 line-clamp-2 mb-2">{post.title}</h3>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 line-clamp-3 mb-6 flex-1">
                        {post.description || "No description provided."}
                      </p>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-medium text-slate-500 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Organization</p>
                          <p className="text-slate-700 truncate" title={post.organization || "-"}>{post.organization || "-"}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Location</p>
                          <p className="text-slate-700 truncate" title={post.location || "-"}>{post.location || "-"}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Deadline</p>
                          <p className="text-slate-700">{formatDate(post.deadline)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Slots</p>
                          <p className="text-slate-700">{post.slots ?? "Open"}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 mt-auto">
                        <button
                          type="button"
                          onClick={() => openApplications(post)}
                          className="inline-flex w-full h-[38px] items-center justify-center gap-2 rounded-lg border border-emerald-200 text-xs font-bold text-emerald-700 bg-emerald-50 transition hover:bg-emerald-100 hover:border-emerald-300"
                        >
                          <Briefcase size={14} /> View Applications
                        </button>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(post)}
                            className="inline-flex flex-1 h-[38px] items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-bold text-blue-600 transition hover:bg-slate-50 hover:border-blue-200"
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(post)}
                            className="inline-flex flex-1 h-[38px] items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-bold text-rose-600 transition hover:bg-rose-50 hover:border-rose-200"
                            title="Delete"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <Drawer
        isOpen={showAppsModal}
        onClose={() => setShowAppsModal(false)}
        title={`Applications for ${selectedPost?.title || "Post"}`}
        width="max-w-3xl"
      >
        <div className="p-6">
          {appsLoading ? (
            <div className="text-center py-10 text-slate-500 font-bold">
              <Loader className="mx-auto animate-spin mb-3" size={24} />
              Loading applications...
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-10 text-slate-500 font-bold">
              No applications yet.
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => (
                <div key={app.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50 gap-4">
                  <div>
                    <h4 className="font-bold text-slate-800">{app.residents?.full_name || "Unknown Resident"}</h4>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">Applied on: {new Date(app.created_at).toLocaleDateString()}</p>
                    <div className="text-xs font-bold text-slate-600 mt-2 flex gap-3">
                      <span>Purok: {app.residents?.purok || "N/A"}</span>
                      <span>House: {app.residents?.house_no || "N/A"}</span>
                      <span>Contact: {app.residents?.phone || "N/A"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {app.status === "Pending" ? (
                      <>
                        <button
                          onClick={() => handleApproveApplication(app.id, app.resident_id)}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await updateLivelihoodApplicationStatus(app.id, "Rejected", app.resident_id, selectedPost?.title);
                              setApplications(applications.map(a => a.id === app.id ? { ...a, status: "Rejected" } : a));
                            } catch (e) {
                              setMessage({ type: "error", text: "Failed to reject." });
                            }
                          }}
                          className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        app.status === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}>
                        {app.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Drawer>

      <Drawer
        isOpen={showModal}
        onClose={closeModal}
        title={editingPost ? "Edit Post" : "Add Livelihood or Job Post"}
        width="max-w-xl"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row justify-end">
            <button
              type="button"
              onClick={closeModal}
              className="px-6 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            >
              {saving ? <Loader size={16} className="animate-spin" /> : null}
              {saving ? "Saving..." : editingPost ? "Save Changes" : "Save Post"}
            </button>
          </div>
        }
      >
        <div className="p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm font-bold text-slate-700">
              Title *
              <input name="title" value={formData.title} onChange={handleInput} className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Category
              <select name="category" value={formData.category} onChange={handleInput} className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm">
                <option>Program</option>
                <option>Job</option>
                <option>Training</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">
              Status
              <select name="status" value={formData.status} onChange={handleInput} className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm">
                <option>Open</option>
                <option>Closed</option>
                <option>Draft</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">
              Organization
              <input name="organization" value={formData.organization} onChange={handleInput} className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Location
              <input name="location" value={formData.location} onChange={handleInput} className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Slots
              <input name="slots" type="number" min="0" value={formData.slots} onChange={handleInput} className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Deadline
              <input name="deadline" type="date" value={formData.deadline} onChange={handleInput} className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm" />
            </label>
            <label className="sm:col-span-2 text-sm font-bold text-slate-700">
              Contact
              <input name="contact" value={formData.contact} onChange={handleInput} className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm" />
            </label>
            <label className="sm:col-span-2 text-sm font-bold text-slate-700">
              Eligibility
              <textarea name="eligibility" value={formData.eligibility} onChange={handleInput} rows="2" className="mt-2 w-full rounded-[12px] border border-slate-200 bg-slate-50 p-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm" />
            </label>
            <label className="sm:col-span-2 text-sm font-bold text-slate-700">
              Description
              <textarea name="description" value={formData.description} onChange={handleInput} rows="4" className="mt-2 w-full rounded-[12px] border border-slate-200 bg-slate-50 p-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm" />
            </label>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default Livelihood;
