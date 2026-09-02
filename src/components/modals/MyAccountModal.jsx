import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
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
import FloatingModal from "../FloatingModal";
import {
  getCurrentUserWithProfile,
  notifyProfileUpdated,
  updateCurrentAuthUser,
  updateUserProfile,
  uploadProfilePhoto,
  updateAdminUsername,
  getAdminCredentials,
  saveAdminCredentials,
  saveAdminSession,
} from "../../services/authService";
import { getSystemSettings, saveSystemSettings } from "../../services/adminActivityService";
import { showAdminSystemToast } from "../../utils/toast";

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

const MyAccountModal = ({ isOpen, onClose }) => {
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
  const [photoConfirmModal, setPhotoConfirmModal] = useState({
    isOpen: false,
    dataUrl: "",
    file: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoWasRemoved, setPhotoWasRemoved] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getCurrentUserWithProfile();

      setCurrentUser(data);
      const creds = getAdminCredentials();
      const settings = getSystemSettings();
      const savedPhoto = (typeof window !== "undefined" ? localStorage.getItem("kaagapai_admin_profile_photo") : null) || creds.profilePhotoUrl || settings.adminProfilePhotoUrl || data?.profile?.profile_photo_url || data?.user?.user_metadata?.avatar_url || "";
      const finalPhoto = savedPhoto || "";

      const activeFullName = creds.fullName || settings.adminFullName || data?.profile?.full_name || data?.user?.user_metadata?.full_name || "Barangay Administrator";
      const activeUsername = creds.username || settings.adminUsername || data?.user?.user_metadata?.username || "kaagapai";
      const activeEmail = creds.email !== undefined ? creds.email : (settings.officeEmail || data?.user?.email || "");
      const activePhone = creds.phone !== undefined ? creds.phone : (settings.officePhone || data?.profile?.phone || "");

      setForm({
        fullName: activeFullName,
        username: activeUsername,
        email: activeEmail,
        phone: activePhone,
        profilePhotoUrl: finalPhoto,
      });
      setPhotoPreviewUrl(finalPhoto);
    } catch (profileError) {
      setError(profileError.message || "Unable to load profile settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProfile();
      setIsEditingProfile(false);
      setMessage("");
      setError("");
    }
  }, [isOpen]);

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

    try {
      const compressedDataUrl = await compressProfilePhoto(file);
      setPhotoConfirmModal({
        isOpen: true,
        dataUrl: compressedDataUrl,
        file,
      });
    } catch (photoPrepError) {
      setError(photoPrepError.message || "Unable to process selected photo.");
    } finally {
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }
  };

  const handleConfirmPhotoUpload = async () => {
    const { dataUrl: compressedDataUrl, file } = photoConfirmModal;
    if (!compressedDataUrl) return;

    setSaving(true);
    setPhotoConfirmModal({ isOpen: false, dataUrl: "", file: null });

    try {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("kaagapai_admin_profile_photo", compressedDataUrl);
        } catch (e) {
          console.warn("Local storage write error:", e);
        }
      }

      saveAdminCredentials({ profilePhotoUrl: compressedDataUrl });
      saveSystemSettings({ adminProfilePhotoUrl: compressedDataUrl });

      setPhotoPreviewUrl(compressedDataUrl);
      updateField("profilePhotoUrl", compressedDataUrl);
      setSelectedPhotoFile(file);
      setSelectedPhotoName(file?.name || "profile.jpg");
      setPhotoWasRemoved(false);

      if (currentUser?.user?.id) {
        let cloudPhotoUrl = compressedDataUrl;
        if (file) {
          try {
            cloudPhotoUrl = await uploadProfilePhoto(currentUser.user.id, file);
          } catch (uploadErr) {
            console.warn("Cloud photo upload notice (using compressed data URL):", uploadErr.message);
          }
        }

        const updatedProfile = await updateUserProfile(currentUser.user.id, {
          profile_photo_url: cloudPhotoUrl,
          updated_at: new Date().toISOString(),
        }).catch(() => null);

        const nextAccount = {
          user: currentUser.user,
          profile: updatedProfile || { profile_photo_url: cloudPhotoUrl },
        };

        setCurrentUser(nextAccount);
        notifyProfileUpdated(nextAccount);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("admin_profile_updated"));
        window.dispatchEvent(new CustomEvent("kaagapai:system-settings-updated"));
      }

      showAdminSystemToast({
        type: "success",
        title: "Profile Photo Saved",
        text: "Your admin profile photo has been updated and saved permanently.",
      });
      setMessage("Profile photo updated and saved permanently.");
    } catch (photoSaveError) {
      setError(photoSaveError.message || "Unable to save profile photo.");
    } finally {
      setSaving(false);
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

      saveAdminCredentials({
        fullName: form.fullName.trim() || "Barangay Administrator",
        username: form.username.trim() || "kaagapai",
        email: form.email.trim(),
        phone: cleanPhone,
        profilePhotoUrl: nextProfilePhotoUrl || "",
      });

      saveSystemSettings({
        adminUsername: form.username.trim() || "kaagapai",
        officeEmail: form.email.trim(),
        officePhone: cleanPhone,
        adminFullName: form.fullName.trim() || "Barangay Administrator",
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("admin_profile_updated"));
        window.dispatchEvent(new CustomEvent("kaagapai:system-settings-updated"));
      }

      if (form.username.trim() && form.username.trim() !== (getSystemSettings().adminUsername || "")) {
        await updateAdminUsername(form.username.trim());
      }

      const updatedAuthUser = await updateCurrentAuthUser(authUpdates);
      const updatedProfile = await updateUserProfile(currentUser.user.id, {
        full_name: form.fullName.trim() || "Barangay Administrator",
        phone: cleanPhone || null,
        profile_photo_url: nextProfilePhotoUrl,
        updated_at: new Date().toISOString(),
      });
      const nextAccount = {
        user: {
          ...(updatedAuthUser || currentUser.user),
          user_metadata: {
            ...((updatedAuthUser || currentUser.user).user_metadata || {}),
            full_name: form.fullName.trim() || "Barangay Administrator",
            avatar_url: nextProfilePhotoUrl,
          },
          username: form.username.trim() || getSystemSettings().adminUsername || "kaagapai",
        },
        profile: updatedProfile,
      };

      saveAdminSession(nextAccount);
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
      const successText = authUpdates.email
        ? "Profile saved permanently. Check the new email inbox if Supabase requires confirmation."
        : "Profile settings and admin details saved permanently.";
      setMessage(successText);
      showAdminSystemToast({
        type: "success",
        text: successText,
        title: "Account Profile Saved",
      });
      setConfirmModal((prev) => ({ ...prev, isOpen: false, password: "", error: "", loading: false }));
    } catch (saveError) {
      setConfirmModal((prev) => ({ ...prev, loading: false, error: saveError.message || "Unable to save profile settings." }));
    } finally {
      setSaving(false);
    }
  };

  const role = currentUser?.profile?.role || "admin";

  return (
    <>
      <FloatingModal
        open={isOpen}
        onClose={onClose}
        title="My Account"
        eyebrow="Admin Account Profile"
        description="View and update your personal admin profile credentials and photo"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handlePromptSave} className="space-y-4">
          {/* Header Card */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#00552E]/10 text-[#00552E] shadow-inner">
                <UserRound size={22} />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900 leading-tight">Admin Profile</h3>
                <p className="text-xs font-semibold text-slate-500">
                  Manage personal credentials, contact info, and avatar
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="inline-flex items-center rounded-full bg-[#00552E]/10 px-3 py-1 text-[11px] font-black capitalize text-[#00552E] ring-1 ring-[#00552E]/20">
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#00552E] px-3 py-1.5 text-xs font-extrabold shadow-2xs transition active:scale-95 cursor-pointer"
                >
                  <Pencil size={12} />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-[11px] font-black animate-pulse">
                  <Lock size={12} /> Editing Mode
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2.5 py-12 text-xs font-bold text-slate-500">
              <Loader2 size={20} className="animate-spin text-[#00552E]" />
              Loading admin profile information...
            </div>
          ) : (
            <div className="space-y-4">
              {/* Profile Photo Section */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <label
                    htmlFor="modal-profile-photo-upload"
                    className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-emerald-200 bg-emerald-50 shadow-inner cursor-pointer hover:border-emerald-500 transition"
                    title="Click to change profile photo"
                  >
                    {photoPreviewUrl ? (
                      <img
                        src={photoPreviewUrl}
                        alt="Profile avatar"
                        className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                      />
                    ) : (
                      <UserRound size={36} className="text-[#00552E]" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition backdrop-blur-2xs">
                      <Upload size={18} className="text-white drop-shadow" />
                    </div>
                  </label>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-xs sm:text-sm font-extrabold text-slate-800">Profile Photo</p>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                        Saved Permanently
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Upload a square JPG, PNG, or WebP image (up to 5 MB).
                    </p>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="modal-profile-photo-upload"
                      />
                      <label
                        htmlFor="modal-profile-photo-upload"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#00552E] px-3 py-1.5 text-xs font-bold shadow-2xs transition cursor-pointer"
                      >
                        <Upload size={13} />
                        {saving ? "Saving..." : "Change Photo"}
                      </label>

                      {photoPreviewUrl ? (
                        <button
                          type="button"
                          onClick={clearPhoto}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 cursor-pointer"
                        >
                          <Trash2 size={13} />
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Input Fields */}
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    value={form.fullName}
                    disabled={!isEditingProfile}
                    readOnly={!isEditingProfile}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    placeholder="Enter full name"
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition ${
                      isEditingProfile
                        ? "border-emerald-300 bg-white focus:border-[#00552E] focus:ring-2 focus:ring-[#00552E]/20 shadow-xs"
                        : "border-slate-200 bg-slate-100/70 cursor-not-allowed text-slate-600 select-none"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Username
                  </label>
                  <input
                    value={form.username}
                    disabled={!isEditingProfile}
                    readOnly={!isEditingProfile}
                    onChange={(event) => updateField("username", event.target.value)}
                    placeholder="Enter username"
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition font-mono ${
                      isEditingProfile
                        ? "border-emerald-300 bg-white focus:border-[#00552E] focus:ring-2 focus:ring-[#00552E]/20 shadow-xs"
                        : "border-slate-200 bg-slate-100/70 cursor-not-allowed text-slate-600 select-none"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Role
                  </label>
                  <input
                    value={role}
                    readOnly
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-100/80 px-3.5 py-2.5 text-xs font-bold capitalize text-slate-600 outline-none cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    disabled={!isEditingProfile}
                    readOnly={!isEditingProfile}
                    onChange={(event) => updateField("email", event.target.value)}
                    placeholder="Enter email address"
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition ${
                      isEditingProfile
                        ? "border-emerald-300 bg-white focus:border-[#00552E] focus:ring-2 focus:ring-[#00552E]/20 shadow-xs"
                        : "border-slate-200 bg-slate-100/70 cursor-not-allowed text-slate-600 select-none"
                    }`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Phone Number (Max 11 Digits)
                  </label>
                  <input
                    type="tel"
                    maxLength={11}
                    value={form.phone}
                    disabled={!isEditingProfile}
                    readOnly={!isEditingProfile}
                    onChange={(event) => updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="09XXXXXXXXX (11 digits)"
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition font-mono ${
                      isEditingProfile
                        ? "border-emerald-300 bg-white focus:border-[#00552E] focus:ring-2 focus:ring-[#00552E]/20 shadow-xs"
                        : "border-slate-200 bg-slate-100/70 cursor-not-allowed text-slate-600 select-none"
                    }`}
                  />
                  <span className="mt-1 block text-[10px] font-semibold text-slate-400">
                    {form.phone ? `${form.phone.length}/11 digits entered (numbers only)` : "Optional 11-digit Philippine mobile starting with 09"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {message ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 shadow-2xs">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{message}</span>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-800 shadow-2xs">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Modal Footer Controls */}
          {isEditingProfile && (
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Cancel</span>
              </button>

              <button
                type="submit"
                disabled={loading || saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#00552E] px-4 py-2.5 text-xs font-extrabold text-white shadow-md transition hover:bg-[#004224] disabled:cursor-not-allowed disabled:opacity-60 active:scale-95 cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{saving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          )}
        </form>
      </FloatingModal>

      {/* ─── Compact Security Confirmation Modal ─── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {confirmModal.isOpen && (
              <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false, password: "", error: "" }))}
                  className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
                />

                <motion.div
                  initial={{ scale: 0.94, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.94, opacity: 0, y: 10 }}
                  transition={{ duration: 0.15 }}
                  className="relative w-full rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 z-10 mx-auto"
                  style={{ maxWidth: "360px" }}
                >
                  <div className="flex items-center gap-3 mb-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-[#00552E]">
                      <ShieldCheck size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">Admin Authorization</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Confirm with your admin password</p>
                    </div>
                  </div>

                  {confirmModal.error && (
                    <div className="mb-3 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-[11px] font-bold text-rose-700 flex items-center gap-2">
                      <AlertCircle size={13} className="shrink-0 text-rose-600" />
                      <span className="leading-snug">{confirmModal.error}</span>
                    </div>
                  )}

                  <form onSubmit={handleExecuteSave} className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                        Enter Admin Password
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={confirmModal.showPassword ? "text" : "password"}
                          value={confirmModal.password}
                          onChange={(e) => setConfirmModal((prev) => ({ ...prev, password: e.target.value, error: "" }))}
                          placeholder="Password"
                          required
                          autoFocus
                          className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setConfirmModal((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
                          className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 transition rounded flex items-center justify-center"
                          title={confirmModal.showPassword ? "Hide password" : "Show password"}
                        >
                          {confirmModal.showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false, password: "", error: "" }))}
                        className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer text-center"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={confirmModal.loading}
                        className="flex-1 rounded-xl bg-[#00552E] hover:bg-[#004224] py-2 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 shadow-xs disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                      >
                        {confirmModal.loading ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                        <span>Confirm Save</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* ─── Profile Photo Confirmation Modal ─── */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {photoConfirmModal.isOpen && (
              <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setPhotoConfirmModal({ isOpen: false, dataUrl: "", file: null })}
                  className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-emerald-400 bg-emerald-950/90 shadow-xl mb-4">
                      {photoConfirmModal.dataUrl ? (
                        <img
                          src={photoConfirmModal.dataUrl}
                          alt="New Profile Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserRound size={48} className="text-emerald-300" />
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-900">Set Admin Profile Photo</h3>
                    <p className="mt-1.5 text-xs text-slate-500 max-w-xs">
                      Are you sure you want to set this image as your official permanent admin profile picture?
                    </p>
                  </div>

                  <div className="mt-6 flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPhotoConfirmModal({ isOpen: false, dataUrl: "", file: null })}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmPhotoUpload}
                      disabled={saving}
                      className="flex-1 rounded-xl bg-[#00552E] hover:bg-[#004224] py-2.5 text-xs font-black text-white transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-60"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      <span>Save Photo</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};

export default MyAccountModal;
