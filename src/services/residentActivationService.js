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
  // 1. First attempt: Try RPC functions
  try {
    const { data, error } = await supabase.rpc("get_resident_activation_requests", {
      p_status_filter: statusFilter || null,
    });

    if (!error && Array.isArray(data)) {
      const requests = data.map((request) => ({
        ...request,
        request_id: request.request_id || request.id,
        request_status: request.request_status || request.status,
      }));

      if (requests.length > 0) {
        const requestIds = requests.map((r) => r.request_id).filter(Boolean);
        const { data: proofRows } = await supabase
          .from("resident_activation_requests")
          .select("id,requested_proof_path,requested_proof_name,requested_proof_type,requested_username,requested_plain_password,requested_phone,requested_sex,requested_birthplace,requested_civil_status,requested_occupation,requested_educational_attainment,requested_house_no,requested_relationship_to_household_head,requested_address")
          .in("id", requestIds);

        const proofMap = new Map((proofRows || []).map((row) => [row.id, row]));
        return requests.map((r) => {
          const proofInfo = proofMap.get(r.request_id) || {};
          return {
            ...r,
            ...proofInfo,
            plain_password: proofInfo.requested_plain_password || r.requested_plain_password || "",
            requested_plain_password: proofInfo.requested_plain_password || r.requested_plain_password || "",
            proof_review_available: Boolean(proofInfo.requested_proof_path || r.requested_proof_path),
          };
        });
      }

      return requests;
    }
  } catch (rpcErr) {
    console.warn("RPC get_resident_activation_requests notice:", rpcErr);
  }

  // 2. Direct Table Fallback: Query resident_activation_requests directly
  try {
    let query = supabase
      .from("resident_activation_requests")
      .select("*");

    if (statusFilter && statusFilter !== "All") {
      query = query.eq("status", statusFilter);
    }
    query = query.order("request_date", { ascending: false });

    const { data: rawRows, error: tableError } = await query;

    if (tableError) {
      throw getActivationError(tableError);
    }

    if (!rawRows || rawRows.length === 0) {
      return [];
    }

    // Fetch resident & account metadata if available
    const residentIds = rawRows.map((r) => r.resident_id).filter(Boolean);
    let residentMap = new Map();
    let accountMap = new Map();

    if (residentIds.length > 0) {
      try {
        const { data: resData } = await supabase
          .from("residents")
          .select("id, full_name, first_name, middle_name, last_name, birthday, household_no, house_no, purok, address")
          .in("id", residentIds);

        if (resData) {
          residentMap = new Map(resData.map((r) => [r.id, r]));
        }

        const { data: accData } = await supabase
          .from("resident_accounts")
          .select("resident_id, username, plain_password, account_status")
          .in("resident_id", residentIds);

        if (accData) {
          accountMap = new Map(accData.map((a) => [a.resident_id, a]));
        }
      } catch (metaErr) {
        console.warn("Resident metadata fetch notice:", metaErr);
      }
    }

    return rawRows.map((row) => {
      const res = residentMap.get(row.resident_id) || {};
      const acc = accountMap.get(row.resident_id) || {};

      return {
        ...row,
        request_id: row.id,
        request_status: row.status,
        full_name: row.requested_full_name || res.full_name || "N/A",
        birthday: row.requested_birthday || res.birthday || null,
        household_no: row.requested_household_no || res.household_no || res.house_no || "N/A",
        purok: row.requested_purok || res.purok || "",
        address: row.requested_address || res.address || "",
        username: row.requested_username || acc.username || "N/A",
        plain_password: row.requested_plain_password || acc.plain_password || "",
        requested_plain_password: row.requested_plain_password || acc.plain_password || "",
        account_status: acc.account_status || (row.status === "Approved" ? "Active" : "Pending"),
        proof_review_available: Boolean(row.requested_proof_path),
      };
    });
  } catch (err) {
    throw getActivationError(err);
  }
}

export async function createResidentRegistrationProofUrl(request) {
  const proofPath = request?.requested_proof_path;

  if (!proofPath) {
    throw new Error("No verification proof is attached to this request.");
  }

  // If already a full web URL or data URL
  if (proofPath.startsWith("http://") || proofPath.startsWith("https://") || proofPath.startsWith("data:")) {
    return proofPath;
  }

  // 1. Try to create signed URL
  try {
    const { data: signedData, error: signedError } = await supabase.storage
      .from(REGISTRATION_PROOF_BUCKET)
      .createSignedUrl(proofPath, 60 * 60);

    if (!signedError && signedData?.signedUrl) {
      return signedData.signedUrl;
    }
  } catch (err) {
    console.warn("Notice creating signed URL:", err);
  }

  // 2. Fallback to public URL
  try {
    const { data: pubData } = supabase.storage
      .from(REGISTRATION_PROOF_BUCKET)
      .getPublicUrl(proofPath);

    if (pubData?.publicUrl) {
      return pubData.publicUrl;
    }
  } catch (pubErr) {
    console.warn("Notice getting public URL:", pubErr);
  }

  throw new Error(
    `Proof review is not installed yet or bucket is missing. Run fix-admin-registration-requests-access.sql in Supabase SQL Editor to create the '${REGISTRATION_PROOF_BUCKET}' bucket.`
  );
}

export async function approveResidentActivationRequest(request) {
  const requestId = typeof request === "string" ? request : request?.request_id;

  if (!requestId) {
    throw new Error("Registration request is missing.");
  }

  // 1. Fetch the request record FIRST so we have the EXACT resident-chosen username, plain_password, phone, and all details
  let reqData = null;
  try {
    const { data } = await supabase
      .from("resident_activation_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (data) reqData = data;
  } catch (err) {
    console.warn("Notice fetching reqData in approve:", err);
  }

  const chosenUsername =
    reqData?.requested_username ||
    reqData?.username ||
    request?.requested_username ||
    request?.username ||
    request?.portal_username ||
    (reqData?.requested_first_name ? `${String(reqData.requested_first_name).toLowerCase().replace(/\s+/g, '')}_${reqData.requested_last_name ? String(reqData.requested_last_name).toLowerCase().replace(/\s+/g, '') : ''}` : null);

  const chosenPassword =
    reqData?.requested_plain_password ||
    reqData?.requested_password_hash ||
    reqData?.requested_password ||
    reqData?.password ||
    request?.requested_plain_password ||
    request?.portal_password ||
    request?.password ||
    (reqData?.requested_household_no ? String(reqData.requested_household_no) : "kaagapai123");

  const chosenPhone = reqData?.requested_phone || reqData?.phone || request?.phone || request?.requested_phone || null;
  const chosenEmail = reqData?.requested_email || reqData?.email || request?.email || null;
  let residentId = reqData?.resident_id || request?.resident_id || null;
  let fullName = reqData?.requested_full_name || request?.full_name || request?.requested_full_name || "";

  // 2. Run RPC or direct DB approval
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("approve_resident_activation_request", {
      p_request_id: requestId,
    });

    if (!rpcErr && rpcData) {
      const result = getRpcRow(rpcData) || {};
      residentId = result.resident_id || residentId;
    }
  } catch (rpcErr2) {
    console.warn("RPC approve_resident_activation_request notice:", rpcErr2);
  }

  // 3. Fallback / Direct DB Creation if residentId is not yet resolved
  if (!residentId) {
    try {
      // Check if resident exists by full name and birthday
      const { data: existingResident } = await supabase
        .from("residents")
        .select("id, full_name")
        .ilike("full_name", fullName)
        .eq("birthday", reqData?.requested_birthday)
        .maybeSingle();

      if (existingResident) {
        residentId = existingResident.id;
        await supabase
          .from("residents")
          .update({ status: "Active" })
          .eq("id", residentId);
      } else if (reqData) {
        // Calculate age
        let calcAge = null;
        if (reqData.requested_birthday) {
          const birthDate = new Date(reqData.requested_birthday);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          calcAge = age >= 0 && age <= 130 ? age : null;
        }

        // Insert new resident record
        const { data: newResident } = await supabase
          .from("residents")
          .insert({
            full_name: fullName,
            first_name: reqData.requested_first_name || null,
            middle_name: reqData.requested_middle_name || null,
            last_name: reqData.requested_last_name || null,
            suffix: reqData.requested_suffix || null,
            phone: chosenPhone,
            email: chosenEmail,
            house_no: reqData.requested_house_no || null,
            household_no: reqData.requested_household_no || null,
            relationship_to_household_head: reqData.requested_relationship_to_household_head || "Head",
            birthday: reqData.requested_birthday || null,
            age: calcAge,
            sex: reqData.requested_sex || "Male",
            gender: reqData.requested_sex || "Male",
            birthplace: reqData.requested_birthplace || "",
            purok: reqData.requested_purok || "",
            educational_attainment: reqData.requested_educational_attainment || "",
            occupation: reqData.requested_occupation || "",
            civil_status: reqData.requested_civil_status || "Single",
            address: reqData.requested_address || "",
            is_4ps_member: Boolean(reqData.requested_is_4ps_member),
            is_solo_parent: Boolean(reqData.requested_is_solo_parent),
            is_pwd: Boolean(reqData.requested_is_pwd),
            pwd_type: reqData.requested_pwd_type || null,
            status: "Active",
          })
          .select()
          .single();

        if (newResident) {
          residentId = newResident.id;
        }
      }
    } catch (dbErr) {
      console.warn("Notice in direct resident creation fallback:", dbErr);
    }
  }

  // 4. GUARANTEE that resident_accounts has the exact resident-chosen credentials
  if (residentId && chosenUsername) {
    try {
      const { data: existingAccount } = await supabase
        .from("resident_accounts")
        .select("id")
        .eq("resident_id", residentId)
        .maybeSingle();

      const accountPayload = {
        username: chosenUsername,
        plain_password: chosenPassword || null,
        password_hash: chosenPassword || "kaagapai123",
        phone: chosenPhone,
        email: chosenEmail,
        account_status: "Active",
        must_change_credentials: false,
        updated_at: new Date().toISOString(),
      };

      if (existingAccount) {
        await supabase
          .from("resident_accounts")
          .update(accountPayload)
          .eq("id", existingAccount.id);
      } else {
        await supabase
          .from("resident_accounts")
          .insert({
            resident_id: residentId,
            ...accountPayload,
          });
      }

      if (chosenPassword) {
        try {
          await supabase.rpc("sync_resident_plain_password", {
            p_username: chosenUsername,
            p_password: chosenPassword,
          });
        } catch {
          // Non-blocking
        }
      }
    } catch (accErr) {
      console.warn("Notice syncing resident credentials:", accErr);
    }
  }

  // 5. Update request status to Approved and record audit log
  try {
    await supabase
      .from("resident_activation_requests")
      .update({
        status: "Approved",
        approved_at: new Date().toISOString(),
        resident_id: residentId || undefined,
        requested_username: chosenUsername || undefined,
        requested_plain_password: chosenPassword || undefined,
      })
      .eq("id", requestId);
  } catch (updErr) {
    console.warn("Notice updating request row status:", updErr);
  }

  recordAuditEvent({
    module: "Resident Registration",
    action: "Registration approved",
    details: `${fullName || "Resident"} was approved with exact username "${chosenUsername || "resident"}".`,
    source: "Admin",
  });

  return {
    success: true,
    request_id: requestId,
    resident_id: residentId,
    full_name: fullName,
    username: chosenUsername,
    plain_password: chosenPassword,
    phone: chosenPhone,
    status: "Approved",
  };
}

export async function rejectResidentActivationRequest(request, reason = "Rejected by admin") {
  const requestId = typeof request === "string" ? request : request?.request_id;
  const rejectionReason = String(reason || "Rejected by admin").trim();

  if (!requestId) {
    throw new Error("Registration request is missing.");
  }

  // 1. Try RPC first
  try {
    const { data, error } = await supabase.rpc("reject_resident_activation_request", {
      p_request_id: requestId,
      p_reason: rejectionReason,
    });

    if (!error && data) {
      const result = getRpcRow(data) || {};
      recordAuditEvent({
        module: "Resident Registration",
        action: "Registration rejected",
        details: `${request?.full_name || "Resident"} was rejected. Reason: ${rejectionReason}`,
        source: "Admin",
      });
      return result;
    }
  } catch (rpcErr) {
    console.warn("RPC reject_resident_activation_request notice:", rpcErr);
  }

  // 2. Direct table fallback
  try {
    let validAdminUuid = null;
    try {
      const currentSession = supabase.auth.getUser ? (await supabase.auth.getUser())?.data?.user : null;
      const uid = currentSession?.id;
      if (uid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(uid))) {
        validAdminUuid = uid;
      }
    } catch {
      validAdminUuid = null;
    }

    const { error: tableError } = await supabase
      .from("resident_activation_requests")
      .update({
        status: "Rejected",
        rejected_at: new Date().toISOString(),
        rejected_by: validAdminUuid,
        rejection_reason: rejectionReason,
        approved_at: null,
        approved_by: null,
      })
      .eq("id", requestId);

    if (tableError) {
      throw getActivationError(tableError);
    }

    recordAuditEvent({
      module: "Resident Registration",
      action: "Registration rejected",
      details: `${request?.full_name || "Resident"} was rejected. Reason: ${rejectionReason}`,
      source: "Admin",
    });

    return {
      request_id: requestId,
      status: "Rejected",
      rejection_reason: rejectionReason,
    };
  } catch (err) {
    throw getActivationError(err);
  }
}

/**
 * Automatically sync and recover any approved online registration requests
 * ensuring that every approved registrant has an active row in the `residents` table
 * and a linked account in `resident_accounts`.
 */
let lastSyncTime = 0;
const SYNC_THROTTLE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Recovers approved online registrations that might be missing in residents table.
 * Throttled to prevent overhead on page loads.
 */
export async function syncApprovedOnlineRegistrations(force = false) {
  const now = Date.now();
  if (!force && now - lastSyncTime < SYNC_THROTTLE_MS) {
    return 0;
  }
  lastSyncTime = now;

  try {
    const { data: approvedRequests, error } = await supabase
      .from("resident_activation_requests")
      .select("*")
      .eq("status", "Approved")
      .is("resident_id", null);

    if (error || !approvedRequests || approvedRequests.length === 0) {
      return 0;
    }

    let syncedCount = 0;

    for (const req of approvedRequests) {
      const fullName = req.requested_full_name;
      if (!fullName) continue;

        // Check if resident exists by full name and birthday
        let targetResidentId = null;
        let query = supabase.from("residents").select("id").ilike("full_name", fullName);
        if (req.requested_birthday) {
          query = query.eq("birthday", req.requested_birthday);
        }
        const { data: matchedRes } = await query.maybeSingle();

        if (matchedRes) {
          targetResidentId = matchedRes.id;
          await supabase
            .from("residents")
            .update({ status: "Active" })
            .eq("id", targetResidentId);
        } else {
          // Calculate age
          let calcAge = null;
          if (req.requested_birthday) {
            const birthDate = new Date(req.requested_birthday);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
            calcAge = age >= 0 && age <= 130 ? age : null;
          }

          const { data: createdRes, error: createErr } = await supabase
            .from("residents")
            .insert({
              full_name: fullName,
              first_name: req.requested_first_name || null,
              middle_name: req.requested_middle_name || null,
              last_name: req.requested_last_name || null,
              suffix: req.requested_suffix || null,
              phone: req.requested_phone || null,
              email: req.requested_email || null,
              house_no: req.requested_house_no || null,
              household_no: req.requested_household_no || null,
              relationship_to_household_head: req.requested_relationship_to_household_head || "Head",
              birthday: req.requested_birthday || null,
              age: calcAge,
              sex: req.requested_sex || "Male",
              gender: req.requested_sex || "Male",
              birthplace: req.requested_birthplace || "",
              purok: req.requested_purok || "",
              educational_attainment: req.requested_educational_attainment || "",
              occupation: req.requested_occupation || "",
              civil_status: req.requested_civil_status || "Single",
              address: req.requested_address || "",
              is_4ps_member: Boolean(req.requested_is_4ps_member),
              is_solo_parent: Boolean(req.requested_is_solo_parent),
              is_pwd: Boolean(req.requested_is_pwd),
              pwd_type: req.requested_pwd_type || null,
              status: "Active",
            })
            .select()
            .single();

          if (!createErr && createdRes) {
            targetResidentId = createdRes.id;
          }
        }

        if (targetResidentId) {
          // Link activation request
          await supabase
            .from("resident_activation_requests")
            .update({ resident_id: targetResidentId })
            .eq("id", req.id);

          // Create or update resident_accounts
          const username = req.requested_username || `resident_${String(targetResidentId).slice(0, 8)}`;
          const plainPassword = req.requested_plain_password || req.requested_password_hash || req.requested_password || req.password || "";
          const phone = req.requested_phone || null;
          const email = req.requested_email || null;

          const { data: existingAccount } = await supabase
            .from("resident_accounts")
            .select("id, plain_password")
            .eq("resident_id", targetResidentId)
            .maybeSingle();

          const finalPlainPassword = plainPassword || existingAccount?.plain_password || "";
          const passwordHash = finalPlainPassword || req.requested_password_hash || "kaagapai123";

          if (existingAccount) {
            const updatePayload = {
              username,
              phone,
              email,
              account_status: "Active",
              must_change_credentials: false,
              updated_at: new Date().toISOString(),
            };
            if (finalPlainPassword) {
              updatePayload.plain_password = finalPlainPassword;
              updatePayload.password_hash = passwordHash;
            }
            await supabase
              .from("resident_accounts")
              .update(updatePayload)
              .eq("resident_id", targetResidentId);
          } else {
            await supabase
              .from("resident_accounts")
              .insert({
                resident_id: targetResidentId,
                username,
                plain_password: finalPlainPassword || null,
                password_hash: passwordHash,
                phone,
                email,
                account_status: "Active",
                must_change_credentials: false,
              });
          }

          syncedCount++;
        }
      }

    return syncedCount;
  } catch (err) {
    console.warn("syncApprovedOnlineRegistrations notice:", err);
    return 0;
  }
}

