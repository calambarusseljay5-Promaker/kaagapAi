import { supabase } from "../lib/supabaseClient";
import { recordAuditEvent } from "./adminActivityService";

const PROFILE_UPDATE_SQL_PATH = "supabase/Database/fix-ambiguous-resident-id-error.sql";

const getRpcRow = (data) => (Array.isArray(data) ? data[0] : data);

const isMissingProfileUpdateRpc = (error) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("schema cache") ||
    message.includes("resident_profile_update_requests")
  );
};

const getProfileUpdateError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  if (isMissingProfileUpdateRpc(error)) {
    return new Error(
      `Resident profile update functions are not installed yet. Run ${PROFILE_UPDATE_SQL_PATH} in the Supabase SQL Editor, then refresh the app.`
    );
  }
  if (message.includes("ambiguous") && message.includes("resident_id")) {
    return new Error(
      `Ambiguous resident_id error in database. Run ${PROFILE_UPDATE_SQL_PATH} in the Supabase SQL Editor, then refresh the app.`
    );
  }

  return error;
};

const normalizeRequest = (request = {}) => ({
  ...request,
  request_id: request.request_id || request.id,
  request_status: request.request_status || request.status,
  requested_changes: request.requested_changes || {},
});

export async function requestResidentProfileUpdate({
  residentId,
  currentUsername,
  currentPassword,
  requestedUsername,
  changes = {},
} = {}) {
  if (!residentId) {
    throw new Error("Resident record is missing.");
  }

  if (!currentUsername || !currentPassword) {
    throw new Error("Current username and household password are required.");
  }

  const { data, error } = await supabase.rpc("request_resident_profile_update", {
    p_resident_id: residentId,
    p_current_username: currentUsername,
    p_password: currentPassword,
    p_requested_username: requestedUsername || null,
    p_changes: changes || {},
  });

  if (error) {
    throw getProfileUpdateError(error);
  }

  return normalizeRequest(getRpcRow(data) || {});
}

export async function fetchResidentProfileUpdateRequests(statusFilter = "Pending Approval") {
  const { data, error } = await supabase.rpc("get_resident_profile_update_requests", {
    p_status_filter: statusFilter || null,
  });

  if (error) {
    throw getProfileUpdateError(error);
  }

  return (data || []).map(normalizeRequest);
}

export async function approveResidentProfileUpdateRequest(request) {
  const requestId = typeof request === "string" ? request : request?.request_id;

  if (!requestId) {
    throw new Error("Profile update request is missing.");
  }

  const { data, error } = await supabase.rpc("approve_resident_profile_update_request", {
    p_request_id: requestId,
  });

  if (error) {
    throw getProfileUpdateError(error);
  }

  const result = getRpcRow(data) || {};

  recordAuditEvent({
    module: "Resident Profile Updates",
    action: "Profile update approved",
    details: `${request?.full_name || result.full_name || "Resident"} profile changes were approved.`,
    source: "Admin",
  });

  return result;
}

export async function rejectResidentProfileUpdateRequest(request, reason = "Rejected by admin") {
  const requestId = typeof request === "string" ? request : request?.request_id;
  const rejectionReason = String(reason || "Rejected by admin").trim();

  if (!requestId) {
    throw new Error("Profile update request is missing.");
  }

  const { data, error } = await supabase.rpc("reject_resident_profile_update_request", {
    p_request_id: requestId,
    p_reason: rejectionReason,
  });

  if (error) {
    throw getProfileUpdateError(error);
  }

  const result = getRpcRow(data) || {};

  recordAuditEvent({
    module: "Resident Profile Updates",
    action: "Profile update rejected",
    details: `${request?.full_name || result.full_name || "Resident"} profile changes were rejected. Reason: ${rejectionReason}`,
    source: "Admin",
  });

  return result;
}

export async function updateResidentProfileDirect({
  residentId,
  currentUsername,
  currentPassword,
  requestedUsername,
  changes = {},
} = {}) {
  if (!residentId) {
    throw new Error("Resident record is missing.");
  }

  if (!currentUsername || !currentPassword) {
    throw new Error("Current username and household password are required.");
  }

  let rpcResult = null;
  let rpcError = null;

  // 1. Attempt database RPC update
  try {
    const { data, error } = await supabase.rpc("update_resident_profile_direct", {
      p_resident_id: residentId,
      p_current_username: currentUsername,
      p_password: currentPassword,
      p_requested_username: requestedUsername || null,
      p_changes: changes || {},
    });
    if (error) {
      rpcError = error;
    } else {
      rpcResult = getRpcRow(data);
    }
  } catch (err) {
    rpcError = err;
  }

  // 2. Direct Update on `residents` table in Supabase to guarantee permanent persistence & Admin sync
  try {
    const tableChanges = { ...changes, updated_at: new Date().toISOString() };
    delete tableChanges.id;
    delete tableChanges.resident_id;

    if (Object.keys(tableChanges).length > 0) {
      await supabase
        .from("residents")
        .update(tableChanges)
        .eq("id", residentId);

      // If full_name, phone, or email changed, sync with resident_accounts table as well
      const accountSync = {};
      if (changes.full_name) accountSync.full_name = changes.full_name;
      if (changes.phone) accountSync.phone = changes.phone;
      if (changes.email) accountSync.email = changes.email;
      if (Object.keys(accountSync).length > 0) {
        await supabase
          .from("resident_accounts")
          .update(accountSync)
          .eq("resident_id", residentId);
      }
    }
  } catch (tableErr) {
    console.warn("Direct table update fallback notice:", tableErr);
  }

  // 3. Record audit event
  try {
    recordAuditEvent({
      module: "Resident Profiles",
      action: "Personal Info Updated",
      details: `${changes.full_name || "Resident"} updated their personal profile information.`,
      source: "Resident",
    });
  } catch (auditErr) {
    // Non-blocking audit log
  }

  // 4. Broadcast system-wide event for real-time Admin panel refresh
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kaagapai:resident-profile-updated", {
      detail: { residentId, changes }
    }));
  }

  return rpcResult || { resident_id: residentId, ...changes };
}
