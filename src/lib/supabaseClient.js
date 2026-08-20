import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://gknygquumtlhasfsiusn.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrbnlncXV1bXRsaGFzZnNpdXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0OTYxNzksImV4cCI6MjA5NTA3MjE3OX0.EDe5Pr8FKO6FEU3pIuHP2ze_TiwuZfWtbravbNmkIso";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const SUPABASE_REQUEST_TIMEOUT_MS = 20000;

const fetchWithTimeout = async (input, init = {}) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, SUPABASE_REQUEST_TIMEOUT_MS);
  const externalSignal = init.signal;

  const abortFromExternalSignal = () => {
    controller.abort(externalSignal.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternalSignal();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new Error("Supabase request timed out. Check your connection, then try again.", {
        cause: error,
      });
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener?.("abort", abortFromExternalSignal);
  }
};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
