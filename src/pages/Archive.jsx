import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Archive as ArchiveIcon,
  CheckCircle,
  Filter,
  Loader,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import { DataGrid } from "@mui/x-data-grid";
import { deleteResident, fetchResidents, restoreResident } from "../services/adminService";
import { formatPurok, purokOptions, sexOptions } from "../utils/residentProfile";
import { useConfirm } from "../context/ConfirmContext";

const formatDate = (dateValue) => {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const isInsideDateRange = (resident, dateFrom, dateTo) => {
  if (!dateFrom && !dateTo) return true;

  const archivedDate = resident.archived_at || resident.updated_at || resident.created_at;
  if (!archivedDate) return false;

  const value = new Date(archivedDate);
  if (Number.isNaN(value.getTime())) return false;

  if (dateFrom) {
    const from = new Date(`${dateFrom}T00:00:00`);
    if (value < from) return false;
  }

  if (dateTo) {
    const to = new Date(`${dateTo}T23:59:59`);
    if (value > to) return false;
  }

  return true;
};

const Archive = () => {
  const { confirm } = useConfirm();
  const [archivedResidents, setArchivedResidents] = useState([]);
  const [search, setSearch] = useState("");
  const [sexFilter, setSexFilter] = useState("");
  const [purokFilter, setPurokFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionResidentId, setActionResidentId] = useState(null);

  const loadArchivedResidents = useCallback(async () => {
    setLoading(true);

    try {
      const data = await fetchResidents(search, "Archived", {
        sex: sexFilter,
        purok: purokFilter,
      });
      setArchivedResidents(data.filter((resident) => isInsideDateRange(resident, dateFrom, dateTo)));
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to load archived residents." });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, purokFilter, search, sexFilter]);

  useEffect(() => {
    const run = async () => {
      await loadArchivedResidents();
    };

    run();
  }, [loadArchivedResidents]);

  const handleRestore = async (resident) => {
    const ok = await confirm({
      title: "Restore Record",
      message: "Do you want to restore this record?",
      confirmText: "Restore",
      cancelText: "Cancel",
      variant: "emerald",
      icon: RotateCcw,
    });
    if (!ok) return;

    setActionResidentId(resident.id);
    setMessage(null);

    try {
      await restoreResident(resident);
      setMessage({ type: "success", text: "Resident restored to active records." });
      await loadArchivedResidents();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to restore resident." });
    } finally {
      setActionResidentId(null);
    }
  };

  const handleDelete = async (resident) => {
    const ok = await confirm({
      title: "Permanently Delete Record",
      message: "This action cannot be undone. This record will be permanently removed from the system.",
      confirmText: "Delete Permanently",
      cancelText: "Cancel",
      variant: "danger",
      icon: Trash2,
    });
    if (!ok) return;

    setActionResidentId(resident.id);
    setMessage(null);

    try {
      await deleteResident(resident);
      setMessage({ type: "success", text: "Archived resident permanently deleted." });
      await loadArchivedResidents();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to delete archived resident." });
    } finally {
      setActionResidentId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSexFilter("");
    setPurokFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const columns = [
    {
      field: "full_name",
      headerName: "Resident",
      flex: 1.5,
      renderCell: (params) => {
        const resident = params.row;
        return (
          <div className="py-2 leading-tight">
            <p className="font-semibold text-slate-900">{resident.full_name || "Unnamed"}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{resident.address || "-"}</p>
          </div>
        );
      }
    },
    {
      field: "email",
      headerName: "Login",
      flex: 1.2,
      renderCell: (params) => {
        const resident = params.row;
        return (
          <div className="py-2 leading-tight">
            <p>{resident.email || "-"}</p>
            <p className="text-xs text-slate-500 mt-0.5">House {resident.house_no || "-"}</p>
          </div>
        );
      }
    },
    {
      field: "age",
      headerName: "Age / Sex",
      flex: 1,
      renderCell: (params) => `${params.row.age ?? "-"} / ${params.row.sex || params.row.gender || "-"}`
    },
    {
      field: "purok",
      headerName: "Purok",
      flex: 1,
      renderCell: (params) => formatPurok(params.row.purok)
    },
    {
      field: "archived_at",
      headerName: "Archived Date",
      flex: 1.2,
      renderCell: (params) => formatDate(params.row.archived_at || params.row.updated_at)
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 0.8,
      headerAlign: "right",
      align: "right",
      renderCell: (params) => {
        const resident = params.row;
        return (
          <div className="flex gap-1 justify-end">
            <button
              type="button"
              onClick={() => handleRestore(resident)}
              disabled={actionResidentId === resident.id}
              className="gov-action-btn view"
              title="Restore resident"
            >
              {actionResidentId === resident.id ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <RotateCcw size={16} />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(resident)}
              disabled={actionResidentId === resident.id}
              className="gov-action-btn delete"
              title="Delete permanently"
            >
              {actionResidentId === resident.id ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <>
      <PageWrapper title="Archive Management" description="Review, restore, and permanently remove archived residents">
        {message ? (
          <div
            className={`mb-6 flex items-start gap-3 rounded-lg border p-4 text-sm ${message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="mt-0.5 flex-shrink-0" size={18} />
            ) : (
              <AlertCircle className="mt-0.5 flex-shrink-0" size={18} />
            )}
            <span>{message.text}</span>
          </div>
        ) : null}

        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ArchiveIcon className="text-slate-600" size={20} />
                <h2 className="text-xl font-semibold text-slate-900">Archived Residents</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {archivedResidents.length} archived record{archivedResidents.length === 1 ? "" : "s"} shown
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_150px_150px_150px_150px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search archived residents..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <select
              value={sexFilter}
              onChange={(event) => setSexFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All sex</option>
              {sexOptions.map((sex) => (
                <option key={sex} value={sex}>
                  {sex}
                </option>
              ))}
            </select>

            <select
              value={purokFilter}
              onChange={(event) => setPurokFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All puroks</option>
              {purokOptions.map((purok) => (
                <option key={purok} value={purok}>
                  {formatPurok(purok)}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              aria-label="Archived from date"
            />

            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              aria-label="Archived to date"
            />

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Filter size={16} />
              Reset
            </button>
          </div>
        </section>

        <div className="gov-datagrid-container overflow-hidden mt-6" style={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={archivedResidents}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 },
              },
            }}
            pageSizeOptions={[10, 25, 50]}
            disableRowSelectionOnClick
            loading={loading}
            rowHeight={70}
            getRowId={(row) => row.id}
          />
        </div>
      </PageWrapper>
    </>
  );
};

export default Archive;
