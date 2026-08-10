import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { Bell, User, ChevronDown, X, CheckCheck, Loader2, RefreshCw, LogOut, Shield, Settings } from "lucide-react";
import { useConfirm } from "../context/ConfirmContext";
import {
  getCurrentUserWithProfile,
  logoutUser,
  PROFILE_UPDATED_EVENT,
} from "../services/authService";
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  subscribeAdminNotificationChanges,
} from "../services/adminNotificationService";

const getDisplayName = (user) =>
  user?.user_metadata?.full_name ||
  user?.user_metadata?.name ||
  user?.email?.split("@")[0] ||
  "Admin User";

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
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationError, setNotificationError] = useState("");

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const displayName = getDisplayName(account?.user);
  const displayEmail = account?.user?.email || "calambarusseljay5@gmail.com";
  const displayRole = account?.profile?.role || "Administrator";
  const profilePhotoUrl = account?.profile?.profile_photo_url;

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
    <header
      className={`z-30 w-full ${
        transparent
          ? "bg-transparent border-b-0 shadow-none relative"
          : "sticky top-0 border-b border-slate-200/80 bg-white/92 shadow-xs backdrop-blur-xl"
      } ${className}`}
    >
      <div className={`mx-auto flex min-h-[72px] max-w-[1600px] flex-wrap items-center justify-between gap-3 py-3 lg:flex-nowrap ${
        transparent ? "px-0" : "px-6 lg:px-8"
      }`}>
        <div className="min-w-0 flex-1 lg:flex-none">
          <h1 className={`truncate font-extrabold tracking-tight ${
            transparent ? "text-2xl sm:text-3xl text-white" : "text-xl text-slate-900"
          }`}>{title}</h1>
          {subtitle && (
            <p className={`mt-1.5 truncate font-semibold ${
              transparent ? "text-xs sm:text-sm text-emerald-200/90" : "text-xs text-slate-500"
            }`}>{subtitle}</p>
          )}
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
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/70 ring-1 ring-rose-100">
                              <img src="/logo.png" alt="Barangay logo" className="h-9 w-9 object-contain" />
                            </div>
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
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition shadow-sm ${
                    transparent
                      ? "border-[#ffffff1a] bg-[#ffffff1a] text-white hover:bg-[#ffffff33]"
                      : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-700 hover:shadow-md"
                  }`}
                  aria-label="Notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#FFB800] px-1 text-[10px] font-bold text-white shadow-[0_0_0_2px_rgba(255,184,0,0.16)]">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="dashboard-v2-popup hd-surface-strong absolute right-0 top-full z-50 mt-3 w-[340px] overflow-hidden rounded-lg">
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
                          <RefreshCw size={15} className={notificationsLoading ? "animate-spin" : ""} />
                        </button>
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          disabled={notifications.length === 0 || unreadCount === 0}
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Mark all notifications as read"
                          title="Mark all read"
                        >
                          <CheckCheck size={15} />
                        </button>
                        <button
                          onClick={() => setShowNotifications(false)}
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          aria-label="Close notifications"
                        >
                          <X size={16} />
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
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => handleNotificationOpen(notification)}
                              className={`w-full rounded-lg border p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/60 ${notification.is_read
                                  ? "border-slate-200/70 bg-white/70"
                                  : "border-blue-100 bg-blue-50/40"
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${getNotificationAccent(
                                    notification.tone
                                  )}`}
                                >
                                  <Bell size={14} />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-start justify-between gap-3">
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm font-semibold text-slate-900">
                                        {notification.title}
                                      </span>
                                      <span className="mt-1 block text-sm leading-5 text-slate-600">
                                        {notification.message}
                                      </span>
                                    </span>
                                    {!notification.is_read ? (
                                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                                    ) : null}
                                  </span>
                                  <span className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                                    <span className="truncate">{notification.source}</span>
                                    <span className="shrink-0">{getRelativeTime(notification.created_at)}</span>
                                  </span>
                                </span>
                              </div>
                            </button>
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
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    setShowProfile(!showProfile);
                    setShowNotifications(false);
                  }}
                  className={`flex h-10 items-center gap-2.5 rounded-xl border px-3 py-1.5 shadow-sm transition ${
                    transparent
                      ? "border-[#ffffff1a] bg-[#ffffff1a] text-white hover:bg-[#ffffff33]"
                      : "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md"
                  }`}
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-700 ring-1 ring-emerald-100">
                    {profilePhotoUrl ? (
                      <img src={profilePhotoUrl} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <User size={16} />
                    )}
                  </span>
                  <div className="hidden text-left sm:block leading-tight">
                    <p className={`max-w-[120px] truncate text-xs font-bold ${transparent ? "text-white" : "text-slate-900"}`}>{displayName}</p>
                    <p className={`text-[10px] capitalize font-medium ${transparent ? "text-emerald-300" : "text-slate-500"}`}>{displayRole}</p>
                  </div>
                  <ChevronDown size={14} className={`hidden sm:block ml-2 ${transparent ? "text-slate-200" : "text-slate-400"}`} />
                </button>

                {showProfile && (
                  <div className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-xl backdrop-blur-xl">
                    <div className="flex items-center gap-3 border-b border-slate-100 px-2 pb-3 pt-1">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00552E]/10 text-[#00552E] ring-2 ring-[#00552E]/20">
                        {profilePhotoUrl ? (
                          <img src={profilePhotoUrl} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          <User size={20} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-slate-900">{displayName}</p>
                        <p className="truncate text-xs font-semibold text-emerald-700">{displayRole}</p>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <Link
                        to="/my-account"
                        onClick={() => setShowProfile(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#00552E]/10 hover:text-[#00552E]"
                      >
                        <User size={17} className="text-[#00552E]" />
                        <span>My Account</span>
                      </Link>
                      <Link
                        to="/account-security"
                        onClick={() => setShowProfile(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#00552E]/10 hover:text-[#00552E]"
                      >
                        <Shield size={17} className="text-[#00552E]" />
                        <span>Account Security</span>
                      </Link>
                      <Link
                        to="/system-settings"
                        onClick={() => setShowProfile(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#00552E]/10 hover:text-[#00552E]"
                      >
                        <Settings size={17} className="text-[#00552E]" />
                        <span>System Settings</span>
                      </Link>
                      <div className="my-1.5 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <LogOut size={17} className="text-rose-600" />
                        <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
  );
};

export default Header;
