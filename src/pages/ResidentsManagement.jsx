import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Archive as ArchiveIcon,
  Ban,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Filter,
  Loader,
  Plus,
  RotateCcw,
  Save,
  Search,
  X,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import FloatingModal from "../components/FloatingModal";
import { useConfirm } from "../context/ConfirmContext";
import { DataGrid } from "@mui/x-data-grid";
import { getCurrentUserWithProfile } from "../services/authService";
import {
  archiveResident,
  createResident,
  createResidentPortalAccount,
  deleteResident,
  fetchResidents,
  restoreResident,
  updateResident,
  updateResidentPortalAccount,
} from "../services/adminService";
import {
  buildCompleteAddress,
  buildFullName,
  calculateAge,
  categoryFilterOptions,
  civilStatusOptions,
  educationalAttainmentOptions,
  getResidentAge,
  getResidentCategoryTags,
  getResidentDisplayName,
  formatPurok,
  householdRelationshipOptions,
  normalizePurokValue,
  purokOptions,
  residentMatchesCategory,
  sexOptions,
} from "../utils/residentProfile";

const initialForm = {
  last_name: "",
  first_name: "",
  middle_name: "",
  birthday: "",
  sex: "Male",
  birthplace: "",
  purok: "",
  educational_attainment: "",
  occupation: "",
  phone: "",
  email: "",
  is_4ps_member: false,
  is_solo_parent: false,
  civil_status: "Single",
  household_no: "",
  house_no: "",
  relationship_to_household_head: "Head",
  portal_username: "",
  portal_password: "",
  portal_account_status: "",
  address: "",
  is_pwd: false,
  pwd_type: "",
  status: "Active",
};

const statusFilters = [
  { value: "Active", label: "Active" },
  { value: "current", label: "All current" },
  { value: "Inactive", label: "Inactive" },
  { value: "Pending", label: "Pending" },
  { value: "Archived", label: "Archived" },
  { value: "", label: "All records" },
];

const residentStatuses = ["Active", "Inactive", "Pending", "Archived"];
const RESIDENTS_PAGE_SIZE = 50;

const residentFilterFields = [
  "full_name",
  "last_name",
  "first_name",
  "middle_name",
  "portal_username",
  "portal_account_status",
  "phone",
  "email",
  "house_no",
  "household_no",
  "relationship_to_household_head",
  "purok",
  "address",
  "sex",
  "gender",
  "birthplace",
  "educational_attainment",
  "occupation",
  "civil_status",
  "status",
];

const uniqueOptions = (values) =>
  [...new Set(values.filter(Boolean).map((value) => String(value).trim()))].sort((a, b) =>
    a.localeCompare(b)
  );

const formatDate = (dateValue) => {
  if (!dateValue) return "-";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const statusBadgeClass = (status) => {
  if (status === "Active") return "bg-emerald-100/80 text-emerald-700 border-emerald-200/60 shadow-sm";
  if (status === "Inactive") return "bg-slate-100/80 text-slate-700 border-slate-200/60 shadow-sm";
  if (status === "Archived") return "bg-rose-100/80 text-rose-700 border-rose-200/60 shadow-sm";
  return "bg-amber-100/80 text-amber-700 border-amber-200/60 shadow-sm";
};

const getPortalUsername = (resident) =>
  resident?.portal_username || resident?.resident_account?.username || "";

const getPortalAccountStatus = (resident) =>
  resident?.portal_account_status || resident?.resident_account?.account_status || "";

const categoryBadgeClass = (category) => {
  if (category === "Senior Citizen") return "bg-violet-100/80 text-violet-700 border-violet-200/60 shadow-sm";
  if (category === "Youth") return "bg-cyan-100/80 text-cyan-700 border-cyan-200/60 shadow-sm";
  if (category === "Child") return "bg-amber-100/80 text-amber-700 border-amber-200/60 shadow-sm";
  if (category === "4Ps") return "bg-emerald-100/80 text-emerald-700 border-emerald-200/60 shadow-sm";
  if (category === "Solo Parent") return "bg-fuchsia-100/80 text-fuchsia-700 border-fuchsia-200/60 shadow-sm";
  if (category === "PWD/PWED") return "bg-blue-100/80 text-blue-700 border-blue-200/60 shadow-sm";
  return "bg-slate-100/80 text-slate-700 border-slate-200/60 shadow-sm";
};

const getResidentFormValues = (resident) => {
  if (!resident) return { ...initialForm };

  const username = resident.portal_username || resident.resident_account?.username || "";
  const isDefaultCredentialsAccount = Boolean(
    resident.portal_must_change_credentials ?? resident.resident_account?.must_change_credentials
  );
  const password =
    resident.portal_password ||
    resident.resident_account?.plain_password ||
    (isDefaultCredentialsAccount ? (resident.household_no || resident.house_no || "") : "");

  return {
    last_name: resident.last_name || "",
    first_name: resident.first_name || "",
    middle_name: resident.middle_name || "",
    birthday: resident.birthday || "",
    sex: resident.sex || resident.gender || "Male",
    birthplace: resident.birthplace || "",
    purok: resident.purok || "",
    educational_attainment: resident.educational_attainment || "",
    occupation: resident.occupation || "",
    phone: resident.phone || "",
    email: resident.email || "",
    is_4ps_member: Boolean(resident.is_4ps_member),
    is_solo_parent: Boolean(resident.is_solo_parent),
    civil_status: resident.civil_status || "Single",
    household_no: resident.household_no || "",
    house_no: resident.house_no || "",
    relationship_to_household_head: resident.relationship_to_household_head || "Head",
    portal_username: username,
    portal_password: password,
    portal_account_status: getPortalAccountStatus(resident),
    resident_account: resident.resident_account || null,
    address: resident.address || "",
    is_pwd: Boolean(resident.is_pwd),
    pwd_type: resident.pwd_type || "",
    status: resident.status || "Active",
  };
};

const buildResidentPayload = (formData) => {
  const age = calculateAge(formData.birthday);
  const fullName = buildFullName(formData);
  const phone = formData.phone.trim();
  // Auto-derive complete address from purok selection
  const derivedAddress = buildCompleteAddress(formData.purok);
  // Prevent duplicate address concatenation if the address already contains the derivedAddress
  const finalAddress = formData.address && formData.address.includes(derivedAddress)
    ? formData.address
    : derivedAddress;

  if (!formData.last_name.trim() || !formData.first_name.trim()) {
    throw new Error("First name and last name are required.");
  }

  if (!formData.birthday || age === null) {
    throw new Error("Birthday is required and must produce a valid age from 0 to 130.");
  }

  if (!formData.sex || !formData.birthplace.trim() || !formData.purok.trim()) {
    throw new Error("Sex, birthplace, and purok are required.");
  }

  if (!formData.household_no.trim() || !formData.relationship_to_household_head) {
    throw new Error("Household number and family relationship are required.");
  }

  if (!formData.civil_status) {
    throw new Error("Civil status is required.");
  }

  return {
    last_name: formData.last_name.trim(),
    first_name: formData.first_name.trim(),
    middle_name: formData.middle_name.trim() || null,
    full_name: fullName,
    birthday: formData.birthday,
    age,
    sex: formData.sex,
    gender: formData.sex,
    birthplace: formData.birthplace.trim(),
    purok: formData.purok.trim(),
    educational_attainment: formData.educational_attainment.trim() || null,
    occupation: formData.occupation.trim() || null,
    phone: phone || null,
    is_4ps_member: Boolean(formData.is_4ps_member),
    is_solo_parent: Boolean(formData.is_solo_parent),
    civil_status: formData.civil_status,
    household_no: formData.household_no.trim(),
    relationship_to_household_head: formData.relationship_to_household_head,
    email: formData.email?.trim() || null,
    house_no: formData.house_no?.trim() || null,
    address: finalAddress || null,
    is_pwd: Boolean(formData.is_pwd),
    pwd_type: formData.is_pwd ? formData.pwd_type.trim() || null : null,
    status: formData.status,
  };
};

const renderOptionList = (options) =>
  options.map((option) => (
    <option key={option} value={option}>
      {option}
    </option>
  ));

const renderPurokOptionList = () =>
  purokOptions.map((purok) => (
    <option key={purok} value={purok}>
      {formatPurok(purok)}
    </option>
  ));

const ResidentForm = memo(function ResidentForm({
  initialValues = initialForm,
  mode,
  onCancel,
  onSubmit,
  saving,
}) {
  const [formData, setFormData] = useState(initialValues);
  const [isUsernameEdited, setIsUsernameEdited] = useState(
    Boolean(initialValues.resident_account || (initialValues.portal_username && mode === "edit"))
  );
  const [isPasswordEdited, setIsPasswordEdited] = useState(
    Boolean(initialValues.resident_account || (initialValues.portal_password && mode === "edit"))
  );

  const derivedAge = useMemo(() => calculateAge(formData.birthday), [formData.birthday]);
  const derivedPreviewTags = useMemo(
    () =>
      getResidentCategoryTags({
        birthday: formData.birthday,
        age: derivedAge,
        is_4ps_member: formData.is_4ps_member,
        is_solo_parent: formData.is_solo_parent,
        is_pwd: formData.is_pwd,
      }),
    [
      derivedAge,
      formData.birthday,
      formData.is_4ps_member,
      formData.is_pwd,
      formData.is_solo_parent,
    ]
  );

  const handleInputChange = useCallback((event) => {
    const { checked, name, type, value } = event.target;

    if (name === "portal_username") {
      setIsUsernameEdited(true);
    }
    if (name === "portal_password") {
      setIsPasswordEdited(true);
    }

    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
        ...(name === "is_pwd" && !checked ? { pwd_type: "" } : {}),
      };

      // Auto-generate username and password suggestions if resident doesn't have an account yet
      if (!prev.resident_account && mode !== "edit") {
        if ((name === "first_name" || name === "last_name") && !isUsernameEdited) {
          const fName = name === "first_name" ? value : prev.first_name || "";
          const lName = name === "last_name" ? value : prev.last_name || "";

          // Generate username: first_last in lowercase, alphanumeric and underscores only
          const generatedUsername = `${fName}_${lName}`
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "");

          next.portal_username = generatedUsername;
        }

        if (name === "household_no" && !isPasswordEdited) {
          next.portal_password = value.trim();
        }
      }

      return next;
    });
  }, [isUsernameEdited, isPasswordEdited, mode]);

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();

      if (saving) return;
      onSubmit(formData);
    },
    [formData, onSubmit, saving]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
          Personal Information
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-semibold text-slate-700">
            Last Name *
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            First Name *
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Middle Name
            <input
              type="text"
              name="middle_name"
              value={formData.middle_name}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <label className="block text-sm font-semibold text-slate-700">
            Birthday *
            <input
              type="date"
              name="birthday"
              value={formData.birthday}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Age
            <input
              value={derivedAge ?? ""}
              readOnly
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600 outline-none"
              placeholder="Auto"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Sex *
            <select
              name="sex"
              value={formData.sex}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              {renderOptionList(sexOptions)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Civil Status *
            <select
              name="civil_status"
              value={formData.civil_status}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              {renderOptionList(civilStatusOptions)}
            </select>
          </label>
        </div>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Birthplace *
          <input
            type="text"
            name="birthplace"
            value={formData.birthplace}
            onChange={handleInputChange}
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            placeholder="Municipality, Province"
          />
        </label>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
          Household and Location
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <label className="block text-sm font-semibold text-slate-700">
            Household No. *
            <input
              type="text"
              name="household_no"
              value={formData.household_no}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="HH-001"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            House No. <span className="text-slate-400 font-normal">(optional)</span>
            <input
              type="text"
              name="house_no"
              value={formData.house_no || ""}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="e.g. 123"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Family Relationship *
            <select
              name="relationship_to_household_head"
              value={formData.relationship_to_household_head}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              {renderOptionList(householdRelationshipOptions)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Purok *
            <select
              name="purok"
              value={formData.purok}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Select purok</option>
              {renderPurokOptionList()}
            </select>
          </label>
        </div>

        {formData.purok && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Auto-generated Address</p>
            <p className="mt-1 text-sm font-medium text-emerald-800">{buildCompleteAddress(formData.purok)}</p>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Address Notes <span className="text-slate-400 font-normal">(optional)</span>
            <input
              type="text"
              name="address"
              value={formData.address || ""}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="Sitio, street, landmark, or household notes"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Gmail Account <span className="text-slate-400 font-normal">(optional)</span>
            <input
              type="email"
              name="email"
              value={formData.email || ""}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="example@gmail.com"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
          Profile Details
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Educational Attainment
            <select
              name="educational_attainment"
              value={formData.educational_attainment}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Not specified</option>
              {renderOptionList(educationalAttainmentOptions)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Occupation
            <input
              type="text"
              name="occupation"
              value={formData.occupation}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="Farmer, student, vendor, unemployed, etc."
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="is_4ps_member"
              checked={formData.is_4ps_member}
              onChange={handleInputChange}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            4Ps Member
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="is_solo_parent"
              checked={formData.is_solo_parent}
              onChange={handleInputChange}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Solo Parent
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="is_pwd"
              checked={formData.is_pwd}
              onChange={handleInputChange}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            PWD/PWED
          </label>
        </div>

        {formData.is_pwd ? (
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            PWD/PWED Type
            <input
              type="text"
              name="pwd_type"
              value={formData.pwd_type}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="Visual, physical, hearing, psychosocial, etc."
            />
          </label>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {(derivedPreviewTags.length ? derivedPreviewTags : ["Unclassified"]).map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${categoryBadgeClass(tag)}`}
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
          Contact and Portal
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-semibold text-slate-700">
            Phone Number
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="09171234567"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Portal Username
            <input
              type="text"
              name="portal_username"
              value={formData.portal_username || ""}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="e.g. juan_dela_cruz"
            />
            {formData.portal_account_status && (
              <span className="mt-1 block text-xs font-medium text-slate-500">
                Account: {formData.portal_account_status}
              </span>
            )}
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Password
            <input
              type="text"
              name="portal_password"
              value={formData.portal_password || ""}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder={formData.household_no ? `e.g. ${formData.household_no}` : "e.g. 85 or HH-001"}
            />
            <span className="mt-1 block text-xs font-medium text-slate-500">
              {formData.resident_account
                ? "Leave blank to keep current password. Fill in to reset it."
                : "Resident's login password. Defaults to household number if blank."}
            </span>
          </label>
        </div>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Record Status
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            {renderOptionList(residentStatuses)}
          </select>
        </label>
      </section>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#1b4332] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#112a1f] shadow-sm disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {saving ? <Loader size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? "Saving..." : mode === "create" ? "Create Resident" : "Update Resident"}
        </button>
      </div>
    </form>
  );
});

const ResidentsManagement = () => {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [authorized, setAuthorized] = useState(false);
  const [residents, setResidents] = useState([]);
  const [pendingResidents, setPendingResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const delayedLoading = loading;

  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [actionResidentId, setActionResidentId] = useState(null);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [sexFilter, setSexFilter] = useState("");
  const [purokFilter, setPurokFilter] = useState("");
  const [householdFilter, setHouseholdFilter] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [residentPage, setResidentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingResident, setEditingResident] = useState(null);

  const loadResidents = useCallback(async () => {
    setLoading(true);

    try {
      const queryStatus = statusFilter === "current" ? "" : statusFilter;
      const [residentData, pendingData] = await Promise.all([
        fetchResidents("", queryStatus, {
          excludeArchived: statusFilter === "current",
          sex: sexFilter,
          purok: purokFilter,
          householdNo: householdFilter,
          householdRelationship: relationshipFilter,
        }),
        fetchResidents("", "Pending"),
      ]);

      setResidents(residentData);
      setPendingResidents(pendingData);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to load residents." });
    } finally {
      setLoading(false);
    }
  }, [householdFilter, purokFilter, relationshipFilter, sexFilter, statusFilter]);


  useEffect(() => {
    let isMounted = true;

    const checkAccess = async () => {
      try {
        const userData = await getCurrentUserWithProfile();
        if (!isMounted) return;

        if (!userData || userData.profile?.role !== "admin") {
          navigate("/");
          return;
        }

        setAuthorized(true);
      } catch (err) {
        if (isMounted) {
          setMessage({ type: "error", text: err.message || "Unable to verify admin access." });
          setLoading(false);
        }
      }
    };

    checkAccess();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (authorized) {
      const run = async () => {
        await loadResidents();
      };

      run();
    }
  }, [authorized, loadResidents]);

  const optionSource = useMemo(
    () => [...residents, ...pendingResidents],
    [pendingResidents, residents]
  );

  const householdOptions = useMemo(
    () => uniqueOptions(optionSource.map((resident) => resident.household_no || "")),
    [optionSource]
  );

  const relationshipOptions = useMemo(
    () =>
      uniqueOptions([
        ...householdRelationshipOptions,
        ...optionSource.map((resident) => resident.relationship_to_household_head || ""),
      ]),
    [optionSource]
  );

  const editingFormValues = useMemo(
    () => getResidentFormValues(editingResident),
    [editingResident]
  );

  const matchesCurrentResidentFilters = useCallback(
    (resident) => {
      const status = resident.status || "";
      const term = searchTerm.trim().toLowerCase();

      if (statusFilter === "current" && status === "Archived") return false;
      if (statusFilter && statusFilter !== "current" && status !== statusFilter) return false;
      if (sexFilter && (resident.sex || resident.gender || "") !== sexFilter) return false;
      if (purokFilter && normalizePurokValue(resident.purok) !== purokFilter) return false;
      if (householdFilter && resident.household_no !== householdFilter) return false;
      if (
        relationshipFilter &&
        resident.relationship_to_household_head !== relationshipFilter
      ) {
        return false;
      }

      if (!term) return true;

      return residentFilterFields.some((field) =>
        String(resident[field] || "").toLowerCase().includes(term)
      );
    },
    [householdFilter, purokFilter, relationshipFilter, searchTerm, sexFilter, statusFilter]
  );

  const displayedResidents = useMemo(
    () =>
      residents.filter(
        (resident) =>
          matchesCurrentResidentFilters(resident) &&
          residentMatchesCategory(resident, categoryFilter)
      ),
    [categoryFilter, matchesCurrentResidentFilters, residents]
  );
  const totalResidentPages = Math.max(
    1,
    Math.ceil(displayedResidents.length / RESIDENTS_PAGE_SIZE)
  );
  const safeResidentPage = Math.min(residentPage, totalResidentPages);
  const residentPageStartIndex = (safeResidentPage - 1) * RESIDENTS_PAGE_SIZE;
  const paginatedResidents = useMemo(
    () =>
      displayedResidents.slice(
        residentPageStartIndex,
        residentPageStartIndex + RESIDENTS_PAGE_SIZE
      ),
    [displayedResidents, residentPageStartIndex]
  );
  const visibleResidentStart =
    displayedResidents.length === 0 ? 0 : residentPageStartIndex + 1;
  const visibleResidentEnd = Math.min(
    residentPageStartIndex + paginatedResidents.length,
    displayedResidents.length
  );

  const upsertResidentInCurrentList = useCallback(
    (resident) => {
      setResidents((currentResidents) => {
        const withoutResident = currentResidents.filter((item) => item.id !== resident.id);

        if (!matchesCurrentResidentFilters(resident)) {
          return withoutResident;
        }

        const previousIndex = currentResidents.findIndex((item) => item.id === resident.id);
        if (previousIndex === -1) {
          return [resident, ...withoutResident];
        }

        const nextResidents = [...currentResidents];
        nextResidents[previousIndex] = resident;
        return nextResidents.filter((item) => matchesCurrentResidentFilters(item));
      });
    },
    [matchesCurrentResidentFilters]
  );

  const syncPendingResidentList = useCallback((resident) => {
    setPendingResidents((currentPendingResidents) => {
      const withoutResident = currentPendingResidents.filter((item) => item.id !== resident.id);

      if (resident.status === "Pending") {
        return [resident, ...withoutResident];
      }

      return withoutResident;
    });
  }, []);

  const resetForm = () => {
    setEditingResident(null);
  };

  const openCreateModal = () => {
    resetForm();
    setMessage(null);
    setShowCreateModal(true);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    resetForm();
  };

  const handleCreateResident = async (formValues) => {
    const ok = await confirm({
      title: "Create New Resident",
      message: "Are you sure you want to save this resident's information?",
      confirmText: "Save",
      cancelText: "Cancel",
      variant: "emerald",
      icon: Save,
    });
    if (!ok) return;

    setSaving(true);
    setMessage(null);

    try {
      const payload = buildResidentPayload(formValues);
      const savedResident = await createResident(payload);
      const savedStatus = savedResident.status || payload.status || "Active";

      // If admin provided a username and password, create the portal account
      const portalUsername = (formValues.portal_username || "").trim();
      let portalPassword = (formValues.portal_password || "").trim();
      if (portalUsername && !portalPassword) {
        portalPassword = (formValues.household_no || "").trim();
      }
      let portalMessage = "";

      if (portalUsername && portalPassword && savedResident.id) {
        try {
          await createResidentPortalAccount(savedResident.id, portalUsername, portalPassword);
          savedResident.portal_username = portalUsername.toLowerCase();
          savedResident.portal_password = portalPassword;
          savedResident.resident_account = { username: portalUsername.toLowerCase(), account_status: "Active" };
          portalMessage = ` Portal account created with username "${portalUsername.toLowerCase()}".`;
        } catch (portalErr) {
          portalMessage = ` Warning: Resident saved but portal account failed: ${portalErr.message}`;
        }
      }

      setMessage({
        type: "success",
        text: `${getResidentDisplayName(savedResident)} was added and saved to Supabase.${portalMessage}`,
      });
      closeModals();
      upsertResidentInCurrentList(savedResident);
      syncPendingResidentList(savedResident);
      setResidentPage(1);

      if (statusFilter && statusFilter !== "current" && statusFilter !== savedStatus) {
        setStatusFilter(savedStatus);
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to create resident." });
    } finally {
      setSaving(false);
    }
  };

  const handleEditResident = (resident) => {
    setEditingResident(resident);
    setMessage(null);
    setShowEditModal(true);
  };

  const handleUpdateResident = async (formValues) => {
    if (!editingResident?.id) return;

    const ok = await confirm({
      title: "Save Changes",
      message: "Are you sure you want to save the changes you made?",
      confirmText: "Save Changes",
      cancelText: "Cancel",
      variant: "emerald",
      icon: Save,
    });
    if (!ok) return;

    setSaving(true);
    setMessage(null);

    try {
      const savedResident = await updateResident(editingResident, buildResidentPayload(formValues));

      // Create or update the portal account whenever admin provides credentials
      const portalUsername = (formValues.portal_username || "").trim();
      const portalPassword = (formValues.portal_password || "").trim();
      let portalMessage = "";

      if (portalUsername) {
        try {
          const result = await updateResidentPortalAccount(editingResident.id, portalUsername, portalPassword);
          savedResident.portal_username = portalUsername.toLowerCase();
          if (portalPassword) {
            savedResident.portal_password = portalPassword;
          } else if (editingResident.portal_password) {
            savedResident.portal_password = editingResident.portal_password;
          }
          savedResident.resident_account = {
            ...(editingResident.resident_account || {}),
            username: portalUsername.toLowerCase(),
            account_status: "Active",
          };
          portalMessage = result?.action === "updated"
            ? ` Portal credentials updated for "${portalUsername.toLowerCase()}".`
            : ` Portal account created with username "${portalUsername.toLowerCase()}".`;
        } catch (portalErr) {
          portalMessage = ` Warning: Resident updated but portal account failed: ${portalErr.message}`;
        }
      }

      setMessage({ type: "success", text: `Resident updated successfully.${portalMessage}` });
      closeModals();
      upsertResidentInCurrentList(savedResident);
      syncPendingResidentList(savedResident);
      setResidentPage(1);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to update resident." });
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveResident = async (resident) => {
    const ok = await confirm({
      title: "Archive Record",
      message: "Are you sure you want to archive this record? You can restore it later from the Archive section.",
      confirmText: "Archive",
      cancelText: "Cancel",
      variant: "danger",
      icon: ArchiveIcon,
    });
    if (!ok) return;

    setActionResidentId(resident.id);
    setMessage(null);

    try {
      await archiveResident(resident);
      setMessage({
        type: "success",
        text: "Resident archived. It is now available in Archive Management.",
      });
      await loadResidents();
      setResidentPage(1);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to archive resident." });
    } finally {
      setActionResidentId(null);
    }
  };

  const handleRestoreResident = async (resident) => {
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
      await loadResidents();
      setResidentPage(1);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to restore resident." });
    } finally {
      setActionResidentId(null);
    }
  };

  const handleApproveResident = async (resident) => {
    const ok = await confirm({
      title: "Approve Registration",
      message: "Are you sure you want to approve this resident registration?",
      confirmText: "Approve",
      cancelText: "Cancel",
      variant: "emerald",
      icon: CheckCircle,
    });
    if (!ok) return;

    setApprovingId(resident.id);
    setMessage(null);

    try {
      await updateResident(resident, { status: "Active" });
      setMessage({ type: "success", text: "Resident approved successfully." });
      await loadResidents();
      setResidentPage(1);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to approve resident." });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectResident = async (resident) => {
    if (!window.confirm("Reject this pending registration?")) return;

    setRejectingId(resident.id);
    setMessage(null);

    try {
      await deleteResident(resident);
      setMessage({ type: "success", text: "Resident registration rejected." });
      await loadResidents();
      setResidentPage(1);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to reject resident." });
    } finally {
      setRejectingId(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("Active");
    setSexFilter("");
    setPurokFilter("");
    setHouseholdFilter("");
    setRelationshipFilter("");
    setCategoryFilter("");
    setResidentPage(1);
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
            <p className="font-semibold text-slate-900">{getResidentDisplayName(resident)}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Born {resident.birthday ? new Date(resident.birthday).toLocaleDateString() : "-"} in {resident.birthplace || "-"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{resident.address || "-"}</p>
          </div>
        );
      }
    },
    {
      field: "household_no",
      headerName: "Household",
      flex: 1.2,
      renderCell: (params) => {
        const resident = params.row;
        return (
          <div className="py-2 leading-tight">
            <p className="font-medium text-slate-700">{resident.household_no || "-"}</p>
            <p className="text-xs text-slate-500 mt-0.5">{resident.relationship_to_household_head || "-"}</p>
            <p className="text-xs text-slate-400 mt-0.5">{formatPurok(resident.purok)}</p>
          </div>
        );
      }
    },
    {
      field: "age",
      headerName: "Demographics",
      flex: 1.2,
      renderCell: (params) => {
        const resident = params.row;
        const tags = getResidentCategoryTags(resident);
        return (
          <div className="py-2 leading-tight">
            <p className="font-medium text-slate-700">
              {getResidentAge(resident) ?? "-"} / {resident.sex || resident.gender || "-"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{resident.civil_status || "-"}</p>
            <div className="mt-1 flex flex-wrap gap-1 max-w-[200px]">
              {(tags.length ? tags : ["Unclassified"]).map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${categoryBadgeClass(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        );
      }
    },
    {
      field: "educational_attainment",
      headerName: "Profile",
      flex: 1.2,
      renderCell: (params) => {
        const resident = params.row;
        return (
          <div className="py-2 leading-tight">
            <p className="font-medium text-slate-700">{resident.educational_attainment || "-"}</p>
            <p className="text-xs text-slate-500 mt-0.5">{resident.occupation || "-"}</p>
          </div>
        );
      }
    },
    {
      field: "phone",
      headerName: "Contact / Portal",
      flex: 1.2,
      renderCell: (params) => {
        const resident = params.row;
        return (
          <div className="py-2 leading-tight">
            <p className="font-medium text-slate-700">{resident.phone || "-"}</p>
            {resident.email && (
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[150px]" title={resident.email}>
                {resident.email}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">Account: {getPortalAccountStatus(resident) || "-"}</p>
          </div>
        );
      }
    },
    {
      field: "status",
      headerName: "Status",
      flex: 0.8,
      renderCell: (params) => {
        const resident = params.row;
        return (
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusBadgeClass(resident.status)}`}>
            {resident.status || "-"}
          </span>
        );
      }
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
              onClick={() => handleEditResident(resident)}
              className="gov-action-btn edit"
              title="Edit resident"
            >
              <Edit2 size={16} />
            </button>
            {resident.status === "Archived" ? (
              <button
                type="button"
                onClick={() => handleRestoreResident(resident)}
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
            ) : (
              <button
                type="button"
                onClick={() => handleArchiveResident(resident)}
                disabled={actionResidentId === resident.id}
                className="gov-action-btn delete"
                title="Archive resident"
              >
                {actionResidentId === resident.id ? (
                  <Loader size={16} className="animate-spin" />
                ) : (
                  <ArchiveIcon size={16} />
                )}
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <>
      <PageWrapper
        title="Resident Management"
        description="Add, update, filter, and archive resident records"
      >
        {message ? (
          <div
            className={`glass-panel mb-6 flex items-start gap-3 p-4 text-sm font-semibold shadow-soft ${message.type === "success"
                ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/50"
                : "bg-rose-50/80 text-rose-700 border-rose-200/50"
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

        {pendingResidents.length > 0 ? (
          <section className="glass-panel mb-6 bg-gradient-to-br from-amber-50/60 to-orange-50/60 p-6 border-amber-200/40">
            <div className="mb-4 flex items-center gap-3">
              <AlertCircle className="text-amber-600" size={22} />
              <h2 className="text-lg font-semibold text-amber-900">
                Pending Registrations ({pendingResidents.length})
              </h2>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {pendingResidents.map((pending) => (
                <div
                  key={pending.id}
                  className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-slate-900">{getResidentDisplayName(pending)}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Household {pending.household_no || "-"} | {pending.relationship_to_household_head || "-"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatPurok(pending.purok)} | {pending.phone || getPortalUsername(pending) || "-"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApproveResident(pending)}
                      disabled={approvingId === pending.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {approvingId === pending.id ? (
                        <Loader size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectResident(pending)}
                      disabled={rejectingId === pending.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                    >
                      {rejectingId === pending.id ? (
                        <Loader size={16} className="animate-spin" />
                      ) : (
                        <Ban size={16} />
                      )}
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4 border-b border-slate-100 pb-4">
            <div className="text-xs font-semibold text-slate-400 text-left">
              Showing {displayedResidents.length} of {residents.length} total resident record{residents.length === 1 ? "" : "s"}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openCreateModal}
                className="strict-button-hover inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#14532D] hover:bg-[#0f3e21] px-4 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                Add Resident
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <div className="relative min-w-0 sm:col-span-2 xl:col-span-1 2xl:col-span-2">
              <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setResidentPage(1);
                }}
                placeholder="Search name, username, household, occupation..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/20"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setResidentPage(1);
              }}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/20"
            >
              {statusFilters.map((status) => (
                <option key={status.label} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <select
              value={sexFilter}
              onChange={(event) => {
                setSexFilter(event.target.value);
                setResidentPage(1);
              }}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/20"
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
              onChange={(event) => {
                setPurokFilter(event.target.value);
                setResidentPage(1);
              }}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/20"
            >
              <option value="">All puroks</option>
              {purokOptions.map((purok) => (
                <option key={purok} value={purok}>
                  {formatPurok(purok)}
                </option>
              ))}
            </select>

            <select
              value={householdFilter}
              onChange={(event) => {
                setHouseholdFilter(event.target.value);
                setResidentPage(1);
              }}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/20"
            >
              <option value="">All households</option>
              {householdOptions.map((household) => (
                <option key={household} value={household}>
                  {household}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,240px)_auto]">
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setResidentPage(1);
              }}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/20"
            >
              {categoryFilterOptions.map((category) => (
                <option key={category.value || "all"} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95 sm:w-auto sm:justify-self-start"
            >
              <Filter size={16} />
              Reset Filters
            </button>
          </div>
        </section>

        <div className="gov-datagrid-container overflow-hidden mt-6" style={{ height: 650, width: '100%' }}>
          <DataGrid
            rows={displayedResidents}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 },
              },
            }}
            pageSizeOptions={[10, 25, 50]}
            disableRowSelectionOnClick
            loading={delayedLoading}
            rowHeight={85}
            getRowId={(row) => row.id}
          />
        </div>
      </PageWrapper>

      <FloatingModal
        open={showCreateModal}
        onClose={closeModals}
        title="Add Resident"
        eyebrow="Resident Profile"
        maxWidth="max-w-4xl"
      >
        <ResidentForm
          key="create-resident"
          mode="create"
          onCancel={closeModals}
          onSubmit={handleCreateResident}
          saving={saving}
        />
      </FloatingModal>

      <FloatingModal
        open={showEditModal && !!editingResident}
        onClose={closeModals}
        title="Edit Resident"
        eyebrow="Resident Profile"
        maxWidth="max-w-4xl"
      >
        {editingResident && (
          <ResidentForm
            key={editingResident.id}
            initialValues={editingFormValues}
            mode="edit"
            onCancel={closeModals}
            onSubmit={handleUpdateResident}
            saving={saving}
          />
        )}
      </FloatingModal>
    </>
  );
};

export default ResidentsManagement;
