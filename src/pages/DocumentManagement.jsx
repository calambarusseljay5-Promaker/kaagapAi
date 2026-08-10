import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createDocumentRequest,
  fetchDocumentRequests,
  fetchDocumentTemplates,
  updateDocumentRequestStatus,
  deleteDocumentRequest,
  getPreparedDocument,
  savePreparedDocument,
  uploadDocumentTemplateFile,
} from "../services/documentRequestService";
import { getCurrentUserWithProfile } from "../services/authService";
import { fetchResidents } from "../services/adminService";
import { sendSmsNotification } from "../services/smsService";
import {
  DEFAULT_PREPARED_BY,
  PUNONG_BARANGAY,
  getEditableDocumentText,
  getRealDocumentMarkup,
  getRealDocumentPrintMarkup,
  getTemplateFilePath,
} from "../utils/realDocumentTemplates";
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
  ClipboardList,
  Download,
  Eye,
  FileText,
  Filter,
  Italic,
  Loader,
  Maximize2,
  Printer,
  RefreshCw,
  Save,
  Search,
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
  const match = docType.match(/\(Purpose:\s*(.*?)\)/i) || docType.match(/-\s*Purpose:\s*(.*)/i);
  return match ? match[1].trim() : "";
};

const stripPurpose = (docType) => {
  if (!docType) return "";
  return docType.split(" (Purpose:")[0].split(" - Purpose:")[0].trim();
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

const buildResidentFields = (resident, request, template, savedFields = {}) => ({
  documentTitle: getTemplateLabel(template) || stripPurpose(request?.document_type) || "Barangay Document",
  residentName: resident?.full_name || "",
  age: resident?.age ?? "",
  gender: resident?.gender || "",
  civilStatus: resident?.civil_status || resident?.civilStatus || "",
  birthDate: resident?.birth_date || resident?.birthdate || "",
  houseNo: resident?.house_no || "",
  purok: resident?.purok || "",
  address: resident?.address || "",
  email: resident?.email || "",
  pwdStatus: resident?.is_pwd ? "Yes" : "No",
  pwdType: resident?.pwd_type || "",
  orNumber: savedFields.orNumber || "",
  dateIssued: savedFields.dateIssued || "",
  ctcNumber: savedFields.ctcNumber || "",
  ctcDateIssued: savedFields.ctcDateIssued || "",
  purpose: savedFields.purpose || parsePurpose(request?.document_type) || "",
  issueDate: savedFields.issueDate || todayInputValue(),
  preparedBy: savedFields.preparedBy || DEFAULT_PREPARED_BY,
  approvingOfficer: savedFields.approvingOfficer || PUNONG_BARANGAY,
  remarks: savedFields.remarks || "",
  documentText: savedFields.documentText || "",
  printFontFamily: savedFields.printFontFamily || "times",
  printFontSize: savedFields.printFontSize || "13",
  printLineHeight: savedFields.printLineHeight || "1.45",
  printParagraphGap: savedFields.printParagraphGap || "0.12",
  printMargin: savedFields.printMargin || "normal",
  ...savedFields,
});

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
  const [loading, setLoading] = useState(true);
  const delayedLoading = loading;

  const [message, setMessage] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
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
  });
  const [walkInResidentSearchOpen, setWalkInResidentSearchOpen] = useState(false);
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

  const loadData = async ({ showLoading = false } = {}) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const userData = await getCurrentUserWithProfile();
      if (!userData || userData.profile?.role !== "admin") {
        navigate("/");
        return;
      }

      const [requestResult, templateResult, residentResult] = await Promise.allSettled([
        fetchDocumentRequests({ status: statusFilter, limit: 300 }),
        fetchDocumentTemplates(),
        fetchResidents(""),
      ]);

      if (requestResult.status === "fulfilled") {
        setRequests(requestResult.value.data || []);
      } else {
        setRequests([]);
        setMessage({
          type: "error",
          text: requestResult.reason?.message || "Failed to load document requests.",
        });
      }

      if (templateResult.status === "fulfilled") {
        setTemplates(templateResult.value);
      } else {
        setTemplates([]);
        setMessage({
          type: "error",
          text: templateResult.reason?.message || "Failed to load document templates.",
        });
      }

      if (residentResult.status === "fulfilled") {
        setResidents(residentResult.value);
      } else {
        setResidents([]);
        setMessage({
          type: "error",
          text: residentResult.reason?.message || "Failed to load resident records.",
        });
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setMessage({ type: "error", text: err.message || "Failed to load document requests." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const userData = await getCurrentUserWithProfile();
        if (!userData || userData.profile?.role !== "admin") {
          navigate("/");
          return;
        }

        const [requestResult, templateResult, residentResult] = await Promise.allSettled([
          fetchDocumentRequests({ status: statusFilter, limit: 300 }),
          fetchDocumentTemplates(),
          fetchResidents(""),
        ]);

        if (!isMounted) return;

        if (requestResult.status === "fulfilled") {
          setRequests(requestResult.value.data || []);
        } else {
          setRequests([]);
          setMessage({
            type: "error",
            text: requestResult.reason?.message || "Failed to load document requests.",
          });
        }

        if (templateResult.status === "fulfilled") {
          setTemplates(templateResult.value);
        } else {
          setTemplates([]);
          setMessage({
            type: "error",
            text: templateResult.reason?.message || "Failed to load document templates.",
          });
        }

        if (residentResult.status === "fulfilled") {
          setResidents(residentResult.value);
        } else {
          setResidents([]);
          setMessage({
            type: "error",
            text: residentResult.reason?.message || "Failed to load resident records.",
          });
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error loading data:", err);
          setMessage({ type: "error", text: err.message || "Failed to load document requests." });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [navigate, searchTerm, statusFilter]);

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
    setDocumentFields(buildResidentFields(resident, request, template, savedFields));
    setAiReview(null);
    setShowDetailModal(true);
  };

  const updateWalkInForm = (field, value) => {
    setWalkInForm((current) => ({
      ...current,
      ...(field === "residentSearch" && current.residentId ? { residentId: "" } : {}),
      [field]: value,
    }));

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
    }));
    setWalkInResidentSearchOpen(false);
  };

  const handleWalkInResidentSearchKeyDown = (event) => {
    if (event.key !== "Enter" || walkInForm.residentId || walkInResidentOptions.length === 0) return;

    event.preventDefault();
    handleWalkInResidentChange(walkInResidentOptions[0].id);
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
      const createdRequest = await createDocumentRequest({
        resident_id: resolvedWalkInResident.id,
        document_type: getTemplateLabel(selectedWalkInTemplate),
        status: "Processing",
      });
      const requestWithResident = {
        ...createdRequest,
        residents: getNestedResident(createdRequest.residents) || resolvedWalkInResident,
      };
      const fields = buildResidentFields(
        resolvedWalkInResident,
        requestWithResident,
        selectedWalkInTemplate,
        { purpose: walkInForm.purpose }
      );
      const review = {
        source: "Walk-in autofill",
        confidence: "Ready for review",
        summary:
          "Resident information and document template were autofilled from barangay records. Review the preview before printing.",
        checklist: [
          `Template selected: ${getTemplateLabel(selectedWalkInTemplate)}`,
          `Resident selected: ${getResidentLabel(resolvedWalkInResident)}`,
          walkInForm.purpose ? "Purpose is filled." : "Purpose can be edited before printing.",
          "Document preview is ready for admin review.",
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
      setShowDetailModal(true);
      setWalkInForm({
        templateId: "",
        residentId: "",
        residentSearch: "",
        purpose: "",
      });
      setMessage({
        type: "success",
        text: "Walk-in request created. Review the autofilled document, then print when ready.",
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



  const handleStatusChange = async (id, newStatus) => {
    let confirmTitle = `Mark Request as ${newStatus}`;
    let confirmMessage = `Are you sure you want to update this document request status to ${newStatus}?`;
    let variant = "emerald";

    if (newStatus === "Approved" || newStatus === "Completed" || newStatus === "Released") {
      confirmTitle = "Approve Document Request";
      confirmMessage = "Are you sure you want to approve this document request?";
      variant = "emerald";
    } else if (newStatus === "Rejected") {
      confirmTitle = "Reject Document Request";
      confirmMessage = "Are you sure you want to reject this document request?";
      variant = "danger";
    }

    const ok = await confirm({
      title: confirmTitle,
      message: confirmMessage,
      confirmText: newStatus === "Rejected" ? "Reject" : "Approve",
      cancelText: "Cancel",
      variant: variant,
      icon: newStatus === "Rejected" ? Trash2 : CheckCircle,
    });
    if (!ok) return;

    setUpdating(true);

    try {
      const updatedRequest = await updateDocumentRequestStatus(id, newStatus);

      // Notify resident via SMS if they have a phone number and status is Completed
      const targetRequest = requests.find((r) => r.id === id) || selectedRequest;
      const resident = targetRequest ? getNestedResident(targetRequest.residents) : null;

      if (newStatus === "Completed" && resident?.phone) {
        try {
          const smsBody = `KaagapAI: Hello ${resident.first_name || resident.full_name}, your ${targetRequest.document_type || "document"} request is completed and ready for pickup at the barangay office.`;
          await sendSmsNotification({ to: resident.phone, body: smsBody });
        } catch (smsError) {
          console.warn("Failed to send SMS notification:", smsError);
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
            ? "Request marked as Completed. The resident portal was notified and SMS was sent."
            : `Request marked as ${newStatus}.`,
      });

      if (selectedRequest?.id === id) {
        setSelectedRequest((current) => ({
          ...current,
          ...updatedRequest,
          status: newStatus,
        }));
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to update status." });
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

  const handleSaveDocument = () => {
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

      setMessage({
        type: "success",
        text: "Prepared document saved.",
      });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to save document." });
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
      setShowDetailModal(false);

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
        } catch (statusError) {
          console.warn("Failed to automatically update status to Released on print:", statusError);
        }
      })();

      setMessage({
        type: "success",
        text: "Print preview opened. Request has been marked as Released.",
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



  const columns = [
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
      flex: 1,
      renderCell: (params) => {
        const request = params.row;
        const displayStatus = isRequestExpired(request) ? "Expired" : request.status;
        return (
          <span className="inline-flex rounded-full px-3 py-1 text-xs font-bold" style={getStatusBadgeStyle(displayStatus)}>
            {displayStatus}
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
  ];

  return (
    <>
      <PageWrapper title="Document Management" description="Review requests, generate certificates, and print documents">
          {message && (
            <div
              className={`mb-6 flex items-start gap-3 rounded-lg p-4 ${message.type === "success"
                ? "border border-emerald-200 bg-emerald-50"
                : "border border-rose-200 bg-rose-50"
                }`}
            >
              {message.type === "success" ? (
                <CheckCircle className="shrink-0 text-emerald-600" size={20} />
              ) : (
                <AlertCircle className="shrink-0 text-rose-600" size={20} />
              )}
              <span className={message.type === "success" ? "text-emerald-700" : "text-rose-700"}>
                {message.text}
              </span>
            </div>
          )}

          <div className="glass-container">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 p-6 border-b border-slate-200/50">
              <div className="relative overflow-hidden group">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 shadow-sm transition-transform group-hover:scale-110">
                    <ClipboardList size={28} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Total Requests</p>
                    <div className="flex items-end gap-2 mt-1">
                      {delayedLoading ? (
                        <div className="h-7 w-16 animate-pulse rounded bg-slate-200 mt-1" />
                      ) : (
                        <>
                          <p className="text-3xl font-black text-slate-900 leading-none">{stats.total}</p>
                          <span className="text-xs font-semibold text-emerald-500">↑ 12%</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden group">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 shadow-sm transition-transform group-hover:scale-110">
                    <FileText size={28} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Pending</p>
                    <div className="flex items-end gap-2 mt-1">
                      {delayedLoading ? (
                        <div className="h-7 w-16 animate-pulse rounded bg-slate-200 mt-1" />
                      ) : (
                        <>
                          <p className="text-3xl font-black text-amber-600 leading-none">{stats.pending}</p>
                          <span className="text-xs font-semibold text-amber-500">Active</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden group">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-blue-900 shadow-md transition-transform group-hover:scale-110">
                    <RefreshCw size={28} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Processing</p>
                    <div className="flex items-end gap-2 mt-1">
                      {delayedLoading ? (
                        <div className="h-7 w-16 animate-pulse rounded bg-slate-200 mt-1" />
                      ) : (
                        <p className="text-3xl font-black text-blue-700 leading-none">{stats.processing}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden group">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 shadow-sm transition-transform group-hover:scale-110">
                    <CheckCircle size={28} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">Completed</p>
                    <div className="flex items-end gap-2 mt-1">
                      {delayedLoading ? (
                        <div className="h-7 w-16 animate-pulse rounded bg-slate-200 mt-1" />
                      ) : (
                        <>
                          <p className="text-3xl font-black text-emerald-600 leading-none">{stats.completed}</p>
                          <span className="text-xs font-semibold text-emerald-500">↑ 5%</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleWalkInSubmit}
              className="p-6 border-b border-slate-200/50 bg-white/20"
            >


              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
                <label className="text-sm font-semibold text-slate-700">
                  Document
                  <select
                    value={walkInForm.templateId}
                    onChange={(event) => updateWalkInForm("templateId", event.target.value)}
                    className="mt-2 h-[46px] w-full rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
                  >
                    <option value="">Select document</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {getTemplateLabel(template)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="relative text-sm font-semibold text-slate-700">
                  Search resident
                  <input
                    value={walkInForm.residentSearch}
                    onChange={(event) => updateWalkInForm("residentSearch", event.target.value)}
                    onFocus={() => setWalkInResidentSearchOpen(true)}
                    onBlur={() => window.setTimeout(() => setWalkInResidentSearchOpen(false), 120)}
                    onKeyDown={handleWalkInResidentSearchKeyDown}
                    placeholder="Type resident name"
                    role="combobox"
                    aria-expanded={walkInResidentSearchOpen}
                    aria-controls="walk-in-resident-results"
                    aria-autocomplete="list"
                    className="mt-2 h-[46px] w-full rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
                  />
                  {walkInResidentSearchOpen && walkInForm.residentSearch.trim() ? (
                    <div
                      id="walk-in-resident-results"
                      className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-[12px] border border-slate-200 bg-white p-2 shadow-xl"
                      role="listbox"
                    >
                      {walkInResidentOptions.length > 0 ? (
                        walkInResidentOptions.slice(0, 6).map((resident) => (
                          <button
                            key={resident.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleWalkInResidentChange(resident.id)}
                            className="flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 focus:bg-slate-100 focus:outline-none"
                            role="option"
                            aria-selected={walkInForm.residentId === resident.id}
                          >
                            <span className="text-sm font-bold text-slate-900">
                              {getResidentLabel(resident)}
                            </span>
                            <span className="mt-0.5 text-xs font-medium text-slate-500">
                              {getResidentMeta(resident)}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-sm font-medium text-slate-500 text-center">
                          No resident found.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <label className="text-sm font-semibold text-slate-700">
                  Resident list
                  <select
                    value={walkInForm.residentId || resolvedWalkInResident?.id || ""}
                    onChange={(event) => handleWalkInResidentChange(event.target.value)}
                    className="mt-2 h-[46px] w-full rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
                  >
                    <option value="">Select resident</option>
                    {walkInResidentOptions.map((resident) => (
                      <option key={resident.id} value={resident.id}>
                        {resident.full_name} - {resident.purok || "No purok"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Purpose
                  <input
                    value={walkInForm.purpose}
                    onChange={(event) => updateWalkInForm("purpose", event.target.value)}
                    placeholder="Optional"
                    className="mt-2 h-[46px] w-full rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
                  />
                </label>

                <button
                  type="submit"
                  disabled={creatingWalkIn || !walkInForm.templateId || !resolvedWalkInResident}
                  className="inline-flex h-[46px] min-w-[140px] items-center justify-center gap-2 rounded-[12px] bg-[#14532D] px-6 text-sm font-bold text-white transition hover:bg-[#0f3e21] hover:shadow-md disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none shadow-sm active:scale-95"
                >
                  {creatingWalkIn ? <Loader size={18} className="animate-spin" /> : <UserCheck size={18} />}
                  {creatingWalkIn ? "Generating..." : "Generate"}
                </button>
              </div>
            </form>

            <div className="p-6 border-b border-slate-200/50 bg-slate-50/20">
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-full sm:max-w-xs">
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    <Search size={14} className="mr-1.5 inline text-emerald-500" />
                    Search
                  </label>
                  <input
                    type="text"
                    placeholder="Search by resident or document type..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full h-[38px] rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm"
                  />
                </div>

                <div className="w-full sm:max-w-[180px]">
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    <Filter size={14} className="mr-1.5 inline text-emerald-500" />
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="w-full h-[38px] rounded-[10px] border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 shadow-sm"
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
                  className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-[10px] bg-slate-50 border border-slate-200 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 shadow-sm active:scale-95"
                >
                  <RefreshCw size={13} />
                  Refresh
                </button>
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
                loading={delayedLoading}
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
                <img src="/logo.png" alt="Seal" className="h-8 w-8 object-contain rounded-md bg-white/10 p-0.5" />
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-300/80 leading-none">Official Document Issuance System</p>
                  <h1 className="text-sm font-bold text-white truncate leading-snug mt-0.5">
                    Document Studio — {selectedTemplate ? (selectedTemplate.template_name || selectedTemplate.document_type) : "Document"}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePrintDocument}
                  disabled={!documentIsReady}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0f402b] hover:bg-[#135036] text-white px-3.5 py-1.5 text-xs font-bold transition border border-emerald-500/40 shadow-sm cursor-pointer disabled:opacity-40"
                  title="Print Document"
                >
                  <Printer size={14} className="text-emerald-300 stroke-[2.5]" />
                  <span className="text-white font-bold">Print Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedRequest.id, "Completed")}
                  disabled={updating || selectedRequest.status === "Completed" || !documentIsReady}
                  className="flex items-center gap-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-40"
                  title="Complete and Release Request"
                >
                  <Check size={14} className="text-white stroke-[2.5]" />
                  <span className="text-white font-bold">Complete & Release</span>
                </button>
                <div className="w-px h-5 bg-white/20 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  aria-label="Close"
                  title="Close Document Studio"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {/* ═══ FORMATTING TOOLBAR RIBBON ═══ */}
            <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-4 py-1.5 shrink-0 overflow-x-auto select-none" style={{ minHeight: 42 }}>
              {/* Font Family */}
              <select
                value={documentFields.printFontFamily || "times"}
                onChange={(e) => updateDocumentField("printFontFamily", e.target.value)}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none hover:border-slate-400 focus:border-emerald-500 cursor-pointer"
                title="Font Family"
                style={{ minWidth: 130 }}
              >
                <option value="times">Times New Roman</option>
                <option value="rockwell">Rockwell Condensed</option>
                <option value="arial">Arial</option>
                <option value="arial-narrow">Arial Narrow</option>
                <option value="georgia">Georgia</option>
                <option value="calibri">Calibri</option>
              </select>

              {/* Font Size */}
              <select
                value={documentFields.printFontSize || "13"}
                onChange={(e) => updateDocumentField("printFontSize", e.target.value)}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none hover:border-slate-400 focus:border-emerald-500 cursor-pointer w-14"
                title="Font Size"
              >
                <option value="10">10 pt</option>
                <option value="11">11 pt</option>
                <option value="12">12 pt</option>
                <option value="13">13 pt</option>
                <option value="14">14 pt</option>
                <option value="15">15 pt</option>
                <option value="16">16 pt</option>
                <option value="18">18 pt</option>
              </select>

              {/* Line Spacing */}
              <select
                value={documentFields.printLineHeight || "1.45"}
                onChange={(e) => updateDocumentField("printLineHeight", e.target.value)}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none hover:border-slate-400 focus:border-emerald-500 cursor-pointer"
                title="Line Spacing / Height"
              >
                <option value="1.2">1.2x Line</option>
                <option value="1.35">1.35x Line</option>
                <option value="1.45">1.45x Normal</option>
                <option value="1.6">1.60x Line</option>
                <option value="1.8">1.80x Double</option>
              </select>

              <div className="w-px h-5 bg-slate-300 mx-1 shrink-0" />

              {/* Select All */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSelectAllDocumentText}
                className="flex items-center gap-1 rounded bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-emerald-600 hover:text-white transition active:scale-95 shadow-sm"
                title="Select All Template Text (Ctrl+A)"
              >
                <Type size={13} /> Select All
              </button>

              <div className="w-px h-5 bg-slate-300 mx-1 shrink-0" />

              {/* Bold */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormatText("bold")}
                className="flex h-7 w-7 items-center justify-center rounded text-slate-800 hover:bg-slate-200 transition active:scale-90"
                title="Bold (Ctrl+B)"
              >
                <Bold size={15} className="stroke-[2.5]" />
              </button>
              {/* Italic */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormatText("italic")}
                className="flex h-7 w-7 items-center justify-center rounded text-slate-800 hover:bg-slate-200 transition active:scale-90"
                title="Italic (Ctrl+I)"
              >
                <Italic size={15} className="stroke-[2.5]" />
              </button>
              {/* Underline */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormatText("underline")}
                className="flex h-7 w-7 items-center justify-center rounded text-slate-800 hover:bg-slate-200 transition active:scale-90"
                title="Underline (Ctrl+U)"
              >
                <Underline size={15} className="stroke-[2.5]" />
              </button>

              <div className="w-px h-5 bg-slate-300 mx-1 shrink-0" />

              {/* Align Left */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormatText("justifyLeft")}
                className="flex h-7 w-7 items-center justify-center rounded text-slate-800 hover:bg-slate-200 transition active:scale-90"
                title="Align Left"
              >
                <AlignLeft size={15} className="stroke-[2.5]" />
              </button>
              {/* Align Center */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormatText("justifyCenter")}
                className="flex h-7 w-7 items-center justify-center rounded text-slate-800 hover:bg-slate-200 transition active:scale-90"
                title="Center"
              >
                <AlignCenter size={15} className="stroke-[2.5]" />
              </button>
              {/* Align Right */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormatText("justifyRight")}
                className="flex h-7 w-7 items-center justify-center rounded text-slate-800 hover:bg-slate-200 transition active:scale-90"
                title="Align Right"
              >
                <AlignRight size={15} className="stroke-[2.5]" />
              </button>
              {/* Justify */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormatText("justifyFull")}
                className="flex h-7 w-7 items-center justify-center rounded text-slate-800 hover:bg-slate-200 transition active:scale-90"
                title="Justify"
              >
                <AlignJustify size={15} className="stroke-[2.5]" />
              </button>

              <div className="w-px h-5 bg-slate-300 mx-1 shrink-0" />

              {/* Reset */}
              <button
                type="button"
                onClick={resetPrintableText}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
                title="Reset document body text"
              >
                <RefreshCw size={12} /> Reset
              </button>
            </div>

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
                      <p className="font-bold text-slate-900">{selectedResident?.full_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Age</p>
                      <p className="font-semibold text-slate-800">{documentFields.age || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Civil Status</p>
                      <p className="font-semibold text-slate-800">{documentFields.civilStatus || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Address</p>
                      <p className="font-semibold text-slate-800 leading-snug">{documentFields.address || documentFields.purok || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">Purpose</p>
                      <p className="font-semibold text-slate-800">{documentFields.purpose || "—"}</p>
                    </div>
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

              {/* ── CENTER: PAPER CANVAS ── */}
              <main
                className="flex-1 overflow-auto bg-[#e8ecf0] relative"
                style={{ cursor: "text" }}
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
                      onBlur={handlePreviewEditorBlur}
                      onPaste={handlePreviewEditorPaste}
                      onKeyDown={handlePreviewEditorKeyDown}
                      className="bg-white shadow-xl"
                      style={{ borderRadius: 1 }}
                      dangerouslySetInnerHTML={{
                        __html: getRealDocumentMarkup({
                          fields: documentFields,
                          template: selectedTemplate,
                          editable: true,
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
