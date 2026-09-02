import { supabase } from "../lib/supabaseClient";
import { buildFullName } from "../utils/residentProfile";
import { sendSmsNotification } from "./smsService";

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
  return (
    message.includes(REGISTRATION_PROOF_BUCKET) ||
    (message.includes("bucket") && message.includes("proof"))
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
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
  
  let uploadError = null;
  let finalPath = objectPath;

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

  // If storage upload fails (bucket missing, network or CORS error), convert to Data URL fallback
  if (uploadError) {
    console.warn("Storage upload notice, applying inline data URL fallback for proof:", uploadError?.message || uploadError);
    try {
      finalPath = await readFileAsDataUrl(file);
    } catch {
      finalPath = `proof_${file.name}`;
    }
  }

  // Save proof path / data URL to resident_activation_requests
  let attachError = null;
  if (!finalPath.startsWith("data:")) {
    try {
      const { error } = await supabase.rpc("attach_resident_registration_proof", {
        p_request_id: requestId,
        p_proof_path: finalPath,
        p_proof_name: file.name,
        p_proof_type: file.type,
      });
      attachError = error;
    } catch (err) {
      attachError = err;
    }
  }

  if (attachError || finalPath.startsWith("data:")) {
    // Direct table update fallback
    try {
      await supabase
        .from("resident_activation_requests")
        .update({
          requested_proof_path: finalPath,
          requested_proof_name: file.name,
          requested_proof_type: file.type,
        })
        .eq("id", requestId);
    } catch (updateErr) {
      console.warn("Direct update proof notice:", updateErr);
    }
  }

  return finalPath;
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
  const currentPassword = String(password || "").trim();

  if (!normalizedUsername || !currentPassword) {
    throw new Error("Please enter username and password.");
  }

  // 1. Try Postgres RPC login_resident_account first
  try {
    const { data, error } = await supabase.rpc("login_resident_account", {
      p_username: normalizedUsername,
      p_password: currentPassword,
    });

    if (!error && data) {
      const row = getRpcRow(data);
      if (row) {
        const session = saveResidentSession(row);
        if (session) return session;
      }
    }

    if (error) {
      const errMsg = String(error.message || "");
      if (
        errMsg.includes("pending admin approval") ||
        errMsg.includes("rejected") ||
        errMsg.includes("not active")
      ) {
        throw new Error(errMsg);
      }
      console.warn("login_resident_account RPC returned notice, falling back to direct table lookup:", errMsg);
    }
  } catch (rpcErr) {
    const rpcMsg = String(rpcErr.message || "");
    if (
      rpcMsg.includes("pending admin approval") ||
      rpcMsg.includes("rejected") ||
      rpcMsg.includes("not active")
    ) {
      throw rpcErr;
    }
    console.warn("RPC attempt threw, evaluating direct table fallback:", rpcMsg);
  }

  // 2. Direct Supabase Table Fallback: Look up in resident_accounts and residents
  let account = null;
  let resident = null;

  // Step 2a: Lookup resident_accounts by username
  const { data: directAccount } = await supabase
    .from("resident_accounts")
    .select("*, resident:residents(*)")
    .ilike("username", normalizedUsername)
    .limit(1)
    .maybeSingle();

  if (directAccount) {
    account = directAccount;
    resident = directAccount.resident;
  } else {
    // Step 2b: Lookup resident by phone, email, or username prefix in residents table
    const { data: directResident } = await supabase
      .from("residents")
      .select("*, resident_accounts(*)")
      .or(`phone.eq.${normalizedUsername},email.ilike.${normalizedUsername},email.ilike.${normalizedUsername}@%`)
      .limit(1)
      .maybeSingle();

    if (directResident) {
      resident = directResident;
      const accList = directResident.resident_accounts;
      account = Array.isArray(accList) ? accList[0] : accList;
    }
  }

  if (!resident && !account) {
    throw new Error("Account not found. Please check your username or register your account online.");
  }

  if (account) {
    if (account.account_status === "Pending Approval") {
      throw new Error("Your account is pending admin approval. Please wait for confirmation.");
    }
    if (account.account_status === "Rejected") {
      throw new Error("Your account registration was rejected. Please visit the Barangay Office.");
    }
    if (account.account_status && account.account_status !== "Active") {
      throw new Error("Your account is not active. Please contact the Barangay Office.");
    }
  }

  if (resident && resident.status && resident.status !== "Active") {
    throw new Error("This resident record is currently not active in the barangay system.");
  }

  // Verify password:
  const accountPlain = account?.plain_password ? String(account.plain_password).trim() : "";
  const accountHash = account?.password_hash ? String(account.password_hash).trim() : "";
  const hhNo = resident?.household_no ? String(resident.household_no).trim() : "";
  const houseNo = resident?.house_no ? String(resident.house_no).trim() : "";
  const phone = resident?.phone ? String(resident.phone).trim() : "";

  const passwordMatched =
    (accountPlain && accountPlain === currentPassword) ||
    (accountHash && accountHash === currentPassword) ||
    (hhNo && hhNo === currentPassword) ||
    (houseNo && houseNo === currentPassword) ||
    (phone && phone === currentPassword);

  if (!passwordMatched) {
    throw new Error("Invalid username or password. Please check your credentials.");
  }

  // Update last_login_at if account exists
  if (account?.id) {
    try {
      await supabase
        .from("resident_accounts")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", account.id);
    } catch {
      // Non-blocking
    }
  }

  const sessionData = {
    id: resident?.id || account?.resident_id,
    account_id: account?.id || null,
    full_name: resident ? (resident.full_name || `${resident.first_name || ""} ${resident.last_name || ""}`.trim()) : (account?.username || ""),
    email: resident?.email || "",
    username: account?.username || normalizedUsername,
    phone: resident?.phone || "",
    house_no: resident?.house_no || "",
    household_no: resident?.household_no || "",
    birthday: resident?.birthday || "",
    age: resident?.age || null,
    gender: resident?.sex || resident?.gender || "",
    purok: resident?.purok || "",
    address: resident?.address || "",
    status: resident?.status || "Active",
    account_status: account?.account_status || "Active",
    must_change_credentials: Boolean(account?.must_change_credentials),
    role: "resident",
  };

  const session = saveResidentSession(sessionData);
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

  if (!activation.proofFile) {
    throw new Error("Kailangang mag-attach ng valid ID o proof of residency.");
  }

  let requestId = null;
  let residentId = null;
  let activationStatus = "Pending Approval";

  // 1. Try RPC first
  try {
    const { data, error } = await supabase.rpc("request_resident_account_activation", {
      p_full_name: fullName,
      p_birthday: birthday,
      p_household_no: householdNo,
      p_phone: phone || null,
      p_last_name: normalizeText(activation.last_name) || null,
      p_first_name: normalizeText(activation.first_name) || null,
      p_middle_name: normalizeText(activation.middle_name) || null,
      p_suffix: normalizeText(activation.suffix) || null,
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

    if (!error && data) {
      const result = getRpcRow(data) || {};
      requestId = result.request_id || result.id || null;
      residentId = result.resident_id || null;
      activationStatus = result.activation_status || result.request_status || result.status || "Pending Approval";
    }
    if (error) {
      console.warn("RPC request_resident_account_activation error:", error.message);
    }
  } catch (rpcErr) {
    console.warn("RPC request_resident_account_activation notice:", rpcErr);
  }

  // 2. Direct database insert fallback if RPC failed or did not return an id
  if (!requestId) {
    try {
      const { data: insertData, error: insertError } = await supabase
        .from("resident_activation_requests")
        .insert({
          requested_full_name: fullName,
          requested_first_name: normalizeText(activation.first_name) || null,
          requested_middle_name: normalizeText(activation.middle_name) || null,
          requested_last_name: normalizeText(activation.last_name) || null,
          requested_suffix: normalizeText(activation.suffix) || null,
          requested_birthday: birthday,
          requested_household_no: householdNo,
          requested_phone: phone || null,
          requested_sex: normalizeText(activation.sex || activation.gender) || "Male",
          requested_birthplace: normalizeText(activation.birthplace) || null,
          requested_purok: normalizeText(activation.purok) || null,
          requested_educational_attainment: normalizeText(activation.educational_attainment) || null,
          requested_occupation: normalizeText(activation.occupation) || null,
          requested_civil_status: normalizeText(activation.civil_status) || "Single",
          requested_house_no: normalizeText(activation.house_no || activation.houseNo) || null,
          requested_relationship_to_household_head:
            normalizeText(
              activation.relationship_to_household_head || activation.household_relationship
            ) || "Head",
          requested_address: normalizeText(activation.address) || null,
          requested_is_4ps_member: Boolean(activation.is_4ps_member),
          requested_is_solo_parent: Boolean(activation.is_solo_parent),
          requested_is_pwd: Boolean(activation.is_pwd),
          requested_pwd_type: normalizeText(activation.pwd_type) || null,
          requested_username: username || null,
          requested_plain_password: password || null,
          requested_password_hash: password || null,
          requested_email: email || null,
          status: "Pending Approval",
          request_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        throw getResidentAuthError(insertError);
      }
      requestId = insertData.id;
    } catch (insertErr) {
      throw getResidentAuthError(insertErr);
    }
  }

  // 3. Always ensure the resident's exact chosen credentials are saved in resident_activation_requests
  if (requestId && (username || password)) {
    try {
      await supabase
        .from("resident_activation_requests")
        .update({
          requested_username: username || null,
          requested_plain_password: password || null,
          requested_password_hash: password || null,
          requested_email: email || null,
        })
        .eq("id", requestId);
    } catch (updateErr) {
      console.warn("Notice syncing requested credentials to request record:", updateErr);
    }
  }

  if (activation.proofFile && requestId) {
    try {
      await attachResidentRegistrationProof(requestId, activation.proofFile);
    } catch (proofErr) {
      console.warn("Notice attaching registration proof:", proofErr);
    }
  }

  return {
    status: activationStatus || "Pending Approval",
    message: "Your registration has been submitted. Please wait for admin approval. You will receive an SMS notification when your account is ready.",
    requestId,
    residentId: residentId || null,
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
 * Send SMS One-Time Password (OTP) for password recovery
 */
export async function findResidentByPhoneVariants(phoneOrIdentifier) {
  const raw = String(phoneOrIdentifier || "").trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  const searchTerms = new Set([raw]);

  if (digits.length >= 7) {
    searchTerms.add(digits);
    if (digits.length >= 10) {
      const last10 = digits.slice(-10);
      searchTerms.add(last10);
      searchTerms.add(`0${last10}`);
      searchTerms.add(`+63${last10}`);
      searchTerms.add(`63${last10}`);
      searchTerms.add(`0${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}`);
      searchTerms.add(`0${last10.slice(0, 3)} ${last10.slice(3, 6)} ${last10.slice(6)}`);
    }
  }

  const termsArray = Array.from(searchTerms).filter(Boolean);

  // 1. Check in residents table using .in()
  try {
    const { data: list } = await supabase
      .from("residents")
      .select("id, full_name, phone, status, resident_accounts(id, username)")
      .in("phone", termsArray)
      .neq("status", "Archived")
      .limit(1);

    if (list && list.length > 0) return list[0];
  } catch (err) {
    console.warn("findResidentByPhoneVariants in() error:", err);
  }

  // 2. Check in residents table using ilike with the last 10 digits
  if (digits.length >= 10) {
    try {
      const last10 = digits.slice(-10);
      const { data: ilikeList } = await supabase
        .from("residents")
        .select("id, full_name, phone, status, resident_accounts(id, username)")
        .ilike("phone", `%${last10}%`)
        .neq("status", "Archived")
        .limit(1);

      if (ilikeList && ilikeList.length > 0) return ilikeList[0];
    } catch (err) {
      console.warn("findResidentByPhoneVariants ilike error:", err);
    }
  }

  // 3. Check in resident_accounts by username
  try {
    const { data: account } = await supabase
      .from("resident_accounts")
      .select("id, username, resident_id, residents(id, full_name, phone, status)")
      .ilike("username", raw)
      .limit(1)
      .maybeSingle();

    if (account && account.residents) {
      return {
        ...account.residents,
        resident_accounts: [{ id: account.id, username: account.username }],
      };
    }
  } catch (err) {
    console.warn("findResidentByPhoneVariants username error:", err);
  }

  return null;
}

/**
 * Send SMS One-Time Password (OTP) for password recovery
 */
export async function sendResidentForgotOTP(phone) {
  const cleanPhone = String(phone || "").trim();
  if (!cleanPhone) throw new Error("Please enter your registered mobile number.");

  // 1. Verify that the phone number exists in active residents (supports 09..., +639..., etc.)
  const resident = await findResidentByPhoneVariants(cleanPhone);

  if (!resident) {
    throw new Error("No active resident account found matching this mobile number.");
  }

  const targetPhone = resident.phone || cleanPhone;

  // 2. Generate 6-digit OTP code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP in sessionStorage with 5-minute expiry
  const otpData = {
    phone: cleanPhone,
    targetPhone: targetPhone,
    residentId: resident.id,
    code: otpCode,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  sessionStorage.setItem("kaagapai_forgot_otp", JSON.stringify(otpData));

  // 3. Send SMS notification
  const message = `[KaagapAI] Ang iyong Verification Code (OTP) para sa Password Recovery ay: ${otpCode}. Valid ito sa loob ng 5 minuto. Huwag ibahagi kahit kanino.`;

  try {
    await sendSmsNotification({
      recipients: [targetPhone],
      message,
    });
  } catch (smsErr) {
    console.warn("SMS OTP notification notice:", smsErr);
  }

  return { success: true, phone: targetPhone, residentName: resident.full_name };
}

/**
 * Verify SMS One-Time Password (OTP)
 */
export function verifyResidentForgotOTP(phone, enteredOTP) {
  const raw = sessionStorage.getItem("kaagapai_forgot_otp");
  if (!raw) {
    throw new Error("No active OTP request found or code has expired. Please request a new code.");
  }

  const { phone: savedPhone, targetPhone, code: savedCode, expiresAt } = JSON.parse(raw);
  if (Date.now() > expiresAt) {
    sessionStorage.removeItem("kaagapai_forgot_otp");
    throw new Error("Verification code has expired. Please request a new one.");
  }

  const p1 = String(phone || "").replace(/\D/g, "");
  const p2 = String(savedPhone || "").replace(/\D/g, "");
  const p3 = String(targetPhone || "").replace(/\D/g, "");

  const phoneMatches = !p1 || p1 === p2 || p1 === p3 || (p1.length >= 10 && (p2.endsWith(p1.slice(-10)) || p3.endsWith(p1.slice(-10))));

  if (!phoneMatches || String(savedCode).trim() !== String(enteredOTP).trim()) {
    throw new Error("Invalid verification code. Please check your SMS and try again.");
  }

  return true;
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

  // 1. Locate resident with multi-format matching
  const resident = await findResidentByPhoneVariants(cleanPhone);
  if (!resident) {
    throw new Error("No active resident account found matching this phone number.");
  }

  const targetPhone = resident.phone || cleanPhone;

  // 2. Try dedicated RPC for password update by phone
  try {
    const { data: rpcSuccess, error: rpcErr } = await supabase.rpc("reset_resident_password_by_phone", {
      p_phone: targetPhone,
      p_new_password: cleanPassword,
    });
    if (!rpcErr && rpcSuccess) return true;
  } catch (err) {
    console.warn("reset_resident_password_by_phone RPC notice:", err);
  }

  // 3. Find account in resident_accounts
  const { data: account } = await supabase
    .from("resident_accounts")
    .select("id, username")
    .eq("resident_id", resident.id)
    .maybeSingle();

  if (!account) {
    throw new Error("No resident login credentials found for this account.");
  }

  // 4. Sync using sync_resident_plain_password RPC
  let synced = false;
  if (account.username) {
    try {
      const { error: syncErr } = await supabase.rpc("sync_resident_plain_password", {
        p_username: account.username,
        p_password: cleanPassword,
      });
      if (!syncErr) synced = true;
    } catch (syncErr) {
      console.warn("sync_resident_plain_password notice:", syncErr);
    }
  }

  // Fallback: Direct table update
  try {
    await supabase
      .from("resident_accounts")
      .update({
        plain_password: cleanPassword,
        must_change_credentials: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);
  } catch (err) {
    console.warn("Direct resident_accounts update notice:", err);
  }

  return true;
}

/**
 * Reset resident password by identity verification (Username/Email + Birthday/Phone)
 */
export async function resetResidentPasswordByVerification({
  identifier,
  verificationKey,
  newPassword,
}) {
  const cleanId = String(identifier || "").trim().toLowerCase();
  const cleanKey = String(verificationKey || "").trim();
  const cleanPassword = String(newPassword || "").trim();

  if (!cleanId || !cleanKey || !cleanPassword) {
    throw new Error("Please fill in all verification fields and new password.");
  }
  if (cleanPassword.length < 6) {
    throw new Error("New password must be at least 6 characters long.");
  }

  // Find resident by username, email, or phone
  let targetResidentId = null;
  let targetUsername = null;

  // 1. Search in resident_accounts by username
  const { data: accounts } = await supabase
    .from("resident_accounts")
    .select("id, resident_id, username")
    .ilike("username", cleanId);

  if (accounts && accounts.length > 0) {
    targetResidentId = accounts[0].resident_id;
    targetUsername = accounts[0].username;
  }

  // 2. If not found, search in residents table by email, phone, or name
  if (!targetResidentId) {
    const { data: resList } = await supabase
      .from("residents")
      .select("id, full_name, email, phone, birthday, purok")
      .or(`email.ilike.%${cleanId}%,phone.ilike.%${cleanId}%,full_name.ilike.%${cleanId}%`)
      .limit(1);

    if (resList && resList.length > 0) {
      targetResidentId = resList[0].id;
    }
  }

  if (!targetResidentId) {
    throw new Error("No registered resident account found with the provided username, email, or contact.");
  }

  // Verify identity with resident profile data (birthday, phone, or purok)
  const { data: residentProfile, error: profErr } = await supabase
    .from("residents")
    .select("id, full_name, birthday, phone, purok")
    .eq("id", targetResidentId)
    .single();

  if (profErr || !residentProfile) {
    throw new Error("Account found, but resident profile verification failed.");
  }

  const normalizedKey = cleanKey.replace(/\D/g, "");
  const residentPhoneClean = String(residentProfile.phone || "").replace(/\D/g, "");
  const residentBdayClean = String(residentProfile.birthday || "").replace(/\D/g, "");
  const purokMatch = String(residentProfile.purok || "").toLowerCase() === cleanKey.toLowerCase();

  const isMatched =
    (normalizedKey && residentPhoneClean && residentPhoneClean.includes(normalizedKey)) ||
    (normalizedKey && residentBdayClean && residentBdayClean.includes(normalizedKey)) ||
    purokMatch ||
    cleanKey === String(residentProfile.birthday || "").trim();

  if (!isMatched) {
    throw new Error("Verification failed: Birthday or registered contact number does not match official records.");
  }

  // Fetch or resolve account username
  if (!targetUsername) {
    const { data: acc } = await supabase
      .from("resident_accounts")
      .select("username")
      .eq("resident_id", targetResidentId)
      .maybeSingle();

    if (acc?.username) targetUsername = acc.username;
  }

  // Update password via RPC (pgcrypto)
  if (targetUsername) {
    try {
      await supabase.rpc("sync_resident_plain_password", {
        p_username: targetUsername,
        p_password: cleanPassword,
      });
    } catch (syncErr) {
      console.warn("sync_resident_plain_password notice:", syncErr);
    }
  }

  // Fallback update direct table
  try {
    await supabase
      .from("resident_accounts")
      .update({
        plain_password: cleanPassword,
        must_change_credentials: false,
        updated_at: new Date().toISOString(),
      })
      .eq("resident_id", targetResidentId);
  } catch (updErr) {
    console.warn("Direct update error:", updErr);
  }

  return {
    success: true,
    residentName: residentProfile.full_name,
    username: targetUsername || cleanId,
  };
}


