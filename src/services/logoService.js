import { useState, useEffect } from "react";
import { getSystemSettings, saveSystemSettings, broadcastBarangayLogo } from "./adminActivityService";

const LOGO_STORAGE_KEY = "kaagapai_barangay_logo";
const LOGO_EVENT = "kaagapai_barangay_logo_changed";
const DEFAULT_LOGO = "/logo.png";

export function getBarangayLogo() {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(LOGO_STORAGE_KEY);
      if (stored && stored.trim()) return stored;
    } catch {}
  }
  const settings = getSystemSettings();
  if (settings?.barangayLogoUrl && settings.barangayLogoUrl.trim()) {
    return settings.barangayLogoUrl;
  }
  return DEFAULT_LOGO;
}

export function setBarangayLogo(logoUrl) {
  if (!logoUrl) return;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LOGO_STORAGE_KEY, logoUrl);
    } catch {}
  }
  saveSystemSettings({ barangayLogoUrl: logoUrl });
  broadcastBarangayLogo(logoUrl);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LOGO_EVENT, { detail: logoUrl }));
    window.dispatchEvent(new CustomEvent("kaagapai:system-settings-updated"));
  }
}

export function useBarangayLogo() {
  const [logo, setLogo] = useState(() => getBarangayLogo());

  useEffect(() => {
    const handleLogoChange = (event) => {
      if (event?.detail) {
        setLogo(event.detail);
      } else {
        setLogo(getBarangayLogo());
      }
    };

    window.addEventListener(LOGO_EVENT, handleLogoChange);
    window.addEventListener("kaagapai:system-settings-updated", handleLogoChange);
    return () => {
      window.removeEventListener(LOGO_EVENT, handleLogoChange);
      window.removeEventListener("kaagapai:system-settings-updated", handleLogoChange);
    };
  }, []);

  return logo;
}
