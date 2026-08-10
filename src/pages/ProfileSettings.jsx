import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Save, Trash2, Upload, UserRound, X } from "lucide-react";
import PageWrapper from "../components/PageWrapper";
import {
  getCurrentUserWithProfile,
  notifyProfileUpdated,
  updateCurrentAuthUser,
  updateUserProfile,
  uploadProfilePhoto,
} from "../services/authService";

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
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    profilePhotoUrl: "",
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
        setForm({
          fullName: getDisplayName(data?.user),
          username: data?.user?.user_metadata?.username || data?.user?.email?.split("@")[0] || "admin",
          email: data?.user?.email || "",
          phone: data?.profile?.phone || "",
          profilePhotoUrl: data?.profile?.profile_photo_url || "",
        });
        setPhotoPreviewUrl(data?.profile?.profile_photo_url || "");
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
      setMessage("Profile photo updated.");
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

  const handleSave = async (event) => {
    event.preventDefault();
    if (!currentUser?.user?.id) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
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

      const updatedAuthUser = await updateCurrentAuthUser(authUpdates);
      const updatedProfile = await updateUserProfile(currentUser.user.id, {
        phone: form.phone.trim() || null,
        profile_photo_url: nextProfilePhotoUrl,
        updated_at: new Date().toISOString(),
      });
      const nextAccount = {
        user: updatedAuthUser || currentUser.user,
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

      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }

      notifyProfileUpdated(nextAccount);
      setMessage(
        authUpdates.email
          ? "Profile saved. Check the new email inbox if Supabase requires confirmation."
          : "Profile settings saved."
      );
    } catch (saveError) {
      setError(saveError.message || "Unable to save profile settings.");
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
      <form onSubmit={handleSave} className="max-w-4xl space-y-6 pb-20">
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

            <span className="inline-flex items-center rounded-full bg-[#00552E]/10 px-3.5 py-1 text-xs font-bold capitalize text-[#00552E] ring-1 ring-[#00552E]/20">
              {role}
            </span>
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
                <p className="text-sm font-bold text-slate-800">Profile Picture</p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#00552E]/10 text-[#00552E] ring-4 ring-white shadow-sm">
                    {photoPreviewUrl ? (
                      <img
                        src={photoPreviewUrl}
                        alt="Profile avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound size={36} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700">
                      {selectedPhotoName || (photoPreviewUrl ? "Current profile photo" : "No photo selected")}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Accepted formats: JPG, PNG, or WebP (max 5 MB).
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoUpload}
                        disabled={saving}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#14532D] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0f3e21] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Upload size={14} />
                        Upload Photo
                      </button>
                      {photoPreviewUrl ? (
                        <button
                          type="button"
                          onClick={clearPhoto}
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Fields Grid */}
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm font-bold text-slate-700">
                  Full Name
                  <input
                    value={form.fullName}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    placeholder="Enter full name"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/20"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Username
                  <input
                    value={form.username}
                    onChange={(event) => updateField("username", event.target.value)}
                    placeholder="Enter username"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/20"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Role
                  <input
                    value={role}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-sm font-semibold capitalize text-slate-600 outline-none"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Email Address
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    placeholder="Enter email address"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/20"
                  />
                </label>

                <label className="block text-sm font-bold text-slate-700 md:col-span-2">
                  Phone Number
                  <input
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    placeholder="Enter contact phone number"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-2 focus:ring-[#14532D]/20"
                  />
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

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#14532D] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0f3e21] disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </form>
    </PageWrapper>
  );
};

export default ProfileSettings;
