import { useEffect, useMemo, useState } from "react";
import { Activity, Database, RefreshCw, Search, Trash2 } from "lucide-react";
import Header from "../components/Header";
import { clearLocalAuditEvents, fetchAuditActivity } from "../services/adminActivityService";

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

const AuditLogs = () => {
  const [activities, setActivities] = useState([]);
  const [errors, setErrors] = useState([]);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const loadActivities = async () => {
    setLoading(true);

    try {
      const result = await fetchAuditActivity();
      setActivities(result.activities);
      setErrors(result.errors);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialActivities = async () => {
      try {
        const result = await fetchAuditActivity();

        if (isMounted) {
          setActivities(result.activities);
          setErrors(result.errors);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialActivities();

    return () => {
      isMounted = false;
    };
  }, []);

  const moduleOptions = useMemo(
    () => [...new Set(activities.map((activity) => activity.module).filter(Boolean))],
    [activities]
  );

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activities.filter((activity) => {
      const matchesSearch =
        !query ||
        [activity.module, activity.action, activity.details, activity.source]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesModule = !moduleFilter || activity.module === moduleFilter;

      return matchesSearch && matchesModule;
    });
  }, [activities, moduleFilter, search]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return activities.filter((activity) => new Date(activity.timestamp).toDateString() === today).length;
  }, [activities]);

  const localCount = activities.filter((activity) => activity.source !== "Database").length;

  const handleClearLocal = () => {
    clearLocalAuditEvents();
    loadActivities();
  };

  return (
    <div className="flex h-screen flex-col bg-transparent">
      <Header title="Audit Logs" subtitle="View recent system activity and local admin actions" />

      <div className="flex-1 overflow-auto custom-scrollbar px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass-panel p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Loaded Events</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-800">{activities.length}</p>
            </div>
            <div className="glass-panel p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Today</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-800">{todayCount}</p>
            </div>
            <div className="glass-panel p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Local Logs</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-800">{localCount}</p>
            </div>
          </div>

          <section className="glass-panel overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-3 sm:grid-cols-[1fr_220px] lg:flex-1">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search activity"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <select
                  value={moduleFilter}
                  onChange={(event) => setModuleFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">All modules</option>
                  {moduleOptions.map((moduleName) => (
                    <option key={moduleName} value={moduleName}>
                      {moduleName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={loadActivities}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f63ca] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1854ad] disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={handleClearLocal}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Trash2 size={16} />
                  Clear Local
                </button>
              </div>
            </div>

            {errors.length > 0 ? (
              <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Some activity sources could not be loaded: {errors.join("; ")}
              </div>
            ) : null}

            <div className="divide-y divide-white/20">
              {loading ? (
                <div className="px-5 py-8 text-center text-slate-500">Loading activity...</div>
              ) : filteredActivities.length === 0 ? (
                <div className="px-5 py-8 text-center text-slate-500">No activity matches the selected filters.</div>
              ) : (
                filteredActivities.map((activity) => (
                  <article key={activity.id} className="flex gap-4 px-5 py-5 transition-colors hover:bg-white/40 group">
                    <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50/80 text-blue-700 shadow-sm">
                      {activity.source === "Database" ? <Database size={19} /> : <Activity size={19} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#17233c]">{activity.action}</p>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          {activity.module}
                        </span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {activity.source}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{activity.details}</p>
                      <p className="mt-2 text-xs text-slate-400">{formatDate(activity.timestamp)}</p>
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

export default AuditLogs;
