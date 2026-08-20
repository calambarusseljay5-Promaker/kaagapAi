export const ADMIN_ROLE = "admin";
export const USER_ROLES = ["resident", "user"];

export function normalizeRole(role) {
  return role?.toString().trim().toLowerCase() || "";
}

export function getDashboardPathForRole(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === ADMIN_ROLE) {
    return "/dashboard";
  }

  if (USER_ROLES.includes(normalizedRole)) {
    return "/resident-dashboard";
  }

  return null;
}

export function roleMatches(role, requiredRole) {
  if (!requiredRole) return true;

  const normalizedRole = normalizeRole(role);
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  return allowedRoles.some((allowedRole) => normalizeRole(allowedRole) === normalizedRole);
}

export function isTargetAdminPortal(portalMode = null, pathname = "") {
  if (portalMode === "admin") return true;
  if (portalMode === "resident") return false;

  const currentPath = (
    pathname || (typeof window !== "undefined" ? window.location.pathname : "")
  ).toLowerCase();
  if (currentPath.includes("admin") || currentPath.includes("staff")) return true;
  if (currentPath.includes("portal") || currentPath.includes("resident")) return false;

  if (typeof window !== "undefined") {
    const port = window.location.port;
    if (port === "5173") return true;
    if (port === "5174" || port === "3000") return false;

    const hostname = window.location.hostname.toLowerCase();
    if (hostname.startsWith("admin.") || hostname.includes("-admin.") || hostname.includes("admin-")) {
      return true;
    }
  }

  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_PORTAL_TYPE === "admin") {
    return true;
  }

  return false;
}

export function isTargetResidentPortal(portalMode = null, pathname = "") {
  return !isTargetAdminPortal(portalMode, pathname);
}
