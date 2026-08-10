import { supabase } from "../lib/supabaseClient";
import { buildFullName } from "../utils/residentProfile";

const RESIDENT_SESSION_KEY = "kaagapai_resident_session";
const ACTIVATION_SQL_PATH = "supabase/Database/add-resident-account-activation.sql";
const ONLINE_REGISTRATION_SQL_PATH = "supabase/Database/add-online-resident-registration.sql";
const PROOF_REVIEW_SQL_PATH = "supabase/Database/add-online-registration-proof-review.sql";
const CRYPT_FIX_SQL_PATH = "supabase/Database/fix-resident-account-crypt-search-path.sql";
const REGISTRATION_PROOF_BUCKET = "resident-registration-proofs";
const MAX_REGISTRATION_PROOF_SIZE = 5 * 1024 * 1024;
const ALLOWED_REGISTRATION_PROOF_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const normalizeUsername = (value) => String(value || "").trim().toLowerCase();
const normalizeText = (value) => String(value || "").trim();

const getRpcRow = (data) => (Array.isArray(data) ? data[0] : data);

const isMissingActivationRpc = (error) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("schema cache") ||
    message.includes("resident_accounts") ||
    message.includes("resident_activation_requests")
  );
};

const isResidentCryptError = (error) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("function crypt") ||
    message.includes("function gen_salt") ||
    message.includes("pgcrypto")
  );
};

const isMissingRegistrationProofStorage = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const isNetworkOrCors = error?.name === "TypeError" || message.includes("failed to fetch");

  return (
    message.includes("bucket") ||
    message.includes("storage") ||
    message.includes("not found") ||
    isNetworkOrCors
  );
};

const getResidentAuthError = (error) => {
  if (isMissingActivationRpc(error)) {
    return new Error(
      `Resident online registration is not installed yet. Run ${ACTIVATION_SQL_PATH}, ${ONLINE_REGISTRATION_SQL_PATH}, and ${PROOF_REVIEW_SQL_PATH} in the Supabase SQL Editor, then refresh the app.`
    );
  }

  if (isResidentCryptError(error)) {
    return new Error(
      `Resident password verification needs the pgcrypto fix. Run ${CRYPT_FIX_SQL_PATH} in the Supabase SQL Editor, then refresh the app.`
    );
  }

  if (isMissingRegistrationProofStorage(error)) {
    return new Error(
      `Resident registration proof storage is not setup or there is a CORS/network connection error. Please run the SQL script '${PROOF_REVIEW_SQL_PATH}' in the Supabase SQL Editor to create the '${REGISTRATION_PROOF_BUCKET}' bucket, or check your connection.`
    );
  }

  return error;
};

export function validateResidentRegistrationProof(file) {
  if (!file) {
    throw new Error("Please attach a valid ID or proof of residency.");
  }

  if (!ALLOWED_REGISTRATION_PROOF_TYPES.has(file.type)) {
    throw new Error("Proof must be a JPG, PNG, WebP, or PDF file.");
  }

  if (file.size > MAX_REGISTRATION_PROOF_SIZE) {
    throw new Error("Proof file must not exceed 5 MB.");
  }

  return file;
}

async function attachResidentRegistrationProof(requestId, file) {
  validateResidentRegistrationProof(file);

  if (!requestId) {
    throw new Error("Registration request was saved without a request ID. Please contact the barangay office.");
  }

  const uniqueId =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const extension = file.name.includes(".")
    ? file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  const objectPath = `${requestId}/${uniqueId}${extension ? `.${extension}` : ""}`;
  
  let uploadError;
  try {
    const { error } = await supabase.storage
      .from(REGISTRATION_PROOF_BUCKET)
      .upload(objectPath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
    uploadError = error;
  } catch (err) {
    uploadError = err;
  }

  if (uploadError) {
    throw getResidentAuthError(uploadError);
  }

  const { error: attachError } = await supabase.rpc("attach_resident_registration_proof", {
    p_request_id: requestId,
    p_proof_path: objectPath,
    p_proof_name: file.name,
    p_proof_type: file.type,
  });

  if (attachError) {
    throw getResidentAuthError(attachError);
  }

  return objectPath;
}

function serializeResident(row) {
  if (!row) return null;

  return {
    id: row.resident_id || row.id,
    account_id: row.account_id || null,
    full_name: row.full_name || "",
    username: row.username || "",
    email: row.email || "",
    phone: row.phone || "",
    house_no: row.house_no || "",
    household_no: row.household_no || "",
    birthday: row.birthday || "",
    age: row.age ?? null,
    gender: row.gender || row.sex || "",
    purok: row.purok || "",
    address: row.address || "",
    status: row.resident_status || row.status || "",
    account_status: row.account_status || "",
    must_change_credentials: Boolean(row.must_change_credentials),
    role: "resident",
  };
}

export function saveResidentSession(session) {
  if (!session) return null;
  const serialized = serializeResident(session);
  localStorage.setItem(RESIDENT_SESSION_KEY, JSON.stringify(serialized));
  return serialized;
}

export async function loginResident(username, password) {
  const normalizedUsername = normalizeUsername(username);
  const currentPassword = String(password || "");

  if (!normalizedUsername || !currentPassword) {
    throw new Error("Please enter username and password.");
  }

  const { data, error } = await supabase.rpc("login_resident_account", {
    p_username: normalizedUsername,
    p_password: currentPassword,
  });

  if (error) {
    throw getResidentAuthError(error);
  }

  const row = getRpcRow(data);
  const session = saveResidentSession(row);

  if (!session) {
    throw new Error("Unable to start resident session. Please try again.");
  }

  return session;
}

export async function requestResidentActivation(activation = {}) {
  const fullName = normalizeText(
    activation.fullName ||
      buildFullName({
        first_name: activation.first_name,
        middle_name: activation.middle_name,
        last_name: activation.last_name,
      })
  );
  const birthday = normalizeText(activation.birthday);
  const householdNo = normalizeText(
    activation.householdNo || activation.household_no || activation.houseNo || activation.house_no
  );
  const phone = normalizeText(activation.phone);
  const username = normalizeText(activation.username || activation.portal_username);
  const password = activation.portal_password || activation.password || "";
  const email = normalizeText(activation.gmail || activation.email);

  if (!fullName || !birthday || !householdNo) {
    throw new Error("Please enter full name, birth date, and household number.");
  }

  // Validate username if provided
  if (username) {
    if (username.length < 3) {
      throw new Error("Username must be at least 3 characters long.");
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      throw new Error("Username can only contain letters, numbers, dots, dashes, and underscores.");
    }
  }

  // Validate password if provided
  if (password && password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  // Validate email format if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }

  const { data, error } = await supabase.rpc("request_resident_account_activation", {
    p_full_name: fullName,
    p_birthday: birthday,
    p_household_no: householdNo,
    p_phone: phone || null,
    p_last_name: normalizeText(activation.last_name) || null,
    p_first_name: normalizeText(activation.first_name) || null,
    p_middle_name: normalizeText(activation.middle_name) || null,
    p_sex: normalizeText(activation.sex || activation.gender) || null,
    p_birthplace: normalizeText(activation.birthplace) || null,
    p_purok: normalizeText(activation.purok) || null,
    p_educational_attainment: normalizeText(activation.educational_attainment) || null,
    p_occupation: normalizeText(activation.occupation) || null,
    p_civil_status: normalizeText(activation.civil_status) || null,
    p_house_no: normalizeText(activation.house_no || activation.houseNo) || null,
    p_relationship_to_household_head:
      normalizeText(
        activation.relationship_to_household_head || activation.household_relationship
      ) || null,
    p_address: normalizeText(activation.address) || null,
    p_is_4ps_member: Boolean(activation.is_4ps_member),
    p_is_solo_parent: Boolean(activation.is_solo_parent),
    p_is_pwd: Boolean(activation.is_pwd),
    p_pwd_type: normalizeText(activation.pwd_type) || null,
    p_username: username || null,
    p_password: password || null,
    p_email: email || null,
  });

  if (error) {
    throw getResidentAuthError(error);
  }

  const result = getRpcRow(data) || {};
  const requestId = result.request_id || null;

  if (activation.proofFile && requestId) {
    await attachResidentRegistrationProof(requestId, activation.proofFile);
  }

  return {
    status: result.activation_status || result.request_status || result.status || "Pending Approval",
    message:
      result.activation_message ||
      result.request_message ||
      "Your registration has been submitted. Please wait for admin approval. You will receive an SMS notification when your account is ready.",
    requestId,
    residentId: result.resident_id || null,
    proofAttached: Boolean(activation.proofFile && requestId),
  };
}

export async function registerResident(registration = {}) {
  return requestResidentActivation(registration);
}

export async function updateResidentCredentials({
  currentUsername,
  currentPassword,
  newUsername,
  newPassword,
} = {}) {
  const normalizedCurrentUsername = normalizeUsername(currentUsername);
  const nextUsername = normalizeUsername(newUsername);
  const password = String(currentPassword || "");
  const nextPassword = String(newPassword || "");

  if (!normalizedCurrentUsername || !password || !nextUsername || !nextPassword) {
    throw new Error("Please complete all username and password fields.");
  }

  const { data, error } = await supabase.rpc("update_resident_account_credentials", {
    p_current_username: normalizedCurrentUsername,
    p_current_password: password,
    p_new_username: nextUsername,
    p_new_password: nextPassword,
  });

  if (error) {
    throw getResidentAuthError(error);
  }

  const row = getRpcRow(data);

  // Sync plain_password and username via RPC (SECURITY DEFINER) so Admin can retrieve the updated password
  try {
    await supabase.rpc("sync_resident_plain_password", {
      p_username: nextUsername,
      p_password: nextPassword,
    });
  } catch (syncErr) {
    console.warn("Unable to sync plain_password via RPC:", syncErr);
  }

  const session = saveResidentSession(row);

  if (!session) {
    throw new Error("Credentials were updated, but the session could not be refreshed.");
  }

  return session;
}

export function getResidentSession() {
  try {
    const rawSession = localStorage.getItem(RESIDENT_SESSION_KEY);
    return rawSession ? JSON.parse(rawSession) : null;
  } catch {
    return null;
  }
}

export function clearResidentSession() {
  localStorage.removeItem(RESIDENT_SESSION_KEY);
}

/**
 * Reset resident password by verified phone number after OTP validation
 */
export async function resetResidentPasswordByPhone(phone, newPassword) {
  const cleanPhone = String(phone || "").trim();
  const cleanPassword = String(newPassword || "").trim();
  if (!cleanPhone || !cleanPassword) {
    throw new Error("Phone number and new password are required.");
  }
  if (cleanPassword.length < 6) {
    throw new Error("New password must be at least 6 characters long.");
  }

  // 1. Find resident by phone
  const { data: resident, error: fetchErr } = await supabase
    .from("residents")
    .select("id, full_name, phone, status")
    .eq("phone", cleanPhone)
    .neq("status", "Archived")
    .limit(1)
    .maybeSingle();

  if (fetchErr) throw getResidentAuthError(fetchErr);
  if (!resident) {
    throw new Error("No active resident account found matching this phone number.");
  }

  // 2. Try RPC for password update if defined
  try {
    const { error: rpcErr } = await supabase.rpc("reset_resident_password_by_phone", {
      p_phone: cleanPhone,
      p_new_password: cleanPassword,
    });
    if (!rpcErr) return true;
  } catch (err) {
    // RPC may not exist, fallback to direct update or sync
  }

  // 3. Update resident_accounts directly
  try {
    const { data: account } = await supabase
      .from("resident_accounts")
      .select("id, username")
      .eq("resident_id", resident.id)
      .maybeSingle();

    if (account) {
      await supabase
        .from("resident_accounts")
        .update({
          plain_password: cleanPassword,
          must_change_credentials: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      // Sync plain_password
      try {
        await supabase.rpc("sync_resident_plain_password", {
          p_username: account.username,
          p_password: cleanPassword,
        });
      } catch (syncErr) {
        // Silently catch if RPC missing
      }
    }
  } catch (err) {
    console.warn("Direct resident_accounts update notice:", err);
  }

  return true;
}

