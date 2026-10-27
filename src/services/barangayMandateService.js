import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export const MANDATE_STORAGE_KEY = "kaagapai_barangay_mandate";
export const MANDATE_EVENT = "kaagapai:mandate_updated";
const STORAGE_BUCKET = "document-templates";
const STORAGE_PATH = "system/mandate.json";

export const DEFAULT_BARANGAY_MANDATE = {
  mission:
    "To attain healthy, peaceful and progressive Barangay Upper Mingading through improved delivery of basic services with access to health programs and quality education, people empowerment for peaceful community and sustainable environment, enhancement of infrastructure facilities and promotion of economic activities and livelihood opportunities that is supportive to the development of socio-economic condition of the populace.",
  vision:
    "Barangay Upper Mingading envision a balance and agricultural progressive community where people enjoy a safe environment educated and healthy constituents supported with adequate infrastructure through good governance and transparent leadership.",
  goals:
    "To effectively escalate the community awareness and disaster preparedness, focus on proactive measures like community engagement, education, and practical training.",
};

/**
 * Read current mandate from local storage with fallback to default
 */
export function getBarangayMandate() {
  if (typeof window === "undefined") return { ...DEFAULT_BARANGAY_MANDATE };
  try {
    const raw = localStorage.getItem(MANDATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mission: (parsed.mission || DEFAULT_BARANGAY_MANDATE.mission).trim(),
        vision: (parsed.vision || DEFAULT_BARANGAY_MANDATE.vision).trim(),
        goals: (parsed.goals || DEFAULT_BARANGAY_MANDATE.goals).trim(),
      };
    }
  } catch (err) {
    console.warn("Failed to parse local mandate:", err);
  }
  return { ...DEFAULT_BARANGAY_MANDATE };
}

/**
 * Fetch latest mandate from Supabase Storage
 */
export async function fetchBarangayMandate() {
  try {
    const { data: pubData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(STORAGE_PATH);

    if (pubData?.publicUrl) {
      const cacheBust = `${pubData.publicUrl}?t=${Date.now()}`;
      const res = await fetch(cacheBust);
      if (res.ok) {
        const cloudData = await res.json();
        if (cloudData && (cloudData.mission || cloudData.vision || cloudData.goals)) {
          const merged = {
            mission: (cloudData.mission || DEFAULT_BARANGAY_MANDATE.mission).trim(),
            vision: (cloudData.vision || DEFAULT_BARANGAY_MANDATE.vision).trim(),
            goals: (cloudData.goals || DEFAULT_BARANGAY_MANDATE.goals).trim(),
          };
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(MANDATE_STORAGE_KEY, JSON.stringify(merged));
              window.dispatchEvent(new CustomEvent(MANDATE_EVENT, { detail: merged }));
            } catch {}
          }
          return merged;
        }
      }
    }
  } catch (err) {
    console.warn("Notice: Could not fetch cloud mandate, using cached/default:", err.message);
  }
  return getBarangayMandate();
}

/**
 * Save updated mandate locally, upload to Supabase Storage, and broadcast across all clients
 */
export async function saveBarangayMandate({ mission, vision, goals }) {
  const nextMandate = {
    mission: (mission || DEFAULT_BARANGAY_MANDATE.mission).trim(),
    vision: (vision || DEFAULT_BARANGAY_MANDATE.vision).trim(),
    goals: (goals || DEFAULT_BARANGAY_MANDATE.goals).trim(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Save to local storage for instant responsiveness
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(MANDATE_STORAGE_KEY, JSON.stringify(nextMandate));
      window.dispatchEvent(new CustomEvent(MANDATE_EVENT, { detail: nextMandate }));
    } catch (e) {
      console.warn("Failed to save mandate to local storage:", e);
    }
  }

  // 2. Broadcast via Supabase Realtime channel to other browser windows/ports
  try {
    const channel = supabase.channel("kaagapai_mandate_channel");
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({
          type: "broadcast",
          event: "barangay_mandate_updated",
          payload: nextMandate,
        });
      }
    });
  } catch (e) {
    console.warn("Realtime broadcast for mandate noticed error:", e);
  }

  // 3. Persist to Supabase Storage for universal cross-device access
  try {
    const jsonStr = JSON.stringify(nextMandate, null, 2);
    let uploadPayload;
    if (typeof Blob !== "undefined") {
      uploadPayload = new Blob([jsonStr], { type: "application/json" });
    } else {
      uploadPayload = Buffer.from(jsonStr, "utf-8");
    }
    await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(STORAGE_PATH, uploadPayload, {
        contentType: "application/json",
        upsert: true,
      });
  } catch (err) {
    console.warn("Storage upload for mandate encountered notice:", err.message);
  }

  return nextMandate;
}

/**
 * React hook to consume and react to changes in Barangay Mission, Vision, and Goals
 */
export function useBarangayMandate() {
  const [mandate, setMandate] = useState(() => getBarangayMandate());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Fetch latest from cloud asynchronously on mount
    fetchBarangayMandate().then((latest) => {
      if (isMounted && latest) {
        setMandate(latest);
      }
    });

    // Listen to local window events (same-page or same-tab dispatch)
    const handleLocalUpdate = (e) => {
      if (e?.detail) {
        setMandate(e.detail);
      } else {
        setMandate(getBarangayMandate());
      }
    };

    // Listen to native browser storage event for instant cross-tab synchronization
    const handleStorageUpdate = (e) => {
      if (e.key === MANDATE_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && isMounted) {
            setMandate(parsed);
          }
        } catch {}
      }
    };

    window.addEventListener(MANDATE_EVENT, handleLocalUpdate);
    window.addEventListener("storage", handleStorageUpdate);

    // Listen to Supabase Realtime global broadcast
    let realtimeChannel = null;
    try {
      realtimeChannel = supabase.channel("kaagapai_mandate_channel");
      realtimeChannel
        .on("broadcast", { event: "barangay_mandate_updated" }, ({ payload }) => {
          if (payload && isMounted) {
            setMandate(payload);
            try {
              localStorage.setItem(MANDATE_STORAGE_KEY, JSON.stringify(payload));
            } catch {}
          }
        })
        .subscribe();
    } catch (err) {
      console.warn("Mandate realtime channel subscription notice:", err);
    }

    return () => {
      isMounted = false;
      window.removeEventListener(MANDATE_EVENT, handleLocalUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
      if (realtimeChannel) {
        try {
          supabase.removeChannel(realtimeChannel);
        } catch {}
      }
    };
  }, []);

  return {
    mission: mandate.mission || DEFAULT_BARANGAY_MANDATE.mission,
    vision: mandate.vision || DEFAULT_BARANGAY_MANDATE.vision,
    goals: mandate.goals || DEFAULT_BARANGAY_MANDATE.goals,
    loading,
    refetch: fetchBarangayMandate,
  };
}
