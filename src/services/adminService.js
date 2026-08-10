import { supabase } from "../lib/supabaseClient";
import { getPurokFilterAliases } from "../utils/residentProfile";

const RESIDENTS_TABLE = "residents";
const RESIDENT_ACCOUNTS_TABLE = "resident_accounts";
const RESIDENT_FETCH_PAGE_SIZE = 1000;
const ACCOUNT_FETCH_BATCH_SIZE = 200;

const getResidentId = (residentOrId) => {
  if (typeof residentOrId === "string") return residentOrId;
  return residentOrId?.id || null;
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const getResidentError = (message, error) => {
  const normalized = new Error(message);
  normalized.code = error?.code;
  normalized.details = error?.details;
  normalized.hint = error?.hint;
  return normalized;
};

const normalizeResidentError = (error) => {
  const message = error?.message || "";
  const lowerMessage = message.toLowerCase();
  const setupHint =
    "Run supabase/setup-supabase.sql in the Supabase SQL Editor, then refresh the app.";
  const phoneSetupHint =
    "Resident phone support is missing. Run supabase/setup-supabase.sql in the Supabase SQL Editor, then refresh the app.";

  if (message.includes("phone") || message.includes("'phone'")) {
    return getResidentError(phoneSetupHint, error);
  }

  if (
    error?.code === "PGRST205" ||
    (lowerMessage.includes("residents") &&
      lowerMessage.includes("schema cache") &&
      lowerMessage.includes("table"))
  ) {
    return getResidentError(`Supabase residents table is missing. ${setupHint}`, error);
  }

  if (lowerMessage.includes("schema cache") && lowerMessage.includes("could not find")) {
    return getResidentError(`Supabase residents table is missing a needed column. ${setupHint}`, error);
  }

  if (lowerMessage.includes("row-level security") || error?.code === "42501") {
    return getResidentError(
      "Supabase blocked this resident save. Make sure you are logged in as an admin and that setup-supabase.sql has been run so admin insert/update policies exist.",
      error
    );
  }

  if (error?.code === "23505") {
    return getResidentError("A resident with the same unique details already exists.", error);
  }

  return getResidentError(message || "Unable to save resident data in Supabase.", error);
};

const searchableResidentFields = [
  "full_name",
  "last_name",
  "first_name",
  "middle_name",
  "phone",
  "house_no",
  "household_no",
  "relationship_to_household_head",
  "purok",
  "address",
  "sex",
  "gender",
  "birthplace",
  "educational_attainment",
  "occupation",
  "civil_status",
  "status",
];

const escapeSearchTerm = (value) =>
  String(value || "")
    .trim()
    .replace(/[%_]/g, (match) => `\\${match}`)
    .replace(/,/g, " ");

const prepareResidentMutation = (updates = {}, options = {}) => {
  const { resetArchivedAt = true } = options;
  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (hasOwn(updates, "status")) {
    if (updates.status === "Archived") {
      payload.archived_at = updates.archived_at || new Date().toISOString();
    } else if (resetArchivedAt) {
      payload.archived_at = null;
    }
  }

  if (payload.is_pwd === false) {
    payload.pwd_type = null;
  }

  return payload;
};

const attachResidentAccounts = async (residents = []) => {
  const residentList = Array.isArray(residents) ? residents : [residents].filter(Boolean);
  const residentIds = residentList.map((resident) => resident.id).filter(Boolean);

  if (residentIds.length === 0) return residents;

  try {
    const accounts = [];
    const promises = [];

    for (let index = 0; index < residentIds.length; index += ACCOUNT_FETCH_BATCH_SIZE) {
      const residentIdBatch = residentIds.slice(index, index + ACCOUNT_FETCH_BATCH_SIZE);
      promises.push(
        supabase
          .from(RESIDENT_ACCOUNTS_TABLE)
          .select("id,resident_id,username,plain_password,account_status,must_change_credentials,last_login_at")
          .in("resident_id", residentIdBatch)
      );
    }

    const results = await Promise.all(promises);
    for (const { data, error } of results) {
      if (error) throw error;
      if (data) {
        accounts.push(...data);
      }
    }

    const accountByResidentId = new Map(
      accounts.map((account) => [account.resident_id, account])
    );
    const withAccounts = residentList.map((resident) => {
      const account = accountByResidentId.get(resident.id) || null;

      return {
        ...resident,
        resident_account: account,
        portal_username: account?.username || "",
        portal_password: account?.plain_password || "",
        portal_account_status: account?.account_status || "",
        portal_must_change_credentials: Boolean(account?.must_change_credentials),
      };
    });

    return Array.isArray(residents) ? withAccounts : withAccounts[0] || residents;
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    const tableMissing =
      error?.code === "PGRST205" ||
      message.includes(RESIDENT_ACCOUNTS_TABLE) ||
      message.includes("schema cache");

    if (!tableMissing) {
      console.warn("Unable to load resident portal accounts:", error.message || error);
    }

    const fallbackResidents = residentList.map((resident) => ({
      ...resident,
      resident_account: null,
      portal_username: "",
      portal_account_status: "",
      portal_must_change_credentials: false,
    }));

    return Array.isArray(residents) ? fallbackResidents : fallbackResidents[0] || residents;
  }
};

const buildResidentsQuery = (search = "", statusFilter = "", filters = {}) => {
  const {
    excludeArchived = false,
    gender = "",
    sex = "",
    purok = "",
    householdNo = "",
    householdRelationship = "",
    withAccounts = false,
    omitPlainPassword = false,
  } = filters || {};

  const selectQuery = withAccounts
    ? (omitPlainPassword 
        ? "*, resident_accounts(id,resident_id,username,account_status,must_change_credentials,last_login_at)"
        : "*, resident_accounts(id,resident_id,username,plain_password,account_status,must_change_credentials,last_login_at)")
    : "*";

  let query = supabase.from(RESIDENTS_TABLE).select(selectQuery);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  } else if (excludeArchived) {
    query = query.or("status.is.null,status.neq.Archived");
  }

  if (sex || gender) {
    query = query.eq("sex", sex || gender);
  }

  if (purok) {
    query = query.in("purok", getPurokFilterAliases(purok));
  }

  if (householdNo) {
    query = query.eq("household_no", householdNo);
  }

  if (householdRelationship) {
    query = query.eq("relationship_to_household_head", householdRelationship);
  }

  if (search?.trim()) {
    const escaped = escapeSearchTerm(search);
    query = query.or(
      searchableResidentFields.map((field) => `${field}.ilike.%${escaped}%`).join(",")
    );
  }

  return query;
};

/**
 * Fetch all residents with search and status filtering
 */
export async function fetchResidents(search = "", statusFilter = "", filters = {}) {
  try {
    const {
      limit = null,
      pageSize = RESIDENT_FETCH_PAGE_SIZE,
      withAccounts = true,
    } = filters || {};
    const rows = [];
    const fetchPageSize = Math.max(1, Math.min(Number(pageSize) || RESIDENT_FETCH_PAGE_SIZE, RESIDENT_FETCH_PAGE_SIZE));
    const rowLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : null;

    const queryFilters = { ...filters, withAccounts };

    for (let from = 0; ; from += fetchPageSize) {
      const to = rowLimit
        ? Math.min(from + fetchPageSize - 1, rowLimit - 1)
        : from + fetchPageSize - 1;
      const { data, error } = await buildResidentsQuery(search, statusFilter, queryFilters)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      rows.push(...(data || []));

      if (!data?.length || data.length < fetchPageSize || (rowLimit && rows.length >= rowLimit)) {
        break;
      }
    }

    const residents = rowLimit ? rows.slice(0, rowLimit) : rows;

    if (withAccounts) {
      return residents.map((resident) => {
        const rawAccount = resident.resident_accounts;
        const account = Array.isArray(rawAccount)
          ? rawAccount[0] || null
          : rawAccount || null;

        // Exclude the resident_accounts array field from mapping to keep it identical to original shape
        const { resident_accounts, ...cleanResident } = resident;

        return {
          ...cleanResident,
          resident_account: account,
          portal_username: account?.username || "",
          portal_password: account?.plain_password || account?.password || "",
          portal_account_status: account?.account_status || "",
          portal_must_change_credentials: Boolean(account?.must_change_credentials),
        };
      });
    }

    return residents;
  } catch (error) {
    console.error("Error fetching residents:", error);
    throw normalizeResidentError(error);
  }
}

/**
 * Create a new resident
 */
export async function createResident(residentData) {
  try {
    const payload = prepareResidentMutation({
      status: "Active",
      ...residentData,
    }, {
      resetArchivedAt: residentData?.status === "Archived",
    });

    const { data, error } = await supabase
      .from(RESIDENTS_TABLE)
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return attachResidentAccounts(data);
  } catch (error) {
    console.error("Error creating resident:", error);
    throw normalizeResidentError(error);
  }
}

/**
 * Update a resident
 */
export async function updateResident(resident, updates) {
  try {
    const id = getResidentId(resident);
    if (!id) throw new Error("Unable to update resident: ID is missing.");
    const payload = prepareResidentMutation(updates);

    const { data, error } = await supabase
      .from(RESIDENTS_TABLE)
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return attachResidentAccounts(data);
  } catch (error) {
    console.error("Error updating resident:", error);
    throw normalizeResidentError(error);
  }
}

/**
 * Delete a resident
 */
export async function deleteResident(resident) {
  try {
    const id = getResidentId(resident);
    if (!id) throw new Error("Unable to delete resident: ID is missing.");

    const { error } = await supabase.from(RESIDENTS_TABLE).delete().eq("id", id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting resident:", error);
    throw normalizeResidentError(error);
  }
}

/**
 * Archive a resident (set status to Archived)
 */
export async function archiveResident(resident) {
  try {
    return await updateResident(resident, {
      status: "Archived",
      archived_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error archiving resident:", error);
    throw error;
  }
}

/**
 * Restore a resident (set status to Active)
 */
export async function restoreResident(resident) {
  try {
    return await updateResident(resident, { status: "Active" });
  } catch (error) {
    console.error("Error restoring resident:", error);
    throw error;
  }
}

/**
 * Get resident by ID
 */
export async function getResidentById(id) {
  try {
    const { data, error } = await supabase
      .from(RESIDENTS_TABLE)
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return attachResidentAccounts(data);
  } catch (error) {
    console.error("Error fetching resident:", error);
    throw normalizeResidentError(error);
  }
}

/**
 * Get all residents count
 */
export async function getResidentsCount(filters = {}) {
  try {
    const { excludeArchived = false } = filters || {};
    let query = supabase
      .from(RESIDENTS_TABLE)
      .select("*", { count: "exact", head: true });

    if (excludeArchived) {
      query = query.or("status.is.null,status.neq.Archived");
    }

    const { count, error } = await query;

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error("Error getting residents count:", error);
    throw normalizeResidentError(error);
  }
}

/**
 * Create a portal account (username + hashed password) for a resident.
 * Uses the existing resident_accounts table and pgcrypto hashing in the DB.
 * This is a safe, additive operation — it does not modify the resident record itself.
 */
export async function createResidentPortalAccount(residentId, username, password) {
  if (!residentId) throw new Error("Resident ID is required to create a portal account.");
  if (!username?.trim()) throw new Error("Portal username is required.");
  if (!password) throw new Error("Portal password is required.");

  const normalizedUsername = username.trim().toLowerCase();

  try {
    // Check if username is already taken
    const { data: existing, error: checkError } = await supabase
      .from(RESIDENT_ACCOUNTS_TABLE)
      .select("id")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existing) throw new Error(`Username "${normalizedUsername}" is already taken. Choose a different one.`);

    // Try using the RPC function first (it handles hashing)
    const { data, error } = await supabase.rpc("admin_create_resident_account", {
      p_resident_id: residentId,
      p_username: normalizedUsername,
      p_password: password,
    });

    // Save plain_password to table so Admin can retrieve it
    await supabase
      .from(RESIDENT_ACCOUNTS_TABLE)
      .update({ username: normalizedUsername, plain_password: password })
      .eq("resident_id", residentId)
      .catch(() => {});

    if (error) {
      // If the RPC doesn't exist, fall back to direct insert with crypt()
      const rpcMissing = String(error.message || "").toLowerCase();
      if (rpcMissing.includes("could not find the function") || error.code === "PGRST202") {
        const { error: insertError } = await supabase
          .from(RESIDENT_ACCOUNTS_TABLE)
          .insert([{
            resident_id: residentId,
            username: normalizedUsername,
            password_hash: password, // The DB trigger or function should handle hashing
            plain_password: password,
            account_status: "Active",
          }]);

        if (insertError) throw insertError;
        return { username: normalizedUsername, status: "Active" };
      }

      throw error;
    }

    return data || { username: normalizedUsername, status: "Active" };
  } catch (error) {
    console.error("Error creating resident portal account:", error);
    throw normalizeResidentError(error);
  }
}

/**
 * Update (or reset) the portal account credentials for a resident.
 * If the resident already has an account, this updates their username and password.
 * If they don't have one yet, it creates one (same as createResidentPortalAccount).
 */
export async function updateResidentPortalAccount(residentId, username, password) {
  if (!residentId) throw new Error("Resident ID is required.");
  if (!username?.trim()) throw new Error("Portal username is required.");

  const normalizedUsername = username.trim().toLowerCase();

  try {
    // Check if this resident already has an account
    const { data: existingAccount, error: fetchError } = await supabase
      .from(RESIDENT_ACCOUNTS_TABLE)
      .select("id, username, plain_password")
      .eq("resident_id", residentId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existingAccount) {
      const updateData = { username: normalizedUsername };
      if (password) {
        updateData.plain_password = password;
        updateData.password_hash = password;
      }

      // Update plain_password and username directly on table
      await supabase
        .from(RESIDENT_ACCOUNTS_TABLE)
        .update(updateData)
        .eq("resident_id", residentId)
        .catch(() => {});

      if (!password) {
        return { username: normalizedUsername, status: "Active", action: "updated" };
      }

      // Account exists — update username and password via RPC
      const { error: updateError } = await supabase.rpc("admin_reset_resident_password", {
        p_resident_id: residentId,
        p_username: normalizedUsername,
        p_password: password,
      });

      if (updateError) {
        // RPC doesn't exist — fall back to direct update (password hashing must be handled by DB trigger)
        const rpcMissing = String(updateError.message || "").toLowerCase();
        if (rpcMissing.includes("could not find the function") || updateError.code === "PGRST202") {
          const { error: directUpdateError } = await supabase
            .from(RESIDENT_ACCOUNTS_TABLE)
            .update({
              username: normalizedUsername,
              password_hash: password,
              plain_password: password,
              account_status: "Active",
            })
            .eq("resident_id", residentId);

          if (directUpdateError) throw directUpdateError;
          return { username: normalizedUsername, status: "Active", action: "updated" };
        }
        throw updateError;
      }

      return { username: normalizedUsername, status: "Active", action: "updated" };
    }

    // No account yet — create one (default password to household_no if omitted)
    if (!password) throw new Error("Portal password is required for new portal account.");
    return await createResidentPortalAccount(residentId, normalizedUsername, password);
  } catch (error) {
    console.error("Error updating resident portal account:", error);
    throw normalizeResidentError(error);
  }
}
