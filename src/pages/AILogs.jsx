import { useMemo, useState } from "react";
import { Bot, Clock3, RefreshCw, Search, Trash2 } from "lucide-react";
import Header from "../components/Header";
import { clearAiLogs, getAiLogs } from "../services/adminActivityService";

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

const formatDuration = (durationMs) => {
  if (!durationMs) return "-";
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
};

const AILogs = () => {
  const [logs, setLogs] = useState(() => getAiLogs());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadLogs = () => {
    setLogs(getAiLogs());
  };

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesSearch =
        !query ||
        [log.question, log.answer, log.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus = !statusFilter || log.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [logs, search, statusFilter]);

  const successCount = logs.filter((log) => log.status === "success").length;
  const errorCount = logs.filter((log) => log.status === "error").length;
  const latestLog = logs[0];

  const handleClear = () => {
    clearAiLogs();
    loadLogs();
  };

  return (
    <div className="flex h-screen flex-col bg-[#eef3f8]">
      <Header title="AI Assistant Logs" subtitle="Review admin AI assistant questions and responses" />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1180px] space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Questions</p>
              <p className="mt-2 text-2xl font-bold text-[#17233c]">{logs.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Successful</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{successCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Errors</p>
              <p className="mt-2 text-2xl font-bold text-rose-700">{errorCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Latest</p>
              <p className="mt-2 truncate text-sm font-semibold text-[#17233c]">
                {latestLog ? formatDate(latestLog.created_at) : "-"}
              </p>
            </div>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px] lg:flex-1">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search AI logs"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">All statuses</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={loadLogs}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f63ca] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1854ad]"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Trash2 size={16} />
                  Clear Logs
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Bot className="mx-auto text-slate-300" size={34} />
                  <p className="mt-3 text-sm font-semibold text-slate-700">No AI assistant logs found.</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Ask the admin AI assistant a question, then refresh this page.
                  </p>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <article key={log.id} className="px-5 py-4 transition hover:bg-slate-50">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                              log.status === "error"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {log.status}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            <Clock3 size={13} />
                            {formatDuration(log.durationMs)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-[#17233c]">{log.question}</p>
                        <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                          {log.answer}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-slate-400">{formatDate(log.created_at)}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AILogs;
