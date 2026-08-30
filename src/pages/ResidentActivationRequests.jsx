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
  const [viewedProofIds, setViewedProofIds] = useState(() => new Set());
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

  const handleStatusChange = (event) => {
    const nextStatus = event.target.value;
    setStatusFilter(nextStatus);
    loadRequests(nextStatus);
  };

  const handleViewProof = async (request) => {
    setProofLoadingId(request.request_id);
    setError("");

    try {
      const url = await createResidentRegistrationProofUrl(request);
      setViewedProofIds((prev) => new Set(prev).add(request.request_id));
      setProofPreview({ request, url });
    } catch (proofError) {
      setError(proofError.message || "Unable to open the submitted verification proof.");
    } finally {
      setProofLoadingId("");
    }
  };

  const handleApprove = async (request) => {
    if (!request.requested_proof_path) {
      setError("Review requires a valid ID or proof of residency before approval.");
      return;
    }

    if (!viewedProofIds.has(request.request_id)) {
      // Must review proof first before approving
      await handleViewProof(request);
      return;
    }

    const ok = await confirm({
      title: "Approve Registration",
      message: `Are you sure you want to approve the registration for ${request.full_name || request.requested_full_name || "this resident"}?`,
      confirmText: "Approve",
      cancelText: "Cancel",
      variant: "emerald",
      icon: UserCheck,
    });
    if (!ok) return;

    setProofPreview(null);
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
          const residentName = result.full_name || request.full_name || request.requested_full_name || "Residente";
          const bodyText = [
            "[OFFICIAL KAAGAPAI NOTIFICATION]",
            "BARANGAY UPPER MINGADING, ALEOSAN",
            "----------------------------------------",
            `🏛️ Magandang araw, ${residentName}!`,
            "Ang inyong Barangay resident portal registration ay OPISYAL NANG APPROVED at VERIFIED ng Barangay Admin.",
            "Maaari na kayong mag-login sa KaagapAI Citizen Portal gamit ang inyong registered account.",
            "----------------------------------------",
            "⚠️ PAALALA: Ingatan ang inyong account. Ang Barangay ay HINDI kailanman hihingi ng password o pera via text.",
          ].join("\n");

          await sendSmsNotification({
            to: smsPhone,
            body: bodyText,
          });
          smsStatus = "success";
          smsMessage = `Approval confirmation notice sent via SMS to ${normalizeSmsPhone(smsPhone)}.`;
        } catch (smsError) {
          smsMessage = `The account was approved, but SMS sending failed: ${smsError.message || "Unable to send SMS."} Give approval notice manually.`;
        }
      }

      setMessage({
        type: smsStatus,
        title: "Resident registration approved",
        text: smsMessage,
        phone: smsPhone ? normalizeSmsPhone(smsPhone) : "",
        username: result.username || request.requested_username || "",
        usedResidentCredentials: true,
      });
      await loadRequests();
    } catch (approveError) {
      setError(approveError.message || "Unable to approve registration request.");
    } finally {
      setActionId("");
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

    setProofPreview(null);
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
        const displayUsername = request.requested_username || request.username || "-";
        const displayEmail = request.requested_email || request.gmail || request.email || "-";
        return (
          <div className="py-2 leading-tight">
            <p className="font-bold text-[#17233c] text-sm truncate">{request.full_name || request.requested_full_name || "-"}</p>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs mt-0.5 text-slate-500 font-semibold">
              <span>Household: {request.household_no || request.requested_household_no || "-"}</span>
              <span>•</span>
              <span className="text-emerald-700 font-bold font-mono">User: {displayUsername}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-medium truncate">{displayEmail}</p>
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
      flex: 1.2,
      minWidth: 150,
      renderCell: (params) => {
        const request = params.row;
        return (
          <div className="py-2 leading-tight">
            <p className="text-slate-700 text-xs font-semibold">{request.phone || request.requested_phone || "-"}</p>
            <p className="text-xs text-slate-500 mt-0.5">Purok: {request.purok || request.requested_purok || "-"}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Birth: {request.requested_birthday || "-"}</p>
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
      flex: 1.2,
      minWidth: 160,
      headerAlign: "right",
      align: "right",
      renderCell: (params) => {
        const request = params.row;
        const isPending = request.request_status === "Pending Approval";
        const isBusy = actionId === request.request_id || proofLoadingId === request.request_id;
        const hasProof = Boolean(request.requested_proof_path);

        if (!hasProof) {
          return (
            <div className="flex justify-end items-center">
              <span className="inline-block rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                No proof
              </span>
            </div>
          );
        }

        return (
          <div className="flex justify-end items-center">
            <button
              type="button"
              onClick={() => handleViewProof(request)}
              disabled={isBusy}
              className={`px-3 py-1.5 text-xs font-bold transition rounded-xl inline-flex items-center gap-1.5 shadow-sm ${
                isPending
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-700/20"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              title="Click to view submitted proof and review registration"
            >
              {proofLoadingId === request.request_id ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FileImage size={13} />
              )}
              <span>{isPending ? "View Proof" : "View Proof"}</span>
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
          <section className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <FileCheck2 size={20} />
              </span>
              <div>
                <h2 className="font-bold text-[#17233c]">Controlled online registration workflow</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Resident submits details and proof, the admin reviews the submitted proof document, then approves or rejects directly from the preview. Only approval creates or activates the resident record and portal account.
                </p>
              </div>
            </div>
          </section>

          {message ? (
            <section
              className={`rounded-lg border px-4 py-3 text-sm shadow-sm ${
                message.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <p className="font-semibold">{message.title}</p>
              <p className="mt-1">{message.text}</p>
              {message.phone ? (
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  SMS Recipient: <span className="font-mono text-emerald-900 font-bold">{message.phone}</span>
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
        title="Resident Verification Proof Review"
        eyebrow={proofPreview ? `${proofPreview.request.full_name || proofPreview.request.requested_full_name || "Resident"} • Submitted Document` : ""}
        maxWidth="max-w-4xl"
        footer={
          proofPreview && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
              <a
                href={proofPreview.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 transition"
              >
                <ExternalLink size={14} />
                Open full proof in new tab
              </a>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setProofPreview(null)}
                  className="btn-gov btn-gov-secondary px-3 py-1.5 text-xs font-bold"
                >
                  Close
                </button>
                {proofPreview.request.request_status === "Pending Approval" && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const req = proofPreview.request;
                        setProofPreview(null);
                        handleReject(req);
                      }}
                      disabled={actionId === proofPreview.request.request_id}
                      className="btn-gov btn-gov-danger px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <XCircle size={15} />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(proofPreview.request)}
                      disabled={actionId === proofPreview.request.request_id}
                      className="btn-gov btn-gov-primary px-5 py-2 text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-emerald-700/20"
                    >
                      {actionId === proofPreview.request.request_id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={15} />
                      )}
                      Approve Application
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        }
      >
        {proofPreview && (
          <div className="p-5 space-y-4">
            {/* Resident Key Info Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Resident Name:</span>
                <span className="font-extrabold text-slate-900 truncate block">{proofPreview.request.full_name || proofPreview.request.requested_full_name || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Household No:</span>
                <span className="font-bold text-slate-900 truncate block">{proofPreview.request.household_no || proofPreview.request.requested_household_no || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Purok:</span>
                <span className="font-bold text-slate-900 truncate block">{proofPreview.request.purok || proofPreview.request.requested_purok || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Mobile Phone:</span>
                <span className="font-bold text-slate-900 truncate block">{proofPreview.request.phone || proofPreview.request.requested_phone || "-"}</span>
              </div>
            </div>

            {/* Proof Image / Document Container */}
            <div className="min-h-0 flex-1 overflow-auto bg-slate-900/5 p-4 rounded-xl border border-slate-200 flex items-center justify-center">
              {proofPreview.request.requested_proof_type === "application/pdf" ? (
                <iframe
                  src={proofPreview.url}
                  title="Resident registration proof PDF"
                  className="h-[55vh] w-full rounded-lg border border-slate-300 bg-white"
                />
              ) : (
                <img
                  src={proofPreview.url}
                  alt="Submitted resident verification proof"
                  className="mx-auto max-h-[55vh] max-w-full rounded-lg border border-slate-300 bg-white object-contain shadow-md"
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
