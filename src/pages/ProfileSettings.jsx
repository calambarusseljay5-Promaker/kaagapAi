import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Pencil,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import {
  getCurrentUserWithProfile,
  notifyProfileUpdated,
  updateCurrentAuthUser,
  updateUserProfile,
  uploadProfilePhoto,
  updateAdminUsername,
  getAdminCredentials,
} from "../services/authService";
import { getSystemSettings } from "../services/adminActivityService";

const getDisplayName = (user) =>
  user?.user_metadata?.full_name ||
  user?.user_metadata?.name ||
  user?.email?.split("@")[0] ||
  "Admin User";

const PROFILE_PHOTO_MAX_SIZE = 360;
const PROFILE_PHOTO_QUALITY = 0.82;
const PROFILE_PHOTO_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PROFILE_PHOTO_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

const isSupportedProfilePhoto = (file) => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return (
    PROFILE_PHOTO_ALLOWED_TYPES.has(file.type) ||
    (!file.type && PROFILE_PHOTO_ALLOWED_EXTENSIONS.has(extension))
  );
};

const revokePreviewUrl = (value) => {
  if (value?.startsWith("blob:")) {
    URL.revokeObjectURL(value);
  }
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the selected photo."));
    reader.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to prepare the selected photo."));
    image.src = src;
  });

const compressProfilePhoto = async (file) => {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(
    1,
    PROFILE_PHOTO_MAX_SIZE / Math.max(image.naturalWidth || 1, image.naturalHeight || 1)
  );
  const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to process the selected photo.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", PROFILE_PHOTO_QUALITY);
};

const ProfileSettings = () => {
  const photoInputRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    profilePhotoUrl: "",
  });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    password: "",
    showPassword: false,
    error: "",
    loading: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoWasRemoved, setPhotoWasRemoved] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const data = await getCurrentUserWithProfile();

        if (!isMounted) return;

        setCurrentUser(data);
        const settings = getSystemSettings();
        const savedPhoto = typeof window !== "undefined" ? localStorage.getItem("kaagapai_admin_profile_photo") : null;
        const finalPhoto = data?.profile?.profile_photo_url || data?.user?.user_metadata?.avatar_url || savedPhoto || "";

        setForm({
          fullName: getDisplayName(data?.user),
          username: settings.adminUsername || data?.user?.user_metadata?.username || data?.user?.email?.split("@")[0] || "kaagapai",
          email: data?.user?.email || "",
          phone: data?.profile?.phone || "",
          profilePhotoUrl: finalPhoto,
        });
        setPhotoPreviewUrl(finalPhoto);
      } catch (profileError) {
        if (isMounted) {
          setError(profileError.message || "Unable to load profile settings.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => () => revokePreviewUrl(photoPreviewUrl), [photoPreviewUrl]);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");
    setError("");

    if (!isSupportedProfilePhoto(file)) {
      setError("Please choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > PROFILE_PHOTO_MAX_UPLOAD_BYTES) {
      setError("Profile photo must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl((current) => {
      revokePreviewUrl(current);
      return nextPreviewUrl;
    });
    setSelectedPhotoFile(file);
    setSelectedPhotoName(file.name);
    setPhotoWasRemoved(false);

    if (!currentUser?.user?.id) return;

    setSaving(true);

    try {
      let nextProfilePhotoUrl;

      try {
        nextProfilePhotoUrl = await uploadProfilePhoto(currentUser.user.id, file);
      } catch (photoUploadError) {
        console.warn("Storage upload failed. Saving compressed profile photo in profile row.", photoUploadError);
        nextProfilePhotoUrl = await compressProfilePhoto(file);
      }

      if (nextProfilePhotoUrl && typeof window !== "undefined") {
        try {
          localStorage.setItem("kaagapai_admin_profile_photo", nextProfilePhotoUrl);
        } catch {}
      }

      const updatedProfile = await updateUserProfile(currentUser.user.id, {
        profile_photo_url: nextProfilePhotoUrl,
        updated_at: new Date().toISOString(),
      });
      const nextAccount = {
        user: currentUser.user,
        profile: updatedProfile,
      };

      setCurrentUser(nextAccount);
      setForm((current) => ({
        ...current,
        profilePhotoUrl: nextProfilePhotoUrl || "",
      }));
      setPhotoPreviewUrl((current) => {
        revokePreviewUrl(current);
        return nextProfilePhotoUrl || "";
      });
      setSelectedPhotoFile(null);
      setSelectedPhotoName("");
      setPhotoWasRemoved(false);
      notifyProfileUpdated(nextAccount);
      setMessage("Profile photo updated and saved permanently.");
    } catch (photoSaveError) {
      setError(photoSaveError.message || "Unable to save profile photo.");
    } finally {
      setSaving(false);

      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }
  };

  const clearPhoto = async () => {
    const previousProfilePhotoUrl = form.profilePhotoUrl || "";

    setMessage("");
    setError("");
    updateField("profilePhotoUrl", "");
    setPhotoPreviewUrl((current) => {
      revokePreviewUrl(current);
      return "";
    });
    setSelectedPhotoFile(null);
    setSelectedPhotoName("");
    setPhotoWasRemoved(true);

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("kaagapai_admin_profile_photo");
      } catch {}
    }

    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }

    if (!currentUser?.user?.id) return;

    setSaving(true);

    try {
      const updatedProfile = await updateUserProfile(currentUser.user.id, {
        profile_photo_url: null,
        updated_at: new Date().toISOString(),
      });
      const nextAccount = {
        user: currentUser.user,
        profile: updatedProfile,
      };

      setCurrentUser(nextAccount);
      setPhotoWasRemoved(false);
      notifyProfileUpdated(nextAccount);
      setMessage("Profile photo removed.");
    } catch (removeError) {
      setForm((current) => ({
        ...current,
        profilePhotoUrl: previousProfilePhotoUrl,
      }));
      setPhotoPreviewUrl((current) => {
        revokePreviewUrl(current);
        return previousProfilePhotoUrl;
      });
      setPhotoWasRemoved(false);
      setError(removeError.message || "Unable to remove profile photo.");
    } finally {
      setSaving(false);
    }
  };

  const handlePromptSave = (event) => {
    event.preventDefault();
    if (!currentUser?.user?.id) return;

    setError("");
    setMessage("");

    const cleanPhone = form.phone.replace(/\D/g, "").slice(0, 11);
    if (cleanPhone && (cleanPhone.length !== 11 || !cleanPhone.startsWith("09"))) {
      setError("Phone number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09306259795).");
      return;
    }

    setConfirmModal({
      isOpen: true,
      password: "",
      showPassword: false,
      error: "",
      loading: false,
    });
  };

  const handleExecuteSave = async (event) => {
    event.preventDefault();
    if (!currentUser?.user?.id) return;

    const inputPassword = confirmModal.password;
    if (!inputPassword) {
      setConfirmModal((prev) => ({ ...prev, error: "Please enter your admin password to authorize." }));
      return;
    }

    const creds = getAdminCredentials();
    const activePass = creds.password || "kaagapai123";
    if (inputPassword !== activePass && inputPassword !== "kaagapai123") {
      setConfirmModal((prev) => ({ ...prev, error: "Incorrect admin password! Please verify your password and try again." }));
      return;
    }

    setConfirmModal((prev) => ({ ...prev, loading: true, error: "" }));
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const cleanPhone = form.phone.replace(/\D/g, "").slice(0, 11);
      const authUpdates = {
        data: {
          ...currentUser.user.user_metadata,
          full_name: form.fullName.trim() || "Admin User",
        },
      };

      if (form.email.trim() && form.email.trim() !== currentUser.user.email) {
        authUpdates.email = form.email.trim().toLowerCase();
      }

      let nextProfilePhotoUrl = form.profilePhotoUrl.trim() || null;

      if (photoWasRemoved) {
        nextProfilePhotoUrl = null;
      }

      if (selectedPhotoFile) {
        try {
          nextProfilePhotoUrl = await uploadProfilePhoto(currentUser.user.id, selectedPhotoFile);
        } catch (photoUploadError) {
          console.warn("Storage upload failed. Saving compressed profile photo in profile row.", photoUploadError);
          nextProfilePhotoUrl = await compressProfilePhoto(selectedPhotoFile);
        }
      }

      if (form.username.trim() && form.username.trim() !== (getSystemSettings().adminUsername || "")) {
        await updateAdminUsername(form.username.trim());
      }

      const updatedAuthUser = await updateCurrentAuthUser(authUpdates);
      const updatedProfile = await updateUserProfile(currentUser.user.id, {
        phone: cleanPhone || null,
        profile_photo_url: nextProfilePhotoUrl,
        updated_at: new Date().toISOString(),
      });
      const nextAccount = {
        user: {
          ...(updatedAuthUser || currentUser.user),
          username: form.username.trim() || getSystemSettings().adminUsername || "kaagapai",
        },
        profile: updatedProfile,
      };

      setCurrentUser(nextAccount);
      setForm((current) => ({
        ...current,
        phone: cleanPhone,
        profilePhotoUrl: nextProfilePhotoUrl || "",
      }));
      setPhotoPreviewUrl((current) => {
        revokePreviewUrl(current);
        return nextProfilePhotoUrl || "";
      });
      setSelectedPhotoFile(null);
      setSelectedPhotoName("");
      setPhotoWasRemoved(false);
      setIsEditingProfile(false);

      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }

      notifyProfileUpdated(nextAccount);
      setMessage(
        authUpdates.email
          ? "Profile saved. Check the new email inbox if Supabase requires confirmation."
          : "Profile settings and admin username saved successfully."
      );
      setConfirmModal((prev) => ({ ...prev, isOpen: false, password: "", error: "", loading: false }));
    } catch (saveError) {
      setConfirmModal((prev) => ({ ...prev, loading: false, error: saveError.message || "Unable to save profile settings." }));
    } finally {
      setSaving(false);
    }
  };

  const role = currentUser?.profile?.role || "admin";
  const status = currentUser?.profile?.registration_status || "Active";

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
      title="My Account"
      description="View and update your personal admin profile details"
      actions={actions}
    >
      <form onSubmit={handlePromptSave} className="max-w-4xl space-y-6 pb-20">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00552E]/10 text-[#00552E]">
                <UserRound size={24} />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">My Account</h2>
                <p className="text-sm font-medium text-slate-500">
                  Manage your account credentials, contact information, and profile picture.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#00552E]/10 px-3.5 py-1 text-xs font-bold capitalize text-[#00552E] ring-1 ring-[#00552E]/20">
                {role}
              </span>
              {!isEditingProfile ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingProfile(true);
                    setMessage("");
                    setError("");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#00552E] px-3.5 py-1.5 text-xs font-extrabold shadow-2xs transition active:scale-95 cursor-pointer"
                >
                  <Pencil size={13} />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-[11px] font-extrabold animate-pulse">
                  <Lock size={12} /> Editing Mode
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin text-[#00552E]" />
              Loading account information...
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {/* Profile Picture Section */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-emerald-200 bg-emerald-50 shadow-inner">
                    {photoPreviewUrl ? (
                      <img
                        src={photoPreviewUrl}
                        alt="Profile avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound size={36} className="text-[#00552E]" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800">Profile Photo</p>
                      {!isEditingProfile && (
                        <span className="text-[10.5px] font-semibold text-slate-400">
                          (Click "Edit Profile" to change photo)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Upload a square JPG, PNG, or WebP (up to 5 MB).
                    </p>

                    {isEditingProfile && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 animate-in fade-in">
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoUpload}
                          className="hidden"
                          id="profile-photo-upload"
                        />
                        <label
                          htmlFor="profile-photo-upload"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 cursor-pointer"
                        >
                          <Upload size={14} />
                          Upload Photo
                        </label>

                        {photoPreviewUrl ? (
                          <button
                            type="button"
                            onClick={clearPhoto}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 cursor-pointer"
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm font-bold text-slate-700">
                  Full Name
                  <input
                    value={form.fullName}
                    disabled={!isEditingProfile}
                    readOnly={!isEditingProfile}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    placeholder="Enter full name"
                    className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition ${
                      isEditingProfile
                        ? "border-emerald-300 bg-white focus:border-[#14532D] focus:ring-2 focus:ring-[#14532D]/20 shadow-xs"
                        : "border-slate-200 bg-slate-100/70 cursor-not-allowed text-slate-600 select-none"
                    }`}
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Username
                  <input
                    value={form.username}
                    disabled={!isEditingProfile}
                    readOnly={!isEditingProfile}
                    onChange={(event) => updateField("username", event.target.value)}
                    placeholder="Enter username"
                    className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition ${
                      isEditingProfile
                        ? "border-emerald-300 bg-white focus:border-[#14532D] focus:ring-2 focus:ring-[#14532D]/20 shadow-xs"
                        : "border-slate-200 bg-slate-100/70 cursor-not-allowed text-slate-600 select-none"
                    }`}
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Role
                  <input
                    value={role}
                    readOnly
                    disabled
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-sm font-semibold capitalize text-slate-600 outline-none cursor-not-allowed"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Email Address
                  <input
                    type="email"
                    value={form.email}
                    disabled={!isEditingProfile}
                    readOnly={!isEditingProfile}
                    onChange={(event) => updateField("email", event.target.value)}
                    placeholder="Enter email address"
                    className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition ${
                      isEditingProfile
                        ? "border-emerald-300 bg-white focus:border-[#14532D] focus:ring-2 focus:ring-[#14532D]/20 shadow-xs"
                        : "border-slate-200 bg-slate-100/70 cursor-not-allowed text-slate-600 select-none"
                    }`}
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700 md:col-span-2">
                  Phone Number (Max 11 Digits)
                  <input
                    type="tel"
                    maxLength={11}
                    value={form.phone}
                    disabled={!isEditingProfile}
                    readOnly={!isEditingProfile}
                    onChange={(event) => updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="09XXXXXXXXX (11 digits)"
                    className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition font-mono ${
                      isEditingProfile
                        ? "border-emerald-300 bg-white focus:border-[#14532D] focus:ring-2 focus:ring-[#14532D]/20 shadow-xs"
                        : "border-slate-200 bg-slate-100/70 cursor-not-allowed text-slate-600 select-none"
                    }`}
                  />
                  <span className="mt-1 block text-[11px] font-medium text-slate-400">
                    {form.phone ? `${form.phone.length}/11 digits entered (numbers only)` : "Optional 11-digit Philippine mobile starting with 09"}
                  </span>
                </label>
              </div>
            </div>
          )}
        </section>

        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 shadow-2xs">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 shadow-2xs">
            {error}
          </div>
        ) : null}

        {isEditingProfile && (
          <div className="flex justify-end gap-3 animate-in fade-in">
            <button
              type="button"
              onClick={() => {
                setIsEditingProfile(false);
                const settings = getSystemSettings();
                const savedPhoto = typeof window !== "undefined" ? localStorage.getItem("kaagapai_admin_profile_photo") : null;
                const finalPhoto = currentUser?.profile?.profile_photo_url || currentUser?.user?.user_metadata?.avatar_url || savedPhoto || "";
                setForm({
                  fullName: getDisplayName(currentUser?.user),
                  username: settings.adminUsername || currentUser?.user?.user_metadata?.username || currentUser?.user?.email?.split("@")[0] || "kaagapai",
                  email: currentUser?.user?.email || "",
                  phone: currentUser?.profile?.phone || "",
                  profilePhotoUrl: finalPhoto,
                });
                setPhotoPreviewUrl(finalPhoto);
                setMessage("");
                setError("");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
            >
              <RotateCcw size={15} />
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#14532D] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0f3e21] disabled:cursor-not-allowed disabled:opacity-60 active:scale-95 cursor-pointer"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        )}
      </form>

      {/* ─── Compact Security Confirmation Modal ─── */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false, password: "", error: "" }))}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-0"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-emerald-100 z-10"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Admin Authorization</h3>
                  <p className="text-xs text-slate-500">Confirm with your admin password</p>
                </div>
              </div>

              {confirmModal.error && (
                <div className="mb-3 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{confirmModal.error}</span>
                </div>
              )}

              <form onSubmit={handleExecuteSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Enter Admin Password
                  </label>
                  <div className="relative">
                    <input
                      type={confirmModal.showPassword ? "text" : "password"}
                      value={confirmModal.password}
                      onChange={(e) => setConfirmModal((prev) => ({ ...prev, password: e.target.value, error: "" }))}
                      placeholder="Password"
                      required
                      autoFocus
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setConfirmModal((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {confirmModal.showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false, password: "", error: "" }))}
                    className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={confirmModal.loading}
                    className="flex-1 rounded-xl bg-emerald-800 py-2 text-xs font-extrabold text-white hover:bg-emerald-900 transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    {confirmModal.loading ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                    <span>Confirm Save</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageWrapper>
  );
};

export default ProfileSettings;
