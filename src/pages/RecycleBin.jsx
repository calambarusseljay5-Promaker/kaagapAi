import { useState, useEffect, useCallback, useRef } from "react";
import {
  Trash2,
  RotateCcw,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Archive,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import Header from "../components/Header";
import { useConfirm } from "../context/ConfirmContext";
import { supabase } from "../lib/supabaseClient";
import {
  getRecycleBinItems,
  restoreFromRecycleBin,
  permanentlyDeleteFromRecycleBin,
  emptyRecycleBin,
  getRecycleBinStats,
  getDaysUntilExpiry,
  formatTimeSinceDeletion
} from "../services/recycleBinService";

const ITEMS_PER_PAGE = 8;

const RecycleBin = () => {
  const { confirm } = useConfirm();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ totalItems: 0, byTable: {}, expiringSoon: 0 });
  const [search, setSearch] = useState("");
  const [filterTable, setFilterTable] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const residentNamesRef = useRef({});

  const loadRecycleBin = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedItems = getRecycleBinItems({
        tableName: filterTable,
        search: "" // We will filter client-side below to check dynamically resolved names
      });

      // Find document requests and identify resident IDs with missing names
      const documentRequestItems = fetchedItems.filter(
        (item) => item.tableName === "document_requests"
      );

      const missingResidentIds = documentRequestItems
        .map((item) => {
          if (item.snapshot?.residents?.full_name) return null;
          return item.snapshot?.resident_id;
        })
        .filter((id) => id && !residentNamesRef.current[id]);

      const uniqueMissingIds = [...new Set(missingResidentIds)];

      if (uniqueMissingIds.length > 0) {
        const { data } = await supabase
          .from("residents")
          .select("id, full_name")
          .in("id", uniqueMissingIds);

        if (data) {
          data.forEach((r) => {
            residentNamesRef.current[r.id] = r.full_name;
          });
        }
      }

      // Filter by search term client-side
      let filtered = fetchedItems;
      if (search?.trim()) {
        const q = search.trim().toLowerCase();
        filtered = fetchedItems.filter((item) => {
          if (
            item.title?.toLowerCase().includes(q) ||
            item.displayName?.toLowerCase().includes(q) ||
            item.recordId?.toLowerCase().includes(q)
          ) {
            return true;
          }

          if (item.snapshot) {
            const snap = item.snapshot;
            const resName = snap.residents?.full_name || residentNamesRef.current[snap.resident_id];
            if (
              resName?.toLowerCase().includes(q) ||
              snap.document_type?.toLowerCase().includes(q) ||
              snap.title?.toLowerCase().includes(q) ||
              snap.full_name?.toLowerCase().includes(q) ||
              snap.name?.toLowerCase().includes(q)
            ) {
              return true;
            }
          }
          return false;
        });
      }

      setItems(filtered);
      setStats(getRecycleBinStats());
    } catch (err) {
      console.error("Error loading Recycle Bin:", err);
      setMessage({ type: "error", text: "Failed to load Recycle Bin items." });
    } finally {
      setLoading(false);
    }
  }, [filterTable, search]);

  useEffect(() => {
    loadRecycleBin();
  }, [loadRecycleBin]);

  const handleRestore = async (item) => {
    const ok = await confirm({
      title: "Restore Record",
      message: `Are you sure you want to restore the deleted ${item.displayName} "${item.title}"? It will be re-inserted back to active records.`,
      confirmText: "Restore Item",
      cancelText: "Cancel",
      variant: "emerald",
      icon: RotateCcw,
    });
    if (!ok) return;

    setMessage(null);
    try {
      await restoreFromRecycleBin(item.id);
      setMessage({ type: "success", text: `${item.displayName} restored successfully.` });
      loadRecycleBin();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to restore item." });
    }
  };

  const handlePermanentDelete = async (item) => {
    const ok = await confirm({
      title: "Permanently Delete Record",
      message: `Are you sure you want to permanently delete "${item.title}"? This action cannot be undone and will bypass standard safety checks.`,
      confirmText: "Delete Permanently",
      cancelText: "Cancel",
      variant: "danger",
      icon: Trash2,
    });
    if (!ok) return;

    setMessage(null);
    try {
      permanentlyDeleteFromRecycleBin(item.id);
      setMessage({ type: "success", text: "Record permanently removed from system database." });
      loadRecycleBin();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to permanently delete item." });
    }
  };

  const handleEmptyBin = async () => {
    if (items.length === 0) return;

    const ok = await confirm({
      title: "Empty Recycle Bin",
      message: "Are you sure you want to permanently delete all items currently in the Recycle Bin? This action is absolutely irreversible.",
      confirmText: "Empty Entire Bin",
      cancelText: "Cancel",
      variant: "danger",
      icon: ShieldAlert,
    });
    if (!ok) return;

    setMessage(null);
    try {
      const count = emptyRecycleBin();
      setMessage({ type: "success", text: `Recycle Bin cleared: ${count} record(s) permanently deleted.` });
      loadRecycleBin();
      setCurrentPage(1);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to empty Recycle Bin." });
    }
  };

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const paginatedItems = items.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getTableBadgeColor = (tableName) => {
    switch (tableName) {
      case "announcements":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "livelihood_posts":
        return "bg-purple-50 text-purple-700 border-purple-100";
      case "document_requests":
        return "bg-amber-50 text-amber-700 border-amber-100";
      default:
        return "bg-slate-50 text-slate-700 border-slate-100";
    }
  };

  return (
    <PageWrapper>
      <div className="flex flex-col gap-6">
        {/* Compact Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <Trash2 className="text-[#14532D]" />
              System Recycle Bin
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Soft-deleted records are stored here for up to {stats.retentionDays || 30} days. Restorable with a single click.
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={handleEmptyBin}
              className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4.5 py-2.5 shadow-md transition active:scale-95 duration-150"
            >
              <ShieldAlert size={14} />
              Empty Recycle Bin
            </button>
          )}
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`flex items-start gap-3 rounded-2xl border p-4 text-xs font-semibold shadow-sm ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                : "bg-rose-50 text-rose-800 border-rose-100"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={16} />
            ) : (
              <AlertCircle className="mt-0.5 shrink-0 text-rose-600" size={16} />
            )}
            <span className="flex-1">{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-[10px] uppercase font-bold hover:underline text-slate-500 hover:text-slate-800 ml-2">
              Dismiss
            </button>
          </div>
        )}

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4.5 flex items-center gap-4.5 shadow-sm">
            <div className="h-11 w-11 rounded-xl bg-[#14532D]/10 text-[#14532D] flex items-center justify-center font-bold">
              <Archive size={20} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wider">Total Soft-Deleted</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">{stats.totalItems} records</h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4.5 flex items-center gap-4.5 shadow-sm">
            <div className="h-11 w-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wider">Expiring Soon (&lt; 3 Days)</p>
              <h3 className="text-xl font-black text-rose-600 mt-0.5">{stats.expiringSoon} records</h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4.5 flex items-center gap-4.5 shadow-sm">
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-[#C8A14A] flex items-center justify-center font-bold">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wider">Retention Setting</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">{stats.retentionDays} Days Purge</h3>
            </div>
          </div>
        </div>

        {/* Unified Workspace Panel */}
        <div className="gov-workspace-panel bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col">
          
          {/* Toolbar */}
          <div className="p-4 flex flex-col sm:flex-row gap-3.5 items-center justify-between bg-slate-50/50 border-b border-slate-100">
            
            {/* Search Input */}
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search soft-deleted records..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#14532D] focus:ring-4 focus:ring-emerald-100/50 font-medium transition"
              />
            </div>

            {/* Filter Dropdown */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <Filter size={14} className="text-slate-400 hidden sm:inline" />
              <select
                value={filterTable}
                onChange={(e) => {
                  setFilterTable(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-48 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 font-bold outline-none focus:border-[#14532D]"
              >
                <option value="">All Record Types</option>
                <option value="announcements">Announcements</option>
                <option value="livelihood_posts">Livelihood & Jobs</option>
                <option value="document_requests">Document Requests</option>
              </select>
              
              <button
                onClick={loadRecycleBin}
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 transition active:scale-95"
                title="Refresh Recycle Bin"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Main Data Area */}
          <div className="flex-1 overflow-x-auto min-h-[380px]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner mb-4">
                  <FolderOpen size={24} />
                </div>
                <h4 className="text-sm font-extrabold text-slate-800">Recycle Bin is Empty</h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1.5 font-medium leading-relaxed">
                  No soft-deleted records match the current filters. Delete system announcements, livelihoods, or documents to test the system.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-extrabold uppercase text-slate-450 tracking-wider">
                    <th className="px-6 py-4">Record Title & Details</th>
                    <th className="px-6 py-4">Record Type</th>
                    <th className="px-6 py-4">Deleted Time</th>
                    <th className="px-6 py-4">Deleted By</th>
                    <th className="px-6 py-4">Days Left</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {paginatedItems.map((item) => {
                    const daysLeft = getDaysUntilExpiry(item.expiresAt);
                    const isUrgent = daysLeft <= 3;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-3.5 max-w-xs">
                          <p className="font-extrabold text-slate-850 truncate" title={item.title}>
                            {item.title}
                          </p>
                          {item.tableName === "document_requests" && (
                            <div className="mt-1 text-[11px] font-semibold text-slate-650">
                              <span>Requested by: </span>
                              <span className="text-[#14532D] font-extrabold">
                                {item.snapshot?.residents?.full_name || residentNamesRef.current[item.snapshot?.resident_id] || "Unknown Resident"}
                              </span>
                            </div>
                          )}
                          {item.snapshot?.created_at && (
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                              <Calendar size={10} className="text-slate-400" />
                              <span>{item.tableName === "document_requests" ? "Requested: " : "Created: "}</span>
                              <span>
                                {new Date(item.snapshot.created_at).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true
                                })}
                              </span>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                            Original ID: {item.recordId}
                          </p>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-wider ${getTableBadgeColor(item.tableName)}`}>
                            {item.displayName}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-slate-650 font-bold">
                          <div>
                            {new Date(item.deletedAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true
                            })}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                            ({formatTimeSinceDeletion(item.deletedAt)})
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-slate-650 font-bold">
                          {item.deletedBy || "System"}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`font-black ${isUrgent ? "text-rose-600" : "text-slate-750"}`}>
                            {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRestore(item)}
                              className="inline-flex items-center gap-1 hover:bg-[#14532D]/10 hover:text-[#14532D] text-slate-600 font-bold border border-transparent rounded-lg px-2.5 py-1.5 transition text-[11px]"
                              title="Restore Record"
                            >
                              <RotateCcw size={12} />
                              <span>Restore</span>
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(item)}
                              className="inline-flex items-center gap-1 hover:bg-rose-50 hover:text-rose-600 text-slate-400 font-bold border border-transparent rounded-lg px-2.5 py-1.5 transition text-[11px]"
                              title="Permanently Delete"
                            >
                              <Trash2 size={12} />
                              <span>Purge</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          {items.length > 0 && (
            <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 bg-slate-50/50">
              <span className="text-[11px] text-slate-500 font-bold">
                Showing {Math.min(items.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)} to{" "}
                {Math.min(items.length, currentPage * ITEMS_PER_PAGE)} of {items.length} records
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((c) => c - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-black text-slate-800 px-2.5">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((c) => c + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
};

export default RecycleBin;
