import { useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  Crown,
  Edit2,
  FileText,
  Calculator,
  Users,
  ImagePlus,
  Mail,
  MapPin,
  Phone,
  Printer,
  RotateCcw,
  Sparkles,
  User,
  X,
  AlertTriangle,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import FloatingModal from "../components/FloatingModal";
import {
  DEFAULT_ORGANIZATION_OFFICIALS,
  getOrganizationOfficials,
  fetchOrganizationOfficials,
  resetOrganizationOfficials,
  saveOrganizationOfficials,
} from "../services/organizationService";

const PHOTO_MAX_FILE_SIZE = 8 * 1024 * 1024;
const PHOTO_MAX_SIZE = 420;
const ALEOSAN_LOGO_SRC = "/aleosan.logo.png";
const BARANGAY_LOGO_SRC = "/logo.png";

const fieldClass =
  "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/20";

const initialsFromName = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "BO";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttribute = (value) => escapeHtml(value).replace(/`/g, "&#96;");

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image file."));
    image.src = src;
  });

const compressOfficialPhoto = async (file) => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }

  if (file.size > PHOTO_MAX_FILE_SIZE) {
    throw new Error("Photo must be 8 MB or smaller.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, PHOTO_MAX_SIZE / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  const width = Math.max(1, Math.round((image.naturalWidth || PHOTO_MAX_SIZE) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || PHOTO_MAX_SIZE) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.84);
};

const Avatar = ({ official, size = "md", borderTheme = "gold" }) => {
  const isCaptain = official?.level === "captain";
  const dimensionClass =
    size === "lg"
      ? "h-[120px] w-[120px]"
      : size === "md"
      ? "h-[84px] w-[84px]"
      : size === "sm"
      ? "h-[64px] w-[64px]"
      : "h-[50px] w-[50px]";
  const textClass = size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-sm";

  const ringClass =
    borderTheme === "gold"
      ? "ring-4 ring-amber-400 shadow-amber-500/30"
      : borderTheme === "blue"
      ? "ring-4 ring-cyan-400 shadow-cyan-500/30"
      : borderTheme === "purple"
      ? "ring-4 ring-fuchsia-400 shadow-purple-500/30"
      : "ring-4 ring-lime-400 shadow-lime-500/30";

  if (official?.photoUrl) {
    return (
      <span
        className={`relative block shrink-0 overflow-hidden rounded-full border-2 border-white shadow-lg mx-auto bg-slate-900 ${ringClass} ${dimensionClass}`}
      >
        <img src={official.photoUrl} alt={official.name || "Official"} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full font-black shadow-lg mx-auto border-2 border-white bg-gradient-to-br from-slate-800 to-slate-950 text-white ${ringClass} ${textClass} ${dimensionClass}`}
    >
      {isCaptain ? (
        <Crown size={size === "lg" ? 44 : size === "md" ? 30 : 22} className="text-amber-400" />
      ) : (
        <User size={size === "lg" ? 40 : size === "md" ? 28 : 20} className="text-slate-300" />
      )}
    </span>
  );
};

/* ─── Level 1: Captain Card ─── */
const CaptainCard = ({ official, onClick }) => {
  if (!official) return null;

  return (
    <div
      onClick={() => onClick(official)}
      className="group relative cursor-pointer transition-all duration-300 hover:scale-[1.03] active:scale-[0.99] select-none z-10"
    >
      <div className="flex items-center gap-4 rounded-3xl border-2 border-amber-400 bg-gradient-to-r from-emerald-950/95 via-emerald-900/90 to-slate-950/95 p-3 pr-7 shadow-2xl shadow-emerald-950/80 backdrop-blur-xl ring-2 ring-amber-300/30">
        <div className="relative">
          <Avatar official={official} size="md" borderTheme="gold" />
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-slate-950 ring-2 ring-white shadow">
            <Crown size={13} className="fill-slate-950" />
          </div>
        </div>

        <div className="flex flex-col text-left">
          <div className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 px-6 py-1 text-xs font-black uppercase tracking-[0.16em] text-white shadow-md border border-blue-300/40">
            CAPTAIN
          </div>
          <div className="mt-1.5 rounded-lg bg-white/95 px-3 py-1 text-center shadow-sm">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-600">
              Barangay Captain
            </div>
            <div className="text-xs font-black text-slate-950 truncate max-w-[210px]">
              {official.name}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Level 2: Kagawad Card ─── */
const KagawadCard = ({ official, index, onClick }) => {
  const kagawadNumber = index + 1;

  return (
    <div
      onClick={() => onClick(official)}
      className="group relative flex flex-col items-center cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:scale-105 active:scale-95 select-none w-full"
    >
      <div className="relative flex flex-col items-center w-full rounded-2xl border border-lime-400/50 bg-gradient-to-b from-emerald-950/90 via-emerald-900/90 to-slate-950/95 p-2.5 pt-3.5 shadow-xl shadow-emerald-950/70 backdrop-blur-md">
        <Avatar official={official} size="sm" borderTheme="lime" />

        <div className="mt-2 w-full text-center px-1">
          <p className="text-[10.5px] font-black text-white truncate group-hover:text-amber-300 transition-colors" title={official.name}>
            {official.name}
          </p>
        </div>

        <div className="mt-2 w-full">
          <div className="rounded-lg bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-1 px-1 text-center shadow border border-yellow-200">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-950 flex items-center justify-center gap-0.5">
              <span>★</span>
              <span>KAGAWAD {kagawadNumber}</span>
              <span>★</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Level 3: Bottom Officers ─── */
const OfficerCard = ({ official, roleType, onClick }) => {
  if (!official) return null;

  const themeConfig = {
    secretary: {
      title: "SECRETARY",
      subTitle: "Barangay Secretary",
      gradient: "from-amber-500 via-yellow-400 to-amber-500",
      border: "border-amber-400",
      avatarTheme: "gold",
    },
    treasurer: {
      title: "TREASURER",
      subTitle: "Barangay Treasurer",
      gradient: "from-blue-600 via-cyan-500 to-blue-600",
      border: "border-cyan-400",
      avatarTheme: "blue",
    },
    sk: {
      title: "SK CHAIRMAN",
      subTitle: "SK Chairman",
      gradient: "from-purple-600 via-fuchsia-500 to-purple-600",
      border: "border-fuchsia-400",
      avatarTheme: "purple",
    },
  };

  const theme = themeConfig[roleType] || themeConfig.secretary;

  return (
    <div
      onClick={() => onClick(official)}
      className="group relative flex flex-col items-center cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:scale-105 active:scale-95 select-none w-full"
    >
      <div className={`relative flex flex-col items-center w-full rounded-2xl border ${theme.border} bg-gradient-to-b from-slate-950/95 via-emerald-950/90 to-black/95 p-3 shadow-xl backdrop-blur-md`}>
        <Avatar official={official} size="sm" borderTheme={theme.avatarTheme} />

        <div className="mt-2 w-full">
          <div className={`rounded-lg bg-gradient-to-r ${theme.gradient} py-1 px-2 text-center shadow border border-white/40`}>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-950">
              {theme.title}
            </span>
          </div>
        </div>

        <div className="mt-1.5 w-full rounded-lg bg-white/95 py-1 px-2 text-center shadow-inner">
          <p className="text-[9px] font-extrabold uppercase text-slate-600">
            {theme.subTitle}
          </p>
          <p className="text-[11px] font-black text-slate-950 truncate max-w-[160px]" title={official.name}>
            {official.name}
          </p>
        </div>
      </div>
    </div>
  );
};

const findOfficialById = (officials, officialId) =>
  officials.find((official) => official.id === officialId) ||
  DEFAULT_ORGANIZATION_OFFICIALS.find((official) => official.id === officialId) ||
  null;

const printAvatarMarkup = (official) => {
  if (official.photoUrl) {
    return `<img class="avatar" src="${escapeAttribute(official.photoUrl)}" alt="" />`;
  }

  return `<div class="avatar initials">${official.level === "captain" ? "PB" : escapeHtml(initialsFromName(official.name))}</div>`;
};

const printOfficialCard = (official, modifier = "") => `
  <article class="official-card ${modifier}">
    ${printAvatarMarkup(official)}
    <div>
      <h3>${escapeHtml(official.name)}</h3>
      <p class="position">${escapeHtml(official.position)}</p>
      <p class="committee">${escapeHtml(official.committee)}</p>
      <p class="focus">${escapeHtml(official.focusArea)}</p>
    </div>
  </article>
`;

const getPrintMarkup = (officials) => {
  const captain = officials.find((official) => official.level === "captain") || officials[0];
  const staff = officials.filter((official) => official.level === "staff");
  const skOfficials = officials.filter((official) => official.level === "sk");
  const supportOfficials = [...staff, ...skOfficials];
  const kagawads = officials.filter((official) => official.level === "kagawad");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Barangay Upper Mingading - Organizational Chart</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: Arial, sans-serif; }
    body { padding: 0.35in; }
    .page { width: 100%; min-height: 100%; }
    .header { display: grid; grid-template-columns: 96px minmax(0, 1fr) 96px; align-items: center; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 16px; }
    .header-title { text-align: center; }
    .logo-slot { display: flex; min-height: 72px; align-items: center; justify-content: center; }
    .eyebrow { margin: 0 0 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #0f766e; }
    h1 { margin: 0; font-size: 26px; letter-spacing: 0.02em; }
    .meta { margin: 5px 0 0; font-size: 12px; color: #475569; }
    .seal { width: 72px; height: 72px; object-fit: contain; }
    .section-label { margin: 18px 0 9px; font-size: 11px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: #334155; }
    .captain { max-width: 480px; margin: 18px auto 0; border-color: #92400e; background: #fffbeb; }
    .support-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .kagawad-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .official-card { min-height: 106px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; display: grid; grid-template-columns: 54px minmax(0, 1fr); gap: 10px; break-inside: avoid; }
    .avatar { width: 54px; height: 54px; border-radius: 9px; object-fit: cover; background: #0f172a; color: #ecfeff; display: grid; place-items: center; font-weight: 800; }
    .initials { font-size: 14px; }
    h3 { margin: 0; font-size: 13px; line-height: 1.25; }
    .position { margin: 3px 0 0; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #0f766e; }
    .committee { margin: 7px 0 0; font-size: 11px; font-weight: 700; color: #334155; }
    .focus { margin: 4px 0 0; font-size: 10.5px; line-height: 1.35; color: #475569; }
    @page { size: letter landscape; margin: 0; }
    @media print { body { padding: 0.35in; } }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div class="logo-slot">
        <img class="seal" src="${BARANGAY_LOGO_SRC}" alt="Barangay Upper Mingading seal" />
      </div>
      <div class="header-title">
        <p class="eyebrow">BARANGAY UPPER MINGADING</p>
        <h1>Organizational Chart</h1>
        <p class="meta">Printed ${escapeHtml(new Date().toLocaleDateString())} for official barangay reference.</p>
      </div>
      <div class="logo-slot">
        <img class="seal" src="${ALEOSAN_LOGO_SRC}" alt="Municipality of Aleosan seal" />
      </div>
    </header>
    ${captain ? printOfficialCard(captain, "captain") : ""}
    <p class="section-label">Barangay Kagawads</p>
    <section class="kagawad-grid">${kagawads.map((official) => printOfficialCard(official)).join("")}</section>
    <p class="section-label">Secretary, Treasurer, and SK Chairman</p>
    <section class="support-grid">${supportOfficials.map((official) => printOfficialCard(official)).join("")}</section>
  </main>
  <script>
    window.addEventListener("load", () => {
      setTimeout(() => window.print(), 250);
    });
  </script>
</body>
</html>`;
};

const OrganizationChart = () => {
  const [officials, setOfficials] = useState(() => getOrganizationOfficials());
  const [editingId, setEditingId] = useState("");
  const [draftOfficial, setDraftOfficial] = useState(null);
  const [savedAt, setSavedAt] = useState("");
  const [message, setMessage] = useState("");
  const [editorError, setEditorError] = useState("");
  const [loadingOfficials, setLoadingOfficials] = useState(true);
  const [savingOfficial, setSavingOfficial] = useState(false);
  const [viewingOfficial, setViewingOfficial] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadOfficials = async () => {
      try {
        const savedOfficials = await fetchOrganizationOfficials();
        if (isMounted) {
          setOfficials(savedOfficials);
        }
      } catch (error) {
        if (isMounted) {
          setMessage(error.message || "Unable to load saved organizational chart.");
        }
      } finally {
        if (isMounted) {
          setLoadingOfficials(false);
        }
      }
    };

    loadOfficials();

    return () => {
      isMounted = false;
    };
  }, []);

  const captain = findOfficialById(officials, "captain") || officials.find((o) => o.level === "captain");
  const secretary = findOfficialById(officials, "secretary-jovelyn-c-cabaya") || officials.find((o) => o.position?.toLowerCase().includes("secretary"));
  const treasurer = findOfficialById(officials, "treasurer-rosalie-c-calamba") || officials.find((o) => o.position?.toLowerCase().includes("treasurer"));
  const skChairman = findOfficialById(officials, "sk-chairman-chrystophyr-b-trance") || officials.find((o) => o.level === "sk" || o.position?.toLowerCase().includes("sk"));

  const defaultKagawadIds = [
    "kagawad-wilson-boy-capon-pon",
    "kagawad-garry-bernal",
    "kagawad-juanito-c-talaman",
    "kagawad-loreto-c-calamba",
    "kagawad-judy-c-cabaya",
    "kagawad-kobi-gandawali",
    "kagawad-mercy-joy-c-calamba",
  ];

  const kagawads = defaultKagawadIds.map((id, index) => {
    return findOfficialById(officials, id) || officials.filter((o) => o.level === "kagawad")[index] || {
      id,
      name: `Kagawad ${index + 1}`,
      position: `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} Barangay Kagawad`,
      level: "kagawad",
      status: "Active",
    };
  });

  const openEditor = (official) => {
    setEditingId(official.id);
    setDraftOfficial({ ...official });
    setEditorError("");
    setMessage("");
  };

  const closeEditor = () => {
    setEditingId("");
    setDraftOfficial(null);
    setEditorError("");
  };

  const updateDraft = (field, value) => {
    setDraftOfficial((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setEditorError("");

    try {
      const photoUrl = await compressOfficialPhoto(file);
      updateDraft("photoUrl", photoUrl);
    } catch (error) {
      setEditorError(error.message || "Unable to upload photo.");
    }
  };

  const handleUpdateOfficial = async (event) => {
    event.preventDefault();
    if (!draftOfficial) return;

    const currentOfficial = officials.find((official) => official.id === draftOfficial.id);
    const clearPhotoIds =
      currentOfficial?.photoUrl && !draftOfficial.photoUrl ? [draftOfficial.id] : [];
    const nextOfficials = officials.map((official) =>
      official.id === draftOfficial.id
        ? {
            ...official,
            ...draftOfficial,
            name: String(draftOfficial.name || "").trim() || official.name,
            position: String(draftOfficial.position || "").trim() || official.position,
          }
        : official
    );

    setSavingOfficial(true);
    try {
      const savedOfficials = await saveOrganizationOfficials(nextOfficials, {
        clearPhotoIds,
      });
      setOfficials(savedOfficials);
      setSavedAt(new Date().toLocaleTimeString());
      setMessage(`${draftOfficial.name} profile updated.`);
      closeEditor();
    } catch (error) {
      setEditorError(error.message || "Unable to save official profile.");
    } finally {
      setSavingOfficial(false);
    }
  };

  const confirmResetOfficials = async () => {
    setSavingOfficial(true);
    setShowResetModal(false);

    try {
      const defaultOfficials = await resetOrganizationOfficials({ preservePhotos: true });
      setOfficials(defaultOfficials);
      setSavedAt(new Date().toLocaleTimeString());
      setMessage("Organizational chart restored to defaults. Existing photos were preserved.");
      closeEditor();
    } catch (error) {
      setMessage(error.message || "Unable to reset organizational chart.");
    } finally {
      setSavingOfficial(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      setMessage("Please allow pop-ups so the organizational chart can be printed.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(getPrintMarkup(officials));
    printWindow.document.close();
  };

  return (
    <PageWrapper
      title="Organizational Chart"
      description="Barangay Upper Mingading Official Council Hierarchy and Directory"
    >
      <div className="mx-auto max-w-[1400px] flex flex-col pb-20 pt-2">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-950/40 px-6 py-3.5 backdrop-blur-md mb-6 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-lime-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-emerald-200">
              Barangay Leadership Hierarchy
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 text-xs font-bold transition shadow-md border border-emerald-500/30 cursor-pointer"
            >
              <Printer size={15} />
              Print Chart
            </button>
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              disabled={savingOfficial}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-400/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 px-3.5 py-2 text-xs font-bold transition cursor-pointer"
              title="Reset officials data to default"
            >
              <RotateCcw size={14} />
              Reset Roster
            </button>
          </div>
        </div>

        {/* Status Message */}
        {(message || savedAt) && (
          <div className="mb-6 rounded-2xl border border-emerald-400/40 bg-emerald-950/80 px-6 py-3 text-xs font-bold text-emerald-200 shadow-md">
            {message || `Saved at ${savedAt}`}
          </div>
        )}

        {/* ─── MAIN ORGANIZATIONAL CHART CANVAS ─── */}
        <div className="relative rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-[#064e3b] via-[#0b533a] to-[#022c22] p-8 sm:p-12 shadow-2xl shadow-emerald-950/90 backdrop-blur-2xl overflow-x-auto min-h-[760px]">
          {/* Subtle Ambient Lime Lighting */}
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-80 w-[600px] rounded-full bg-lime-400/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-10 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

          {loadingOfficials ? (
            <div className="text-center py-36 text-emerald-200 font-bold">
              Loading Barangay Organizational Chart...
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center min-w-[1020px] max-w-[1100px] mx-auto">
              {/* ─── 1. CLEAN MODERN GRAND BANNER ─── */}
              <div className="flex flex-col items-center text-center mb-8">
                <div className="relative flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-300 bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 shadow-lg shadow-amber-500/30">
                    <img
                      src={BARANGAY_LOGO_SRC}
                      alt="Barangay Seal"
                      className="h-12 w-12 object-contain drop-shadow"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  </div>
                </div>

                <div className="mt-3.5 relative flex flex-col items-center">
                  <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 px-10 py-2 border-2 border-yellow-400 shadow-xl ring-2 ring-emerald-400/30">
                    <h1 className="text-2xl font-black uppercase tracking-[0.16em] text-white drop-shadow-md">
                      BARANGAY
                    </h1>
                  </div>

                  <div className="-mt-2 rounded-xl bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 px-6 py-1 border border-white shadow-md">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-950 flex items-center gap-1.5">
                      <span>★</span>
                      <span>ORGANIZATIONAL CHART</span>
                      <span>★</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* ─── 2. LEVEL 1: CAPTAIN ─── */}
              <div className="relative flex flex-col items-center w-full">
                <CaptainCard official={captain} onClick={setViewingOfficial} />

                {/* Vertical Connector Stem from Captain */}
                <div className="flex flex-col items-center">
                  <div className="h-9 w-1.5 bg-gradient-to-b from-amber-400 to-yellow-300 shadow-sm" />
                  <div className="h-3.5 w-3.5 rounded-full bg-amber-300 ring-4 ring-emerald-950 shadow-md" />
                </div>
              </div>

              {/* ─── 3. CONNECTOR TREE (Captain -> 7 Kagawads) ─── */}
              <div className="relative w-full my-0">
                {/* Clean Horizontal Golden Line Spanning across the 7 Kagawads */}
                <div className="mx-auto w-[92.8%] h-1.5 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 rounded-full shadow-md" />

                {/* 7 Vertical Pins dropping exactly onto each Kagawad card */}
                <div className="grid grid-cols-7 w-full justify-items-center">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-300 -mt-1 ring-2 ring-emerald-950" />
                      <div className="h-7 w-1 bg-gradient-to-b from-amber-300 to-lime-400" />
                    </div>
                  ))}
                </div>
              </div>

              {/* ─── 4. LEVEL 2: THE 7 KAGAWADS (Horizontal Grid) ─── */}
              <div className="grid grid-cols-7 gap-3 w-full justify-items-center mb-2">
                {kagawads.map((official, idx) => (
                  <KagawadCard
                    key={official.id || idx}
                    official={official}
                    index={idx}
                    onClick={setViewingOfficial}
                  />
                ))}
              </div>

              {/* ─── 5. CONNECTOR TREE (Center Kagawad -> 3 Bottom Officers) ─── */}
              <div className="relative flex flex-col items-center w-full my-1">
                {/* Vertical line from center Kagawad (Kagawad 4) */}
                <div className="h-9 w-1.5 bg-gradient-to-b from-amber-400 to-yellow-300 shadow-sm" />
                <div className="h-3.5 w-3.5 rounded-full bg-amber-300 ring-4 ring-emerald-950 shadow-md" />

                {/* Horizontal bar spanning across the 3 bottom officers */}
                <div className="w-[620px] my-0">
                  <div className="mx-auto w-[76%] h-1.5 bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-400 rounded-full shadow-md" />

                  {/* 3 Drop Pins */}
                  <div className="grid grid-cols-3 w-full justify-items-center">
                    <div className="flex flex-col items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-400 -mt-1 ring-2 ring-emerald-950" />
                      <div className="h-7 w-1 bg-gradient-to-b from-amber-400 to-yellow-400" />
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 -mt-1 ring-2 ring-emerald-950" />
                      <div className="h-7 w-1 bg-gradient-to-b from-cyan-400 to-blue-500" />
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-purple-400 -mt-1 ring-2 ring-emerald-950" />
                      <div className="h-7 w-1 bg-gradient-to-b from-purple-400 to-fuchsia-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── 6. LEVEL 3: SECRETARY, TREASURER, SK CHAIRMAN ─── */}
              <div className="grid grid-cols-3 gap-6 w-full max-w-[660px] justify-items-center mt-0">
                <OfficerCard
                  official={secretary}
                  roleType="secretary"
                  onClick={setViewingOfficial}
                />
                <OfficerCard
                  official={treasurer}
                  roleType="treasurer"
                  onClick={setViewingOfficial}
                />
                <OfficerCard
                  official={skChairman}
                  roleType="sk"
                  onClick={setViewingOfficial}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── CUSTOM RESET CONFIRMATION MODAL ─── */}
      {showResetModal && (
        <FloatingModal
          open={showResetModal}
          onClose={() => setShowResetModal(false)}
          title="Reset Official Roster"
          eyebrow="Confirmation Required"
          maxWidth="max-w-md"
          footer={
            <div className="flex justify-end gap-2.5 w-full">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmResetOfficials}
                disabled={savingOfficial}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-bold transition shadow-md cursor-pointer disabled:opacity-60"
              >
                {savingOfficial ? "Restoring..." : "Yes, Reset Roster"}
              </button>
            </div>
          }
        >
          <div className="flex items-start gap-4 py-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                Restore official names and positions to default?
              </p>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                This will reset the roster back to default barangay council titles. Any existing uploaded photos will be preserved.
              </p>
            </div>
          </div>
        </FloatingModal>
      )}

      {/* ─── OFFICIAL PROFILE VIEW MODAL ─── */}
      {viewingOfficial && (
        <FloatingModal
          open={!!viewingOfficial}
          onClose={() => setViewingOfficial(null)}
          title="Official Profile Details"
          eyebrow="Sangguniang Barangay"
          maxWidth="max-w-2xl"
          footer={
            <div className="flex justify-between items-center w-full">
              <button
                type="button"
                onClick={() => {
                  const officialToEdit = viewingOfficial;
                  setViewingOfficial(null);
                  openEditor(officialToEdit);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 shadow-md active:scale-95 cursor-pointer"
              >
                <Edit2 size={16} />
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => setViewingOfficial(null)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-6 sm:flex-row items-center sm:items-start text-center sm:text-left">
            <Avatar official={viewingOfficial} size="lg" borderTheme="gold" />
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-tight">
                  {viewingOfficial.name}
                </h3>
                <p className="text-sm font-bold text-emerald-700 uppercase tracking-wider mt-1">
                  {viewingOfficial.position}
                </p>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider border mt-3 ${
                    viewingOfficial.status === "Active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      viewingOfficial.status === "Active"
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-amber-500"
                    }`}
                  />
                  {viewingOfficial.status || "Active"}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-sm border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <Building2 size={16} className="text-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-800">Committee:</span>{" "}
                  {viewingOfficial.committee || "None"}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar size={16} className="text-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-800">Term:</span>{" "}
                  {viewingOfficial.termOfOffice || "2023 - 2026"}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone size={16} className="text-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-800">Contact:</span>{" "}
                  {viewingOfficial.contact || "N/A"}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail size={16} className="text-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-800">Email:</span>{" "}
                  {viewingOfficial.email || "N/A"}
                </div>
              </div>

              <div className="text-sm border-t border-slate-100 pt-4">
                <div className="flex items-start gap-2 text-slate-600">
                  <MapPin size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">Address:</span>
                    <p className="mt-0.5 text-slate-600">
                      {viewingOfficial.address || "Barangay Upper Mingading, Aleosan, Cotabato"}
                    </p>
                  </div>
                </div>
              </div>

              {viewingOfficial.focusArea && (
                <div className="text-sm border-t border-slate-100 pt-4">
                  <span className="font-bold text-slate-800 block mb-1">Focus Area:</span>
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {viewingOfficial.focusArea}
                  </p>
                </div>
              )}

              {viewingOfficial.background && (
                <div className="text-sm border-t border-slate-100 pt-4">
                  <span className="font-bold text-slate-800 block mb-1">
                    Background / Service Notes:
                  </span>
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {viewingOfficial.background}
                  </p>
                </div>
              )}
            </div>
          </div>
        </FloatingModal>
      )}

      {/* ─── EDIT OFFICIAL PROFILE MODAL ─── */}
      {draftOfficial && (
        <FloatingModal
          open={!!draftOfficial}
          onClose={closeEditor}
          title="Edit Official Profile"
          eyebrow="Sangguniang Barangay"
          maxWidth="max-w-3xl"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleUpdateOfficial}
                disabled={editingId !== draftOfficial.id || savingOfficial}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {savingOfficial ? "Saving..." : "Update Official"}
              </button>
            </div>
          }
        >
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col items-center">
              <div className="flex flex-col items-center text-center">
                <Avatar official={draftOfficial} size="lg" borderTheme="gold" />
                <p className="mt-3 text-sm font-bold text-slate-800">{draftOfficial.name}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {draftOfficial.position}
                </p>
              </div>

              <div className="mt-4 grid gap-2 w-full">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 w-full text-center">
                  <ImagePlus size={16} />
                  Upload Photo
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="sr-only" />
                </label>

                {draftOfficial.photoUrl && (
                  <button
                    type="button"
                    onClick={() => updateDraft("photoUrl", "")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 w-full cursor-pointer"
                  >
                    <X size={16} />
                    Remove Photo
                  </button>
                )}
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-slate-500 text-center">
                JPG, PNG, or WebP up to 8 MB. Photo is auto-resized.
              </p>

              {editorError && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 w-full text-center">
                  {editorError}
                </p>
              )}
            </section>

            <section className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Full name
                  <input
                    value={draftOfficial.name}
                    onChange={(event) => updateDraft("name", event.target.value)}
                    className={fieldClass}
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Position
                  <input
                    value={draftOfficial.position}
                    onChange={(event) => updateDraft("position", event.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className="text-sm font-semibold text-slate-700 block">
                Committee / assignment
                <input
                  value={draftOfficial.committee}
                  onChange={(event) => updateDraft("committee", event.target.value)}
                  className={fieldClass}
                />
              </label>

              <label className="text-sm font-semibold text-slate-700 block">
                Focus area
                <textarea
                  value={draftOfficial.focusArea}
                  onChange={(event) => updateDraft("focusArea", event.target.value)}
                  rows={3}
                  className={`${fieldClass} resize-none leading-relaxed`}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700 block">
                  Phone
                  <div className="relative mt-2">
                    <Phone className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={16} />
                    <input
                      value={draftOfficial.contact}
                      onChange={(event) => updateDraft("contact", event.target.value)}
                      placeholder="Optional"
                      className={`${fieldClass} mt-0 pl-10`}
                    />
                  </div>
                </label>

                <label className="text-sm font-semibold text-slate-700 block">
                  Email
                  <div className="relative mt-2">
                    <Mail className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={16} />
                    <input
                      type="email"
                      value={draftOfficial.email}
                      onChange={(event) => updateDraft("email", event.target.value)}
                      placeholder="Optional"
                      className={`${fieldClass} mt-0 pl-10`}
                    />
                  </div>
                </label>
              </div>

              <label className="text-sm font-semibold text-slate-700 block">
                Background / service notes
                <textarea
                  value={draftOfficial.background}
                  onChange={(event) => updateDraft("background", event.target.value)}
                  rows={4}
                  className={`${fieldClass} resize-none leading-relaxed`}
                />
              </label>

              <label className="text-sm font-semibold text-slate-700 block">
                Status
                <select
                  value={draftOfficial.status}
                  onChange={(event) => updateDraft("status", event.target.value)}
                  className={fieldClass}
                >
                  <option>Active</option>
                  <option>On leave</option>
                  <option>Former official</option>
                  <option>Vacant</option>
                </select>
              </label>
            </section>
          </div>
        </FloatingModal>
      )}
    </PageWrapper>
  );
};

export default OrganizationChart;
