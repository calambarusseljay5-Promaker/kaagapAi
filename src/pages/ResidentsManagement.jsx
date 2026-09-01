import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Archive as ArchiveIcon,
  ArrowLeft,
  Ban,
  Briefcase,
  Calendar,
  Check,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Heart,
  Home,
  Layers,
  Loader,
  Lock,
  MapPin,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import FloatingModal from "../components/FloatingModal";
import { useConfirm } from "../context/ConfirmContext";
import { showAdminSystemToast } from "../utils/toast";
import { supabase } from "../lib/supabaseClient";
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
  fetchOrganizationOfficials,
  getOrganizationOfficials,
  getActiveCaptain,
  getActiveSecretary,
} from "../services/organizationService";
import {
  addCustomPurok,
  buildCompleteAddress,
  buildFullName,
  calculateAge,
  categoryFilterOptions,
  civilStatusOptions,
  defaultPurokDefinitions,
  deleteCustomPurok,
  educationalAttainmentOptions,
  formatPurok,
  getCustomPurokDefinitions,
  getPurokOptions,
  getResidentAge,
  getResidentCategoryTags,
  getResidentDisplayName,
  householdRelationshipOptions,
  normalizePurokValue,
  purokOptions,
  resetCustomPuroks,
  residentMatchesCategory,
  saveCustomPurokDefinitions,
  sexOptions,
  standardOccupationOptions,
  updateCustomPurok,
} from "../utils/residentProfile";

const initialForm = {
  last_name: "",
  first_name: "",
  middle_name: "",
  suffix: "",
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
  { value: "current", label: "All current (Excl. Archived)" },
  { value: "Inactive", label: "Inactive" },
  { value: "Pending", label: "Pending" },
  { value: "Archived", label: "Archived" },
  { value: "", label: "All records" },
];

const residentStatuses = ["Active", "Inactive", "Pending", "Archived"];
const RESIDENTS_PAGE_SIZE = 50;

const buildResidentPayload = (formData) => {
  const age = calculateAge(formData.birthday);
  const fullName = buildFullName(formData);
  const phone = (formData.phone || "").trim().replace(/\D/g, "");

  if (phone && phone.length !== 11) {
    throw new Error("Phone number must be exactly 11 digits (e.g. 09171234567).");
  }

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
    suffix: formData.suffix?.trim() || null,
    full_name: fullName,
    birthday: formData.birthday,
    age,
    sex: formData.sex,
    gender: formData.sex,
    birthplace: formData.birthplace.trim(),
    purok: formData.purok.trim(),
    educational_attainment: formData.educational_attainment?.trim() || null,
    occupation: formData.occupation?.trim() || null,
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

const getPortalUsername = (resident) => {
  if (!resident) return "-";
  let username =
    resident.portal_username ||
    resident.resident_account?.username ||
    resident.username ||
    (resident.email ? resident.email.split("@")[0] : "") ||
    resident.phone ||
    "";

  if (typeof username === "string" && username.includes("@")) {
    username = username.split("@")[0];
  }

  username = String(username || "").trim().toLowerCase();
  return username || "-";
};

const getResidentPortalPassword = (resident) => {
  if (!resident) return "";
  return (
    resident.portal_password ||
    resident.plain_password ||
    resident.resident_account?.plain_password ||
    (Array.isArray(resident.resident_accounts) && resident.resident_accounts[0]?.plain_password) ||
    resident.password ||
    ""
  );
};

const getPortalAccountStatus = (resident) =>
  resident?.portal_account_status || resident?.resident_account?.account_status || "Active";

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

  let rawUsername =
    resident.portal_username ||
    resident.resident_account?.username ||
    resident.username ||
    (resident.email ? resident.email.split("@")[0] : "") ||
    resident.phone ||
    "";

  if (typeof rawUsername === "string" && rawUsername.includes("@")) {
    rawUsername = rawUsername.split("@")[0];
  }

  rawUsername = String(rawUsername || "").trim().toLowerCase();
  const rawPassword = getResidentPortalPassword(resident);

  return {
    last_name: resident.last_name || "",
    first_name: resident.first_name || "",
    middle_name: resident.middle_name || "",
    suffix: resident.suffix || "",
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
    portal_username: rawUsername,
    portal_password: rawPassword,
    portal_account_status: getPortalAccountStatus(resident),
    resident_account: resident.resident_account || null,
    address: resident.address || "",
    is_pwd: Boolean(resident.is_pwd),
    pwd_type: resident.pwd_type || "",
    status: resident.status || "Active",
  };
};

const renderOptionList = (options) =>
  options.map((option) => (
    <option key={option} value={option}>
      {option}
    </option>
  ));

const renderPurokOptionList = () =>
  getCustomPurokDefinitions().map((purok) => (
    <option key={purok.value} value={purok.value}>
      {purok.label || formatPurok(purok.value)}
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
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [isUsernameEdited, setIsUsernameEdited] = useState(
    Boolean(initialValues.resident_account || (initialValues.portal_username && mode === "edit"))
  );
  const [isPasswordEdited, setIsPasswordEdited] = useState(
    Boolean(initialValues.resident_account || (initialValues.portal_password && mode === "edit"))
  );

  const isKnownOccupation =
    Boolean(formData.occupation) &&
    standardOccupationOptions.includes(formData.occupation) &&
    formData.occupation !== "Others (Please Specify)";

  const [isCustomOccupation, setIsCustomOccupation] = useState(!isKnownOccupation && Boolean(formData.occupation));
  const [customOccupationInput, setCustomOccupationInput] = useState(
    !isKnownOccupation && Boolean(formData.occupation) ? formData.occupation : ""
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
    const { checked, name, type } = event.target;
    let value = event.target.value;

    if (name === "phone") {
      value = value.replace(/\D/g, "").slice(0, 11);
    }
    if (name === "portal_username") {
      value = value.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
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
      <section className="rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/40 via-white to-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-900/80">
          Personal Information
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <label className="block text-sm font-bold text-slate-800">
            First Name *
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
            />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Middle Name
            <input
              type="text"
              name="middle_name"
              value={formData.middle_name}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
            />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Last Name *
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
            />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Suffix <span className="text-slate-400 font-normal">(optional)</span>
            <input
              type="text"
              name="suffix"
              value={formData.suffix || ""}
              onChange={handleInputChange}
              placeholder="e.g. Jr., III"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <label className="block text-sm font-bold text-slate-800">
            Birthday *
            <input
              type="date"
              name="birthday"
              value={formData.birthday}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
            />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Age
            <input
              value={derivedAge ?? ""}
              readOnly
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-bold text-slate-700 outline-none"
              placeholder="Auto"
            />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Sex *
            <select
              name="sex"
              value={formData.sex}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs cursor-pointer"
            >
              {renderOptionList(sexOptions)}
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Civil Status *
            <select
              name="civil_status"
              value={formData.civil_status}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs cursor-pointer"
            >
              {renderOptionList(civilStatusOptions)}
            </select>
          </label>
        </div>

        <label className="mt-4 block text-sm font-bold text-slate-800">
          Birthplace *
          <input
            type="text"
            name="birthplace"
            value={formData.birthplace}
            onChange={handleInputChange}
            required
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
            placeholder="Municipality, Province"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/40 via-white to-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-900/80">
          Household and Location
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <label className="block text-sm font-bold text-slate-800">
            Household No. *
            <input
              type="text"
              name="household_no"
              value={formData.household_no}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-mono"
              placeholder="HH-001"
            />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            House No. <span className="text-slate-400 font-normal">(optional)</span>
            <input
              type="text"
              name="house_no"
              value={formData.house_no || ""}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
              placeholder="e.g. 123"
            />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Family Relationship *
            <select
              name="relationship_to_household_head"
              value={formData.relationship_to_household_head}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs cursor-pointer"
            >
              {renderOptionList(householdRelationshipOptions)}
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Purok *
            <select
              name="purok"
              value={formData.purok}
              onChange={handleInputChange}
              required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs cursor-pointer"
            >
              <option value="">Select purok</option>
              {renderPurokOptionList()}
            </select>
          </label>
        </div>

        {formData.purok && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Auto-generated Address</p>
            <p className="mt-1 text-sm font-extrabold text-emerald-950">{buildCompleteAddress(formData.purok)}</p>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-slate-800">
            Address Notes <span className="text-slate-400 font-normal">(optional)</span>
            <input
              type="text"
              name="address"
              value={formData.address || ""}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
              placeholder="Sitio, street, landmark, or household notes"
            />
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Email Address <span className="text-slate-400 font-normal">(optional)</span>
            <input
              type="email"
              name="email"
              value={formData.email || ""}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
              placeholder="example@email.com"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/40 via-white to-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-900/80">
          Profile Details
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-slate-800">
            Educational Attainment
            <select
              name="educational_attainment"
              value={formData.educational_attainment}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs cursor-pointer"
            >
              <option value="">Not specified</option>
              {renderOptionList(educationalAttainmentOptions)}
            </select>
          </label>
          <div>
            <label className="block text-sm font-bold text-slate-800">
              Occupation
              <select
                value={
                  !formData.occupation
                    ? ""
                    : standardOccupationOptions.includes(formData.occupation) && formData.occupation !== "Others (Please Specify)"
                    ? formData.occupation
                    : "Others (Please Specify)"
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "Others (Please Specify)") {
                    setIsCustomOccupation(true);
                    setFormData((prev) => ({ ...prev, occupation: customOccupationInput || "" }));
                  } else {
                    setIsCustomOccupation(false);
                    setFormData((prev) => ({ ...prev, occupation: val }));
                  }
                }}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs cursor-pointer"
              >
                <option value="">Select Occupation</option>
                {standardOccupationOptions.map((occ) => (
                  <option key={occ} value={occ}>
                    {occ}
                  </option>
                ))}
              </select>
            </label>
            {isCustomOccupation && (
              <div className="mt-2">
                <input
                  type="text"
                  value={customOccupationInput}
                  onChange={(e) => {
                    setCustomOccupationInput(e.target.value);
                    setFormData((prev) => ({ ...prev, occupation: e.target.value }));
                  }}
                  placeholder="Specify custom occupation..."
                  className="w-full rounded-xl border border-emerald-300 bg-emerald-50/40 px-3.5 py-2.5 text-sm text-emerald-950 outline-none transition focus:border-emerald-600 focus:bg-white font-bold placeholder:text-slate-400 shadow-2xs"
                />
                <span className="text-[11px] font-semibold text-slate-500 mt-1 block">Type your specific occupation above</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-white p-3.5 text-sm font-bold text-slate-800 hover:bg-emerald-50/30 transition cursor-pointer">
            <input
              type="checkbox"
              name="is_4ps_member"
              checked={formData.is_4ps_member}
              onChange={handleInputChange}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            4Ps Member
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-white p-3.5 text-sm font-bold text-slate-800 hover:bg-emerald-50/30 transition cursor-pointer">
            <input
              type="checkbox"
              name="is_solo_parent"
              checked={formData.is_solo_parent}
              onChange={handleInputChange}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Solo Parent
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-white p-3.5 text-sm font-bold text-slate-800 hover:bg-emerald-50/30 transition cursor-pointer">
            <input
              type="checkbox"
              name="is_pwd"
              checked={formData.is_pwd}
              onChange={handleInputChange}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            PWD/PWED
          </label>
        </div>

        {formData.is_pwd ? (
          <label className="mt-4 block text-sm font-bold text-slate-800">
            PWD/PWED Type
            <input
              type="text"
              name="pwd_type"
              value={formData.pwd_type}
              onChange={handleInputChange}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
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

      <section className="rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50/40 via-white to-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-900/80">
          Contact and Portal
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-bold text-slate-800">
            Phone Number <span className="text-slate-400 font-normal">(Strictly 11 digits)</span>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              maxLength={11}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 font-mono shadow-2xs"
              placeholder="09171234567"
            />
            <span className="mt-1 block text-xs font-semibold text-slate-400">
              Must be exactly 11 digits (e.g. 09171234567)
            </span>
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Portal Username
            <input
              type="text"
              name="portal_username"
              value={formData.portal_username || ""}
              onChange={handleInputChange}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-mono"
              placeholder="e.g. juan_dela_cruz"
            />
            {formData.portal_account_status && (
              <span className="mt-1 block text-xs font-bold text-emerald-800">
                Account Status: {formData.portal_account_status}
              </span>
            )}
          </label>
          <label className="block text-sm font-bold text-slate-800">
            Password
            <div className="relative mt-1.5">
              <input
                type={showFormPassword ? "text" : "password"}
                name="portal_password"
                value={formData.portal_password || ""}
                onChange={handleInputChange}
                className="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 py-2.5 text-sm font-black text-slate-950 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 font-mono shadow-2xs tracking-wider"
                placeholder={formData.household_no ? `e.g. ${formData.household_no}` : "e.g. 85 or HH-001"}
              />
              <button
                type="button"
                onClick={() => setShowFormPassword(!showFormPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                aria-label="Toggle password visibility"
                title={showFormPassword ? "Hide password" : "Show password"}
              >
                {showFormPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span className="mt-1 block text-xs font-semibold text-slate-500">
              {showFormPassword
                ? "Password is now visible. Click eye icon to hide."
                : "Password is masked. Click the eye icon to view."}
            </span>
          </label>
        </div>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Record Status
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
          >
            {renderOptionList(residentStatuses)}
          </select>
        </label>
      </section>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#044E35] via-[#057A55] to-[#046C4E] hover:from-[#033E2B] hover:to-[#035438] px-4 py-2.5 text-sm font-bold text-white transition-all shadow-md shadow-emerald-900/20 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-400 cursor-pointer"
        >
          {saving ? <Loader size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? "Saving..." : mode === "create" ? "Create Resident" : "Update Resident"}
        </button>
      </div>
    </form>
  );
});

const ResidentSearchBar = memo(({ value, onChange, onClear }) => {
  const [localValue, setLocalValue] = useState(value);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e) => {
    const nextVal = e.target.value;
    setLocalValue(nextVal);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onChange(nextVal);
    }, 140);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      onChange(localValue);
    }
  };

  const handleClear = () => {
    setLocalValue("");
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onChange("");
    if (onClear) onClear();
  };

  return (
    <div className="relative flex-1 min-w-0">
      <Search className="absolute left-3.5 top-3 text-emerald-600/70" size={17} />
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search name, username, household, occupation, contact..."
        className="w-full rounded-2xl border border-emerald-200/90 bg-white/95 py-2.5 pl-10 pr-9 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-2.5 p-0.5 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
          title="Clear search"
        >
          <X size={15} />
        </button>
      )}
    </div>
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
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [sexFilter, setSexFilter] = useState("");
  const [purokFilter, setPurokFilter] = useState("");
  const [householdFilter, setHouseholdFilter] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [occupationFilter, setOccupationFilter] = useState("");
  const [civilStatusFilter, setCivilStatusFilter] = useState("");
  const [educationFilter, setEducationFilter] = useState("");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [selectedResidentIds, setSelectedResidentIds] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [officials, setOfficials] = useState(() => getOrganizationOfficials());
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  // ─── Pro Dynamic Filter Popover & Dropdown State ───
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterMenuCategory, setFilterMenuCategory] = useState(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
  const [activePillMenu, setActivePillMenu] = useState(null);
  const [tempMinAge, setTempMinAge] = useState("");
  const [tempMaxAge, setTempMaxAge] = useState("");
  const filterDropdownRef = useRef(null);

  // ─── Pro Printable Report & Master List State ───
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState({
    reportType: "purok_simple", // "purok_simple" | "full" | "purok_grouped"
    selectedPurok: "", // "" for All Puroks or specific purok string
    scope: "filtered", // "filtered" | "selected" | "all"
    orientation: "portrait", // "portrait" | "landscape"
    includeHousehold: true,
    includeAgeSex: false,
    includePhone: false,
    includeSignatureCol: true,
    includeOfficials: true,
  });
  const printMenuRef = useRef(null);

  // Close filter & print dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setFilterMenuOpen(false);
        setFilterMenuCategory(null);
        setActivePillMenu(null);
      }
      if (printMenuRef.current && !printMenuRef.current.contains(event.target)) {
        setPrintMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sync officials with database and listen for real-time organizational chart updates
  useEffect(() => {
    fetchOrganizationOfficials()
      .then((data) => {
        if (data?.length) setOfficials(data);
      })
      .catch(() => {});

    const handleOfficialsUpdate = (event) => {
      if (event.detail?.length) {
        setOfficials(event.detail);
      }
    };

    window.addEventListener("organization_officials_updated", handleOfficialsUpdate);
    return () => {
      window.removeEventListener("organization_officials_updated", handleOfficialsUpdate);
    };
  }, []);

  const [residentPage, setResidentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingResident, setEditingResident] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingResident, setViewingResident] = useState(null);
  const [viewPasswordVisible, setViewPasswordVisible] = useState(false);
  const [visiblePasswordMap, setVisiblePasswordMap] = useState({});

  // ─── Dynamic Purok Management State ───
  const [customPuroks, setCustomPuroks] = useState(() => getCustomPurokDefinitions());
  const [showPurokModal, setShowPurokModal] = useState(false);
  const [purokModalTab, setPurokModalTab] = useState("list"); // "list" | "add" | "edit"
  const [editingPurokItem, setEditingPurokItem] = useState(null);
  const [purokFormName, setPurokFormName] = useState("");
  const [purokFormColor, setPurokFormColor] = useState("emerald");
  const [purokManagerMsg, setPurokManagerMsg] = useState(null);

  const refreshCustomPuroks = useCallback(() => {
    setCustomPuroks(getCustomPurokDefinitions());
  }, []);

  const loadResidents = useCallback(async () => {
    setLoading(true);

    try {
      // Fetch resident records in a single optimized query
      const residentData = await fetchResidents("", "", { withAccounts: true });
      const pendingData = residentData.filter((r) => (r.status || "").toLowerCase() === "pending");

      setResidents(residentData);
      setPendingResidents(pendingData);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to load residents." });
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const [userData] = await Promise.all([
          getCurrentUserWithProfile(),
          loadResidents(),
        ]);

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

    init();

    return () => {
      isMounted = false;
    };
  }, [navigate, loadResidents]);

  const optionSource = residents;

  const householdOptions = useMemo(() => {
    const rawList = uniqueOptions(
      optionSource.map((resident) => resident.household_no || resident.house_no || "").filter(Boolean)
    );
    return rawList.sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });
  }, [optionSource]);

  const relationshipOptions = useMemo(
    () =>
      uniqueOptions([
        ...householdRelationshipOptions,
        ...optionSource.map((resident) => resident.relationship_to_household_head || ""),
      ]),
    [optionSource]
  );

  const occupationOptions = useMemo(
    () => uniqueOptions(optionSource.map((resident) => resident.occupation || "")),
    [optionSource]
  );

  const civilStatusFilterOptions = useMemo(
    () =>
      uniqueOptions([
        ...civilStatusOptions,
        ...optionSource.map((resident) => resident.civil_status || ""),
      ]),
    [optionSource]
  );

  const educationalAttainmentFilterOptions = useMemo(
    () =>
      uniqueOptions([
        ...educationalAttainmentOptions,
        ...optionSource.map((resident) => resident.educational_attainment || ""),
      ]),
    [optionSource]
  );

  const editingFormValues = useMemo(
    () => getResidentFormValues(editingResident),
    [editingResident]
  );

  const searchableResidents = useMemo(() => {
    return residents.map((r) => {
      const rawHh = String(r.household_no || r.house_no || "").trim();
      const numHh = parseInt(rawHh, 10);
      const isNum = !isNaN(numHh);
      const hhVariants = isNum
        ? [
            rawHh,
            String(numHh),
            `household ${numHh}`,
            `household ${rawHh}`,
            `household #${numHh}`,
            `household #${rawHh}`,
            `hh ${numHh}`,
            `hh ${rawHh}`,
            `hh #${numHh}`,
            `hh #${rawHh}`,
            `purok ${r.purok || ""}`,
          ]
        : [rawHh, `household ${rawHh}`, `hh ${rawHh}`, `purok ${r.purok || ""}`];

      const parts = [
        r.full_name,
        r.first_name,
        r.last_name,
        r.middle_name,
        r.suffix,
        r.portal_username,
        r.phone,
        r.email,
        r.house_no,
        r.household_no,
        ...hhVariants,
        r.relationship_to_household_head,
        r.purok,
        r.address,
        r.occupation,
        r.civil_status,
        r.educational_attainment,
      ];
      const searchStr = parts.filter(Boolean).join(" ").toLowerCase();
      const age = getResidentAge(r);
      const purokNorm = normalizePurokValue(r.purok);
      const statusLower = (r.status || "active").trim().toLowerCase();
      const sexLower = (r.sex || r.gender || "").trim().toLowerCase();
      const hhNo = rawHh.toLowerCase();
      const relLower = String(r.relationship_to_household_head || "").trim().toLowerCase();
      const occLower = String(r.occupation || "").trim().toLowerCase();
      const civilLower = String(r.civil_status || "").trim().toLowerCase();
      const eduLower = String(r.educational_attainment || "").trim().toLowerCase();

      return {
        ...r,
        _searchStr: searchStr,
        _age: age,
        _purokNorm: purokNorm,
        _statusLower: statusLower,
        _sexLower: sexLower,
        _hhNo: hhNo,
        _hhNum: isNum ? numHh : null,
        _relLower: relLower,
        _occLower: occLower,
        _civilLower: civilLower,
        _eduLower: eduLower,
      };
    });
  }, [residents]);

  const matchesCurrentResidentFilters = useCallback(
    (resident) => {
      const statusLower = resident._statusLower;

      // 1. Status Filter
      if (statusFilter === "current") {
        if (statusLower === "archived") return false;
      } else if (statusFilter === "Active") {
        if (
          statusLower === "archived" ||
          statusLower === "inactive" ||
          statusLower === "pending"
        ) return false;
      } else if (statusFilter) {
        if (statusLower !== statusFilter.toLowerCase()) return false;
      }

      // 2. Sex Filter
      if (sexFilter) {
        const targetSex = sexFilter.trim().toLowerCase();
        if (resident._sexLower !== targetSex && !resident._sexLower.startsWith(targetSex[0])) return false;
      }

      // 3. Purok Filter
      if (purokFilter) {
        const filterPurok = normalizePurokValue(purokFilter);
        if (
          resident._purokNorm !== filterPurok &&
          String(resident.purok || "").trim().toLowerCase() !== String(purokFilter).trim().toLowerCase()
        ) {
          return false;
        }
      }

      // 4. Household Filter
      if (householdFilter) {
        const filterNum = parseInt(householdFilter, 10);
        if (!isNaN(filterNum) && resident._hhNum !== null) {
          if (filterNum !== resident._hhNum) return false;
        } else if (resident._hhNo !== householdFilter.trim().toLowerCase()) {
          return false;
        }
      }

      // 5. Relationship Filter
      if (
        relationshipFilter &&
        resident._relLower !== relationshipFilter.trim().toLowerCase()
      ) {
        return false;
      }

      // 6. Category Filter
      if (categoryFilter && !residentMatchesCategory(resident, categoryFilter)) return false;

      // 7. Occupation Filter
      if (
        occupationFilter &&
        resident._occLower !== occupationFilter.trim().toLowerCase()
      ) {
        return false;
      }

      // 8. Civil Status Filter
      if (
        civilStatusFilter &&
        resident._civilLower !== civilStatusFilter.trim().toLowerCase()
      ) {
        return false;
      }

      // 9. Educational Attainment Filter
      if (
        educationFilter &&
        resident._eduLower !== educationFilter.trim().toLowerCase()
      ) {
        return false;
      }

      // 10. Age Range Filter
      if (minAge !== "") {
        const min = Number(minAge);
        if (!isNaN(min) && (resident._age === null || resident._age < min)) return false;
      }
      if (maxAge !== "") {
        const max = Number(maxAge);
        if (!isNaN(max) && (resident._age === null || resident._age > max)) return false;
      }

      // 11. Search Term (Multi-word Substring Check)
      const term = deferredSearchTerm.trim().toLowerCase();
      if (!term) return true;

      const words = term.split(/\s+/).filter(Boolean);
      return words.every((word) => resident._searchStr.includes(word));
    },
    [
      categoryFilter,
      civilStatusFilter,
      deferredSearchTerm,
      educationFilter,
      householdFilter,
      maxAge,
      minAge,
      occupationFilter,
      purokFilter,
      relationshipFilter,
      sexFilter,
      statusFilter,
    ]
  );

  const displayedResidents = useMemo(
    () => searchableResidents.filter(matchesCurrentResidentFilters),
    [matchesCurrentResidentFilters, searchableResidents]
  );

  const displayedResidentsRef = useRef(displayedResidents);
  displayedResidentsRef.current = displayedResidents;

  const selectedResidentIdsSet = useMemo(
    () => new Set(selectedResidentIds),
    [selectedResidentIds]
  );

  const isAllResidentsSelected = useMemo(
    () => displayedResidents.length > 0 && selectedResidentIds.length === displayedResidents.length,
    [displayedResidents.length, selectedResidentIds.length]
  );

  // Active filter chips list for easy removal
  const activeFilters = useMemo(() => {
    const list = [];
    if (searchTerm.trim()) {
      list.push({ id: "search", label: `Search: "${searchTerm.trim()}"`, clear: () => setSearchTerm("") });
    }
    if (statusFilter !== "Active") {
      const label = statusFilters.find((s) => s.value === statusFilter)?.label || (statusFilter === "" ? "All records" : statusFilter);
      list.push({ id: "status", label: `Status: ${label}`, clear: () => setStatusFilter("Active") });
    }
    if (sexFilter) {
      list.push({ id: "sex", label: `Sex: ${sexFilter}`, clear: () => setSexFilter("") });
    }
    if (purokFilter) {
      list.push({ id: "purok", label: `Purok: ${formatPurok(purokFilter)}`, clear: () => setPurokFilter("") });
    }
    if (householdFilter) {
      list.push({ id: "household", label: `Household: ${householdFilter}`, clear: () => setHouseholdFilter("") });
    }
    if (relationshipFilter) {
      list.push({ id: "relationship", label: `Relationship: ${relationshipFilter}`, clear: () => setRelationshipFilter("") });
    }
    if (categoryFilter) {
      const catLabel = categoryFilterOptions.find((c) => c.value === categoryFilter)?.label || categoryFilter;
      list.push({ id: "category", label: `Category: ${catLabel}`, clear: () => setCategoryFilter("") });
    }
    if (occupationFilter) {
      list.push({ id: "occupation", label: `Occupation: ${occupationFilter}`, clear: () => setOccupationFilter("") });
    }
    if (civilStatusFilter) {
      list.push({ id: "civilStatus", label: `Civil Status: ${civilStatusFilter}`, clear: () => setCivilStatusFilter("") });
    }
    if (educationFilter) {
      list.push({ id: "education", label: `Education: ${educationFilter}`, clear: () => setEducationFilter("") });
    }
    if (minAge !== "" || maxAge !== "") {
      const ageLabel = minAge && maxAge ? `Age: ${minAge} - ${maxAge} yrs` : minAge ? `Age: ≥ ${minAge} yrs` : `Age: ≤ ${maxAge} yrs`;
      list.push({
        id: "age",
        label: ageLabel,
        clear: () => {
          setMinAge("");
          setMaxAge("");
        },
      });
    }
    return list;
  }, [
    categoryFilter,
    civilStatusFilter,
    educationFilter,
    householdFilter,
    maxAge,
    minAge,
    occupationFilter,
    purokFilter,
    relationshipFilter,
    searchTerm,
    sexFilter,
    statusFilter,
  ]);

  const FILTER_CATEGORIES = useMemo(
    () => [
      {
        id: "status",
        label: "Record Status",
        icon: UserCheck,
        isActive: Boolean(statusFilter !== "Active"),
        activeLabel: statusFilters.find((s) => s.value === statusFilter)?.label || (statusFilter === "" ? "All records" : statusFilter),
        options: statusFilters.map((s) => ({ value: s.value, label: s.label })),
        currentValue: statusFilter,
        onSelect: (val) => {
          setStatusFilter(val !== undefined ? val : "Active");
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setFilterMenuOpen(false);
          setFilterMenuCategory(null);
          setActivePillMenu(null);
        },
        onClear: () => {
          setStatusFilter("Active");
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setActivePillMenu(null);
        },
      },
      {
        id: "sex",
        label: "Sex",
        icon: Users,
        isActive: Boolean(sexFilter),
        activeLabel: sexFilter,
        options: [
          { value: "", label: "All Sex" },
          ...sexOptions.map((s) => ({ value: s, label: s })),
        ],
        currentValue: sexFilter,
        onSelect: (val) => {
          setSexFilter(val);
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setFilterMenuOpen(false);
          setFilterMenuCategory(null);
          setActivePillMenu(null);
        },
        onClear: () => {
          setSexFilter("");
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setActivePillMenu(null);
        },
      },
      {
        id: "category",
        label: "Category / Group",
        icon: Tag,
        isActive: Boolean(categoryFilter),
        activeLabel: categoryFilterOptions.find((c) => c.value === categoryFilter)?.label || categoryFilter,
        options: categoryFilterOptions.map((c) => ({ value: c.value, label: c.label })),
        currentValue: categoryFilter,
        onSelect: (val) => {
          setCategoryFilter(val);
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setFilterMenuOpen(false);
          setFilterMenuCategory(null);
          setActivePillMenu(null);
        },
        onClear: () => {
          setCategoryFilter("");
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setActivePillMenu(null);
        },
      },
      {
        id: "purok",
        label: "Purok",
        icon: MapPin,
        isActive: Boolean(purokFilter),
        activeLabel: formatPurok(purokFilter),
        options: [
          { value: "", label: "All Puroks" },
          ...purokOptions.map((p) => ({ value: p, label: formatPurok(p) })),
        ],
        currentValue: purokFilter,
        onSelect: (val) => {
          setPurokFilter(val);
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setFilterMenuOpen(false);
          setFilterMenuCategory(null);
          setActivePillMenu(null);
        },
        onClear: () => {
          setPurokFilter("");
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setActivePillMenu(null);
        },
      },
      {
        id: "household",
        label: "Household No.",
        icon: Home,
        isActive: Boolean(householdFilter),
        activeLabel: `Household ${householdFilter}`,
        options: [
          { value: "", label: "All Households" },
          ...householdOptions.map((h) => ({ value: h, label: `Household ${h}` })),
        ],
        currentValue: householdFilter,
        onSelect: (val) => {
          setHouseholdFilter(val);
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setFilterMenuOpen(false);
          setFilterMenuCategory(null);
          setActivePillMenu(null);
        },
        onClear: () => {
          setHouseholdFilter("");
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setActivePillMenu(null);
        },
      },
      {
        id: "relationship",
        label: "Relationship to Head",
        icon: Users,
        isActive: Boolean(relationshipFilter),
        activeLabel: relationshipFilter,
        options: [
          { value: "", label: "All Relationships" },
          ...relationshipOptions.map((r) => ({ value: r, label: r })),
        ],
        currentValue: relationshipFilter,
        onSelect: (val) => {
          setRelationshipFilter(val);
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setFilterMenuOpen(false);
          setFilterMenuCategory(null);
          setActivePillMenu(null);
        },
        onClear: () => {
          setRelationshipFilter("");
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setActivePillMenu(null);
        },
      },
      {
        id: "occupation",
        label: `Occupation (${occupationOptions.length})`,
        icon: Briefcase,
        isActive: Boolean(occupationFilter),
        activeLabel: occupationFilter,
        options: [
          { value: "", label: "All Occupations" },
          ...occupationOptions.map((o) => ({ value: o, label: o })),
        ],
        currentValue: occupationFilter,
        onSelect: (val) => {
          setOccupationFilter(val);
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setFilterMenuOpen(false);
          setFilterMenuCategory(null);
          setActivePillMenu(null);
        },
        onClear: () => {
          setOccupationFilter("");
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setActivePillMenu(null);
        },
      },
      {
        id: "civilStatus",
        label: "Civil Status",
        icon: Heart,
        isActive: Boolean(civilStatusFilter),
        activeLabel: civilStatusFilter,
        options: [
          { value: "", label: "All Civil Status" },
          ...civilStatusFilterOptions.map((cs) => ({ value: cs, label: cs })),
        ],
        currentValue: civilStatusFilter,
        onSelect: (val) => {
          setCivilStatusFilter(val);
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setFilterMenuOpen(false);
          setFilterMenuCategory(null);
          setActivePillMenu(null);
        },
        onClear: () => {
          setCivilStatusFilter("");
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setActivePillMenu(null);
        },
      },
      {
        id: "education",
        label: "Educational Attainment",
        icon: GraduationCap,
        isActive: Boolean(educationFilter),
        activeLabel: educationFilter,
        options: [
          { value: "", label: "All Educational Attainment" },
          ...educationalAttainmentFilterOptions.map((e) => ({ value: e, label: e })),
        ],
        currentValue: educationFilter,
        onSelect: (val) => {
          setEducationFilter(val);
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setFilterMenuOpen(false);
          setFilterMenuCategory(null);
          setActivePillMenu(null);
        },
        onClear: () => {
          setEducationFilter("");
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setActivePillMenu(null);
        },
      },
      {
        id: "age",
        label: "Age Range",
        icon: Calendar,
        isActive: Boolean(minAge !== "" || maxAge !== ""),
        activeLabel: minAge && maxAge ? `Age ${minAge}-${maxAge} yrs` : minAge ? `Age ≥ ${minAge} yrs` : `Age ≤ ${maxAge} yrs`,
        isCustom: true,
        currentValue: { min: minAge, max: maxAge },
        onSelectAge: (min, max) => {
          setMinAge(min);
          setMaxAge(max);
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setFilterMenuOpen(false);
          setFilterMenuCategory(null);
          setActivePillMenu(null);
        },
        onClear: () => {
          setMinAge("");
          setMaxAge("");
          setPaginationModel((prev) => ({ ...prev, page: 0 }));
          setActivePillMenu(null);
        },
      },
    ],
    [
      categoryFilter,
      civilStatusFilter,
      civilStatusFilterOptions,
      educationFilter,
      educationalAttainmentFilterOptions,
      householdFilter,
      householdOptions,
      maxAge,
      minAge,
      occupationFilter,
      occupationOptions,
      purokFilter,
      relationshipFilter,
      relationshipOptions,
      sexFilter,
      statusFilter,
    ]
  );

  const activeFilterPills = useMemo(
    () => FILTER_CATEGORIES.filter((cat) => cat.isActive),
    [FILTER_CATEGORIES]
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
        return [resident, ...withoutResident];
      });
    },
    []
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

  // Selection Quick Actions
  const handleSelectAllFiltered = () => {
    const allFilteredIds = displayedResidents.map((r) => r.id);
    setSelectedResidentIds(allFilteredIds);
  };

  const handleDeselectAll = () => {
    setSelectedResidentIds([]);
  };

  // ─── Pro Printable Report Engine (Full Master List + Purok Master List) ───
  const generateResidentPrintReport = (targetResidents, titleSuffix = "", options = {}) => {
    if (!targetResidents || targetResidents.length === 0) {
      alert("No matching residents to print.");
      return;
    }

    const {
      reportType = "purok_simple", // "purok_simple" | "full" | "purok_grouped"
      orientation = reportType === "purok_simple" ? "portrait" : "landscape",
      selectedPurok = "",
      includeHousehold = true,
      includeAgeSex = false,
      includePhone = false,
      includeSignatureCol = true,
      includeOfficials = true,
      customTitle = "",
    } = options;

    // Filter by specific purok if specified
    let filteredList = [...targetResidents];
    if (selectedPurok) {
      filteredList = filteredList.filter(
        (r) => normalizePurokValue(r.purok) === normalizePurokValue(selectedPurok)
      );
    }

    if (filteredList.length === 0) {
      alert(`No residents found for ${selectedPurok ? `Purok ${formatPurok(selectedPurok)}` : "the selected criteria"}.`);
      return;
    }

    // Sort residents alphabetically for clean masterlist presentation
    filteredList.sort((a, b) => {
      const purokA = formatPurok(a.purok).toLowerCase();
      const purokB = formatPurok(b.purok).toLowerCase();
      if (reportType === "purok_grouped" && purokA !== purokB) {
        return purokA.localeCompare(purokB);
      }
      const nameA = (a.last_name || getResidentDisplayName(a)).toLowerCase();
      const nameB = (b.last_name || getResidentDisplayName(b)).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to open the official print report.");
      return;
    }

    const currentDate = new Date().toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const currentTime = new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Build filter summary
    const activeFilterTexts = [];
    if (selectedPurok) {
      activeFilterTexts.push(`Purok: ${formatPurok(selectedPurok)}`);
    }
    activeFilters.forEach((f) => {
      if (f.id !== "purok" || !selectedPurok) {
        activeFilterTexts.push(f.label);
      }
    });

    const filterDescription =
      activeFilterTexts.length > 0
        ? activeFilterTexts.join(" • ")
        : "All Records (Unfiltered)";

    let reportTitle = "OFFICIAL RESIDENT MASTER LIST";
    if (reportType === "purok_simple") {
      reportTitle = selectedPurok
        ? `PUROK ${formatPurok(selectedPurok).toUpperCase()} RESIDENT MASTER LIST`
        : "BARANGAY RESIDENT MASTER LIST (BY PUROK)";
    } else if (reportType === "purok_grouped") {
      reportTitle = "PUROK-BY-PUROK RESIDENT MASTER LIST";
    }
    if (customTitle) {
      reportTitle = customTitle.toUpperCase();
    }
    if (titleSuffix) {
      reportTitle += ` (${titleSuffix.toUpperCase()})`;
    }

    // Build Table Body HTML based on report type
    let tableHtml = "";

    if (reportType === "full") {
      // 11-Columns Official Comprehensive Master List
      const rowsHtml = filteredList
        .map((resident, index) => {
          const name = getResidentDisplayName(resident);
          const age = getResidentAge(resident) ?? "-";
          const sex = resident.sex || resident.gender || "-";
          const purok = formatPurok(resident.purok);
          const household = resident.household_no || "-";
          const civilStatus = resident.civil_status || "-";
          const occupation = resident.occupation || "-";
          const education = resident.educational_attainment || "-";
          const phone = resident.phone || "-";
          const tags = getResidentCategoryTags(resident).join(", ") || "Standard";
          const status = resident.status || "Active";
          const bg = index % 2 === 0 ? "#ffffff" : "#f8fafc";

          return `
            <tr class="${index % 2 === 0 ? "odd-row" : "even-row"}" style="background-color: ${bg} !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <td style="text-align:center; padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-weight: bold; font-size: 11px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${index + 1}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-weight: 700; font-size: 11px; color: #0f172a; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${name}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-size: 11px; text-align: center; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${household}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-size: 11px; font-weight: 600; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${purok}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-size: 11px; text-align: center; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${age} / ${sex ? sex.charAt(0) : "-"}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-size: 11px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${civilStatus}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-size: 11px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${occupation}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-size: 11px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${education}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-size: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${tags}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-size: 11px; font-family: monospace; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${phone}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; text-align: center; font-size: 11px; font-weight: 600; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${status}</td>
            </tr>
          `;
        })
        .join("");

      tableHtml = `
        <table>
          <thead>
            <tr>
              <th class="center" style="width: 32px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">#</th>
              <th style="background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Full Name</th>
              <th class="center" style="width: 75px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Household</th>
              <th style="width: 100px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Purok</th>
              <th class="center" style="width: 60px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Age / Sex</th>
              <th style="width: 80px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Civil Status</th>
              <th style="background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Occupation</th>
              <th style="background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Educational Attainment</th>
              <th style="width: 110px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Category</th>
              <th style="width: 95px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Phone</th>
              <th class="center" style="width: 65px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    } else if (reportType === "purok_simple") {
      // Simplified Purok Master List: Full Name and Purok (+ optional Household & Signature line)
      const rowsHtml = filteredList
        .map((resident, index) => {
          const name = getResidentDisplayName(resident);
          const purok = formatPurok(resident.purok);
          const household = resident.household_no || "-";
          const age = getResidentAge(resident) ?? "-";
          const sex = resident.sex || resident.gender || "-";
          const phone = resident.phone || "-";
          const bg = index % 2 === 0 ? "#ffffff" : "#f8fafc";

          return `
            <tr class="${index % 2 === 0 ? "odd-row" : "even-row"}" style="background-color: ${bg} !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <td style="text-align:center; padding: 7px 8px; border: 1px solid #cbd5e1 !important; font-weight: bold; font-size: 11px; width: 38px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${index + 1}</td>
              <td style="padding: 7px 10px; border: 1px solid #cbd5e1 !important; font-weight: 700; font-size: 12px; color: #0f172a; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${name}</td>
              ${includeHousehold ? `<td style="padding: 7px 8px; border: 1px solid #cbd5e1 !important; font-size: 11px; text-align: center; width: 90px; font-weight: 600; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${household}</td>` : ""}
              <td style="padding: 7px 10px; border: 1px solid #cbd5e1 !important; font-size: 12px; font-weight: 800; color: #00552E; width: 140px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${purok}</td>
              ${includeAgeSex ? `<td style="padding: 7px 8px; border: 1px solid #cbd5e1 !important; font-size: 11px; text-align: center; width: 75px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${age} / ${sex ? sex.charAt(0) : "-"}</td>` : ""}
              ${includePhone ? `<td style="padding: 7px 8px; border: 1px solid #cbd5e1 !important; font-size: 11px; font-family: monospace; width: 105px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${phone}</td>` : ""}
              ${includeSignatureCol ? `<td style="padding: 7px 8px; border: 1px solid #cbd5e1 !important; width: 150px; text-align: center; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;"><div style="border-bottom: 1px dotted #94a3b8; height: 18px; margin: 0 6px;"></div></td>` : ""}
            </tr>
          `;
        })
        .join("");

      tableHtml = `
        <table>
          <thead>
            <tr>
              <th class="center" style="width: 38px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">#</th>
              <th style="background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Full Name</th>
              ${includeHousehold ? `<th class="center" style="width: 90px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Household #</th>` : ""}
              <th style="width: 140px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Purok</th>
              ${includeAgeSex ? `<th class="center" style="width: 75px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Age / Sex</th>` : ""}
              ${includePhone ? `<th style="width: 105px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Contact</th>` : ""}
              ${includeSignatureCol ? `<th class="center" style="width: 150px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Signature / Remarks</th>` : ""}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    } else if (reportType === "purok_grouped") {
      // Grouped by Purok Sections
      const groupsMap = new Map();
      filteredList.forEach((r) => {
        const p = formatPurok(r.purok) || "Unassigned";
        if (!groupsMap.has(p)) groupsMap.set(p, []);
        groupsMap.get(p).push(r);
      });

      const groupSectionsHtml = Array.from(groupsMap.entries())
        .map(([purokName, groupResidents]) => {
          const groupRows = groupResidents
            .map((resident, idx) => {
              const name = getResidentDisplayName(resident);
              const household = resident.household_no || "-";
              const age = getResidentAge(resident) ?? "-";
              const sex = resident.sex || resident.gender || "-";
              const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";

              return `
                <tr class="${idx % 2 === 0 ? "odd-row" : "even-row"}" style="background-color: ${bg} !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
                  <td style="text-align:center; padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-weight: bold; font-size: 11px; width: 35px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${idx + 1}</td>
                  <td style="padding: 6px 10px; border: 1px solid #cbd5e1 !important; font-weight: 700; font-size: 11.5px; color: #0f172a; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${name}</td>
                  ${includeHousehold ? `<td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-size: 11px; text-align: center; width: 85px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${household}</td>` : ""}
                  ${includeAgeSex ? `<td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; font-size: 11px; text-align: center; width: 70px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${age} / ${sex ? sex.charAt(0) : "-"}</td>` : ""}
                  ${includeSignatureCol ? `<td style="padding: 6px 8px; border: 1px solid #cbd5e1 !important; width: 140px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;"><div style="border-bottom: 1px dotted #94a3b8; height: 16px;"></div></td>` : ""}
                </tr>
              `;
            })
            .join("");

          return `
            <div style="page-break-inside: auto !important; break-inside: auto !important; margin-bottom: 14px;">
              <div class="purok-banner">
                <span>PUROK ${purokName.toUpperCase()}</span>
                <span style="font-size: 11px; font-weight: bold;">${groupResidents.length} Resident${groupResidents.length === 1 ? "" : "s"}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th class="center" style="width: 35px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">#</th>
                    <th style="background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Full Name</th>
                    ${includeHousehold ? `<th class="center" style="width: 85px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Household #</th>` : ""}
                    ${includeAgeSex ? `<th class="center" style="width: 70px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Age / Sex</th>` : ""}
                    ${includeSignatureCol ? `<th class="center" style="width: 140px; background-color: #00552E !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #004224 !important;">Signature / Remarks</th>` : ""}
                  </tr>
                </thead>
                <tbody>
                  ${groupRows}
                </tbody>
              </table>
            </div>
          `;
        })
        .join("");

      tableHtml = groupSectionsHtml;
    }

    const reportHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Resident List Report - Barangay Upper Mingading</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    @page {
      size: ${orientation === "portrait" ? "A4 portrait" : "A4 landscape"};
      margin: 6mm 6mm 6mm 6mm;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff !important;
      margin: 0 !important;
      padding: 0 !important;
      font-size: 11px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .header-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      border-bottom: 2.5px solid #00552E !important;
      padding-bottom: 8px;
      margin-bottom: 8px;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .header-seal {
      width: 64px;
      height: 64px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .header-text {
      text-align: center;
    }
    .header-text h4 {
      margin: 0;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
    }
    .header-text h2 {
      margin: 2px 0 0;
      font-size: 16px;
      font-weight: 900;
      color: #00552E !important;
      letter-spacing: 0.04em;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .header-text h3 {
      margin: 3px 0 0;
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.03em;
    }
    .filter-badge-box {
      background-color: #f8fafc !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 8px;
      padding: 6px 12px;
      margin-bottom: 8px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .filter-title {
      font-weight: 800;
      color: #00552E !important;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .filter-content {
      color: #334155;
      font-weight: 600;
    }
    .total-badge {
      background-color: #00552E !important;
      color: #ffffff !important;
      padding: 3px 10px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 11px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      display: inline-block;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      margin-bottom: 10px;
      page-break-inside: auto !important;
      break-inside: auto !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    thead {
      display: table-header-group !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    th {
      background-color: #00552E !important;
      color: #ffffff !important;
      padding: 6px 8px;
      text-align: left;
      font-size: 10.5px;
      font-weight: 800;
      border: 1px solid #004224 !important;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    th.center {
      text-align: center;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: auto !important;
    }
    td {
      padding: 5px 8px;
      border: 1px solid #cbd5e1 !important;
      font-size: 11px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .even-row {
      background-color: #f8fafc !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .odd-row {
      background-color: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .purok-banner {
      background-color: #e6f4ea !important;
      color: #00552E !important;
      font-weight: 900;
      font-size: 12px;
      padding: 6px 10px;
      border: 1.5px solid #00552E !important;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-top: 10px;
      margin-bottom: 4px;
      border-radius: 4px;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
      padding-top: 8px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .sig-block {
      text-align: center;
      width: 240px;
    }
    .sig-line {
      border-bottom: 1px solid #0f172a !important;
      margin-bottom: 5px;
      height: 32px;
    }
    .sig-name {
      font-weight: 800;
      font-size: 12px;
      color: #0f172a;
    }
    .sig-title {
      font-size: 10.5px;
      color: #64748b;
      font-weight: 600;
    }
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print { display: none !important; }
      table { page-break-inside: auto !important; }
      tr { page-break-inside: avoid !important; page-break-after: auto !important; }
      thead { display: table-header-group !important; page-break-inside: avoid !important; }
      th {
        background-color: #00552E !important;
        color: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .total-badge {
        background-color: #00552E !important;
        color: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .filter-badge-box {
        background-color: #f8fafc !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      tr.even-row {
        background-color: #f8fafc !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      tr.odd-row {
        background-color: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .purok-banner {
        background-color: #e6f4ea !important;
        color: #00552E !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="header-container">
    <img class="header-seal" src="/logo.png" alt="Barangay Upper Mingading Seal" />
    <div class="header-text">
      <h4>Republic of the Philippines • Province of Cotabato • Municipality of Aleosan</h4>
      <h2>BARANGAY UPPER MINGADING</h2>
      <h3>${reportTitle}</h3>
    </div>
    <img class="header-seal" src="/aleosan.logo.png" alt="Municipality of Aleosan Seal" />
  </div>

  <div class="filter-badge-box">
    <div>
      <span class="filter-title">Applied Scope / Filters: </span>
      <span class="filter-content">${filterDescription}</span>
    </div>
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="color: #64748b; font-size: 10px;">Generated on: <strong>${currentDate} at ${currentTime}</strong></span>
      <span class="total-badge">${filteredList.length} Resident${filteredList.length === 1 ? "" : "s"}</span>
    </div>
  </div>

  ${tableHtml}

  ${includeOfficials ? `
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${getActiveSecretary(officials)}</div>
      <div class="sig-title">Barangay Secretary</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${getActiveCaptain(officials)}</div>
      <div class="sig-title">Punong Barangay</div>
    </div>
  </div>
  ` : ""}

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 350);
    });
  </script>
</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
  };

  const handleOpenPrintModal = (defaultReportType = "purok_simple") => {
    setPrintConfig((prev) => ({
      ...prev,
      reportType: defaultReportType,
      selectedPurok: purokFilter || "",
      orientation: defaultReportType === "purok_simple" ? "portrait" : "landscape",
      scope: selectedResidentIds.length > 0 ? "selected" : "filtered",
    }));
    setShowPrintModal(true);
    setPrintMenuOpen(false);
  };

  const handleExecutePrint = () => {
    let target = displayedResidents;
    let suffix = `Filtered (${displayedResidents.length})`;

    if (printConfig.scope === "selected") {
      target = residents.filter((r) => selectedResidentIds.includes(r.id));
      suffix = `Selected (${target.length})`;
    } else if (printConfig.scope === "all") {
      target = residents.filter((r) => r.status === "Active");
      suffix = `All Active (${target.length})`;
    }

    generateResidentPrintReport(target, suffix, printConfig);
    setShowPrintModal(false);
  };

  const handlePrintPurokMasterList = () => {
    const target = selectedResidentIds.length > 0
      ? residents.filter((r) => selectedResidentIds.includes(r.id))
      : displayedResidents;
    const suffix = selectedResidentIds.length > 0
      ? `Selected (${target.length})`
      : `Filtered (${target.length})`;

    generateResidentPrintReport(target, suffix, {
      reportType: "purok_simple",
      orientation: "portrait",
      selectedPurok: purokFilter || "",
      includeHousehold: true,
      includeSignatureCol: true,
      includeAgeSex: false,
      includePhone: false,
      includeOfficials: true,
    });
    setPrintMenuOpen(false);
  };

  const handlePrintFullMasterList = () => {
    const target = selectedResidentIds.length > 0
      ? residents.filter((r) => selectedResidentIds.includes(r.id))
      : displayedResidents;
    const suffix = selectedResidentIds.length > 0
      ? `Selected (${target.length})`
      : `Filtered (${target.length})`;

    generateResidentPrintReport(target, suffix, {
      reportType: "full",
      orientation: "landscape",
      selectedPurok: purokFilter || "",
      includeHousehold: true,
      includeOfficials: true,
    });
    setPrintMenuOpen(false);
  };

  const handlePrintSelected = () => {
    const selectedResidents = displayedResidents.filter((r) =>
      selectedResidentIds.includes(r.id)
    );
    if (selectedResidents.length === 0) {
      alert("Please select at least one resident using the checkboxes before printing.");
      return;
    }
    handleOpenPrintModal("purok_simple");
  };

  const handlePrintAllFiltered = () => {
    handleOpenPrintModal("purok_simple");
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
      // Pre-check duplicate username in state and DB
      const portalUsername = (formValues.portal_username || "").trim().toLowerCase();
      if (portalUsername) {
        const existingInMemory = residents.find(
          (r) =>
            (r.portal_username && r.portal_username.toLowerCase() === portalUsername) ||
            (r.resident_account?.username && r.resident_account.username.toLowerCase() === portalUsername)
        );
        if (existingInMemory) {
          throw new Error(`Username "${portalUsername}" is already in use by resident "${getResidentDisplayName(existingInMemory)}". Please choose a unique username.`);
        }
      }

      const payload = buildResidentPayload(formValues);
      const savedResident = await createResident(payload);
      const savedStatus = savedResident.status || payload.status || "Active";

      // If admin provided a username, create the portal account
      let portalPassword = (formValues.portal_password || "").trim();
      let portalMessage = "";

      if (portalUsername && savedResident.id) {
        try {
          const finalPass = portalPassword || "kaagapai123";
          await createResidentPortalAccount(savedResident.id, portalUsername, finalPass);
          savedResident.portal_username = portalUsername.toLowerCase();
          savedResident.portal_password = finalPass;
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

  const handleViewResident = (resident) => {
    setViewingResident(resident);
    setShowViewModal(true);
    setViewPasswordVisible(false);
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
      // Pre-check duplicate username in state and DB
      const portalUsername = (formValues.portal_username || "").trim().toLowerCase();
      if (portalUsername) {
        const existingInMemory = residents.find(
          (r) =>
            r.id !== editingResident.id &&
            ((r.portal_username && r.portal_username.toLowerCase() === portalUsername) ||
              (r.resident_account?.username && r.resident_account.username.toLowerCase() === portalUsername))
        );
        if (existingInMemory) {
          throw new Error(`Username "${portalUsername}" is already in use by resident "${getResidentDisplayName(existingInMemory)}". Please choose a unique username.`);
        }
      }

      const savedResident = await updateResident(editingResident, buildResidentPayload(formValues));

      // Create or update the portal account whenever admin provides credentials
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
      try {
        await supabase
          .from("resident_accounts")
          .update({ account_status: "Active" })
          .eq("resident_id", resident.id);
        await supabase
          .from("resident_activation_requests")
          .update({ status: "Approved", approved_at: new Date().toISOString() })
          .eq("resident_id", resident.id);
      } catch {
        // silent fallback
      }
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
    setOccupationFilter("");
    setCivilStatusFilter("");
    setEducationFilter("");
    setMinAge("");
    setMaxAge("");
    setSelectedResidentIds([]);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const hasActiveFilters = useMemo(() => {
    return (
      activeFilterPills.length > 0 ||
      Boolean(searchTerm.trim()) ||
      isSelectMode ||
      selectedResidentIds.length > 0
    );
  }, [activeFilterPills.length, isSelectMode, searchTerm, selectedResidentIds.length]);

  const columns = useMemo(() => {
    const cols = [];

    // Show selection checkboxes ONLY when filtering, searching, or when selection is active
    if (hasActiveFilters) {
      cols.push({
        field: "__selection__",
        headerName: "",
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        headerAlign: "center",
        align: "center",
        renderHeader: () => {
          const isPartiallySelected = selectedResidentIds.length > 0 && !isAllResidentsSelected;
          return (
            <div className="flex items-center justify-center w-full py-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isAllResidentsSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isPartiallySelected;
                }}
                onChange={(e) => {
                  e.stopPropagation();
                  if (isAllResidentsSelected || selectedResidentIds.length > 0) {
                    setSelectedResidentIds([]);
                    setIsSelectMode(false);
                  } else {
                    setIsSelectMode(true);
                    setSelectedResidentIds((displayedResidents || []).map((r) => r.id).filter(Boolean));
                  }
                }}
                className="h-4 w-4 rounded border-slate-300 text-[#00552E] focus:ring-[#00552E] cursor-pointer accent-[#00552E] transition"
                title={isAllResidentsSelected ? "Deselect all" : "Select all displayed records"}
              />
            </div>
          );
        },
        renderCell: (params) => {
          const isSelected = selectedResidentIdsSet.has(params?.row?.id);
          return (
            <div className="flex items-center justify-center w-full h-full" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  const rowId = params?.row?.id;
                  if (!rowId) return;
                  if (e.target.checked) {
                    setIsSelectMode(true);
                    setSelectedResidentIds((prev) => [...prev.filter((id) => id !== rowId), rowId]);
                  } else {
                    setSelectedResidentIds((prev) => {
                      const next = prev.filter((id) => id !== rowId);
                      if (next.length === 0) setIsSelectMode(false);
                      return next;
                    });
                  }
                }}
                className="h-4 w-4 rounded border-slate-300 text-[#00552E] focus:ring-[#00552E] cursor-pointer accent-[#00552E] transition"
              />
            </div>
          );
        },
      });
    }

    cols.push({
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
      },
    },
      {
        field: "household_no",
        headerName: "Household",
        flex: 1.2,
        renderCell: (params) => {
          const resident = params.row;
          const hhNumber = resident.household_no || resident.house_no || "-";
          return (
            <div className="py-2 leading-tight">
              <p className="font-medium text-slate-700">{hhNumber}</p>
              <p className="text-xs text-slate-500 mt-0.5">{resident.relationship_to_household_head || "-"}</p>
              <p className="text-xs text-slate-400 mt-0.5">{formatPurok(resident.purok)}</p>
            </div>
          );
        },
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
        },
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
        },
      },
      {
        field: "phone",
        headerName: "Contact / Portal",
        flex: 1.3,
        renderCell: (params) => {
          const resident = params.row;
          const isPasswordVisible = Boolean(visiblePasswordMap[resident.id]);
          const passVal = getResidentPortalPassword(resident);
          const portalUser = getPortalUsername(resident);

          return (
            <div className="py-2 leading-tight space-y-0.5">
              <p className="font-medium text-slate-800">{resident.phone || "-"}</p>
              {portalUser && portalUser !== "-" && (
                <p className="text-[11px] font-mono font-bold text-emerald-800">
                  User: {portalUser}
                </p>
              )}
              {resident.email && (
                <p className="text-xs text-slate-500 truncate max-w-[150px]" title={resident.email}>
                  {resident.email}
                </p>
              )}
              {passVal ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <span className="text-[10px] font-bold text-slate-400">Pass:</span>
                  <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    {isPasswordVisible ? passVal : "••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVisiblePasswordMap((prev) => ({
                        ...prev,
                        [resident.id]: !prev[resident.id],
                      }));
                    }}
                    className="p-0.5 rounded hover:bg-slate-200/60 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                    title={isPasswordVisible ? "Hide password" : "Show password"}
                  >
                    {isPasswordVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (passVal) {
                        navigator.clipboard.writeText(passVal);
                        showAdminSystemToast("Password copied to clipboard", "success");
                      }
                    }}
                    className="p-0.5 rounded hover:bg-slate-200/60 text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                    title="Copy password"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              ) : null}
            </div>
          );
        },
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
        },
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
                onClick={() => handleViewResident(resident)}
                className="gov-action-btn view"
                title="View resident profile details"
              >
                <Eye size={16} />
              </button>
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
        },
      }
    );

    return cols;
  }, [actionResidentId, hasActiveFilters, isAllResidentsSelected, selectedResidentIdsSet, visiblePasswordMap]);

  return (
    <>
      <PageWrapper
        title="Resident Management"
        description="Add, update, filter, and archive resident records"
      >
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

        {/* ─── Modern Space-Saving Control Bar (Search + Dynamic 2-Level Filter Dropdown + Actions) ─── */}
        <section ref={filterDropdownRef} className="relative overflow-visible rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-[#ECFDF5] via-[#F6FCF9] to-white p-4 sm:p-5 shadow-sm shadow-emerald-950/5">
          {/* Row 1: Search Bar + Buttons */}
          <div className="relative z-20 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <ResidentSearchBar
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val);
                setPaginationModel((prev) => ({ ...prev, page: 0 }));
              }}
              onClear={() => {
                setSearchTerm("");
                setPaginationModel((prev) => ({ ...prev, page: 0 }));
              }}
            />

            {/* Action Buttons Group */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Dynamic 2-Level Filter Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMenuOpen(!filterMenuOpen);
                    setFilterMenuCategory(null);
                    setFilterSearchQuery("");
                    setActivePillMenu(null);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition shadow-xs cursor-pointer ${
                    filterMenuOpen || activeFilterPills.length > 0
                      ? "border-emerald-600 bg-emerald-800 text-white shadow-emerald-900/20"
                      : "border-emerald-200/90 bg-white text-emerald-950 hover:bg-emerald-50"
                  }`}
                >
                  <Filter size={14} />
                  <span>Filter By</span>
                  {activeFilterPills.length > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 text-white px-1 text-[10px] font-black">
                      {activeFilterPills.length}
                    </span>
                  )}
                  <ChevronDown size={14} className={`transition-transform duration-150 ${filterMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {/* ─── Level 1 / Level 2 Filter Dropdown Popover ─── */}
                {filterMenuOpen && (
                  <div className="absolute right-0 sm:left-0 top-full mt-2 w-72 sm:w-80 rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
                    {filterMenuCategory === null ? (
                      // Level 1: Category Picker
                      <div>
                        <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                            Select Filter Category
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700">AND logic</span>
                        </div>
                        <div className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
                          {FILTER_CATEGORIES.map((cat) => {
                            const IconComponent = cat.icon;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  setFilterMenuCategory(cat.id);
                                  setFilterSearchQuery("");
                                  if (cat.id === "age") {
                                    setTempMinAge(minAge);
                                    setTempMaxAge(maxAge);
                                  }
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50/80 hover:text-emerald-900 transition group cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-700 group-hover:text-white transition">
                                    <IconComponent size={13} />
                                  </span>
                                  <span>{cat.label}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {cat.isActive && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md truncate max-w-[90px]">
                                      {cat.activeLabel}
                                    </span>
                                  )}
                                  <ChevronRight size={14} className="text-slate-400 group-hover:text-emerald-700 transition" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      // Level 2: Value Picker for Selected Category
                      <div>
                        {(() => {
                          const currentCat = FILTER_CATEGORIES.find((c) => c.id === filterMenuCategory);
                          if (!currentCat) return null;
                          const IconComponent = currentCat.icon;

                          if (currentCat.id === "age") {
                            // Age Range Custom Submenu
                            return (
                              <div>
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
                                  <button
                                    type="button"
                                    onClick={() => setFilterMenuCategory(null)}
                                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                                  >
                                    <ArrowLeft size={15} />
                                  </button>
                                  <span className="text-xs font-extrabold text-slate-900">Filter by Age Range</span>
                                </div>

                                <div className="p-1 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Min Age</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={tempMinAge}
                                        onChange={(e) => setTempMinAge(e.target.value)}
                                        placeholder="0"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 focus:bg-white"
                                      />
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 mt-4">to</span>
                                    <div className="flex-1">
                                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Max Age</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={tempMaxAge}
                                        onChange={(e) => setTempMaxAge(e.target.value)}
                                        placeholder="100"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 focus:bg-white"
                                      />
                                    </div>
                                  </div>

                                  {/* Quick Presets */}
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">Quick Presets:</span>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {[
                                        { label: "Children (0-17)", min: "0", max: "17" },
                                        { label: "Youth (18-30)", min: "18", max: "30" },
                                        { label: "Adults (31-59)", min: "31", max: "59" },
                                        { label: "Seniors (60+)", min: "60", max: "" },
                                      ].map((preset) => (
                                        <button
                                          key={preset.label}
                                          type="button"
                                          onClick={() => {
                                            setTempMinAge(preset.min);
                                            setTempMaxAge(preset.max);
                                          }}
                                          className="text-[10px] font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-900 py-1 px-1.5 text-slate-700 transition cursor-pointer text-center"
                                        >
                                          {preset.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        currentCat.onClear();
                                        setFilterMenuOpen(false);
                                        setFilterMenuCategory(null);
                                      }}
                                      className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                                    >
                                      Clear Age
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => currentCat.onSelectAge(tempMinAge, tempMaxAge)}
                                      className="rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white px-3.5 py-1.5 text-xs font-bold transition cursor-pointer shadow-xs"
                                    >
                                      Apply Age
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // General Options Submenu
                          const filteredOptions = currentCat.options.filter((opt) =>
                            opt.label.toLowerCase().includes(filterSearchQuery.toLowerCase())
                          );

                          return (
                            <div>
                              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
                                <button
                                  type="button"
                                  onClick={() => setFilterMenuCategory(null)}
                                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                                >
                                  <ArrowLeft size={15} />
                                </button>
                                <div className="flex items-center gap-1.5">
                                  <IconComponent size={14} className="text-emerald-700" />
                                  <span className="text-xs font-extrabold text-slate-900">
                                    Select {currentCat.label}
                                  </span>
                                </div>
                              </div>

                              {currentCat.options.length > 7 && (
                                <div className="mb-2">
                                  <input
                                    type="text"
                                    value={filterSearchQuery}
                                    onChange={(e) => setFilterSearchQuery(e.target.value)}
                                    placeholder={`Search ${currentCat.label}...`}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:bg-white"
                                    autoFocus
                                  />
                                </div>
                              )}

                              <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                                {filteredOptions.map((opt) => {
                                  const isSelected =
                                    opt.value === currentCat.currentValue ||
                                    (!opt.value && !currentCat.currentValue);
                                  return (
                                    <button
                                      key={opt.label}
                                      type="button"
                                      onClick={() => currentCat.onSelect(opt.value)}
                                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                                        isSelected
                                          ? "bg-emerald-100 text-emerald-950 font-bold"
                                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                      }`}
                                    >
                                      <span>{opt.label}</span>
                                      {isSelected && <Check size={14} className="text-emerald-700 stroke-[3]" />}
                                    </button>
                                  );
                                })}
                                {filteredOptions.length === 0 && (
                                  <div className="p-3 text-center text-xs text-slate-400">No matches found</div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pro Print Reports Dropdown & Quick Actions */}
              <div className="relative" ref={printMenuRef}>
                <div className="inline-flex items-center rounded-xl border border-emerald-200/90 bg-white shadow-xs overflow-hidden">
                  {/* Primary 1-Click Purok Master List Print */}
                  <button
                    type="button"
                    onClick={handlePrintPurokMasterList}
                    disabled={displayedResidents.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50 transition disabled:opacity-50 cursor-pointer"
                    title="Print Master List with Full Name and Purok only"
                  >
                    <FileText size={14} className="text-emerald-700" />
                    <span>Purok Master List</span>
                  </button>

                  {/* Dropdown Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setPrintMenuOpen(!printMenuOpen);
                      setFilterMenuOpen(false);
                    }}
                    className="px-2 py-2 border-l border-emerald-100 text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                    title="More print options (Full List, Grouped, Columns)"
                  >
                    <ChevronDown size={14} className={`transition-transform duration-150 ${printMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {/* Print Dropdown Menu */}
                {printMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        Print Master List
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {displayedResidents.length} Records
                      </span>
                    </div>

                    <div className="space-y-1">
                      {/* Option 1: Purok Master List (Simplified) */}
                      <button
                        type="button"
                        onClick={handlePrintPurokMasterList}
                        className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-emerald-50 transition group cursor-pointer"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition mt-0.5 shrink-0">
                          <FileText size={14} />
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-950">
                            Purok Master List
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Full Name & Purok only (Compact Portrait)
                          </div>
                        </div>
                      </button>

                      {/* Option 2: Full Master List */}
                      <button
                        type="button"
                        onClick={handlePrintFullMasterList}
                        className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-emerald-50 transition group cursor-pointer"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition mt-0.5 shrink-0">
                          <FileSpreadsheet size={14} />
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-950">
                            Official Full Master List
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Complete 11 columns (Landscape)
                          </div>
                        </div>
                      </button>

                      {/* Option 3: Purok Grouped Master List */}
                      <button
                        type="button"
                        onClick={() => {
                          generateResidentPrintReport(displayedResidents, `Filtered (${displayedResidents.length})`, {
                            reportType: "purok_grouped",
                            orientation: "portrait",
                            selectedPurok: purokFilter || "",
                            includeHousehold: true,
                            includeSignatureCol: true,
                          });
                          setPrintMenuOpen(false);
                        }}
                        className="w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-emerald-50 transition group cursor-pointer"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition mt-0.5 shrink-0">
                          <Layers size={14} />
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-950">
                            Purok Grouped Sections
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Organized by Purok with headers
                          </div>
                        </div>
                      </button>

                      {/* Option 4: Custom Print Dialog */}
                      <div className="border-t border-slate-100 pt-1 mt-1">
                        <button
                          type="button"
                          onClick={() => handleOpenPrintModal("purok_simple")}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Settings2 size={14} />
                            <span>Customize Report & Filters...</span>
                          </div>
                          <ChevronRight size={14} className="text-slate-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Manage Puroks Button */}
              <button
                type="button"
                onClick={() => {
                  refreshCustomPuroks();
                  setShowPurokModal(true);
                  setPurokModalTab("list");
                  setPurokManagerMsg(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-white hover:bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900 transition shadow-xs cursor-pointer"
                title="Add, rename, or customize barangay puroks"
              >
                <MapPin size={14} className="text-emerald-700" />
                <span>Manage Puroks</span>
              </button>

              {/* Add Resident Button */}
              <button
                type="button"
                onClick={openCreateModal}
                className="strict-button-hover inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#044E35] via-[#057A55] to-[#046C4E] hover:from-[#033E2B] hover:to-[#035438] px-4 py-2 text-xs font-bold text-white transition-all shadow-md shadow-emerald-900/20 active:scale-95 cursor-pointer"
              >
                <Plus size={15} className="stroke-[2.5]" />
                Add Resident
              </button>
            </div>
          </div>

          {/* Row 2: Interactive Active Filter Pills Row */}
          {activeFilterPills.length > 0 && (
            <div className="relative z-10 mt-3 flex flex-wrap items-center gap-1.5 border-t border-emerald-100/70 pt-2.5">
              <span className="text-[11px] font-extrabold text-emerald-950 pr-1">Active:</span>

              {activeFilterPills.map((cat) => {
                const IconComponent = cat.icon;
                const isPillOpen = activePillMenu === cat.id;

                return (
                  <div key={cat.id} className="relative inline-flex items-center">
                    {/* Interactive Pill Button */}
                    <div className="inline-flex items-center rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePillMenu(isPillOpen ? null : cat.id);
                          setFilterMenuOpen(false);
                          setFilterSearchQuery("");
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <IconComponent size={12} className="text-emerald-700" />
                        <span>{cat.label.split(" (")[0]}:</span>
                        <span className="text-emerald-950 font-black">{cat.activeLabel}</span>
                        <ChevronDown size={12} className={`text-emerald-700 transition-transform ${isPillOpen ? "rotate-180" : ""}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => cat.onClear()}
                        className="px-1.5 py-1 border-l border-emerald-200 text-emerald-700 hover:bg-rose-100 hover:text-rose-700 transition cursor-pointer"
                        title={`Remove ${cat.label}`}
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {/* Popover right under active pill to change value */}
                    {isPillOpen && (
                      <div className="absolute left-0 top-full mt-1.5 z-40 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-2.5 py-1 border-b border-slate-100 mb-1 flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                            Change {cat.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActivePillMenu(null)}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {cat.isCustom ? (
                          <div className="p-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="120"
                                value={tempMinAge}
                                onChange={(e) => setTempMinAge(e.target.value)}
                                placeholder="Min"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:bg-white"
                              />
                              <span className="text-xs text-slate-400 font-bold">to</span>
                              <input
                                type="number"
                                min="0"
                                max="120"
                                value={tempMaxAge}
                                onChange={(e) => setTempMaxAge(e.target.value)}
                                placeholder="Max"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:bg-white"
                              />
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  cat.onClear();
                                  setActivePillMenu(null);
                                }}
                                className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                onClick={() => cat.onSelectAge(tempMinAge, tempMaxAge)}
                                className="rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white px-3 py-1 text-xs font-bold transition cursor-pointer"
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
                            {cat.options.map((opt) => {
                              const isSelected =
                                opt.value === cat.currentValue || (!opt.value && !cat.currentValue);
                              return (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() => cat.onSelect(opt.value)}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                                    isSelected
                                      ? "bg-emerald-100 text-emerald-950 font-bold"
                                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                  }`}
                                >
                                  <span>{opt.label}</span>
                                  {isSelected && <Check size={13} className="text-emerald-700 stroke-[3]" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] font-extrabold text-rose-600 hover:text-rose-700 hover:underline pl-1 cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </section>

        {/* ─── Result Summary & Action Control Bar ─── */}
        <div className="mt-3.5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#00552E]/10 text-[#00552E] font-bold text-xs">
                ✓
              </span>
              <span className="font-extrabold text-slate-800">
                {displayedResidents.length} resident{displayedResidents.length === 1 ? "" : "s"} found
              </span>
              <span className="text-slate-400 text-[11px]">(of {residents.length} total)</span>
            </div>

            {selectedResidentIds.length > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                  {selectedResidentIds.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedResidentIds([])}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {selectedResidentIds.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenPrintModal("purok_simple")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#00552E] hover:bg-[#004224] px-3.5 py-1.5 text-xs font-bold text-white transition shadow-xs cursor-pointer"
              >
                <Printer size={13} />
                <span>Print Selected ({selectedResidentIds.length})</span>
              </button>
            )}

            {/* Show Records Per Page Dropdown */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span>Show:</span>
              <select
                value={Math.min(Math.max(Number(paginationModel.pageSize) || 10, 1), 100)}
                onChange={(e) => {
                  const size = Math.min(Math.max(Number(e.target.value) || 10, 1), 100);
                  setPaginationModel((prev) => ({ ...prev, pageSize: size, page: 0 }));
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 outline-none transition focus:border-[#00552E] cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-slate-400 font-normal">per page</span>
            </div>
          </div>
        </div>

        {/* ─── Resident DataGrid ─── */}
        <div className="gov-datagrid-container overflow-hidden mt-4" style={{ height: 650, width: '100%' }}>
          <DataGrid
            rows={displayedResidents || []}
            columns={columns}
            paginationModel={{
              page: Math.max(Number(paginationModel.page) || 0, 0),
              pageSize: Math.min(Math.max(Number(paginationModel.pageSize) || 10, 1), 100),
            }}
            onPaginationModelChange={(newModel) => {
              setPaginationModel({
                page: Math.max(Number(newModel?.page) || 0, 0),
                pageSize: Math.min(Math.max(Number(newModel?.pageSize) || 10, 1), 100),
              });
            }}
            pageSizeOptions={[10, 20, 50, 100]}
            disableRowSelectionOnClick
            loading={delayedLoading}
            rowHeight={85}
            getRowId={(row) => row?.id || `${Math.random()}`}
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

      {/* ─── Official Print & Report Filter Modal ─── */}
      <FloatingModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Print Resident Master List & Reports"
        eyebrow="Barangay Upper Mingading Official Document"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5 p-1">
          {/* Section 1: Choose Report Layout */}
          <div>
            <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block mb-2">
              1. Select Report Layout & Type
            </label>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {/* Card 1: Purok Master List (Simplified) */}
              <button
                type="button"
                onClick={() =>
                  setPrintConfig((prev) => ({
                    ...prev,
                    reportType: "purok_simple",
                    orientation: "portrait",
                  }))
                }
                className={`relative flex flex-col p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                  printConfig.reportType === "purok_simple"
                    ? "border-emerald-600 bg-emerald-50/90 shadow-md ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-2 rounded-xl ${printConfig.reportType === "purok_simple" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <FileText size={16} />
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Recommended
                  </span>
                </div>
                <div className="font-extrabold text-xs text-slate-900">Purok Master List</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Full Name & Purok only with signature line (Compact & clean)
                </div>
              </button>

              {/* Card 2: Official Full Master List */}
              <button
                type="button"
                onClick={() =>
                  setPrintConfig((prev) => ({
                    ...prev,
                    reportType: "full",
                    orientation: "landscape",
                  }))
                }
                className={`relative flex flex-col p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                  printConfig.reportType === "full"
                    ? "border-emerald-600 bg-emerald-50/90 shadow-md ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-2 rounded-xl ${printConfig.reportType === "full" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <FileSpreadsheet size={16} />
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    Landscape
                  </span>
                </div>
                <div className="font-extrabold text-xs text-slate-900">Full Comprehensive List</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  All 11 demographic & profile columns (Official Barangay Record)
                </div>
              </button>

              {/* Card 3: Grouped by Purok */}
              <button
                type="button"
                onClick={() =>
                  setPrintConfig((prev) => ({
                    ...prev,
                    reportType: "purok_grouped",
                    orientation: "portrait",
                  }))
                }
                className={`relative flex flex-col p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                  printConfig.reportType === "purok_grouped"
                    ? "border-emerald-600 bg-emerald-50/90 shadow-md ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-2 rounded-xl ${printConfig.reportType === "purok_grouped" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Layers size={16} />
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    Grouped
                  </span>
                </div>
                <div className="font-extrabold text-xs text-slate-900">Purok Grouped Sections</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Separated with clear Purok header banners & sub-totals
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Purok Selection & Data Scope */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Filter by Specific Purok */}
            <div>
              <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block mb-1.5">
                2. Filter by Purok
              </label>
              <div className="relative">
                <select
                  value={printConfig.selectedPurok}
                  onChange={(e) =>
                    setPrintConfig((prev) => ({ ...prev, selectedPurok: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white cursor-pointer"
                >
                  <option value="">All Puroks (Upper Mingading)</option>
                  {purokOptions.map((p) => (
                    <option key={p} value={p}>
                      {formatPurok(p)}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Choose a single Purok to print only residents belonging to that Purok.
              </p>
            </div>

            {/* Target Records Scope */}
            <div>
              <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block mb-1.5">
                3. Target Scope
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPrintConfig((prev) => ({ ...prev, scope: "filtered" }))}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition border cursor-pointer ${
                    printConfig.scope === "filtered"
                      ? "border-emerald-600 bg-emerald-100 text-emerald-950 font-extrabold"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Current Filtered ({displayedResidents.length})
                </button>

                {selectedResidentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPrintConfig((prev) => ({ ...prev, scope: "selected" }))}
                    className={`rounded-xl px-3 py-2 text-xs font-bold transition border cursor-pointer ${
                      printConfig.scope === "selected"
                        ? "border-emerald-600 bg-emerald-100 text-emerald-950 font-extrabold"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Selected ({selectedResidentIds.length})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPrintConfig((prev) => ({ ...prev, scope: "all" }))}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition border cursor-pointer ${
                    printConfig.scope === "all"
                      ? "border-emerald-600 bg-emerald-100 text-emerald-950 font-extrabold"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  All Active ({residents.filter((r) => r.status === "Active").length})
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Column Options (For Purok Master List / Grouped) */}
          {printConfig.reportType !== "full" && (
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block">
                Additional Columns & Formatting
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-bold text-slate-800">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printConfig.includeHousehold}
                    onChange={(e) =>
                      setPrintConfig((prev) => ({ ...prev, includeHousehold: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Household #</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printConfig.includeSignatureCol}
                    onChange={(e) =>
                      setPrintConfig((prev) => ({ ...prev, includeSignatureCol: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Signature / Remarks</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printConfig.includeAgeSex}
                    onChange={(e) =>
                      setPrintConfig((prev) => ({ ...prev, includeAgeSex: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Age / Sex</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printConfig.includePhone}
                    onChange={(e) =>
                      setPrintConfig((prev) => ({ ...prev, includePhone: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Contact No.</span>
                </label>
              </div>
            </div>
          )}

          {/* Section 4: Orientation Selector & Signatures Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-700">Orientation:</span>
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setPrintConfig((prev) => ({ ...prev, orientation: "portrait" }))}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    printConfig.orientation === "portrait"
                      ? "bg-[#00552E] text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Portrait (Vertical)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintConfig((prev) => ({ ...prev, orientation: "landscape" }))}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    printConfig.orientation === "landscape"
                      ? "bg-[#00552E] text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Landscape (Horizontal)
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={printConfig.includeOfficials}
                onChange={(e) =>
                  setPrintConfig((prev) => ({ ...prev, includeOfficials: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span>Include Official Barangay Signatures</span>
            </label>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowPrintModal(false)}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecutePrint}
              className="flex-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#044E35] via-[#057A55] to-[#046C4E] hover:from-[#033E2B] hover:to-[#035438] px-5 py-2.5 text-xs font-extrabold text-white transition-all shadow-md shadow-emerald-950/20 active:scale-95 cursor-pointer"
            >
              <Printer size={16} />
              <span>Generate & Print Master List</span>
            </button>
          </div>
        </div>
      </FloatingModal>

      {/* ─── Dynamic Purok Management Modal ─── */}
      <FloatingModal
        isOpen={showPurokModal}
        onClose={() => {
          setShowPurokModal(false);
          setPurokModalTab("list");
          setEditingPurokItem(null);
          setPurokManagerMsg(null);
        }}
        title="Barangay Purok Management"
        icon={MapPin}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <p className="text-xs font-bold text-slate-800">Customize Barangay Puroks</p>
              <p className="text-[11px] text-slate-500">
                Add new puroks, rename existing ones, or adjust labels dynamically.
              </p>
            </div>
            {purokModalTab === "list" ? (
              <button
                type="button"
                onClick={() => {
                  setPurokModalTab("add");
                  setPurokFormName("");
                  setPurokFormColor("emerald");
                  setPurokManagerMsg(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus size={14} />
                <span>Add New Purok</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPurokModalTab("list");
                  setEditingPurokItem(null);
                  setPurokManagerMsg(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back to List</span>
              </button>
            )}
          </div>

          {purokManagerMsg && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                purokManagerMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {purokManagerMsg.type === "success" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              <span>{purokManagerMsg.text}</span>
            </div>
          )}

          {purokModalTab === "list" && (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {customPuroks.map((purok, idx) => {
                const residentCount = residents.filter((r) => normalizePurokValue(r.purok) === normalizePurokValue(purok.value)).length;
                return (
                  <div
                    key={purok.id || purok.value}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-emerald-200 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">
                          {purok.label || formatPurok(purok.value)}
                        </div>
                        <div className="text-[10.5px] font-semibold text-slate-500">
                          System value: <code className="bg-slate-200/60 px-1 py-0.5 rounded text-[10px] text-slate-700">{purok.value}</code> • {residentCount} registered residents
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPurokItem(purok);
                          setPurokFormName(purok.label || formatPurok(purok.value));
                          setPurokFormColor(purok.color || "emerald");
                          setPurokModalTab("edit");
                          setPurokManagerMsg(null);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 transition cursor-pointer"
                        title="Edit Purok Name"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const purokName = purok.label || formatPurok(purok.value);
                          const ok = await confirm({
                            title: `Delete Purok "${purokName}"?`,
                            message: `Are you sure you want to remove this purok? There are currently ${residentCount} residents registered in this purok.`,
                            confirmText: "Delete Purok",
                            cancelText: "Cancel",
                            variant: "danger",
                            icon: Trash2,
                          });
                          if (!ok) return;
                          try {
                            deleteCustomPurok(purok.id || purok.value || purok.label);
                            refreshCustomPuroks();
                            setPurokManagerMsg({ type: "success", text: `Purok "${purokName}" deleted successfully.` });
                          } catch (err) {
                            setPurokManagerMsg({ type: "error", text: err.message || "Failed to delete purok." });
                          }
                        }}
                        className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition cursor-pointer"
                        title="Delete Purok"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Reset to Default Puroks?",
                      message: "This will restore the original 7 barangay puroks (Purok 1 to Purok 7).",
                      confirmText: "Reset Defaults",
                      cancelText: "Cancel",
                      variant: "warning",
                      icon: RotateCcw,
                    });
                    if (!ok) return;
                    resetCustomPuroks();
                    refreshCustomPuroks();
                    setPurokManagerMsg({ type: "success", text: "Reset to default purok list." });
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-rose-700 transition cursor-pointer"
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={() => setShowPurokModal(false)}
                  className="rounded-xl bg-slate-900 text-white px-4 py-1.5 text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {(purokModalTab === "add" || purokModalTab === "edit") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!purokFormName.trim()) {
                  setPurokManagerMsg({ type: "error", text: "Please enter a valid Purok name." });
                  return;
                }
                try {
                  if (purokModalTab === "add") {
                    addCustomPurok(purokFormName.trim(), purokFormColor);
                    refreshCustomPuroks();
                    setPurokManagerMsg({ type: "success", text: `Purok "${purokFormName.trim()}" added successfully!` });
                    setPurokModalTab("list");
                  } else if (purokModalTab === "edit" && editingPurokItem) {
                    updateCustomPurok(editingPurokItem.id || editingPurokItem.value || editingPurokItem.label, purokFormName.trim(), purokFormColor);
                    refreshCustomPuroks();
                    setPurokManagerMsg({ type: "success", text: `Purok updated to "${purokFormName.trim()}"!` });
                    setPurokModalTab("list");
                  }
                } catch (err) {
                  setPurokManagerMsg({ type: "error", text: err.message || "Failed to save purok." });
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Purok Name / Title *
                </label>
                <input
                  type="text"
                  value={purokFormName}
                  onChange={(e) => setPurokFormName(e.target.value)}
                  placeholder="e.g. Purok 8 - Bagong Silang or Purok Sunflower"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="text-[10.5px] text-slate-400 mt-1 block">
                  This name will appear in dropdowns, resident records, and printable master lists.
                </span>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setPurokModalTab("list");
                    setEditingPurokItem(null);
                  }}
                  className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {purokModalTab === "add" ? "Save New Purok" : "Update Purok"}
                </button>
              </div>
            </form>
          )}
        </div>
      </FloatingModal>

      {/* ─── Ultra-HD Professional Resident Profile Sheet Modal ─── */}
      <FloatingModal
        isOpen={showViewModal && Boolean(viewingResident)}
        onClose={() => {
          setShowViewModal(false);
          setViewingResident(null);
          setViewPasswordVisible(false);
        }}
        title="Official Resident Profile Sheet"
        eyebrow="Barangay Upper Mingading • Resident Registry"
        description="Comprehensive biometric, civil, demographic, and portal identity profile"
        maxWidth="max-w-3xl"
      >
        {viewingResident && (
          <div className="space-y-4 text-slate-800">
            {/* HD Header Identity Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003B1F] via-[#00552E] to-[#046C4E] p-5 text-white shadow-xl shadow-emerald-950/20 border border-emerald-400/20">
              {/* Ambient Glow Effects */}
              <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-emerald-300/15 blur-3xl" />

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* High-Resolution Avatar Pill */}
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 border-2 border-white/40 text-white font-black text-2xl shadow-lg backdrop-blur-md">
                    {(viewingResident.first_name?.[0] || "") + (viewingResident.last_name?.[0] || "R")}
                    <div
                      className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-[#00552E] flex items-center justify-center ${
                        viewingResident.status === "Inactive" || viewingResident.status === "Archived"
                          ? "bg-rose-500"
                          : "bg-emerald-400"
                      }`}
                      title={`Status: ${viewingResident.status || "Active"}`}
                    >
                      <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg sm:text-xl font-black tracking-tight text-white drop-shadow-xs">
                        {getResidentDisplayName(viewingResident)}
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-md text-emerald-100 border border-white/30 px-2.5 py-0.5 text-[11px] font-extrabold">
                        <CheckCircle size={11} className="text-emerald-300" />
                        {viewingResident.status || "Active"}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-100/90 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} className="text-emerald-300 shrink-0" />
                        Purok {formatPurok(viewingResident.purok)}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Home size={13} className="text-emerald-300 shrink-0" />
                        Household #{viewingResident.household_no || viewingResident.house_no || "-"}
                      </span>
                      <span>•</span>
                      <span>
                        {getResidentAge(viewingResident) ?? "-"} yrs old ({viewingResident.sex || viewingResident.gender || "-"})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Category Tags Container */}
                <div className="flex flex-wrap gap-1.5 sm:max-w-xs sm:justify-end">
                  {getResidentCategoryTags(viewingResident).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-xl bg-white/15 backdrop-blur-md border border-white/25 text-white px-2.5 py-1 text-[10.5px] font-black shadow-xs tracking-wide uppercase"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Structured HD Profile Sections */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* 1. Personal Information */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-emerald-200 transition">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                    <UserCheck size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Personal Demographics
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">Birth and civil identity</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">Age & Sex</span>
                    <span className="font-black text-slate-900 text-sm">
                      {getResidentAge(viewingResident) ?? "-"} yrs <span className="text-slate-400 font-normal">/</span> {viewingResident.sex || viewingResident.gender || "-"}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">Civil Status</span>
                    <span className="font-black text-slate-900 text-sm">{viewingResident.civil_status || "Single"}</span>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">Date of Birth</span>
                    <span className="font-bold text-slate-800 text-xs">
                      {viewingResident.birthday ? new Date(viewingResident.birthday).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">Place of Birth</span>
                    <span className="font-bold text-slate-800 text-xs truncate block" title={viewingResident.birthplace}>
                      {viewingResident.birthplace || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Household & Residence */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-emerald-200 transition">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                    <Home size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Household & Residence
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">Family and barangay location</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">Household Role</span>
                    <span className="font-black text-slate-900 text-sm">{viewingResident.relationship_to_household_head || "Head"}</span>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">House / HH No.</span>
                    <span className="font-black text-slate-900 text-sm font-mono">{viewingResident.household_no || viewingResident.house_no || "-"}</span>
                  </div>

                  <div className="col-span-2 rounded-xl bg-emerald-50/60 p-2.5 border border-emerald-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block mb-0.5">Complete Registered Address</span>
                    <p className="font-extrabold text-emerald-950 text-xs leading-relaxed">
                      {viewingResident.address || buildCompleteAddress(viewingResident.purok)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Education & Occupation */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-emerald-200 transition">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                    <GraduationCap size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Education & Occupation
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">Academic and livelihood profile</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">Attainment</span>
                      <span className="font-black text-slate-900">{viewingResident.educational_attainment || "Not specified"}</span>
                    </div>
                    <GraduationCap size={18} className="text-slate-300 shrink-0 ml-2" />
                  </div>

                  <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">Primary Occupation</span>
                      <span className="font-black text-slate-900">{viewingResident.occupation || "None / Unemployed"}</span>
                    </div>
                    <Briefcase size={18} className="text-slate-300 shrink-0 ml-2" />
                  </div>
                </div>
              </div>

              {/* 4. Special Sector Classifications */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-emerald-200 transition">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                    <Tag size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Sector Classifications
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">Government program qualifications</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`rounded-xl p-2.5 border transition ${
                    getResidentAge(viewingResident) >= 60
                      ? "bg-amber-50/80 border-amber-200 text-amber-950"
                      : "bg-slate-50 border-slate-100 text-slate-600"
                  }`}>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-70 mb-0.5">Senior (60+)</span>
                    <span className="font-black text-xs">{getResidentAge(viewingResident) >= 60 ? "Qualified" : "No"}</span>
                  </div>

                  <div className={`rounded-xl p-2.5 border transition ${
                    viewingResident.is_4ps_member
                      ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                      : "bg-slate-50 border-slate-100 text-slate-600"
                  }`}>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-70 mb-0.5">4Ps Beneficiary</span>
                    <span className="font-black text-xs">{viewingResident.is_4ps_member ? "Active Member" : "No"}</span>
                  </div>

                  <div className={`rounded-xl p-2.5 border transition ${
                    viewingResident.is_solo_parent
                      ? "bg-purple-50/80 border-purple-200 text-purple-950"
                      : "bg-slate-50 border-slate-100 text-slate-600"
                  }`}>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-70 mb-0.5">Solo Parent</span>
                    <span className="font-black text-xs">{viewingResident.is_solo_parent ? "Registered" : "No"}</span>
                  </div>

                  <div className={`rounded-xl p-2.5 border transition ${
                    viewingResident.is_pwd
                      ? "bg-rose-50/80 border-rose-200 text-rose-950"
                      : "bg-slate-50 border-slate-100 text-slate-600"
                  }`}>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-70 mb-0.5">PWD Status</span>
                    <span className="font-black text-xs truncate block" title={viewingResident.pwd_type}>
                      {viewingResident.is_pwd ? (viewingResident.pwd_type || "Yes") : "No"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Citizen Portal Credentials & Contact Information */}
            <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/80 via-emerald-50/40 to-white p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-800 text-white">
                    <UserCheck size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                      Citizen Portal Credentials & Hotline
                    </h4>
                    <p className="text-[10px] text-emerald-700 font-medium">Resident authentication and direct mobile contact</p>
                  </div>
                </div>

                <span className="rounded-full bg-emerald-200/80 text-emerald-950 border border-emerald-300/80 px-2.5 py-0.5 text-[10.5px] font-extrabold shadow-2xs">
                  Portal {getPortalAccountStatus(viewingResident)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Phone */}
                <div className="rounded-xl bg-white p-2.5 border border-emerald-200/70 shadow-2xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block mb-0.5">Mobile Hotline</span>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 font-mono text-sm">
                      {viewingResident.phone || "-"}
                    </span>
                    {viewingResident.phone && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(viewingResident.phone);
                          showAdminSystemToast("Phone number copied to clipboard", "success");
                        }}
                        className="p-1 rounded-md text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                        title="Copy phone"
                      >
                        <Copy size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Portal Username */}
                <div className="rounded-xl bg-white p-2.5 border border-emerald-200/70 shadow-2xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block mb-0.5">Portal Username</span>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 font-mono text-sm truncate max-w-[140px]">
                      {getPortalUsername(viewingResident)}
                    </span>
                    {getPortalUsername(viewingResident) && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(getPortalUsername(viewingResident));
                          showAdminSystemToast("Username copied to clipboard", "success");
                        }}
                        className="p-1 rounded-md text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                        title="Copy username"
                      >
                        <Copy size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Portal Password */}
                <div className="rounded-xl bg-white p-2.5 border border-emerald-200/70 shadow-2xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block mb-0.5">Portal Password</span>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 font-mono text-sm tracking-wider">
                      {viewPasswordVisible
                        ? getResidentPortalPassword(viewingResident)
                        : "••••••••••••"}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewPasswordVisible(!viewPasswordVisible)}
                        className="p-1 rounded-md text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                        title={viewPasswordVisible ? "Hide password" : "Show password"}
                      >
                        {viewPasswordVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const pass = getResidentPortalPassword(viewingResident);
                          if (pass) {
                            navigator.clipboard.writeText(pass);
                            showAdminSystemToast("Password copied to clipboard", "success");
                          }
                        }}
                        className="p-1 rounded-md text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                        title="Copy password"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setShowViewModal(false);
                    handleEditResident(viewingResident);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#00552E] hover:bg-[#004224] text-white px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                >
                  <Edit2 size={14} />
                  <span>Edit Resident Record</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    generateResidentPrintReport([viewingResident], getResidentDisplayName(viewingResident), {
                      reportType: "purok_simple",
                      orientation: "portrait",
                      selectedPurok: viewingResident.purok || "",
                      includeHousehold: true,
                      includeAgeSex: true,
                      includePhone: true,
                      includeSignatureCol: true,
                      includeOfficials: true,
                      customTitle: `OFFICIAL RESIDENT PROFILE - ${getResidentDisplayName(viewingResident)}`,
                    });
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 text-xs font-bold transition shadow-2xs cursor-pointer"
                  title="Print official resident profile sheet"
                >
                  <Printer size={14} className="text-[#00552E]" />
                  <span>Print Sheet</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowViewModal(false);
                  setViewingResident(null);
                }}
                className="w-full sm:w-auto rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </FloatingModal>
    </>
  );
};

export default ResidentsManagement;
