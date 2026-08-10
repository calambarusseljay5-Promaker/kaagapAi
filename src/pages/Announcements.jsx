import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Copy,
  Edit2,
  Home,
  Loader,
  Megaphone,
  Phone,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Header from "../components/Header";
import FloatingModal from "../components/FloatingModal";
import { useConfirm } from "../context/ConfirmContext";
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  updateAnnouncement,
} from "../services/announcementService";
import { fetchResidents } from "../services/adminService";
import {
  isValidSmsPhone,
  normalizeSmsPhone,
  parseSmsRecipients,
  sendBulkSmsNotifications,
} from "../services/smsService";
import {
  getResidentDisplayName,
  purokDefinitions,
  normalizePurokValue,
} from "../utils/residentProfile";

const HOUSEHOLD_AUDIENCE = "Family Household Representatives";

const audienceOptions = [
  "All Residents",
  "Family Household Representatives",
  "Senior Citizens",
  "PWD/PWED Residents",
  "Youth",
  "Selected Resident",
  "Multiple Puroks",
  ...purokDefinitions.map((p) => `Purok: ${p.label}`),
];

const categoryOptions = ["General", "Community", "Livelihood", "Training", "Health", "Emergency"];

const announcementMessageTemplates = {
  General:
    "Barangay Announcement:\n\nPlease be informed of an important update from the barangay office.\n\nDetails:\n[Add announcement details here]\n\nPlease be guided accordingly.",
  Community:
    "Community Announcement:\n\nThe barangay invites residents to join the upcoming community activity.\n\nActivity:\nDate and Time:\nVenue:\n\nYour participation is highly encouraged.",
  Livelihood:
    "Livelihood Announcement:\n\nA livelihood opportunity or program is available for interested residents.\n\nProgram/Opportunity:\nRequirements:\nSchedule:\nContact Person:\n\nPlease visit or contact the barangay office for assistance.",
  Training:
    "Training Announcement:\n\nThe barangay will conduct a training session for interested residents.\n\nTraining Topic:\nDate and Time:\nVenue:\nSlots Available:\n\nPlease coordinate with the barangay office to register.",
  Health:
    "Health Advisory:\n\nPlease be informed of an upcoming health service or advisory for residents.\n\nService/Advisory:\nDate and Time:\nVenue:\nReminders:\n\nKindly follow the health guidelines and bring necessary documents.",
  Emergency:
    "Emergency Announcement:\n\nThis is an urgent barangay advisory.\n\nSituation:\nAffected Area:\nImmediate Action:\nContact Number:\n\nPlease stay alert and follow official instructions.",
};

const templateMessages = Object.values(announcementMessageTemplates);

const isTemplateMessage = (message) => templateMessages.includes(message);

const getInitialForm = () => ({
  title: "",
  body: announcementMessageTemplates.General,
  category: "General",
  audience: "All Residents",
  status: "Published",
  publish_date: new Date().toISOString().slice(0, 10),
  expires_at: "",
  sms_recipient_phones: "",
});

const statusClass = (status) => {
  if (status === "Published") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "Archived") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
};

const formatDate = (dateValue) => {
  if (!dateValue) return "Not set";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString();
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizePhone = normalizeSmsPhone;

const hasPhone = (resident) => isValidSmsPhone(resident?.phone);

const getHouseholdKey = (resident) => {
  const householdNo = normalizeKey(resident.household_no);
  if (householdNo) return `household:${householdNo}`;

  const houseLocation = [resident.purok, resident.house_no]
    .map(normalizeKey)
    .filter(Boolean)
    .join("|");
  if (houseLocation) return `house:${houseLocation}`;

  const addressLocation = [resident.purok, resident.address]
    .map(normalizeKey)
    .filter(Boolean)
    .join("|");
  if (addressLocation) return `address:${addressLocation}`;

  return `resident:${resident.id || getResidentDisplayName(resident)}`;
};

const getHouseholdLabel = (resident) => {
  if (resident.household_no) return `Household ${resident.household_no}`;
  if (resident.house_no || resident.purok) {
    return [resident.purok, resident.house_no && `House ${resident.house_no}`]
      .filter(Boolean)
      .join(" - ");
  }
  return resident.address || "Unlisted household";
};

const getRepresentativeRank = (resident) => {
  const relationship = normalizeKey(resident.relationship_to_household_head);
  if (relationship === "head") return 0;
  if (relationship === "spouse") return 1;
  if (relationship === "parent") return 2;
  return 3;
};

const chooseHouseholdRepresentative = (members) =>
  [...members].sort((first, second) => {
    if (hasPhone(first) !== hasPhone(second)) return hasPhone(first) ? -1 : 1;
    const relationshipRank = getRepresentativeRank(first) - getRepresentativeRank(second);
    if (relationshipRank !== 0) return relationshipRank;
    return getResidentDisplayName(first).localeCompare(getResidentDisplayName(second));
  })[0];

const buildHouseholdSmsRecipients = (residents = []) => {
  const groups = new Map();

  residents
    .filter((resident) => resident?.status !== "Archived")
    .forEach((resident) => {
      const key = getHouseholdKey(resident);
      const current = groups.get(key) || [];
      groups.set(key, [...current, resident]);
    });

  const households = [...groups.values()].map((members) => {
    const representative = chooseHouseholdRepresentative(members);

    return {
      key: getHouseholdKey(representative),
      householdLabel: getHouseholdLabel(representative),
      members,
      representative,
      phone: normalizePhone(representative?.phone),
    };
  });

  households.sort((first, second) => first.householdLabel.localeCompare(second.householdLabel));

  return {
    households,
    phoneRecipients: households.filter((item) => item.phone),
    missingPhoneHouseholds: households.filter((item) => !item.phone),
  };
};

const isHouseholdAnnouncement = (audience) => audience === HOUSEHOLD_AUDIENCE;

const buildAnnouncementSmsMessage = (announcement) =>
  [
    "Barangay Announcement",
    announcement.title ? `Title: ${announcement.title}` : "",
    announcement.body || "",
    announcement.publish_date ? `Date: ${formatDate(announcement.publish_date)}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1500);

const formatBulkSmsFailureDetails = (failed = []) => {
  const firstReason = failed.find((item) => item.error)?.error;
  if (!firstReason) return "";
  return ` Reason: ${firstReason}`;
};

const Announcements = () => {
  const { confirm } = useConfirm();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formData, setFormData] = useState(getInitialForm);
  const [residents, setResidents] = useState([]);
  const [recipientError, setRecipientError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [sendingAnnouncementId, setSendingAnnouncementId] = useState(null);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAnnouncements({
        search,
        status: statusFilter,
        category: categoryFilter,
      });
      setAnnouncements(data);
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to load announcements." });
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(loadAnnouncements, 0);
    return () => window.clearTimeout(timer);
  }, [loadAnnouncements]);

  useEffect(() => {
    let isMounted = true;

    const loadResidents = async () => {
      try {
        const data = await fetchResidents("", "", { excludeArchived: true });
        if (isMounted) {
          setResidents(data);
          setRecipientError("");
        }
      } catch (error) {
        if (isMounted) {
          setResidents([]);
          setRecipientError(error.message || "Unable to load resident phone numbers.");
        }
      }
    };

    loadResidents();

    return () => {
      isMounted = false;
    };
  }, []);

  const householdSmsRecipients = useMemo(
    () => buildHouseholdSmsRecipients(residents),
    [residents]
  );

  const formSmsRecipients = useMemo(
    () => parseSmsRecipients(formData.sms_recipient_phones),
    [formData.sms_recipient_phones]
  );

  const stats = useMemo(
    () => ({
      total: announcements.length,
      published: announcements.filter((item) => item.status === "Published").length,
      drafts: announcements.filter((item) => item.status === "Draft").length,
      archived: announcements.filter((item) => item.status === "Archived").length,
      householdSms: householdSmsRecipients.phoneRecipients.length,
    }),
    [announcements, householdSmsRecipients.phoneRecipients.length]
  );

  const [residentSearchQuery, setResidentSearchQuery] = useState("");

  const filteredFormResidents = useMemo(() => {
    const query = residentSearchQuery.trim().toLowerCase();
    if (!query) return residents.slice(0, 50);
    return residents
      .filter((r) =>
        [r.full_name, r.email, r.phone, r.purok]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(query))
      )
      .slice(0, 50);
  }, [residents, residentSearchQuery]);

  const getAudienceSelectValue = (audience) => {
    if (!audience) return "All Residents";
    if (audience.startsWith("Selected Resident:")) return "Selected Resident";
    if (audience.startsWith("Purok: ")) return audience;
    if (audience.startsWith("Puroks: ")) return "Multiple Puroks";
    return audience;
  };

  const handleSelectResidentChange = (residentId) => {
    const res = residents.find((r) => r.id === residentId);
    if (res) {
      setFormData((current) => ({
        ...current,
        audience: `Selected Resident: ${res.full_name}`,
        sms_recipient_phones: res.phone || "",
      }));
    } else {
      setFormData((current) => ({
        ...current,
        audience: "Selected Resident:",
        sms_recipient_phones: "",
      }));
    }
  };

  const openCreate = () => {
    setEditingAnnouncement(null);
    setFormData(getInitialForm());
    setMessage(null);
    setCopyStatus("");
    setResidentSearchQuery("");
    setShowModal(true);
  };

  const openEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title || "",
      body: announcement.body || "",
      category: announcement.category || "General",
      audience: announcement.audience || "All Residents",
      status: announcement.status || "Draft",
      publish_date: announcement.publish_date || new Date().toISOString().slice(0, 10),
      expires_at: announcement.expires_at || "",
      sms_recipient_phones: announcement.sms_recipient_phones || "",
    });
    setMessage(null);
    setCopyStatus("");
    setResidentSearchQuery("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAnnouncement(null);
    setFormData(getInitialForm());
    setCopyStatus("");
  };

  const handleInput = (event) => {
    const { name, value } = event.target;
    setFormData((current) => {
      if (name !== "category") {
        return { ...current, [name]: value };
      }

      const nextTemplate = announcementMessageTemplates[value] || "";
      const shouldApplyTemplate = !current.body.trim() || isTemplateMessage(current.body);

      return {
        ...current,
        category: value,
        body: shouldApplyTemplate ? nextTemplate : current.body,
      };
    });
  };

  const handleSaveAnnouncement = async () => {
    setSaving(true);
    setMessage(null);

    try {
      if (formSmsRecipients.invalid.length > 0) {
        throw new Error(`Invalid SMS phone number(s): ${formSmsRecipients.invalid.slice(0, 3).join(", ")}`);
      }

      const announcementPayload = {
        ...formData,
        status: "Draft", // Always save as Draft first
        publish_date: formData.publish_date || new Date().toISOString().slice(0, 10),
        sms_recipient_phones: formSmsRecipients.recipients.join("\n"),
      };

      if (editingAnnouncement) {
        await updateAnnouncement(editingAnnouncement.id, announcementPayload);
      } else {
        await createAnnouncement(announcementPayload);
      }

      setMessage({
        type: "success",
        text: "Announcement saved successfully as Draft.",
      });

      closeModal();
      await loadAnnouncements();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to save announcement." });
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (announcement, status) => {
    if (status === "Published") {
      const ok = await confirm({
        title: "Publish Announcement",
        message: "Are you sure you want to publish this announcement to all residents?",
        confirmText: "Publish",
        cancelText: "Cancel",
        variant: "emerald",
        icon: Megaphone,
      });
      if (!ok) return;
    }

    setUpdatingStatusId(announcement.id);
    setMessage(null);

    try {
      await updateAnnouncement(announcement.id, { ...announcement, status });
      
      let smsResultMsg = "";
      if (status === "Published") {
        let phones = parseSmsRecipients(announcement.sms_recipient_phones || "").recipients;
        
        // Auto-include based on audience filter
        if (announcement.audience === "Family Household Representatives") {
          const hhPhones = householdSmsRecipients.phoneRecipients.map(r => normalizePhone(r.phone)).filter(Boolean);
          phones = [...new Set([...phones, ...hhPhones])];
        } else if (announcement.audience === "All Residents" || announcement.audience === "Registered Residents") {
          const allPhones = residents.filter(r => hasPhone(r)).map(r => normalizePhone(r.phone)).filter(Boolean);
          phones = [...new Set([...phones, ...allPhones])];
        } else if (announcement.audience && announcement.audience.startsWith("Purok: ")) {
          const targetPurokLabel = announcement.audience.replace("Purok: ", "").trim();
          const targetPurok = purokDefinitions.find((p) => p.label === targetPurokLabel);
          if (targetPurok) {
            const targetValue = targetPurok.value;
            const purokPhones = residents
              .filter((r) => normalizePurokValue(r.purok) === targetValue && hasPhone(r))
              .map((r) => normalizePhone(r.phone))
              .filter(Boolean);
            phones = [...new Set([...phones, ...purokPhones])];
          }
        } else if (announcement.audience && announcement.audience.startsWith("Puroks: ")) {
          const targetLabels = announcement.audience.replace("Puroks: ", "").split(",").map((s) => s.trim()).filter(Boolean);
          const targetValues = targetLabels.map((lbl) => purokDefinitions.find((p) => p.label === lbl)?.value).filter(Boolean);
          if (targetValues.length > 0) {
            const purokPhones = residents
              .filter((r) => targetValues.includes(normalizePurokValue(r.purok)) && hasPhone(r))
              .map((r) => normalizePhone(r.phone))
              .filter(Boolean);
            phones = [...new Set([...phones, ...purokPhones])];
          }
        }
        
        if (phones.length > 0) {
          const smsResult = await sendBulkSmsNotifications({
            recipients: phones,
            body: buildAnnouncementSmsMessage(announcement),
          });
          smsResultMsg = smsResult.failed.length > 0
            ? ` SMS partially failed for ${smsResult.failed.length} recipients.`
            : ` Auto-sent SMS to ${smsResult.sent.length} recipients.`;
        }
      }

      setMessage({
        type: "success",
        text:
          status === "Published"
            ? `Announcement published.${smsResultMsg}`
            : `Announcement marked as ${status.toLowerCase()}.`,
      });

      await loadAnnouncements();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to update announcement." });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDelete = async (announcement) => {
    const ok = await confirm({
      title: "Delete Announcement",
      message: "Are you sure you want to delete this announcement?",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
      icon: Trash2,
    });
    if (!ok) return;

    try {
      await deleteAnnouncement(announcement.id);
      setMessage({ type: "success", text: "Announcement deleted." });
      await loadAnnouncements();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to delete announcement." });
    }
  };

  const handleCopyHouseholdPhones = async () => {
    const phoneList = householdSmsRecipients.phoneRecipients
      .map(
        (item) =>
          `${item.phone} - ${getResidentDisplayName(item.representative)} (${item.householdLabel})`
      )
      .join("\n");

    if (!phoneList) {
      setCopyStatus("No household phone numbers available to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(phoneList);
      setCopyStatus("Household SMS phone list copied.");
    } catch {
      setCopyStatus("Unable to copy automatically. Select and copy the list manually.");
    }
  };

  const handleSendAnnouncementSms = async (announcement) => {
    const parsed = parseSmsRecipients(announcement.sms_recipient_phones);

    if (parsed.invalid.length > 0) {
      setMessage({
        type: "error",
        text: `Invalid SMS phone number(s): ${parsed.invalid.slice(0, 3).join(", ")}`,
      });
      return;
    }

    if (parsed.recipients.length === 0) {
      setMessage({
        type: "error",
        text: "Add SMS recipient phone numbers to this announcement first.",
      });
      return;
    }

    if (
      !window.confirm(
        `Send this announcement by SMS to ${parsed.recipients.length} resident phone number(s)?`
      )
    ) {
      return;
    }

    setSendingAnnouncementId(announcement.id);
    setMessage(null);

    try {
      const result = await sendBulkSmsNotifications({
        recipients: parsed.recipients,
        body: buildAnnouncementSmsMessage(announcement),
      });

      setMessage({
        type: result.failed.length > 0 ? "error" : "success",
        text:
          result.failed.length > 0
            ? `SMS sent to ${result.sent.length} of ${result.total} recipient(s). Failed: ${result.failed
              .slice(0, 3)
              .map((item) => item.to)
              .join(", ")}.${formatBulkSmsFailureDetails(result.failed)}`
            : `TextBee accepted ${result.sent.length} SMS message(s) into the device queue. Check the TextBee device and dashboard for delivery status if phones do not receive it.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to send announcement SMS.",
      });
    } finally {
      setSendingAnnouncementId(null);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Header title="Announcements" subtitle="Create, publish, and manage barangay announcements" />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {message ? (
          <div
            className={`glass-panel mb-5 p-4 text-sm font-semibold shadow-soft ${message.type === "success"
                ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/50"
                : "bg-rose-50/80 text-rose-700 border-rose-200/50"
              }`}
          >
            {message.text}
          </div>
        ) : null}

        <div className="glass-container mt-6">
          <div className="p-6 border-b border-slate-200/50 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-white/20">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 flex-1 max-w-4xl">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 text-emerald-500" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title, message..."
                  className="w-full h-[46px] rounded-[12px] border border-slate-200 bg-white/60 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-[46px] rounded-[12px] border border-slate-200 bg-white/60 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              >
                <option value="">All categories</option>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-[46px] rounded-[12px] border border-slate-200 bg-white/60 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              >
                <option value="">All statuses</option>
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl bg-[#14532D] px-6 text-sm font-bold text-white transition hover:bg-[#0f3e21] shadow-sm hover:shadow active:scale-95 shrink-0"
            >
              <Plus size={18} />
              New Announcement
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="p-10 text-center text-slate-500 font-semibold bg-white/40 rounded-xl">
                <Loader className="mx-auto mb-3 animate-spin" size={24} />
                Loading announcements...
              </div>
            ) : announcements.length === 0 ? (
              <div className="p-10 text-center text-slate-500 font-semibold bg-white/40 rounded-xl">No announcements found.</div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {announcements.map((announcement) => {
                  const announcementSmsRecipients = parseSmsRecipients(
                    announcement.sms_recipient_phones
                  ).recipients;

                  const borderColor = announcement.status === "Published" ? "#10B981" : announcement.status === "Draft" ? "#F59E0B" : "#94A3B8";

                  return (
                    <article key={announcement.id} className="relative rounded-[20px] bg-white/60 border border-slate-200/60 p-6 flex flex-col group overflow-hidden border-l-[6px] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all" style={{ borderLeftColor: borderColor }}>
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                          {announcement.category}
                        </span>
                        <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${statusClass(announcement.status)}`}>
                          {announcement.status}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-slate-800 line-clamp-2 mb-2">{announcement.title}</h3>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 line-clamp-3 mb-6 flex-1">
                        {announcement.body}
                      </p>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-medium text-slate-500 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Audience</p>
                          <p className="text-slate-700 truncate" title={announcement.audience || "-"}>
                            {announcement.audience || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">SMS Targets</p>
                          <p className="text-slate-700">
                            {isHouseholdAnnouncement(announcement.audience)
                              ? `${householdSmsRecipients.phoneRecipients.length} hhs`
                              : announcementSmsRecipients.length
                                ? `${announcementSmsRecipients.length} recips`
                                : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Publish</p>
                          <p className="text-slate-700">{formatDate(announcement.publish_date)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Expires</p>
                          <p className="text-slate-700">{formatDate(announcement.expires_at)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100 mt-auto">
                        {announcement.status !== "Published" ? (
                          <button
                            type="button"
                            onClick={() => handleStatus(announcement, "Published")}
                            disabled={updatingStatusId === announcement.id}
                            className="inline-flex flex-1 h-[38px] items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {updatingStatusId === announcement.id ? (
                              <Loader size={14} className="animate-spin" />
                            ) : (
                              <Send size={14} />
                            )}
                            Publish
                          </button>
                        ) : null}

                        {/* Removed isolated Send SMS button as it's now integrated into Publish */}

                        <div className="flex gap-2 w-full mt-2">
                          {announcement.status !== "Archived" ? (
                            <button
                              type="button"
                              onClick={() => handleStatus(announcement, "Archived")}
                              className="inline-flex flex-1 h-[38px] items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                            >
                              <Archive size={14} /> Archive
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openEdit(announcement)}
                            className="inline-flex flex-1 h-[38px] items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-bold text-blue-600 transition hover:bg-slate-50 hover:border-blue-200"
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(announcement)}
                            className="inline-flex w-[46px] h-[38px] items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-bold text-rose-600 transition hover:bg-rose-50 hover:border-rose-200"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <FloatingModal
        open={showModal}
        onClose={closeModal}
        title={editingAnnouncement ? "Edit Announcement" : "New Announcement"}
        maxWidth="max-w-2xl"
        eyebrow="Announcement Details"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row justify-end">
            <button
              type="button"
              onClick={closeModal}
              className="px-6 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAnnouncement}
              disabled={saving}
              className="flex min-w-[120px] items-center justify-center gap-2 rounded-xl bg-[#14532D] px-6 py-2.5 font-bold text-white transition hover:bg-[#0f3e21] disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            >
              {saving ? <Loader size={16} className="animate-spin" /> : null}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        }
      >
        <div className="p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700 sm:col-span-2">
              Title *
              <input
                name="title"
                value={formData.title}
                onChange={handleInput}
                className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Category
              <select
                name="category"
                value={formData.category}
                onChange={handleInput}
                className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              >
                {categoryOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">
              Audience
              <select
                name="audience"
                value={getAudienceSelectValue(formData.audience)}
                onChange={(event) => {
                  const val = event.target.value;
                  if (val === "Selected Resident") {
                    setFormData((current) => ({
                      ...current,
                      audience: "Selected Resident:",
                      sms_recipient_phones: "",
                    }));
                  } else {
                    setFormData((current) => ({
                      ...current,
                      audience: val,
                      sms_recipient_phones: "",
                    }));
                  }
                  setResidentSearchQuery("");
                }}
                className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              >
                {audienceOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            {getAudienceSelectValue(formData.audience) === "Selected Resident" && (
              <div className="sm:col-span-2 border border-slate-100 bg-slate-50/50 p-4 rounded-xl space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Resident Target</p>
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    value={residentSearchQuery}
                    onChange={(event) => setResidentSearchQuery(event.target.value)}
                    placeholder="Search resident name..."
                    className="w-full h-[38px] rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-xs font-medium outline-none transition focus:border-[#14532D] focus:ring-2 focus:ring-[#14532D]/10 shadow-sm"
                  />
                </div>
                <select
                  value={
                    residents.find((r) => `Selected Resident: ${r.full_name}` === formData.audience)?.id || ""
                  }
                  onChange={(event) => handleSelectResidentChange(event.target.value)}
                  className="w-full h-[38px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium outline-none transition focus:border-[#14532D] focus:ring-2 focus:ring-[#14532D]/10 shadow-sm"
                >
                  <option value="">Choose resident</option>
                  {filteredFormResidents.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name} - {r.purok || "No Purok"} ({r.phone || "No phone"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {getAudienceSelectValue(formData.audience) === "Multiple Puroks" && (
              <div className="sm:col-span-2 border border-slate-100 bg-slate-50/50 p-4 rounded-xl space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Puroks Targets</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {purokDefinitions.map((purok) => {
                    const currentPuroks = formData.audience.startsWith("Puroks: ")
                      ? formData.audience.replace("Puroks: ", "").split(",").map(s => s.trim()).filter(Boolean)
                      : [];
                    const isChecked = currentPuroks.includes(purok.label);
                    
                    return (
                      <label key={purok.value} className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer hover:text-[#14532D]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let nextPuroks = [...currentPuroks];
                            if (e.target.checked) {
                              nextPuroks.push(purok.label);
                            } else {
                              nextPuroks = nextPuroks.filter(lbl => lbl !== purok.label);
                            }
                            setFormData((current) => ({
                              ...current,
                              audience: `Puroks: ${nextPuroks.join(", ")}`,
                              sms_recipient_phones: "",
                            }));
                          }}
                          className="h-4 w-4 rounded border-slate-350 text-[#14532D] focus:ring-[#14532D] cursor-pointer"
                        />
                        <span>{purok.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {isHouseholdAnnouncement(formData.audience) ? (
              <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 sm:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                  <div className="flex gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                      <Home size={22} />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-blue-950">
                        One SMS recipient per family household
                      </p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-blue-800">
                        The system chooses the household head first. If the head has no phone number, it chooses another household member with a phone number.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyHouseholdPhones}
                    className="inline-flex h-[36px] items-center justify-center gap-2 rounded-lg bg-white border border-blue-200 px-4 text-xs font-bold text-blue-700 transition hover:bg-blue-50 shadow-sm shrink-0"
                  >
                    <Copy size={14} />
                    Copy phones
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 mb-4">
                  <div className="rounded-xl bg-white px-4 py-3 shadow-sm border border-slate-100">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Households</p>
                    <p className="mt-1 text-2xl font-black text-slate-800">
                      {householdSmsRecipients.households.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3 shadow-sm border border-slate-100">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">With phone</p>
                    <p className="mt-1 text-2xl font-black text-emerald-600">
                      {householdSmsRecipients.phoneRecipients.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3 shadow-sm border border-slate-100">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Missing phone</p>
                    <p className="mt-1 text-2xl font-black text-amber-500">
                      {householdSmsRecipients.missingPhoneHouseholds.length}
                    </p>
                  </div>
                </div>

                {recipientError ? (
                  <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                    {recipientError}
                  </p>
                ) : null}

                {copyStatus ? (
                  <p className="mb-4 text-xs font-bold text-blue-700">{copyStatus}</p>
                ) : null}

                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm custom-scrollbar">
                  {householdSmsRecipients.phoneRecipients.length === 0 ? (
                    <p className="p-6 text-center text-sm font-semibold text-slate-500">
                      No household phone recipients available yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {householdSmsRecipients.phoneRecipients.slice(0, 12).map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {getResidentDisplayName(item.representative)}
                            </p>
                            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                              {item.householdLabel} - {item.members.length} member(s)
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700">
                            <Phone size={12} />
                            {item.phone}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {householdSmsRecipients.phoneRecipients.length > 12 ? (
                  <p className="mt-3 text-xs font-semibold text-blue-700 text-center">
                    Showing 12 of {householdSmsRecipients.phoneRecipients.length} phone recipients. Use copy to get the full list.
                  </p>
                ) : null}
              </section>
            ) : null}
            <label className="text-sm font-bold text-slate-700">
              Publish Date
              <input
                name="publish_date"
                type="date"
                value={formData.publish_date}
                onChange={handleInput}
                className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Expiration Date
              <input
                name="expires_at"
                type="date"
                value={formData.expires_at}
                onChange={handleInput}
                className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              />
            </label>
            <label className="text-sm font-bold text-slate-700 sm:col-span-2">
              Message *
              <textarea
                name="body"
                value={formData.body}
                onChange={handleInput}
                rows="8"
                className="mt-2 w-full rounded-[12px] border border-slate-200 bg-slate-50 p-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              />
            </label>
          </div>
        </div>
      </FloatingModal>
    </div>
  );
};

export default Announcements;
