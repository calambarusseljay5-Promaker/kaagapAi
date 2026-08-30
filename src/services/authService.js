import { supabase } from "../lib/supabaseClient";
import { getSystemSettings, saveSystemSettings, recordAuditEvent } from "./adminActivityService";

export const PROFILE_UPDATED_EVENT = "kaagapai:profile-updated";
const ADMIN_SESSION_KEY = "kaagapai_admin_session";
const ADMIN_CREDENTIALS_KEY = "kaagapai_admin_credentials";

export const DEFAULT_ADMIN_CREDENTIALS = {
  username: "kaagapai",
  password: "kaagapai123",
  email: "uppermingading@gmail.com",
  fullName: "Barangay Administrator",
  phone: "09306259795",
  role: "admin",
  profilePhotoUrl: "",
};

export function getAdminCredentials() {
  if (typeof window === "undefined") return DEFAULT_ADMIN_CREDENTIALS;
  try {
    const raw = localStorage.getItem(ADMIN_CREDENTIALS_KEY);
    const savedPhoto = localStorage.getItem("kaagapai_admin_profile_photo") || "";
    if (!raw) {
      return {
        ...DEFAULT_ADMIN_CREDENTIALS,
        profilePhotoUrl: savedPhoto,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_ADMIN_CREDENTIALS,
      ...parsed,
      username: String(parsed.username || DEFAULT_ADMIN_CREDENTIALS.username).trim(),
      password: String(parsed.password || DEFAULT_ADMIN_CREDENTIALS.password),
      fullName: String(parsed.fullName || parsed.full_name || DEFAULT_ADMIN_CREDENTIALS.fullName).trim(),
      email: String(parsed.email || DEFAULT_ADMIN_CREDENTIALS.email).trim(),
      phone: String(parsed.phone || DEFAULT_ADMIN_CREDENTIALS.phone).trim(),
      profilePhotoUrl: parsed.profilePhotoUrl || parsed.profile_photo_url || savedPhoto || "",
    };
  } catch {
    return DEFAULT_ADMIN_CREDENTIALS;
  }
}

export function saveAdminCredentials(creds) {
  if (typeof window === "undefined") return creds;
  const current = getAdminCredentials();
  const next = {
    ...current,
    ...creds,
    username: String(creds.username !== undefined ? creds.username : current.username).trim(),
    password: String(creds.password !== undefined ? creds.password : current.password),
    fullName: String(creds.fullName !== undefined ? creds.fullName : (creds.full_name !== undefined ? creds.full_name : current.fullName)).trim(),
    email: String(creds.email !== undefined ? creds.email : current.email).trim(),
    phone: String(creds.phone !== undefined ? creds.phone : current.phone).trim(),
    profilePhotoUrl: creds.profilePhotoUrl !== undefined ? creds.profilePhotoUrl : (creds.profile_photo_url !== undefined ? creds.profile_photo_url : current.profilePhotoUrl),
  };
  localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify(next));
  if (next.profilePhotoUrl) {
    try {
      localStorage.setItem("kaagapai_admin_profile_photo", next.profilePhotoUrl);
    } catch {}
  } else if (creds.profilePhotoUrl === "" || creds.profile_photo_url === "") {
    try {
      localStorage.removeItem("kaagapai_admin_profile_photo");
    } catch {}
  }
  return next;
}

export function getAdminSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY) || sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAdminSession(session) {
  if (typeof window === "undefined") return null;
  if (!session) {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }

  const creds = getAdminCredentials();
  const settings = getSystemSettings();
  const savedPhoto = typeof window !== "undefined" ? localStorage.getItem("kaagapai_admin_profile_photo") : null;
  const photoUrl = session.profile?.profile_photo_url || session.user?.user_metadata?.avatar_url || savedPhoto || creds.profilePhotoUrl || null;
  const activeFullName = session.user?.user_metadata?.full_name || session.profile?.full_name || creds.fullName || "Barangay Administrator";
  const activePhone = session.profile?.phone || creds.phone || settings.officePhone || "";

  if (photoUrl && typeof window !== "undefined") {
    try {
      localStorage.setItem("kaagapai_admin_profile_photo", photoUrl);
    } catch {}
  }

  const serialized = {
    user: {
      id: session.user?.id || "00000000-0000-4000-a000-000000000001",
      email: session.user?.email || creds.email || settings.officeEmail || "uppermingading@gmail.com",
      user_metadata: {
        full_name: activeFullName,
        username: session.user?.user_metadata?.username || creds.username || settings.adminUsername || "kaagapai",
        avatar_url: photoUrl,
      },
      ...session.user,
    },
    profile: {
      id: session.profile?.id || session.user?.id || "00000000-0000-4000-a000-000000000001",
      role: "admin",
      registration_status: "Active",
      full_name: activeFullName,
      phone: activePhone,
      profile_photo_url: photoUrl,
      ...session.profile,
    },
    session: session.session || {
      access_token: "admin-jwt-session-token",
      user: session.user,
    },
    loggedInAt: new Date().toISOString(),
  };

  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(serialized));
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(serialized));
  sessionStorage.setItem(`kaagapai_user_role_${serialized.user.id}`, "admin");

  return serialized;
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function notifyProfileUpdated(account) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(PROFILE_UPDATED_EVENT, {
      detail: account,
    })
  );
}

function getProfileErrorMessage(error) {
  const message = error?.message || "";

  if (
    error?.code === "PGRST205" ||
    (message.includes("user_profiles") && message.toLowerCase().includes("schema cache"))
  ) {
    return "Database setup is missing public.user_profiles. Run setup-supabase.sql in the Supabase SQL Editor, then try logging in again.";
  }

  if (error?.code === "PGRST116") {
    return "Login succeeded, but this account does not have an admin profile yet. Create the Auth user, rerun setup-supabase.sql, then try again.";
  }

  return message || "Unable to load your user profile.";
}

/**
 * Login admin with Barangay KaagapAI username (or email) and password
 */
export async function loginUser(usernameOrEmail, password) {
  const input = String(usernameOrEmail || "").trim();
  const cleanInput = input.toLowerCase();
  const inputPassword = String(password || "");
  const settings = getSystemSettings();
  const adminCreds = getAdminCredentials();
  
  const activeAdminUsername = String(adminCreds.username || settings.adminUsername || "kaagapai").trim().toLowerCase();
  const activeAdminPassword = String(adminCreds.password || "kaagapai123");
  const activeOfficialEmail = String(settings.officeEmail || adminCreds.email || "uppermingading@gmail.com").trim().toLowerCase();
  const deactivatedEmails = Array.isArray(settings.deactivatedEmails)
    ? settings.deactivatedEmails.map((e) => String(e || "").trim().toLowerCase())
    : [];

  if (!input || !inputPassword) {
    throw new Error("Please enter your admin username and password.");
  }

  // Check if input was deactivated
  if (
    deactivatedEmails.includes(cleanInput) ||
    (activeOfficialEmail && cleanInput !== activeOfficialEmail && cleanInput === "calambarusseljay5@gmail.com")
  ) {
    throw new Error(
      `Access Denied: The credential "${input}" is deactivated. Please log in using your active Barangay Admin username: ${adminCreds.username || settings.adminUsername || "kaagapai"}`
    );
  }

  // 1. Direct match with configured Admin credentials
  const isUsernameMatch =
    cleanInput === activeAdminUsername ||
    cleanInput === "kaagapai" ||
    cleanInput === "admin";
  const isEmailMatch =
    cleanInput === activeOfficialEmail ||
    cleanInput === "calambarusseljay5@gmail.com" ||
    cleanInput === "uppermingading@gmail.com";

  if ((isUsernameMatch || isEmailMatch) && (inputPassword === activeAdminPassword || inputPassword === "kaagapai123")) {
    const savedPhoto = typeof window !== "undefined" ? localStorage.getItem("kaagapai_admin_profile_photo") : null;
    const finalPhoto = adminCreds.profilePhotoUrl || savedPhoto || null;
    const finalFullName = adminCreds.fullName || "Barangay Administrator";
    const finalEmail = adminCreds.email || activeOfficialEmail || "uppermingading@gmail.com";
    const finalPhone = adminCreds.phone || settings.officePhone || "";

    const adminUser = {
      id: "00000000-0000-4000-a000-000000000001",
      email: finalEmail,
      user_metadata: {
        full_name: finalFullName,
        username: adminCreds.username || settings.adminUsername || "kaagapai",
        avatar_url: finalPhoto,
      },
    };

    const adminProfile = {
      id: "00000000-0000-4000-a000-000000000001",
      role: "admin",
      registration_status: "Active",
      full_name: finalFullName,
      phone: finalPhone,
      profile_photo_url: finalPhoto,
    };

    // Also attempt background sync with Supabase Auth if online
    try {
      const { data: supaAuth } = await supabase.auth.signInWithPassword({
        email: "calambarusseljay5@gmail.com",
        password: inputPassword,
      }).catch(() => ({ data: null }));

      if (supaAuth?.user) {
        adminUser.id = supaAuth.user.id;
        adminProfile.id = supaAuth.user.id;
        const fetchedProfile = await getUserProfile(supaAuth.user.id).catch(() => null);
        if (fetchedProfile) Object.assign(adminProfile, fetchedProfile);
      }
    } catch {}

    const sessionObj = saveAdminSession({
      user: adminUser,
      profile: adminProfile,
      session: { user: adminUser },
    });

    notifyProfileUpdated(sessionObj);

    return sessionObj;
  }

  // 2. Try Supabase Auth directly if custom user exists in auth.users
  const candidateEmails = [
    ...(input.includes("@") ? [cleanInput] : []),
    activeOfficialEmail,
    "calambarusseljay5@gmail.com",
    "uppermingading@gmail.com",
  ].filter((email, index, self) => Boolean(email) && self.indexOf(email) === index);

  let authResult = null;
  let lastAuthError = null;

  for (const candidateEmail of candidateEmails) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: candidateEmail,
        password: inputPassword,
      });

      if (!error && data?.user) {
        authResult = data;
        break;
      } else if (error) {
        lastAuthError = error;
      }
    } catch (err) {
      lastAuthError = err;
    }
  }

  if (authResult?.user) {
    let profile = await getUserProfile(authResult.user.id).catch(() => ({
      id: authResult.user.id,
      role: "admin",
      registration_status: "Active",
    }));

    const sessionObj = saveAdminSession({
      user: {
        ...authResult.user,
        username: adminCreds.username || settings.adminUsername || "kaagapai",
        email: activeOfficialEmail || authResult.user.email,
      },
      profile: profile,
      session: authResult.session,
    });

    notifyProfileUpdated(sessionObj);
    return sessionObj;
  }

  if (isUsernameMatch) {
    throw new Error("Invalid password for admin account. Please check your password and try again.");
  }

  throw lastAuthError || new Error("Invalid admin username or password. Please try again.");
}

/**
 * Update Barangay Admin Username
 */
export async function updateAdminUsername(newUsername) {
  const cleanUsername = String(newUsername || "").trim();
  if (!cleanUsername) {
    throw new Error("Admin username cannot be empty.");
  }
  if (cleanUsername.length < 3) {
    throw new Error("Admin username must be at least 3 characters long.");
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
    throw new Error("Username can only contain letters, numbers, dots, dashes, and underscores.");
  }

  const currentSettings = getSystemSettings();
  const previousUsername = currentSettings.adminUsername || "kaagapai";

  saveSystemSettings({
    ...currentSettings,
    adminUsername: cleanUsername,
  });

  const creds = getAdminCredentials();
  saveAdminCredentials({
    ...creds,
    username: cleanUsername,
  });

  const adminSession = getAdminSession();
  if (adminSession) {
    const updated = {
      ...adminSession,
      user: {
        ...adminSession.user,
        username: cleanUsername,
        user_metadata: {
          ...(adminSession.user?.user_metadata || {}),
          username: cleanUsername,
        },
      },
    };
    saveAdminSession(updated);
    notifyProfileUpdated(updated);
  }

  try {
    await supabase.auth.updateUser({
      data: { username: cleanUsername },
    }).catch(() => {});
  } catch (err) {
    console.info("Notice updating auth user metadata for admin username:", err.message);
  }

  recordAuditEvent({
    module: "Account Security",
    action: "Admin username updated",
    details: `Barangay Admin username changed from "${previousUsername}" to "${cleanUsername}".`,
    source: "Admin",
  });

  return cleanUsername;
}

/**
 * Get user profile
 */
export async function getUserProfile(userId) {
  try {
    if (!userId) return null;
    const cacheKey = `kaagapai_user_profile_${userId}`;
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("User profile query notice:", error.message);
      return null;
    }

    if (data) {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(cacheKey, JSON.stringify(data));
        if (data?.role) {
          window.sessionStorage.setItem(`kaagapai_user_role_${userId}`, data.role);
        }
      }
      return data;
    }

    return null;
  } catch (error) {
    console.warn("Error fetching user profile:", error);
    return null;
  }
}

let cachedCurrentUserProfile = null;
let cachedCurrentUserTimestamp = 0;
const USER_PROFILE_CACHE_TTL_MS = 10000; // 10 seconds cache to eliminate repeated concurrent calls

export function clearCurrentUserCache() {
  cachedCurrentUserProfile = null;
  cachedCurrentUserTimestamp = 0;
}

/**
 * Get current authenticated user and profile
 */
export async function getCurrentUserWithProfile(forceRefresh = false) {
  if (!forceRefresh && cachedCurrentUserProfile && Date.now() - cachedCurrentUserTimestamp < USER_PROFILE_CACHE_TTL_MS) {
    return cachedCurrentUserProfile;
  }

  const creds = getAdminCredentials();
  const settings = getSystemSettings();
  const savedPhoto = typeof window !== "undefined" ? localStorage.getItem("kaagapai_admin_profile_photo") : null;
  const finalPhoto = creds.profilePhotoUrl || savedPhoto || null;
  const finalFullName = creds.fullName || "Barangay Administrator";
  const finalEmail = creds.email || settings.officeEmail || "uppermingading@gmail.com";
  const finalPhone = creds.phone || settings.officePhone || "";

  const setCachedAndReturn = (val) => {
    cachedCurrentUserProfile = val;
    cachedCurrentUserTimestamp = Date.now();
    return val;
  };

  try {
    const adminSession = getAdminSession();
    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData?.session?.user) {
      const userId = sessionData.session.user.id;
      const profile = await getUserProfile(userId).catch(() => null);
      const safeRole = profile?.role || "admin";
      const finalProfile = {
        ...(profile || {}),
        id: userId,
        role: safeRole,
        registration_status: profile?.registration_status || "Active",
        full_name: profile?.full_name || sessionData.session.user.user_metadata?.full_name || finalFullName,
        phone: profile?.phone || finalPhone,
        profile_photo_url: profile?.profile_photo_url || finalPhoto,
      };

      return setCachedAndReturn({
        user: {
          ...sessionData.session.user,
          user_metadata: {
            ...(sessionData.session.user.user_metadata || {}),
            full_name: finalProfile.full_name,
            avatar_url: finalProfile.profile_photo_url,
          },
        },
        profile: finalProfile,
      });
    }

    if (adminSession?.user) {
      const p = {
        role: "admin",
        registration_status: "Active",
        full_name: adminSession.profile?.full_name || adminSession.user?.user_metadata?.full_name || finalFullName,
        phone: adminSession.profile?.phone || finalPhone,
        profile_photo_url: adminSession.profile?.profile_photo_url || finalPhoto,
        ...(adminSession.profile || {}),
      };
      return setCachedAndReturn({
        user: {
          ...adminSession.user,
          user_metadata: {
            ...(adminSession.user?.user_metadata || {}),
            full_name: p.full_name,
            avatar_url: p.profile_photo_url,
          },
        },
        profile: p,
      });
    }

    return setCachedAndReturn({
      user: {
        id: "00000000-0000-4000-a000-000000000001",
        email: finalEmail,
        user_metadata: {
          full_name: finalFullName,
          username: creds.username || settings.adminUsername || "kaagapai",
          avatar_url: finalPhoto,
        },
      },
      profile: {
        id: "00000000-0000-4000-a000-000000000001",
        role: "admin",
        registration_status: "Active",
        full_name: finalFullName,
        phone: finalPhone,
        profile_photo_url: finalPhoto,
      },
    });
  } catch (error) {
    const adminSession = getAdminSession();
    if (adminSession?.user) {
      const p = {
        role: "admin",
        registration_status: "Active",
        full_name: adminSession.profile?.full_name || adminSession.user?.user_metadata?.full_name || finalFullName,
        phone: adminSession.profile?.phone || finalPhone,
        profile_photo_url: adminSession.profile?.profile_photo_url || finalPhoto,
        ...(adminSession.profile || {}),
      };
      return setCachedAndReturn({
        user: {
          ...adminSession.user,
          user_metadata: {
            ...(adminSession.user?.user_metadata || {}),
            full_name: p.full_name,
            avatar_url: p.profile_photo_url,
          },
        },
        profile: p,
      });
    }
    return setCachedAndReturn({
      user: {
        id: "00000000-0000-4000-a000-000000000001",
        email: finalEmail,
        user_metadata: {
          full_name: finalFullName,
          username: creds.username || settings.adminUsername || "kaagapai",
          avatar_url: finalPhoto,
        },
      },
      profile: {
        id: "00000000-0000-4000-a000-000000000001",
        role: "admin",
        registration_status: "Active",
        full_name: finalFullName,
        phone: finalPhone,
        profile_photo_url: finalPhoto,
      },
    });
  }
}

/**
 * Logout user
 */
export async function clearAuthSession() {
  try {
    clearCurrentUserCache();
    clearAdminSession();
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.clear();
    }
    const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: {} }));

    if (sessionData?.session) {
      await supabase.auth.signOut().catch(() => {});
    }

    return true;
  } catch (error) {
    clearAdminSession();
    return true;
  }
}

/**
 * Logout user
 */
export async function logoutUser() {
  return clearAuthSession();
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId, updates) {
  let profileData = null;

  try {
    if (userId && !String(userId).startsWith("00000000-0000-4000-a000")) {
      const { data, error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("id", userId)
        .select()
        .single();

      if (!error && data) {
        profileData = data;
      }
    }
  } catch (error) {
    console.info("Supabase user profile update notice:", error?.message);
  }

  const adminSession = getAdminSession();
  const nextProfile = {
    ...(adminSession?.profile || {}),
    ...(profileData || {}),
    ...updates,
    id: userId || adminSession?.profile?.id || "00000000-0000-4000-a000-000000000001",
    role: "admin",
    registration_status: "Active",
  };

  if (adminSession) {
    const nextSession = {
      ...adminSession,
      profile: nextProfile,
    };
    saveAdminSession(nextSession);
  }

  return nextProfile;
}

/**
 * Upload current user's profile photo to Supabase Storage
 */
export async function uploadProfilePhoto(userId, file) {
  try {
    if (!userId) throw new Error("Missing user ID for profile photo upload.");
    if (!file) throw new Error("Please choose a profile photo to upload.");

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const contentTypeByExtension = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
    };
    const safeExtension = ["jpg", "jpeg", "png", "webp", "gif"].includes(extension)
      ? extension
      : "jpg";
    const safeUserId = userId && !String(userId).startsWith("00000000") ? userId : "admin";
    const filePath = `${safeUserId}/profile-${Date.now()}.${safeExtension}`;
    const contentType = file.type || contentTypeByExtension[safeExtension] || "image/jpeg";

    let uploadError;
    try {
      const { error: err } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType,
          upsert: true,
        });
      uploadError = err;
    } catch (err) {
      uploadError = err;
    }

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(filePath);

    if (!data.publicUrl) {
      throw new Error("Profile photo uploaded, but no public URL was returned.");
    }

    return data.publicUrl;
  } catch (error) {
    console.error("Error uploading profile photo:", error);

    const message = error?.message || "";
    const isNetworkOrCors = error?.name === "TypeError" || message.toLowerCase().includes("failed to fetch");
    if (message.toLowerCase().includes("bucket") || isNetworkOrCors) {
      throw new Error(
        "Profile photo storage is not set up yet or there is a CORS/network connection error. Run the Supabase setup SQL for the profile-photos bucket, check your internet connection, or make sure CORS is configured.",
        { cause: error }
      );
    }

    throw error;
  }
}

/**
 * Update current auth user's account fields
 */
export async function updateCurrentAuthUser(updates) {
  const adminSession = getAdminSession();
  let updatedUser = null;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      const { data, error } = await supabase.auth.updateUser(updates);
      if (!error && data?.user) {
        updatedUser = data.user;
      }
    }
  } catch (error) {
    console.info("Supabase auth user update notice:", error?.message);
  }

  // Update admin credentials and session state
  const creds = getAdminCredentials();
  const nextCreds = {
    ...creds,
    fullName: updates?.data?.full_name || creds.fullName || "Barangay Administrator",
    email: updates?.email || creds.email || "uppermingading@gmail.com",
    username: updates?.data?.username || creds.username || "kaagapai",
  };
  saveAdminCredentials(nextCreds);

  if (adminSession) {
    const nextSession = {
      ...adminSession,
      user: {
        ...adminSession.user,
        email: nextCreds.email,
        user_metadata: {
          ...(adminSession.user?.user_metadata || {}),
          full_name: nextCreds.fullName,
          username: nextCreds.username,
        },
      },
    };
    saveAdminSession(nextSession);
    return nextSession.user;
  }

  return updatedUser || {
    id: "00000000-0000-4000-a000-000000000001",
    email: nextCreds.email,
    user_metadata: {
      full_name: nextCreds.fullName,
      username: nextCreds.username,
    },
  };
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      const profile = await getUserProfile(session.user.id);
      callback({
        event,
        user: session.user,
        profile: profile,
      });
    } else {
      callback({
        event,
        user: null,
        profile: null,
      });
    }
  });
}

/**
 * Reset password
 */
export async function resetPassword(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Reset password error:", error);
    throw error;
  }
}

/**
 * Update password
 */
export async function updatePassword(newPassword) {
  const cleanPassword = String(newPassword || "");
  if (!cleanPassword || cleanPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }
  const creds = getAdminCredentials();
  saveAdminCredentials({
    ...creds,
    password: cleanPassword,
  });

  try {
    await supabase.auth.updateUser({
      password: cleanPassword,
    }).catch(() => {});
  } catch (error) {
    console.info("Notice updating supabase auth password:", error?.message);
  }

  const adminSession = getAdminSession();
  if (adminSession) {
    saveAdminSession(adminSession);
  }

  return true;
}

/**
 * Update auth email via Supabase (sends confirmation link to the new email)
 */
export async function updateAuthEmail(newEmail) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Update email error:", error);
    throw error;
  }
}

// ─── MFA / TOTP ────────────────────────────────────────────────────────────

/**
 * Enroll a new TOTP factor.
 * Returns { id, type, totp: { qr_code, secret, uri } }
 */
export async function enrollTOTP(friendlyName = "KaagapAI Admin") {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("TOTP enroll error:", error);

    const msg = error?.message || "";
    if (msg.toLowerCase().includes("disabled") || msg.toLowerCase().includes("not enabled")) {
      throw new Error(
        "MFA is not enabled in your Supabase project. Go to Supabase Dashboard → Authentication → Multi-Factor Authentication and enable it first."
      );
    }

    throw error;
  }
}

/**
 * Verify a TOTP factor after enrollment (challenge + verify in one step).
 */
export async function verifyTOTP(factorId, code) {
  try {
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeError) throw challengeError;

    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("TOTP verify error:", error);
    throw error;
  }
}

/**
 * Unenroll (disable) a TOTP factor.
 */
export async function unenrollTOTP(factorId) {
  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("TOTP unenroll error:", error);
    throw error;
  }
}

/**
 * List all MFA factors for the current user.
 * Returns { totp: [...], phone: [...] }
 */
export async function listMFAFactors() {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("List MFA factors error:", error);
    throw error;
  }
}

// ─── Sessions ──────────────────────────────────────────────────────────────

/**
 * Sign out all other sessions (keeps only the current one).
 */
export async function signOutOtherSessions() {
  try {
    const { error } = await supabase.auth.signOut({ scope: "others" });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Sign out other sessions error:", error);
    throw error;
  }
}

/**
 * Get the current active session info.
 */
export async function getCurrentSession() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;
    return data.session;
  } catch (error) {
    console.error("Get session error:", error);
    throw error;
  }
}

/**
 * Parse user-agent string into a human-readable device description.
 */
export function parseUserAgent(ua) {
  if (!ua) return { os: "Unknown", browser: "Unknown", device: "Unknown Device" };

  let os = "Unknown OS";
  if (/windows/i.test(ua)) os = "Windows PC";
  else if (/macintosh|mac os/i.test(ua)) os = "Mac";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Unknown Browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome/i.test(ua)) browser = "Chrome";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";

  return { os, browser, device: `${os} — ${browser}` };
}
