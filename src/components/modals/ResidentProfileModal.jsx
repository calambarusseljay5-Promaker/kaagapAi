import { useState } from "react";
import {
  X,
  UserCheck,
  MapPin,
  Home,
  CheckCircle,
  GraduationCap,
  Briefcase,
  Tag,
  Copy,
  Eye,
  EyeOff,
  Edit2,
  Printer,
  User,
} from "lucide-react";
import FloatingModal from "../FloatingModal";
import {
  getResidentDisplayName,
  getResidentAge,
  getResidentCategoryTags,
  getPortalUsername,
  getPortalAccountStatus,
  getResidentPortalPassword,
  formatPurok,
  buildCompleteAddress,
} from "../../utils/residentProfile";

export default function ResidentProfileModal({
  isOpen,
  onClose,
  resident,
  onEdit,
}) {
  const [viewPasswordVisible, setViewPasswordVisible] = useState(false);
  const [copiedField, setCopiedField] = useState("");

  if (!resident) return null;

  const displayName = getResidentDisplayName(resident);
  const age = getResidentAge(resident);
  const categoryTags = getResidentCategoryTags(resident);
  const portalStatus = getPortalAccountStatus(resident);
  const portalUsername = getPortalUsername(resident);
  const portalPassword = getResidentPortalPassword(resident);

  // Compute initials cleanly
  const getInitials = (name) => {
    if (!name) return "R";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleCopy = (text, fieldName) => {
    if (!text || text === "-") return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(""), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Resident Profile - ${displayName}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; }
          h1 { font-size: 20pt; text-align: center; text-transform: uppercase; margin-bottom: 4px; }
          h2 { font-size: 13pt; text-align: center; font-weight: normal; margin-top: 0; color: #555; }
          .section { margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 12px; }
          .section-title { font-size: 12pt; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; color: #166534; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 11pt; }
          .label { font-size: 9pt; text-transform: uppercase; color: #666; font-weight: bold; }
          .val { font-size: 11pt; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Republic of the Philippines</h1>
        <h2>Barangay Upper Mingading • Resident Profile Sheet</h2>
        <hr/>
        <div class="section">
          <div class="section-title">Resident Identification</div>
          <div class="grid">
            <div><span class="label">Full Name:</span> <div class="val">${displayName}</div></div>
            <div><span class="label">Status:</span> <div class="val">${resident.status || "Active"}</div></div>
            <div><span class="label">Purok:</span> <div class="val">Purok ${formatPurok(resident.purok)}</div></div>
            <div><span class="label">Household #:</span> <div class="val">${resident.household_no || resident.house_no || "-"}</div></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Personal Demographics</div>
          <div class="grid">
            <div><span class="label">Age & Gender:</span> <div class="val">${age ?? "-"} yrs old / ${resident.sex || resident.gender || "-"}</div></div>
            <div><span class="label">Civil Status:</span> <div class="val">${resident.civil_status || "Single"}</div></div>
            <div><span class="label">Birthdate:</span> <div class="val">${resident.birthday || "-"}</div></div>
            <div><span class="label">Birthplace:</span> <div class="val">${resident.birthplace || "-"}</div></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Residence & Occupation</div>
          <div class="grid">
            <div><span class="label">Address:</span> <div class="val">${resident.address || buildCompleteAddress(resident.purok)}</div></div>
            <div><span class="label">Occupation:</span> <div class="val">${resident.occupation || "None / Unemployed"}</div></div>
            <div><span class="label">Education:</span> <div class="val">${resident.educational_attainment || "Not specified"}</div></div>
            <div><span class="label">4Ps / Senior / Solo Parent:</span> <div class="val">${categoryTags.join(", ") || "Standard"}</div></div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <FloatingModal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Resident Profile Sheet"
      eyebrow="Barangay Upper Mingading • Resident Registry"
      description="Comprehensive biometric, civil, demographic, and portal identity profile"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4 text-slate-800">
        {/* ── 1. HD HEADER IDENTITY CARD (Vibrant Emerald with Ultra-Sharp Contrast) ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#064E3B] via-[#046C4E] to-[#022C22] p-5 text-white shadow-xl shadow-emerald-950/30 border-2 border-emerald-400/30">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* High-Resolution Avatar / Photo Box */}
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-950/90 border-2 border-emerald-300/60 text-white font-black text-xl shadow-xl overflow-hidden">
                {resident.photo_url || resident.photo ? (
                  <img
                    src={resident.photo_url || resident.photo}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-emerald-100 font-black tracking-wider text-xl drop-shadow-sm">
                    {getInitials(displayName)}
                  </span>
                )}
                {/* Live Pulse Indicator */}
                <div
                  className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-[#064E3B] flex items-center justify-center ${
                    resident.status === "Inactive" || resident.status === "Archived"
                      ? "bg-rose-500"
                      : "bg-emerald-400"
                  }`}
                  title={`Status: ${resident.status || "Active"}`}
                >
                  <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-black tracking-tight text-white drop-shadow-md">
                    {displayName}
                  </h3>
                  {/* Status Pill - High Contrast */}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-400/50 px-3 py-0.5 text-[11px] font-black shadow-md">
                    <CheckCircle size={12} className="text-emerald-400" />
                    <span>{resident.status || "Active"}</span>
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-100 font-semibold drop-shadow-xs">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} className="text-emerald-300 shrink-0" />
                    Purok {formatPurok(resident.purok)}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Home size={13} className="text-emerald-300 shrink-0" />
                    Household #{resident.household_no || resident.house_no || "-"}
                  </span>
                  <span>•</span>
                  <span>
                    {age ?? "-"} yrs old ({resident.sex || resident.gender || "-"})
                  </span>
                </div>
              </div>
            </div>

            {/* Category Tags Container (Senior, 4Ps, Youth, Solo Parent, PWD) - High Contrast Dark Glass */}
            <div className="flex flex-wrap gap-1.5 sm:max-w-xs sm:justify-end">
              {categoryTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-xl bg-emerald-950/90 border border-emerald-400/50 text-emerald-200 px-3 py-1 text-[11px] font-black shadow-md tracking-wider uppercase flex items-center gap-1.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  <span>{tag}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── 2. STRUCTURED PROFILE SECTIONS ── */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Section 1: Personal Demographics */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-200 transition">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <UserCheck size={15} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Personal Demographics
                </h4>
                <p className="text-[10px] text-slate-500 font-semibold">Birth and civil identity</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-0.5">Age & Sex</span>
                <span className="font-black text-slate-900 text-sm">
                  {age ?? "-"} yrs <span className="text-slate-400 font-normal">/</span> {resident.sex || resident.gender || "-"}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-0.5">Civil Status</span>
                <span className="font-black text-slate-900 text-sm">{resident.civil_status || "Single"}</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-0.5">Date of Birth</span>
                <span className="font-bold text-slate-800 text-xs">
                  {resident.birthday ? new Date(resident.birthday).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-0.5">Place of Birth</span>
                <span className="font-bold text-slate-800 text-xs truncate block" title={resident.birthplace}>
                  {resident.birthplace || "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Household & Residence */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-200 transition">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <Home size={15} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Household & Residence
                </h4>
                <p className="text-[10px] text-slate-500 font-semibold">Family and barangay location</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-0.5">Household Role</span>
                <span className="font-black text-slate-900 text-sm">{resident.relationship_to_household_head || "Head"}</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-0.5">House / HH No.</span>
                <span className="font-black text-slate-900 text-sm font-mono">{resident.household_no || resident.house_no || "-"}</span>
              </div>

              <div className="col-span-2 rounded-xl bg-emerald-50/80 p-2.5 border border-emerald-200">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 block mb-0.5">Complete Registered Address</span>
                <p className="font-black text-emerald-950 text-xs leading-relaxed">
                  {resident.address || buildCompleteAddress(resident.purok)}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Education & Occupation */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-200 transition">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <GraduationCap size={15} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Education & Occupation
                </h4>
                <p className="text-[10px] text-slate-500 font-semibold">Academic and livelihood profile</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-0.5">Attainment</span>
                  <span className="font-black text-slate-900">{resident.educational_attainment || "Not specified"}</span>
                </div>
                <GraduationCap size={18} className="text-slate-400 shrink-0 ml-2" />
              </div>

              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-0.5">Primary Occupation</span>
                  <span className="font-black text-slate-900">{resident.occupation || "None / Unemployed"}</span>
                </div>
                <Briefcase size={18} className="text-slate-400 shrink-0 ml-2" />
              </div>
            </div>
          </div>

          {/* Section 4: Special Sector Classifications */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-200 transition">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <Tag size={15} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Sector Classifications
                </h4>
                <p className="text-[10px] text-slate-500 font-semibold">Government program qualifications</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`rounded-xl p-2.5 border transition ${
                age >= 60
                  ? "bg-amber-50 border-amber-300 text-amber-950"
                  : "bg-slate-50 border-slate-100 text-slate-600"
              }`}>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-75 mb-0.5">Senior (60+)</span>
                <span className="font-black text-xs">{age >= 60 ? "Qualified" : "No"}</span>
              </div>

              <div className={`rounded-xl p-2.5 border transition ${
                resident.is_4ps_member
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                  : "bg-slate-50 border-slate-100 text-slate-600"
              }`}>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-75 mb-0.5">4Ps Beneficiary</span>
                <span className="font-black text-xs">{resident.is_4ps_member ? "Active Member" : "No"}</span>
              </div>

              <div className={`rounded-xl p-2.5 border transition ${
                resident.is_solo_parent
                  ? "bg-purple-50 border-purple-300 text-purple-950"
                  : "bg-slate-50 border-slate-100 text-slate-600"
              }`}>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-75 mb-0.5">Solo Parent</span>
                <span className="font-black text-xs">{resident.is_solo_parent ? "Registered" : "No"}</span>
              </div>

              <div className={`rounded-xl p-2.5 border transition ${
                resident.is_pwd
                  ? "bg-rose-50 border-rose-300 text-rose-950"
                  : "bg-slate-50 border-slate-100 text-slate-600"
              }`}>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-75 mb-0.5">PWD Status</span>
                <span className="font-black text-xs truncate block" title={resident.pwd_type}>
                  {resident.is_pwd ? (resident.pwd_type || "Yes") : "No"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. CITIZEN PORTAL CREDENTIALS ── */}
        <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-emerald-200 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-800 text-white shadow-xs">
                <UserCheck size={15} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                  Citizen Portal Credentials & Hotline
                </h4>
                <p className="text-[10px] text-emerald-800 font-semibold">Resident authentication and direct mobile contact</p>
              </div>
            </div>

            <span className="rounded-full bg-emerald-200 text-emerald-950 border border-emerald-400 px-3 py-0.5 text-[10.5px] font-black shadow-2xs">
              Portal {portalStatus}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Mobile Hotline */}
            <div className="rounded-xl bg-white p-2.5 border border-emerald-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block mb-0.5">Mobile Hotline</span>
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-900 font-mono text-sm">
                  {resident.phone || "-"}
                </span>
                {resident.phone && (
                  <button
                    type="button"
                    onClick={() => handleCopy(resident.phone, "phone")}
                    className="p-1 rounded-md text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                    title="Copy phone"
                  >
                    <Copy size={13} />
                  </button>
                )}
              </div>
              {copiedField === "phone" && <span className="text-[9px] text-emerald-600 font-bold">Copied!</span>}
            </div>

            {/* Portal Username */}
            <div className="rounded-xl bg-white p-2.5 border border-emerald-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block mb-0.5">Portal Username</span>
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-900 font-mono text-sm truncate max-w-[140px]">
                  {portalUsername}
                </span>
                {portalUsername && portalUsername !== "-" && (
                  <button
                    type="button"
                    onClick={() => handleCopy(portalUsername, "username")}
                    className="p-1 rounded-md text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                    title="Copy username"
                  >
                    <Copy size={13} />
                  </button>
                )}
              </div>
              {copiedField === "username" && <span className="text-[9px] text-emerald-600 font-bold">Copied!</span>}
            </div>

            {/* Portal Password */}
            <div className="rounded-xl bg-white p-2.5 border border-emerald-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block mb-0.5">Portal Password</span>
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-900 font-mono text-sm tracking-wider">
                  {viewPasswordVisible ? portalPassword : "••••••••••••"}
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
                    onClick={() => handleCopy(portalPassword, "password")}
                    className="p-1 rounded-md text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                    title="Copy password"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
              {copiedField === "password" && <span className="text-[9px] text-emerald-600 font-bold">Copied!</span>}
            </div>
          </div>
        </div>

        {/* ── 4. ACTIONS BAR ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(resident);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#00552E] hover:bg-[#004224] text-white px-4 py-2 text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
              >
                <Edit2 size={14} />
                <span>Edit Resident Record</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 px-3.5 py-2 text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Print official resident profile sheet"
            >
              <Printer size={14} className="text-[#00552E]" />
              <span>Print Sheet</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </FloatingModal>
  );
}
