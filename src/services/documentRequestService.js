import { supabase } from "../lib/supabaseClient";
import { getSystemSettings } from "./adminActivityService";
import { mergeRealDocumentTemplates } from "../utils/realDocumentTemplates";
import { moveToRecycleBin } from "./recycleBinService";

const DOCUMENT_REQUESTS_TABLE = "document_requests";
const RESIDENTS_TABLE = "residents";
const DOCUMENT_TEMPLATES_TABLE = "document_templates";
const RESIDENT_NOTIFICATIONS_TABLE = "resident_notifications";
const DOCUMENT_REQUEST_COLUMNS = "id,resident_id,document_type,status,created_at,updated_at";
const DOCUMENT_REQUEST_WITH_RESIDENT_COLUMNS = `${DOCUMENT_REQUEST_COLUMNS},${RESIDENTS_TABLE}(id,full_name,email,house_no,age,gender,is_pwd,pwd_type,purok,address,status,created_at,updated_at)`;
const PREPARED_DOCUMENTS_KEY = "kaagapai_prepared_documents";
const DOCUMENT_TEMPLATE_BUCKET = "document-templates";
const DOCUMENT_TEMPLATE_FILE_TYPES = new Set(["doc", "docx", "dot", "dotx", "pdf"]);
const DOCUMENT_TEMPLATE_MIME_TYPES = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dot: "application/msword",
  dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  pdf: "application/pdf",
};
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getTemplateLabel = (template) =>
  template?.template_name || template?.document_type || "Document Template";

const getFileExtension = (fileName) => fileName.split(".").pop()?.toLowerCase() || "";

const slugifyTemplateName = (value) =>
  String(value || "document-template")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "document-template";

const sanitizeUploadFileName = (fileName, extension) => {
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, "");
  const safeName =
    String(nameWithoutExtension || "template")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "template";

  return `${safeName}.${extension}`;
};

const getDocumentTemplateSetupMessage = (error) => {
  const message = error?.message || "";
  const lowerMessage = message.toLowerCase();
  const isNetworkOrCors = error?.name === "TypeError" || lowerMessage.includes("failed to fetch");

  if (
    lowerMessage.includes("bucket") ||
    lowerMessage.includes("row-level security") ||
    lowerMessage.includes("permission") ||
    lowerMessage.includes("not found") ||
    isNetworkOrCors
  ) {
    return "Document template uploads are not set up yet or connection failed. Run supabase/fixes/add-document-template-upload-support.sql in Supabase to configure the 'document-templates' bucket, check your internet connection, or make sure CORS is configured.";
  }

  return message || "Failed to upload document template.";
};

const findExistingTemplateRow = async (template) => {
  const candidates = [
    template?.id,
    template?.document_type,
    template?.template_name,
  ].filter(Boolean);

  if (template?.id && UUID_PATTERN.test(template.id)) {
    const { data, error } = await supabase
      .from(DOCUMENT_TEMPLATES_TABLE)
      .select("*")
      .eq("id", template.id)
      .limit(1);

    if (error) throw error;
    if (data?.[0]) return data[0];
  }

  for (const column of ["document_type", "template_name"]) {
    for (const value of candidates) {
      const { data, error } = await supabase
        .from(DOCUMENT_TEMPLATES_TABLE)
        .select("*")
        .eq(column, value)
        .limit(1);

      if (error) throw error;
      if (data?.[0]) return data[0];
    }
  }

  return null;
};

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const getPreparedDocuments = () => {
  const storage = getStorage();
  if (!storage) return {};

  try {
    const parsed = JSON.parse(storage.getItem(PREPARED_DOCUMENTS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * Fetch document requests.
 * - Joins resident to display resident full_name.
 *
 * @param {object} params
 * @param {string} [params.status] - Pending | Approved | Released
 * @param {string} [params.search] - search resident full_name or document_type
 * @param {number} [params.limit] - limit number of results
 */
export async function fetchDocumentRequests({ status = "", search = "", limit = 50 } = {}) {
  let query = supabase
    .from(DOCUMENT_REQUESTS_TABLE)
    .select(DOCUMENT_REQUEST_WITH_RESIDENT_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  if (search) {
    // Supabase text search using ilike; for joined table use the nested filter.
    const escaped = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.or(
      `document_type.ilike.%${escaped}%,${RESIDENTS_TABLE}.full_name.ilike.%${escaped}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: data || [], count };
}

/**
 * Fetch all document templates
 */
export async function fetchDocumentTemplates() {
  const { data, error } = await supabase
    .from(DOCUMENT_TEMPLATES_TABLE)
    .select("*")
    .order("document_type", { ascending: true });

  if (error) {
    console.warn("Falling back to local real document templates:", error.message);
    return mergeRealDocumentTemplates([]);
  }

  return mergeRealDocumentTemplates(data || []);
}

/**
 * Upload or replace the file attached to a document template.
 */
export async function uploadDocumentTemplateFile(template, file) {
  try {
    if (!template) throw new Error("Select a document template before uploading.");
    if (!file) throw new Error("Choose a Word or PDF template file to upload.");

    const extension = getFileExtension(file.name);
    if (!DOCUMENT_TEMPLATE_FILE_TYPES.has(extension)) {
      throw new Error("Upload a .doc, .docx, .dot, .dotx, or .pdf template file.");
    }

    const label = getTemplateLabel(template);
    const filePath = `${slugifyTemplateName(label)}/${Date.now()}-${sanitizeUploadFileName(
      file.name,
      extension
    )}`;

    let uploadError;
    try {
      const { error } = await supabase.storage
        .from(DOCUMENT_TEMPLATE_BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type || DOCUMENT_TEMPLATE_MIME_TYPES[extension],
          upsert: true,
        });
      uploadError = error;
    } catch (err) {
      uploadError = err;
    }

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from(DOCUMENT_TEMPLATE_BUCKET)
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      throw new Error("Template uploaded, but no public URL was returned.");
    }

    const payload = {
      template_name: template.template_name || template.document_type || label,
      document_type: template.document_type || template.template_name || label,
      description: template.description || "",
      requirements: template.requirements || "",
      processing_time: template.processing_time || "",
      fee: template.fee || "",
      template_file_path: publicUrlData.publicUrl,
    };
    const existingTemplate = await findExistingTemplateRow(template);

    if (existingTemplate?.id) {
      const { data, error } = await supabase
        .from(DOCUMENT_TEMPLATES_TABLE)
        .update(payload)
        .eq("id", existingTemplate.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from(DOCUMENT_TEMPLATES_TABLE)
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error uploading document template:", error);
    throw new Error(getDocumentTemplateSetupMessage(error), { cause: error });
  }
}

/**
 * Update document request status
 */
export async function updateDocumentRequestStatus(id, status) {
  const { data, error } = await supabase
    .from(DOCUMENT_REQUESTS_TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select();

  if (error) throw error;
  const updatedRow = Array.isArray(data) ? data[0] : data;
  if (!updatedRow) return null;

  const notificationByStatus = {
    Processing: {
      title: "Document request is being processed",
      message: `Your ${updatedRow.document_type || "document"} request is now being processed by the barangay office.`,
    },
    Approved: {
      title: "Document request approved",
      message: `Your ${updatedRow.document_type || "document"} request has been approved and is being prepared by the barangay office.`,
    },
    Completed: {
      title: "Document ready for pickup",
      message: `Your ${updatedRow.document_type || "document"} request is completed and ready for pickup at the barangay office.`,
    },
    Released: {
      title: "Document ready for pickup",
      message: `Your ${updatedRow.document_type || "document"} request is released and ready for pickup at the barangay office.`,
    },
    Rejected: {
      title: "Document request update",
      message: `Your ${updatedRow.document_type || "document"} request was not approved. Please contact the barangay office for details.`,
    },
  };

  const notification = notificationByStatus[status];

  if (notification && getSystemSettings().documentNotificationsEnabled !== false) {
    try {
      await createResidentNotification({
        resident_id: updatedRow.resident_id,
        document_request_id: updatedRow.id,
        title: notification.title,
        message: notification.message,
      });
    } catch (notificationError) {
      console.warn("Status updated, but notification was not created:", notificationError.message);
    }
  }

  return updatedRow;
}

/**
 * Create a new document request
 */
export async function createDocumentRequest({ resident_id, document_type, status = "Pending" }) {
  const { data, error } = await supabase
    .from(DOCUMENT_REQUESTS_TABLE)
    .insert([{ resident_id, document_type, status }])
    .select();

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Cancel a pending document request
 */
export async function cancelDocumentRequest(id) {
  const { data, error } = await supabase
    .from(DOCUMENT_REQUESTS_TABLE)
    .update({ status: "Cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select();

  if (error) throw error;
  const item = Array.isArray(data) ? data[0] : data;

  if (item && getSystemSettings().documentNotificationsEnabled !== false) {
    try {
      await createResidentNotification({
        resident_id: item.resident_id,
        document_request_id: item.id,
        title: "Document request cancelled",
        message: `Your ${item.document_type || "document"} request has been cancelled as requested.`,
      });
    } catch (notificationError) {
      console.warn("Cancelled status updated, but notification failed:", notificationError.message);
    }
  }

  return item;
}

/**
 * Update document request type while pending
 */
export async function updateDocumentRequestType(id, document_type) {
  const { data, error } = await supabase
    .from(DOCUMENT_REQUESTS_TABLE)
    .update({ document_type, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select();

  if (error) throw error;
  const item = Array.isArray(data) ? data[0] : data;

  if (item && getSystemSettings().documentNotificationsEnabled !== false) {
    try {
      await createResidentNotification({
        resident_id: item.resident_id,
        document_request_id: item.id,
        title: "Document request updated",
        message: `Your document request was successfully updated to ${document_type}.`,
      });
    } catch (notificationError) {
      console.warn("Request updated, but notification failed:", notificationError.message);
    }
  }

  return item;
}

/**
 * Delete a document request record
 */
export async function deleteDocumentRequest(id) {
  // Fetch the record snapshot first for the Recycle Bin
  const { data: record } = await supabase
    .from(DOCUMENT_REQUESTS_TABLE)
    .select("*, residents(full_name)")
    .eq("id", id)
    .single();

  if (record) {
    moveToRecycleBin("document_requests", id, record);
  }

  const { data, error } = await supabase
    .from(DOCUMENT_REQUESTS_TABLE)
    .delete()
    .eq("id", id)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Fetch notifications for a resident dashboard
 */
export async function fetchResidentNotifications(residentId, limit = 10) {
  const { data, error } = await supabase
    .from(RESIDENT_NOTIFICATIONS_TABLE)
    .select("id,resident_id,document_request_id,title,message,is_read,created_at")
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Create resident notification after admin completes a request
 */
export async function createResidentNotification({
  resident_id,
  document_request_id,
  title,
  message,
}) {
  const { data, error } = await supabase
    .from(RESIDENT_NOTIFICATIONS_TABLE)
    .insert([{ resident_id, document_request_id, title, message }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Mark a notification as read in the resident dashboard
 */
export async function markResidentNotificationRead(id) {
  const { data, error } = await supabase
    .from(RESIDENT_NOTIFICATIONS_TABLE)
    .update({ is_read: true })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch a single document request by ID
 */
export async function fetchDocumentRequestById(id) {
  const { data, error } = await supabase
    .from(DOCUMENT_REQUESTS_TABLE)
    .select(DOCUMENT_REQUEST_WITH_RESIDENT_COLUMNS)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export function getPreparedDocument(requestId) {
  if (!requestId) return null;
  return getPreparedDocuments()[requestId] || null;
}

export function savePreparedDocument(requestId, documentData) {
  if (!requestId) throw new Error("Request ID is required.");

  const storage = getStorage();
  if (!storage) return null;

  const documents = getPreparedDocuments();
  const savedDocument = {
    ...documentData,
    requestId,
    saved_at: new Date().toISOString(),
  };

  storage.setItem(
    PREPARED_DOCUMENTS_KEY,
    JSON.stringify({
      ...documents,
      [requestId]: savedDocument,
    })
  );

  return savedDocument;
}

/**
 * Get a resident's document requests
 */
export async function getResidentDocumentRequests(residentId) {
  const { data, error } = await supabase
    .from(DOCUMENT_REQUESTS_TABLE)
    .select(DOCUMENT_REQUEST_COLUMNS)
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

