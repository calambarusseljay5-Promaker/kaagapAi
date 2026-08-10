import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ShieldCheck, UserCheck, Users as UsersIcon } from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import { DataGrid } from "@mui/x-data-grid";
import { fetchUserProfiles } from "../services/adminActivityService";

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

const shortId = (value) => {
  if (!value) return "-";
  return String(value).slice(0, 8);
};

const Users = () => {
  const [profiles, setProfiles] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfiles = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await fetchUserProfiles();
      setProfiles(data);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load user profiles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialProfiles = async () => {
      try {
        const data = await fetchUserProfiles();

        if (isMounted) {
          setProfiles(data);
        }
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError.message || "Unable to load user profiles.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialProfiles();

    return () => {
      isMounted = false;
    };
  }, []);

  const roleOptions = useMemo(
    () => [...new Set(profiles.map((profile) => profile.role).filter(Boolean))],
    [profiles]
  );

  const statusOptions = useMemo(
    () => [...new Set(profiles.map((profile) => profile.registration_status).filter(Boolean))],
    [profiles]
  );

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesSearch =
        !query ||
        [profile.id, profile.resident_id, profile.role, profile.registration_status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesRole = !roleFilter || profile.role === roleFilter;
      const matchesStatus = !statusFilter || profile.registration_status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [profiles, roleFilter, search, statusFilter]);

  const stats = useMemo(() => {
    const adminCount = profiles.filter((profile) => profile.role === "admin").length;
    const residentCount = profiles.filter((profile) =>
      ["resident", "user"].includes(String(profile.role || "").toLowerCase())
    ).length;
    const activeCount = profiles.filter((profile) => profile.registration_status === "Active").length;

    return [
      { label: "Profiles", value: profiles.length, icon: UsersIcon, color: "bg-blue-50 text-blue-700" },
      { label: "Admins", value: adminCount, icon: ShieldCheck, color: "bg-emerald-50 text-emerald-700" },
      { label: "Residents", value: residentCount, icon: UserCheck, color: "bg-indigo-50 text-indigo-700" },
      { label: "Active", value: activeCount, icon: UserCheck, color: "bg-sky-50 text-sky-700" },
    ];
  }, [profiles]);

  const columns = [
    {
      field: "id",
      headerName: "Profile ID",
      flex: 1.5,
      renderCell: (params) => shortId(params.row.id)
    },
    {
      field: "role",
      headerName: "Role",
      flex: 1,
      renderCell: (params) => (
        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 uppercase">
          {params.row.role || "user"}
        </span>
      )
    },
    {
      field: "registration_status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => (
        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          {params.row.registration_status || "Active"}
        </span>
      )
    },
    {
      field: "resident_id",
      headerName: "Resident Link",
      flex: 1.5,
      renderCell: (params) => shortId(params.row.resident_id)
    },
    {
      field: "created_at",
      headerName: "Created",
      flex: 1.2,
      renderCell: (params) => formatDate(params.row.created_at)
    },
    {
      field: "updated_at",
      headerName: "Updated",
      flex: 1.2,
      renderCell: (params) => formatDate(params.row.updated_at)
    }
  ];

  return (
    <PageWrapper title="User Management" description="View registered admin and resident profiles">
      <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div key={stat.label} className="glass-panel p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-3xl font-extrabold text-slate-800">{stat.value}</p>
                    </div>
                    <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color} shadow-sm`}>
                      <Icon size={24} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <section className="glass-panel overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-3 sm:grid-cols-3 lg:flex-1">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search users"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">All roles</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">All statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={loadProfiles}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f63ca] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1854ad] disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {error ? (
              <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="gov-datagrid-container overflow-hidden mt-6" style={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={filteredProfiles}
                columns={columns}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 10 },
                  },
                }}
                pageSizeOptions={[10, 25, 50]}
                disableRowSelectionOnClick
                loading={loading}
                rowHeight={65}
                getRowId={(row) => row.id}
              />
            </div>
          </section>
        </div>
      </PageWrapper>
  );
};

export default Users;
