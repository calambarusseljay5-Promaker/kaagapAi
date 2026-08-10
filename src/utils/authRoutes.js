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
