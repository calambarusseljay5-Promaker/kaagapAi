import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import ResidentsManagement from "./pages/ResidentsManagement";
import ResidentActivationRequests from "./pages/ResidentActivationRequests";
import ResidentProfileUpdateRequests from "./pages/ResidentProfileUpdateRequests";
import Archive from "./pages/Archive";
import DocumentManagement from "./pages/DocumentManagement";
import Reports from "./pages/Reports";
import Livelihood from "./pages/Livelihood";
import Announcements from "./pages/Announcements";
import AIKnowledge from "./pages/AIKnowledge";
import OrganizationChart from "./pages/OrganizationChart";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import AuditLogs from "./pages/AuditLogs";
import ProfileSettings from "./pages/ProfileSettings";
import AccountSecurity from "./pages/AccountSecurity";
import ResetPassword from "./pages/ResetPassword";
import Login from "./pages/Login";
import UserDashboard from "./pages/UserDashboard";
import Welcome from "./pages/Welcome";
import Goodbye from "./pages/Goodbye";
import ProtectedRoute from "./components/ProtectedRoute";
import RecycleBin from "./pages/RecycleBin";
import { getSystemSettings } from "./services/adminActivityService";
import { ConfirmProvider } from "./context/ConfirmContext";
import { isTargetAdminPortal, isTargetResidentPortal } from "./utils/authRoutes";
import "./App.css";

const PortGuard = ({ target, children }) => {
  const isAdmin = isTargetAdminPortal();
  const isResident = isTargetResidentPortal();

  // Strict Lock: Resident Port/Domain cannot open Admin routes
  if (isResident && target === "admin") {
    return <Navigate to="/resident-dashboard" replace />;
  }

  // Strict Lock: Admin Port/Domain cannot open Resident routes
  if (isAdmin && target === "resident") {
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
  return <Login portalMode={isAdmin ? "admin" : "resident"} />;
};

function App() {
  return (
    <ConfirmProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes - Auto-detected based on Port / Subdomain / Explicit Route */}
          <Route path="/" element={<RootPortal />} />
          <Route path="/login" element={<RootPortal />} />
          <Route path="/portal" element={<Login portalMode="resident" />} />

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
      </BrowserRouter>
    </ConfirmProvider>
  );
}

export default App;
