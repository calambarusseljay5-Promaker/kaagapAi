import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createDocumentRequest,
  fetchDocumentRequests,
  fetchDocumentTemplates,
  updateDocumentRequestStatus,
  deleteDocumentRequest,
  deleteDocumentRequests,
  getPreparedDocument,
  savePreparedDocument,
  uploadDocumentTemplateFile,
} from "../services/documentRequestService";
import { getCurrentUserWithProfile } from "../services/authService";
import { fetchResidents } from "../services/adminService";
import { supabase } from "../lib/supabaseClient";
import { sendSmsNotification, isValidSmsPhone } from "../services/smsService";
import {
  DEFAULT_PREPARED_BY,
  PUNONG_BARANGAY,
  getEditableDocumentText,
  getRealDocumentMarkup,
  getRealDocumentPrintMarkup,
  getTemplateFilePath,
  getRealDocumentTemplateKey,
} from "../utils/realDocumentTemplates";
import {
  getOrganizationOfficials,
  fetchOrganizationOfficials,
  getActiveCaptain,
  getActiveSecretary,
} from "../services/organizationService";
import { showAdminSystemToast } from "../utils/toast";
import {
  AlertCircle,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Bot,
  Check,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FilePlus,
  FileText,
  Filter,
  Italic,
  Loader,
  Maximize2,
  Printer,
  RefreshCw,
  Save,
  Search,
  Square,
  Trash2,
  Type,
  Underline,
  Upload,
  UserCheck,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import FloatingModal from "../components/FloatingModal";
import { useConfirm } from "../context/ConfirmContext";
import { DataGrid } from "@mui/x-data-grid";
const STATUS_OPTIONS = ["Pending", "Processing", "Approved", "Completed", "Released", "Rejected"];
const TEMPLATE_UPLOAD_ACCEPT =
  ".doc,.docx,.dot,.dotx,.pdf,application/msword,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.wordprocessingml.template";

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const formatDate = (value, options = {}) => {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      ...options,
    });
  } catch {
    return "-";
  }
};

const formatDateTime = (value) => {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

const getNestedResident = (resident) => (Array.isArray(resident) ? resident[0] : resident);

const shortId = (value) => (value ? String(value).slice(0, 8).toUpperCase() : "NO-ID");

const getTemplateLabel = (template) =>
  template?.template_name || template?.document_type || "Untitled Template";

const getResidentLabel = (resident) => resident?.full_name || "Unnamed resident";

const getResidentMeta = (resident) =>
  [
    resident?.purok ? `Purok ${resident.purok}` : "",
    resident?.house_no ? `House ${resident.house_no}` : "",
    resident?.email || "",
  ]
    .filter(Boolean)
    .join(" - ") ||
  resident?.address ||
  "No resident details";

const getTemplateFileName = (template) => {
  const path = getTemplateFilePath(template);
  if (!path) return "No file uploaded";

  const fileName = String(path).split("?")[0].split("/").filter(Boolean).pop();

  try {
    return decodeURIComponent(fileName || path);
  } catch {
    return fileName || path;
  }
};

const parsePurpose = (docType) => {
  if (!docType) return "";
  const match =
    docType.match(/\(Purpose:\s*(.*?)\)/i) ||
    docType.match(/-\s*Purpose:\s*(.*)/i) ||
    docType.match(/\(Reason:\s*(.*?)\)/i) ||
    docType.match(/\(Business:\s*(.*?)\)/i);
  return match ? match[1].trim() : "";
};

const parseDetailField = (docType, fieldName) => {
  if (!docType) return "";
  const regex = new RegExp(`\\(${fieldName}:\\s*(.*?)(?=\\s*\\||\\))`, "i");
  const match = docType.match(regex);
  return match ? match[1].trim() : "";
};

const stripPurpose = (docType) => {
  if (!docType) return "";
  return docType
    .split(" (Purpose:")[0]
    .split(" - Purpose:")[0]
    .split(" (Reason:")[0]
    .split(" (Business:")[0]
    .split(" (Crops:")[0]
    .split(" (")[0]
    .trim();
};

const findMatchingTemplate = (templates, documentType) => {
  const cleanDocType = stripPurpose(documentType);
  const requested = normalizeText(cleanDocType);
  if (!requested) return templates[0] || null;

  return (
    templates.find((template) => normalizeText(template.template_name) === requested) ||
    templates.find((template) => normalizeText(template.document_type) === requested) ||
    templates.find((template) => requested.includes(normalizeText(template.template_name))) ||
    templates.find((template) => normalizeText(template.template_name).includes(requested)) ||
    templates.find((template) => requested.includes(normalizeText(template.document_type))) ||
    templates.find((template) => normalizeText(template.document_type).includes(requested)) ||
    templates[0] ||
    null
  );
};

const buildResidentFields = (
  resident,
  request,
  template,
  savedFields = {},
  defaultCaptain = PUNONG_BARANGAY
) => {
  const reqDocType = request?.document_type || "";
  const docKey = getRealDocumentTemplateKey(template || reqDocType);
  const is4ps = docKey === "4ps";
  const isSolo = docKey === "solo";
  const isResidency = docKey === "residency";
  const isClearance = docKey === "clearance";
  const isIndigency = docKey === "indigency";
  const isBusiness = docKey === "business";
  const isRsbsa = docKey === "rsbsa";

  const extractedReason = parseDetailField(reqDocType, "Reason") || (reqDocType.toLowerCase().includes("reason:") ? parsePurpose(reqDocType) : "");
  const extractedBusiness = parseDetailField(reqDocType, "Business");
  const extractedRecommendation = parseDetailField(reqDocType, "Recommendation") || (isResidency ? parsePurpose(reqDocType) : "");
  const extractedGrantee = parseDetailField(reqDocType, "Grantee") || parseDetailField(reqDocType, "Spouse");
  
  let extractedCrops = "";
  let extractedFarmSize = "";
  let extractedTenure = "";
  if (reqDocType.includes("Crops:")) {
    const cropsMatch = reqDocType.match(/Crops:\s*(.*?)(?=\s*\||\))/i);
    if (cropsMatch) extractedCrops = cropsMatch[1].trim();
    const sizeMatch = reqDocType.match(/Size:\s*(.*?)(?=\s*\||\))/i);
    if (sizeMatch) extractedFarmSize = sizeMatch[1].trim();
    const tenureMatch = reqDocType.match(/Tenure:\s*(.*?)(?=\s*\||\))/i);
    if (tenureMatch) extractedTenure = tenureMatch[1].trim();
  }

  const rawBirth = resident?.birth_date || resident?.birthday || resident?.date_of_birth || resident?.birthdate || resident?.dob || "";
  const residentGender = resident?.gender || "Female";
  const isFemale = residentGender.toLowerCase() === "female" || residentGender.toLowerCase() === "f";

  // Default recommendations / purpose based on document type
  let defaultPurpose = parsePurpose(reqDocType) || "";
  if (!defaultPurpose) {
    if (isClearance) defaultPurpose = "OWWA";
    else if (isIndigency) defaultPurpose = "FINANCIAL ASSISTANCE";
    else if (isResidency) defaultPurpose = "job and application";
    else if (isBusiness) defaultPurpose = "BANANA BUY AND SALE";
    else if (isSolo) defaultPurpose = "Solo Parent ID and Benefits Application";
    else if (is4ps) defaultPurpose = "Pantawid Pamilyang Pilipino Program (4Ps) Requirement";
    else if (isRsbsa) defaultPurpose = "RSBSA Registration";
  }

  const defaultRecommendation =
    savedFields.residencyRecommendation ||
    extractedRecommendation ||
    (isResidency ? (defaultPurpose || "job and application") : "");

  const defaultSoloReason =
    savedFields.soloParentReason ||
    extractedReason ||
    (isFemale ? "death of her husband" : "death of his wife");

  return {
    documentTitle: getTemplateLabel(template) || stripPurpose(request?.document_type) || "Barangay Document",
    residentName: resident?.full_name || "",
    age: resident?.age ?? "",
    gender: residentGender,
    civilStatus: resident?.civil_status || resident?.civilStatus || "Single",
    birthDate: savedFields.birthDate || rawBirth || "",
    houseNo: resident?.house_no || "",
    purok: resident?.purok || "Kamonsil",
    address: resident?.address || "",
    email: resident?.email || "",
    pwdStatus: resident?.is_pwd ? "Yes" : "No",
    pwdType: resident?.pwd_type || "",
    orNumber: savedFields.orNumber === "2578557" ? "" : (savedFields.orNumber || ""),
    dateIssued: savedFields.dateIssued || "",
    ctcNumber: savedFields.ctcNumber || "",
    ctcDateIssued: savedFields.ctcDateIssued || "",
    purpose: savedFields.purpose || defaultPurpose,
    residencyRecommendation: defaultRecommendation,
    issueDate: savedFields.issueDate || todayInputValue(),
    preparedBy: savedFields.preparedBy || DEFAULT_PREPARED_BY,
    approvingOfficer: savedFields.approvingOfficer || defaultCaptain || PUNONG_BARANGAY,
    signatoryKey: savedFields.signatoryKey || "captain",
    actingOfficer: savedFields.actingOfficer || "",
    actingPosition: savedFields.actingPosition || "Barangay Kagawad / Officer of the Day",
    soloParentReason: defaultSoloReason,
    soloParentReasonPreset: savedFields.soloParentReasonPreset || "",
    fourPsPreset: savedFields.fourPsPreset || "",
    fourPsSpouse: savedFields.fourPsSpouse || extractedGrantee || "Maria Balad",
    businessName: savedFields.businessName || extractedBusiness || (isBusiness ? "BANANA BUY AND SALE" : ""),
    farmSize: savedFields.farmSize || extractedFarmSize || "One (1) hectare",
    tenure: savedFields.tenure || extractedTenure || "Owner",
    remarks: savedFields.remarks || extractedCrops || (isRsbsa ? "Rice Field ½ hectare, and Fruits Crops 1 hectare" : ""),
    cropsText: savedFields.cropsText || extractedCrops || (isRsbsa ? "Rice Field ½ hectare, and Fruits Crops 1 hectare" : ""),
    documentText: savedFields.documentText || "",
    printFontFamily: savedFields.printFontFamily || (isResidency || isIndigency || isBusiness || isRsbsa || is4ps ? "rockwell" : "times"),
    printFontSize: savedFields.printFontSize || (isResidency || isIndigency || isBusiness || isRsbsa || is4ps ? "14" : "12"),
    printLineHeight: savedFields.printLineHeight || "1.25",
    printParagraphGap: savedFields.printParagraphGap || "0.16",
    printMargin: savedFields.printMargin || "normal",
    ...savedFields,
  };
};

const normalizeEditablePreviewText = (value) =>
  String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const getEditablePreviewBlockText = (element) => {
  const childBlocks = Array.from(element.children || [])
    .map((child) => normalizeEditablePreviewText(child.innerText || child.textContent))
    .filter(Boolean);

  if (childBlocks.length > 0) return childBlocks.join("\n\n");

  return normalizeEditablePreviewText(element.innerText || element.textContent);
};

const getRequiredMissingFields = (fields, selectedTemplateId, selectedResidentId) => {
  const missing = [];

  if (!selectedTemplateId) missing.push("document template");
  if (!selectedResidentId) missing.push("resident");
  if (!fields.residentName) missing.push("resident name");
  if (!fields.address && !fields.purok) missing.push("address or purok");
  if (!fields.issueDate) missing.push("issue date");

  return missing;
};

const DocumentManagement = () => {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [requests, setRequests] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [residents, setResidents] = useState([]);
  const [officials, setOfficials] = useState(() => getOrganizationOfficials());
  const [loading, setLoading] = useState(true);
  const delayedLoading = loading;

  const captainOfficial = useMemo(
    () => officials.find((o) => o.level === "captain") || { name: PUNONG_BARANGAY },
    [officials]
  );
  const kagawadOfficials = useMemo(
    () => officials.filter((o) => o.level === "kagawad"),
    [officials]
  );
  const secretaryOfficial = useMemo(
    () => officials.find((o) => o.level === "staff" && o.position?.toLowerCase().includes("secretary")),
    [officials]
  );

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
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const selectedRowIdsSet = useMemo(() => new Set(selectedRowIds), [selectedRowIds]);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedResidentId, setSelectedResidentId] = useState("");
  const [residentSearch, setResidentSearch] = useState("");
  const [walkInForm, setWalkInForm] = useState({
    templateId: "",
    residentId: "",
    residentSearch: "",
    purpose: "",
    residencyRecommendation: "job and application",
    businessName: "BANANA BUY AND SALE",
    soloParentReason: "death of her husband",
    fourPsSpouse: "Maria Balad",
    cropsText: "Rice Field ½ hectare, and Fruits Crops 1 hectare",
    tenure: "Owner",
    farmSize: "One (1) hectare",
    orNumber: "",
    dateIssued: "",
    ctcNumber: "",
    signatoryKey: "captain",
    gender: "Female",
    civilStatus: "Single",
    purok: "Kamonsil",
  });
  const [walkInResidentSearchOpen, setWalkInResidentSearchOpen] = useState(false);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [docDropdownOpen, setDocDropdownOpen] = useState(false);
  const docDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (docDropdownRef.current && !docDropdownRef.current.contains(event.target)) {
        setDocDropdownOpen(false);
      }
    };
    if (docDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [docDropdownOpen]);

  const [documentFields, setDocumentFields] = useState(() => buildResidentFields(null, null, null));
  const [creatingWalkIn, setCreatingWalkIn] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [aiReview, setAiReview] = useState(null);
  const [documentZoom, setDocumentZoom] = useState(65);
  const previewEditorRef = useRef(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates]
  );

  const selectedWalkInTemplate = useMemo(
    () => templates.find((template) => template.id === walkInForm.templateId) || null,
    [templates, walkInForm.templateId]
  );

  const selectedWalkInResident = useMemo(
    () => residents.find((resident) => resident.id === walkInForm.residentId) || null,
    [residents, walkInForm.residentId]
  );

  const selectedResident = useMemo(() => {
    const resident =
      residents.find((item) => item.id === selectedResidentId) ||
      (selectedRequest?.resident_id === selectedResidentId ? getNestedResident(selectedRequest?.residents) : null);

    return resident || null;
  }, [residents, selectedRequest, selectedResidentId]);

  const residentOptions = useMemo(() => {
    const requestResident = getNestedResident(selectedRequest?.residents);
    const merged = requestResident
      ? [requestResident, ...residents.filter((resident) => resident.id !== requestResident.id)]
      : residents;
    const query = residentSearch.trim().toLowerCase();

    if (!query) return merged.slice(0, 50);

    return merged
      .filter((resident) =>
        [resident.full_name, resident.email, resident.house_no, resident.purok, resident.address]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      )
      .slice(0, 50);
  }, [residentSearch, residents, selectedRequest]);

  const walkInResidentOptions = useMemo(() => {
    const query = walkInForm.residentSearch.trim().toLowerCase();
    const filteredResidents = query
      ? residents.filter((resident) =>
        [resident.full_name, resident.email, resident.house_no, resident.purok, resident.address]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      )
      : residents;

    const limited = filteredResidents.slice(0, 50);

    if (
      selectedWalkInResident &&
      !limited.some((resident) => resident.id === selectedWalkInResident.id)
    ) {
      return [selectedWalkInResident, ...limited];
    }

    return limited;
  }, [residents, selectedWalkInResident, walkInForm.residentSearch]);

  const resolvedWalkInResident = useMemo(() => {
    if (selectedWalkInResident) return selectedWalkInResident;

    const query = walkInForm.residentSearch.trim().toLowerCase();
    if (!query) return null;

    const exactMatch = walkInResidentOptions.find(
      (resident) => getResidentLabel(resident).toLowerCase() === query
    );

    return exactMatch || (walkInResidentOptions.length === 1 ? walkInResidentOptions[0] : null);
  }, [selectedWalkInResident, walkInForm.residentSearch, walkInResidentOptions]);

  const missingRequiredFields = useMemo(
    () => getRequiredMissingFields(documentFields, selectedTemplateId, selectedResidentId),
    [documentFields, selectedResidentId, selectedTemplateId]
  );

  const documentIsReady = missingRequiredFields.length === 0;
  const editableDocumentText = useMemo(
    () => documentFields.documentText || getEditableDocumentText(documentFields, selectedTemplate),
    [documentFields, selectedTemplate]
  );

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return requests;

    return requests.filter((request) => {
      const residentName = getNestedResident(request.residents)?.full_name || "";
      const docType = request.document_type || "";
      const reqId = request.id || "";

      return (
        residentName.toLowerCase().includes(term) ||
        docType.toLowerCase().includes(term) ||
        reqId.toLowerCase().includes(term)
      );
    });
  }, [requests, searchTerm]);

  const stats = useMemo(
    () => ({
      total: requests.filter((request) => request.status !== "Cancelled").length,
      pending: requests.filter((request) => request.status === "Pending").length,
      processing: requests.filter((request) => ["Processing", "Approved"].includes(request.status)).length,
      completed: requests.filter((request) => ["Completed", "Released"].includes(request.status)).length,
      cancelled: requests.filter((request) => request.status === "Cancelled").length,
    }),
    [requests]
  );

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

  const loadData = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const [userData, results] = await Promise.all([
        getCurrentUserWithProfile(),
        Promise.allSettled([
          fetchDocumentRequests({ status: statusFilter, limit: 300 }),
          fetchDocumentTemplates(),
          fetchResidents("", "", { withAccounts: false, excludeArchived: true }),
          fetchOrganizationOfficials(),
        ]),
      ]);

      if (!userData || userData.profile?.role !== "admin") {
        navigate("/");
        return;
      }

      const requestResult = results[0];
      const templateResult = results[1];
      const residentResult = results[2];
      const officialResult = results[3];

      if (officialResult?.status === "fulfilled" && Array.isArray(officialResult.value)) {
        setOfficials(officialResult.value);
      }

      if (requestResult?.status === "fulfilled") {
        setRequests(requestResult.value?.data || []);
      } else {
        setRequests([]);
        setMessage({
          type: "error",
          text: requestResult?.reason?.message || "Failed to load document requests.",
        });
      }

      if (templateResult?.status === "fulfilled") {
        setTemplates(templateResult.value || []);
      } else {
        setTemplates([]);
        setMessage({
          type: "error",
          text: templateResult?.reason?.message || "Failed to load document templates.",
        });
      }

      if (residentResult?.status === "fulfilled") {
        setResidents(residentResult.value || []);
      } else {
        setResidents([]);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setMessage({ type: "error", text: err.message || "Failed to load document requests." });
    } finally {
      setLoading(false);
    }
  }, [navigate, statusFilter]);

  useEffect(() => {
    let isMounted = true;
    loadData({ showLoading: false });

    const handleOfficialsUpdate = (event) => {
      if (isMounted && event.detail?.length) {
        setOfficials(event.detail);
      }
    };

    window.addEventListener("organization_officials_updated", handleOfficialsUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("organization_officials_updated", handleOfficialsUpdate);
    };
  }, [loadData]);

  const openRequest = (request) => {
    if (isRequestExpired(request)) {
      setMessage({
        type: "error",
        text: `The document request for ${getNestedResident(request.residents)?.full_name || "resident"} has expired and cannot be viewed or edited.`,
      });
      return;
    }
    const requestResident = getNestedResident(request.residents);
    const matchedTemplate = findMatchingTemplate(templates, request.document_type);
    const savedDocument = getPreparedDocument(request.id);
    const savedFields = savedDocument?.fields || {};
    const resident =
      residents.find((item) => item.id === (savedDocument?.residentId || request.resident_id)) ||
      requestResident ||
      null;
    const template = templates.find((item) => item.id === savedDocument?.templateId) || matchedTemplate;

    setSelectedRequest(request);
    setSelectedTemplateId(template?.id || "");
    setSelectedResidentId(resident?.id || request.resident_id || "");
    setResidentSearch(resident?.full_name || "");
    setDocumentFields(
      buildResidentFields(
        resident,
        request,
        template,
        savedFields,
        captainOfficial?.name || PUNONG_BARANGAY
      )
    );
    setAiReview(null);
    setShowDetailModal(true);
  };

  const updateWalkInForm = (field, value) => {
    setWalkInForm((current) => {
      const next = {
        ...current,
        ...(field === "residentSearch" && current.residentId ? { residentId: "" } : {}),
        [field]: value,
      };

      if (field === "templateId") {
        const t = templates.find((item) => item.id === value);
        const docKey = getRealDocumentTemplateKey(t);
        if (docKey === "residency") {
          next.residencyRecommendation = next.residencyRecommendation || "job and application";
          next.purpose = next.purpose || "job and application";
        } else if (docKey === "clearance") {
          next.purpose = next.purpose || "OWWA";
        } else if (docKey === "indigency") {
          next.purpose = next.purpose || "FINANCIAL ASSISTANCE";
        } else if (docKey === "business") {
          next.businessName = next.businessName || "BANANA BUY AND SALE";
          next.purpose = next.purpose || "Business Permit Application";
        } else if (docKey === "solo") {
          next.soloParentReason = next.soloParentReason || "death of her husband";
          next.purpose = next.purpose || "Solo Parent ID and Benefits Application";
        } else if (docKey === "4ps") {
          next.fourPsSpouse = next.fourPsSpouse || "Maria Balad";
          next.purpose = next.purpose || "Pantawid Pamilyang Pilipino Program (4Ps) Requirement";
        } else if (docKey === "rsbsa") {
          next.cropsText = next.cropsText || "Rice Field ½ hectare, and Fruits Crops 1 hectare";
          next.farmSize = next.farmSize || "One (1) hectare";
          next.tenure = next.tenure || "Owner";
          next.purpose = next.purpose || "RSBSA Registration";
        }
      }

      return next;
    });

    if (field === "residentSearch") {
      setWalkInResidentSearchOpen(true);
    }
  };

  const handleWalkInResidentChange = (residentId) => {
    const resident = residents.find((item) => item.id === residentId) || null;

    setWalkInForm((current) => ({
      ...current,
      residentId,
      residentSearch: resident ? getResidentLabel(resident) : current.residentSearch,
      gender: resident?.gender || current.gender || "Female",
      civilStatus: resident?.civil_status || resident?.civilStatus || current.civilStatus || "Single",
      purok: resident?.purok || current.purok || "Kamonsil",
    }));
    setWalkInResidentSearchOpen(false);
  };

  const handleWalkInResidentSearchKeyDown = (event) => {
    if (event.key !== "Enter" || walkInForm.residentId || walkInResidentOptions.length === 0) return;

    event.preventDefault();
    handleWalkInResidentChange(walkInResidentOptions[0].id);
  };

  const handleSelectDocumentForWalkIn = (templateId) => {
    if (!templateId) {
      setWalkInForm((current) => ({ ...current, templateId: "" }));
      setShowWalkInModal(false);
      return;
    }

    const t = templates.find((item) => item.id === templateId);
    const docKey = getRealDocumentTemplateKey(t);

    setWalkInForm((current) => {
      const next = {
        ...current,
        templateId,
      };

      if (docKey === "residency") {
        next.residencyRecommendation = next.residencyRecommendation || "job and application";
        next.purpose = next.purpose || "job and application";
      } else if (docKey === "clearance") {
        next.purpose = next.purpose || "OWWA";
      } else if (docKey === "indigency") {
        next.purpose = next.purpose || "FINANCIAL ASSISTANCE";
      } else if (docKey === "business") {
        next.businessName = next.businessName || "BANANA BUY AND SALE";
        next.purpose = next.purpose || "Business Permit Application";
      } else if (docKey === "solo") {
        next.soloParentReason = next.soloParentReason || "death of her husband";
        next.purpose = next.purpose || "Solo Parent ID and Benefits Application";
      } else if (docKey === "4ps") {
        next.fourPsSpouse = next.fourPsSpouse || "Maria Balad";
        next.purpose = next.purpose || "Pantawid Pamilyang Pilipino Program (4Ps) Requirement";
      } else if (docKey === "rsbsa") {
        next.cropsText = next.cropsText || "Rice Field ½ hectare, and Fruits Crops 1 hectare";
        next.farmSize = next.farmSize || "One (1) hectare";
        next.tenure = next.tenure || "Owner";
        next.purpose = next.purpose || "RSBSA Registration";
      }

      return next;
    });

    setShowWalkInModal(true);
  };

  const handleWalkInSubmit = async (event) => {
    event.preventDefault();

    if (!selectedWalkInTemplate || !resolvedWalkInResident) {
      setMessage({
        type: "error",
        text: "Select both the document and resident before preparing a walk-in request.",
      });
      return;
    }

    setCreatingWalkIn(true);
    setMessage(null);

    try {
      const templateLabel = getTemplateLabel(selectedWalkInTemplate);
      const docKey = getRealDocumentTemplateKey(selectedWalkInTemplate);

      let finalPurpose = (walkInForm.purpose || "").trim();
      if (docKey === "residency") {
        finalPurpose = (walkInForm.residencyRecommendation || finalPurpose || "job and application").trim();
      } else if (docKey === "clearance") {
        finalPurpose = finalPurpose || "OWWA";
      } else if (docKey === "indigency") {
        finalPurpose = finalPurpose || "FINANCIAL ASSISTANCE";
      } else if (docKey === "business") {
        finalPurpose = finalPurpose || walkInForm.businessName || "BANANA BUY AND SALE";
      }

      const createdRequest = await createDocumentRequest({
        resident_id: resolvedWalkInResident.id,
        document_type: finalPurpose ? `${templateLabel} (Purpose: ${finalPurpose})` : templateLabel,
        status: "Processing",
      });
      const requestWithResident = {
        ...createdRequest,
        residents: getNestedResident(createdRequest.residents) || resolvedWalkInResident,
      };

      const residentMerged = {
        ...resolvedWalkInResident,
        gender: walkInForm.gender || resolvedWalkInResident.gender || "Female",
        civil_status: walkInForm.civilStatus || resolvedWalkInResident.civil_status || "Single",
        purok: walkInForm.purok || resolvedWalkInResident.purok || "Kamonsil",
      };

      const fields = buildResidentFields(
        residentMerged,
        requestWithResident,
        selectedWalkInTemplate,
        {
          purpose: finalPurpose,
          residencyRecommendation: docKey === "residency" ? (walkInForm.residencyRecommendation || finalPurpose || "job and application") : undefined,
          orNumber: walkInForm.orNumber || "",
          dateIssued: walkInForm.dateIssued || "",
          ctcNumber: walkInForm.ctcNumber || "",
          signatoryKey: "captain",
          businessName: walkInForm.businessName || (docKey === "business" ? "BANANA BUY AND SALE" : ""),
          soloParentReason: walkInForm.soloParentReason || "death of her husband",
          fourPsSpouse: walkInForm.fourPsSpouse || "Maria Balad",
          remarks: walkInForm.cropsText || "",
          cropsText: walkInForm.cropsText || (docKey === "rsbsa" ? "Rice Field ½ hectare, and Fruits Crops 1 hectare" : ""),
          tenure: walkInForm.tenure || "Owner",
          printFontFamily: "rockwell",
          printFontSize: "14",
        },
        captainOfficial?.name || PUNONG_BARANGAY
      );

      const review = {
        source: "Admin Quick Autofill",
        confidence: "Ready for Printing",
        summary:
          "All document details, resident information, and recommendation fields were automatically filled. The certificate is 100% complete and ready to print.",
        checklist: [
          `Template: ${getTemplateLabel(selectedWalkInTemplate)}`,
          `Resident: ${getResidentLabel(residentMerged)}`,
          `Purok: Purok ${residentMerged.purok || "Kamonsil"}`,
          docKey === "residency"
            ? `Recommendation: for ${walkInForm.residencyRecommendation || "job and application"}`
            : `Purpose: ${finalPurpose}`,
          "Document preview is 100% complete and ready for instant release.",
        ],
      };

      setRequests((currentRequests) => [
        requestWithResident,
        ...currentRequests.filter((request) => request.id !== requestWithResident.id),
      ]);
      setSelectedRequest(requestWithResident);
      setSelectedTemplateId(selectedWalkInTemplate.id);
      setSelectedResidentId(resolvedWalkInResident.id);
      setResidentSearch(getResidentLabel(resolvedWalkInResident));
      setDocumentFields(fields);
      setAiReview(review);
      setShowWalkInModal(false);
      setShowDetailModal(true);
      setMessage({
        type: "success",
        text: `Official ${templateLabel} generated successfully for ${getResidentLabel(resolvedWalkInResident)}. Ready to print or release!`,
      });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to create walk-in request." });
    } finally {
      setCreatingWalkIn(false);
    }
  };

  const updateDocumentField = (field, value) => {
    setDocumentFields((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetPrintableText = () => {
    setDocumentFields((current) => ({
      ...current,
      documentText: "",
    }));
  };

  const collectPreviewEdits = (baseFields = documentFields) => {
    const root = previewEditorRef.current;
    if (!root) return baseFields;

    let nextFields = baseFields;
    const setPreviewField = (field, value) => {
      const normalizedValue = normalizeEditablePreviewText(value);
      const currentValue = normalizeEditablePreviewText(baseFields[field]);

      if (!normalizedValue || normalizedValue === currentValue) return;
      if (nextFields === baseFields) nextFields = { ...baseFields };
      nextFields[field] = normalizedValue;
    };

    const bodyNode = root.querySelector("[data-editable-document-body]");
    if (bodyNode) {
      const nextDocumentText = getEditablePreviewBlockText(bodyNode);
      const currentPreviewText = normalizeEditablePreviewText(editableDocumentText);
      const currentCustomText = normalizeEditablePreviewText(baseFields.documentText);

      if (nextDocumentText && (nextDocumentText !== currentPreviewText || currentCustomText)) {
        setPreviewField("documentText", nextDocumentText);
      }
    }

    root.querySelectorAll("[data-editable-field]").forEach((node) => {
      const field = node.dataset.editableField;
      if (!["approvingOfficer", "preparedBy"].includes(field)) return;
      setPreviewField(field, node.innerText || node.textContent);
    });

    return nextFields;
  };

  const commitPreviewEdits = () => {
    const nextFields = collectPreviewEdits();
    if (nextFields !== documentFields) {
      setDocumentFields(nextFields);
    }
    return nextFields;
  };

  const handlePreviewEditorBlur = () => {
    commitPreviewEdits();
  };

  const handlePreviewEditorPaste = (event) => {
    const editableTarget =
      event.target instanceof Element ? event.target.closest('[contenteditable="true"]') : null;
    if (!editableTarget || !event.currentTarget.contains(editableTarget)) return;

    const pastedText = event.clipboardData?.getData("text/plain");
    if (!pastedText) return;

    event.preventDefault();

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(pastedText));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleFormatText = (command, value = null) => {
    document.execCommand(command, false, value);
    commitPreviewEdits();
  };

  const handleSelectAllDocumentText = () => {
    const root = previewEditorRef.current;
    if (!root) return;

    const bodyNode = root.querySelector("[data-editable-document-body]");
    const targetNode = bodyNode || root;

    const range = document.createRange();
    range.selectNodeContents(targetNode);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const handlePreviewEditorKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      const activeElem = document.activeElement;
      if (previewEditorRef.current && previewEditorRef.current.contains(activeElem)) {
        event.preventDefault();
        handleSelectAllDocumentText();
      }
    }
  };

  const handleTemplateChange = (templateId) => {
    const template = templates.find((item) => item.id === templateId) || null;

    setSelectedTemplateId(templateId);
    setDocumentFields((current) => ({
      ...current,
      documentTitle: getTemplateLabel(template),
      documentText: "",
    }));
    setAiReview(null);
  };

  const handleResidentChange = (residentId) => {
    const resident =
      residents.find((item) => item.id === residentId) ||
      (selectedRequest?.resident_id === residentId ? getNestedResident(selectedRequest?.residents) : null);

    setSelectedResidentId(residentId);
    setResidentSearch(resident?.full_name || "");
    setDocumentFields((current) =>
      buildResidentFields(resident, selectedRequest, selectedTemplate, {
        purpose: current.purpose,
        issueDate: current.issueDate,
        preparedBy: current.preparedBy,
        approvingOfficer: current.approvingOfficer,
        remarks: current.remarks,
        documentTitle: current.documentTitle,
        documentText: "",
        printFontSize: current.printFontSize,
        printLineHeight: current.printLineHeight,
        printParagraphGap: current.printParagraphGap,
      })
    );
    setAiReview(null);
  };



  const buildDocumentPickupSmsTemplate = ({ residentName, rawDocType }) => {
    const cleanDoc = String(rawDocType || "Barangay Document")
      .replace(/\s*\(Purpose:[^)]*\)/gi, "")
      .replace(/\s*\([^)]*\)/g, "")
      .trim();

    const lower = cleanDoc.toLowerCase();

    let feeText = "3. Document Processing Fee: ₱50.00";
    let additionalReqs = [];

    if (lower.includes("indigency")) {
      feeText = "3. Document Fee: ₱50.00 (Libre para sa Indigent / 4Ps Beneficiary)";
    } else if (lower.includes("business")) {
      feeText = "3. Document Fee: ₱50.00";
      additionalReqs = ["4. DTI Business Registration / Negosyo Details"];
    }

    const requirementsList = [
      "1. Valid Government / Resident I.D",
      "2. Cedula (Community Tax Certificate)",
      feeText,
      ...additionalReqs,
    ];

    const lines = [
      "[OFFICIAL KAAGAPAI NOTIFICATION]",
      "BARANGAY UPPER MINGADING, ALEOSAN",
      "----------------------------------------",
      `📄 Magandang araw, ${residentName || "Residente"}!`,
      "",
      "Ang inyong ONLINE DOCUMENT REQUEST para sa:",
      `👉 ${cleanDoc.toUpperCase()}`,
      "ay COMPLETED at READY FOR PICKUP na sa ating Barangay Hall.",
      "",
      "MGA DAPAT DALHIN SA PAGKUHA:",
      ...requirementsList,
      "",
      "ORAS NG OPISINA:",
      "Lunes hanggang Biyernes (8:00 AM - 5:00 PM)",
      "----------------------------------------",
      "⚠️ PAALALA: Magbayad lamang sa mismong Barangay Treasury sa Hall. Ang Barangay ay HINDI humihingi ng bayad via GCash o text.",
    ];

    return lines.join("\n").slice(0, 1500);
  };

  const handleStatusChange = async (id, newStatus, skipConfirm = false) => {
    let confirmTitle = `Mark Request as ${newStatus}`;
    let confirmMessage = `Are you sure you want to update this document request status to ${newStatus}?`;
    let variant = "emerald";

    if (newStatus === "Completed") {
      confirmTitle = "Mark Ready for Pick-up";
      confirmMessage = "Mark this document as Ready for Pick-up and send an SMS & in-app notification to the resident?";
      variant = "emerald";
    } else if (newStatus === "Approved") {
      confirmTitle = "Approve Document Request";
      confirmMessage = "Are you sure you want to approve this document request?";
      variant = "emerald";
    } else if (newStatus === "Released") {
      confirmTitle = "Mark Document as Released";
      confirmMessage = "Are you sure you want to mark this document as Released to the resident?";
      variant = "emerald";
    } else if (newStatus === "Rejected") {
      confirmTitle = "Reject Document Request";
      confirmMessage = "Are you sure you want to reject this document request?";
      variant = "danger";
    }

    if (!skipConfirm) {
      const ok = await confirm({
        title: confirmTitle,
        message: confirmMessage,
        confirmText: newStatus === "Rejected" ? "Reject" : newStatus === "Completed" ? "Notify & Ready" : "Confirm",
        cancelText: "Cancel",
        variant: variant,
        icon: newStatus === "Rejected" ? Trash2 : CheckCircle,
      });
      if (!ok) return false;
    }

    setUpdating(true);

    try {
      const updatedRequest = await updateDocumentRequestStatus(id, newStatus);

      // Notify resident via SMS if they have a phone number and status is Completed / Approved / Released
      if (newStatus === "Completed" || newStatus === "Approved" || newStatus === "Released") {
        const targetRequest = requests.find((r) => r.id === id) || selectedRequest;
        const nestedResident = targetRequest ? getNestedResident(targetRequest.residents) : null;
        let phone = nestedResident?.phone;
        let residentFullName = nestedResident?.first_name || nestedResident?.full_name;

        // Fallback: Fetch direct from residents table if not in memory
        if (!phone && targetRequest?.resident_id) {
          try {
            const { data: directRes } = await supabase
              .from("residents")
              .select("phone, full_name, first_name")
              .eq("id", targetRequest.resident_id)
              .limit(1)
              .maybeSingle();
            if (directRes?.phone) {
              phone = directRes.phone;
              residentFullName = directRes.first_name || directRes.full_name || residentFullName;
            }
          } catch (e) {
            console.warn("Resident direct phone fetch note:", e);
          }
        }

        if (phone && isValidSmsPhone(phone)) {
          try {
            const smsBody = buildDocumentPickupSmsTemplate({
              residentName: residentFullName,
              rawDocType: targetRequest?.document_type,
            });
            await sendSmsNotification({ to: phone, body: smsBody });
          } catch (smsError) {
            console.warn("Failed to send document completion SMS:", smsError);
          }
        }
      }

      setRequests((currentRequests) =>
        currentRequests.map((request) =>
          request.id === id ? { ...request, ...updatedRequest, status: newStatus } : request
        )
      );

      setMessage({
        type: "success",
        text:
          newStatus === "Completed"
            ? "Request marked as Ready for Pick-up. The resident was notified via SMS & In-App Notification."
            : newStatus === "Released"
            ? "Request marked as Released."
            : `Request marked as ${newStatus}.`,
      });

      if (selectedRequest?.id === id) {
        setSelectedRequest((current) => ({
          ...current,
          ...updatedRequest,
          status: newStatus,
        }));
      }
      return true;
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to update status." });
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteRequest = async (id) => {
    const ok = await confirm({
      title: "Delete Record",
      message: "Are you sure you want to delete this record?",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
      icon: Trash2,
    });
    if (!ok) return;

    try {
      await deleteDocumentRequest(id);
      setRequests((currentRequests) => currentRequests.filter((request) => request.id !== id));
      setSelectedRowIds((prev) => prev.filter((rowId) => rowId !== id));
      setMessage({
        type: "success",
        text: "Request deleted successfully.",
      });

      if (selectedRequest?.id === id) {
        setShowDetailModal(false);
        setSelectedRequest(null);
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to delete request." });
    }
  };

  const handleDeleteSelectedRequests = async () => {
    if (selectedRowIds.length === 0) return;
    const count = selectedRowIds.length;
    const ok = await confirm({
      title: `Delete ${count} Record${count > 1 ? "s" : ""}`,
      message: `Are you sure you want to delete ${count} selected document request${count > 1 ? "s" : ""}? They will be moved to the Recycle Bin.`,
      confirmText: `Delete ${count} Record${count > 1 ? "s" : ""}`,
      cancelText: "Cancel",
      variant: "danger",
      icon: Trash2,
    });
    if (!ok) return;

    setDeletingSelected(true);
    try {
      await deleteDocumentRequests(selectedRowIds);
      const deletedSet = new Set(selectedRowIds);
      setRequests((currentRequests) =>
        currentRequests.filter((request) => !deletedSet.has(request.id))
      );
      if (selectedRequest && deletedSet.has(selectedRequest.id)) {
        setShowDetailModal(false);
        setSelectedRequest(null);
      }
      setSelectedRowIds([]);
      setMessage({
        type: "success",
        text: `Successfully deleted ${count} document request${count > 1 ? "s" : ""}.`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.message || "Failed to delete selected document requests.",
      });
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredRequests.map((r) => r.id);
    setSelectedRowIds(allFilteredIds);
  };

  const handleDeselectAll = () => {
    setSelectedRowIds([]);
  };

  const isAllFilteredSelected =
    filteredRequests.length > 0 &&
    filteredRequests.every((r) => selectedRowIds.includes(r.id));

  const toggleSelectRow = (id) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveDocument = (silent = false) => {
    if (!selectedRequest) return;
    setSavingDocument(true);
    const fieldsToSave = commitPreviewEdits();

    try {
      savePreparedDocument(selectedRequest.id, {
        templateId: selectedTemplateId,
        residentId: selectedResidentId,
        fields: fieldsToSave,
        aiReview,
      });

      if (!silent) {
        setMessage({
          type: "success",
          text: "Prepared document saved.",
        });
      }
    } catch (err) {
      if (!silent) {
        setMessage({ type: "error", text: err.message || "Failed to save document." });
      }
    } finally {
      setSavingDocument(false);
    }
  };

  const handlePrintDocument = () => {
    if (!selectedRequest || !documentIsReady) return;
    const fieldsToPrint = commitPreviewEdits();

    const printWindow = window.open(
      "",
      "kaagapai-document-print-preview",
      "width=980,height=1000,resizable=yes,scrollbars=yes"
    );
    if (!printWindow) {
      setMessage({ type: "error", text: "Please allow pop-ups so the document can be printed." });
      return;
    }

    try {
      printWindow.document.open();
      printWindow.document.write(
        getRealDocumentPrintMarkup({
          fields: fieldsToPrint,
          template: selectedTemplate,
        })
      );
      printWindow.document.close();
      printWindow.opener = null;
      printWindow.focus();

      // Automatically update status to Released on print without confirmation
      const id = selectedRequest.id;
      (async () => {
        try {
          const updatedRequest = await updateDocumentRequestStatus(id, "Released");
          setRequests((currentRequests) =>
            currentRequests.map((request) =>
              request.id === id ? { ...request, ...updatedRequest, status: "Released" } : request
            )
          );
          if (selectedRequest?.id === id) {
            setSelectedRequest((current) => ({
              ...current,
              ...updatedRequest,
              status: "Released",
            }));
          }
        } catch (statusError) {
          console.warn("Failed to automatically update status to Released on print:", statusError);
        }
      })();

      setShowDetailModal(false);

      setMessage({
        type: "success",
        text: "Directing to printer... Document has been printed and marked as Released.",
      });
    } catch (error) {
      printWindow.close();
      setMessage({
        type: "error",
        text: error.message || "Unable to open the document print preview.",
      });
    }
  };

  const handleTemplateFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !selectedTemplate) return;

    setUploadingTemplate(true);
    setMessage(null);

    try {
      const updatedTemplate = await uploadDocumentTemplateFile(selectedTemplate, file);

      setTemplates((currentTemplates) => {
        let replaced = false;
        const selectedTemplateName = normalizeText(selectedTemplate.template_name);
        const selectedTemplateType = normalizeText(selectedTemplate.document_type);
        const updatedTemplateName = normalizeText(updatedTemplate.template_name);
        const updatedTemplateType = normalizeText(updatedTemplate.document_type);
        const nextTemplates = currentTemplates.map((template) => {
          const isSelectedTemplate = template.id === selectedTemplate.id;
          const isUpdatedTemplate = template.id === updatedTemplate.id;
          const hasSameName =
            updatedTemplateName &&
            [normalizeText(template.template_name), normalizeText(template.document_type)].includes(
              updatedTemplateName
            );
          const hasSameType =
            updatedTemplateType &&
            [normalizeText(template.template_name), normalizeText(template.document_type)].includes(
              updatedTemplateType
            );
          const matchesSelectedName =
            selectedTemplateName &&
            [normalizeText(template.template_name), normalizeText(template.document_type)].includes(
              selectedTemplateName
            );
          const matchesSelectedType =
            selectedTemplateType &&
            [normalizeText(template.template_name), normalizeText(template.document_type)].includes(
              selectedTemplateType
            );

          if (
            isSelectedTemplate ||
            isUpdatedTemplate ||
            hasSameName ||
            hasSameType ||
            matchesSelectedName ||
            matchesSelectedType
          ) {
            replaced = true;
            return {
              ...template,
              ...updatedTemplate,
            };
          }

          return template;
        });

        return replaced ? nextTemplates : [...nextTemplates, updatedTemplate];
      });
      setSelectedTemplateId(updatedTemplate.id || selectedTemplate.id);
      setMessage({
        type: "success",
        text: `${file.name} uploaded for ${getTemplateLabel(updatedTemplate)}.`,
      });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to upload template." });
    } finally {
      setUploadingTemplate(false);
    }
  };



  const columns = useMemo(() => {
    const cols = [];

    cols.push({
      field: "__selection__",
      headerName: "Select",
      width: 125,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderHeader: () => (
        <div className="flex items-center gap-1.5 py-1" onClick={(e) => e.stopPropagation()}>
          {!isSelectMode ? (
            <button
              type="button"
              onClick={() => setIsSelectMode(true)}
              className="text-[11px] font-black uppercase tracking-wider text-emerald-800 hover:text-emerald-950 bg-emerald-100/80 hover:bg-emerald-200 px-2 py-0.5 rounded cursor-pointer transition shadow-2xs leading-none"
              title="Click to enable multi-select checkboxes"
            >
              SELECT
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-1 cursor-pointer select-none text-[10px] font-extrabold text-emerald-950">
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected && filteredRequests.length > 0}
                  onChange={(e) => {
                    e.stopPropagation();
                    if (isAllFilteredSelected || selectedRowIds.length > 0) {
                      handleDeselectAll();
                    } else {
                      handleSelectAllFiltered();
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#10b981]"
                />
                <span className="uppercase text-[10px] tracking-wide font-black">SELECT ALL</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedRowIds([]);
                }}
                className="text-[11px] font-black text-slate-400 hover:text-rose-600 px-1 cursor-pointer"
                title="Cancel selection"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ),
      renderCell: (params) => {
        if (!isSelectMode) return null;
        const id = params.row.id;
        const isSelected = selectedRowIdsSet.has(id);
        return (
          <div
            className="flex items-center justify-center w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                toggleSelectRow(id);
              }}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#10b981]"
            />
          </div>
        );
      },
    });

    cols.push(
      {
        field: "resident",
        headerName: "Resident",
        flex: 1.5,
        renderCell: (params) => {
          const request = params.row;
          return getNestedResident(request.residents)?.full_name || "N/A";
        }
      },
      {
        field: "document_type",
        headerName: "Document Type",
        flex: 1.5,
        renderCell: (params) => params.row.document_type
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1.2,
        renderCell: (params) => {
          const request = params.row;
          const displayStatus = isRequestExpired(request) ? "Expired" : request.status;
          const label = displayStatus === "Completed" ? "Ready for Pick-up" : displayStatus;
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={getStatusBadgeStyle(displayStatus)}>
              {displayStatus === "Completed" && <CheckCircle size={12} className="stroke-[2.5]" />}
              {displayStatus === "Released" && <Check size={12} className="stroke-[3]" />}
              {label}
            </span>
          );
        }
      },
      {
        field: "created_at",
        headerName: "Requested",
        flex: 1.2,
        renderCell: (params) => formatDate(params.row.created_at)
      },
      {
        field: "actions",
        headerName: "Actions",
        flex: 1,
        headerAlign: "right",
        align: "right",
        renderCell: (params) => {
          const request = params.row;
          const expired = isRequestExpired(request);
          return (
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => openRequest(request)}
                disabled={expired}
                className={`gov-action-btn view ${expired ? "opacity-50 cursor-not-allowed" : ""}`}
                title={expired ? "Expired" : "Open template and preview"}
              >
                <Eye size={18} />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRequest(request.id)}
                className="gov-action-btn delete"
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          );
        }
      }
    );

    return cols;
  }, [filteredRequests, isAllFilteredSelected, isSelectMode, selectedRowIdsSet]);

  return (
    <>
      <PageWrapper title="Document Management" description="Review requests, generate certificates, and print documents">
          <div className="glass-container">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 p-3 border-b border-slate-200/50 bg-slate-50/40">
              <div className="flex items-center gap-3 rounded-xl bg-white p-2.5 border border-slate-200/70 shadow-2xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shrink-0">
                  <ClipboardList size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">Total Requests</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {delayedLoading ? (
                      <div className="h-5 w-10 animate-pulse rounded bg-slate-200" />
                    ) : (
                      <>
                        <span className="text-base font-black text-slate-900 leading-tight">{stats.total}</span>
                        <span className="text-[10px] font-bold text-emerald-600">↑12%</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-white p-2.5 border border-amber-200/70 shadow-2xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 truncate">Pending</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {delayedLoading ? (
                      <div className="h-5 w-10 animate-pulse rounded bg-amber-100" />
                    ) : (
                      <>
                        <span className="text-base font-black text-amber-700 leading-tight">{stats.pending}</span>
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1 py-0.2 rounded">Active</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-white p-2.5 border border-blue-200/70 shadow-2xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                  <RefreshCw size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 truncate">Processing</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {delayedLoading ? (
                      <div className="h-5 w-10 animate-pulse rounded bg-blue-100" />
                    ) : (
                      <span className="text-base font-black text-blue-700 leading-tight">{stats.processing}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-white p-2.5 border border-emerald-200/70 shadow-2xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <CheckCircle size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 truncate">Completed</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {delayedLoading ? (
                      <div className="h-5 w-10 animate-pulse rounded bg-emerald-100" />
                    ) : (
                      <>
                        <span className="text-base font-black text-emerald-700 leading-tight">{stats.completed}</span>
                        <span className="text-[10px] font-bold text-emerald-600">↑5%</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Floating Modal Form (Ultra-Compact, Dead-Centered, No Dark Dimming Overlay, No Scroll) */}
            {showWalkInModal && selectedWalkInTemplate && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/15 backdrop-blur-[2px]"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowWalkInModal(false);
                }}
              >
                <div
                  style={{ maxWidth: 440, width: "90%" }}
                  className="relative mx-auto rounded-2xl border border-emerald-500/40 bg-white p-3.5 shadow-2xl space-y-2.5 animate-fade-in text-slate-900 overflow-hidden"
                >
                  {/* Top Emerald Gradient Accent Strip */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-700 via-[#00552E] to-teal-600 rounded-t-2xl" />

                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-1.5 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#00552E] text-white shadow-xs">
                        <FileText size={13} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-[8.5px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100 px-1.5 py-0.2 rounded-full border border-emerald-300">
                            Fill & Generate
                          </span>
                        </div>
                        <h3 className="text-xs font-black text-slate-900 leading-tight">
                          {getTemplateLabel(selectedWalkInTemplate)}
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowWalkInModal(false)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-900 transition cursor-pointer"
                      aria-label="Close"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <form onSubmit={handleWalkInSubmit} className="space-y-2">
                    {/* Search Resident & Resident Select Dropdown */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {/* Search Resident */}
                      <div className="relative">
                        <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-600 block mb-0.5">
                          Search Resident
                        </label>
                        <input
                          value={walkInForm.residentSearch}
                          onChange={(event) => updateWalkInForm("residentSearch", event.target.value)}
                          onFocus={() => setWalkInResidentSearchOpen(true)}
                          onBlur={() => window.setTimeout(() => setWalkInResidentSearchOpen(false), 150)}
                          onKeyDown={handleWalkInResidentSearchKeyDown}
                          placeholder="Search resident name..."
                          role="combobox"
                          aria-expanded={walkInResidentSearchOpen}
                          aria-controls="walk-in-modal-resident-results"
                          aria-autocomplete="list"
                          className="h-7.5 w-full rounded-lg border border-emerald-200 bg-emerald-50/40 px-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#00552E] focus:bg-white focus:ring-1 focus:ring-emerald-500/20"
                        />
                        {walkInResidentSearchOpen && walkInForm.residentSearch.trim() ? (
                          <div
                            id="walk-in-modal-resident-results"
                            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-xl border border-emerald-200 bg-white p-1 shadow-xl custom-scrollbar"
                            role="listbox"
                          >
                            {walkInResidentOptions.length > 0 ? (
                              walkInResidentOptions.slice(0, 6).map((resident) => (
                                <button
                                  key={resident.id}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => handleWalkInResidentChange(resident.id)}
                                  className="flex w-full flex-col rounded-lg px-2 py-1 text-left hover:bg-emerald-50 focus:bg-emerald-100 transition cursor-pointer"
                                  role="option"
                                  aria-selected={walkInForm.residentId === resident.id}
                                >
                                  <span className="text-xs font-bold text-slate-900">{getResidentLabel(resident)}</span>
                                  <span className="text-[10px] text-slate-500">{getResidentMeta(resident)}</span>
                                </button>
                              ))
                            ) : (
                              <div className="p-2 text-center text-xs text-slate-500">No resident found.</div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {/* Resident Select Dropdown */}
                      <div>
                        <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-600 block mb-0.5">
                          Select Resident
                        </label>
                        <select
                          value={walkInForm.residentId || resolvedWalkInResident?.id || ""}
                          onChange={(event) => handleWalkInResidentChange(event.target.value)}
                          className="h-7.5 w-full rounded-lg border border-emerald-200 bg-emerald-50/40 px-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#00552E] focus:bg-white focus:ring-1 focus:ring-emerald-500/20 cursor-pointer truncate"
                        >
                          <option value="">-- Select resident --</option>
                          {walkInResidentOptions.map((resident) => (
                            <option key={resident.id} value={resident.id}>
                              {resident.full_name} ({resident.purok ? `Purok ${resident.purok}` : "No Purok"})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Document-Specific Purpose / Details */}
                    {getRealDocumentTemplateKey(selectedWalkInTemplate) === "clearance" && (
                      <div className="space-y-1 rounded-xl bg-emerald-50/50 p-2 border border-emerald-200/80">
                        <div className="flex items-center justify-between">
                          <label className="text-[9.5px] font-black uppercase tracking-wider text-[#00552E]">
                            Clearance Purpose
                          </label>
                          <span className="text-[8px] font-bold text-emerald-800 bg-emerald-200/80 px-1 py-0.2 rounded">1-Click Suggestions</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {["OWWA", "LOCAL EMPLOYMENT", "POSTAL ID", "POLICE / NBI", "BANK REQUIREMENT", "SCHOOL REQUIREMENT"].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => updateWalkInForm("purpose", p)}
                              className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold transition border cursor-pointer ${
                                (walkInForm.purpose || "").toUpperCase() === p
                                  ? "bg-[#00552E] text-white border-[#00552E] shadow-2xs"
                                  : "bg-white text-emerald-950 hover:bg-emerald-100 border-emerald-200"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={walkInForm.purpose || ""}
                          onChange={(e) => updateWalkInForm("purpose", e.target.value)}
                          placeholder="Enter custom purpose or select above..."
                          className="w-full h-7 rounded-lg border border-emerald-300 bg-white px-2 text-xs font-semibold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500/20"
                        />
                      </div>
                    )}

                    {getRealDocumentTemplateKey(selectedWalkInTemplate) === "residency" && (
                      <div className="space-y-1 rounded-xl bg-emerald-50/50 p-2 border border-emerald-200/80">
                        <div className="flex items-center justify-between">
                          <label className="text-[9.5px] font-black uppercase tracking-wider text-[#00552E]">
                            Purpose / Recommendation
                          </label>
                          <span className="text-[8px] font-bold text-emerald-800 bg-emerald-200/80 px-1 py-0.2 rounded">1-Click Suggestions</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { label: "⭐️ Job Application", val: "job and application" },
                            { label: "Local Employment", val: "Local Employment" },
                            { label: "Scholarship", val: "Scholarship Application" },
                            { label: "Bank Account", val: "Bank Account Opening" },
                            { label: "Barangay ID", val: "Barangay ID Application" },
                            { label: "Legal Purpose", val: "whatever legal purpose it may serve best" },
                          ].map((preset) => (
                            <button
                              key={preset.val}
                              type="button"
                              onClick={() => {
                                updateWalkInForm("residencyRecommendation", preset.val);
                                updateWalkInForm("purpose", preset.val);
                              }}
                              className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold transition border cursor-pointer ${
                                (walkInForm.residencyRecommendation || walkInForm.purpose) === preset.val
                                  ? "bg-[#00552E] text-white border-[#00552E] shadow-2xs"
                                  : "bg-white text-emerald-950 hover:bg-emerald-100 border-emerald-200"
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={walkInForm.residencyRecommendation || walkInForm.purpose || ""}
                          onChange={(e) => {
                            updateWalkInForm("residencyRecommendation", e.target.value);
                            updateWalkInForm("purpose", e.target.value);
                          }}
                          placeholder="Enter custom purpose or select above..."
                          className="w-full h-7 rounded-lg border border-emerald-300 bg-white px-2 text-xs font-semibold text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500/20"
                        />
                      </div>
                    )}

                    {getRealDocumentTemplateKey(selectedWalkInTemplate) === "indigency" && (
                      <div className="space-y-1 rounded-xl bg-emerald-50/50 p-2 border border-emerald-200/80">
                        <label className="text-[9.5px] font-black uppercase tracking-wider text-[#00552E] block">Purpose of Indigency</label>
                        <div className="flex flex-wrap gap-1">
                          {["FINANCIAL ASSISTANCE", "MEDICAL ASSISTANCE", "BURIAL ASSISTANCE", "EDUCATIONAL ASSISTANCE", "LEGAL ASSISTANCE"].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => updateWalkInForm("purpose", p)}
                              className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold transition border cursor-pointer ${
                                (walkInForm.purpose || "").toUpperCase() === p
                                  ? "bg-[#00552E] text-white border-[#00552E]"
                                  : "bg-white text-emerald-950 hover:bg-emerald-100 border-emerald-200"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={walkInForm.purpose || ""}
                          onChange={(e) => updateWalkInForm("purpose", e.target.value)}
                          placeholder="Enter purpose..."
                          className="w-full h-7 rounded-lg border border-emerald-300 bg-white px-2 text-xs font-semibold text-slate-900 outline-none"
                        />
                      </div>
                    )}

                    {getRealDocumentTemplateKey(selectedWalkInTemplate) === "business" && (
                      <div className="space-y-1 rounded-xl bg-emerald-50/50 p-2 border border-emerald-200/80">
                        <label className="text-[9.5px] font-black uppercase tracking-wider text-[#00552E] block">Business Name & Nature</label>
                        <div className="flex flex-wrap gap-1">
                          {["BANANA BUY AND SALE", "SARI-SARI STORE", "AGRI-SUPPLY", "FOOD STALL / CARINDERIA"].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                updateWalkInForm("businessName", p);
                                updateWalkInForm("purpose", p);
                              }}
                              className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold transition border cursor-pointer ${
                                walkInForm.businessName === p
                                  ? "bg-[#00552E] text-white border-[#00552E]"
                                  : "bg-white text-emerald-950 hover:bg-emerald-100 border-emerald-200"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={walkInForm.businessName || ""}
                          onChange={(e) => {
                            updateWalkInForm("businessName", e.target.value);
                            updateWalkInForm("purpose", e.target.value);
                          }}
                          placeholder="Enter business name & nature..."
                          className="w-full h-7 rounded-lg border border-emerald-300 bg-white px-2 text-xs font-semibold text-slate-900 outline-none"
                        />
                      </div>
                    )}

                    {getRealDocumentTemplateKey(selectedWalkInTemplate) === "solo" && (
                      <div className="space-y-1 rounded-xl bg-emerald-50/50 p-2 border border-emerald-200/80">
                        <label className="text-[9.5px] font-black uppercase tracking-wider text-[#00552E] block">Solo Parent Reason</label>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { label: "Death of Spouse", val: "death of her husband" },
                            { label: "Separation from Spouse", val: "separation from her husband" },
                            { label: "Single Mother", val: "single mother / unmarried" },
                          ].map((p) => (
                            <button
                              key={p.val}
                              type="button"
                              onClick={() => updateWalkInForm("soloParentReason", p.val)}
                              className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold transition border cursor-pointer ${
                                walkInForm.soloParentReason === p.val
                                  ? "bg-[#00552E] text-white border-[#00552E]"
                                  : "bg-white text-emerald-950 hover:bg-emerald-100 border-emerald-200"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={walkInForm.soloParentReason || ""}
                          onChange={(e) => updateWalkInForm("soloParentReason", e.target.value)}
                          placeholder="Enter solo parent reason..."
                          className="w-full h-7 rounded-lg border border-emerald-300 bg-white px-2 text-xs font-semibold text-slate-900 outline-none"
                        />
                      </div>
                    )}

                    {/* RSBSA Farm & Crops Details inside Step 2 */}
                    {getRealDocumentTemplateKey(selectedWalkInTemplate) === "rsbsa" && (
                      <div className="space-y-1 rounded-xl bg-emerald-50/60 p-2 border border-emerald-200/90">
                        <label className="text-[9.5px] font-black text-emerald-950 uppercase tracking-wide block">
                          🌾 Crops & Farm Land
                        </label>
                        <input
                          type="text"
                          value={walkInForm.cropsText || "Rice Field ½ hectare, and Fruits Crops 1 hectare"}
                          onChange={(e) => updateWalkInForm("cropsText", e.target.value)}
                          placeholder="Rice Field ½ hectare, and Fruits Crops 1 hectare"
                          className="w-full h-7 rounded-lg border border-emerald-300 bg-white px-2 text-xs font-semibold text-slate-900 outline-none"
                          required
                        />
                      </div>
                    )}

                    {/* 4Ps Certification Details inside Step 2 */}
                    {getRealDocumentTemplateKey(selectedWalkInTemplate) === "4ps" && (
                      <div className="space-y-1 rounded-xl bg-emerald-50/60 p-2 border border-emerald-200/90">
                        <label className="text-[9.5px] font-black text-emerald-950 uppercase tracking-wide block">
                          🏛️ Select 4Ps Purpose
                        </label>
                        <select
                          value={walkInForm.fourPsPreset || "change_grantee_abroad"}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateWalkInForm("fourPsPreset", val);
                            if (val === "change_grantee_abroad") {
                              updateWalkInForm("purpose", "Change Grantee (Spouse Working Abroad)");
                            } else if (val === "change_grantee_transfer") {
                              updateWalkInForm("purpose", "Change Grantee / Transfer of Cash Grant Beneficiary");
                            } else if (val === "cash_grant_requirement") {
                              updateWalkInForm("purpose", "Pantawid Pamilyang Pilipino Program (4Ps) Requirement");
                            } else if (val === "member_verification") {
                              updateWalkInForm("purpose", "4Ps Beneficiary & Household Member Verification");
                            } else if (val === "profile_update") {
                              updateWalkInForm("purpose", "Updating of 4Ps Household Profile & Records");
                            } else if (val === "legal_purpose") {
                              updateWalkInForm("purpose", "whatever legal purpose it may serve best");
                            }
                          }}
                          className="w-full h-7 rounded-lg border border-emerald-300 bg-white px-2 text-xs font-semibold text-slate-900 outline-none"
                        >
                          <option value="change_grantee_abroad">1. Change Grantee (Working Abroad)</option>
                          <option value="change_grantee_transfer">2. Change Grantee / Transfer Beneficiary</option>
                          <option value="cash_grant_requirement">3. 4Ps Cash Grant Requirement</option>
                          <option value="member_verification">4. Beneficiary & Member Verification</option>
                          <option value="profile_update">5. Updating of 4Ps Household Profile</option>
                          <option value="legal_purpose">6. Whatever legal purpose it may serve best</option>
                        </select>
                      </div>
                    )}

                    {/* Modal Footer Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-emerald-100">
                      <button
                        type="button"
                        onClick={() => setShowWalkInModal(false)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={creatingWalkIn || (!walkInForm.residentId && !resolvedWalkInResident)}
                        className="inline-flex h-7.5 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00552E] to-emerald-700 hover:from-[#004224] hover:to-emerald-800 px-4 text-xs font-bold text-white shadow-sm active:scale-98 transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      >
                        {creatingWalkIn ? <Loader size={13} className="animate-spin" /> : <UserCheck size={13} />}
                        <span>{creatingWalkIn ? "Generating..." : "Generate Document"}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="p-4 sm:p-5 border-b border-slate-200/50 bg-slate-50/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-1 flex-wrap items-end gap-2.5">
                  <div className="w-full sm:max-w-xs">
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      <Search size={13} className="mr-1.5 inline text-emerald-600" />
                      Search
                    </label>
                    <input
                      type="text"
                      placeholder="Search by resident or document type..."
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="w-full h-[38px] rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-2xs"
                    />
                  </div>

                  <div className="w-full sm:max-w-[170px]">
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      <Filter size={13} className="mr-1.5 inline text-emerald-600" />
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="w-full h-[38px] rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-2xs cursor-pointer"
                    >
                      <option value="">All Status</option>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => loadData({ showLoading: true })}
                    className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-[10px] bg-slate-50 border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    Refresh
                  </button>

                  {selectedRowIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteSelectedRequests}
                      disabled={deletingSelected}
                      className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-[10px] bg-rose-600 hover:bg-rose-700 px-3 text-xs font-bold text-white transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-60"
                    >
                      <Trash2 size={13} />
                      <span>Delete ({selectedRowIds.length})</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* "Select Document" Template Selector with Dropdown */}
                  <div className="relative" ref={docDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setDocDropdownOpen((prev) => !prev)}
                      className={`inline-flex h-[38px] w-56 sm:w-64 items-center justify-between gap-2 rounded-xl border bg-white px-3.5 text-xs transition shadow-2xs hover:shadow-xs cursor-pointer ${
                        docDropdownOpen
                          ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-slate-50/50"
                          : "border-slate-200 hover:border-emerald-400 bg-white"
                      }`}
                      title="Select Document Template"
                    >
                      <div className="flex items-center gap-2 min-w-0 truncate">
                        <FileText size={14} className="text-emerald-700 shrink-0" />
                        <span className={`truncate text-xs ${walkInForm.templateId && selectedWalkInTemplate ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                          {walkInForm.templateId && selectedWalkInTemplate ? getTemplateLabel(selectedWalkInTemplate) : "Select Document"}
                        </span>
                      </div>
                      <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-200 ${docDropdownOpen ? "rotate-180 text-emerald-600" : ""}`} />
                    </button>

                    {docDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1.5 z-40 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl animate-fade-in divide-y divide-slate-100">
                        <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50/80 rounded-lg mb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <FileText size={12} className="text-emerald-700" />
                            Official Templates
                          </span>
                          <span className="text-[9px] bg-emerald-200/80 px-1.5 py-0.5 rounded text-emerald-900 font-bold">{templates.length} docs</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto py-1 space-y-0.5 custom-scrollbar">
                          {templates.map((template) => (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => {
                                handleSelectDocumentForWalkIn(template.id);
                                setDocDropdownOpen(false);
                              }}
                              className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition cursor-pointer ${
                                walkInForm.templateId === template.id
                                  ? "bg-emerald-50 text-emerald-800 font-bold border border-emerald-200"
                                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium"
                              }`}
                            >
                              <FileText size={14} className={walkInForm.templateId === template.id ? "text-emerald-700" : "text-slate-400"} />
                              <span className="truncate flex-1">{getTemplateLabel(template)}</span>
                              {walkInForm.templateId === template.id && <Check size={13} className="text-emerald-700 shrink-0" />}
                            </button>
                          ))}
                        </div>
                        <div className="pt-1.5 mt-1 border-t border-slate-100 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setDocDropdownOpen(false);
                              navigate("/document-templates");
                            }}
                            className="w-full text-center text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            ⚙️ Manage & Customize Templates →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Direct "Manage Templates" Button */}
                  <button
                    type="button"
                    onClick={() => navigate("/document-templates")}
                    className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50/70 hover:bg-emerald-100/80 px-3.5 text-xs font-bold text-emerald-800 transition shadow-2xs cursor-pointer"
                    title="Open Document Template Studio"
                  >
                    <FileText size={14} className="text-emerald-700" />
                    <span>Manage Templates</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="gov-datagrid-container overflow-hidden mt-6" style={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={filteredRequests}
                columns={columns}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 10 },
                  },
                }}
                pageSizeOptions={[10, 25, 50]}
                disableRowSelectionOnClick
                loading={delayedLoading || deletingSelected}
                rowHeight={70}
                getRowId={(row) => row.id}
              />
            </div>
          </div>
        </PageWrapper>

        {selectedRequest && showDetailModal && (
          <div className="fixed inset-0 z-[999998] flex flex-col bg-white" style={{ fontFamily: "'Segoe UI', 'Inter', Arial, sans-serif" }}>
            {/* ═══ TOP HEADER BAR (dark green like the screenshot) ═══ */}
            <header className="flex items-center justify-between gap-3 bg-[#1a3c2a] px-4 py-2.5 text-white shrink-0 shadow-lg" style={{ minHeight: 48 }}>
              <div className="flex items-center gap-3 min-w-0">
                <img src="/logo.png" alt="Seal" className="h-8 w-8 object-contain drop-shadow-md shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-300/80 leading-none">Official Document Issuance System</p>
                  <h1 className="text-sm font-bold text-white truncate leading-snug mt-0.5">
                    Document Studio — {selectedTemplate ? (selectedTemplate.template_name || selectedTemplate.document_type) : "Document"}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                {/* 1. Mark Ready for Pick-up & Notify Resident */}
                {selectedRequest.status === "Released" ? (
                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-800/80 text-emerald-100 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-bold cursor-not-allowed opacity-75 shadow-xs"
                    title="Document is already released and resident was notified"
                  >
                    <CheckCircle size={14} className="stroke-[2.5]" />
                    <span className="font-bold">Notified</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      handleSaveDocument(true);
                      await handleStatusChange(selectedRequest.id, "Completed");
                    }}
                    disabled={updating || !documentIsReady}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-40 ${
                      selectedRequest.status === "Completed"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-400/50"
                        : "bg-[#10b981] hover:bg-[#059669] text-white"
                    }`}
                    title={
                      selectedRequest.status === "Completed"
                        ? "Resident notified. Click to re-notify if needed."
                        : "Mark as Ready for Pick-up and Notify Resident via SMS"
                    }
                  >
                    <CheckCircle size={14} className="stroke-[2.5]" />
                    <span className="font-bold">
                      {selectedRequest.status === "Completed" ? "Ready for Pick-up (Notified)" : "Ready for Pick-up"}
                    </span>
                  </button>
                )}

                {/* 2. Print Document & Release */}
                <button
                  type="button"
                  onClick={handlePrintDocument}
                  disabled={!documentIsReady}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0f402b] hover:bg-[#135036] text-white px-3.5 py-1.5 text-xs font-bold transition border border-emerald-500/40 shadow-sm cursor-pointer disabled:opacity-40"
                  title="Print Document & Mark as Released"
                >
                  <Printer size={14} className="text-emerald-300 stroke-[2.5]" />
                  <span className="text-white font-bold">
                    {selectedRequest.status === "Released" ? "Re-Print Document" : "Print & Release"}
                  </span>
                </button>

                <div className="w-px h-5 bg-white/20 mx-0.5" />
                <button
                  type="button"
                  onClick={() => {
                    handleSaveDocument(true);
                    setShowDetailModal(false);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  aria-label="Close"
                  title="Save & Close Document Studio"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {/* ═══ MAIN 3-COLUMN WORKSPACE ═══ */}
            <div className="flex flex-1 overflow-hidden">

              {/* ── LEFT SIDEBAR ── */}
              <aside className="w-[250px] shrink-0 border-r border-slate-200 bg-white overflow-y-auto hidden lg:flex flex-col">
                {/* Request Information */}
                <details open className="border-b border-slate-100 group">
                  <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 hover:bg-slate-50 select-none">
                    Request Information
                    <svg className="w-3 h-3 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5l3 3 3-3"/></svg>
                  </summary>
                  <div className="px-4 pb-4 space-y-2.5 text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Request ID</p>
                      <p className="font-semibold text-slate-800">BR-{selectedRequest.id?.toString().slice(-8) || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Document Type</p>
                      <p className="font-semibold text-slate-800">{selectedRequest.document_type}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Date Requested</p>
                      <p className="font-semibold text-slate-800">{formatDateTime(selectedRequest.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Status</p>
                      <span
                        className="inline-block mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                        style={getStatusBadgeStyle(selectedRequest.status)}
                      >
                        {selectedRequest.status}
                      </span>
                    </div>
                  </div>
                </details>

                {/* Resident Information */}
                <details open className="border-b border-slate-100 group">
                  <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 hover:bg-slate-50 select-none">
                    Resident Information
                    <svg className="w-3 h-3 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5l3 3 3-3"/></svg>
                  </summary>
                  <div className="px-4 pb-4 space-y-2.5 text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Resident Name</p>
                      <p className="font-bold text-slate-900">{selectedResident?.full_name || documentFields.residentName || "—"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block">Gender</label>
                        <select
                          value={documentFields.gender || "Female"}
                          onChange={(e) => updateDocumentField("gender", e.target.value)}
                          className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                        >
                          <option value="Female">Female (Ms./Mrs.)</option>
                          <option value="Male">Male (Mr.)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block">Civil Status</label>
                        <select
                          value={documentFields.civilStatus || "Single"}
                          onChange={(e) => updateDocumentField("civilStatus", e.target.value)}
                          className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                        >
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Widow">Widow / Widower</option>
                          <option value="Separated">Separated</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block">Age</label>
                        <input
                          type="text"
                          value={documentFields.age || ""}
                          onChange={(e) => updateDocumentField("age", e.target.value)}
                          placeholder="e.g. 24"
                          className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block">Birth Date (Kaarawan)</label>
                        <input
                          type="date"
                          value={
                            documentFields.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(documentFields.birthDate)
                              ? documentFields.birthDate
                              : ""
                          }
                          onChange={(e) => updateDocumentField("birthDate", e.target.value)}
                          className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    {documentFields.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(documentFields.birthDate) && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block">Birth Date (Custom Text)</label>
                        <input
                          type="text"
                          value={documentFields.birthDate}
                          onChange={(e) => updateDocumentField("birthDate", e.target.value)}
                          placeholder="e.g. February 13, 2001"
                          className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block">Purok</label>
                      <input
                        type="text"
                        value={documentFields.purok || ""}
                        onChange={(e) => updateDocumentField("purok", e.target.value)}
                        placeholder="e.g. Kamonsil / Buklod"
                        className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                      />
                    </div>



                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block">Purpose of Request</label>
                      <input
                        type="text"
                        value={documentFields.purpose || ""}
                        onChange={(e) => updateDocumentField("purpose", e.target.value)}
                        placeholder="e.g. OWWA / Local Employment"
                        className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                      />
                    </div>

                    {/* Dedicated Solo Parent Reason / Dahilan Field */}
                    {getRealDocumentTemplateKey(selectedTemplate) === "solo" && (
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        <label className="text-[10px] font-extrabold text-amber-900 block uppercase flex items-center justify-between">
                          <span>Dahilan ng Solo Parent (Reason)</span>
                          <span className="text-[9px] text-amber-700 font-normal">Editable</span>
                        </label>
                        <select
                          value={documentFields.soloParentReasonPreset || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateDocumentField("soloParentReasonPreset", val);
                            const isFemale = (documentFields.gender || "Female").toLowerCase() === "female";
                            if (val === "death") {
                              updateDocumentField("soloParentReason", isFemale ? "death of her husband" : "death of his wife");
                            } else if (val === "separation") {
                              updateDocumentField("soloParentReason", isFemale ? "separation from her husband" : "separation from his wife");
                            } else if (val === "abandonment") {
                              updateDocumentField("soloParentReason", isFemale ? "abandonment by her husband" : "abandonment by his wife");
                            } else if (val === "unwed") {
                              updateDocumentField("soloParentReason", isFemale ? "being an unmarried mother" : "being a single father");
                            } else if (val === "detention") {
                              updateDocumentField("soloParentReason", "incarceration / detention of spouse");
                            }
                          }}
                          className="w-full rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500"
                        >
                          <option value="">-- Pumili ng Karaniwang Dahilan --</option>
                          <option value="death">Kamatayan ng Asawa (Death of {documentFields.gender === "Male" ? "his wife" : "her husband"})</option>
                          <option value="separation">Hiwalay sa Asawa (Separation from {documentFields.gender === "Male" ? "his wife" : "her husband"})</option>
                          <option value="abandonment">Iniwan ng Asawa (Abandonment by spouse)</option>
                          <option value="unwed">Single Parent / Di-Kasal ({documentFields.gender === "Male" ? "single father" : "unmarried mother"})</option>
                          <option value="detention">Nakakulong ang Asawa (Incarceration of spouse)</option>
                          <option value="custom">Iba pang Dahilan (Custom)</option>
                        </select>
                        <input
                          type="text"
                          value={
                            documentFields.soloParentReason !== undefined
                              ? documentFields.soloParentReason
                              : (documentFields.gender || "Female").toLowerCase() === "male"
                              ? "death of his wife"
                              : "death of her husband"
                          }
                          onChange={(e) => {
                            updateDocumentField("soloParentReasonPreset", "custom");
                            updateDocumentField("soloParentReason", e.target.value);
                          }}
                          placeholder="Halimbawa: death of her husband / legal separation"
                          className="w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-400"
                        />
                        <p className="text-[9.5px] text-amber-800 leading-tight">
                          Lalabas sa dokumento bilang: <em>"on application for solo parent due to <strong>[dahilan]</strong> and whatever..."</em>
                        </p>
                      </div>
                    )}

                    {/* Business Permit Specific Field */}
                    {getRealDocumentTemplateKey(selectedTemplate) === "business" && (
                      <div className="pt-2 border-t border-slate-200">
                        <label className="text-[10px] font-bold text-slate-600 block">Business Name & Nature</label>
                        <input
                          type="text"
                          value={documentFields.businessName || documentFields.purpose || ""}
                          onChange={(e) => {
                            updateDocumentField("businessName", e.target.value);
                            updateDocumentField("purpose", e.target.value);
                          }}
                          placeholder="e.g. BANANA BUY AND SALE / SARI-SARI STORE"
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}



                    {/* Dedicated Residency Specific Controls */}
                    {getRealDocumentTemplateKey(selectedTemplate) === "residency" && (
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        <label className="text-[10px] font-extrabold text-blue-950 block uppercase flex items-center justify-between">
                          <span>Residency Rekomendasyon (Peace & Order)</span>
                          <span className="text-[9px] text-blue-700 font-normal">Editable</span>
                        </label>
                        <select
                          value={documentFields.residencyRecommendation || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateDocumentField("residencyRecommendation", val);
                            updateDocumentField("purpose", val);
                          }}
                          className="w-full rounded border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                        >
                          <option value="">-- Pumili ng Rekomendasyon / Preset --</option>
                          <option value="for a CAFGU">for a CAFGU</option>
                          <option value="for Local Employment">for Local Employment / Job Application</option>
                          <option value="for Scholarship">for Scholarship / School Requirement</option>
                          <option value="for Bank Account Opening">for Bank Account Opening / Loan</option>
                          <option value="for Barangay ID">for Barangay ID Application</option>
                          <option value="for Police Clearance">for Police Clearance / NBI</option>
                          <option value="for Postal ID">for Postal ID Application</option>
                          <option value="for whatever legal purpose it may serve best">for whatever legal purpose it may serve best</option>
                          <option value="">[Blank Underline Line]</option>
                        </select>
                        <input
                          type="text"
                          value={documentFields.residencyRecommendation || documentFields.purpose || ""}
                          onChange={(e) => {
                            updateDocumentField("residencyRecommendation", e.target.value);
                            updateDocumentField("purpose", e.target.value);
                          }}
                          placeholder="Halimbawa: for a CAFGU / for Local Employment"
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500"
                        />
                        <p className="text-[9.5px] text-blue-800 leading-tight">
                          Lalabas sa sertipiko: <em>"From our barangay peace and order committee we are recommending him/her <strong>{documentFields.residencyRecommendation || "___________"}</strong>.."</em>
                        </p>
                      </div>
                    )}

                    {/* Dedicated Barangay Clearance Specific Controls */}
                    {getRealDocumentTemplateKey(selectedTemplate) === "clearance" && (
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-700 block uppercase flex items-center justify-between">
                          <span>Clearance Purpose Preset</span>
                        </label>
                        <select
                          value={documentFields.purpose || "OWWA"}
                          onChange={(e) => updateDocumentField("purpose", e.target.value)}
                          className="w-full rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                        >
                          <option value="OWWA">OWWA / Overseas Worker</option>
                          <option value="LOCAL EMPLOYMENT">Local Employment</option>
                          <option value="POSTAL ID">Postal ID Application</option>
                          <option value="NBI CLEARANCE">NBI Clearance Application</option>
                          <option value="POLICE CLEARANCE">Police Clearance Application</option>
                          <option value="BANK REQUIREMENT">Bank Account / Loan Requirement</option>
                          <option value="SCHOOL REQUIREMENT">School / Scholarship Requirement</option>
                          <option value="LEGAL PURPOSE">Whatever legal purpose it may serve best</option>
                        </select>
                      </div>
                    )}

                    {/* Dedicated Indigency Specific Controls */}
                    {getRealDocumentTemplateKey(selectedTemplate) === "indigency" && (
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-700 block uppercase flex items-center justify-between">
                          <span>Indigency Assistance Purpose</span>
                        </label>
                        <select
                          value={documentFields.purpose || ""}
                          onChange={(e) => updateDocumentField("purpose", e.target.value)}
                          className="w-full rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                        >
                          <option value="">person and (General / Blank)</option>
                          <option value="MEDICAL ASSISTANCE">Medical Assistance</option>
                          <option value="HOSPITALIZATION">Hospitalization Requirement</option>
                          <option value="FINANCIAL ASSISTANCE">Financial Assistance</option>
                          <option value="BURIAL ASSISTANCE">Burial Assistance</option>
                          <option value="EDUCATIONAL ASSISTANCE">Educational Assistance / Scholarship</option>
                          <option value="LEGAL ASSISTANCE">Public Attorney / Legal Assistance</option>
                        </select>
                      </div>
                    )}

                  </div>
                </details>

                {/* ─── Signatory & Official on Duty ─── */}
                <details open className="border-b border-slate-100 group">
                  <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50 select-none">
                    <span className="flex items-center gap-1.5">
                      <UserCheck size={13} className="text-emerald-600" />
                      Signatory & Duty Officer
                    </span>
                    <svg className="w-3 h-3 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5l3 3 3-3"/></svg>
                  </summary>
                  <div className="px-4 pb-4 pt-1 space-y-2.5 text-xs bg-emerald-50/20">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block uppercase">
                        Signatory Authority
                      </label>
                      <select
                        value={documentFields.signatoryKey || "captain"}
                        onChange={(e) => {
                          const key = e.target.value;
                          if (key === "captain") {
                            updateDocumentField("signatoryKey", "captain");
                            updateDocumentField("approvingOfficer", captainOfficial?.name || PUNONG_BARANGAY);
                            updateDocumentField("actingOfficer", "");
                            updateDocumentField("actingPosition", "");
                          } else if (key.startsWith("kagawad_")) {
                            const idx = parseInt(key.replace("kagawad_", ""), 10);
                            const kag = kagawadOfficials[idx];
                            const cleanName = kag?.name ? kag.name.replace(/^HON\.\s*/i, "") : `Kagawad ${idx + 1}`;
                            updateDocumentField("signatoryKey", key);
                            updateDocumentField("approvingOfficer", captainOfficial?.name || PUNONG_BARANGAY);
                            updateDocumentField("actingOfficer", `HON. ${cleanName}`);
                            updateDocumentField("actingPosition", "Barangay Kagawad / Officer of the Day");
                          } else if (key === "secretary") {
                            updateDocumentField("signatoryKey", "secretary");
                            updateDocumentField("approvingOfficer", captainOfficial?.name || PUNONG_BARANGAY);
                            updateDocumentField("actingOfficer", secretaryOfficial?.name || "Barangay Secretary");
                            updateDocumentField("actingPosition", "Barangay Secretary / Acting Officer");
                          } else {
                            updateDocumentField("signatoryKey", "custom");
                          }
                        }}
                        className="mt-1 w-full rounded border border-emerald-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                      >
                        <option value="captain">
                          Captain: {captainOfficial?.name || PUNONG_BARANGAY} (Regular)
                        </option>
                        <optgroup label="Barangay Kagawads on Duty (Officer of the Day)">
                          {kagawadOfficials.map((kag, idx) => (
                            <option key={kag.id || idx} value={`kagawad_${idx}`}>
                              {kag.position || `Kagawad ${idx + 1}`}: {kag.name}
                            </option>
                          ))}
                        </optgroup>
                        {secretaryOfficial && (
                          <option value="secretary">
                            Secretary: {secretaryOfficial.name}
                          </option>
                        )}
                        <option value="custom">Custom / Other Signatory</option>
                      </select>
                    </div>

                    {documentFields.signatoryKey === "custom" && (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Punong Barangay Name</label>
                          <input
                            type="text"
                            value={documentFields.approvingOfficer || ""}
                            onChange={(e) => updateDocumentField("approvingOfficer", e.target.value)}
                            placeholder="HON. MAMERTO C. CLARITO"
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Acting Signatory (By: Name)</label>
                          <input
                            type="text"
                            value={documentFields.actingOfficer || ""}
                            onChange={(e) => updateDocumentField("actingOfficer", e.target.value)}
                            placeholder="HON. LORETO C. CALAMBA"
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Acting Title / Position</label>
                          <input
                            type="text"
                            value={documentFields.actingPosition || ""}
                            onChange={(e) => updateDocumentField("actingPosition", e.target.value)}
                            placeholder="Barangay Kagawad / Officer of the Day"
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    )}

                    {documentFields.actingOfficer ? (
                      <div className="rounded-lg bg-amber-50/90 border border-amber-300/60 p-2 text-[11px] text-amber-900 leading-snug">
                        <span className="font-extrabold text-amber-800">Signing on Duty:</span>
                        <div className="mt-0.5 font-bold">By: {documentFields.actingOfficer}</div>
                        <div className="text-[10px] text-amber-700">{documentFields.actingPosition || "Officer of the Day"}</div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-emerald-50/90 border border-emerald-300/60 p-2 text-[11px] text-emerald-900 leading-snug">
                        <span className="font-extrabold text-emerald-800">Regular Signatory:</span>
                        <div className="mt-0.5 font-bold">{documentFields.approvingOfficer}</div>
                        <div className="text-[10px] text-emerald-700">Punong Barangay</div>
                      </div>
                    )}
                  </div>
                </details>

                {/* Document Settings */}
                <details className="border-b border-slate-100 group">
                  <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 hover:bg-slate-50 select-none">
                    Document Settings
                    <svg className="w-3 h-3 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5l3 3 3-3"/></svg>
                  </summary>
                  <div className="px-4 pb-4 space-y-2.5 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block">Line Spacing</label>
                      <select
                        value={documentFields.printLineHeight || "1.45"}
                        onChange={(e) => updateDocumentField("printLineHeight", e.target.value)}
                        className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
                      >
                        <option value="1.2">1.2 (Tight)</option>
                        <option value="1.35">1.35 (Compact)</option>
                        <option value="1.45">1.45 (Normal)</option>
                        <option value="1.6">1.6 (1.5x)</option>
                        <option value="1.8">1.8 (Double)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block">Margins</label>
                      <select
                        value={documentFields.printMargin || "normal"}
                        onChange={(e) => updateDocumentField("printMargin", e.target.value)}
                        className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
                      >
                        <option value="normal">Normal (0.85")</option>
                        <option value="narrow">Narrow (0.50")</option>
                        <option value="wide">Wide (1.20")</option>
                      </select>
                    </div>
                  </div>
                </details>

                {/* Issuance Fields */}
                <details className="border-b border-slate-100 group">
                  <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 hover:bg-slate-50 select-none">
                    Issuance Fields
                    <svg className="w-3 h-3 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5l3 3 3-3"/></svg>
                  </summary>
                  <div className="px-4 pb-4 space-y-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block">O.R. Number</label>
                      <input type="text" value={documentFields.orNumber || ""} onChange={(e) => updateDocumentField("orNumber", e.target.value)} placeholder="e.g. 1234567" className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block">Date Issued</label>
                      <input type="date" value={documentFields.dateIssued || ""} onChange={(e) => updateDocumentField("dateIssued", e.target.value)} className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block">C.T.C. Number</label>
                      <input type="text" value={documentFields.ctcNumber || ""} onChange={(e) => updateDocumentField("ctcNumber", e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block">C.T.C. Date</label>
                      <input type="date" value={documentFields.ctcDateIssued || ""} onChange={(e) => updateDocumentField("ctcDateIssued", e.target.value)} className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white" />
                    </div>
                  </div>
                </details>
              </aside>

              {/* ── CENTER: PAPER CANVAS (Read-only Generated Document Preview) ── */}
              <main
                className="flex-1 overflow-auto bg-[#e8ecf0] relative"
              >
                {!documentIsReady && (
                  <div className="mx-auto mt-3 max-w-xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 flex items-center gap-2 shadow-sm">
                    <AlertCircle size={14} className="text-amber-600 shrink-0" />
                    Missing required fields: {missingRequiredFields.join(", ")}
                  </div>
                )}

                <div className="flex justify-center py-6 px-4">
                  <div
                    style={{
                      transform: `scale(${documentZoom / 100})`,
                      transformOrigin: "top center",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    <div
                      ref={previewEditorRef}
                      className="bg-white shadow-xl select-none"
                      style={{ borderRadius: 1 }}
                      dangerouslySetInnerHTML={{
                        __html: getRealDocumentMarkup({
                          fields: documentFields,
                          template: selectedTemplate,
                          editable: false,
                        }),
                      }}
                    />
                  </div>
                </div>
              </main>
            </div>

            {/* ═══ BOTTOM STATUS BAR ═══ */}
            <footer className="flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600 shrink-0 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]" style={{ minHeight: 36 }}>
              <div className="flex items-center gap-3 font-medium">
                <span>Page 1 of 1</span>
                <span className="text-slate-300">•</span>
                <span>{selectedTemplate?.template_name || selectedRequest.document_type}</span>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setDocumentZoom((z) => Math.max(40, z - 5))} className="p-1 rounded hover:bg-slate-100 text-slate-500 transition" title="Zoom Out"><ZoomOut size={13} /></button>
                <span className="w-9 text-center font-bold text-slate-800 text-[11px]">{documentZoom}%</span>
                <button type="button" onClick={() => setDocumentZoom((z) => Math.min(130, z + 5))} className="p-1 rounded hover:bg-slate-100 text-slate-500 transition" title="Zoom In"><ZoomIn size={13} /></button>
                <div className="w-px h-4 bg-slate-200 mx-1" />
                <button type="button" onClick={() => setDocumentZoom(65)} className={`rounded px-2 py-0.5 text-[11px] font-bold transition ${documentZoom === 65 ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Fit Page</button>
                <button type="button" onClick={() => setDocumentZoom(85)} className={`rounded px-2 py-0.5 text-[11px] font-bold transition ${documentZoom === 85 ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Fit Width</button>
              </div>
            </footer>
          </div>
        )}
    </>
  );
};

export default DocumentManagement;
