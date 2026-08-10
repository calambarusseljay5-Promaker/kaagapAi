/**
 * otpService.js
 * ──────────────────────────────────────────────────────────────────────────────
 * OTP (One-Time Password) generation, hashing, verification, and SMS delivery.
 *
 * Security design:
 *   - OTPs are 6-digit numeric codes.
 *   - The plain-text OTP is NEVER stored; only a SHA-256 hash + expiry are
 *     kept in sessionStorage (cleared when the browser tab closes).
 *   - OTPs expire after 5 minutes.
 *   - OTPs are single-use (cleared after successful verification).
 *   - A cooldown prevents re-sending for 60 seconds.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { sendSmsNotification, normalizeSmsPhone } from "./smsService";
import { logSecurityEvent } from "./securityService";

// ─── Constants ──────────────────────────────────────────────────────────────────
const OTP_STORAGE_PREFIX = "kaagapai_otp_";
const OTP_COOLDOWN_PREFIX = "kaagapai_otp_cd_";
const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds between sends
const MAX_VERIFY_ATTEMPTS = 5;

// ─── Crypto Helpers ─────────────────────────────────────────────────────────────

async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOTPCode() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = String(array[0] % 10 ** OTP_LENGTH).padStart(OTP_LENGTH, "0");
  return code;
}

// ─── Storage Helpers ────────────────────────────────────────────────────────────

function getStorageKey(phone) {
  return `${OTP_STORAGE_PREFIX}${normalizeSmsPhone(phone)}`;
}

function getCooldownKey(phone) {
  return `${OTP_COOLDOWN_PREFIX}${normalizeSmsPhone(phone)}`;
}

function storeOTPData(phone, data) {
  sessionStorage.setItem(getStorageKey(phone), JSON.stringify(data));
}

function getOTPData(phone) {
  try {
    const raw = sessionStorage.getItem(getStorageKey(phone));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearOTPData(phone) {
  sessionStorage.removeItem(getStorageKey(phone));
}

// ─── Cooldown ───────────────────────────────────────────────────────────────────

function setCooldown(phone) {
  sessionStorage.setItem(getCooldownKey(phone), String(Date.now() + OTP_COOLDOWN_MS));
}

/**
 * Get remaining cooldown seconds before another OTP can be sent.
 * Returns 0 if no cooldown is active.
 */
export function getOTPCooldownSeconds(phone) {
  try {
    const expiresAt = Number(sessionStorage.getItem(getCooldownKey(phone)) || 0);
    const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    return remaining;
  } catch {
    return 0;
  }
}

// ─── Core API ───────────────────────────────────────────────────────────────────

/**
 * Generate an OTP, hash it, store it, and send it via SMS.
 * @param {string} phone - The recipient phone number (e.g. 09171234567)
 * @returns {Promise<{ sent: boolean, expiresIn: number }>}
 */
export async function sendOTP(phone) {
  const normalized = normalizeSmsPhone(phone);
  if (!normalized) throw new Error("Please enter a valid phone number.");

  // Check cooldown
  const cooldown = getOTPCooldownSeconds(phone);
  if (cooldown > 0) {
    throw new Error(
      `Please wait ${cooldown} second${cooldown !== 1 ? "s" : ""} before requesting a new OTP.`
    );
  }

  // Generate and hash
  const plainOTP = generateOTPCode();
  const hashedOTP = await sha256(plainOTP);

  // Store hashed OTP with expiry
  storeOTPData(phone, {
    hash: hashedOTP,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    createdAt: Date.now(),
  });

  // Set send cooldown
  setCooldown(phone);

  // Send SMS
  try {
    await sendSmsNotification({
      to: normalized,
      body: `[KaagapAI] Your verification code is: ${plainOTP}. This code expires in 5 minutes. Do not share this code with anyone.`,
    });
  } catch (smsError) {
    // Clear stored OTP if SMS fails
    clearOTPData(phone);
    throw new Error(
      smsError.message || "Unable to send OTP via SMS. Please try again."
    );
  }

  logSecurityEvent("otp_sent", {
    phone: maskPhone(normalized),
    method: "sms",
  });

  return {
    sent: true,
    expiresIn: Math.floor(OTP_EXPIRY_MS / 1000),
  };
}

/**
 * Verify an OTP entered by the user.
 * @param {string} phone
 * @param {string} userOTP - The 6-digit code entered by the user
 * @returns {Promise<boolean>}
 */
export async function verifyOTP(phone, userOTP) {
  const data = getOTPData(phone);

  if (!data) {
    throw new Error("No OTP was sent to this number. Please request a new one.");
  }

  // Check expiry
  if (Date.now() > data.expiresAt) {
    clearOTPData(phone);
    logSecurityEvent("otp_failed", {
      phone: maskPhone(normalizeSmsPhone(phone)),
      reason: "expired",
    });
    throw new Error("OTP has expired. Please request a new one.");
  }

  // Check max verification attempts
  if (data.attempts >= MAX_VERIFY_ATTEMPTS) {
    clearOTPData(phone);
    logSecurityEvent("otp_failed", {
      phone: maskPhone(normalizeSmsPhone(phone)),
      reason: "max_attempts_exceeded",
    });
    throw new Error(
      "Too many incorrect attempts. Please request a new OTP."
    );
  }

  // Hash user input and compare
  const cleanInput = String(userOTP || "").trim();
  if (cleanInput.length !== OTP_LENGTH) {
    data.attempts += 1;
    storeOTPData(phone, data);
    throw new Error(`Please enter the complete ${OTP_LENGTH}-digit code.`);
  }

  const userHash = await sha256(cleanInput);

  if (userHash !== data.hash) {
    data.attempts += 1;
    storeOTPData(phone, data);

    const remaining = MAX_VERIFY_ATTEMPTS - data.attempts;
    logSecurityEvent("otp_failed", {
      phone: maskPhone(normalizeSmsPhone(phone)),
      reason: "incorrect_code",
      attemptsRemaining: remaining,
    });

    throw new Error(
      `Incorrect verification code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
    );
  }

  // OTP is valid — clear it (single use)
  clearOTPData(phone);

  logSecurityEvent("otp_verified", {
    phone: maskPhone(normalizeSmsPhone(phone)),
  });

  return true;
}

/**
 * Check if an OTP is currently pending (not expired) for a phone number.
 */
export function hasActiveOTP(phone) {
  const data = getOTPData(phone);
  if (!data) return false;
  if (Date.now() > data.expiresAt) {
    clearOTPData(phone);
    return false;
  }
  return true;
}

/**
 * Get the remaining time (in seconds) before the current OTP expires.
 */
export function getOTPRemainingSeconds(phone) {
  const data = getOTPData(phone);
  if (!data) return 0;
  const remaining = Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000));
  if (remaining <= 0) {
    clearOTPData(phone);
    return 0;
  }
  return remaining;
}

/**
 * Invalidate any pending OTP for a phone number.
 */
export function invalidateOTP(phone) {
  clearOTPData(phone);
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function maskPhone(phone) {
  if (!phone || phone.length < 6) return "***";
  return phone.slice(0, 4) + "****" + phone.slice(-3);
}
