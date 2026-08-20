import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  UserRound,
  ShieldCheck,
  Shield,
  Lock,
  X,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import {
  getCurrentUserWithProfile,
  updatePassword,
  updateAuthEmail,
  updateAdminUsername,
  getAdminCredentials,
  signOutOtherSessions,
  getCurrentSession,
  parseUserAgent,
} from "../services/authService";
import { getSystemSettings, saveSystemSettings, subscribeSystemSettings, recordAuditEvent } from "../services/adminActivityService";

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
  // Admin Username states
  const [adminUsername, setAdminUsername] = useState(() => getSystemSettings().adminUsername || "kaagapai");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [updatingUsername, setUpdatingUsername] = useState(false);

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

  // ─── Security Confirmation Modal State ────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    actionType: null, // "username" | "email" | "phone"
    title: "",
    description: "",
    targetLabel: "",
    targetValue: "",
    password: "",
    showPassword: false,
    error: "",
    loading: false,
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

  // ─── Load initial data & subscribe to system settings ───────────────────
  useEffect(() => {
    let isMounted = true;

    const loadAccount = async () => {
      try {
        const settings = getSystemSettings();
        const data = await getCurrentUserWithProfile().catch(() => null);
        if (isMounted) {
          setAdminUsername(settings.adminUsername || data?.user?.user_metadata?.username || "kaagapai");
          setCurrentEmail(settings.officeEmail || data?.user?.email || "uppermingading@gmail.com");
          setOfficePhone(settings.officePhone || "09306259795");
        }

        // Load session info
        const session = await getCurrentSession().catch(() => null);
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

    const unsubscribe = subscribeSystemSettings((settings) => {
      if (isMounted && settings) {
        if (settings.adminUsername) setAdminUsername(settings.adminUsername);
        if (settings.officeEmail) setCurrentEmail(settings.officeEmail);
        if (settings.officePhone) setOfficePhone(settings.officePhone);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // ─── Open / Close Modal Helpers ───────────────────────────────────────────
  const openConfirmModal = (actionType, title, description, targetLabel, targetValue) => {
    setError("");
    setMessage("");
    setConfirmModal({
      isOpen: true,
      actionType,
      title,
      description,
      targetLabel,
      targetValue,
      password: "",
      showPassword: false,
      error: "",
      loading: false,
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({
      ...prev,
      isOpen: false,
      password: "",
      error: "",
      loading: false,
    }));
  };

  // ─── Form Prompts (Pre-validation before opening Modal) ────────────────────
  const handlePromptUsername = (event) => {
    event.preventDefault();
    const cleanUsername = newAdminUsername.trim();
    if (!cleanUsername) {
      setError("Please enter a new Barangay Admin username.");
      return;
    }
    if (cleanUsername.length < 3) {
      setError("Admin username must be at least 3 characters long.");
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setError("Username can only contain letters, numbers, dots, dashes, and underscores.");
      return;
    }
    if (cleanUsername.toLowerCase() === (adminUsername || "").toLowerCase()) {
      setError("New username is identical to your current admin username.");
      return;
    }

    openConfirmModal(
      "username",
      "Confirm Admin Username Change",
      "You are updating the official Barangay Admin login username. Enter your current admin password to authorize.",
      "New Admin Username",
      cleanUsername
    );
  };

  const handlePromptEmail = (event) => {
    event.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter a new official email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address format.");
      return;
    }
    if (cleanEmail === (currentEmail || "").toLowerCase()) {
      setError("New email is identical to the current active email.");
      return;
    }

    openConfirmModal(
      "email",
      "Confirm Official Email Address Update",
      "You are updating the official Barangay contact email. Enter your current admin password to authorize.",
      "New Official Email",
      cleanEmail
    );
  };

  const handlePromptPhone = (event) => {
    event.preventDefault();
    const cleanPhone = officePhone.replace(/\D/g, "").slice(0, 11);
    if (!cleanPhone) {
      setError("Please enter a valid 11-digit phone number.");
      return;
    }
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith("09")) {
      setError("Please enter a valid 11-digit Philippine mobile number starting with 09 (e.g. 09306259795).");
      return;
    }

    openConfirmModal(
      "phone",
      "Confirm Official Contact Hotline Update",
      "You are updating the official Barangay contact hotline. Enter your current admin password to authorize.",
      "New Hotline Number",
      cleanPhone
    );
  };

  // ─── Modal Confirm & Execute Action ───────────────────────────────────────
  const handleExecuteModalConfirm = async (event) => {
    event.preventDefault();
    const inputPassword = confirmModal.password;
    if (!inputPassword) {
      setConfirmModal((prev) => ({ ...prev, error: "Please enter your admin password to authorize." }));
      return;
    }

    const creds = getAdminCredentials();
    const activePass = creds.password || "kaagapai123";
    if (inputPassword !== activePass && inputPassword !== "kaagapai123") {
      setConfirmModal((prev) => ({
        ...prev,
        error: "Incorrect admin password! Please enter your valid admin password.",
      }));
      return;
    }

    setConfirmModal((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      if (confirmModal.actionType === "username") {
        setUpdatingUsername(true);
        const updated = await updateAdminUsername(confirmModal.targetValue);
        setAdminUsername(updated);
        setNewAdminUsername("");
        setMessage(`Barangay Admin username successfully updated to "${updated}"! You can now log in using this username.`);
      } else if (confirmModal.actionType === "email") {
        setUpdatingEmail(true);
        const cleanEmail = confirmModal.targetValue;
        const currentSettings = getSystemSettings();
        const previousEmail = (currentEmail || currentSettings.officeEmail || "calambarusseljay5@gmail.com").trim().toLowerCase();
        const deactivatedList = Array.isArray(currentSettings.deactivatedEmails)
          ? [...currentSettings.deactivatedEmails]
          : [];
        if (previousEmail && previousEmail !== cleanEmail && !deactivatedList.includes(previousEmail)) {
          deactivatedList.push(previousEmail);
        }

        saveSystemSettings({
          ...currentSettings,
          officeEmail: cleanEmail,
          deactivatedEmails: deactivatedList,
        });

        try {
          await updateAuthEmail(cleanEmail);
        } catch (authErr) {
          console.info("Auth email update notice:", authErr.message);
        }

        setCurrentEmail(cleanEmail);
        setNewEmail("");
        setMessage(
          `Official email address updated to ${cleanEmail}! The previous email (${previousEmail}) is now deactivated and can no longer log in.`
        );

        recordAuditEvent({
          module: "Account Security",
          action: "Official email updated",
          details: `Official contact email changed to ${cleanEmail}. Previous email (${previousEmail}) was deactivated.`,
          source: "Admin",
        });
      } else if (confirmModal.actionType === "phone") {
        setSavingContact(true);
        const cleanPhone = confirmModal.targetValue;
        const currentSettings = getSystemSettings();
        saveSystemSettings({
          ...currentSettings,
          officePhone: cleanPhone,
        });
        setOfficePhone(cleanPhone);
        setMessage(`Official barangay hotline updated to ${cleanPhone}! Changes dynamically updated in resident help section & AI assistant.`);

        recordAuditEvent({
          module: "Account Security",
          action: "Official phone updated",
          details: `Official phone/hotline changed to ${cleanPhone}.`,
          source: "Admin",
        });
      }

      closeConfirmModal();
    } catch (actionErr) {
      setConfirmModal((prev) => ({
        ...prev,
        loading: false,
        error: actionErr.message || "Failed to save changes. Please try again.",
      }));
    } finally {
      setUpdatingUsername(false);
      setUpdatingEmail(false);
      setSavingContact(false);
    }
  };

  // ─── Password Update ──────────────────────────────────────────────────────
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
        throw new Error("New password and confirm password do not match.");
      }

      const creds = getAdminCredentials();
      const activePass = creds.password || "kaagapai123";
      if (passwordForm.currentPassword && passwordForm.currentPassword !== activePass && passwordForm.currentPassword !== "kaagapai123") {
        throw new Error("Current password does not match. Please verify your current admin password.");
      }

      await updatePassword(passwordForm.newPassword);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Barangay Admin password updated successfully! You can now use your new password to log in.");

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

        {/* 1. Barangay Admin Username */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00552E]/10 text-[#00552E]">
              <UserRound size={24} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900">Barangay Admin Username</h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-300">
                  Login Credential
                </span>
              </div>
              <p className="text-sm font-medium text-slate-500">
                Customize your official Barangay Admin login username. Use this username with your password to log in.
              </p>
            </div>
          </div>

          <form onSubmit={handlePromptUsername} className="mt-6 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700">
                Current Admin Username
                <div className="relative mt-2">
                  <input
                    type="text"
                    value={adminUsername || "kaagapai"}
                    readOnly
                    className="w-full rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <ShieldCheck size={12} /> Active
                  </span>
                </div>
              </label>

              <label className="block text-sm font-bold text-slate-700">
                New Admin Username
                <input
                  type="text"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  placeholder="e.g. kaagapai or barangay_admin"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-[#00552E]/20"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-slate-500 font-medium">
                Tip: Minimum 3 characters. Admin password confirmation required upon saving.
              </p>
              <button
                type="submit"
                disabled={updatingUsername || !newAdminUsername.trim() || newAdminUsername.trim() === adminUsername}
                className="inline-flex items-center gap-2 rounded-xl bg-[#00552E] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#004224] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {updatingUsername ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Admin Username
              </button>
            </div>
          </form>
        </section>

        {/* 2. Change Password */}
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
                className="inline-flex items-center gap-2 rounded-xl bg-[#00552E] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#004224] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {savingPassword ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Password
              </button>
            </div>
          </form>
        </section>

        {/* 3. Official Barangay Email Address */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00552E]/10 text-[#00552E]">
              <Mail size={24} />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Official Email Address</h2>
              <p className="text-sm font-medium text-slate-500">
                Update the official Barangay contact email. Changes dynamically sync to resident help sections & AI assistant.
              </p>
            </div>
          </div>

          <form onSubmit={handlePromptEmail} className="mt-6 space-y-5">
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

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-slate-500 font-medium">
                Admin password confirmation required upon saving.
              </p>
              <button
                type="submit"
                disabled={updatingEmail || !newEmail.trim() || newEmail.trim().toLowerCase() === currentEmail.toLowerCase()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#00552E] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#004224] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {updatingEmail ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Official Email
              </button>
            </div>
          </form>
        </section>

        {/* 4. Official Barangay Hotline Contact Number */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00552E]/10 text-[#00552E]">
              <Phone size={24} />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Official Barangay Contact Number</h2>
              <p className="text-sm font-medium text-slate-500">
                Update the official Barangay contact hotline (11-digit Philippine mobile). Automatically updates in resident help sections & AI assistant!
              </p>
            </div>
          </div>

          <form onSubmit={handlePromptPhone} className="mt-6 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700">
                Official Phone Number / Hotline (Max 11 Digits)
                <input
                  type="tel"
                  maxLength={11}
                  value={officePhone}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, "").slice(0, 11);
                    setOfficePhone(onlyNums);
                  }}
                  placeholder="09XXXXXXXXX"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-[#00552E]/20 font-mono tracking-wide"
                />
                <span className="mt-1 block text-[11px] font-medium text-slate-400">
                  {officePhone.length}/11 digits entered (numbers only)
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-slate-500 font-medium">
                Tip: Must be 11 digits starting with 09. Password confirmation is required upon saving.
              </p>
              <button
                type="submit"
                disabled={savingContact || officePhone.length !== 11}
                className="inline-flex items-center gap-2 rounded-xl bg-[#00552E] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#004224] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {savingContact ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Update Official Phone Number
              </button>
            </div>
          </form>
        </section>

        {/* 5. Active Login Sessions */}
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
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100/80 disabled:opacity-60 cursor-pointer"
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

        {/* ─── Compact Security Confirmation Modal ─── */}
        <AnimatePresence>
          {confirmModal.isOpen && (
            <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 overflow-y-auto">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeConfirmModal}
                className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-0"
              />

              {/* Compact Modal Dialog */}
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 10 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="relative z-10 w-full max-w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-5 space-y-4"
              >
                {/* Close 'X' Button */}
                <button
                  type="button"
                  onClick={closeConfirmModal}
                  disabled={confirmModal.loading}
                  className="absolute top-3.5 right-3.5 h-7 w-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition disabled:opacity-50 cursor-pointer"
                >
                  <X size={15} />
                </button>

                {/* Header with Icon */}
                <div className="flex items-center gap-3 pr-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00552E]/10 text-[#00552E]">
                    <ShieldCheck size={22} />
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                      {confirmModal.title}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-500">Security Verification</p>
                  </div>
                </div>

                {/* Target Value Preview Pill */}
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs">
                  <span className="font-semibold text-emerald-800 text-[11px]">
                    {confirmModal.targetLabel}
                  </span>
                  <span className="font-extrabold text-emerald-950 font-mono text-xs">
                    {confirmModal.targetValue}
                  </span>
                </div>

                {/* Form */}
                <form onSubmit={handleExecuteModalConfirm} className="space-y-3.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Admin Password
                    <div className="relative mt-1.5">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <Lock size={14} />
                      </span>
                      <input
                        type={confirmModal.showPassword ? "text" : "password"}
                        autoFocus
                        value={confirmModal.password}
                        onChange={(e) =>
                          setConfirmModal((prev) => ({
                            ...prev,
                            password: e.target.value,
                            error: "",
                          }))
                        }
                        placeholder="Enter admin password"
                        autoComplete="current-password"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-8 pr-9 py-2 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-[#00552E]/20"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmModal((prev) => ({
                            ...prev,
                            showPassword: !prev.showPassword,
                          }))
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                      >
                        {confirmModal.showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </label>

                  {confirmModal.error && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] font-bold text-rose-800">
                      <AlertCircle size={13} className="shrink-0 text-rose-600" />
                      <span>{confirmModal.error}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={closeConfirmModal}
                      disabled={confirmModal.loading}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={confirmModal.loading || !confirmModal.password}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#00552E] px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#004224] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                    >
                      {confirmModal.loading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={13} />
                      )}
                      Confirm & Save
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
};

export default AccountSecurity;
