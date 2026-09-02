import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { getSystemSettings } from "./services/adminActivityService";
import { ConfirmProvider } from "./context/ConfirmContext";
import { isTargetAdminPortal } from "./utils/authRoutes";
import "./App.css";

// ─── Route Code-Splitting via React.lazy for instant initial load ───
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Analytics = lazy(() => import("./pages/Analytics"));
const ResidentsManagement = lazy(() => import("./pages/ResidentsManagement"));
const ResidentActivationRequests = lazy(() => import("./pages/ResidentActivationRequests"));
const ResidentProfileUpdateRequests = lazy(() => import("./pages/ResidentProfileUpdateRequests"));
const Archive = lazy(() => import("./pages/Archive"));
const DocumentManagement = lazy(() => import("./pages/DocumentManagement"));
const DocumentTemplates = lazy(() => import("./pages/DocumentTemplates"));
const Reports = lazy(() => import("./pages/Reports"));
const Livelihood = lazy(() => import("./pages/Livelihood"));
const Announcements = lazy(() => import("./pages/Announcements"));
const AIKnowledge = lazy(() => import("./pages/AIKnowledge"));
const OrganizationChart = lazy(() => import("./pages/OrganizationChart"));
const Users = lazy(() => import("./pages/Users"));
const Settings = lazy(() => import("./pages/Settings"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const AccountSecurity = lazy(() => import("./pages/AccountSecurity"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Login = lazy(() => import("./pages/Login"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Goodbye = lazy(() => import("./pages/Goodbye"));
const RecycleBin = lazy(() => import("./pages/RecycleBin"));

const RouteLoadingFallback = () => (
  <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-br from-[#02281B] via-[#043E2B] to-[#011B12] text-white select-none">
    <div className="relative flex flex-col items-center">
      <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border-2 border-emerald-400/50 bg-gradient-to-b from-emerald-900/80 to-emerald-950 p-2 shadow-2xl shadow-emerald-950/80 ring-4 ring-emerald-500/20 animate-pulse flex items-center justify-center">
        <img src="/logo.png" alt="Barangay Seal" className="h-full w-full object-contain" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="h-3.5 w-3.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
        <span className="text-[11px] font-black tracking-widest text-emerald-200 uppercase">
          Loading...
        </span>
      </div>
    </div>
  </div>
);

const PortGuard = ({ target, children }) => {
  if (typeof window === "undefined") return children;

  const port = window.location.port;
  const hostname = window.location.hostname.toLowerCase();
  const isDedicatedAdminPortOrHost =
    port === "5173" ||
    hostname.startsWith("admin.") ||
    hostname.includes("-admin.") ||
    hostname.includes("admin-") ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_PORTAL_TYPE === "admin");

  const isDedicatedResidentPortOrHost =
    port === "5174" ||
    hostname.startsWith("resident.") ||
    hostname.startsWith("portal.") ||
    hostname.includes("-resident.") ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_PORTAL_TYPE === "resident");

  // Strict Lock ONLY applies when explicitly on a dedicated resident port/host attempting to open admin target
  if (isDedicatedResidentPortOrHost && target === "admin") {
    return <Navigate to="/resident-dashboard" replace />;
  }

  // Strict Lock ONLY applies when explicitly on a dedicated admin port/host attempting to open resident target
  if (isDedicatedAdminPortOrHost && target === "resident") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const ResidentPortalGate = ({ children }) => {
  if (getSystemSettings().residentPortalEnabled === false) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const RootPortal = () => {
  const isAdmin = isTargetAdminPortal();
  return <Login portalMode={isAdmin ? "admin" : null} />;
};

function App() {
  return (
    <ConfirmProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Public Routes - Auto-detected based on Port / Subdomain / Explicit Route */}
            <Route path="/" element={<RootPortal />} />
            <Route path="/login" element={<RootPortal />} />
            <Route path="/portal" element={<Login portalMode="resident" />} />
            <Route path="/resident" element={<Login portalMode="resident" />} />
            <Route path="/resident-login" element={<Login portalMode="resident" />} />

            {/* Hidden Admin & Staff Login Routes */}
            <Route path="/admin" element={<Login portalMode="admin" />} />
            <Route path="/admin-login" element={<Login portalMode="admin" />} />
            <Route path="/staff" element={<Login portalMode="admin" />} />

            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/goodbye" element={<Goodbye />} />

            {/* Shared welcome transition */}
            <Route element={<ProtectedRoute requiredRole={["admin", "resident", "user"]} />}>
              <Route path="/welcome" element={<Welcome />} />
            </Route>

            {/* Admin Routes (Strictly locked to Port 5173 / Admin domain) */}
            <Route element={<ProtectedRoute requiredRole="admin" />}>
              <Route element={<PortGuard target="admin"><MainLayout /></PortGuard>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/residents" element={<ResidentsManagement />} />
                <Route path="/residents-management" element={<ResidentsManagement />} />
                <Route path="/resident-activations" element={<ResidentActivationRequests />} />
                <Route path="/resident-profile-updates" element={<ResidentProfileUpdateRequests />} />
                <Route path="/archive" element={<Archive />} />
                <Route path="/documents" element={<DocumentManagement />} />
                <Route path="/document-templates" element={<DocumentTemplates />} />
                <Route path="/document-template-management" element={<DocumentTemplates />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/livelihood" element={<Livelihood />} />
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/ai-knowledge" element={<AIKnowledge />} />
                <Route path="/organization" element={<OrganizationChart />} />
                <Route path="/users" element={<Users />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/system-settings" element={<Settings />} />
                <Route path="/profile-settings" element={<ProfileSettings />} />
                <Route path="/my-account" element={<ProfileSettings />} />
                <Route path="/account-security" element={<AccountSecurity />} />
                <Route path="/audit" element={<AuditLogs />} />
                <Route path="/recycle-bin" element={<RecycleBin />} />
              </Route>
            </Route>

            {/* Resident/User Routes (Strictly locked to Port 5174 / Resident domain) */}
            <Route element={<ProtectedRoute requiredRole={["resident", "user"]} />}>
              <Route
                path="/resident-dashboard"
                element={
                  <PortGuard target="resident">
                    <ResidentPortalGate>
                      <UserDashboard />
                    </ResidentPortalGate>
                  </PortGuard>
                }
              />
              <Route
                path="/user-dashboard"
                element={
                  <PortGuard target="resident">
                    <ResidentPortalGate>
                      <UserDashboard />
                    </ResidentPortalGate>
                  </PortGuard>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfirmProvider>
  );
}

export default App;
