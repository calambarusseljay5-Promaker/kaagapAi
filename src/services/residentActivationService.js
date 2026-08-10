import { supabase } from "../lib/supabaseClient";
import { recordAuditEvent } from "./adminActivityService";

const ACTIVATION_SQL_PATH = "supabase/Database/add-resident-account-activation.sql";
const ONLINE_REGISTRATION_SQL_PATH = "supabase/Database/add-online-resident-registration.sql";
const PROOF_REVIEW_SQL_PATH = "supabase/Database/add-online-registration-proof-review.sql";
const REGISTRATION_PROOF_BUCKET = "resident-registration-proofs";

const getRpcRow = (data) => (Array.isArray(data) ? data[0] : data);

const getActivationError = (error) => {
  const message = String(error?.message || "").toLowerCase();

  if (
    error?.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("schema cache") ||
    message.includes("resident_activation_requests") ||
    message.includes("resident_accounts")
  ) {
    return new Error(
      `Resident online registration tables are not installed yet. Run ${ACTIVATION_SQL_PATH} and ${ONLINE_REGISTRATION_SQL_PATH} in the Supabase SQL Editor, then refresh the app.`
    );
  }

  return error;
};

export async function fetchResidentActivationRequests(statusFilter = "Pending Approval") {
  const { data, error } = await supabase.rpc("get_resident_activation_requests", {
    p_status_filter: statusFilter || null,
  });

  if (error) {
    throw getActivationError(error);
  }

  const requests = (data || []).map((request) => ({
    ...request,
    request_id: request.request_id || request.id,
    request_status: request.request_status || request.status,
  }));

  if (requests.length === 0) {
    return requests;
  }

  const requestIds = requests.map((request) => request.request_id).filter(Boolean);
  const { data: proofRows, error: proofError } = await supabase
    .from("resident_activation_requests")
    .select("id,requested_proof_path,requested_proof_name,requested_proof_type")
    .in("id", requestIds);

  if (proofError) {
    const proofMessage = String(proofError.message || "").toLowerCase();
    const proofSchemaMissing =
      proofMessage.includes("requested_proof_path") ||
      proofMessage.includes("schema cache") ||
      proofError.code === "42703";

    if (proofSchemaMissing) {
      return requests.map((request) => ({
        ...request,
        proof_review_available: false,
      }));
    }

    throw getActivationError(proofError);
  }

  const proofByRequestId = new Map((proofRows || []).map((row) => [row.id, row]));

  return requests.map((request) => ({
    ...request,
    ...(proofByRequestId.get(request.request_id) || {}),
    proof_review_available: true,
  }));
}

export async function createResidentRegistrationProofUrl(request) {
  const proofPath = request?.requested_proof_path;

  if (!proofPath) {
    throw new Error("No verification proof is attached to this request.");
  }

  let data, error;
  try {
    const res = await supabase.storage
      .from(REGISTRATION_PROOF_BUCKET)
      .createSignedUrl(proofPath, 10 * 60);
    data = res.data;
    error = res.error;
  } catch (err) {
    error = err;
  }

  if (error) {
    const message = String(error.message || "").toLowerCase();
    const isNetworkOrCors = error.name === "TypeError" || message.includes("failed to fetch");
    if (message.includes("bucket") || message.includes("not found") || isNetworkOrCors) {
      throw new Error(`Proof review is not installed yet or connection failed. Run ${PROOF_REVIEW_SQL_PATH} in Supabase and ensure the '${REGISTRATION_PROOF_BUCKET}' bucket exists.`);
    }
    throw error;
  }

  if (!data?.signedUrl) {
    throw new Error("Unable to create a secure proof preview.");
  }

  return data.signedUrl;
}

export async function approveResidentActivationRequest(request) {
  const requestId = typeof request === "string" ? request : request?.request_id;

  if (!requestId) {
    throw new Error("Registration request is missing.");
  }

  const { data, error } = await supabase.rpc("approve_resident_activation_request", {
    p_request_id: requestId,
  });

  if (error) {
    throw getActivationError(error);
  }

  const result = getRpcRow(data) || {};

  recordAuditEvent({
    module: "Resident Registration",
    action: "Registration approved",
    details: `${request?.full_name || "Resident"} was approved with username ${
      result.username || "generated"
    }.`,
    source: "Admin",
  });

  return result;
}

export async function rejectResidentActivationRequest(request, reason = "Rejected by admin") {
  const requestId = typeof request === "string" ? request : request?.request_id;
  const rejectionReason = String(reason || "Rejected by admin").trim();

  if (!requestId) {
    throw new Error("Registration request is missing.");
  }

  const { data, error } = await supabase.rpc("reject_resident_activation_request", {
    p_request_id: requestId,
    p_reason: rejectionReason,
  });

  if (error) {
    throw getActivationError(error);
  }

  const result = getRpcRow(data) || {};

  recordAuditEvent({
    module: "Resident Registration",
    action: "Registration rejected",
    details: `${request?.full_name || "Resident"} was rejected. Reason: ${rejectionReason}`,
    source: "Admin",
  });

  return result;
}
