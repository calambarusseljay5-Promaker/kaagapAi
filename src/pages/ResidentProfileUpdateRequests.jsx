import { useConfirm } from "../context/ConfirmContext";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  XCircle,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import { DataGrid } from "@mui/x-data-grid";
import {
  approveResidentProfileUpdateRequest,
  fetchResidentProfileUpdateRequests,
  rejectResidentProfileUpdateRequest,
} from "../services/residentProfileUpdateService";

const statusOptions = ["Pending Approval", "Approved", "Rejected", "All"];

const changeLabels = {
  full_name: "Full Name",
  phone: "Phone",
  house_no: "House No.",
  household_no: "Household No.",
  relationship_to_household_head: "Household Relationship",
  birthday: "Birth Date",
  age: "Age",
  sex: "Sex",
  gender: "Gender",
  birthplace: "Birth Place",
  educational_attainment: "Educational Attainment",
  occupation: "Occupation",
  civil_status: "Civil Status",
  purok: "Purok",
  address: "Address",
};

const formatDate = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const getStatusClass = (status) => {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("approved")) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (normalized.includes("reject")) {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-amber-50 text-amber-700";
};

const getRequestChanges = (request) => {
  const changes = request?.requested_changes || {};
  const rows = Object.entries(changes).map(([key, value]) => ({
    key,
    label: changeLabels[key] || key,
    value: formatValue(value),
  }));

  if (request?.requested_username) {
    rows.unshift({
      key: "username",
      label: "Username",
      value: request.requested_username,
    });
  }

  return rows;
};

const ResidentProfileUpdateRequests = () => {
  const { confirm } = useConfirm();
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Pending Approval");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState("");

  const loadRequests = async (filter = statusFilter) => {
    setLoading(true);
    setError("");

    try {
      const data = await fetchResidentProfileUpdateRequests(filter === "All" ? null : filter);
      setRequests(data);
    } catch (loadError) {
      setError(loadError.message || "Unable to load resident profile update requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialRequests = async () => {
      try {
        const data = await fetchResidentProfileUpdateRequests("Pending Approval");

        if (isMounted) {
          setRequests(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || "Unable to load resident profile update requests.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialRequests();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return requests;

    return requests.filter((request) => {
      const changeText = getRequestChanges(request)
        .map((change) => `${change.label} ${change.value}`)
        .join(" ");

      return [
        request.full_name,
        request.current_username,
        request.requested_username,
        request.household_no,
        request.house_no,
        request.purok,
        request.request_status,
        changeText,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [requests, search]);

  const stats = useMemo(() => {
    const pendingCount = requests.filter((request) => request.request_status === "Pending Approval").length;
    const approvedCount = requests.filter((request) => request.request_status === "Approved").length;
    const rejectedCount = requests.filter((request) => request.request_status === "Rejected").length;

    return [
      { label: "Loaded Requests", value: requests.length, icon: UserCog, color: "bg-blue-50 text-blue-700" },
      { label: "Pending", value: pendingCount, icon: Clock3, color: "bg-amber-50 text-amber-700" },
      { label: "Approved", value: approvedCount, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700" },
      { label: "Rejected", value: rejectedCount, icon: XCircle, color: "bg-rose-50 text-rose-700" },
    ];
  }, [requests]);

  const handleStatusChange = (event) => {
    const nextStatus = event.target.value;
    setStatusFilter(nextStatus);
    loadRequests(nextStatus);
  };

  const handleApprove = async (request) => {
    setActionId(request.request_id);
    setMessage(null);
    setError("");

    try {
      await approveResidentProfileUpdateRequest(request);
      setMessage({
        type: "success",
        title: "Profile update approved",
        text: "The existing resident record was updated. No new resident row was created.",
      });
      await loadRequests();
    } catch (approveError) {
      setError(approveError.message || "Unable to approve profile update request.");
    } finally {
      setActionId("");
    }
  };

  const handleReject = async (request) => {
    const ok = await confirm({
      title: "Reject Profile Update",
      message: `Are you sure you want to reject the profile update request for ${request.full_name || "this resident"}?`,
      confirmText: "Yes, Reject",
      cancelText: "No, Cancel",
      variant: "danger",
      icon: XCircle,
    });
    if (!ok) return;

    setActionId(request.request_id);
    setMessage(null);
    setError("");

    try {
      await rejectResidentProfileUpdateRequest(request, "Rejected by admin");
      setMessage({
        type: "warning",
        title: "Profile update rejected",
        text: `The profile update request for ${request.full_name || "the resident"} has been rejected.`,
      });
      await loadRequests();
    } catch (rejectError) {
      setError(rejectError.message || "Unable to reject profile update request.");
    } finally {
      setActionId("");
    }
  };

  const columns = [
    {
      field: "resident",
      headerName: "Resident",
      flex: 1.5,
      renderCell: (params) => {
        const request = params.row;
        return (
          <div className="py-2 leading-tight">
            <p className="font-semibold text-[#17233c]">{request.full_name || "-"}</p>
            <p className="text-xs text-slate-500 mt-0.5">Username: {request.current_username || "-"}</p>
            <p className="text-xs text-slate-500 mt-0.5">Household: {request.household_no || request.house_no || "-"}</p>
            <p className="text-xs text-slate-500 mt-0.5">Purok: {request.purok || "-"}</p>
          </div>
        );
      }
    },
    {
      field: "changes",
      headerName: "Requested Changes",
      flex: 2,
      renderCell: (params) => {
        const request = params.row;
        const changes = getRequestChanges(request);
        return (
          <div className="py-2 leading-tight w-full">
            {changes.length === 0 ? (
              <p className="text-xs text-slate-500">No field changes listed.</p>
            ) : (
              <div className="grid gap-1">
                {changes.map((change) => (
                  <div key={change.key} className="rounded bg-slate-50 px-2.5 py-1 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                      {change.label}
                    </span>
                    <p className="break-words text-xs font-semibold text-[#17233c] mt-0.5">
                      {change.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
    },
    {
      field: "request_status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => {
        const request = params.row;
        return (
          <div className="py-2 leading-tight">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusClass(request.request_status)}`}>
              {request.request_status || "-"}
            </span>
            {request.rejection_reason && (
              <p className="mt-1 max-w-xs text-xs leading-5 text-rose-600">{request.rejection_reason}</p>
            )}
          </div>
        );
      }
    },
    {
      field: "request_date",
      headerName: "Requested",
      flex: 1.2,
      renderCell: (params) => formatDate(params.row.request_date)
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1.2,
      headerAlign: "right",
      align: "right",
      renderCell: (params) => {
        const request = params.row;
        const isPending = request.request_status === "Pending Approval";
        const isBusy = actionId === request.request_id;
        return (
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => handleApprove(request)}
              disabled={!isPending || isBusy}
              className="btn-gov btn-gov-primary px-3 py-1.5 text-xs"
            >
              {isBusy ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
              Approve
            </button>
            <button
              type="button"
              onClick={() => handleReject(request)}
              disabled={!isPending || isBusy}
              className="btn-gov btn-gov-danger px-3 py-1.5 text-xs"
            >
              <XCircle size={12} />
              Reject
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <>
      <PageWrapper title="Resident Profile Updates" description="Approve resident-submitted personal information changes">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-2xl font-bold text-[#17233c]">{stat.value}</p>
                    </div>
                    <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.color}`}>
                      <Icon size={21} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <section className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <UserCog size={20} />
              </span>
              <div>
                <h2 className="font-bold text-[#17233c]">Protected profile update workflow</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Resident changes stay hidden in a pending request. The admin is notified and can
                  approve or reject them. Only an approval updates the existing Resident Management
                  record; rejection keeps the current resident data unchanged.
                </p>
              </div>
            </div>
          </section>

          {message ? (
            <section
              className={`rounded-lg border px-4 py-3 text-sm shadow-sm ${message.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
            >
              <p className="font-semibold">{message.title}</p>
              <p className="mt-1">{message.text}</p>
            </section>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-3 sm:grid-cols-[1fr_220px] lg:flex-1">
                <label className="relative block">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search resident, username, household, changes"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <select
                  value={statusFilter}
                  onChange={handleStatusChange}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => loadRequests()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            <div className="gov-datagrid-container overflow-hidden mt-6" style={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={filteredRequests}
                columns={columns}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 10 },
                  },
                }}
                pageSizeOptions={[10, 25, 50]}
                disableRowSelectionOnClick
                loading={loading}
                rowHeight={160}
                getRowId={(row) => row.request_id}
              />
            </div>
          </section>
        </div>
      </PageWrapper>
    </>
  );
};

export default ResidentProfileUpdateRequests;
