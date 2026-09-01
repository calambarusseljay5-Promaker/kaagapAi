import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const CHANNEL_NAME = "kaagapai_realtime_bus";

// Cross-tab Broadcast Channel
let broadcastChannel = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    console.warn("BroadcastChannel not supported in this environment", e);
  }
}

/**
 * Broadcast an event to all open tabs and dispatch locally
 * @param {string} type - "announcements" | "documents" | "notifications" | "livelihood" | "residents" | "activations" | "all"
 * @param {any} [payload]
 */
export function broadcastSyncEvent(type = "all", payload = {}) {
  const eventDetail = { type, payload, timestamp: Date.now() };

  // 1. Dispatch locally in current window
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("kaagapai:sync", { detail: eventDetail }));
      // Also write timestamp to localStorage to trigger storage events on older browsers
      window.localStorage.setItem("kaagapai_last_sync_event", JSON.stringify(eventDetail));
    } catch (e) {}
  }

  // 2. Broadcast to other open tabs
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(eventDetail);
    } catch (e) {}
  }
}

// Global listener to forward broadcastChannel messages to local window events
if (broadcastChannel) {
  broadcastChannel.onmessage = (event) => {
    if (event.data && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("kaagapai:sync", { detail: event.data }));
    }
  };
}

// Global storage event listener fallback
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "kaagapai_last_sync_event" && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        window.dispatchEvent(new CustomEvent("kaagapai:sync", { detail: parsed }));
      } catch (err) {}
    }
  });
}

/**
 * Hook for components to subscribe to real-time changes
 * Automatically handles:
 * 1. Cross-tab instant communication (BroadcastChannel + CustomEvents)
 * 2. Supabase Realtime Postgres change subscriptions (Cross-device WebSocket)
 * 3. 4-second Polling Fallback Heartbeat (Ensures freshness even if network sleeps)
 *
 * @param {string|string[]} eventTypes - "announcements", "documents", "notifications", "livelihood", "residents", "activations", "all"
 * @param {Function} onSync - Callback to re-fetch data
 * @param {Object} [options]
 * @param {number} [options.pollIntervalMs=4000] - Interval polling in milliseconds
 * @param {boolean} [options.enablePolling=true]
 */
export function useRealtimeSync(eventTypes = "all", onSync, options = {}) {
  const { pollIntervalMs = 4000, enablePolling = true } = options;
  const savedCallback = useRef(onSync);

  useEffect(() => {
    savedCallback.current = onSync;
  }, [onSync]);

  useEffect(() => {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];

    const handleSync = (event) => {
      const detail = event?.detail || {};
      const incomingType = detail.type || "all";

      if (types.includes("all") || types.includes(incomingType) || incomingType === "all") {
        if (typeof savedCallback.current === "function") {
          savedCallback.current(detail);
        }
      }
    };

    // Listen to local & cross-tab events
    window.addEventListener("kaagapai:sync", handleSync);

    // Setup Supabase Realtime Channel
    const uniqueChannelId = `rt-sync-${Math.random().toString(36).substring(2, 9)}`;
    const supabaseChannel = supabase.channel(uniqueChannelId);

    // Map table changes to event types
    const handleDbChange = (table, eventType) => () => {
      broadcastSyncEvent(eventType);
      if (types.includes("all") || types.includes(eventType)) {
        if (typeof savedCallback.current === "function") {
          savedCallback.current({ type: eventType, source: "supabase" });
        }
      }
    };

    supabaseChannel
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, handleDbChange("announcements", "announcements"))
      .on("postgres_changes", { event: "*", schema: "public", table: "document_requests" }, handleDbChange("document_requests", "documents"))
      .on("postgres_changes", { event: "*", schema: "public", table: "resident_notifications" }, handleDbChange("resident_notifications", "notifications"))
      .on("postgres_changes", { event: "*", schema: "public", table: "livelihood_posts" }, handleDbChange("livelihood_posts", "livelihood"))
      .on("postgres_changes", { event: "*", schema: "public", table: "residents" }, handleDbChange("residents", "residents"))
      .on("postgres_changes", { event: "*", schema: "public", table: "resident_activation_requests" }, handleDbChange("resident_activation_requests", "activations"))
      .on("postgres_changes", { event: "*", schema: "public", table: "resident_profile_update_requests" }, handleDbChange("resident_profile_update_requests", "profile_updates"))
      .subscribe();

    // 4-second Polling Heartbeat
    let timer = null;
    if (enablePolling && pollIntervalMs > 0) {
      timer = setInterval(() => {
        // Only run polling if document is visible
        if (typeof document !== "undefined" && !document.hidden) {
          if (typeof savedCallback.current === "function") {
            savedCallback.current({ type: "heartbeat", source: "poll" });
          }
        }
      }, pollIntervalMs);
    }

    return () => {
      window.removeEventListener("kaagapai:sync", handleSync);
      supabase.removeChannel(supabaseChannel);
      if (timer) clearInterval(timer);
    };
  }, [Array.isArray(eventTypes) ? eventTypes.join(",") : eventTypes, enablePolling, pollIntervalMs]);
}
