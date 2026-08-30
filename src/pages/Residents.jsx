import { useCallback, useEffect, useState } from "react";
import Header from "../components/Header";
import { showAdminSystemToast } from "../utils/toast";
import {
  archiveResident,
  createResident,
  deleteResident,
  fetchResidents,
  restoreResident,
  updateResident,
} from "../services/adminService";
import { formatPurok, purokOptions } from "../utils/residentProfile";

const initialForm = {
  full_name: "",
  email: "",
  phone: "",
  house_no: "",
  age: "",
  gender: "",
  purok: "",
  address: "",
  status: "Active",
};

const statusOptions = ["", "Active", "Inactive", "Pending", "Archived"];

const KEY_FIELDS = ["id", "resident_id", "residentId", "uuid", "uid", "user_id"];

const getResidentKey = (resident) => {
  if (!resident || typeof resident !== "object") {
    return null;
  }
  return KEY_FIELDS.find((field) => resident[field] !== undefined && resident[field] !== null) || null;
};

const getResidentKeyValue = (resident) => {
  const key = getResidentKey(resident);
  return key ? resident[key] : null;
};

const Residents = () => {
  const [residents, setResidents] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, _setMessage] = useState(null);
  const setMessage = useCallback((msg) => {
    if (msg) {
      if (typeof msg === "string") {
        showAdminSystemToast(msg, "success");
      } else if (msg.text) {
        showAdminSystemToast(msg.text, msg.type || "success", msg.title);
      }
    }
  }, []);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedResident, setSelectedResident] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadResidents = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const data = await fetchResidents(search, statusFilter);
      setResidents(data);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!isMounted) return;

      setLoading(true);
      setMessage(null);

      try {
        const data = await fetchResidents(search, statusFilter);
        if (isMounted) {
          setResidents(data);
        }
      } catch (error) {
        if (isMounted) {
          setMessage({ type: "error", text: error.message });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [search, statusFilter]);

  const resetForm = () => {
    setForm(initialForm);
    setIsEditing(false);
    setSelectedResident(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (resident) => {
    setForm({
      full_name: resident.full_name || resident.name || "",
      email: resident.portal_username || resident.resident_account?.username || "",
      phone: resident.phone || "",
      house_no: resident.house_no || "",
      age: resident.age?.toString() || "",
      gender: resident.gender || "",
      purok: resident.purok || "",
      address: resident.address || "",
      status: resident.status || "Active",
    });
    setSelectedResident(resident);
    setIsEditing(true);
    setMessage(null);
  };

  const handleDelete = async (resident) => {
    const keyValue = getResidentKeyValue(resident);
    if (!keyValue) {
      setMessage({ type: "error", text: "Unable to delete resident: primary key not found." });
      return;
    }

    if (!window.confirm("Delete this resident?")) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await deleteResident(resident);
      setMessage({ type: "success", text: "Resident deleted successfully." });
      await loadResidents();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (resident) => {
    setLoading(true);
    setMessage(null);

    try {
      if (resident.status === "Archived") {
        await restoreResident(resident);
        setMessage({ type: "success", text: "Resident restored successfully." });
      } else {
        await archiveResident(resident);
        setMessage({ type: "success", text: "Resident archived successfully." });
      }
      await loadResidents();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const payload = {
        full_name: form.full_name,
        email: null,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        house_no: form.house_no.trim(),
        age: form.age ? Number(form.age) : null,
        gender: form.gender,
        purok: form.purok,
        address: form.address,
        status: form.status,
      };

      if (isEditing && selectedResident) {
        await updateResident(selectedResident, payload);
        setMessage({ type: "success", text: "Resident updated successfully." });
      } else {
        await createResident(payload);
        setMessage({ type: "success", text: "Resident added successfully." });
      }

      resetForm();
      await loadResidents();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Residents" subtitle="Manage and view all barangay residents" />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden mb-6 rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-[#ECFDF5] via-[#F6FCF9] to-white p-6 shadow-sm shadow-emerald-950/5">
          {/* Subtle ambient gradient orbs */}
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-teal-200/20 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-emerald-950 tracking-tight">Residents Management</h2>
              <p className="mt-1 text-sm font-medium text-emerald-800/80">Add, edit, search, and remove residents from Supabase.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search residents..."
                className="w-full rounded-2xl border border-emerald-200/80 bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 shadow-sm sm:w-80"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-emerald-200/80 bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 shadow-sm sm:w-48"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "" ? "All statuses" : status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#044E35] via-[#057A55] to-[#046C4E] hover:from-[#033E2B] hover:to-[#035438] px-5 py-2.5 text-sm font-bold text-white transition-all shadow-md shadow-emerald-900/20 active:scale-95"
              >
                New Resident
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700">
              Full name
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Portal Username
              <input
                name="email"
                type="text"
                value={form.email}
                readOnly
                placeholder="Generated by resident account SQL"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600 outline-none"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Mobile number
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="09171234567 or +639171234567"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              House no. login password
              <input
                name="house_no"
                value={form.house_no}
                onChange={handleChange}
                placeholder="123"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Age
              <input
                name="age"
                type="number"
                min="0"
                value={form.age}
                onChange={handleChange}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Gender
              <input
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Purok
              <select
                name="purok"
                value={form.purok}
                onChange={handleChange}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="">Select purok</option>
                {purokOptions.map((purok) => (
                  <option key={purok} value={purok}>
                    {formatPurok(purok)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Status
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option>Active</option>
                <option>Inactive</option>
                <option>Pending</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-3">
              Address
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-3 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <span className="inline-flex items-center rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {isEditing ? "Editing resident" : "Add a new resident"}
              </span>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-3xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {loading ? "Saving..." : isEditing ? "Update Resident" : "Add Resident"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Resident list</h3>
              <p className="text-sm text-slate-500">The table below is synced from your Supabase residents table.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
              {residents.length} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.24em]">Name</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.24em]">Username</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.24em]">Mobile</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.24em]">Age</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.24em]">Gender</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.24em]">Purok</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.24em]">Status</th>
                  <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.24em]">Address</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase tracking-[0.24em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-sm text-slate-500">
                      Loading residents...
                    </td>
                  </tr>
                ) : residents.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-sm text-slate-500">
                      No residents found. Use the form above to add one.
                    </td>
                  </tr>
                ) : (
                  residents.map((resident, index) => (
                    <tr key={getResidentKeyValue(resident) ?? `${index}-${resident.full_name}` } className="hover:bg-slate-50">
                      <td className="px-4 py-4 text-slate-900">{resident.full_name || resident.name}</td>
                      <td className="px-4 py-4 text-slate-900">
                        {resident.portal_username || resident.resident_account?.username || "-"}
                      </td>
                      <td className="px-4 py-4 text-slate-900">{resident.phone || "-"}</td>
                      <td className="px-4 py-4 text-slate-900">{resident.age ?? "—"}</td>
                      <td className="px-4 py-4 text-slate-900">{resident.gender || "—"}</td>
                      <td className="px-4 py-4 text-slate-900">{formatPurok(resident.purok, "—")}</td>
                      <td className="px-4 py-4 text-slate-900">{resident.status || "—"}</td>
                      <td className="px-4 py-4 text-slate-900">{resident.address || "—"}</td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleEdit(resident)}
                          className="mr-2 rounded-full border border-cyan-600 px-3 py-1 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(resident)}
                          className={`mr-2 rounded-full px-3 py-1 text-xs font-semibold transition ${
                            resident.status === "Archived"
                              ? "border border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border border-slate-400 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {resident.status === "Archived" ? "Restore" : "Archive"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(resident)}
                          className="rounded-full border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Residents;
