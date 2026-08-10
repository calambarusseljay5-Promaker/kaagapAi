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
import "./App.css";

const PortGuard = ({ target, children }) => {
  const currentPort = typeof window !== "undefined" ? window.location.port : "";
  const isResidentPort = currentPort === "5174" || currentPort === "3000";
  const isAdminPort = currentPort === "5173";

  // Strict Lock: Resident Port (5174) cannot open Admin routes
  if (isResidentPort && target === "admin") {
    return <Navigate to="/resident-dashboard" replace />;
  }

  // Strict Lock: Admin Port (5173) cannot open Resident routes
  if (isAdminPort && target === "resident") {
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

function App() {
  return (
    <ConfirmProvider>
      <BrowserRouter>
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/goodbye" element={<Goodbye />} />

        {/* Shared welcome transition */}
        <Route element={<ProtectedRoute requiredRole={["admin", "resident", "user"]} />}>
          <Route path="/welcome" element={<Welcome />} />
        </Route>

        {/* Admin Routes (Strictly locked to Port 5173 / Admin server) */}
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

        {/* Resident/User Routes (Strictly locked to Port 5174 / Resident server) */}
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
