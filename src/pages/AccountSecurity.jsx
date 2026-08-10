import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  KeyRound,
  Loader2,
  Mail,
  Laptop,
  Globe,
  LogOut,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Phone,
  X,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import {
  getCurrentUserWithProfile,
  updatePassword,
  updateAuthEmail,
  signOutOtherSessions,
  getCurrentSession,
  parseUserAgent,
} from "../services/authService";
import { getSystemSettings, saveSystemSettings, recordAuditEvent } from "../services/adminActivityService";

const passwordChecks = [
  { key: "length", label: "At least 8 characters" },
  { key: "letter", label: "Contains a letter" },
  { key: "number", label: "Contains a number" },
];

const getPasswordState = (password) => ({
  length: password.length >= 8,
  letter: /[A-Za-z]/.test(password),
  number: /\d/.test(password),
});

const AccountSecurity = () => {
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);

  // Password visibility states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // System Contact Info states
  const [officePhone, setOfficePhone] = useState(() => getSystemSettings().officePhone || "09306259795");
  const [savingContact, setSavingContact] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // ─── Sessions State ───────────────────────────────────────────────────────
  const [currentDeviceInfo, setCurrentDeviceInfo] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Auto-clear messages after 6s
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 8000);
    return () => clearTimeout(t);
  }, [error]);

  // ─── Load initial data ────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const loadAccount = async () => {
      try {
        const data = await getCurrentUserWithProfile();
        const settings = getSystemSettings();
        if (isMounted) {
          setCurrentEmail(data?.user?.email || settings.officeEmail || "");
          setOfficePhone(settings.officePhone || "09306259795");
        }

        // Load session info
        const session = await getCurrentSession();
        if (isMounted && session) {
          setSessionInfo(session);
          const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
          setCurrentDeviceInfo(parseUserAgent(ua));
        }
      } catch (accountError) {
        if (isMounted) {
          setError(accountError.message || "Unable to load account security details.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAccount();

    return () => {
      isMounted = false;
    };
  }, []);

  // ─── Password ─────────────────────────────────────────────────────────────
  const updatePasswordForm = (field, value) => {
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setMessage("");
    setError("");

    const checks = getPasswordState(passwordForm.newPassword);
    const isValid = Object.values(checks).every(Boolean);

    try {
      if (!isValid) {
        throw new Error("Password must be at least 8 characters and include a letter and number.");
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      await updatePassword(passwordForm.newPassword);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Password updated successfully.");

      recordAuditEvent({
        module: "Account Security",
        action: "Password changed",
        details: "Admin password was updated successfully.",
        source: "Admin",
      });
    } catch (passwordError) {
      setError(passwordError.message || "Unable to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  // ─── Email ────────────────────────────────────────────────────────────────
  const handleUpdateEmail = async (event) => {
    event.preventDefault();
    const cleanEmail = newEmail.trim();
    if (!cleanEmail) {
      setError("Please enter a new official email address.");
      return;
    }
    setUpdatingEmail(true);
    setMessage("");
    setError("");
    try {
      // Save to system settings — this is the official Barangay contact email
      // (AI assistant & resident portal reflect this immediately via custom event)
      const currentSettings = getSystemSettings();
      saveSystemSettings({
        ...currentSettings,
        officeEmail: cleanEmail,
      });

      // Try updating Supabase Auth user email as well if signed in
      try {
        await updateAuthEmail(cleanEmail);
      } catch (authErr) {
        // If email confirmation is required or auth fails, still save settings
        console.info("Auth email update notice:", authErr.message);
      }

      setCurrentEmail(cleanEmail);
      setMessage(
        `Official email address updated to ${cleanEmail}! This is now dynamically reflected across the resident help center and AI assistant.`
      );
      setNewEmail("");

      recordAuditEvent({
        module: "Account Security",
        action: "Official email updated",
        details: `Official contact email changed to ${cleanEmail}.`,
        source: "Admin",
      });
    } catch (err) {
      setError(err.message || "Unable to update email.");
    } finally {
      setUpdatingEmail(false);
    }
  };

  // ─── Phone ────────────────────────────────────────────────────────────────
  const handleSaveContactDetails = async (event) => {
    event.preventDefault();
    const cleanPhone = officePhone.trim();
    if (!cleanPhone) {
      setError("Please enter a valid phone number.");
      return;
    }
    setSavingContact(true);
    setMessage("");
    setError("");
    try {
      const currentSettings = getSystemSettings();
      saveSystemSettings({
        ...currentSettings,
        officePhone: cleanPhone,
      });
      setMessage(`Official barangay hotline updated to ${cleanPhone}! Changes dynamically updated in resident help section & AI assistant.`);

      recordAuditEvent({
        module: "Account Security",
        action: "Official phone updated",
        details: `Official phone/hotline changed to ${cleanPhone}.`,
        source: "Admin",
      });
    } catch (err) {
      setError(err.message || "Unable to update contact details.");
    } finally {
      setSavingContact(false);
    }
  };

  // ─── Sessions ─────────────────────────────────────────────────────────────
  const handleSignOutOtherDevices = async () => {
    setSigningOutOthers(true);
    setMessage("");
    setError("");
    try {
      await signOutOtherSessions();
      setMessage("All other device sessions have been signed out successfully.");

      recordAuditEvent({
        module: "Account Security",
        action: "Other sessions signed out",
        details: "Admin signed out all other active device sessions.",
        source: "Admin",
      });
    } catch (err) {
      setError(err.message || "Unable to sign out other devices.");
    } finally {
      setSigningOutOthers(false);
    }
  };

  const checks = getPasswordState(passwordForm.newPassword);

  const actions = (
    <Link
      to="/dashboard"
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-rose-600"
    >
      <X size={14} />
      Exit
    </Link>
  );

  return (
    <PageWrapper
      title="Account Security"
      description="Manage administrative password, official email preferences, hotline contact number, and active sessions"
      actions={actions}
    >
      <div className="max-w-4xl space-y-6 pb-20">
        {message ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 shadow-2xs">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{message}</span>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800 shadow-2xs">
            <AlertCircle size={18} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* 1. Change Password */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00552E]/10 text-[#00552E]">
              <KeyRound size={24} />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Change Password</h2>
              <p className="text-sm font-medium text-slate-500">
                Ensure your administrative account uses a strong, unique password.
              </p>
            </div>
          </div>

          <form onSubmit={handlePasswordUpdate} className="mt-6 space-y-5">
            <div className="grid gap-5 md:grid-cols-3">
              <label className="block text-sm font-bold text-slate-700">
                Current Password
                <div className="relative mt-2">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => updatePasswordForm("currentPassword", e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-[#00552E]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                    title={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label className="block text-sm font-bold text-slate-700">
                New Password
                <div className="relative mt-2">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) => updatePasswordForm("newPassword", e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-[#00552E]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                    title={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Confirm Password
                <div className="relative mt-2">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => updatePasswordForm("confirmPassword", e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-[#00552E]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap gap-2">
                {passwordChecks.map((check) => (
                  <span
                    key={check.key}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                      checks[check.key]
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <CheckCircle2 size={12} className={checks[check.key] ? "text-emerald-600" : "opacity-30"} />
                    {check.label}
                  </span>
                ))}
              </div>

              <button
                type="submit"
                disabled={savingPassword || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#00552E] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#004224] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPassword ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Password
              </button>
            </div>
          </form>
        </section>

        {/* 2. Official Barangay Email Address */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00552E]/10 text-[#00552E]">
              <Mail size={24} />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Official Email Address</h2>
              <p className="text-sm font-medium text-slate-500">
                Update the official Barangay contact email. Changes dynamically sync to resident help section & AI assistant.
              </p>
            </div>
          </div>

          <form onSubmit={handleUpdateEmail} className="mt-6 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700">
                Current Active Email
                <input
                  type="email"
                  value={currentEmail}
                  readOnly
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-sm font-semibold text-slate-600 outline-none"
                />
              </label>

              <label className="block text-sm font-bold text-slate-700">
                New Official Email
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. secretary.uppermingading@gmail.com"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-[#00552E]/20"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={updatingEmail || !newEmail}
                className="inline-flex items-center gap-2 rounded-xl bg-[#00552E] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#004224] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updatingEmail ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Official Email
              </button>
            </div>
          </form>
        </section>

        {/* 3. Official Barangay Hotline Contact Number */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00552E]/10 text-[#00552E]">
              <Phone size={24} />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Official Barangay Contact Number</h2>
              <p className="text-sm font-medium text-slate-500">
                Update the official Barangay contact hotline (e.g. Secretary / Emergency contact). Automatically updates in resident help sections & AI assistant!
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveContactDetails} className="mt-6 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700">
                Official Phone Number / Hotline
                <input
                  type="text"
                  value={officePhone}
                  onChange={(e) => setOfficePhone(e.target.value)}
                  placeholder="e.g. 09306259795"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-[#00552E]/20"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={savingContact || !officePhone}
                className="inline-flex items-center gap-2 rounded-xl bg-[#00552E] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#004224] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingContact ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Update Official Phone Number
              </button>
            </div>
          </form>
        </section>

        {/* 4. Active Login Sessions */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00552E]/10 text-[#00552E]">
                <Globe size={24} />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Active Login Sessions</h2>
                <p className="text-sm font-medium text-slate-500">
                  Review and manage devices currently signed into your administrative account.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOutOtherDevices}
              disabled={signingOutOthers}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100/80 disabled:opacity-60"
            >
              {signingOutOthers ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Sign Out Other Devices
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {/* Current Device — real session data */}
            <div className="flex items-center justify-between rounded-2xl border border-[#00552E]/20 bg-[#00552E]/5 p-4">
              <div className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00552E] text-white shadow-xs">
                  <Laptop size={20} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-extrabold text-slate-900">
                      {currentDeviceInfo?.device || "Unknown Device"}
                    </p>
                    <span className="rounded-full bg-[#00552E] px-2.5 py-0.5 text-[10px] font-extrabold text-white">
                      Current Device
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    {sessionInfo?.created_at
                      ? `Session started ${new Date(sessionInfo.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "Active now"}
                    {" • "}Active now
                  </p>
                </div>
              </div>
              <span className="hidden text-xs font-bold text-emerald-800 sm:flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </span>
            </div>

            {/* Info notice about other sessions */}
            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-blue-500" />
              <div>
                <p className="text-xs font-bold text-blue-800">About Other Sessions</p>
                <p className="mt-0.5 text-[11px] text-blue-700/80 leading-relaxed">
                  For security, individual session details for other devices are not exposed client-side.
                  Use the <strong>"Sign Out Other Devices"</strong> button above to terminate all other active sessions at once.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageWrapper>
  );
};

export default AccountSecurity;
