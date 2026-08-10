import { supabase } from "../lib/supabaseClient";

export const PROFILE_UPDATED_EVENT = "kaagapai:profile-updated";

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
 * Login admin with email and password
 */
export async function loginUser(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("Login failed");

    let profile;
    try {
      profile = await getUserProfile(data.user.id);
    } catch (profileError) {
      await supabase.auth.signOut();
      throw profileError;
    }

    return {
      user: data.user,
      profile: profile,
      session: data.session,
    };
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

/**
 * Get user profile
 */
export async function getUserProfile(userId) {
  try {
    const cacheKey = `kaagapai_user_profile_${userId}`;
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw new Error(getProfileErrorMessage(error));

    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(cacheKey, JSON.stringify(data));
      if (data?.role) {
        window.sessionStorage.setItem(`kaagapai_user_role_${userId}`, data.role);
      }
    }

    return data;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw error;
  }
}

/**
 * Get current authenticated user and profile
 */
export async function getCurrentUserWithProfile() {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;
    if (!sessionData.session) return null;

    const userId = sessionData.session.user.id;
    const cacheKey = `kaagapai_user_profile_${userId}`;

    if (typeof window !== "undefined" && window.sessionStorage) {
      const cached = window.sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const profile = JSON.parse(cached);
          getUserProfile(userId).then((refreshedProfile) => {
            if (refreshedProfile) {
              notifyProfileUpdated({
                user: sessionData.session.user,
                profile: refreshedProfile,
              });
            }
          }).catch(() => {});

          return {
            user: sessionData.session.user,
            profile: profile,
          };
        } catch {
          // ignore parse error and fetch fresh
        }
      }
    }

    const profile = await getUserProfile(userId);
    return {
      user: sessionData.session.user,
      profile: profile,
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    throw error;
  }
}

/**
 * Logout user
 */
export async function clearAuthSession() {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (sessionData.session) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error("Error clearing auth session:", error);
    throw error;
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
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
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
    const filePath = `${userId}/profile-${Date.now()}.${safeExtension}`;
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
  try {
    const { data, error } = await supabase.auth.updateUser(updates);

    if (error) throw error;
    return data.user;
  } catch (error) {
    console.error("Error updating auth user:", error);
    throw error;
  }
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
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Update password error:", error);
    throw error;
  }
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
