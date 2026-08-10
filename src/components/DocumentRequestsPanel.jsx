import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { fetchDocumentRequests } from "../services/documentRequestService";

const DocumentRequestsPanel = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isRequestExpired = (request) => {
    if (!request) return false;
    if (["Released", "Rejected", "Cancelled"].includes(request.status)) return false;

    const createdOrUpdatedTime = new Date(request.updated_at || request.created_at || 0).getTime();
    const timeDifferenceMs = Date.now() - createdOrUpdatedTime;
    const oneDayMs = 24 * 60 * 60 * 1000;

    return timeDifferenceMs > oneDayMs;
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case "Pending":
        return { backgroundColor: "#f59e0b", color: "#ffffff", border: "1px solid #d97706", boxShadow: "0 0 10px rgba(245,158,11,0.4)" };
      case "Processing":
        return { backgroundColor: "#2563eb", color: "#ffffff", border: "1px solid #1d4ed8", boxShadow: "0 0 10px rgba(37,99,235,0.4)" };
      case "Approved":
      case "Completed":
      case "Released":
        return { backgroundColor: "#10b981", color: "#ffffff", border: "1px solid #059669", boxShadow: "0 0 10px rgba(16,185,129,0.4)" };
      case "Cancelled":
        return { backgroundColor: "#64748b", color: "#ffffff", border: "1px solid #475569" };
      case "Rejected":
        return { backgroundColor: "#e11d48", color: "#ffffff", border: "1px solid #be123c", boxShadow: "0 0 10px rgba(225,29,72,0.4)" };
      case "Expired":
        return { backgroundColor: "#ef4444", color: "#ffffff", border: "1px solid #dc2626", boxShadow: "0 0 10px rgba(239,68,68,0.4)" };
      default:
        return { backgroundColor: "#64748b", color: "#ffffff", border: "1px solid #475569" };
    }
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchDocumentRequests({ limit: 10 });
        if (!isMounted) return;
        const requestsData = Array.isArray(result) ? result : result.data;
        const activeRequests = (requestsData || []).filter(r => r.status !== "Cancelled");
        setRequests(activeRequests);
      } catch (e) {
        if (!isMounted) return;
        console.error("Error loading document requests:", e);
        setError(e?.message || "Failed to load document requests");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatDate = useMemo(
    () => (iso) => {
      if (!iso) return "-";
      try {
        return new Date(iso).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit",
        });
      } catch {
        return "-";
      }
    },
    []
  );

  return (
    <section className="blue-glass-surface overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/45 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-[#10213f]">Document Requests</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">Recent resident requests</p>
        </div>
        <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 hover:text-blue-800">
          View All
          <ArrowRight size={16} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Resident</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Document</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Date</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white/60">
            {loading ? (
              <tr>
                <td className="px-5 py-8 text-center text-sm text-slate-500" colSpan={4}>
                  Loading document requests...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td className="px-5 py-8 text-center text-sm text-rose-600" colSpan={4}>
                  {error}
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-sm text-slate-500" colSpan={4}>
                  No document requests found.
                </td>
              </tr>
            ) : (
              requests.slice(0, 4).map((request) => {
                const expired = isRequestExpired(request);
                const displayStatus = expired ? "Expired" : request.status;
                return (
                  <tr key={request.id} className="transition hover:bg-blue-50/45">
                    <td className="px-5 py-3.5 text-sm font-medium text-[#17233c]">
                      {request.residents?.full_name || request.full_name || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{request.document_type}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(request.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold"
                        style={getStatusBadgeStyle(displayStatus)}
                      >
                        {displayStatus}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default DocumentRequestsPanel;
