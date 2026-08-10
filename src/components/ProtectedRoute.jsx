import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getResidentSession } from "../services/residentAuthService";
import { getDashboardPathForRole, roleMatches } from "../utils/authRoutes";

const AUTH_CHECK_TIMEOUT_MS = 30000;

const withTimeout = (promise, message) =>
  new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, AUTH_CHECK_TIMEOUT_MS);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });

const ProtectedRoute = ({ requiredRole = null }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/");
  const [authCheckError, setAuthCheckError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const completeRouteCheck = (result) => {
      if (!isMounted) return;

      setAuthenticated(result.isAllowed);
      setRedirectPath(result.redirectTo || "/");
      setAuthCheckError("");
      setLoading(false);
    };

    const holdRouteForRetry = (error) => {
      if (!isMounted) return;

      console.error("Unable to verify route access:", error);
      setAuthCheckError(
        error?.message || "Unable to verify your login session. Please try again."
      );
      setLoading(false);
    };

    const verifySession = async (session) => {
      if (!session) {
        const residentSession = getResidentSession();

        if (residentSession && roleMatches("resident", requiredRole)) {
          return { isAllowed: true, redirectTo: null };
        }

        if (residentSession) {
          return { isAllowed: false, redirectTo: "/resident-dashboard" };
        }

        return { isAllowed: false, redirectTo: "/" };
      }

      try {
        const cacheKey = `kaagapai_user_role_${session.user.id}`;
        const cachedRole = sessionStorage.getItem(cacheKey);

        if (cachedRole) {
          const roleDashboardPath = getDashboardPathForRole(cachedRole);
          const isAllowed = roleMatches(cachedRole, requiredRole);
          // Async background sync
          supabase
            .from("user_profiles")
            .select("role")
            .eq("id", session.user.id)
            .single()
            .then(({ data }) => {
              if (data?.role) sessionStorage.setItem(cacheKey, data.role);
            })
            .catch(() => {});

          return {
            isAllowed,
            redirectTo: isAllowed ? null : roleDashboardPath || "/",
          };
        }

        const { data: profileData, error } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (error || !profileData) {
          if (error && error.code !== "PGRST116") {
            throw error;
          }

          return { isAllowed: false, redirectTo: "/" };
        }

        sessionStorage.setItem(cacheKey, profileData.role);
        const roleDashboardPath = getDashboardPathForRole(profileData.role);
        const isAllowed = roleMatches(profileData.role, requiredRole);

        return {
          isAllowed,
          redirectTo: isAllowed ? null : roleDashboardPath || "/",
        };
      } catch (error) {
        console.error("Unable to verify session:", error);
        throw error;
      }
    };

    const checkSession = async () => {
      try {
        const { data: sessionData } = await withTimeout(
          supabase.auth.getSession(),
          "Session check timed out."
        );
        const result = await withTimeout(
          verifySession(sessionData.session),
          "Profile check timed out."
        );

        completeRouteCheck(result);
      } catch (error) {
        holdRouteForRetry(error);
      }
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const result = await withTimeout(
          verifySession(session),
          "Auth state profile check timed out."
        );

        completeRouteCheck(result);
      } catch (error) {
        holdRouteForRetry(error);
      }
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, [requiredRole, retryCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 to-slate-800">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (authCheckError && !authenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-950 to-slate-800 px-4">
        <div className="max-w-md rounded-lg border border-white/15 bg-white/10 p-6 text-center text-white shadow-xl">
          <p className="text-lg font-semibold">Checking your login session</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{authCheckError}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setAuthCheckError("");
              setRetryCount((current) => current + 1);
            }}
            className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return authenticated ? <Outlet /> : <Navigate to={redirectPath} replace />;
};

export default ProtectedRoute;
