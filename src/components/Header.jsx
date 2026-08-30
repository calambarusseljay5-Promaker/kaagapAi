import { useCallback, useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { Bell, User, ChevronDown, X, CheckCheck, Loader2, RefreshCw, LogOut, Shield, Settings, Trash2, AlertCircle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useConfirm } from "../context/ConfirmContext";
import {
  getCurrentUserWithProfile,
  logoutUser,
  PROFILE_UPDATED_EVENT,
  getAdminCredentials,
} from "../services/authService";
import { getSystemSettings } from "../services/adminActivityService";
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  deleteAdminNotification,
  deleteAllAdminNotifications,
  subscribeAdminNotificationChanges,
} from "../services/adminNotificationService";
import MyAccountModal from "./modals/MyAccountModal";
import AccountSecurityModal from "./modals/AccountSecurityModal";
import SystemSettingsModal from "./modals/SystemSettingsModal";

const getDisplayName = (user, account) =>
  account?.profile?.full_name ||
  user?.user_metadata?.full_name ||
  getAdminCredentials().fullName ||
  getSystemSettings().adminFullName ||
  user?.user_metadata?.username ||
  getAdminCredentials().username ||
  getSystemSettings().adminUsername ||
  "Barangay Administrator";

const getRelativeTime = (value) => {
  const time = new Date(value || 0).getTime();
  if (!time || Number.isNaN(time)) return "Just now";

  const diffMs = Date.now() - time;
  if (diffMs < 0) {
    const futureMinutes = Math.ceil(Math.abs(diffMs) / 60000);
    if (futureMinutes < 60) return `in ${futureMinutes} min`;

    const futureHours = Math.ceil(futureMinutes / 60);
    if (futureHours < 24) return `in ${futureHours} hr`;

    const futureDays = Math.ceil(futureHours / 24);
    return `in ${futureDays} day${futureDays === 1 ? "" : "s"}`;
  }

  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const getNotificationAccent = (tone) => {
  if (tone === "amber") return "bg-amber-100 text-amber-700";
  if (tone === "emerald") return "bg-emerald-100 text-emerald-700";
  return "bg-blue-100 text-blue-700";
};

const Header = ({ title, subtitle, middleContent = null, actions = null, className = "", transparent = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm } = useConfirm();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [account, setAccount] = useState(null);
  const [activeAdminModal, setActiveAdminModal] = useState(null); // "my-account" | "account-security" | "system-settings" | null
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationError, setNotificationError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    const handleOpenModal = (event) => {
      const modalType = event?.detail || event?.data;
      if (modalType === "my-account" || modalType === "account-security" || modalType === "system-settings") {
        setActiveAdminModal(modalType);
      }
    };

    window.addEventListener("kaagapai:open_admin_modal", handleOpenModal);
    return () => {
      window.removeEventListener("kaagapai:open_admin_modal", handleOpenModal);
    };
  }, []);

  useEffect(() => {
    let timer;
    const handleToast = (event) => {
      if (event.detail) {
        setToastMessage(event.detail);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          setToastMessage(null);
        }, 5500);
      }
    };

    window.addEventListener("admin_system_toast", handleToast);
    return () => {
      window.removeEventListener("admin_system_toast", handleToast);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const displayName = getDisplayName(account?.user, account);
  const displayEmail = getAdminCredentials().email || getSystemSettings().officeEmail || account?.user?.email || "uppermingading@gmail.com";
  const displayRole = account?.profile?.role || "Administrator";
  const savedPhoto = typeof window !== "undefined" ? localStorage.getItem("kaagapai_admin_profile_photo") : null;
  const profilePhotoUrl = account?.profile?.profile_photo_url || account?.user?.user_metadata?.avatar_url || getAdminCredentials().profilePhotoUrl || savedPhoto || null;

  const messages = useMemo(() => {
    if (title) {
      return [
        {
          title,
          subtitle: subtitle || ""
        }
      ];
    }
    return [
      {
        title: "Good Evening, Admin! 👋",
        subtitle: subtitle || "Welcome back to Barangay Upper Mingading"
      },
      {
        title: "Serbisyong Tapat, Para sa Lahat 🏛️",
        subtitle: "Official Barangay Upper Mingading Administrative Portal"
      },
      {
        title: "KaagapA.I Active & Operational ⚡",
        subtitle: "Real-time statistics & instant document processing"
      }
    ];
  }, [title, subtitle]);

  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) {
      setMsgIdx(0);
      return undefined;
    }
    const timer = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % messages.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [messages]);

  const currentMsg = messages[msgIdx] || { title: title || "", subtitle: subtitle || "" };
  const isSteady = messages.length <= 1;

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setNotificationsLoading(true);
    }

    try {
      const result = await fetchAdminNotifications();
      setNotifications(result.notifications);
      setNotificationError(
        result.errors.length
          ? "Some notification sources could not load. Showing available items."
          : ""
      );
    } catch (error) {
      setNotificationError(error.message || "Unable to load notifications.");
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAccount = async () => {
      try {
        const currentAccount = await getCurrentUserWithProfile();

        if (isMounted) {
          setAccount(currentAccount);
        }
      } catch (error) {
        console.error("Unable to load header account:", error);
      }
    };

    loadAccount();
    const syncUpdatedProfile = (event) => {
      if (event.detail) {
        setAccount(event.detail);
        return;
      }

      loadAccount();
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, syncUpdatedProfile);

    return () => {
      isMounted = false;
      window.removeEventListener(PROFILE_UPDATED_EVENT, syncUpdatedProfile);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const refresh = async ({ silent = false } = {}) => {
      if (!isMounted) return;
      await loadNotifications({ silent });
    };

    refresh();
    const unsubscribe = subscribeAdminNotificationChanges(() => {
      refresh({ silent: true });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadNotifications]);

  const toggleNotifications = () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);
    setShowProfile(false);

    if (nextState) {
      loadNotifications({ silent: true });
    }
  };

  const handleNotificationOpen = (notification) => {
    markAdminNotificationRead(notification.id);
    setNotifications((currentNotifications) =>
      currentNotifications.map((currentNotification) =>
        currentNotification.id === notification.id
          ? { ...currentNotification, is_read: true }
          : currentNotification
      )
    );
    setShowNotifications(false);
    navigate(notification.path);
  };

  const handleMarkAllRead = () => {
    markAllAdminNotificationsRead(notifications.map((notification) => notification.id));
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, is_read: true }))
    );
  };

  const handleDeleteNotification = (e, notificationId) => {
    e.stopPropagation();
    deleteAdminNotification(notificationId);
    setNotifications((currentNotifications) =>
      currentNotifications.filter((n) => n.id !== notificationId)
    );
  };

  const handleDeleteAllNotifications = async () => {
    const ok = await confirm({
      title: "Delete All Notifications?",
      message: "Are you sure you want to remove all notifications from your admin feed?",
      confirmText: "Delete All",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (!ok) return;
    deleteAllAdminNotifications(notifications.map((n) => n.id));
    setNotifications([]);
  };

  const confirmSignOut = () => {
    setShowSignOutConfirm(false);
    setShowProfile(false);
    sessionStorage.setItem("just_logged_out", "true");

    // Start sign out without leaving the modal open
    setIsSigningOut(true);

    logoutUser()
      .then(() => {
        navigate("/goodbye", {
          replace: true,
          state: {
            displayName,
            role: displayRole,
          },
        });
      })
      .catch((error) => {
        console.error("Unable to sign out:", error);
        setIsSigningOut(false);
      });
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    const ok = await confirm({
      title: "Confirm Admin Logout",
      message: "Are you sure you want to log out of the KaagapAI Administrative Portal?",
      confirmText: "Logout",
      cancelText: "Cancel",
      variant: "danger",
      icon: LogOut,
    });
    if (!ok) return;
    confirmSignOut();
  };

  return (
    <>
      <header
        className={`z-[9990] w-full ${
        transparent
          ? "bg-transparent border-b-0 shadow-none relative"
          : "sticky top-0 border-b border-emerald-400/20 bg-gradient-to-r from-[rgba(2,43,29,0.85)] via-[rgba(3,62,43,0.78)] to-[rgba(2,35,23,0.85)] text-white shadow-xl backdrop-blur-xl relative transition-all"
      } ${className}`}
    >
      {!transparent && (
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/10 pointer-events-none z-0 overflow-hidden" />
      )}

      <div className={`relative z-10 flex ${
        transparent ? "min-h-[56px] sm:min-h-[62px] py-1 px-0" : "min-h-[82px] py-3 px-4 sm:px-6 lg:px-8"
      } w-full items-center justify-between gap-4`}>
        <div className="flex items-center gap-4 min-w-0 flex-1 lg:flex-none overflow-hidden">
          {/* Steady / Animated Header Title & Subtitle Container */}
          <div className="min-w-0 flex-1 relative overflow-hidden min-h-[42px] flex flex-col justify-center">
            {isSteady ? (
              <div className="space-y-0.5">
                <h1
                  className={`truncate font-black tracking-tight ${
                    transparent
                      ? "text-2xl sm:text-3xl text-white font-sans drop-shadow-md"
                      : "text-xl sm:text-2xl lg:text-3xl text-white font-sans tracking-tight drop-shadow-md"
                  }`}
                >
                  {currentMsg.title}
                </h1>
                {currentMsg.subtitle ? (
                  <p
                    className={`truncate font-medium ${
                      transparent
                        ? "text-xs sm:text-sm text-emerald-100 font-semibold drop-shadow-sm"
                        : "text-xs sm:text-sm text-emerald-100/90 drop-shadow-xs"
                    }`}
                  >
                    {currentMsg.subtitle}
                  </p>
                ) : null}
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={msgIdx}
                  initial={{ opacity: 0, x: -45 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 45 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="space-y-0.5"
                >
                  <h1
                    className={`truncate font-black tracking-tight ${
                      transparent
                        ? "text-2xl sm:text-3xl text-white font-sans drop-shadow-md"
                        : "text-xl sm:text-2xl lg:text-3xl text-white font-sans tracking-tight drop-shadow-md"
                    }`}
                  >
                    {currentMsg.title}
                  </h1>
                  {currentMsg.subtitle && (
                    <p
                      className={`truncate font-medium ${
                        transparent
                          ? "text-xs sm:text-sm text-emerald-100 font-semibold drop-shadow-sm"
                          : "text-xs sm:text-sm text-emerald-100/90 drop-shadow-xs"
                      }`}
                    >
                      {currentMsg.subtitle}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>

        {middleContent && (
          <div className="order-3 w-full lg:hidden">
            {middleContent}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-3 ml-auto">
          {middleContent && (
            <div className="hidden lg:block lg:min-w-[240px] lg:max-w-xs">
              {middleContent}
            </div>
          )}

          {actions ? (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              {actions}
            </div>
          ) : null}

          <div className="relative">
                {showSignOutConfirm
                  ? createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                      <div className="relative w-full max-w-[420px] rounded-[1.1rem] border border-white/20 bg-white/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                        <div className="rounded-[0.85rem] bg-gradient-to-br from-rose-50 to-rose-100 p-3">
                          <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="Barangay logo" className="h-10 w-10 object-contain drop-shadow-md shrink-0" />
                            <div>
                              <div className="text-sm font-extrabold text-rose-800">Sign out</div>
                              <div className="mt-1 text-sm font-semibold text-slate-800">Are you sure you want to sign out?</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowSignOutConfirm(false)}
                            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            disabled={isSigningOut}
                          >
                            No
                          </button>
                          <button
                            type="button"
                            onClick={confirmSignOut}
                            disabled={isSigningOut}
                            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSigningOut ? "Signing out..." : "Yes"}
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )
                  : null}

                <button
                  onClick={toggleNotifications}
                  className="admin-header-glass-btn relative flex h-10 w-10 items-center justify-center rounded-xl transition cursor-pointer"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: '#ffffff',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                  }}
                  aria-label="Notifications"
                >
                  <Bell size={18} className="text-white" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white shadow-md">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-[99990]" onClick={() => setShowNotifications(false)} />
                    <div className="dashboard-v2-popup hd-surface-strong absolute right-0 top-full z-[99999] mt-3 overflow-hidden rounded-xl shadow-2xl border border-slate-200" style={{ width: 'min(340px, calc(100vw - 2rem))' }}>
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {unreadCount} unread
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => loadNotifications({ silent: false })}
                          disabled={notificationsLoading}
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Refresh notifications"
                          title="Refresh"
                        >
                          <RefreshCw size={14} className={notificationsLoading ? "animate-spin" : ""} />
                        </button>
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          disabled={notifications.length === 0 || unreadCount === 0}
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Mark all notifications as read"
                          title="Mark all read"
                        >
                          <CheckCheck size={14} />
                        </button>
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={handleDeleteAllNotifications}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Delete all notifications"
                            title="Clear / Delete all"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setShowNotifications(false)}
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          aria-label="Close notifications"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>

                    {notificationError ? (
                      <div className="mx-4 mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                        {notificationError}
                      </div>
                    ) : null}

                    <div className="max-h-[420px] overflow-y-auto p-3">
                      {notificationsLoading && notifications.length === 0 ? (
                        <div className="flex items-center gap-2 px-2 py-6 text-sm text-slate-500">
                          <Loader2 size={16} className="animate-spin" />
                          Loading notifications...
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="px-2 py-6 text-center text-sm text-slate-500">
                          No admin notifications right now.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {notifications.map((notification) => (
                            <div
                              key={notification.id}
                              onClick={() => handleNotificationOpen(notification)}
                              className={`group relative w-full rounded-xl border p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 cursor-pointer ${
                                notification.is_read
                                  ? "border-slate-200/70 bg-white/70"
                                  : "border-emerald-200 bg-emerald-50/50 shadow-2xs"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${getNotificationAccent(
                                    notification.tone
                                  )}`}
                                >
                                  <Bell size={14} />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-start justify-between gap-2">
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-xs font-bold text-slate-900">
                                        {notification.title}
                                      </span>
                                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                                        {notification.message}
                                      </span>
                                    </span>
                                    <span className="flex items-center gap-1.5 shrink-0">
                                      {!notification.is_read && (
                                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteNotification(e, notification.id)}
                                        className="rounded-md p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-700 transition"
                                        title="Delete notification"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </span>
                                  </span>
                                  <span className="mt-2 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-400">
                                    <span className="truncate">{notification.source}</span>
                                    <span className="shrink-0">{getRelativeTime(notification.created_at)}</span>
                                  </span>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          navigate("/documents");
                        }}
                        className="text-xs font-semibold text-blue-700 transition hover:text-blue-800"
                      >
                        Open document requests
                      </button>
                    </div>
                  </div>
                </>
              )}
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    setShowProfile(!showProfile);
                    setShowNotifications(false);
                  }}
                  className="admin-header-profile-btn flex h-10 items-center gap-2.5 rounded-xl px-3 py-1.5 transition cursor-pointer"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: '#ffffff',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                  }}
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white ring-2 ring-emerald-300/50">
                    {profilePhotoUrl ? (
                      <img src={profilePhotoUrl} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <User size={16} className="text-white" />
                    )}
                  </span>
                  <div className="hidden text-left sm:block leading-tight">
                    <p className="max-w-[120px] truncate text-xs font-black text-white">{displayName}</p>
                    <p className="text-[10px] capitalize font-extrabold text-emerald-300">{displayRole}</p>
                  </div>
                  <ChevronDown size={14} className="hidden sm:block ml-2 text-white/90" />
                </button>

                {showProfile && (
                  <>
                    <div className="fixed inset-0 z-[99990]" onClick={() => setShowProfile(false)} />
                    <div className="absolute right-0 top-full z-[99999] mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl backdrop-blur-xl text-slate-900" style={{ width: 'min(16rem, calc(100vw - 2rem))' }}>
                    <div className="flex items-center gap-3 border-b border-slate-100 px-2 pb-3 pt-1">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00552E]/10 text-[#00552E] ring-2 ring-[#00552E]/20">
                        {profilePhotoUrl ? (
                          <img src={profilePhotoUrl} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          <User size={20} className="text-[#00552E]" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-slate-900">{displayName}</p>
                        <p className="truncate text-xs font-bold text-emerald-700">{displayRole}</p>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1 text-slate-900">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfile(false);
                          setActiveAdminModal("my-account");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-black text-slate-800 transition hover:bg-[#00552E]/10 hover:text-[#00552E] bg-slate-50 border border-slate-200/80 cursor-pointer"
                      >
                        <User size={17} className="text-[#00552E] shrink-0" />
                        <span className="text-slate-900 font-extrabold">My Account</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfile(false);
                          setActiveAdminModal("account-security");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-800 transition hover:bg-[#00552E]/10 hover:text-[#00552E] cursor-pointer"
                      >
                        <Shield size={17} className="text-[#00552E] shrink-0" />
                        <span className="text-slate-900 font-bold">Account Security</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfile(false);
                          setActiveAdminModal("system-settings");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-800 transition hover:bg-[#00552E]/10 hover:text-[#00552E] cursor-pointer"
                      >
                        <Settings size={17} className="text-[#00552E] shrink-0" />
                        <span className="text-slate-900 font-bold">System Settings</span>
                      </button>
                      <div className="my-1.5 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                      >
                        <LogOut size={17} className="text-rose-600 shrink-0" />
                        <span className="text-rose-600 font-black">{isSigningOut ? "Signing out..." : "Sign Out"}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
              </div>
            </div>
          </div>
        </header>

        {/* ─── Floating Interactive Admin Modals ─── */}
        <MyAccountModal
          isOpen={activeAdminModal === "my-account"}
          onClose={() => setActiveAdminModal(null)}
        />
        <AccountSecurityModal
          isOpen={activeAdminModal === "account-security"}
          onClose={() => setActiveAdminModal(null)}
        />
        <SystemSettingsModal
          isOpen={activeAdminModal === "system-settings"}
          onClose={() => setActiveAdminModal(null)}
        />

        {/* ─── Top Floating System Notification Toast ─── */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999999] flex items-center gap-3.5 rounded-2xl px-5 py-3.5 shadow-2xl backdrop-blur-2xl border max-w-xl w-[94%] sm:w-auto min-w-[340px] ${
                toastMessage.type === "error"
                  ? "bg-rose-900/95 text-white border-rose-400/50 shadow-rose-950/40"
                  : "bg-[#064e3b]/95 text-white border-emerald-400/50 shadow-emerald-950/40"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  toastMessage.type === "error" ? "bg-rose-500/20 text-rose-200" : "bg-emerald-400/20 text-emerald-200"
                }`}
              >
                {toastMessage.type === "error" ? (
                  <AlertCircle size={22} className="text-rose-300" />
                ) : (
                  <CheckCircle size={22} className="text-emerald-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[10px] font-black uppercase tracking-wider leading-none mb-1 ${
                    toastMessage.type === "error" ? "text-rose-200" : "text-emerald-300"
                  }`}
                >
                  {toastMessage.title || (toastMessage.type === "error" ? "System Alert" : "System Notification")}
                </p>
                <p className="text-xs font-bold text-white leading-relaxed break-words">
                  {toastMessage.text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition cursor-pointer shrink-0 ml-1"
                title="Dismiss notification"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </>
  );
};

export default Header;
