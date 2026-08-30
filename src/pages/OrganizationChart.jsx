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
  Eye,
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

const Avatar = ({ official, size = "md", className = "" }) => {
  const isCaptain = official?.id === "captain" || official?.level === "captain";
  const sizeClasses = {
    sm: "h-14 w-12 rounded-xl",
    md: "h-20 w-16 rounded-xl",
    lg: "h-32 w-28 rounded-2xl",
    xl: "h-40 w-32 rounded-2xl",
  }[size] || "h-32 w-28 rounded-2xl";

  return (
    <div
      className={`relative shrink-0 overflow-hidden border-2 border-[#166534] bg-slate-100 shadow-md ${sizeClasses} ${className}`}
    >
      {official?.photoUrl ? (
        <img
          src={official.photoUrl}
          alt={official?.name || "Official"}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xl">
          {isCaptain ? (
            <Crown size={32} className="text-amber-400" />
          ) : (
            <User size={28} className="text-slate-300" />
          )}
        </div>
      )}
    </div>
  );
};

const FlowchartOfficialCard = ({
  official,
  onClick,
  isCaptain = false,
  isSK = false,
  isStaff = false,
  className = "",
}) => {
  if (!official) return null;

  return (
    <div
      onClick={() => onClick(official)}
      className={`group relative flex items-center gap-3 rounded-2xl bg-white border-2 border-[#166534] p-3 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-1 active:scale-[0.98] select-none text-left ${
        isCaptain
          ? "w-full max-w-[300px] sm:max-w-[350px] ring-2 ring-emerald-400/30"
          : isStaff
          ? "w-[225px] sm:w-[255px]"
          : "w-[210px] sm:w-[240px]"
      } ${className}`}
      title={`Click to view profile of ${official.name}`}
    >
      {/* Photo with matching green border */}
      <div
        className={`relative shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs ${
          isCaptain
            ? "h-14 w-12 sm:h-16 sm:w-14"
            : "h-14 w-12 sm:h-16 sm:w-14"
        }`}
      >
        {official.photoUrl ? (
          <img
            src={official.photoUrl}
            alt={official.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-sm">
            {isCaptain ? (
              <Crown size={22} className="text-amber-400" />
            ) : (
              <User size={18} className="text-slate-300" />
            )}
          </div>
        )}

        {/* Quick subtle hover indicator */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
          <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-slate-900 shadow">
            <Eye size={9} />
            <span>Details</span>
          </span>
        </div>
      </div>

      {/* Official Credentials */}
      <div className="flex flex-col min-w-0 flex-1">
        {/* Role Badge Pill */}
        <span
          className={`inline-flex items-center gap-1 text-[8.5px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border ${
            isCaptain
              ? "bg-amber-100 text-amber-900 border-amber-300"
              : isSK
              ? "bg-sky-100 text-sky-900 border-sky-300"
              : "bg-emerald-100 text-emerald-900 border-emerald-300"
          }`}
        >
          {isCaptain && <Crown size={10} className="text-amber-600" />}
          <span>{official.position || "OFFICIAL"}</span>
        </span>

        {/* Full Name */}
        <h4
          className={`font-black text-slate-900 leading-tight truncate ${
            isCaptain ? "text-xs sm:text-[13.5px]" : "text-[11px] sm:text-xs"
          }`}
          title={official.name}
        >
          {official.name}
        </h4>

        {/* Subtitle / Focus Area */}
        <p
          className="text-[8.5px] sm:text-[9px] text-slate-500 font-semibold leading-tight mt-0.5 truncate"
          title={official.committee || official.focusArea}
        >
          {official.committee || (isCaptain ? "Executive Leadership" : "Council Member")}
        </p>
      </div>
    </div>
  );
};

const findOfficialById = (officials, officialId) =>
  officials.find((official) => official.id === officialId) ||
  DEFAULT_ORGANIZATION_OFFICIALS.find((official) => official.id === officialId) ||
  null;

const printCardMarkup = (official, isCaptain = false, isSK = false, isStaff = false) => `
  <div class="print-node ${isCaptain ? "captain" : ""} ${isSK ? "sk" : ""} ${isStaff ? "staff" : ""}">
    <div class="photo">
      ${
        official?.photoUrl
          ? `<img src="${escapeAttribute(official.photoUrl)}" />`
          : `<div class="initials">${isCaptain ? "PB" : "O"}</div>`
      }
    </div>
    <div class="details">
      <div class="pill ${isCaptain ? "capt-pill" : isSK ? "sk-pill" : "std-pill"}">${escapeHtml(
        official?.position || "OFFICIAL"
      )}</div>
      <div class="name">${escapeHtml(official?.name || "")}</div>
      <div class="comm">${escapeHtml(
        official?.committee || (isCaptain ? "Executive Leadership" : isStaff ? "Barangay Appointee" : "Council Member")
      )}</div>
    </div>
  </div>
`;

const getPrintMarkup = (officials) => {
  const captain = findOfficialById(officials, "captain") || officials.find((o) => o.level === "captain");
  const kagawadWilson = findOfficialById(officials, "kagawad-wilson-boy-capon-pon") || officials[4];
  const kagawadGarry = findOfficialById(officials, "kagawad-garry-bernal") || officials[5];
  const kagawadJudy = findOfficialById(officials, "kagawad-judy-c-cabaya") || officials[8];
  const kagawadRuben = findOfficialById(officials, "kagawad-kobi-gandawali") || officials[9];
  const kagawadJuanito = findOfficialById(officials, "kagawad-juanito-c-talaman") || officials[6];
  const kagawadLoreto = findOfficialById(officials, "kagawad-loreto-c-calamba") || officials[7];
  const secretary = findOfficialById(officials, "secretary-jovelyn-c-cabaya") || officials[1];
  const treasurer = findOfficialById(officials, "treasurer-rosalie-c-calamba") || officials[2];
  const kagawadMercy = findOfficialById(officials, "kagawad-mercy-joy-c-calamba") || officials[10];
  const skChairman = findOfficialById(officials, "sk-chairman-chrystophyr-b-trance") || officials[3];

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>BARANGAY UPPER MINGADING - Official Organizational Chart</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      padding: 0.15in;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .chart-container {
      background: linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 45%, #ffffff 100%);
      border: 2.5px solid #38bdf8;
      border-radius: 20px;
      padding: 16px 20px;
      width: 100%;
      max-width: 1060px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 8px;
      border-bottom: 1.5px solid #bae6fd;
    }
    .seal {
      width: 66px;
      height: 66px;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }
    .header-text {
      text-align: center;
      flex: 1;
      line-height: 1.2;
    }
    .header-text .gov-sub {
      font-size: 8.5px;
      font-weight: 700;
      color: #047857;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 1px;
    }
    .header-text h1 {
      font-size: 22px;
      font-weight: 900;
      color: #064e3b;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .header-text h2 {
      font-size: 11px;
      font-weight: 900;
      color: #16a34a;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      margin-top: 1px;
    }
    
    .tree {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .stem-v {
      width: 2.5px;
      background: #166534;
    }
    
    .print-node {
      display: flex;
      align-items: center;
      gap: 9px;
      background: #ffffff;
      border: 2px solid #166534;
      border-radius: 12px;
      padding: 6px 10px;
      width: 200px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.06);
    }
    .print-node.captain {
      width: 280px;
      padding: 7px 14px;
      border-width: 2.5px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.08);
    }
    .print-node.sk {
      border-color: #166534;
    }
    .print-node.staff {
      width: 215px;
    }
    .print-node .photo {
      width: 44px;
      height: 52px;
      border-radius: 9px;
      border: 1.5px solid #166534;
      overflow: hidden;
      background: #f1f5f9;
      flex-shrink: 0;
    }
    .print-node.captain .photo {
      width: 52px;
      height: 62px;
    }
    .print-node .photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .print-node .photo .initials {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: bold;
      background: #166534;
      color: #fff;
    }
    
    .print-node .details {
      flex: 1;
      min-width: 0;
    }
    .pill {
      font-size: 7.5px;
      font-weight: 900;
      text-transform: uppercase;
      padding: 2px 5px;
      border-radius: 5px;
      display: inline-block;
      margin-bottom: 2px;
      line-height: 1;
    }
    .std-pill {
      background: #dcfce7 !important;
      color: #166534 !important;
      border: 1px solid #86efac;
    }
    .capt-pill {
      background: #fef3c7 !important;
      color: #78350f !important;
      border: 1px solid #fde68a;
    }
    .sk-pill {
      background: #e0f2fe !important;
      color: #0369a1 !important;
      border: 1px solid #7dd3fc;
    }
    .print-node .name {
      font-size: 10.5px;
      font-weight: 900;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }
    .print-node.captain .name {
      font-size: 12.5px;
    }
    .print-node .comm {
      font-size: 8px;
      font-weight: 600;
      color: #475569;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .council-tree-wrapper {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      position: relative;
      width: 100%;
    }
    .council-wing {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      position: relative;
    }
    .left-wing-bus {
      position: absolute;
      top: 0;
      left: 100px;
      right: 0;
      height: 2.5px;
      background: #166534;
    }
    .right-wing-bus {
      position: absolute;
      top: 0;
      left: 0;
      right: 100px;
      height: 2.5px;
      background: #166534;
    }
    .council-center-aisle {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      position: relative;
      padding: 0 18px;
      align-self: stretch;
      min-width: 40px;
    }
    .center-bridge {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2.5px;
      background: #166534;
    }
    .center-trunk {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2.5px;
      background: #166534;
    }
    .council-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 200px;
    }
    .col-drop {
      width: 2.5px;
      height: 12px;
      background: #166534;
    }
    .inter-row-v {
      width: 2.5px;
      height: 10px;
      background: #166534;
    }

    .staff-tree-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      width: 100%;
    }
    .staff-row {
      display: flex;
      justify-content: center;
      gap: 48px;
      position: relative;
    }
    .staff-bus {
      position: absolute;
      top: 0;
      left: 107.5px;
      right: 107.5px;
      height: 2.5px;
      background: #166534;
    }
    .staff-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 215px;
    }

    @page {
      size: landscape;
      margin: 4mm 6mm;
    }
    @media print {
      body {
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .chart-container {
        border-width: 2px !important;
        padding: 12px 16px !important;
      }
    }
  </style>
</head>
<body>
  <div class="chart-container">
    <div class="header">
      <img class="seal" src="${ALEOSAN_LOGO_SRC}" alt="Aleosan Seal" />
      <div class="header-text">
        <div class="gov-sub">Republic of the Philippines • Province of Cotabato • Municipality of Aleosan</div>
        <h1>BARANGAY UPPER MINGADING</h1>
        <h2>— OFFICIAL ORGANIZATIONAL CHART —</h2>
      </div>
      <img class="seal" src="${BARANGAY_LOGO_SRC}" alt="Upper Mingading Seal" />
    </div>

    <div class="tree">
      ${printCardMarkup(captain, true)}
      <div class="stem-v" style="height: 12px;"></div>
      
      <div class="council-tree-wrapper">
        <!-- Left Wing: Col 1 (Wilson->Juanito) & Col 2 (Garry->Loreto) -->
        <div class="council-wing">
          <div class="left-wing-bus"></div>
          <div class="council-col">
            <div class="col-drop"></div>
            ${printCardMarkup(kagawadWilson)}
            <div class="inter-row-v"></div>
            ${printCardMarkup(kagawadJuanito)}
          </div>
          <div class="council-col">
            <div class="col-drop"></div>
            ${printCardMarkup(kagawadGarry)}
            <div class="inter-row-v"></div>
            ${printCardMarkup(kagawadLoreto)}
          </div>
        </div>

        <!-- Center Aisle with Continuous Trunk -->
        <div class="council-center-aisle">
          <div class="center-bridge"></div>
          <div class="center-trunk"></div>
        </div>

        <!-- Right Wing: Col 3 (Judy->Mercy) & Col 4 (Ruben->SK) -->
        <div class="council-wing">
          <div class="right-wing-bus"></div>
          <div class="council-col">
            <div class="col-drop"></div>
            ${printCardMarkup(kagawadJudy)}
            <div class="inter-row-v"></div>
            ${printCardMarkup(kagawadMercy)}
          </div>
          <div class="council-col">
            <div class="col-drop"></div>
            ${printCardMarkup(kagawadRuben)}
            <div class="inter-row-v"></div>
            ${printCardMarkup(skChairman, false, true)}
          </div>
        </div>
      </div>

      <div class="stem-v" style="height: 12px;"></div>
      
      <div class="staff-tree-wrapper">
        <div class="staff-row">
          <div class="staff-bus"></div>
          <div class="staff-col">
            <div class="col-drop"></div>
            ${printCardMarkup(secretary, false, false, true)}
          </div>
          <div class="staff-col">
            <div class="col-drop"></div>
            ${printCardMarkup(treasurer, false, false, true)}
          </div>
        </div>
      </div>
    </div>
  </div>
  <script>
    window.addEventListener("load", () => {
      setTimeout(() => window.print(), 300);
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
    return (
      findOfficialById(officials, id) ||
      officials.filter((o) => o.level === "kagawad")[index] || {
        id,
        name: `Kagawad ${index + 1}`,
        position: `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} Barangay Kagawad`,
        level: "kagawad",
        status: "Active",
      }
    );
  });

  const captain =
    findOfficialById(officials, "captain") ||
    officials.find((o) => o.level === "captain");
  const kagawadWilson =
    findOfficialById(officials, "kagawad-wilson-boy-capon-pon") || kagawads[0];
  const kagawadGarry =
    findOfficialById(officials, "kagawad-garry-bernal") || kagawads[1];
  const kagawadJuanito =
    findOfficialById(officials, "kagawad-juanito-c-talaman") || kagawads[2];
  const kagawadLoreto =
    findOfficialById(officials, "kagawad-loreto-c-calamba") || kagawads[3];
  const kagawadJudy =
    findOfficialById(officials, "kagawad-judy-c-cabaya") || kagawads[4];
  const kagawadRuben =
    findOfficialById(officials, "kagawad-kobi-gandawali") || kagawads[5];
  const kagawadMercy =
    findOfficialById(officials, "kagawad-mercy-joy-c-calamba") || kagawads[6];
  const skChairman =
    findOfficialById(officials, "sk-chairman-chrystophyr-b-trance") ||
    officials.find(
      (o) => o.level === "sk" || o.position?.toLowerCase().includes("sk")
    );
  const secretary =
    findOfficialById(officials, "secretary-jovelyn-c-cabaya") ||
    officials.find((o) => o.position?.toLowerCase().includes("secretary"));
  const treasurer =
    findOfficialById(officials, "treasurer-rosalie-c-calamba") ||
    officials.find((o) => o.position?.toLowerCase().includes("treasurer"));

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
        <div className="flex items-center justify-between rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-[#023B28] via-[#035237] to-[#023B28] px-6 py-3.5 mb-6 shadow-xl text-white">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-emerald-100 drop-shadow-xs">
              Barangay Leadership Hierarchy
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50 text-[#00552E] px-4 py-2 text-xs font-black transition shadow-md cursor-pointer hover:scale-[1.02] active:scale-95"
            >
              <Printer size={15} className="stroke-[2.5]" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {(message || savedAt) && (
          <div className="mb-6 rounded-2xl border border-emerald-400/50 bg-[#004D2A] px-6 py-3 text-xs font-black text-emerald-100 shadow-md">
            {message || `Saved at ${savedAt}`}
          </div>
        )}

        {/* ─── MAIN ORGANIZATIONAL CHART CANVAS ─── */}
        <div className="relative rounded-3xl border-2 border-sky-300 bg-gradient-to-b from-[#e0f2fe]/90 via-[#f0f9ff] to-[#ffffff] p-6 sm:p-8 md:p-10 shadow-2xl backdrop-blur-md max-w-[1240px] w-full mx-auto">
          {/* Subtle Grid Accent */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(#93c5fd_1px,transparent_1px)] [background-size:20px_20px] opacity-35" />

          {loadingOfficials ? (
            <div className="text-center py-20 text-[#064e3b] font-bold text-sm">
              Loading Barangay Organizational Flowchart...
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center w-full mx-auto text-slate-900">
              {/* ─── 1. OFFICIAL POSTER HEADER ─── */}
              <div className="flex items-center justify-between gap-2 sm:gap-4 w-full mb-6 sm:mb-8 pb-3 px-1 sm:px-6 border-b border-sky-200/60">
                {/* Left: Municipality of Aleosan Seal */}
                <div className="flex items-center shrink-0">
                  <div className="flex h-11 w-11 sm:h-16 sm:w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-white/90 p-1 shadow-sm border border-sky-200">
                    <img
                      src={ALEOSAN_LOGO_SRC}
                      alt="Municipality of Aleosan Seal"
                      className="h-full w-full object-contain drop-shadow-xs"
                      onError={(e) => {
                        e.target.src = "/aleosan logo.png";
                      }}
                    />
                  </div>
                </div>

                {/* Center Title */}
                <div className="flex flex-col items-center text-center flex-1 min-w-0 px-1">
                  <h1 className="text-sm sm:text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-normal sm:tracking-wide text-[#064e3b] leading-tight drop-shadow-2xs">
                    BARANGAY UPPER MINGADING
                  </h1>
                  <h2 className="text-[9px] sm:text-xs md:text-sm font-black uppercase tracking-[0.12em] sm:tracking-[0.25em] text-[#16a34a] mt-0.5 sm:mt-1.5 flex items-center justify-center gap-1.5 sm:gap-2.5">
                    <span className="h-0.5 w-3 sm:w-8 md:w-16 bg-[#16a34a] inline-block" />
                    <span>OFFICIAL ORGANIZATIONAL CHART</span>
                    <span className="h-0.5 w-3 sm:w-8 md:w-16 bg-[#16a34a] inline-block" />
                  </h2>
                </div>

                {/* Right: Barangay Upper Mingading Seal */}
                <div className="flex items-center shrink-0">
                  <div className="flex h-11 w-11 sm:h-16 sm:w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-white/90 p-1 shadow-sm border border-sky-200">
                    <img
                      src={BARANGAY_LOGO_SRC}
                      alt="Barangay Upper Mingading Seal"
                      className="h-full w-full object-contain drop-shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* ─── 2. HIERARCHICAL FLOWCHART TREE (SEAMLESS CONNECTED HIERARCHY) ─── */}
              <div className="w-full flex flex-col items-center">
                {/* Level 1: Punong Barangay */}
                <div className="relative flex flex-col items-center w-full">
                  <FlowchartOfficialCard official={captain} onClick={setViewingOfficial} isCaptain={true} />
                </div>

                {/* Central Stem Line from Captain */}
                <div className="w-[2px] h-5 sm:h-7 bg-[#166534]" />

                {/* Level 2: Sangguniang Barangay (Desktop: Connected 4-Column Tree / Mobile: Responsive Grid) */}
                
                {/* ─── MOBILE VIEW (< lg): Roomy Responsive Grid with Connected Stems ─── */}
                <div className="flex lg:hidden flex-col items-center w-full max-w-[620px] px-0.5">
                  <div className="w-full flex flex-col items-center mb-3">
                    <span className="inline-block text-[9px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100/90 border border-emerald-300/80 px-3 py-0.5 rounded-full shadow-2xs">
                      Sangguniang Barangay Council
                    </span>
                    <div className="w-[2px] h-3 bg-[#166534] mt-1" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                    {[kagawadWilson, kagawadGarry, kagawadJuanito, kagawadLoreto, kagawadJudy, kagawadRuben, kagawadMercy, skChairman].filter(Boolean).map((off) => {
                      const isSK = off.id?.includes("sk") || off.level === "sk";
                      return (
                        <FlowchartOfficialCard
                          key={off.id || off.name}
                          official={off}
                          onClick={setViewingOfficial}
                          isSK={isSK}
                          className="w-full!"
                        />
                      );
                    })}
                  </div>
                </div>

                {/* ─── DESKTOP VIEW (>= lg): Connected 4-Column Flowchart Tree ─── */}
                <div className="hidden lg:flex items-start justify-center w-full">
                  {/* LEFT WING: Col 1 (Wilson->Juanito) & Col 2 (Garry->Loreto) */}
                  <div className="relative flex items-start gap-3 sm:gap-4">
                    {/* Continuous Horizontal Bus from Col 1 center to Right edge of Left Wing */}
                    <div className="absolute top-0 left-[105px] sm:left-[120px] right-0 h-[2px] bg-[#166534]" />

                    {/* Column 1: Wilson Boy -> Juanito */}
                    <div className="flex flex-col items-center">
                      <div className="w-[2px] h-5 sm:h-6 bg-[#166534]" />
                      <FlowchartOfficialCard official={kagawadWilson} onClick={setViewingOfficial} />
                      <div className="w-[2px] h-3.5 sm:h-4.5 bg-[#166534]" />
                      <FlowchartOfficialCard official={kagawadJuanito} onClick={setViewingOfficial} />
                    </div>

                    {/* Column 2: Garry -> Loreto */}
                    <div className="flex flex-col items-center">
                      <div className="w-[2px] h-5 sm:h-6 bg-[#166534]" />
                      <FlowchartOfficialCard official={kagawadGarry} onClick={setViewingOfficial} />
                      <div className="w-[2px] h-3.5 sm:h-4.5 bg-[#166534]" />
                      <FlowchartOfficialCard official={kagawadLoreto} onClick={setViewingOfficial} />
                    </div>
                  </div>

                  {/* CENTRAL CONNECTOR AISLE */}
                  <div className="flex flex-col items-center justify-between self-stretch px-3 sm:px-5 relative min-w-[36px] sm:min-w-[54px]">
                    {/* Horizontal Bus Bridge across Center Aisle */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#166534]" />
                    {/* Continuous Vertical Central Trunk passing all the way down */}
                    <div className="absolute top-0 bottom-0 w-[2px] bg-[#166534]" />
                  </div>

                  {/* RIGHT WING: Col 3 (Judy->Mercy) & Col 4 (Ruben->SK) */}
                  <div className="relative flex items-start gap-3 sm:gap-4">
                    {/* Continuous Horizontal Bus from Left edge of Right Wing to Col 4 center */}
                    <div className="absolute top-0 left-0 right-[105px] sm:right-[120px] h-[2px] bg-[#166534]" />

                    {/* Column 3: Judy -> Mercy Joy */}
                    <div className="flex flex-col items-center">
                      <div className="w-[2px] h-5 sm:h-6 bg-[#166534]" />
                      <FlowchartOfficialCard official={kagawadJudy} onClick={setViewingOfficial} />
                      <div className="w-[2px] h-3.5 sm:h-4.5 bg-[#166534]" />
                      <FlowchartOfficialCard official={kagawadMercy} onClick={setViewingOfficial} />
                    </div>

                    {/* Column 4: Ruben / Kobi -> Chrystophyr SK */}
                    <div className="flex flex-col items-center">
                      <div className="w-[2px] h-5 sm:h-6 bg-[#166534]" />
                      <FlowchartOfficialCard official={kagawadRuben} onClick={setViewingOfficial} />
                      <div className="w-[2px] h-3.5 sm:h-4.5 bg-[#166534]" />
                      <FlowchartOfficialCard official={skChairman} onClick={setViewingOfficial} isSK={true} />
                    </div>
                  </div>
                </div>

                {/* Central Stem Line passing down to Staff */}
                <div className="w-[2px] h-5 sm:h-7 bg-[#166534]" />

                {/* Level 3: Secretary & Treasurer */}
                
                {/* ─── MOBILE VIEW (< lg): Responsive Staff Grid with Connected Stems ─── */}
                <div className="flex lg:hidden flex-col items-center w-full max-w-[620px] px-0.5">
                  <div className="w-full flex flex-col items-center mb-3">
                    <span className="inline-block text-[9px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100/90 border border-emerald-300/80 px-3 py-0.5 rounded-full shadow-2xs">
                      Appointed Barangay Officials
                    </span>
                    <div className="w-[2px] h-3 bg-[#166534] mt-1" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                    <FlowchartOfficialCard official={secretary} onClick={setViewingOfficial} isStaff={true} className="w-full!" />
                    <FlowchartOfficialCard official={treasurer} onClick={setViewingOfficial} isStaff={true} className="w-full!" />
                  </div>
                </div>

                {/* ─── DESKTOP VIEW (>= lg): Side-by-side with Connected Branch Line ─── */}
                <div className="hidden lg:flex flex-col items-center w-full">
                  <div className="relative flex items-start gap-8 sm:gap-12">
                    {/* Horizontal Bus linking Secretary center and Treasurer center */}
                    <div className="absolute top-0 left-[112.5px] sm:left-[127.5px] right-[112.5px] sm:right-[127.5px] h-[2px] bg-[#166534]" />

                    {/* Secretary Column */}
                    <div className="flex flex-col items-center">
                      <div className="w-[2px] h-4 sm:h-5 bg-[#166534]" />
                      <FlowchartOfficialCard official={secretary} onClick={setViewingOfficial} isStaff={true} />
                    </div>

                    {/* Treasurer Column */}
                    <div className="flex flex-col items-center">
                      <div className="w-[2px] h-4 sm:h-5 bg-[#166534]" />
                      <FlowchartOfficialCard official={treasurer} onClick={setViewingOfficial} isStaff={true} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Reset Control */}
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            disabled={savingOfficial}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <RotateCcw size={13} />
            Reset to Default
          </button>
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
