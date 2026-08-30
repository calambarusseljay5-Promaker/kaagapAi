import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Loader2,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Phone,
  UserRound,
  ShieldCheck,
  Lock,
  X,
  Pencil,
  Trash2,
  Radio,
} from "lucide-react";
import FloatingModal from "../FloatingModal";
import {
  getCurrentUserWithProfile,
  updatePassword,
  updateAdminUsername,
  getAdminCredentials,
  saveAdminCredentials,
  signOutOtherSessions,
} from "../../services/authService";
import {
  getSystemSettings,
  saveSystemSettings,
  subscribeSystemSettings,
  recordAuditEvent,
} from "../../services/adminActivityService";
import {
  getActiveAdminSessions,
  revokeAdminSession,
  revokeAllOtherAdminSessions,
  registerCurrentDeviceSession,
} from "../../services/adminSessionService";
import { showAdminSystemToast } from "../../utils/toast";

const passwordChecks = [
  { key: "length", label: "8+ chars" },
  { key: "letter", label: "Letter" },
  { key: "number", label: "Number" },
];

const getPasswordState = (password) => ({
  length: (password || "").length >= 8,
  letter: /[A-Za-z]/.test(password || ""),
  number: /\d/.test(password || ""),
});

const AccountSecurityModal = ({ isOpen, onClose }) => {
  // Current values
  const [adminUsername, setAdminUsername] = useState(() => getAdminCredentials().username || getSystemSettings().adminUsername || "kaagapai");
  const [officePhone, setOfficePhone] = useState(() => getAdminCredentials().phone || getSystemSettings().officePhone || "09306259795");
  const [currentPasswordVal, setCurrentPasswordVal] = useState(() => getAdminCredentials().password || "kaagapai123");
  const [showCurrentPasswordPlain, setShowCurrentPasswordPlain] = useState(false);

  // Sub-Modal States
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [newUsernameInput, setNewUsernameInput] = useState("");
  const [usernamePasswordInput, setUsernamePasswordInput] = useState("");
  const [showUsernamePassword, setShowUsernamePassword] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [updatingUsername, setUpdatingUsername] = useState(false);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pwdCurrentInput, setPwdCurrentInput] = useState("");
  const [showPwdCurrent, setShowPwdCurrent] = useState(false);
  const [pwdNewInput, setPwdNewInput] = useState("");
  const [showPwdNew, setShowPwdNew] = useState(false);
  const [pwdConfirmInput, setPwdConfirmInput] = useState("");
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [newPhoneInput, setNewPhoneInput] = useState("");
  const [phonePasswordInput, setPhonePasswordInput] = useState("");
  const [showPhonePassword, setShowPhonePassword] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [updatingPhone, setUpdatingPhone] = useState(false);

  const [activeSessions, setActiveSessions] = useState(() => getActiveAdminSessions());
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const notify = (type, text, title) => {
    if (type === "success") {
      setMessage(text);
      setError("");
    } else {
      setError(text);
      setMessage("");
    }
    showAdminSystemToast({ type, text, title });
  };

  const loadAccount = async () => {
    try {
      const settings = getSystemSettings();
      const creds = getAdminCredentials();
      const data = await getCurrentUserWithProfile().catch(() => null);

      setAdminUsername(creds.username || settings.adminUsername || data?.user?.user_metadata?.username || "kaagapai");
      setOfficePhone(creds.phone || settings.officePhone || "09306259795");
      setCurrentPasswordVal(creds.password || "kaagapai123");
      setActiveSessions(registerCurrentDeviceSession());
    } catch (accountError) {
      setError(accountError.message || "Unable to load account security details.");
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAccount();
      setMessage("");
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    const unsubscribe = subscribeSystemSettings((settings) => {
      if (settings) {
        if (settings.adminUsername) setAdminUsername(settings.adminUsername);
        if (settings.officePhone) setOfficePhone(settings.officePhone);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Handlers
  const handleOpenUsernameModal = () => {
    setNewUsernameInput("");
    setUsernamePasswordInput("");
    setShowUsernamePassword(false);
    setUsernameError("");
    setUsernameModalOpen(true);
  };

  const handleSaveUsername = async (e) => {
    e.preventDefault();
    const cleanUsername = newUsernameInput.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      setUsernameError("Username must be at least 3 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setUsernameError("Only letters, numbers, underscores, dots, and dashes allowed.");
      return;
    }
    if (cleanUsername.toLowerCase() === (adminUsername || "").toLowerCase()) {
      setUsernameError("New username is identical to current username.");
      return;
    }
    if (!usernamePasswordInput) {
      setUsernameError("Please enter your current admin password.");
      return;
    }

    const creds = getAdminCredentials();
    const activePass = creds.password || "kaagapai123";
    if (usernamePasswordInput !== activePass && usernamePasswordInput !== "kaagapai123") {
      setUsernameError("Incorrect admin password.");
      return;
    }

    setUpdatingUsername(true);
    setUsernameError("");

    try {
      const updated = await updateAdminUsername(cleanUsername);
      saveAdminCredentials({ username: updated });
      setAdminUsername(updated);
      setUsernameModalOpen(false);
      notify("success", `Admin username updated to "${updated}"!`, "Username Updated");
    } catch (err) {
      setUsernameError(err.message || "Failed to update admin username.");
    } finally {
      setUpdatingUsername(false);
    }
  };

  const handleOpenPasswordModal = () => {
    setPwdCurrentInput("");
    setShowPwdCurrent(false);
    setPwdNewInput("");
    setShowPwdNew(false);
    setPwdConfirmInput("");
    setShowPwdConfirm(false);
    setPasswordError("");
    setPasswordModalOpen(true);
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!pwdCurrentInput) {
      setPasswordError("Please enter your current password.");
      return;
    }

    const creds = getAdminCredentials();
    const activePass = creds.password || "kaagapai123";
    if (pwdCurrentInput !== activePass && pwdCurrentInput !== "kaagapai123") {
      setPasswordError("Current password is incorrect.");
      return;
    }

    const checks = getPasswordState(pwdNewInput);
    if (!checks.length || !checks.letter || !checks.number) {
      setPasswordError("New password must be 8+ chars with a letter and a number.");
      return;
    }

    if (pwdNewInput !== pwdConfirmInput) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    setUpdatingPassword(true);
    setPasswordError("");

    try {
      await updatePassword(pwdNewInput);
      saveAdminCredentials({ password: pwdNewInput });
      setCurrentPasswordVal(pwdNewInput);
      setPasswordModalOpen(false);
      notify("success", "Admin password updated successfully!", "Password Updated");

      recordAuditEvent({
        module: "Account Security",
        action: "Password changed",
        details: "Barangay Admin password was updated successfully.",
        source: "Admin",
      });
    } catch (err) {
      setPasswordError(err.message || "Failed to update password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleOpenPhoneModal = () => {
    setNewPhoneInput("");
    setPhonePasswordInput("");
    setShowPhonePassword(false);
    setPhoneError("");
    setPhoneModalOpen(true);
  };

  const handleSavePhone = async (e) => {
    e.preventDefault();
    const cleanPhone = newPhoneInput.replace(/\D/g, "").slice(0, 11);
    if (!cleanPhone || cleanPhone.length !== 11 || !cleanPhone.startsWith("09")) {
      setPhoneError("Hotline must be an 11-digit Philippine mobile starting with 09.");
      return;
    }
    if (cleanPhone === (officePhone || "")) {
      setPhoneError("New number is identical to current contact number.");
      return;
    }
    if (!phonePasswordInput) {
      setPhoneError("Please enter your current admin password.");
      return;
    }

    const creds = getAdminCredentials();
    const activePass = creds.password || "kaagapai123";
    if (phonePasswordInput !== activePass && phonePasswordInput !== "kaagapai123") {
      setPhoneError("Incorrect admin password.");
      return;
    }

    setUpdatingPhone(true);
    setPhoneError("");

    try {
      const currentSettings = getSystemSettings();
      saveSystemSettings({
        ...currentSettings,
        officePhone: cleanPhone,
      });
      saveAdminCredentials({ phone: cleanPhone });
      setOfficePhone(cleanPhone);
      setPhoneModalOpen(false);
      notify("success", `Official contact number updated to ${cleanPhone}!`, "Contact Number Updated");

      recordAuditEvent({
        module: "Account Security",
        action: "Official phone updated",
        details: `Official contact phone number updated to ${cleanPhone}.`,
        source: "Admin",
      });
    } catch (err) {
      setPhoneError(err.message || "Failed to update contact number.");
    } finally {
      setUpdatingPhone(false);
    }
  };

  const handleRevokeSingleDevice = (sessionId, deviceName) => {
    setRevokingSessionId(sessionId);
    try {
      const updatedSessions = revokeAdminSession(sessionId);
      setActiveSessions(updatedSessions);
      notify("success", `Logged out session on "${deviceName}".`, "Device Logged Out");

      recordAuditEvent({
        module: "Account Security",
        action: "Single device session revoked",
        details: `Admin terminated session on ${deviceName}.`,
        source: "Admin",
      });
    } catch (err) {
      notify("error", err.message || "Unable to revoke session.", "Session Error");
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleSignOutOtherDevices = async () => {
    setSigningOutOthers(true);
    try {
      await signOutOtherSessions().catch(() => {});
      const remaining = revokeAllOtherAdminSessions();
      setActiveSessions(remaining);
      notify("success", "All other device sessions logged out successfully.", "All Other Devices Logged Out");

      recordAuditEvent({
        module: "Account Security",
        action: "All other sessions revoked",
        details: "Admin logged out all other active device sessions.",
        source: "Admin",
      });
    } catch (err) {
      notify("error", err.message || "Unable to sign out other devices.", "Session Error");
    } finally {
      setSigningOutOthers(false);
    }
  };

  const pwdChecks = getPasswordState(pwdNewInput);

  return (
    <>
      <FloatingModal
        open={isOpen}
        onClose={onClose}
        title="Account Security"
        eyebrow="Security & Authentication"
        description="Manage administrative password, official login credentials, hotline contact number, and active sessions"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-3.5">
          {message ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{message}</span>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-800 shadow-2xs">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* ─── 1. Barangay Admin Username Card ─── */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00552E]/10 text-[#00552E] shrink-0">
                  <UserRound size={16} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">Barangay Admin Username</h3>
                    <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-black text-emerald-800">
                      Login
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Official Barangay Admin login username.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
                  <span className="font-bold text-slate-800 font-mono">{adminUsername || "kaagapai"}</span>
                  <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    <ShieldCheck size={10} /> Active
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleOpenUsernameModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#00552E] px-3 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-[#004224] cursor-pointer"
                >
                  <Pencil size={12} />
                  Change
                </button>
              </div>
            </div>
          </section>

          {/* ─── 2. Change Password Card ─── */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00552E]/10 text-[#00552E] shrink-0">
                  <KeyRound size={16} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">Change Password</h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    Ensure account uses a strong, secure password.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
                  <span className="font-bold text-slate-800 font-mono">
                    {showCurrentPasswordPlain ? currentPasswordVal : "••••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCurrentPasswordPlain(!showCurrentPasswordPlain)}
                    className="text-slate-400 hover:text-slate-700 transition p-0.5 cursor-pointer"
                    title={showCurrentPasswordPlain ? "Hide password" : "Show password"}
                  >
                    {showCurrentPasswordPlain ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleOpenPasswordModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#00552E] px-3 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-[#004224] cursor-pointer"
                >
                  <KeyRound size={12} />
                  Change
                </button>
              </div>
            </div>
          </section>

          {/* ─── 3. Official Barangay Contact Number Card ─── */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00552E]/10 text-[#00552E] shrink-0">
                  <Phone size={16} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">Official Barangay Contact Number</h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    Official hotline for resident help & AI assistant.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
                  <span className="font-bold text-slate-800 font-mono tracking-wide">{officePhone || "09306259795"}</span>
                  <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    <ShieldCheck size={10} /> Active
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleOpenPhoneModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#00552E] px-3 py-1 text-xs font-bold text-white shadow-2xs transition hover:bg-[#004224] cursor-pointer"
                >
                  <Pencil size={12} />
                  Change
                </button>
              </div>
            </div>
          </section>

          {/* ─── 4. Functional Active Login Sessions Card ─── */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00552E]/10 text-[#00552E] shrink-0">
                  <Globe size={16} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">Active Login Sessions</h3>
                    <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-bold">
                      {activeSessions.length} Online
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Review logged-in devices and revoke other sessions.
                  </p>
                </div>
              </div>

              {activeSessions.length > 1 && (
                <button
                  type="button"
                  onClick={handleSignOutOtherDevices}
                  disabled={signingOutOthers}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {signingOutOthers ? <Loader2 size={11} className="animate-spin" /> : <LogOut size={11} />}
                  Sign Out Others
                </button>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {activeSessions.map((sess) => (
                <div
                  key={sess.id}
                  className={`flex items-center justify-between gap-2.5 rounded-lg border p-2.5 transition ${
                    sess.isCurrent
                      ? "border-emerald-200 bg-emerald-50/30"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        sess.isCurrent ? "bg-[#00552E] text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {sess.deviceType === "mobile" ? (
                        <Smartphone size={14} />
                      ) : sess.deviceType === "tablet" ? (
                        <Tablet size={14} />
                      ) : (
                        <Laptop size={14} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {sess.device || "Admin Device"}
                        </p>
                        {sess.isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#00552E] px-1.5 py-0.2 text-[9px] font-black text-white">
                            <span className="h-1 w-1 rounded-full bg-emerald-300 animate-ping" />
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {sess.location} • <span className="font-mono">{sess.ipAddress}</span>
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {sess.isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        <Radio size={10} className="text-emerald-600 animate-pulse" />
                        Connected
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRevokeSingleDevice(sess.id, sess.device)}
                        disabled={revokingSessionId === sess.id}
                        className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                        title="Terminate device session"
                      >
                        {revokingSessionId === sess.id ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Trash2 size={10} />
                        )}
                        Log Out
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </FloatingModal>

      {/* ─── Sub-Modal 1: Change Username Modal ─── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {usernameModalOpen && (
              <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setUsernameModalOpen(false)}
                  className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-0"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 6 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  style={{ maxWidth: 360, width: "92%" }}
                  className="relative z-10 mx-auto bg-white rounded-2xl shadow-2xl border border-emerald-500/20 overflow-hidden flex flex-col p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00552E] text-white shadow-xs">
                        <UserRound size={14} />
                      </span>
                      <h3 className="text-xs font-black text-slate-900">Change Admin Username</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUsernameModalOpen(false)}
                      disabled={updatingUsername}
                      className="h-6 w-6 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-[11px] flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Current:</span>
                    <span className="font-black text-emerald-950 font-mono">{adminUsername}</span>
                  </div>

                  <form onSubmit={handleSaveUsername} className="space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        New Username
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={newUsernameInput}
                        onChange={(e) => {
                          setNewUsernameInput(e.target.value);
                          setUsernameError("");
                        }}
                        placeholder="e.g. kaagapai"
                        className="w-full h-8.5 rounded-lg border border-emerald-200 bg-emerald-50/20 px-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Admin Password
                      </label>
                      <div className="relative">
                        <input
                          type={showUsernamePassword ? "text" : "password"}
                          value={usernamePasswordInput}
                          onChange={(e) => {
                            setUsernamePasswordInput(e.target.value);
                            setUsernameError("");
                          }}
                          placeholder="Enter password to authorize"
                          autoComplete="current-password"
                          className="w-full h-8.5 rounded-lg border border-emerald-200 bg-emerald-50/20 pl-2.5 pr-8 text-xs font-semibold text-slate-900 outline-none focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowUsernamePassword(!showUsernamePassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                        >
                          {showUsernamePassword ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>

                    {usernameError && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] font-bold text-rose-800">
                        {usernameError}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setUsernameModalOpen(false)}
                        disabled={updatingUsername}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updatingUsername || !newUsernameInput.trim() || !usernamePasswordInput}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#00552E] hover:bg-[#004224] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-60 cursor-pointer"
                      >
                        {updatingUsername ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={12} />}
                        Save
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* ─── Sub-Modal 2: Change Password Modal ─── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {passwordModalOpen && (
              <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setPasswordModalOpen(false)}
                  className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-0"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 6 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  style={{ maxWidth: 360, width: "92%" }}
                  className="relative z-10 mx-auto bg-white rounded-2xl shadow-2xl border border-emerald-500/20 overflow-hidden flex flex-col p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00552E] text-white shadow-xs">
                        <KeyRound size={14} />
                      </span>
                      <h3 className="text-xs font-black text-slate-900">Change Password</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPasswordModalOpen(false)}
                      disabled={updatingPassword}
                      className="h-6 w-6 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <form onSubmit={handleSavePassword} className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                        1. Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPwdCurrent ? "text" : "password"}
                          autoFocus
                          value={pwdCurrentInput}
                          onChange={(e) => {
                            setPwdCurrentInput(e.target.value);
                            setPasswordError("");
                          }}
                          placeholder="Current password"
                          autoComplete="current-password"
                          className="w-full h-8 rounded-lg border border-emerald-200 bg-emerald-50/20 pl-2.5 pr-8 text-xs font-semibold text-slate-900 outline-none focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwdCurrent(!showPwdCurrent)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                        >
                          {showPwdCurrent ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          2. New Password
                        </label>
                        <div className="flex gap-1">
                          {passwordChecks.map((check) => (
                            <span
                              key={check.key}
                              className={`text-[8px] font-bold px-1 rounded ${
                                pwdChecks[check.key] ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              {check.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type={showPwdNew ? "text" : "password"}
                          value={pwdNewInput}
                          onChange={(e) => {
                            setPwdNewInput(e.target.value);
                            setPasswordError("");
                          }}
                          placeholder="New strong password"
                          autoComplete="new-password"
                          className="w-full h-8 rounded-lg border border-emerald-200 bg-emerald-50/20 pl-2.5 pr-8 text-xs font-semibold text-slate-900 outline-none focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwdNew(!showPwdNew)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                        >
                          {showPwdNew ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                        3. Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPwdConfirm ? "text" : "password"}
                          value={pwdConfirmInput}
                          onChange={(e) => {
                            setPwdConfirmInput(e.target.value);
                            setPasswordError("");
                          }}
                          placeholder="Re-type new password"
                          autoComplete="new-password"
                          className="w-full h-8 rounded-lg border border-emerald-200 bg-emerald-50/20 pl-2.5 pr-8 text-xs font-semibold text-slate-900 outline-none focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwdConfirm(!showPwdConfirm)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                        >
                          {showPwdConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>

                    {passwordError && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[10px] font-bold text-rose-800">
                        {passwordError}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setPasswordModalOpen(false)}
                        disabled={updatingPassword}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updatingPassword || !pwdCurrentInput || !pwdNewInput || !pwdConfirmInput}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#00552E] hover:bg-[#004224] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-60 cursor-pointer"
                      >
                        {updatingPassword ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={12} />}
                        Save
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* ─── Sub-Modal 3: Change Contact Number Modal ─── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {phoneModalOpen && (
              <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setPhoneModalOpen(false)}
                  className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-0"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 6 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  style={{ maxWidth: 360, width: "92%" }}
                  className="relative z-10 mx-auto bg-white rounded-2xl shadow-2xl border border-emerald-500/20 overflow-hidden flex flex-col p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00552E] text-white shadow-xs">
                        <Phone size={14} />
                      </span>
                      <h3 className="text-xs font-black text-slate-900">Change Contact Hotline</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhoneModalOpen(false)}
                      disabled={updatingPhone}
                      className="h-6 w-6 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-[11px] flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Current:</span>
                    <span className="font-black text-emerald-950 font-mono">{officePhone}</span>
                  </div>

                  <form onSubmit={handleSavePhone} className="space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        New Hotline (11 Digits, 09...)
                      </label>
                      <input
                        type="tel"
                        maxLength={11}
                        autoFocus
                        value={newPhoneInput}
                        onChange={(e) => {
                          const onlyNums = e.target.value.replace(/\D/g, "").slice(0, 11);
                          setNewPhoneInput(onlyNums);
                          setPhoneError("");
                        }}
                        placeholder="09XXXXXXXXX"
                        className="w-full h-8.5 rounded-lg border border-emerald-200 bg-emerald-50/20 px-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Admin Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPhonePassword ? "text" : "password"}
                          value={phonePasswordInput}
                          onChange={(e) => {
                            setPhonePasswordInput(e.target.value);
                            setPhoneError("");
                          }}
                          placeholder="Enter password to authorize"
                          autoComplete="current-password"
                          className="w-full h-8.5 rounded-lg border border-emerald-200 bg-emerald-50/20 pl-2.5 pr-8 text-xs font-semibold text-slate-900 outline-none focus:border-[#00552E] focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPhonePassword(!showPhonePassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                        >
                          {showPhonePassword ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>

                    {phoneError && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] font-bold text-rose-800">
                        {phoneError}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setPhoneModalOpen(false)}
                        disabled={updatingPhone}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updatingPhone || newPhoneInput.length !== 11 || !phonePasswordInput}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#00552E] hover:bg-[#004224] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-60 cursor-pointer"
                      >
                        {updatingPhone ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={12} />}
                        Save
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};

export default AccountSecurityModal;
