import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileImage,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import FloatingModal from "../components/FloatingModal";
import { useConfirm } from "../context/ConfirmContext";
import { DataGrid } from "@mui/x-data-grid";
import {
  approveResidentActivationRequest,
  createResidentRegistrationProofUrl,
  fetchResidentActivationRequests,
  rejectResidentActivationRequest,
} from "../services/residentActivationService";
import {
  isValidSmsPhone,
  normalizeSmsPhone,
  sendSmsNotification,
} from "../services/smsService";

const statusOptions = ["Pending Approval", "Approved", "Rejected", "All"];

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

const getStatusClass = (status) => {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("active") || normalized.includes("approved")) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (normalized.includes("reject")) {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-amber-50 text-amber-700";
};

const ResidentActivationRequests = () => {
  const { confirm } = useConfirm();
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Pending Approval");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [proofLoadingId, setProofLoadingId] = useState("");
  const [proofPreview, setProofPreview] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState("");

  const loadRequests = async (filter = statusFilter) => {
    setLoading(true);
    setError("");

    try {
      const data = await fetchResidentActivationRequests(filter === "All" ? null : filter);
      setRequests(data);
    } catch (loadError) {
      setError(loadError.message || "Unable to load resident registration requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialRequests = async () => {
      try {
        const data = await fetchResidentActivationRequests("Pending Approval");

        if (isMounted) {
          setRequests(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || "Unable to load resident registration requests.");
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

    return requests.filter((request) =>
      [
        request.full_name,
        request.requested_full_name,
        request.household_no,
        request.requested_household_no,
        request.phone,
        request.requested_phone,
        request.request_status,
        request.resident_status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [requests, search]);

  const stats = useMemo(() => {
    const pendingCount = requests.filter((request) => request.request_status === "Pending Approval").length;
    const approvedCount = requests.filter((request) => request.request_status === "Approved").length;
    const rejectedCount = requests.filter((request) => request.request_status === "Rejected").length;

    return [
      { label: "Loaded Requests", value: requests.length, icon: UserCheck, color: "bg-blue-50 text-blue-700" },
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
    if (!request.requested_proof_path) {
      setError("Review requires a valid ID or proof of residency before approval.");
      return;
    }

    const ok = await confirm({
      title: "Approve Registration",
      message: "Are you sure you want to approve this resident's account activation?",
      confirmText: "Approve",
      cancelText: "Cancel",
      variant: "emerald",
      icon: UserCheck,
    });
    if (!ok) return;

    setActionId(request.request_id);
    setMessage(null);
    setError("");

    try {
      const result = await approveResidentActivationRequest(request);
      const smsPhone = result.phone || request.phone || request.requested_phone;
      let smsMessage = "No valid SMS phone number was provided. Give these credentials manually.";
      let smsStatus = "warning";

      if (smsPhone && isValidSmsPhone(smsPhone)) {
        try {
          const bodyText = result.used_resident_credentials
            ? `Hello ${result.full_name || request.full_name || "Resident"}, your KaagapAI registration is approved! You can now log in using your created username & password.`
            : `Hello ${result.full_name || request.full_name || "Resident"}, your Barangay resident account is verified. Username: ${result.username}. Password: ${result.temporary_password}.`;

          await sendSmsNotification({
            to: smsPhone,
            body: bodyText,
          });
          smsStatus = "success";
          smsMessage = result.used_resident_credentials
            ? `Approval notification sent by SMS to ${normalizeSmsPhone(smsPhone)}.`
            : `Credentials were sent by SMS to ${normalizeSmsPhone(smsPhone)}.`;
        } catch (smsError) {
          smsMessage = `The account was approved, but SMS sending failed: ${smsError.message || "Unable to send SMS."
            } Give approval notice manually.`;
        }
      }

      setMessage({
        type: smsStatus,
        title: "Resident registration approved",
        text: smsMessage,
        phone: smsPhone ? normalizeSmsPhone(smsPhone) : "",
        username: result.username,
        temporaryPassword: result.temporary_password,
        usedResidentCredentials: result.used_resident_credentials,
      });
      await loadRequests();
    } catch (approveError) {
      setError(approveError.message || "Unable to approve registration request.");
    } finally {
      setActionId("");
    }
  };

  const handleViewProof = async (request) => {
    setProofLoadingId(request.request_id);
    setError("");

    try {
      const url = await createResidentRegistrationProofUrl(request);
      setProofPreview({ request, url });
    } catch (proofError) {
      setError(proofError.message || "Unable to open the submitted verification proof.");
    } finally {
      setProofLoadingId("");
    }
  };

  const handleReject = async (request) => {
    const ok = await confirm({
      title: "Reject Registration",
      message: `Are you sure you want to reject the registration request for ${request.full_name || request.requested_full_name || "this resident"}?`,
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
      await rejectResidentActivationRequest(request, "Rejected by admin");
      setMessage({
        type: "warning",
        title: "Registration request rejected",
        text: `The registration request for ${request.full_name || request.requested_full_name || "the resident"} has been rejected.`,
      });
      await loadRequests();
    } catch (rejectError) {
      setError(rejectError.message || "Unable to reject registration request.");
    } finally {
      setActionId("");
    }
  };

  const columns = [
    {
      field: "resident",
      headerName: "Resident & Account Details",
      flex: 2,
      minWidth: 260,
      renderCell: (params) => {
        const request = params.row;
        return (
          <div className="py-2 leading-tight">
            <p className="font-bold text-[#17233c] text-sm truncate">{request.full_name || request.requested_full_name || "-"}</p>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs mt-0.5 text-slate-500 font-semibold">
              <span>Household: {request.household_no || request.requested_household_no || "-"}</span>
              <span>•</span>
              <span>User: {request.requested_username || "-"}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-medium truncate">{request.requested_email || request.email || "-"}</p>
            <p className="text-[10px] font-bold text-blue-600 mt-1 uppercase tracking-wider">
              {request.registration_type || (request.resident_id ? "Existing Access" : "New Registration")}
            </p>
          </div>
        );
      }
    },
    {
      field: "phone",
      headerName: "Contact & Location",
      flex: 1,
      minWidth: 120,
      renderCell: (params) => {
        const request = params.row;
        return (
          <div className="py-2 leading-tight">
            <p className="text-slate-700 text-xs font-semibold">{request.phone || request.requested_phone || "-"}</p>
            <p className="text-xs text-slate-500 mt-1">Purok: {request.purok || request.requested_purok || "-"}</p>
          </div>
        );
      }
    },
    {
      field: "verification",
      headerName: "Verification Details",
      flex: 1,
      minWidth: 130,
      renderCell: (params) => {
        const request = params.row;
        return (
          <div className="py-2 leading-tight">
            <p className="text-xs text-slate-500">Birth: {request.requested_birthday || "-"}</p>
            {request.requested_proof_path ? (
              <button
                type="button"
                onClick={() => handleViewProof(request)}
                disabled={proofLoadingId === request.request_id}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:opacity-60"
              >
                {proofLoadingId === request.request_id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FileImage size={12} />
                )}
                View Proof
              </button>
            ) : (
              <p className="mt-1.5 inline-block rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                {request.proof_review_available === false
                  ? "Install migration"
                  : "No proof"}
              </p>
            )}
          </div>
        );
      }
    },
    {
      field: "request_status",
      headerName: "Status & Date",
      flex: 1.2,
      minWidth: 140,
      renderCell: (params) => {
        const request = params.row;
        return (
          <div className="py-2 leading-tight">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getStatusClass(request.request_status)}`}>
              {request.request_status || "-"}
            </span>
            <p className="text-[10px] font-semibold text-slate-500 mt-1.5">{formatDate(request.request_date)}</p>
            {request.rejection_reason && (
              <p className="mt-1 max-w-xs text-[10px] leading-tight text-rose-600 truncate" title={request.rejection_reason}>{request.rejection_reason}</p>
            )}
          </div>
        );
      }
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1.5,
      minWidth: 160,
      headerAlign: "right",
      align: "right",
      renderCell: (params) => {
        const request = params.row;
        const isPending = request.request_status === "Pending Approval";
        const isBusy = actionId === request.request_id;
        return (
          <div className="flex gap-1.5 justify-end">
            <button
              type="button"
              onClick={() => handleApprove(request)}
              disabled={!isPending || isBusy || !request.requested_proof_path}
              className="btn-gov btn-gov-primary px-2.5 py-1 text-xs font-bold"
              title={isPending && !request.requested_proof_path ? "A verification proof is required before approval." : undefined}
            >
              {isBusy ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
              Approve
            </button>
            <button
              type="button"
              onClick={() => handleReject(request)}
              disabled={!isPending || isBusy}
              className="btn-gov btn-gov-danger px-2.5 py-1 text-xs font-bold"
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
      <PageWrapper title="Online Resident Registration" description="Review online registrations and approve resident portal access">
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

          <section className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <FileCheck2 size={20} />
              </span>
              <div>
                <h2 className="font-bold text-[#17233c]">Controlled online registration workflow</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Resident submits details and proof, the admin receives a notification, reviews the
                  private proof, then approves or rejects. Only approval creates or activates the
                  resident record and portal account.
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
              {message.username || message.temporaryPassword || message.usedResidentCredentials ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md bg-white/70 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Username</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-[#17233c]">{message.username}</p>
                  </div>
                  {message.temporaryPassword ? (
                    <div className="rounded-md bg-white/70 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Household Password
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold text-[#17233c]">
                        {message.temporaryPassword}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md bg-white/70 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Password Status
                      </p>
                      <p className="mt-1 text-xs font-semibold text-emerald-800">
                        Resident-chosen credentials approved.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
              {message.phone ? (
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  SMS phone: {message.phone}
                </p>
              ) : null}
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
                    placeholder="Search resident, household, status"
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
                rowHeight={120}
                getRowId={(row) => row.request_id}
              />
            </div>
          </section>
        </div>
      </PageWrapper>

      <FloatingModal
        open={!!proofPreview}
        onClose={() => setProofPreview(null)}
        title="Verification proof"
        eyebrow={proofPreview ? `${proofPreview.request.full_name || proofPreview.request.requested_full_name || "Resident"} - ${proofPreview.request.requested_proof_name || "Submitted file"}` : ""}
        maxWidth="max-w-4xl"
        footer={
          proofPreview && (
            <div className="flex justify-end w-full">
              <a
                href={proofPreview.url}
                target="_blank"
                rel="noreferrer"
                className="btn-gov btn-gov-primary"
              >
                <ExternalLink size={15} />
                Open in new tab
              </a>
            </div>
          )
        }
      >
        {proofPreview && (
          <div className="p-6">
            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 rounded-lg">
              {proofPreview.request.requested_proof_type === "application/pdf" ? (
                <iframe
                  src={proofPreview.url}
                  title="Resident registration proof PDF"
                  className="h-[50vh] w-full rounded-lg border border-slate-200 bg-white"
                />
              ) : (
                <img
                  src={proofPreview.url}
                  alt="Submitted resident verification proof"
                  className="mx-auto max-h-[50vh] max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-sm"
                />
              )}
            </div>
          </div>
        )}
      </FloatingModal>
    </>
  );
};

export default ResidentActivationRequests;
