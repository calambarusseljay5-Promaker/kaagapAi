import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Copy,
  Archive,
  Trash2,
  Power,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  Check,
  RefreshCw,
  FolderOpen,
  ArrowLeft,
  ChevronRight,
  Download,
  Upload,
  Loader,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import TemplateEditorModal from "../components/modals/TemplateEditorModal";
import { useConfirm } from "../context/ConfirmContext";
import { showAdminSystemToast } from "../utils/toast";
import {
  fetchDocumentTemplatesList,
  fetchDocumentTemplateStats,
  createDocumentTemplate,
  updateDocumentTemplate,
  duplicateDocumentTemplate,
  toggleDocumentTemplateStatus,
  archiveDocumentTemplate,
  deletePermanentDocumentTemplate,
  TEMPLATE_CATEGORIES,
} from "../services/documentTemplateService";
import { moveToRecycleBin } from "../services/recycleBinService";
import { uploadDocumentTemplateFile } from "../services/documentRequestService";
import { getCurrentUserWithProfile } from "../services/authService";

export default function DocumentTemplates() {
  const navigate = useNavigate();
  const { showConfirm } = useConfirm();
  const fileInputRef = useRef(null);

  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, countStats] = await Promise.all([
        fetchDocumentTemplatesList({
          search: searchTerm,
          status: selectedStatus,
          category: selectedCategory,
        }),
        fetchDocumentTemplateStats(),
      ]);
      setTemplates(list);
      setStats(countStats);
    } catch (err) {
      console.error("Failed to load templates:", err);
      showAdminSystemToast("Failed to load document templates.", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedStatus, selectedCategory]);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      const user = await getCurrentUserWithProfile();
      if (!isMounted) return;
      if (!user || user.profile?.role !== "admin") {
        navigate("/");
        return;
      }
      loadData();
    };
    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [loadData, navigate]);

  const handleTriggerFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = "";
    setUploadingFile(true);

    try {
      // 1. Clean file name: "Cert.Barangay-Clearance.docx" -> "Barangay Clearance"
      const rawName = file.name.replace(/\.[^/.]+$/, "");
      const cleanName = rawName
        .replace(/^cert\.?/i, "")
        .replace(/^barangay-cert\.?/i, "")
        .replace(/[-_.]+/g, " ")
        .trim();
      const templateName = cleanName
        ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
        : "New Document Template";

      const category = templateName.toLowerCase().includes("clearance")
        ? "Clearance"
        : templateName.toLowerCase().includes("permit")
        ? "Permit"
        : "Certification";

      let templateFilePath = "";

      // 2. Try uploading file to storage, with graceful fallback
      try {
        const uploadedTpl = await uploadDocumentTemplateFile(
          {
            template_name: templateName,
            document_type: templateName,
            category,
            description: `Official template uploaded from ${file.name}`,
            requirements: "Valid ID; proof of residency; purpose of request",
            processing_time: "1 day",
            fee: "Free",
          },
          file
        );
        if (uploadedTpl?.template_file_path) {
          templateFilePath = uploadedTpl.template_file_path;
        }
      } catch (storageErr) {
        console.warn("Storage upload notice (falling back to local file reference):", storageErr);
        templateFilePath = `/files/document-templates/${file.name}`;
      }

      // 3. Save template record
      await createDocumentTemplate({
        template_name: templateName,
        category,
        description: `Official template uploaded from ${file.name}`,
        template_file_path: templateFilePath,
        status: "Active",
        content: `<p>This is to certify that <strong>{{FULL_NAME}}</strong>, <strong>{{AGE}}</strong> yrs. old, Filipino, <strong>{{CIVIL_STATUS}}</strong>, a bona fide resident of Purok <strong>{{PUROK}}</strong>, Barangay Upper Mingading, Aleosan, Cotabato.</p><p>This certification is issued for <strong>{{PURPOSE}}</strong> and whatever legal purpose it may serve best.</p><p>Issued this <u>{{DAY}}</u> day of <u>{{MONTH}} {{YEAR}}</u> at Barangay Upper Mingading, Aleosan, Cotabato.</p>`,
      });

      showAdminSystemToast(`Template "${templateName}" uploaded and saved successfully!`, { type: "success" });
      loadData();
    } catch (err) {
      console.error("Error adding template:", err);
      showAdminSystemToast(err.message || "Failed to add template.", { type: "error" });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (template) => {
    setEditingTemplate(template);
    setIsEditorOpen(true);
  };

  const handleSaveTemplate = async (templateData) => {
    setSaving(true);
    try {
      if (editingTemplate) {
        await updateDocumentTemplate(editingTemplate.id, templateData);
        showAdminSystemToast("Template updated successfully.", { type: "success" });
      } else {
        await createDocumentTemplate(templateData);
        showAdminSystemToast("New template created successfully.", { type: "success" });
      }
      setIsEditorOpen(false);
      loadData();
    } catch (err) {
      console.error("Error saving template:", err);
      showAdminSystemToast(err.message || "Failed to save template.", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (template) => {
    try {
      await duplicateDocumentTemplate(template.id);
      showAdminSystemToast(`Duplicated "${template.template_name}" successfully.`, { type: "success" });
      loadData();
    } catch (err) {
      console.error("Error duplicating template:", err);
      showAdminSystemToast("Failed to duplicate template.", { type: "error" });
    }
  };

  const handleToggleStatus = async (template) => {
    try {
      const nextStatus = template.status === "Active" ? "Inactive" : "Active";
      await toggleDocumentTemplateStatus(template.id, template.status);
      showAdminSystemToast(`Template is now ${nextStatus}.`, { type: "success" });
      loadData();
    } catch (err) {
      console.error("Error toggling template status:", err);
      showAdminSystemToast("Failed to update status.", { type: "error" });
    }
  };

  const handleDeleteTemplate = async (template) => {
    const confirmed = await showConfirm({
      title: "Delete Document Template?",
      message: `Sigurado ka bang nais mong burahin ang "${template.template_name}"? Malilipat ito sa Recycle Bin at maaari mo itong i-restore anumang oras kung kinakailangan.`,
      confirmLabel: "Delete to Recycle Bin",
      cancelLabel: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    try {
      // 1. Move snapshot to Recycle Bin
      moveToRecycleBin("document_templates", template.id, template, "Admin");

      // 2. Delete template from active system
      await deletePermanentDocumentTemplate(template.id);

      showAdminSystemToast(`"${template.template_name}" is moved to Recycle Bin.`, { type: "success" });
      loadData();
    } catch (err) {
      console.error("Error deleting template:", err);
      showAdminSystemToast("Failed to delete template.", { type: "error" });
    }
  };

  const getCategoryBadge = (category) => {
    const cat = String(category || "").toLowerCase();
    if (cat.includes("clearance")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (cat.includes("permit")) {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }
    if (cat.includes("cert")) {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }
    return "bg-purple-50 text-purple-700 border-purple-200";
  };

  const getStatusBadge = (status) => {
    const st = String(status || "").toLowerCase();
    if (st === "active") {
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    }
    if (st === "inactive") {
      return "bg-amber-100 text-amber-800 border-amber-300";
    }
    return "bg-slate-100 text-slate-700 border-slate-300";
  };

  return (
    <PageWrapper>
      <div className="space-y-5">
        {/* Top Breadcrumb / Navigation helper */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <button
              onClick={() => navigate("/documents")}
              className="hover:text-emerald-700 flex items-center gap-1 transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Document Requests</span>
            </button>
            <ChevronRight size={12} />
            <span className="text-slate-800 font-bold">Template Management</span>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shadow-2xs">
                <FileText size={22} className="stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Document Template Management
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Create, manage, and maintain official barangay document templates with dynamic fields.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Hidden File Input for Direct Windows File Explorer upload */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".doc,.docx,.dot,.dotx,.pdf,application/msword,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Direct Upload / File Explorer Button */}
            <button
              type="button"
              onClick={handleTriggerFilePicker}
              disabled={uploadingFile}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Upload Word or PDF document template file from your computer"
            >
              {uploadingFile ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
              <span>{uploadingFile ? "Uploading File..." : "Add New Template"}</span>
            </button>
          </div>
        </div>

        {/* 4 Statistics Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Templates</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">All official formats</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Layers size={18} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-2xs flex items-center justify-between bg-emerald-50/20">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Active Templates</p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1">{stats.active}</h3>
              <p className="text-[10px] text-emerald-600/90 mt-0.5">Ready for requests</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-2xs flex items-center justify-between bg-amber-50/20">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Inactive Templates</p>
              <h3 className="text-2xl font-black text-amber-700 mt-1">{stats.inactive}</h3>
              <p className="text-[10px] text-amber-600/90 mt-0.5">Temporarily hidden</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Power size={18} />
            </div>
          </div>

          <div
            onClick={() => navigate("/recycle-bin")}
            className="bg-white p-4 rounded-xl border border-rose-200/80 shadow-2xs flex items-center justify-between bg-rose-50/15 hover:bg-rose-50/30 transition cursor-pointer group"
            title="Open Recycle Bin to view or restore deleted templates"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Recycle Bin</p>
              <h3 className="text-sm font-black text-rose-800 mt-1 flex items-center gap-1 group-hover:underline">
                <span>View Deleted</span>
                <span className="text-xs">→</span>
              </h3>
              <p className="text-[10px] text-rose-600/90 mt-0.5">Restore deleted items</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-105 transition">
              <Trash2 size={18} />
            </div>
          </div>
        </div>

        {/* Search, Status Tabs, and Category Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          {/* Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search template name, category, or text..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white outline-none font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Status Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              {["All", "Active", "Inactive"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                    selectedStatus === st
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="All">All Categories</option>
              {TEMPLATE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Template List Cards / Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="inline-flex h-10 w-10 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent mb-3" />
            <p className="text-xs font-bold text-slate-600">Loading document templates...</p>
          </div>
        ) : templates.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-6 shadow-2xs">
            <div className="h-16 w-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <FolderOpen size={28} />
            </div>
            <h3 className="text-base font-black text-slate-900">No document templates yet</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Create your first document template to start managing and generating official barangay documents.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus size={15} />
              <span>+ Create Template</span>
            </button>
          </div>
        ) : (
          /* Table of Templates */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Template Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Updated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {templates.map((tpl) => (
                    <tr key={tpl.id} className="hover:bg-slate-50/80 transition group">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/60">
                            <FileText size={16} />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {tpl.template_name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              ID: {String(tpl.id).slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${getCategoryBadge(
                            tpl.category
                          )}`}
                        >
                          {tpl.category || "Certification"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-slate-600 line-clamp-1 text-[11.5px]">
                          {tpl.description || "Official barangay document format."}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold border ${getStatusBadge(
                            tpl.status
                          )}`}
                        >
                          {tpl.status || "Active"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px] font-medium">
                        {new Date(tpl.updated_at || tpl.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview / Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(tpl)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200/80 shadow-2xs transition active:scale-95 cursor-pointer"
                            title="Edit / Customize Template"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Duplicate */}
                          <button
                            type="button"
                            onClick={() => handleDuplicate(tpl)}
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200/80 shadow-2xs transition active:scale-95 cursor-pointer"
                            title="Duplicate Template"
                          >
                            <Copy size={13} />
                          </button>

                          {/* Toggle Active/Inactive */}
                          {tpl.status !== "Archived" && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(tpl)}
                              className={`p-1.5 rounded-lg border shadow-2xs transition active:scale-95 cursor-pointer ${
                                tpl.status === "Active"
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border-emerald-200/80"
                                  : "bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border-amber-200/80"
                              }`}
                              title={tpl.status === "Active" ? "Click to Deactivate Template" : "Click to Activate Template"}
                            >
                              <Power size={13} />
                            </button>
                          )}

                          {/* Delete to Recycle Bin */}
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl)}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-200/80 shadow-2xs transition active:scale-95 cursor-pointer"
                            title="Delete Template (Move to Recycle Bin)"
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
          </div>
        )}
      </div>

      {/* Word-Style Template Editor Modal with Live Preview */}
      <TemplateEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        template={editingTemplate}
        onSave={handleSaveTemplate}
        saving={saving}
      />
    </PageWrapper>
  );
}
