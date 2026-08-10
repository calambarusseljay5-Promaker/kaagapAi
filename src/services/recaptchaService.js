/**
 * recaptchaService.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Google reCAPTCHA v2 (checkbox) integration.
 *
 * - Dynamically loads the reCAPTCHA script on first use.
 * - Renders an invisible reCAPTCHA widget and executes it programmatically.
 * - Gracefully degrades if the site key is not configured (allows login).
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { logSecurityEvent } from "./securityService";

// ─── Constants ──────────────────────────────────────────────────────────────────
const RECAPTCHA_SCRIPT_URL = "https://www.google.com/recaptcha/api.js";
const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

let scriptLoaded = false;
let scriptLoading = false;
let widgetId = null;

// ─── Script Loader ──────────────────────────────────────────────────────────────

/**
 * Check if reCAPTCHA is configured (site key present).
 */
export function isRecaptchaConfigured() {
  return Boolean(SITE_KEY && SITE_KEY !== "YOUR_SITE_KEY_HERE");
}

/**
 * Dynamically load the reCAPTCHA v2 script.
 * Resolves when the script is ready.
 */
export function loadRecaptchaScript() {
  return new Promise((resolve, reject) => {
    if (!isRecaptchaConfigured()) {
      resolve(false);
      return;
    }

    if (scriptLoaded && window.grecaptcha) {
      resolve(true);
      return;
    }

    if (scriptLoading) {
      // Wait for the existing load to complete
      const checkInterval = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.render) {
          clearInterval(checkInterval);
          scriptLoaded = true;
          resolve(true);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 10000);
      return;
    }

    scriptLoading = true;

    // Check if script already exists in DOM
    const existing = document.querySelector(
      `script[src^="${RECAPTCHA_SCRIPT_URL}"]`
    );
    if (existing) {
      const checkInterval = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.render) {
          clearInterval(checkInterval);
          scriptLoaded = true;
          scriptLoading = false;
          resolve(true);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        scriptLoading = false;
        resolve(false);
      }, 10000);
      return;
    }

    const script = document.createElement("script");
    script.src = `${RECAPTCHA_SCRIPT_URL}?render=explicit`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // grecaptcha.ready may be needed
      const checkInterval = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.render) {
          clearInterval(checkInterval);
          scriptLoaded = true;
          scriptLoading = false;
          resolve(true);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        scriptLoading = false;
        resolve(false);
      }, 10000);
    };

    script.onerror = () => {
      scriptLoading = false;
      console.warn("reCAPTCHA script failed to load.");
      resolve(false); // Graceful degradation
    };

    document.head.appendChild(script);
  });
}

// ─── Widget Rendering ───────────────────────────────────────────────────────────

/**
 * Render the reCAPTCHA widget inside a container element.
 * @param {string|HTMLElement} container - Element or ID to render into
 * @param {object} options - Optional callbacks
 * @returns {number|null} - Widget ID or null if not configured
 */
export function renderRecaptchaWidget(container, options = {}) {
  if (!isRecaptchaConfigured() || !window.grecaptcha || !window.grecaptcha.render) {
    return null;
  }

  try {
    // Reset any existing widget
    if (widgetId !== null) {
      try {
        window.grecaptcha.reset(widgetId);
      } catch {
        // Ignore reset errors
      }
    }

    widgetId = window.grecaptcha.render(container, {
      sitekey: SITE_KEY,
      size: "normal",
      theme: "light",
      callback: (token) => {
        logSecurityEvent("recaptcha_passed", { hasToken: Boolean(token) });
        options.onSuccess?.(token);
      },
      "expired-callback": () => {
        options.onExpired?.();
      },
      "error-callback": () => {
        logSecurityEvent("recaptcha_failed", { reason: "widget_error" });
        options.onError?.();
      },
    });

    return widgetId;
  } catch (err) {
    console.warn("reCAPTCHA render error:", err);
    return null;
  }
}

/**
 * Get the current reCAPTCHA response token.
 * @returns {string} The response token, or empty string if not available.
 */
export function getRecaptchaToken() {
  if (!isRecaptchaConfigured() || !window.grecaptcha || widgetId === null) {
    return "";
  }

  try {
    return window.grecaptcha.getResponse(widgetId) || "";
  } catch {
    return "";
  }
}

/**
 * Check if the reCAPTCHA challenge has been completed.
 */
export function isRecaptchaVerified() {
  if (!isRecaptchaConfigured()) return true; // Skip if not configured
  return Boolean(getRecaptchaToken());
}

/**
 * Reset the reCAPTCHA widget.
 */
export function resetRecaptcha() {
  if (!window.grecaptcha || widgetId === null) return;

  try {
    window.grecaptcha.reset(widgetId);
  } catch {
    // Ignore
  }
}
