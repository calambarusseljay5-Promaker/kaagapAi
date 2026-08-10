import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConfirm } from "../context/ConfirmContext";
import SettingsDrawer from "../components/SettingsDrawer";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area
} from "recharts";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  Bot,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileText,
  HelpCircle,
  Home,
  KeyRound,
  Loader,
  LogOut,
  Megaphone,
  Menu,
  PlusCircle,
  Plus,
  MessageSquare,
  History,
  RefreshCw,
  Send,
  Search,
  Settings,
  User,
  UserCheck,
  X,
  Clock,
  Calendar,
  TrendingUp,
  FileSpreadsheet,
  Info,
  CheckCircle,
  Briefcase,
  Star,
  Upload,
  AlertCircle,
  Users,
  MapPin,
  Sun,
  Trash2,
  Sparkles,
  Shield,
  Moon,
  Monitor,
  Pencil,
  XCircle,
  Eye,
  EyeOff,
  Volume2,
  VolumeX
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUserWithProfile, logoutUser, uploadProfilePhoto } from "../services/authService";
import { getResidentById } from "../services/adminService";
import { fetchPublishedAnnouncements } from "../services/announcementService";
import {
  cancelDocumentRequest,
  createDocumentRequest,
  deleteDocumentRequest,
  fetchDocumentRequests,
  fetchDocumentTemplates,
  fetchResidentNotifications,
  getResidentDocumentRequests,
  markResidentNotificationRead,
  updateDocumentRequestType,
} from "../services/documentRequestService";
import { fetchLivelihoodPosts, applyForLivelihood, fetchResidentLivelihoodApplications } from "../services/livelihoodService";
import { fetchResidentKnowledge } from "../services/knowledgeService";
import { askResidentAssistant } from "../services/residentAssistantService";
import { getOrganizationOfficials } from "../services/organizationService";
import { getSystemSettings, subscribeSystemSettings } from "../services/adminActivityService";
import {
  clearResidentSession,
  getResidentSession,
  saveResidentSession,
  updateResidentCredentials,
} from "../services/residentAuthService";
import {
  requestResidentProfileUpdate,
  updateResidentProfileDirect,
} from "../services/residentProfileUpdateService";
import { fetchResidentStats } from "../services/residentStatsService";
import {
  purokDefinitions,
  normalizePurokValue,
  civilStatusOptions,
  educationalAttainmentOptions,
  householdRelationshipOptions,
  buildFullName,
  getResidentAge,
  calculateAge,
} from "../utils/residentProfile";
import TypingIndicator from "../components/TypingIndicator";
import FloatingModal from "../components/FloatingModal";

const ANNOUNCEMENT_READ_KEY = "kaagapai_read_announcements";
const LIVELIHOOD_READ_KEY = "kaagapai_read_livelihood_posts";
const ASSISTANT_HISTORY_KEY = "kaagapai_resident_assistant_messages";
const MAX_ASSISTANT_HISTORY_MESSAGES = 80;
const RESIDENT_KNOWLEDGE_LIMIT = 100;
const DEFAULT_ASSISTANT_MESSAGE = {
  id: "welcome",
  role: "assistant",
  text: "Hello! I'm KaagapAI, your Barangay Assistant. How can I help you today? You can ask about document requests, barangay services, complaints, announcements, livelihood programs, health services, and more.",
};

const getStoredReadIds = (key) => {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
};

const saveStoredReadIds = (key, ids) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch (e) {
    console.warn("localStorage save failed:", e);
  }
};

const CHART_COLORS = ["#0B5D3B", "#1FA971", "#157347", "#86efac", "#dcfce7", "#34d399", "#059669"];

const cleanMarkdownText = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/1\.\s*(?:Log\s*In|Log\s*in|Access\s*your|Sign\s*in)[^\n]*\n?/gi, "1. Click 'Request Document' on your dashboard.\n")
    .replace(/^###\s*/gm, "")
    .replace(/^---\s*/gm, "")
    .replace(/\*\*/g, "")
    .trim();
};

const speakAssistantText = (text) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const cleanText = cleanMarkdownText(text).replace(/\[CHART:.*?\]/g, "").trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices() || [];
    
    // Select best available voice (English/Filipino natural voice)
    const preferredVoice = voices.find(
      (v) => v.lang.includes("fil") || v.lang.includes("tl") || v.lang.includes("en-PH") || v.name.includes("Natural") || v.name.includes("Google")
    ) || voices.find((v) => v.lang.startsWith("en")) || voices[0];

    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Speech synthesis warning:", err);
  }
};

const stopAssistantSpeech = () => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};

const TypewriterText = ({ text, speed = 8 }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    const clean = cleanMarkdownText(text);
    if (!clean) {
      setDisplayedText("");
      return;
    }

    let index = 0;
    setDisplayedText("");
    const timer = setInterval(() => {
      if (index < clean.length) {
        setDisplayedText(clean.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return <span className="whitespace-pre-line leading-relaxed font-medium">{displayedText}</span>;
};

const RenderChatChart = ({ text }) => {
  const match = text.match(/\[CHART:(PIE|BAR):(.*?)\]/);
  if (!match) return <TypewriterText text={text} />;

  const cleanText = cleanMarkdownText(text.replace(match[0], "").trim());
  let data = [];
  try {
    const rawData = JSON.parse(match[2]);
    if (rawData && rawData.labels && Array.isArray(rawData.labels)) {
      const values = rawData.datasets?.[0]?.data || rawData.data || [];
      data = rawData.labels.map((label, idx) => ({
        name: String(label),
        value: Number(values[idx] || 0),
      }));
    } else if (typeof rawData === "object" && rawData !== null) {
      data = Object.keys(rawData).map((key) => ({
        name: String(key),
        value: Number(rawData[key] || 0),
      }));
    }
  } catch (e) {
    console.error("Failed to parse chat chart JSON:", e);
    return <TypewriterText text={text} />;
  }

  if (!data || data.length === 0) {
    return <TypewriterText text={text} />;
  }

  let introLines = cleanText ? cleanText.split("\n") : [];
  if (introLines.length === 0) {
    data.forEach((item) => {
      introLines.push(`• ${item.name}: ${Number(item.value).toLocaleString()} residents`);
    });
    introLines.push(`Here is the visual breakdown chart below:`);
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="space-y-1 text-slate-800 dark:text-slate-100 font-medium">
        {introLines.map((line, idx) => {
          if (line.startsWith("• ") || line.startsWith("- ") || line.startsWith("* ")) {
            const rawItem = line.replace(/^[•\-\*]\s*/, "");
            const colonIndex = rawItem.indexOf(":");
            if (colonIndex > -1) {
              const label = rawItem.slice(0, colonIndex).replace(/\*\*/g, "");
              const val = rawItem.slice(colonIndex + 1);
              return (
                <div key={idx} className="flex items-center gap-2 py-0.5 pl-1 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0B5D3B] dark:bg-emerald-400 shrink-0" />
                  <span className="font-bold text-slate-900 dark:text-slate-100">{label}:</span>
                  <span className="font-bold text-[#0B5D3B] dark:text-emerald-400">{val}</span>
                </div>
              );
            }
          }
          if (!line.trim()) return <div key={idx} className="h-1" />;
          return <p key={idx} className="whitespace-pre-line leading-relaxed">{line.replace(/\*\*/g, "")}</p>;
        })}
      </div>

      <div
        className="w-full sm:w-[320px] mt-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 shadow-xs"
        style={{ height: `${Math.max(180, data.length * 36)}px` }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.3} />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8" }} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#cbd5e1", fontWeight: "bold" }} width={80} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #334155", color: "#f8fafc", fontSize: "11px", fontWeight: "bold" }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};





const PROFILE_PHOTO_MAX_SIZE = 360;
const PROFILE_PHOTO_QUALITY = 0.82;
const PROFILE_PHOTO_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const isSupportedProfilePhoto = (file) => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) ||
    ["jpg", "jpeg", "png", "webp", "gif"].includes(extension);
};

const compressProfilePhoto = async (file) => {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image."));
    img.src = dataUrl;
  });
  const scale = Math.min(1, PROFILE_PHOTO_MAX_SIZE / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context is null.");
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", PROFILE_PHOTO_QUALITY);
};

const sidebarNavItems = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "documents", label: "Document Request", icon: ClipboardList },
  { key: "livelihood", label: "Livelihoods & Jobs", icon: Briefcase },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "my_documents", label: "Document Logs", icon: FileSpreadsheet },
  { key: "officials", label: "Barangay Officials", icon: Users },
];

const isRequestExpired = (request) => {
  if (!request) return false;
  if (["Released", "Rejected", "Cancelled"].includes(request.status)) return false;

  const createdOrUpdatedTime = new Date(request.updated_at || request.created_at || 0).getTime();
  const timeDifferenceMs = Date.now() - createdOrUpdatedTime;
  const oneDayMs = 24 * 60 * 60 * 1000;

  return timeDifferenceMs > oneDayMs;
};

const getStatusClass = (status) => {
  switch (status) {
    case "Pending":
      return "bg-amber-50 border-amber-250 text-amber-700";
    case "Processing":
      return "bg-blue-50 border-blue-250 text-blue-700";
    case "Approved":
      return "bg-emerald-50 border-emerald-250 text-emerald-700";
    case "Completed":
    case "Released":
      return "bg-teal-50 border-teal-250 text-teal-700";
    case "Rejected":
      return "bg-rose-50 border-rose-250 text-rose-700";
    case "Expired":
      return "bg-rose-50 border-rose-250 text-rose-700 font-bold border-rose-300";
    default:
      return "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-350";
  }
};

const AssistantAiIcon = () => (
  <div className="flex h-full w-full items-center justify-center bg-white p-0.5 rounded-full shadow-inner overflow-hidden">
    <img
      src="/logo.png"
      alt="Brgy. Seal"
      className="h-full w-full object-contain rounded-full"
      onError={(e) => {
        e.target.src = "https://placehold.co/100x100/14532d/ffffff?text=Seal";
      }}
    />
  </div>
);

const parsePurpose = (docType) => {
  if (!docType) return "";
  const match = docType.match(/\(Purpose:\s*(.*?)\)/i) || docType.match(/-\s*Purpose:\s*(.*)/i);
  return match ? match[1].trim() : "";
};

const UserDashboard = () => {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const shouldReduceMotion = useReducedMotion();

  // App Telemetry States
  const [userData, setUserData] = useState(null);
  const [resident, setResident] = useState(null);
  const [requests, setRequests] = useState([]);
  const [allSystemRequests, setAllSystemRequests] = useState([]);
  const [documentTemplates, setDocumentTemplates] = useState([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState("");
  const [requestPurpose, setRequestPurpose] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [announcementReadIds, setAnnouncementReadIds] = useState([]);
  const [livelihoodReadIds, setLivelihoodReadIds] = useState([]);
  const [publishedAnnouncements, setPublishedAnnouncements] = useState([]);
  
  const [opportunities, setOpportunities] = useState([]);
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [residentStats, setResidentStats] = useState(null);
  const [portalError, setPortalError] = useState("");
  const [portalSuccess, setPortalSuccess] = useState("");
  const [residentApplications, setResidentApplications] = useState([]);

  // Redesign state additions
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const effectiveSidebarCollapsed = sidebarCollapsed;
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
  const [isDashboardScrolled, setIsDashboardScrolled] = useState(false);
  const [isStatCardsHovered, setIsStatCardsHovered] = useState(false);

  // Dynamic system settings (Office Email, Office Phone, etc.)
  const [systemSettings, setSystemSettings] = useState(() => getSystemSettings());

  useEffect(() => {
    const unsubscribe = subscribeSystemSettings((nextSettings) => {
      setSystemSettings(nextSettings);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    let ticking = false;
    const handleScroll = (e) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollPos = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || (e?.target?.scrollTop) || 0;
          setIsDashboardScrolled(scrollPos > 60);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);
  const [settingsTab, setSettingsTab] = useState("security"); // default changed to security
  const [theme, setTheme] = useState("light");
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("kaagapai_resident_font_size") || "medium");
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(() => localStorage.getItem("kaagapai_sms_notifications") !== "false");
  const [announcementSmsAlerts, setAnnouncementSmsAlerts] = useState(() => localStorage.getItem("kaagapai_announcements_pref") !== "false");
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);
  const [latestAnnouncementToast, setLatestAnnouncementToast] = useState(null);
  const [latestNotificationToast, setLatestNotificationToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnnouncementModal, setSelectedAnnouncementModal] = useState(null);

  const doesAnnouncementApplyToResident = (announcement, residentInstance) => {
    const aud = announcement.audience || "All Residents";
    if (aud === "All Residents") return true;
    if (aud === "Family Household Representatives") return true;
    if (aud === "Senior Citizens" || aud === "PWD/PWED Residents" || aud === "Youth") return true;
    
    if (!residentInstance) return false;

    // Single Purok
    if (aud.startsWith("Purok: ")) {
      const targetLabel = aud.replace("Purok: ", "").trim();
      const targetPurok = purokDefinitions.find((p) => p.label === targetLabel);
      if (!targetPurok) return false;
      return normalizePurokValue(residentInstance.purok) === targetPurok.value;
    }

    // Multiple Puroks
    if (aud.startsWith("Puroks: ")) {
      const targetLabels = aud.replace("Puroks: ", "").split(",").map((s) => s.trim());
      const targetValues = targetLabels.map((lbl) => purokDefinitions.find((p) => p.label === lbl)?.value).filter(Boolean);
      return targetValues.includes(normalizePurokValue(residentInstance.purok));
    }

    // Selected Resident(s)
    if (aud.startsWith("Selected Resident:") || aud.startsWith("Selected Residents:")) {
      const namesStr = aud.replace(/^Selected Residents?:/, "").trim();
      const targetNames = namesStr.split(",").map((s) => s.trim().toLowerCase());
      const residentName = (residentInstance.full_name || buildFullName(residentInstance) || "").trim().toLowerCase();
      return targetNames.includes(residentName);
    }

    return false;
  };

  useEffect(() => {
    const requestPerm = async () => {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
      }
    };
    requestPerm();

    const handleInteraction = () => {
      requestPerm();
      window.removeEventListener("click", handleInteraction);
    };
    window.addEventListener("click", handleInteraction);
    return () => window.removeEventListener("click", handleInteraction);
  }, []);

  useEffect(() => {
    const redirectModule = localStorage.getItem("kaagapai_redirect_module");
    if (redirectModule && resident?.id) {
      openModule(redirectModule);
      localStorage.removeItem("kaagapai_redirect_module");
    }
  }, [resident]);

  useEffect(() => {
    if (!resident?.id) return;

    const announcementChannel = supabase
      .channel("announcements-realtime-user")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcements",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = payload.old?.id;
            if (oldId) {
              setPublishedAnnouncements((current) => current.filter((a) => a.id !== oldId));
            }
            return;
          }

          const newAnn = payload.new;
          if (newAnn && newAnn.status === "Published") {
            if (doesAnnouncementApplyToResident(newAnn, resident)) {
              setPublishedAnnouncements((current) => {
                const exists = current.some((a) => a.id === newAnn.id);
                if (exists) {
                  return current.map((a) => (a.id === newAnn.id ? newAnn : a));
                }
                return [newAnn, ...current];
              });

              const isInsert = payload.eventType === "INSERT";
              const isUpdate = payload.eventType === "UPDATE";
              if (isInsert || isUpdate) {
                const lastViewedId = localStorage.getItem(`kaagapai_last_viewed_announcement_id_${resident.id}`);
                if (lastViewedId !== String(newAnn.id)) {
                  setLatestAnnouncementToast(newAnn);

                  // HTML5 browser push notification
                  if (Notification.permission === "granted") {
                    const nativeNotif = new Notification("Barangay Upper Mingading", {
                      body: `${newAnn.title}\n${newAnn.body}`,
                      icon: "/favicon.ico",
                      tag: `announcement-${newAnn.id}`,
                    });
                    nativeNotif.onclick = () => {
                      window.focus();
                      localStorage.setItem("kaagapai_redirect_module", "announcements");
                      window.location.href = "/resident-dashboard";
                    };
                    setTimeout(() => {
                      nativeNotif.close();
                    }, 3000); // Swipe/close after 3 seconds!
                  }
                }
              }
            } else {
              setPublishedAnnouncements((current) => current.filter((a) => a.id !== newAnn.id));
            }
          } else if (newAnn?.id) {
            setPublishedAnnouncements((current) => current.filter((a) => a.id !== newAnn.id));
          }
        }
      )
      .subscribe();

    const notifChannel = supabase
      .channel(`resident-notifications-realtime-${resident.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "resident_notifications",
          filter: `resident_id=eq.${resident.id}`,
        },
        () => {
          refreshResidentActivity(resident.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(announcementChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [resident]);

  useEffect(() => {
    if (publishedAnnouncements.length === 0 || !resident?.id) return;
    const applicable = publishedAnnouncements.filter((a) =>
      doesAnnouncementApplyToResident(a, resident)
    );
    if (applicable.length === 0) return;
    const latest = applicable[0];
    const lastViewedId = localStorage.getItem(`kaagapai_last_viewed_announcement_id_${resident.id}`);
    if (lastViewedId !== String(latest.id)) {
      setLatestAnnouncementToast(latest);
    }
  }, [publishedAnnouncements, resident?.id, resident]);

  useEffect(() => {
    if (notifications.length === 0 || !resident?.id) return;
    const latest = notifications[0];
    const lastViewedId = localStorage.getItem(`kaagapai_last_viewed_notification_id_${resident.id}`);
    if (lastViewedId !== String(latest.id) && !latest.is_read) {
      setLatestNotificationToast(latest);

      // Trigger native browser notification
      if (Notification.permission === "granted") {
        const nativeNotif = new Notification("KaagapA.I Notification", {
          body: `${latest.title}\n${latest.message || latest.body || ""}`,
          icon: "/favicon.ico",
          tag: `notification-${latest.id}`,
        });
        nativeNotif.onclick = () => {
          window.focus();
          localStorage.setItem("kaagapai_redirect_module", "documents");
          window.location.href = "/resident-dashboard";
        };
        setTimeout(() => {
          nativeNotif.close();
        }, 3000); // Close/swipe out after 3 seconds!
      }
    }
  }, [notifications, resident?.id]);

  useEffect(() => {
    if (latestAnnouncementToast) {
      const timer = setTimeout(() => {
        setLatestAnnouncementToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [latestAnnouncementToast]);

  useEffect(() => {
    if (latestNotificationToast) {
      const timer = setTimeout(() => {
        setLatestNotificationToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [latestNotificationToast]);

  const dismissToast = () => {
    if (latestAnnouncementToast && resident?.id) {
      localStorage.setItem(`kaagapai_last_viewed_announcement_id_${resident.id}`, String(latestAnnouncementToast.id));
      setLatestAnnouncementToast(null);
    }
    if (latestNotificationToast && resident?.id) {
      localStorage.setItem(`kaagapai_last_viewed_notification_id_${resident.id}`, String(latestNotificationToast.id));
      setLatestNotificationToast(null);
    }
  };

  const viewAnnouncementFromToast = () => {
    if (latestAnnouncementToast && resident?.id) {
      localStorage.setItem(`kaagapai_last_viewed_announcement_id_${resident.id}`, String(latestAnnouncementToast.id));
      setLatestAnnouncementToast(null);
      openModule("announcements");
    }
  };

  const viewNotificationFromToast = () => {
    if (latestNotificationToast && resident?.id) {
      localStorage.setItem(`kaagapai_last_viewed_notification_id_${resident.id}`, String(latestNotificationToast.id));
      setLatestNotificationToast(null);
      handleMarkNotificationRead(latestNotificationToast);
      
      const title = (latestNotificationToast.title || "").toLowerCase();
      if (title.includes("announcement")) openModule("announcements"); 
      else if (title.includes("livelihood") || title.includes("application")) openModule("livelihood"); 
      else openModule("documents");
    }
  };
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [systemTheme, setSystemTheme] = useState(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    localStorage.setItem("kaagapai_resident_theme", theme);
    localStorage.setItem("kaagapai_resident_font_size", fontSize);
  }, [theme, fontSize]);

  const isDarkMode = false;

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSmsToggle = (val) => {
    setSmsNotificationsEnabled(val);
    localStorage.setItem("kaagapai_sms_notifications", String(val));
  };

  const handleAnnouncementToggle = (val) => {
    setAnnouncementSmsAlerts(val);
    localStorage.setItem("kaagapai_announcements_pref", String(val));
  };

  // Avatar states
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState("");

  // Job Application Modal States
  const [selectedOppForApplication, setSelectedOppForApplication] = useState(null);
  const [jobAppStep, setJobAppStep] = useState(1);
  const [jobAppForm, setJobAppForm] = useState({
    education: "",
    skills: "",
    experience: "",
  });
  const [jobAppResume, setJobAppResume] = useState(null);
  const [jobAppLoading, setJobAppLoading] = useState(false);
  const [jobAppSuccess, setJobAppSuccess] = useState(false);
  const [jobAppError, setJobAppError] = useState("");

  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [refreshingRequests, setRefreshingRequests] = useState(false);
  const [requestMessage, setRequestMessage] = useState(null);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chatFabExpanded, setChatFabExpanded] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  useEffect(() => {
    if (assistantOpen) {
      setChatFabExpanded(false);
      return;
    }
    const interval = setInterval(() => {
      setChatFabExpanded((prev) => !prev);
    }, 5000);
    return () => clearInterval(interval);
  }, [assistantOpen]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [chatNavOpen, setChatNavOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(() => `session-${Date.now()}`);
  const [chatSessions, setChatSessions] = useState(() => {
    try {
      const raw = localStorage.getItem("kaagapai_resident_chat_sessions_guest");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [assistantMessages, setAssistantMessages] = useState(() => [
    { ...DEFAULT_ASSISTANT_MESSAGE },
  ]);

  useEffect(() => {
    if (!resident?.id) return;
    try {
      const key = `kaagapai_resident_chat_sessions_${resident.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        setChatSessions(JSON.parse(raw));
      }
    } catch (e) {
      console.warn("Failed to load chat sessions:", e);
    }
  }, [resident?.id]);



  useEffect(() => {
    const currentState = window.history.state;
    if (!currentState || currentState.activeNav !== activeNav) {
      window.history.pushState({ activeNav }, "", "");
    }
  }, [activeNav]);

  const saveChatSession = (messagesList) => {
    const userMsgs = messagesList.filter((m) => m.role === "user");
    if (userMsgs.length === 0) return;

    const firstUserText = userMsgs[0].text;
    const title = firstUserText.length > 28 ? firstUserText.slice(0, 28) + "..." : firstUserText;

    setChatSessions((prevSessions) => {
      const existingIndex = prevSessions.findIndex((s) => s.id === currentSessionId);
      let updated;
      if (existingIndex >= 0) {
        updated = [...prevSessions];
        updated[existingIndex] = {
          ...updated[existingIndex],
          title,
          updatedAt: new Date().toISOString(),
          messages: messagesList,
        };
      } else {
        updated = [
          {
            id: currentSessionId,
            title,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: messagesList,
          },
          ...prevSessions,
        ];
      }
      try {
        const key = `kaagapai_resident_chat_sessions_${resident?.id || "guest"}`;
        localStorage.setItem(key, JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to save chat session:", e);
      }
      return updated;
    });
  };

  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    setCurrentSessionId(newId);
    setAssistantMessages([{ ...DEFAULT_ASSISTANT_MESSAGE }]);
    setAssistantInput("");
    setChatNavOpen(false);
  };

  const handleSelectSession = (session) => {
    setCurrentSessionId(session.id);
    setAssistantMessages(session.messages || [{ ...DEFAULT_ASSISTANT_MESSAGE }]);
    setAssistantInput("");
    setChatNavOpen(false);
  };

  const handleDeleteSession = (sessionId, event) => {
    if (event) event.stopPropagation();
    const updated = chatSessions.filter((s) => s.id !== sessionId);
    setChatSessions(updated);
    try {
      const key = `kaagapai_resident_chat_sessions_${resident?.id || "guest"}`;
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to delete session:", e);
    }
    if (currentSessionId === sessionId) {
      handleNewChat();
    }
  };

  const handleClearAllRecents = () => {
    setChatSessions([]);
    try {
      const key = `kaagapai_resident_chat_sessions_${resident?.id || "guest"}`;
      localStorage.setItem(key, JSON.stringify([]));
    } catch (e) {
      console.warn("Failed to clear sessions:", e);
    }
    handleNewChat();
  };

  // Password update form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // Registry Information form matching the Admin portal completely
  const [profileForm, setProfileForm] = useState({
    username: "",
    currentPassword: "",
    
    // Personal Details
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    full_name: "",
    sex: "Male",
    birthday: "",
    age: "",
    civil_status: "Single",
    nationality: "Filipino",
    religion: "",
    blood_type: "",

    // Contact Details
    phone: "",
    telephone: "",
    email: "",
    emergency_contact_person: "",
    emergency_contact_phone: "",

    // Address Details
    region: "",
    province: "",
    municipality: "",
    barangay: "",
    purok: "",
    address: "",
    zip_code: "",

    // Residency Details
    household_no: "",
    relationship_to_household_head: "Head",
    status: "Active",
    voter_status: "No",
    occupation: "",
    employment_status: "Employed",
    educational_attainment: "",
    years_of_residency: "",

    // Additional Details
    is_senior_citizen: false,
    is_pwd: false,
    is_solo_parent: false,
    indigenous_group: "",
    philhealth_no: "",
    sss_no: "",
    tin_no: "",
  });
  const [profileMessage, setProfileMessage] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const assistantMessagesEndRef = useRef(null);
  const skipAssistantHistorySaveRef = useRef(false);



  useEffect(() => {
    if (!assistantOpen) return;
    assistantMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [assistantLoading, assistantMessages, assistantOpen]);

  // Load Assistant History
  useEffect(() => {
    if (!resident?.id) return;
    try {
      const historyKey = `${ASSISTANT_HISTORY_KEY}:${resident.id}`;
      const parsed = JSON.parse(window.localStorage.getItem(historyKey) || "[]");
      if (parsed.length) {
        setAssistantMessages(parsed);
      } else {
        setAssistantMessages([{ ...DEFAULT_ASSISTANT_MESSAGE }]);
      }
    } catch {
      setAssistantMessages([{ ...DEFAULT_ASSISTANT_MESSAGE }]);
    }
  }, [resident?.id]);

  // Save Assistant History
  useEffect(() => {
    if (!resident?.id) return;
    if (skipAssistantHistorySaveRef.current) {
      skipAssistantHistorySaveRef.current = false;
      return;
    }
    const historyKey = `${ASSISTANT_HISTORY_KEY}:${resident.id}`;
    window.localStorage.setItem(historyKey, JSON.stringify(assistantMessages.slice(-MAX_ASSISTANT_HISTORY_MESSAGES)));
  }, [assistantMessages, resident?.id]);

  // Setup Form states when resident is fetched
  useEffect(() => {
    if (!resident) return;
    setProfileForm({
      username: resident.username || resident.portal_username || resident.email || "",
      currentPassword: "",
      
      first_name: resident.first_name || "",
      middle_name: resident.middle_name || "",
      last_name: resident.last_name || "",
      suffix: resident.suffix || "",
      full_name: resident.full_name || "",
      sex: resident.sex || resident.gender || "Male",
      birthday: resident.birthday || "",
      age: resident.age ?? "",
      civil_status: resident.civil_status || "Single",
      nationality: resident.nationality || "Filipino",
      religion: resident.religion || "",
      blood_type: resident.blood_type || "",

      phone: resident.phone || "",
      telephone: resident.telephone || "",
      email: resident.email || "",
      emergency_contact_person: resident.emergency_contact_person || "",
      emergency_contact_phone: resident.emergency_contact_phone || "",

      region: resident.region || "",
      province: resident.province || "",
      municipality: resident.municipality || "",
      barangay: resident.barangay || "",
      purok: resident.purok || "",
      address: resident.address || "",
      zip_code: resident.zip_code || "",

      household_no: resident.household_no || "",
      relationship_to_household_head: resident.relationship_to_household_head || "Head",
      status: resident.status || "Active",
      voter_status: resident.voter_status || "No",
      occupation: resident.occupation || "",
      employment_status: resident.employment_status || "Employed",
      educational_attainment: resident.educational_attainment || "",
      years_of_residency: resident.years_of_residency ?? "",

      is_senior_citizen: Boolean(resident.is_senior_citizen),
      is_pwd: Boolean(resident.is_pwd),
      is_solo_parent: Boolean(resident.is_solo_parent),
      indigenous_group: resident.indigenous_group || "",
      philhealth_no: resident.philhealth_no || "",
      sss_no: resident.sss_no || "",
      tin_no: resident.tin_no || "",
    });
    setProfileMessage(null);
  }, [resident]);

  // Age Auto-Calculation handler
  const handleBirthdayChange = (e) => {
    const bday = e.target.value;
    const calculatedAge = calculateAge(bday);
    const isSenior = calculatedAge !== null && calculatedAge >= 60;
    setProfileForm((current) => ({
      ...current,
      birthday: bday,
      age: calculatedAge ?? "",
      is_senior_citizen: isSenior,
    }));
  };

  const refreshResidentActivity = async (residentId, { showLoading = false } = {}) => {
    if (!residentId) return;
    if (showLoading) {
      setRefreshingRequests(true);
    }
    try {
      const [requestResult, notificationResult, systemRequestsResult, applicationsResult] = await Promise.allSettled([
        getResidentDocumentRequests(residentId),
        fetchResidentNotifications(residentId),
        fetchDocumentRequests({ limit: 500 }),
        fetchResidentLivelihoodApplications(residentId),
      ]);
      if (requestResult.status === "fulfilled") {
        setRequests(requestResult.value);
      }
      if (notificationResult.status === "fulfilled") {
        setNotifications(notificationResult.value);
      } else {
        setNotifications([]);
      }
      if (systemRequestsResult.status === "fulfilled") {
        setAllSystemRequests(systemRequestsResult.value?.data || []);
      }
      if (applicationsResult.status === "fulfilled") {
        setResidentApplications(applicationsResult.value || []);
      }
    } finally {
      if (showLoading) {
        setRefreshingRequests(false);
      }
    }
  };

  const refreshResidentBroadcasts = useCallback(async () => {
    const [announcementResult, opportunityResult, knowledgeResult, statsResult] = await Promise.allSettled([
      fetchPublishedAnnouncements(8),
      fetchLivelihoodPosts({ status: "Open", limit: 8 }),
      fetchResidentKnowledge(RESIDENT_KNOWLEDGE_LIMIT),
      fetchResidentStats(),
    ]);

    if (announcementResult.status === "fulfilled") {
      setPublishedAnnouncements(announcementResult.value);
    }
    if (opportunityResult.status === "fulfilled") {
      setOpportunities(opportunityResult.value);
    }
    if (knowledgeResult.status === "fulfilled") {
      setKnowledgeItems(knowledgeResult.value);
    }
    if (statsResult.status === "fulfilled") {
      setResidentStats(statsResult.value);
    }
  }, []);

  // Mounting load logic
  useEffect(() => {
    let isMounted = true;
    const loadDashboard = async () => {
      try {
        const [templatesResult, announcementResult, opportunityResult, knowledgeResult, statsResult] = await Promise.allSettled([
          fetchDocumentTemplates(),
          fetchPublishedAnnouncements(8),
          fetchLivelihoodPosts({ status: "Open", limit: 8 }),
          fetchResidentKnowledge(RESIDENT_KNOWLEDGE_LIMIT),
          fetchResidentStats(),
        ]);

        if (isMounted) {
          const templates = templatesResult.status === "fulfilled" ? templatesResult.value : [];
          setDocumentTemplates(templates);
          setSelectedDocumentType(templates[0]?.document_type || "");
          setPublishedAnnouncements(announcementResult.status === "fulfilled" ? announcementResult.value : []);
          setOpportunities(opportunityResult.status === "fulfilled" ? opportunityResult.value : []);
          setKnowledgeItems(knowledgeResult.status === "fulfilled" ? knowledgeResult.value : []);
          setResidentStats(statsResult.status === "fulfilled" ? statsResult.value : null);
        }

        const residentSession = getResidentSession();
        if (residentSession) {
          setUserData({
            user: { email: residentSession.username || residentSession.email },
            profile: { role: "resident", resident_id: residentSession.id },
          });

          try {
            const residentData = await getResidentById(residentSession.id);
            if (!isMounted) return;
            setResident({
              ...(residentData || {}),
              account_id: residentSession.account_id,
              username: residentSession.username || residentData?.portal_username || residentData?.username || "",
              account_status: residentSession.account_status,
              must_change_credentials: false,
            });
          } catch (err) {
            setResident({ ...residentSession, must_change_credentials: false });
          }
          await refreshResidentActivity(residentSession.id);
          return;
        }

        const currentUser = await getCurrentUserWithProfile();
        if (!isMounted) return;
        setUserData(currentUser);

        if (currentUser?.profile?.resident_id) {
          const residentData = await getResidentById(currentUser.profile.resident_id);
          if (!isMounted) return;
          setResident(residentData);
          await refreshResidentActivity(currentUser.profile.resident_id);
        }
      } catch (error) {
        console.error("Unable to load user dashboard:", error);
        if (isMounted) {
          setPortalError(error.message || "Unable to load resident dashboard data.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };
  const dynamicGreeting = getGreeting();

  const displayName = useMemo(() => {
    return (
      resident?.full_name ||
      userData?.user?.user_metadata?.full_name ||
      userData?.user?.email?.split("@")[0] ||
      "Resident"
    );
  }, [resident, userData]);

  const residentUsername = resident?.username || resident?.email || "";

  // Handle mobile/browser hardware Back button to navigate between tabs
  useEffect(() => {
    const handlePopState = async (event) => {
      if (event.state && event.state.activeNav) {
        setActiveNav(event.state.activeNav);
      } else {
        const isMobile = window.innerWidth < 1024;
        if (isMobile) {
          // Push the state back immediately to prevent exit
          window.history.pushState({ activeNav: "dashboard" }, "", "");
          
          const ok = await confirm({
            title: "Confirm Exit / Logout",
            message: "Are you sure you want to log out of your KaagapAI Resident Account?",
            confirmText: "Yes, Logout",
            cancelText: "No, Stay",
            variant: "danger",
            icon: LogOut,
          });

          if (ok) {
            const goodbyeName = displayName;
            sessionStorage.setItem("just_logged_out", "true");
            clearResidentSession();
            await logoutUser();
            navigate("/goodbye", {
              replace: true,
              state: { displayName: goodbyeName, role: "resident" },
            });
          }
        } else {
          setActiveNav("dashboard");
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    if (!window.history.state || !window.history.state.activeNav) {
      window.history.replaceState({ activeNav: "dashboard" }, "", "");
    }
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [confirm, displayName, navigate]);

  useEffect(() => {
    if (!resident?.id) return undefined;
    const readIds = getStoredReadIds(`${ANNOUNCEMENT_READ_KEY}:${resident.id}`);
    const livelihoodIds = getStoredReadIds(`${LIVELIHOOD_READ_KEY}:${resident.id}`);
    setAnnouncementReadIds(readIds);
    setLivelihoodReadIds(livelihoodIds);
  }, [resident?.id]);

  useEffect(() => {
    if (!resident?.id) return undefined;
    const intervalId = window.setInterval(refreshResidentBroadcasts, 5000);
    return () => window.clearInterval(intervalId);
  }, [refreshResidentBroadcasts, resident?.id]);

  useEffect(() => {
    if (!resident?.id) return undefined;
    const refreshActivity = async () => {
      await refreshResidentActivity(resident.id);
    };
    const intervalId = window.setInterval(refreshActivity, 5000);
    return () => window.clearInterval(intervalId);
  }, [resident?.id]);

  const allNotificationsMerged = useMemo(() => {
    const systemNotifs = notifications.map((n) => ({
      id: String(n.id),
      title: n.title,
      message: n.message || n.body || "",
      created_at: n.created_at,
      is_read: n.is_read,
      isAnnouncement: false,
      original: n,
    }));

    const applicableAnn = publishedAnnouncements
      .filter((a) => doesAnnouncementApplyToResident(a, resident))
      .map((a) => {
        const isRead = announcementReadIds.includes(a.id);
        return {
          id: `announcement-${a.id}`,
          title: `📢 Announcement: ${a.title}`,
          message: a.body,
          created_at: a.publish_date + "T00:00:00Z",
          is_read: isRead,
          isAnnouncement: true,
          announcement_id: a.id,
          original: a,
        };
      });

    return [...systemNotifs, ...applicableAnn].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [notifications, publishedAnnouncements, resident, announcementReadIds]);

  const unreadNotificationCount = useMemo(
    () => allNotificationsMerged.filter((notification) => !notification.is_read).length,
    [allNotificationsMerged]
  );

  const handleMarkAllNotificationsRead = async () => {
    if (!resident?.id) return;
    const allAnnIds = publishedAnnouncements.map((a) => a.id);
    const nextAnnReadIds = [...new Set([...announcementReadIds, ...allAnnIds])];
    saveStoredReadIds(`${ANNOUNCEMENT_READ_KEY}:${resident.id}`, nextAnnReadIds);
    setAnnouncementReadIds(nextAnnReadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsAsRead(resident.id);
    } catch (e) {
      console.warn("Failed to sync mark all notifications read:", e);
    }
  };

  const recentRequests = useMemo(() => {
    return [...requests]
      .slice(0, 5)
      .map((request) => {
        const expired = isRequestExpired(request);
        return {
          ...request,
          status: expired ? "Expired" : request.status,
          title: request.document_type || "Document Request",
          dateLabel: new Date(request.created_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
        };
      });
  }, [requests]);

  const handleApplyLivelihood = async (livelihoodId) => {
    if (!resident?.id) {
      setPortalError("Please log in to apply.");
      return;
    }
    setPortalError("");
    setPortalSuccess("");
    try {
      await applyForLivelihood(livelihoodId, resident.id);
      setPortalSuccess("Successfully applied! The admin has been notified.");
      const apps = await fetchResidentLivelihoodApplications(resident.id);
      setResidentApplications(apps || []);
    } catch (err) {
      setPortalError(err.message || "Failed to apply.");
    }
  };

  // Recharts Data Preprocessors
  const requestOverviewData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const counts = months.reduce((acc, m) => {
      acc[m] = 0;
      return acc;
    }, {});
    
    allSystemRequests.forEach((r) => {
      const date = new Date(r.created_at);
      if (!isNaN(date)) {
        const mName = months[date.getMonth()];
        counts[mName]++;
      }
    });
    
    return months.map((m) => ({ name: m, Requests: counts[m] }));
  }, [allSystemRequests]);

  const docsRequestedData = useMemo(() => {
    const counts = {};
    allSystemRequests.forEach((r) => {
      const type = r.document_type || "Other";
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.keys(counts).map((k) => ({
      name: k.replace("Clearance", "").replace("Certificate of", "").trim(),
      count: counts[k]
    }));
  }, [allSystemRequests]);

  const requestStatusData = useMemo(() => {
    const pending = allSystemRequests.filter((r) => ["Pending", "Processing"].includes(r.status)).length;
    const approved = allSystemRequests.filter((r) => ["Approved", "Released"].includes(r.status)).length;
    const rejected = allSystemRequests.filter((r) => r.status === "Rejected").length;
    const completed = allSystemRequests.filter((r) => r.status === "Completed").length;
    
    return [
      { name: "Pending", value: pending, color: "#F59E0B" },
      { name: "Approved", value: approved, color: "#3B82F6" },
      { name: "Rejected", value: rejected, color: "#EF4444" },
      { name: "Completed", value: completed, color: "#10B981" }
    ].filter(item => item.value > 0);
  }, [allSystemRequests]);

  const announcementStatsData = useMemo(() => {
    const total = publishedAnnouncements.length;
    const lastViewedId = localStorage.getItem(`kaagapai_last_viewed_announcement_id_${resident?.id || ""}`);
    let unread = 0;
    if (total > 0 && lastViewedId) {
      unread = publishedAnnouncements.filter(a => String(a.id) !== lastViewedId).length;
    }
    const read = Math.max(0, total - unread);
    return [
      { name: "Published", count: total },
      { name: "Read", count: read },
      { name: "Unread", count: unread }
    ];
  }, [publishedAnnouncements, resident?.id]);

  const activityOverviewData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = days.reduce((acc, d) => {
      acc[d] = 0;
      return acc;
    }, {});
    
    allSystemRequests.forEach((r) => {
      const date = new Date(r.created_at);
      if (!isNaN(date)) {
        const dName = days[date.getDay()];
        counts[dName]++;
      }
    });
    
    return days.map((d) => ({ name: d, Activity: counts[d] }));
  }, [allSystemRequests]);

  // Dynamic search filtering
  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return recentRequests;
    return recentRequests.filter((r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [recentRequests, searchQuery]);

  const filteredAnnouncements = useMemo(() => {
    let list = publishedAnnouncements;
    if (resident) {
      list = list.filter((a) => doesAnnouncementApplyToResident(a, resident));
    }
    if (!searchQuery.trim()) return list;
    return list.filter((a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.body.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [publishedAnnouncements, searchQuery, resident]);

  const dashboardAnnouncements = useMemo(() => {
    let list = publishedAnnouncements;
    if (resident) {
      list = list.filter((a) => doesAnnouncementApplyToResident(a, resident));
    }
    return [...list].sort((a, b) => {
      const isAEmergency = String(a.category || "").toLowerCase().includes("emergency");
      const isBEmergency = String(b.category || "").toLowerCase().includes("emergency");
      if (isAEmergency && !isBEmergency) return -1;
      if (!isAEmergency && isBEmergency) return 1;
      return new Date(b.publish_date || b.created_at || 0).getTime() - new Date(a.publish_date || a.created_at || 0).getTime();
    });
  }, [publishedAnnouncements, resident]);

  const featuredAnnouncement = dashboardAnnouncements[0] || null;
  const secondaryAnnouncements = dashboardAnnouncements.slice(1, 4);



  const selectedTemplateDetails = useMemo(() => {
    if (!selectedDocumentType || !documentTemplates.length) return null;
    return documentTemplates.find((t) => t.document_type === selectedDocumentType);
  }, [selectedDocumentType, documentTemplates]);

  // Navigation handlers
  const openModule = (itemKey, subTabKey = "personal_info") => {
    setActiveNav(itemKey);
    setSettingsTab(subTabKey);
    setMobileSidebarOpen(false);
    setShowAccountMenu(false);
    setShowNotificationMenu(false);
    setDocumentModalOpen(false);
    if (itemKey === "assistant") {
      setAssistantOpen(true);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogout = async () => {
    setMobileSidebarOpen(false);
    const ok = await confirm({
      title: "Confirm Logout",
      message: "Are you sure you want to log out of your KaagapAI Resident Account?",
      confirmText: "Logout",
      cancelText: "Cancel",
      variant: "danger",
      icon: LogOut,
    });
    if (!ok) return;

    const goodbyeName = displayName;
    sessionStorage.setItem("just_logged_out", "true");
    clearResidentSession();
    await logoutUser();
    navigate("/goodbye", {
      replace: true,
      state: { displayName: goodbyeName, role: "resident" },
    });
  };

  const submitAssistantQuestion = async (questionText) => {
    const question = questionText.trim();
    if (!question) return;

    const userMessage = { id: `user-${Date.now()}`, role: "user", text: question };
    const nextMessagesWithUser = [...assistantMessages, userMessage];
    setAssistantMessages(nextMessagesWithUser);
    setAssistantInput("");
    setAssistantLoading(true);

    try {
      const organizationOfficials = getOrganizationOfficials();
      const startTime = Date.now();
      const answer = await askResidentAssistant(question, {
        announcements: publishedAnnouncements,
        documentTemplates,
        knowledgeItems,
        opportunities,
        organizationOfficials,
        requests,
        resident,
        residentStats,
      });

      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
      }

      const finalMessages = [
        ...nextMessagesWithUser,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: answer,
        },
      ];
      setAssistantMessages(finalMessages);
      saveChatSession(finalMessages);
      if (voiceEnabled) {
        speakAssistantText(answer);
      }
    } catch (error) {
      const finalMessages = [
        ...nextMessagesWithUser,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: error.message || "KaagapAI could not process this question. Please try again.",
        },
      ];
      setAssistantMessages(finalMessages);
      saveChatSession(finalMessages);
    } finally {
      setAssistantLoading(false);
    }
  };

  const handlePrompt = (promptText) => {
    setAssistantOpen(true);
    submitAssistantQuestion(promptText);
  };

  const handleAssistantSubmit = async (event) => {
    event.preventDefault();
    submitAssistantQuestion(assistantInput);
  };

  const handleDocumentRequest = async (event) => {
    event.preventDefault();
    if (!resident?.id) {
      setRequestMessage({ type: "error", text: "Unable to find resident registry ID." });
      return;
    }
    if (!selectedDocumentType) {
      setRequestMessage({ type: "error", text: "Please select a clearance template." });
      return;
    }
    if (!requestPurpose.trim()) {
      setRequestMessage({ type: "error", text: "Please provide a purpose for your document request." });
      return;
    }

    setRequesting(true);
    setRequestMessage(null);

    try {
      const finalDocType = `${selectedDocumentType} (Purpose: ${requestPurpose.trim()})`;
      const newRequest = await createDocumentRequest({
        resident_id: resident.id,
        document_type: finalDocType,
      });
      setRequests((current) => [newRequest, ...current]);
      await refreshResidentActivity(resident.id);
      setRequestMessage({
        type: "success",
        text: `Application for ${selectedDocumentType} submitted successfully.`,
      });
      setRequestPurpose(""); // clear purpose field
      setDocumentModalOpen(false);
    } catch (error) {
      setRequestMessage({
        type: "error",
        text: error.message || "Failed to submit request.",
      });
    } finally {
      setRequesting(false);
    }
  };

  const [editingRequest, setEditingRequest] = useState(null);
  const [editDocumentType, setEditDocumentType] = useState("");
  const [editDocumentPurpose, setEditDocumentPurpose] = useState("");
  const [updatingRequest, setUpdatingRequest] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState(null);

  const handleOpenEditRequest = (req) => {
    if (isRequestExpired(req)) {
      alert("This document request has expired.");
      return;
    }
    setEditingRequest(req);
    const docTypeRaw = req.document_type || "";
    const typePart = docTypeRaw.split(" (Purpose:")[0].split(" - Purpose:")[0].trim();
    const purposePart = parsePurpose(docTypeRaw);
    setEditDocumentType(typePart);
    setEditDocumentPurpose(purposePart);
  };

  const handleSaveEditRequest = async (e) => {
    e.preventDefault();
    if (!editingRequest || !editDocumentType || !editDocumentPurpose.trim()) return;

    setUpdatingRequest(true);
    try {
      const finalDocType = `${editDocumentType} (Purpose: ${editDocumentPurpose.trim()})`;
      await updateDocumentRequestType(editingRequest.id, finalDocType);
      setRequests((current) =>
        current.map((r) =>
          r.id === editingRequest.id
            ? { ...r, document_type: finalDocType, updated_at: new Date().toISOString() }
            : r
        )
      );
      setRequestMessage({
        type: "success",
        text: "Document request updated successfully.",
      });
      setEditingRequest(null);
    } catch (err) {
      console.error("Failed to update request:", err);
      setRequestMessage({ type: "error", text: err.message || "Failed to update request." });
    } finally {
      setUpdatingRequest(false);
    }
  };

  const handleCancelRequestAction = async (req) => {
    if (isRequestExpired(req)) {
      alert("This document request has expired.");
      return;
    }
    const ok = await confirm({
      title: "Cancel Document Request?",
      message: `Are you sure you want to cancel your pending request for "${req.document_type}"?`,
      confirmText: "Yes, Cancel Request",
      cancelText: "Keep Request",
      confirmVariant: "danger",
    });
    if (!ok) return;

    setCancellingRequestId(req.id);
    try {
      await cancelDocumentRequest(req.id);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, status: "Cancelled", updated_at: new Date().toISOString() } : r
        )
      );
      setRequestMessage({
        type: "success",
        text: `Request for ${req.document_type} has been cancelled.`,
      });
    } catch (err) {
      console.error("Failed to cancel request:", err);
      setRequestMessage({ type: "error", text: err.message || "Failed to cancel request." });
    } finally {
      setCancellingRequestId(null);
    }
  };

  const handleDeleteRequestAction = async (req) => {
    const ok = await confirm({
      title: "Delete Request Log?",
      message: `Delete record for "${req.document_type}" from your history?`,
      confirmText: "Delete Log",
      cancelText: "Cancel",
      confirmVariant: "danger",
    });
    if (!ok) return;

    try {
      await deleteDocumentRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      console.error("Failed to delete request:", err);
    }
  };

  const handleMarkNotificationRead = async (notification) => {
    try {
      if (notification.type === "announcement") {
        const next = [...new Set([...announcementReadIds, notification.announcement_id])];
        saveStoredReadIds(`${ANNOUNCEMENT_READ_KEY}:${resident?.id}`, next);
        setAnnouncementReadIds(next);
        return;
      }
      if (notification.type === "livelihood") {
        const next = [...new Set([...livelihoodReadIds, notification.livelihood_id])];
        saveStoredReadIds(`${LIVELIHOOD_READ_KEY}:${resident?.id}`, next);
        setLivelihoodReadIds(next);
        return;
      }
      await markResidentNotificationRead(notification.id);
      setNotifications((current) =>
        current.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.warn("Unable to read notification:", error.message);
    }
  };

  // Profile Picture Upload
  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarSaving(true);
    setAvatarError("");
    setAvatarSuccess("");

    try {
      if (!isSupportedProfilePhoto(file)) {
        throw new Error("Please choose a JPG, PNG, or WebP image.");
      }
      if (file.size > PROFILE_PHOTO_MAX_UPLOAD_BYTES) {
        throw new Error("Profile photo must be 5 MB or smaller.");
      }

      let publicUrl;
      try {
        publicUrl = await uploadProfilePhoto(resident.id, file);
      } catch (uploadErr) {
        console.warn("Storage upload failed, falling back to base64 compression.", uploadErr);
        publicUrl = await compressProfilePhoto(file);
      }

      const { error } = await supabase.rpc("update_resident_avatar", {
        p_resident_id: resident.id,
        p_photo_url: publicUrl,
      });

      if (error) throw error;

      const nextResident = { ...resident, profile_photo_url: publicUrl };
      saveResidentSession(nextResident);
      setResident(nextResident);
      setAvatarSuccess("Profile photo updated successfully!");
    } catch (err) {
      setAvatarError(err.message || "Failed to update profile photo.");
    } finally {
      setAvatarSaving(false);
      event.target.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarSaving(true);
    setAvatarError("");
    setAvatarSuccess("");

    try {
      const { error } = await supabase.rpc("update_resident_avatar", {
        p_resident_id: resident.id,
        p_photo_url: null,
      });

      if (error) throw error;

      const nextResident = { ...resident, profile_photo_url: null };
      saveResidentSession(nextResident);
      setResident(nextResident);
      setAvatarSuccess("Profile photo removed.");
    } catch (err) {
      setAvatarError(err.message || "Failed to remove profile photo.");
    } finally {
      setAvatarSaving(false);
    }
  };

  // Direct Profile Updates
  const getProfileChanges = (form, res) => {
    const fields = [
      "first_name",
      "middle_name",
      "last_name",
      "suffix",
      "full_name",
      "sex",
      "birthday",
      "age",
      "civil_status",
      "nationality",
      "religion",
      "blood_type",
      "phone",
      "telephone",
      "email",
      "emergency_contact_person",
      "emergency_contact_phone",
      "region",
      "province",
      "municipality",
      "barangay",
      "purok",
      "address",
      "zip_code",
      "household_no",
      "relationship_to_household_head",
      "status",
      "voter_status",
      "occupation",
      "employment_status",
      "educational_attainment",
      "years_of_residency",
      "is_senior_citizen",
      "is_pwd",
      "is_solo_parent",
      "indigenous_group",
      "philhealth_no",
      "sss_no",
      "tin_no",
    ];
    return fields.reduce((acc, field) => {
      const formVal = form[field];
      const currentVal = res[field];
      
      if (typeof formVal === "boolean") {
        if (formVal !== Boolean(currentVal)) {
          acc[field] = formVal;
        }
      } else {
        const formStr = String(formVal || "").trim();
        const currentStr = String(currentVal || "").trim();
        if (formStr !== currentStr) {
          acc[field] = formStr;
        }
      }
      return acc;
    }, {});
  };

  const handleProfileUpdate = (event) => {
    if (event) event.preventDefault();
    if (!resident?.id || !residentUsername) {
      setProfileMessage({ type: "error", text: "Unable to resolve resident record." });
      return;
    }

    const combinedFullName = [profileForm.first_name, profileForm.middle_name, profileForm.last_name]
      .filter(Boolean)
      .join(" ");
    const updatedForm = {
      ...profileForm,
      full_name: combinedFullName,
    };
    const changes = getProfileChanges(updatedForm, resident);

    if (Object.keys(changes).length === 0) {
      setProfileMessage({ type: "error", text: "No changes detected to submit." });
      return;
    }

    setConfirmPassword("");
    setConfirmPasswordError("");
    setPasswordConfirmOpen(true);
  };

  const handleProfileUpdateConfirm = async (e) => {
    if (e) e.preventDefault();
    if (!confirmPassword.trim()) {
      setConfirmPasswordError("Password is required.");
      return;
    }

    setSavingProfile(true);
    setProfileMessage(null);
    setConfirmPasswordError("");

    const combinedFullName = [profileForm.first_name, profileForm.middle_name, profileForm.last_name]
      .filter(Boolean)
      .join(" ");
    
    const updatedForm = {
      ...profileForm,
      full_name: combinedFullName,
    };

    const changes = getProfileChanges(updatedForm, resident);

    try {
      const result = await updateResidentProfileDirect({
        residentId: resident.id,
        currentUsername: residentUsername,
        currentPassword: confirmPassword,
        requestedUsername: null,
        changes,
      });

      const nextSession = {
        ...resident,
        username: result.username || resident.username,
        full_name: result.full_name || resident.full_name,
        ...changes,
      };

      saveResidentSession(nextSession);
      setResident(nextSession);
      setPasswordConfirmOpen(false);
      setProfileMessage({
        type: "success",
        text: "Your registry profile has been updated and synchronized successfully.",
      });
    } catch (err) {
      setConfirmPasswordError(err.message || "Failed to update profile. Please verify your password.");
    } finally {
      setSavingProfile(false);
    }
  };



  // Secure Password Change
  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    if (!passwordForm.currentPassword.trim()) {
      setPasswordMessage({ type: "error", text: "Current password is required." });
      return;
    }
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordMessage({ type: "error", text: "Please fill in all password fields." });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    const isStrong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(passwordForm.newPassword);
    if (!isStrong) {
      setPasswordMessage({
        type: "error",
        text: "Password must be at least 8 characters and contain uppercase, lowercase, and a number.",
      });
      return;
    }

    setSavingPassword(true);
    setPasswordMessage(null);

    try {
      await updateResidentCredentials({
        currentUsername: resident.username,
        currentPassword: passwordForm.currentPassword,
        newUsername: resident.username,
        newPassword: passwordForm.newPassword,
      });

      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordMessage({
        type: "success",
        text: "Password updated securely.",
      });
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: error.message || "Unable to change password. Please verify current credentials.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  // Job Application Wizard
  const openJobApplication = (opp) => {
    setSelectedOppForApplication(opp);
    setJobAppStep(1);
    setJobAppForm({
      education: resident?.educational_attainment || "",
      skills: "",
      experience: "",
    });
    setJobAppResume(null);
    setJobAppSuccess(false);
    setJobAppError("");
  };

  const handleJobAppSubmit = (e) => {
    e.preventDefault();
    setJobAppError("");

    if (jobAppStep === 1) {
      setJobAppStep(2);
      return;
    }
    if (jobAppStep === 2) {
      if (!jobAppForm.skills.trim()) {
        setJobAppError("Please briefly list your skills.");
        return;
      }
      setJobAppStep(3);
      return;
    }
    if (jobAppStep === 3) {
      if (!jobAppResume) {
        setJobAppError("Please upload a resume file.");
        return;
      }
      setJobAppStep(4);
      return;
    }

    setJobAppLoading(true);
    setTimeout(() => {
      setJobAppLoading(false);
      setJobAppSuccess(true);
    }, 1000);
  };

  const renderDocumentRequestForm = () => (
    <form onSubmit={handleDocumentRequest} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Clearance Document Type *
        </label>
        <select
          value={selectedDocumentType}
          onChange={(event) => setSelectedDocumentType(event.target.value)}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none transition focus:border-[#14532D] focus:ring-2 focus:ring-[#14532D]/20 shadow-xs"
        >
          {documentTemplates.length === 0 ? (
            <option value="">No templates available</option>
          ) : (
            documentTemplates.map((template) => (
              <option key={template.id} value={template.document_type}>
                {template.template_name || template.document_type}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Purpose of Request *
        </label>
        <textarea
          value={requestPurpose}
          onChange={(event) => setRequestPurpose(event.target.value)}
          placeholder="Specify purpose (e.g. Job Application, Scholarship, Local Travel, etc.)"
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none transition focus:border-[#14532D] focus:ring-2 focus:ring-[#14532D]/20 shadow-xs"
          rows={3}
          required
        />
      </div>

      {requestMessage && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs font-bold ${
            requestMessage.type === "success"
              ? "border border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border border-rose-500/30 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {requestMessage.text}
        </div>
      )}

      <button
        type="submit"
        disabled={requesting || !selectedDocumentType}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#14532D] hover:bg-[#0f3e21] active:scale-[0.99] py-3 text-xs font-bold text-white shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {requesting ? <Loader size={14} className="animate-spin text-white" /> : <PlusCircle size={14} className="text-white" />}
        <span className="text-white font-bold">{requesting ? "Submitting application..." : "Submit Application"}</span>
      </button>
    </form>
  );

  if (loading) {
    const darkLoader = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    return (
      <div className={`flex min-h-screen items-center justify-center px-4 transition-colors ${
        darkLoader ? "bg-slate-950 text-white" : "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200"
      }`}>
        <motion.div
          className={`flex flex-col items-center rounded-2xl border px-12 py-10 text-center shadow-xl ${
            darkLoader ? "bg-slate-900 border-slate-800" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          }`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Loader size={36} className="animate-spin text-[#0B5D3B]" />
          <p className="mt-4 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Loading Resident Workspace...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className={`app-shell font-sans antialiased ${isDarkMode ? "dark" : ""} ${fontSize === "small" ? "text-sm" : fontSize === "large" ? "text-sm" : "text-xs"}`}
      style={{
        gridTemplateColumns: isDesktop ? (sidebarCollapsed ? "80px 1fr" : "240px 1fr") : "1fr"
      }}
    >
      
      {/* 1. Desktop Hover-Expandable Sidebar Container */}
      <div 
        className="relative z-[100] h-full hidden lg:block"
        style={{ width: sidebarCollapsed ? "80px" : "240px" }}
      >
        <aside 
          className={`app-sidebar ${effectiveSidebarCollapsed ? "collapsed-sidebar" : "expanded-sidebar-hover"} flex flex-col justify-between transition-all duration-300 ease-in-out absolute left-0 top-0 h-full`}
          style={{
            width: effectiveSidebarCollapsed ? "80px" : "240px",
            padding: effectiveSidebarCollapsed ? "20px 8px" : "20px 14px",
            zIndex: 100,
          }}
        >
          <div className="flex flex-col justify-between h-full w-full">
            <div>
              <div className="flex items-center justify-between mb-6">
                {!effectiveSidebarCollapsed && (
                  <div className="flex items-center gap-3 animate-fadeIn">
                    <img
                      src="/logo.png"
                      alt="Brgy. Seal"
                      className="h-10 w-10 shrink-0 object-contain rounded-full shadow-md border border-white/20 bg-white"
                      style={{ width: "40px", height: "40px", minWidth: "40px", minHeight: "40px" }}
                      onError={(e) => {
                        e.target.src = "https://placehold.co/100x100/0b5d3b/ffffff?text=Seal";
                      }}
                    />
                    <div className="min-w-0 animate-fadeIn">
                      <p className="text-[11px] font-black uppercase tracking-wider text-emerald-300">Upper Mingading</p>
                      <h2 className="text-sm font-black text-white truncate">KaagapAI</h2>
                    </div>
                  </div>
                )}
                {effectiveSidebarCollapsed && (
                  <div className="flex justify-center w-full animate-fadeIn mb-2">
                    <img
                      src="/logo.png"
                      alt="Brgy. Seal"
                      className="h-8 w-8 object-contain rounded-full shadow-md border border-white/20 bg-white"
                      onError={(e) => {
                        e.target.src = "https://placehold.co/100x100/0b5d3b/ffffff?text=Seal";
                      }}
                    />
                  </div>
                )}

                {/* Desktop Collapse / Pin Button */}
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20 active:scale-95 ml-auto"
                  title={sidebarCollapsed ? "Pin Sidebar Open" : "Collapse Sidebar"}
                >
                  {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
              </div>

              <nav className="space-y-1">
                {sidebarNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeNav === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        openModule(item.key);
                      }}
                      className={`nav-item w-full ${active ? "active" : ""} ${effectiveSidebarCollapsed ? "justify-center px-2" : "px-3"}`}
                      title={effectiveSidebarCollapsed ? item.label : undefined}
                    >
                      <Icon size={18} className={`shrink-0 ${active ? "text-[#1FA971]" : "text-emerald-100/60"}`} />
                      {!effectiveSidebarCollapsed && <span className="nav-label ml-2.5 truncate text-left text-xs font-bold text-white">{item.label}</span>}
                    </button>
                  );
                })}
                
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`nav-item w-full text-rose-200 hover:bg-rose-950/30 mt-1 ${effectiveSidebarCollapsed ? "justify-center px-2" : "px-3"}`}
                  title={effectiveSidebarCollapsed ? "Logout" : undefined}
                >
                  <LogOut size={18} className="shrink-0 text-rose-400" />
                  {!effectiveSidebarCollapsed && <span className="nav-label ml-2.5 text-xs font-bold">Logout</span>}
                </button>
              </nav>
            </div>

            {/* Transparent Background Logo - Positioned at VERY BOTTOM */}
            <div className={`mt-auto pt-6 pb-3 flex justify-center items-center ${effectiveSidebarCollapsed ? "px-1" : "px-3"}`}>
              <img
                src="/PHILLIPINE LOGO.PNG"
                alt="Philippine Seal"
                className={`object-contain transition-all duration-300 drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)] hover:scale-105 ${
                  effectiveSidebarCollapsed
                    ? "h-9 w-9 opacity-100"
                    : "w-28 sm:w-32 max-w-[85%] h-auto max-h-[110px] opacity-100"
                }`}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Drawer Backdrop & Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-[9900] lg:hidden animate-fadeIn"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Drawer (Only visible on mobile screens) */}
      <aside 
        className={`app-sidebar lg:hidden ${mobileSidebarOpen ? "open" : ""} flex flex-col justify-between p-3 sm:p-4 z-[9950]`}
      >
        <div className="flex flex-col justify-between h-full w-full">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img
                  src="/logo.png"
                  alt="Brgy. Seal"
                  className="h-8 w-8 shrink-0 object-contain rounded-full shadow-sm border border-white/20 bg-white"
                  onError={(e) => {
                    e.target.src = "https://placehold.co/100x100/0b5d3b/ffffff?text=Seal";
                  }}
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Upper Mingading</p>
                  <h2 className="text-xs font-black text-white truncate">KaagapAI</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-full p-1 hover:bg-white/10 text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="space-y-0.5">
              {sidebarNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      openModule(item.key);
                      setMobileSidebarOpen(false);
                    }}
                    className={`nav-item w-full ${active ? "active" : ""} px-2.5 py-1.5`}
                  >
                    <Icon size={16} className={`shrink-0 ${active ? "text-[#1FA971]" : "text-emerald-100/60"}`} />
                    <span className="nav-label ml-2 truncate text-left text-xs font-bold text-white">{item.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleLogout}
                className="nav-item w-full text-rose-200 hover:bg-rose-950/30 mt-1 px-2.5 py-1.5"
              >
                <LogOut size={16} className="shrink-0 text-rose-400" />
                <span className="nav-label ml-2 text-xs font-bold">Logout</span>
              </button>
            </nav>
          </div>

          {/* Transparent Background Logo - Positioned at VERY BOTTOM Mobile */}
          <div className="mt-auto pt-6 pb-3 flex justify-center items-center px-3">
            <img
              src="/PHILLIPINE LOGO.PNG"
              alt="Philippine Seal"
              className="w-24 sm:w-28 max-w-[80%] h-auto max-h-[100px] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)] opacity-100 transition-all duration-300"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
        </div>
      </aside>

      {/* Main Body */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeNav !== "dashboard" && (
          <header className="app-header py-2">
            <div className="header-left gap-3.5">
              <button
                type="button"
                onClick={() => openModule("dashboard")}
                className="rounded-xl border p-2 text-[#14532D] dark:text-[#C8A14A] bg-[#14532D]/5 dark:bg-slate-900 border-[#14532D]/20 hover:bg-[#14532D]/10 hover:border-[#14532D]/40 transition shadow-xs flex items-center justify-center cursor-pointer shrink-0"
                aria-label="Back to Dashboard"
                title="Back to Dashboard"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
            
            <div className="header-right pr-1 sm:pr-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowAccountMenu(false); setShowNotificationMenu(!showNotificationMenu); }}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl border shadow-2xs transition ${isDarkMode ? "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-805"}`}
                >
                  <Bell size={17} />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4.5 min-w-[1.1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
                      {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotificationMenu && (
                    <>
                      <div className="fixed inset-0 z-45" onClick={() => setShowNotificationMenu(false)} />
                      <motion.div
                        className={`absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border shadow-xl ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-808"}`}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      >
                        <div className={`flex items-center justify-between border-b px-4 py-2.5 ${isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50"}`}>
                          <p className="text-sm font-black uppercase tracking-wider text-slate-505">Notifications</p>
                          <span className={`rounded-full px-2 py-0.5 text-sm font-bold ${isDarkMode ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-50 text-emerald-805"}`}>
                            {unreadNotificationCount} New
                          </span>
                        </div>
                        <div className="max-h-72 divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto">
                          {allNotificationsMerged.length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-400 font-bold">No recent alerts.</div>
                          ) : (
                            allNotificationsMerged.map((n) => (
                              <button
                                key={n.id}
                                type="button"
                                onClick={() => {
                                  if (n.isAnnouncement) {
                                    const next = [...new Set([...announcementReadIds, n.announcement_id])];
                                    saveStoredReadIds(`${ANNOUNCEMENT_READ_KEY}:${resident?.id}`, next);
                                    setAnnouncementReadIds(next);
                                    setShowNotificationMenu(false);
                                    openModule("announcements");
                                  } else {
                                    handleMarkNotificationRead(n.original);
                                    setShowNotificationMenu(false);
                                    const title = (n.title || "").toLowerCase();
                                    if (title.includes("announcement")) openModule("announcements");
                                    else if (title.includes("livelihood") || title.includes("application")) openModule("livelihood");
                                    else openModule("documents");
                                  }
                                }}
                                className={`w-full flex gap-2.5 p-3 text-left transition-colors ${isDarkMode ? `hover:bg-slate-800 ${!n.is_read ? "bg-emerald-505/5" : ""}` : `hover:bg-slate-50 ${!n.is_read ? "bg-emerald-50/20" : ""}`}`}
                              >
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isDarkMode ? "bg-slate-805 text-emerald-400" : "bg-emerald-50 text-emerald-700"}`}>
                                  <FileText size={13} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-bold">{n.title}</p>
                                  <p className={`mt-0.5 line-clamp-2 text-sm leading-normal font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{n.message}</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>
        )}

        <div className="px-2 py-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto pb-24">
          
          {portalError && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800 shadow-sm">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{portalError}</span>
            </div>
          )}

{portalSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-sm">
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              <span>{portalSuccess}</span>
            </div>
          )}

          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeNav === "dashboard" && (
            <div className="space-y-6 animate-fadeIn">
              {/* COMBINED UNIFIED STICKY HEADER & QUICK ACTIONS CONTAINER (GPU ACCELERATED, 0 LAG) */}
              <div className="sticky top-0 z-40 space-y-2 pb-2 pt-1 bg-[#f8fafc]">
                {/* 1. HERO HEADER BANNER */}
                <div className="relative rounded-3xl shadow-xl bg-gradient-to-br from-[#042F1A] via-[#0A4D2B] to-[#042F1A] text-white p-4 sm:p-7 border border-emerald-500/30">
                  {/* Background Image Watermark */}
                  <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden rounded-3xl opacity-30">
                    <img
                      src="/barangay/BarangayOffice.png.jpg"
                      alt="Barangay Office"
                      className="w-full h-full object-cover object-center"
                      onError={(e) => {
                        e.target.src = "/barangay/BARANGAYOFICE.PNG";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#042F1A]/95 via-[#0A4D2B]/85 to-[#042F1A]/95" />
                  </div>

                  <div className="relative z-10 flex items-start justify-between gap-4">
                    {/* Left: Greeting & Name */}
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-emerald-200/90 tracking-wide">
                        {(() => {
                          const hour = new Date().getHours();
                          if (hour < 12) return "Good Morning,";
                          if (hour < 18) return "Good Afternoon,";
                          return "Good Evening,";
                        })()}
                      </p>
                      <h1 className="text-lg sm:text-2xl lg:text-3xl font-black text-white leading-tight truncate flex items-center gap-2">
                        {displayName}
                        <span className="text-lg sm:text-xl inline-block">👋</span>
                      </h1>
                      <p className="text-[11px] sm:text-xs font-bold text-emerald-300/90 tracking-wide mt-0.5 truncate">
                        Welcome to Barangay Upper Mingading
                      </p>
                    </div>

                    {/* Right: Actions (Notification Bell & Profile Avatar) */}
                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                      {/* Notification Bell */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => { setShowAccountMenu(false); setShowNotificationMenu(!showNotificationMenu); }}
                          className="relative flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-slate-900/60 hover:bg-slate-900/80 border border-white/20 text-white shadow-md backdrop-blur-md transition active:scale-95 cursor-pointer"
                        >
                          <Bell size={18} />
                          {unreadNotificationCount > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white ring-2 ring-emerald-950 animate-pulse">
                              {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                            </span>
                          )}
                        </button>

                        {/* Notification Menu Dropdown */}
                        <AnimatePresence>
                          {showNotificationMenu && (
                            <>
                              <div className="fixed inset-0 z-[99990]" onClick={() => setShowNotificationMenu(false)} />
                              <motion.div
                                className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 overflow-hidden rounded-2xl border border-slate-200 shadow-2xl bg-white text-slate-900 animate-fadeIn z-[99999]"
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                              >
                                <div className="flex items-center justify-between border-b px-3.5 py-2.5 border-slate-100 bg-slate-50">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-black uppercase tracking-wider text-[#14532D]">Notifications</p>
                                    <span className="rounded-full px-2 py-0.5 text-[10px] font-black bg-emerald-100 text-[#14532D] border border-emerald-200">
                                      {unreadNotificationCount} New
                                    </span>
                                  </div>
                                  {unreadNotificationCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={handleMarkAllNotificationsRead}
                                      className="text-[10px] font-bold text-[#14532D] hover:underline cursor-pointer"
                                    >
                                      Mark all read
                                    </button>
                                  )}
                                </div>
                                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                                  {allNotificationsMerged.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-slate-400 font-bold">No recent alerts.</div>
                                  ) : (
                                    allNotificationsMerged.map((n) => (
                                      <button
                                        key={n.id}
                                        type="button"
                                        onClick={() => {
                                          if (n.isAnnouncement) {
                                            const next = [...new Set([...announcementReadIds, n.announcement_id])];
                                            saveStoredReadIds(`${ANNOUNCEMENT_READ_KEY}:${resident?.id}`, next);
                                            setAnnouncementReadIds(next);
                                            setShowNotificationMenu(false);
                                            openModule("announcements");
                                          } else {
                                            handleMarkNotificationRead(n.original);
                                            setShowNotificationMenu(false);
                                            const title = (n.title || "").toLowerCase();
                                            if (title.includes("announcement")) openModule("announcements");
                                            else if (title.includes("livelihood") || title.includes("application")) openModule("livelihood");
                                            else openModule("documents");
                                          }
                                        }}
                                        className="w-full flex gap-2.5 p-3 text-left transition-colors hover:bg-slate-50 bg-white"
                                      >
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#14532D]">
                                          <FileText size={13} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-xs font-black text-slate-900">{n.title}</p>
                                          <p className="mt-0.5 line-clamp-2 text-xs leading-normal font-semibold text-slate-500">{n.message}</p>
                                        </div>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Profile Avatar */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => { setShowNotificationMenu(false); setShowAccountMenu(!showAccountMenu); }}
                          className="relative flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-400 bg-slate-100 shadow-md transition transform hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          {resident?.profile_photo_url ? (
                            <img src={resident.profile_photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-black text-white bg-[#14532D]">
                              {displayName[0]?.toUpperCase() || "R"}
                            </div>
                          )}
                        </button>
                        <div className="absolute bottom-0 right-0 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border-2 border-slate-950 bg-emerald-400 z-10"></div>

                        {/* Account Menu Popover */}
                        <AnimatePresence>
                          {showAccountMenu && (
                            <>
                              <div className="fixed inset-0 z-[99990]" onClick={() => setShowAccountMenu(false)} />
                              <motion.div
                                className="absolute right-0 top-full mt-2 z-[99999] w-48 sm:w-56 max-w-[85vw] rounded-2xl border border-slate-200 p-2 shadow-2xl bg-white text-[#14532D] animate-fadeIn"
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                              >
                                <div className="px-2.5 py-2 sm:py-3 mb-1.5 sm:mb-2 text-center rounded-xl border border-slate-200 bg-slate-50">
                                  <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 overflow-hidden rounded-full border-2 border-[#14532D] mb-1.5 shadow-xs">
                                    {resident?.profile_photo_url ? (
                                      <img src={resident.profile_photo_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs sm:text-sm font-black text-white bg-[#14532D]">{displayName[0]?.toUpperCase() || "R"}</div>
                                    )}
                                  </div>
                                  <p className="truncate text-xs font-black text-slate-900">{displayName}</p>
                                  <p className="truncate text-[10px] sm:text-[11px] text-slate-500 font-bold mt-0.5">{residentUsername}</p>
                                </div>

                                {[
                                  { key: "profile", label: "My Profile", icon: User },
                                  { key: "personal_info", label: "Personal Information", icon: FileText },
                                  { key: "settings", sub: "security", label: "Settings", icon: Settings },
                                ].map((item, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => { setShowAccountMenu(false); openModule(item.key, item.sub); }}
                                    className="flex w-full items-center gap-2 sm:gap-2.5 rounded-xl px-2.5 py-1.5 sm:py-2 text-left text-xs font-bold transition text-slate-700 hover:bg-emerald-50 hover:text-[#14532D] active:scale-98 cursor-pointer"
                                  >
                                    <item.icon size={14} className="text-[#14532D] shrink-0" />
                                    <span className="font-extrabold text-[11px] sm:text-xs">{item.label}</span>
                                  </button>
                                ))}

                                <div className="my-1 border-t border-slate-100" />
                                <button
                                  type="button"
                                  onClick={() => { setShowAccountMenu(false); handleLogout(); }}
                                  className="flex w-full items-center gap-2 sm:gap-2.5 rounded-xl px-2.5 py-1.5 sm:py-2 text-left text-xs font-bold transition text-rose-600 hover:bg-rose-50 hover:text-rose-700 active:scale-98 cursor-pointer"
                                >
                                  <LogOut size={14} className="text-rose-600 shrink-0" />
                                  <span className="font-extrabold text-[11px] sm:text-xs">Log Out</span>
                                </button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. 4 QUICK ACTION CARDS (STEADY WITH HEADER; COMPRESSES TO ICONS-ONLY TOOLBAR ON SCROLL WITH HOVER EXPANSION) */}
                <div 
                  onMouseEnter={() => setIsStatCardsHovered(true)}
                  onMouseLeave={() => setIsStatCardsHovered(false)}
                  className="transition-all duration-300"
                >
                  {isDashboardScrolled && !isStatCardsHovered ? (
                    /* Sleek Pure Icon-Only Compressed Toolbar when Scrolled Down */
                    <div className="grid grid-cols-4 gap-2 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-md w-full items-center transition-all duration-200">
                      {[
                        { label: "Request Document", icon: FileText, action: () => setDocumentModalOpen(true), hex: "#059669" },
                        { label: "Livelihoods & Jobs", icon: Briefcase, action: () => openModule("livelihood"), hex: "#7C3AED" },
                        { label: "View Announcements", icon: Megaphone, action: () => openModule("announcements"), hex: "#2563EB" },
                        { label: "Document Logs", icon: FileCheck2, action: () => openModule("my_documents"), hex: "#0891B2" }
                      ].map((act, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={act.action}
                          style={{ backgroundColor: act.hex }}
                          className="flex h-10 w-full items-center justify-center rounded-xl text-white font-black transition duration-200 hover:scale-105 hover:brightness-110 active:scale-95 cursor-pointer shadow-md group"
                          title={act.label}
                        >
                          <act.icon size={20} className="stroke-[2.5] text-white shrink-0 group-hover:scale-110 transition" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* Full 4 Colored Cards (Green, Ultraviolet, Blue, Cyan) */
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-4 w-full">
                      {[
                        {
                          label: "Request Document",
                          icon: FileText,
                          cardBg: "bg-gradient-to-br from-[#DCFCE7] via-[#BBF7D0] to-[#86EFAC] border-emerald-300/90 text-emerald-950",
                          iconBg: "bg-emerald-700 text-white shadow-sm",
                          action: () => setDocumentModalOpen(true),
                        },
                        {
                          label: "Livelihoods & Jobs",
                          icon: Briefcase,
                          cardBg: "bg-gradient-to-br from-[#F3E8FF] via-[#E9D5FF] to-[#D8B4FE] border-purple-300/90 text-purple-950",
                          iconBg: "bg-purple-700 text-white shadow-sm",
                          action: () => openModule("livelihood"),
                        },
                        {
                          label: "View Announcements",
                          icon: Megaphone,
                          cardBg: "bg-gradient-to-br from-[#DBEAFE] via-[#BFDBFE] to-[#93C5FD] border-blue-300/90 text-blue-950",
                          iconBg: "bg-blue-700 text-white shadow-sm",
                          action: () => openModule("announcements"),
                        },
                        {
                          label: "Document Logs",
                          icon: FileCheck2,
                          cardBg: "bg-gradient-to-br from-[#CFFAFE] via-[#A5F3FC] to-[#67E8F9] border-cyan-300/90 text-cyan-950",
                          iconBg: "bg-cyan-700 text-white shadow-sm",
                          action: () => openModule("my_documents"),
                        },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={item.action}
                          className={`${item.cardBg} border rounded-2xl p-2 sm:p-4 shadow-sm hover:shadow-md flex flex-col items-center justify-center text-center transition duration-200 hover:-translate-y-0.5 active:scale-95 group cursor-pointer overflow-hidden min-w-0`}
                        >
                          <div className={`${item.iconBg} p-2 sm:p-3 rounded-2xl mb-1.5 sm:mb-2 group-hover:scale-110 transition flex items-center justify-center`}>
                            <item.icon className="h-4.5 w-4.5 sm:h-6 sm:w-6 stroke-[2.5]" />
                          </div>
                          <span className="text-[9.5px] xs:text-[10px] sm:text-xs font-black leading-tight text-center truncate max-w-full px-0.5 group-hover:scale-[1.02] transition">
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. MIDDLE GRID: ANNOUNCEMENTS & LIVELIHOOD EVENTS (2 COLUMNS - EQUAL HEIGHT BALANCED LAYOUT) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-stretch">
                
                {/* Left Column: BARANGAY ANNOUNCEMENTS */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <Megaphone size={16} className="text-[#14532D]" />
                        BARANGAY ANNOUNCEMENTS
                      </h4>
                      <button
                        type="button"
                        onClick={() => openModule("announcements")}
                        className="text-xs font-black text-[#14532D] hover:underline flex items-center gap-1 group"
                      >
                        <span>View All</span>
                        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition" />
                      </button>
                    </div>

                    {/* Dynamic Featured Announcement Card with Glossy Glassmorphic Design */}
                    {(() => {
                      const displayAnnouncement = featuredAnnouncement || {
                        id: "demo-emergency-1",
                        category: "EMERGENCY",
                        title: "Flood Warning",
                        body: "Emergency Announcement: Flood warning. This is an urgent barangay advisory. Situation: Affected Area: all puroks. Immediate Action: proceed evacuation center.",
                        publish_date: "2026-07-15",
                        audience: "All Residents"
                      };
                      return (
                        <div 
                          onClick={() => setSelectedAnnouncementModal(displayAnnouncement)}
                          className="relative rounded-2xl overflow-hidden p-5 sm:p-6 text-white shadow-xl bg-gradient-to-br from-[#14532D] via-[#0F4324] to-[#082414] backdrop-blur-xl border border-emerald-400/35 shadow-[0_10px_35px_-5px_rgba(11,89,46,0.4)] flex flex-col justify-between space-y-3 min-h-[195px] group transition-all duration-300 cursor-pointer"
                        >
                          {/* Glossy top glare sheen */}
                          <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none z-10" />

                          {/* Soft ambient radial glow */}
                          <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none z-0" />

                          {/* Barangay Hall Background Watermark */}
                          <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
                            <img
                              src="/barangay/BARANGAYOFICE.PNG"
                              alt="Barangay Hall"
                              className="w-full h-full object-cover opacity-20 rounded-2xl transition duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#082414]/95 via-[#0F4324]/75 to-transparent rounded-2xl" />
                          </div>

                          <div className="flex justify-between items-center z-10 gap-2">
                            {String(displayAnnouncement.category || "").toLowerCase().includes("emergency") ? (
                              <span className="bg-rose-600/95 text-white text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full border border-rose-300/40 shadow-[0_0_12px_rgba(225,29,72,0.6)] backdrop-blur-md shrink-0">
                                EMERGENCY
                              </span>
                            ) : (
                              <span className="bg-emerald-500/30 text-emerald-100 text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full border border-emerald-300/40 shadow-xs backdrop-blur-md shrink-0">
                                {displayAnnouncement.category || "ADVISORY"}
                              </span>
                            )}
                            <span className="text-[10px] sm:text-xs text-emerald-200/90 font-bold bg-[#082414]/60 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-emerald-400/20 shrink-0">
                              {new Date(displayAnnouncement.publish_date || displayAnnouncement.created_at || "2026-07-15").toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>

                          <div className="z-10 space-y-1 max-w-[95%]">
                            <h5 className="text-base sm:text-lg font-black text-white leading-snug drop-shadow-xs">
                              {displayAnnouncement.title}
                            </h5>
                            <p className="text-xs text-emerald-100/95 font-medium leading-relaxed line-clamp-2">
                              {String(displayAnnouncement.body || "")}
                            </p>
                          </div>

                          <div className="z-10 pt-1 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAnnouncementModal(displayAnnouncement);
                              }}
                              className="bg-gradient-to-r from-emerald-500 via-[#14532D] to-[#0A331B] hover:from-emerald-400 hover:to-[#0F4324] text-white px-3.5 py-1.5 text-xs font-black rounded-xl border border-emerald-300/30 shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition-all transform active:scale-95 flex items-center gap-2 group cursor-pointer"
                            >
                              <span>Read More</span>
                              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition" />
                            </button>
                          </div>

                          {/* Graphic Advisory Watermark */}
                          <div className="absolute right-3 bottom-3 opacity-15 pointer-events-none text-white z-10">
                            <AlertCircle size={80} className="stroke-[1.5]" />
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Secondary Announcements Dynamic List */}
                  <div className="space-y-2.5 pt-1">
                    {(secondaryAnnouncements.length > 0
                      ? secondaryAnnouncements
                      : [
                          {
                            id: "sec-1",
                            category: "HEALTH",
                            title: "Schedule: Medical Mission",
                            body: "Free medical check-up on July 16, 2026 at Barangay Hall.",
                            created_at: "2026-07-12",
                          },
                          {
                            id: "sec-2",
                            category: "COMMUNITY",
                            title: "Clean-up Drive",
                            body: "Join us this July 20, 2026 for a community clean-up drive.",
                            created_at: "2026-07-10",
                          },
                        ]
                    ).map((ann) => (
                      <div
                        key={ann.id}
                        onClick={() => setSelectedAnnouncementModal(ann)}
                        className="group relative overflow-hidden bg-[#F0FDF4] border border-emerald-200/80 hover:border-emerald-400 rounded-xl p-3 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="h-8 w-8 rounded-lg bg-[#14532D]/10 text-[#14532D] flex items-center justify-center shrink-0 font-bold group-hover:scale-105 transition">
                            <Megaphone size={15} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="bg-emerald-100 text-[#14532D] text-[9px] font-black uppercase px-2 py-0.2 rounded border border-emerald-300/30">
                                {ann.category || "ADVISORY"}
                              </span>
                              <span className="text-[10px] text-slate-500 font-bold">
                                {new Date(ann.publish_date || ann.created_at || Date.now()).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                            <h6 className="text-xs font-black text-slate-800 truncate group-hover:text-[#14532D] transition">
                              {ann.title}
                            </h6>
                            <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                              {ann.body}
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-400 group-hover:text-[#14532D] group-hover:translate-x-0.5 transition shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: UPCOMING EVENTS & LIVELIHOOD OPPORTUNITIES */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 text-slate-900">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Calendar size={16} className="text-[#14532D]" />
                      UPCOMING EVENTS & LIVELIHOOD OPPORTUNITIES
                    </h4>
                    <button
                      type="button"
                      onClick={() => openModule("livelihood")}
                      className="text-xs font-black text-[#14532D] hover:underline flex items-center gap-1 group"
                    >
                      <span>View All</span>
                      <ChevronRight size={14} className="group-hover:translate-x-0.5 transition" />
                    </button>
                  </div>

                  {/* 3 Stacked Glossy Green Program Cards */}
                  <div className="space-y-3">
                    {[
                      {
                        month: "JUN",
                        day: "15",
                        tag: "PROGRAM",
                        title: "TESDA Computer Literacy Training",
                        desc: "Basic computer literacy training for residents.",
                        time: "8:00 AM - 5:00 PM • Barangay Hall"
                      },
                      {
                        month: "JUN",
                        day: "20",
                        tag: "JOB",
                        title: "Community Job Fair",
                        desc: "Local employers will accept applicants for entry-level positions.",
                        time: "9:00 AM - 3:00 PM • Barangay Hall"
                      },
                      {
                        month: "JUL",
                        day: "01",
                        tag: "PROGRAM",
                        title: "Urban Gardening Livelihood Program",
                      }
                    ].map((prog, idx) => (
                      <div key={idx} className="relative overflow-hidden bg-gradient-to-br from-[#14532D]/95 via-[#0F4324]/90 to-[#082414]/95 backdrop-blur-xl border border-emerald-400/30 text-white p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 shadow-md shadow-emerald-950/20 transition duration-250 hover:shadow-xl hover:border-emerald-300/50 group">
                        {/* Top glare sheen */}
                        <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-white/5 to-transparent pointer-events-none z-10" />
                        {/* Date badge */}
                        <div className="bg-white text-slate-900 rounded-xl px-3 py-2 text-center shrink-0 min-w-[54px] shadow-xs">
                          <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider leading-none">{prog.month}</p>
                          <p className="text-lg font-black text-slate-900 leading-none mt-1">{prog.day}</p>
                        </div>

                        {/* Program details */}
                        <div className="min-w-0 flex-1">
                          <span className="inline-block bg-white/20 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider mb-1">
                            {prog.tag}
                          </span>
                          <h5 className="text-xs sm:text-sm font-black text-white truncate leading-tight">{prog.title}</h5>
                          <p className="text-[10px] sm:text-[11px] text-emerald-100 font-medium truncate mt-0.5">{prog.desc}</p>
                          <p className="text-[9px] sm:text-[10px] text-emerald-200/90 font-bold mt-1">🕒 {prog.time}</p>
                        </div>

                        {/* Apply Now button */}
                        <button
                          type="button"
                          onClick={() => openModule("livelihood")}
                          className="bg-white text-[#0B6635] hover:bg-emerald-50 px-3.5 py-1.5 rounded-lg text-xs font-black shrink-0 transition active:scale-95 shadow-2xs"
                        >
                          Apply Now
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* 5. BOTTOM GRID: RECENT DOCUMENT REQUESTS TABLE & NEED HELP CARD (7/12 & 5/12) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
                
                {/* Left Column (7/12 width): RECENT DOCUMENT REQUESTS TABLE */}
                <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <FileText size={16} className="text-[#0B6635]" />
                      RECENT DOCUMENT REQUESTS
                    </h4>
                    <button
                      type="button"
                      onClick={() => openModule("my_documents")}
                      className="text-xs font-black text-[#0B6635] hover:underline"
                    >
                      View All →
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-150">
                    <table className="w-full text-left text-xs min-w-[500px]">
                      <thead>
                        <tr className="border-b text-[10px] font-black uppercase tracking-wider border-slate-200 bg-slate-50 text-slate-500">
                          <th className="px-4 py-3">Document Type</th>
                          <th className="px-4 py-3">Reference No.</th>
                          <th className="px-4 py-3">Date Requested</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-semibold divide-slate-100 text-slate-700">
                        {(requests.length > 0 ? requests.slice(0, 3) : [
                          { id: 1, document_type: "Barangay Clearance", ref: "BC-2026-0712-001", date: "July 12, 2026", status: "Pending" },
                          { id: 2, document_type: "Certificate of Residency", ref: "CR-2026-0708-045", date: "July 8, 2026", status: "Approved" },
                          { id: 3, document_type: "Indigency Certificate", ref: "IC-2026-0705-021", date: "July 5, 2026", status: "Completed" }
                        ]).map((req, idx) => (
                          <tr key={req.id || idx} className="transition hover:bg-slate-50/60">
                            <td className="px-4 py-3.5 font-bold text-slate-850">{req.document_type}</td>
                            <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">{req.ref || req.reference_no || `REF-2026-07${idx + 1}0`}</td>
                            <td className="px-4 py-3.5 text-slate-500">{req.date || new Date(req.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                                req.status === "Pending" ? "bg-amber-50 text-amber-800 border-amber-200" :
                                req.status === "Approved" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                                req.status === "Completed" ? "bg-blue-50 text-blue-800 border-blue-200" :
                                getStatusClass(req.status)
                              }`}>
                                {req.status?.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => openModule("my_documents")}
                                className="text-xs font-black text-[#0B6635] hover:underline"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Column (5/12 width): NEED HELP? CARD WITH RESPONSIVE BARANGAY OFFICIALS PHOTO */}
                <div className="group relative lg:col-span-5 border border-slate-200/90 rounded-2xl shadow-md flex flex-col justify-between overflow-hidden min-h-[220px] xs:min-h-[240px] sm:min-h-[280px] md:min-h-[320px]">
                  {/* Background Image - Responsive landscape fit for Mobile & Desktop */}
                  <img 
                    src="/barangay/barangay%20officials.png" 
                    alt="Barangay Officials" 
                    className="absolute inset-0 w-full h-full object-cover object-top sm:object-center transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />

                  {/* Top & Bottom Soft Gradient Tint (Leaves faces in middle 100% clear) */}
                  <div className="absolute inset-x-0 top-0 h-24 sm:h-28 bg-gradient-to-b from-black/75 via-black/35 to-transparent pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-16 sm:h-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

                  {/* TOP HEADER SECTION (Compact on Mobile so faces remain 100% visible) */}
                  <div className="relative z-10 p-2.5 sm:p-4 space-y-1.5 sm:space-y-2">
                    {/* Header Row: Title & Button */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-white bg-slate-900/80 backdrop-blur-md px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-white/20 shadow-sm">
                        <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <HelpCircle size={10} className="sm:hidden" />
                          <HelpCircle size={12} className="hidden sm:block" />
                        </span>
                        Need Help?
                      </div>

                      <button
                        type="button"
                        onClick={() => openModule("announcements")}
                        className="bg-[#0B6635] hover:bg-[#08522a] text-white py-0.5 sm:py-1 px-2.5 sm:px-3 rounded-full text-[9px] sm:text-[10px] font-black transition text-center shadow-md active:scale-95 border border-emerald-400/40 flex items-center gap-1"
                      >
                        Contact Office →
                      </button>
                    </div>

                    {/* Compact Subtitle Text */}
                    <p className="text-[9.5px] sm:text-[11px] text-white font-semibold leading-tight bg-slate-900/75 backdrop-blur-md px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/15 shadow-sm max-w-full">
                      For inquiries and assistance, you may contact the barangay office.
                    </p>
                  </div>

                  {/* MIDDLE AREA IS 100% CLEAR (FACES ENTIRELY UNTOUCHED) */}
                  <div className="flex-1 min-h-[50px] sm:min-h-[100px]" />

                  {/* BOTTOM FOOTER BAR (Positioned over ground area) */}
                  <div className="relative z-10 p-2 sm:p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[9.5px] sm:text-[11px] font-bold text-white bg-slate-900/85 backdrop-blur-md px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-white/15 shadow-sm">
                      <span className="flex items-center gap-1">📞 {systemSettings?.officePhone || "09306259795"}</span>
                      <span className="flex items-center gap-1 truncate">✉ {systemSettings?.officeEmail || "admin@kaagapai.gov"}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: REQUEST DOCUMENTS */}
          {activeNav === "documents" && (
            <div className="border border-slate-200 rounded-2xl p-6 shadow-xs animate-fadeIn bg-white text-slate-900">
              <div className="border-b pb-3 mb-5 border-slate-100">
                <h2 className="text-base font-black uppercase tracking-wider text-[#14532D]">
                  Document Request
                </h2>
                <p className="text-xs text-slate-500 font-bold mt-0.5">Submit clearance and certificate requests directly to the Barangay Hall.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {/* Form Card */}
                <div className="border border-slate-200 rounded-2xl p-5 shadow-xs md:col-span-1 space-y-4 bg-slate-50 text-slate-900">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Clearance Application</h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-bold">Choose a template type and supply any required details.</p>
                  </div>
                  {renderDocumentRequestForm()}
                </div>

                {/* Specs/Details Card */}
                <div className="border border-slate-200 rounded-2xl p-5 shadow-xs md:col-span-2 bg-white text-slate-900">
                  {selectedTemplateDetails ? (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[#14532D]">
                          <Info size={14} />
                        </span>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Clearance specifications</h4>
                      </div>
                      <h3 className="text-base font-black text-[#14532D]">{selectedTemplateDetails.template_name}</h3>
                      <div className="grid gap-4 sm:grid-cols-2 text-xs leading-relaxed font-semibold">
                        <div>
                          <p className="text-xs text-slate-500 font-bold uppercase block">Description</p>
                          <p className="mt-1 font-medium text-slate-700">{selectedTemplateDetails.description || "Official document certificate."}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-bold uppercase block">Requirements</p>
                          <p className="mt-1 font-medium text-slate-700">{selectedTemplateDetails.requirements || "None listed."}</p>
                        </div>
                        <div className="border-t border-slate-100 pt-3">
                          <p className="text-xs text-slate-500 font-bold uppercase block">Processing Duration</p>
                          <p className="text-[#14532D] font-black mt-0.5">{selectedTemplateDetails.processing_time || "Same Day"}</p>
                        </div>
                        <div className="border-t border-slate-100 pt-3">
                          <p className="text-xs text-slate-500 font-bold uppercase block">Application Fee</p>
                          <p className="text-[#14532D] font-black mt-0.5">{selectedTemplateDetails.fee || "Free"}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center py-12 space-y-2">
                      <FileText className="text-slate-300" size={28} />
                      <p className="text-xs text-slate-400 font-bold">Select document template to view specifications.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2.5: MY DOCUMENTS */}
          {activeNav === "my_documents" && (
            <div className="border border-slate-200 rounded-2xl p-6 shadow-xs animate-fadeIn bg-white text-slate-900">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3 mb-5">
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-[#14532D]">
                    My Documents
                  </h2>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">Logs and progress of your requested clearances.</p>
                </div>
                <button
                  type="button"
                  onClick={() => refreshResidentActivity(resident?.id, { showLoading: true })}
                  disabled={refreshingRequests}
                  className="flex items-center gap-1 text-xs font-black text-[#14532D] hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={11} className={refreshingRequests ? "animate-spin" : ""} />
                  Refresh Logs
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                {requests.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-10 font-bold">No clearance applications submitted.</p>
                ) : (
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b font-bold uppercase tracking-wider text-xs border-slate-200 bg-slate-50 text-slate-600">
                        <th className="px-4 py-3">Document Type</th>
                        <th className="px-4 py-3">Date Applied</th>
                        <th className="px-4 py-3">Last Updated</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-semibold divide-slate-100 text-slate-700">
                      {requests.map((req) => {
                        const expired = isRequestExpired(req);
                        const displayStatus = expired ? "Expired" : req.status;
                        const isPending = !expired && req.status === "Pending";
                        const isCancelled = req.status === "Cancelled";
                        return (
                          <tr key={req.id} className="transition hover:bg-slate-50">
                            <td className="px-4 py-3 font-black text-slate-800">{req.document_type}</td>
                            <td className="px-4 py-3">{new Date(req.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3">{new Date(req.updated_at || req.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black border ${getStatusClass(displayStatus)}`}>
                                {displayStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isPending && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditRequest(req)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition border border-blue-200 shadow-2xs"
                                      title="Edit Request Type"
                                    >
                                      <Pencil size={12} />
                                      <span>Edit</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleCancelRequestAction(req)}
                                      disabled={cancellingRequestId === req.id}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition border border-rose-200 shadow-2xs disabled:opacity-50"
                                      title="Cancel Request"
                                    >
                                      {cancellingRequestId === req.id ? <Loader size={12} className="animate-spin" /> : <XCircle size={12} />}
                                      <span>Cancel</span>
                                    </button>
                                  </>
                                )}

                                {isCancelled && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRequestAction(req)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition border border-slate-200"
                                    title="Delete Record"
                                  >
                                    <Trash2 size={12} />
                                    <span>Delete</span>
                                  </button>
                                )}

                                {!isPending && !isCancelled && (
                                  <span className="text-[11px] text-slate-400 font-medium">No actions</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ANNOUNCEMENTS */}

          {activeNav === "announcements" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5 animate-fadeIn text-slate-900">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Barangay Bulletins</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-bold">Verified public service announcements and alerts.</p>
              </div>
              <div className="space-y-4">
                {publishedAnnouncements.map((ann, idx) => (
                  <article
                    key={ann.id}
                    className={`rounded-2xl border p-4.5 flex gap-4 transition duration-200 ${
                      idx === 0 ? "border-[#14532D]/20 bg-[#F0FDF4]" : "border-slate-200 bg-white"
                    }`}
                  >
                    <span className={`h-9 w-9 flex items-center justify-center rounded-xl shrink-0 ${
                      idx === 0 ? "bg-gradient-to-r from-[#14532D] to-[#0F4324] text-white shadow-sm" : "bg-[#14532D]/10 text-[#14532D]"
                    }`}>
                      <Megaphone size={15} />
                    </span>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-black text-slate-800 leading-snug">{ann.title}</h4>
                        <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-black text-[#14532D] uppercase tracking-wider">
                          {ann.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">{ann.body}</p>
                      <div className="flex justify-between items-center pt-2">
                        <p className="text-xs text-slate-500 font-bold">
                          Published: {new Date(ann.publish_date).toLocaleDateString()}
                        </p>
                        <button
                          type="button"
                          onClick={() => openModule("announcements")}
                          className="text-xs font-black text-[#14532D] hover:underline"
                        >
                          Read More
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {publishedAnnouncements.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8 font-bold">No announcements posted.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LIVELIHOODS & JOBS */}
          {activeNav === "livelihood" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5 animate-fadeIn text-slate-900">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Livelihoods & jobs</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-bold">Active training sessions and program listings.</p>
                </div>
                <span className="text-xs font-bold bg-[#14532D]/10 border border-[#14532D]/20 text-[#14532D] px-2.5 py-0.5 rounded-full">
                  {opportunities.length} Openings
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4.5 flex flex-col justify-between hover:border-[#14532D]/30 hover:shadow-md transition duration-200"
                  >
                    <div>
                      <span className="inline-flex rounded bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-[#14532D] mb-2 shadow-2xs">
                        {opp.category}
                      </span>
                      <h4 className="text-xs font-black text-slate-800 leading-snug">{opp.title}</h4>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed font-semibold">
                        {opp.description || "No specific details provided."}
                      </p>
                    </div>
                    <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2">
                      <div className="space-y-1 text-xs font-bold text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} className="text-[#14532D]" />
                          <span>Closing: {new Date(opp.deadline).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Home size={11} className="text-[#14532D]" />
                          <span className="truncate">Venue: {opp.location || "Community Hall"}</span>
                        </div>
                      </div>
                      {(() => {
                        if (opp.status !== "Open") return null;
                        const application = residentApplications.find(app => app.livelihood_post_id === opp.id);
                        if (!application) {
                          return (
                            <button
                              type="button"
                              onClick={() => handleApplyLivelihood(opp.id)}
                              className="w-full mt-2 py-2 rounded-xl bg-gradient-to-r from-[#14532D] to-[#0F4324] text-white font-bold text-xs hover:scale-101 hover:shadow-sm transition border border-white/10"
                            >
                              Apply Now
                            </button>
                          );
                        }
                        if (application.status === "Approved") {
                          return (
                            <div className="mt-2 py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center">
                              <p className="flex items-center justify-center gap-1.5 mb-1"><CheckCircle size={14} className="text-emerald-600"/> Application Approved</p>
                              <span className="text-[10px] font-semibold text-emerald-700/80 leading-tight">You are listed. You need to visit the barangay for your verifications, and orientations etc.</span>
                            </div>
                          );
                        }
                        if (application.status === "Rejected") {
                          return (
                            <div className="mt-2 py-2 px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold text-center">
                              Application Rejected
                            </div>
                          );
                        }
                        return (
                          <div className="mt-2 py-2 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold text-center">
                            Application Pending
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
                {opportunities.length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-10 sm:col-span-2 xl:col-span-4 font-bold">
                    No active program logs.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: USER PROFILE */}
          {activeNav === "profile" && (
            <div className="border border-slate-200 rounded-2xl p-6 shadow-xs animate-fadeIn bg-white text-slate-900">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Profile Photo Card */}
                <div className="w-full md:w-64 shrink-0 border border-slate-200 rounded-2xl p-5 text-center flex flex-col items-center shadow-xs bg-slate-50">
                  <div className="h-28 w-28 overflow-hidden rounded-full border-2 border-[#0B5D3B] bg-white shadow-md relative group">
                    {resident?.profile_photo_url ? (
                      <img src={resident.profile_photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-black text-emerald-800 bg-emerald-50">
                        {displayName[0]?.toUpperCase() || "R"}
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-black mt-4 text-slate-900">{displayName}</h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-sm font-black uppercase tracking-wider text-emerald-700 mt-2">
                    Verified Resident
                  </span>
                  
                  {/* Photo Actions */}
                  <div className="mt-5 w-full flex flex-col gap-2">
                    <input
                      type="file"
                      id="avatar-profile-page-upload"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={avatarSaving}
                      className="hidden"
                    />
                    <label
                      htmlFor="avatar-profile-page-upload"
                      className="w-full inline-flex items-center justify-center gap-1.5 cursor-pointer rounded-xl bg-gradient-to-r from-[#0B5D3B] to-[#157347] px-3.5 py-2.5 text-sm font-bold text-white transition hover:scale-101 shadow-sm disabled:opacity-50"
                    >
                      {avatarSaving ? <Loader size={11} className="animate-spin" /> : <Upload size={11} />}
                      Change Photo
                    </label>
                    {resident?.profile_photo_url && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={avatarSaving}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-3 py-2 text-sm font-bold transition disabled:opacity-50"
                      >
                        <Trash2 size={11} className="text-rose-600" />
                        Remove Photo
                      </button>
                    )}
                  </div>
                  {avatarSuccess && <p className="text-sm text-emerald-600 font-bold mt-2.5">{avatarSuccess}</p>}
                  {avatarError && <p className="text-sm text-rose-600 font-bold mt-2.5">{avatarError}</p>}
                </div>

                {/* Identity Summary Card */}
                <div className="flex-1 w-full space-y-6">
                  <div className="border-b pb-3 border-slate-100">
                    <h2 className="text-base font-black uppercase tracking-wider text-[#0B5D3B]">
                      User Profile Overview
                    </h2>
                    <p className="text-sm text-slate-500 font-bold mt-0.5">Your official registry portal identity summary.</p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
                      <p className="text-sm font-black uppercase tracking-wider text-slate-500">Full Name</p>
                      <p className="text-xs font-bold mt-1 text-slate-900">{displayName}</p>
                    </div>

                    <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
                      <p className="text-sm font-black uppercase tracking-wider text-slate-500">Gmail / Email Address</p>
                      <p className="text-xs font-bold mt-1 truncate text-slate-900">{resident?.email || "Not specified"}</p>
                    </div>

                    <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
                      <p className="text-sm font-black uppercase tracking-wider text-slate-500">Mobile / Contact Number</p>
                      <p className="text-xs font-bold mt-1 text-slate-900">{resident?.phone || "Not specified"}</p>
                    </div>

                    <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
                      <p className="text-sm font-black uppercase tracking-wider text-slate-500">Household Number</p>
                      <p className="text-xs font-bold mt-1 text-slate-900">HH #{resident?.household_no || "Not assigned"}</p>
                    </div>
                  </div>

                  <div className="p-4.5 rounded-xl border leading-relaxed flex gap-3 bg-slate-50 border-slate-200 text-slate-600 font-semibold">
                    <Info size={16} className="text-[#0B5D3B] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">Registry Information</p>
                      <p className="text-sm mt-1">To change official demographic details, household relationship status, or Purok, update them in the <strong>Personal Information</strong> section. Official sync is instant.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PERSONAL INFORMATION */}
          {activeNav === "personal_info" && (
            <div className="border border-slate-200 rounded-2xl p-6 shadow-xs animate-fadeIn bg-white text-slate-900">
              <div className="border-b pb-3 mb-6 border-slate-100">
                <h2 className="text-base font-black uppercase tracking-wider text-[#0B5D3B]">
                  Personal Information Registry
                </h2>
                <p className="text-sm text-slate-500 font-bold mt-0.5">Demographic registry synchronized with administrative records.</p>
              </div>

              <form onSubmit={handleProfileUpdate} className="space-y-6">
                
                {/* 1. Personal Details */}
                <div className="space-y-3.5">
                  <h4 className="text-sm font-black uppercase tracking-widest text-[#0B5D3B] border-b border-slate-100 pb-1">Personal Details</h4>
                  <div className="grid gap-4.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
                    <label className="block text-xs font-bold text-slate-700">
                      First Name *
                      <input
                        type="text"
                        value={profileForm.first_name}
                        onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                        required
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Middle Name
                      <input
                        type="text"
                        value={profileForm.middle_name}
                        onChange={(e) => setProfileForm({ ...profileForm, middle_name: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Last Name *
                      <input
                        type="text"
                        value={profileForm.last_name}
                        onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                        required
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Suffix / Extension Name
                      <input
                        type="text"
                        value={profileForm.suffix}
                        onChange={(e) => setProfileForm({ ...profileForm, suffix: e.target.value })}
                        placeholder="e.g. Jr. / III"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Sex / Gender
                      <select
                        value={profileForm.sex}
                        onChange={(e) => setProfileForm({ ...profileForm, sex: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Birth Date *
                      <input
                        type="date"
                        value={profileForm.birthday}
                        onChange={handleBirthdayChange}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                        required
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Age
                      <input
                        type="number"
                        value={profileForm.age}
                        disabled
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-600 outline-none opacity-80"
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Birth Place
                      <input
                        type="text"
                        value={profileForm.birthplace}
                        onChange={(e) => setProfileForm({ ...profileForm, birthplace: e.target.value })}
                        placeholder="City / Municipality"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Civil Status
                      <select
                        value={profileForm.civil_status}
                        onChange={(e) => setProfileForm({ ...profileForm, civil_status: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                      >
                        {civilStatusOptions.map((stat) => (
                          <option key={stat} value={stat}>{stat}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {/* 2. Contact Details */}
                <div className="space-y-3.5">
                  <h4 className="text-sm font-black uppercase tracking-widest text-[#0B5D3B] border-b border-slate-100 pb-1">Contact Info</h4>
                  <div className="grid gap-4.5 grid-cols-1 sm:grid-cols-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Mobile Number (SMS Contact) *
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="09171234567"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                        required
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Email Address (Optional)
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        placeholder="resident@example.com"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                      />
                    </label>
                  </div>
                </div>

                {/* 3. Address Details */}
                <div className="space-y-3.5">
                  <h4 className="text-sm font-black uppercase tracking-widest text-[#0B5D3B] border-b border-slate-100 pb-1">Address Details</h4>
                  <div className="grid gap-4.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
                    <label className="block text-xs font-bold text-slate-700">
                      House Number
                      <input
                        type="text"
                        value={profileForm.house_no}
                        onChange={(e) => setProfileForm({ ...profileForm, house_no: e.target.value })}
                        placeholder="e.g. 104-B"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Purok Name / Area *
                      <select
                        value={profileForm.purok}
                        onChange={(e) => setProfileForm({ ...profileForm, purok: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                        required
                      >
                        <option value="">Select Purok</option>
                        {purokDefinitions.map((item) => (
                          <option key={item.key} value={item.key}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                      Full Address Description *
                      <input
                        type="text"
                        value={profileForm.address}
                        onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                        placeholder="Sitio, street, landmark, or household notes"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                        required
                      />
                    </label>
                  </div>
                </div>

                {/* 4. Household & Socio-Economic */}
                <div className="space-y-3.5">
                  <h4 className="text-sm font-black uppercase tracking-widest text-[#0B5D3B] border-b border-slate-100 pb-1">Household & Socio-Economic Details</h4>
                  <div className="grid gap-4.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
                    <label className="block text-xs font-bold text-slate-700">
                      Household ID Number *
                      <input
                        type="text"
                        value={profileForm.household_no}
                        onChange={(e) => setProfileForm({ ...profileForm, household_no: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                        required
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Relationship to Head *
                      <select
                        value={profileForm.relationship_to_household_head}
                        onChange={(e) => setProfileForm({ ...profileForm, relationship_to_household_head: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                        required
                      >
                        {householdRelationshipOptions.map((rel) => (
                          <option key={rel} value={rel}>{rel === "Head" ? "Household Head" : rel}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Occupation
                      <input
                        type="text"
                        value={profileForm.occupation}
                        onChange={(e) => setProfileForm({ ...profileForm, occupation: e.target.value })}
                        placeholder="e.g. Farmer, Teacher"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                      />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">
                      Educational Attainment
                      <select
                        value={profileForm.educational_attainment}
                        onChange={(e) => setProfileForm({ ...profileForm, educational_attainment: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                      >
                        <option value="">Select Level</option>
                        {educationalAttainmentOptions.map((lvl) => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {/* 5. Special Sector Status */}
                <div className="space-y-3.5">
                  <h4 className="text-sm font-black uppercase tracking-widest text-[#0B5D3B] border-b border-slate-100 pb-1">Sector Classifications</h4>
                  <div className="grid gap-4.5 grid-cols-1 md:grid-cols-3">
                    
                    {/* PWD Card */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profileForm.is_pwd}
                          onChange={(e) => setProfileForm({ ...profileForm, is_pwd: e.target.checked })}
                          className="h-4.5 w-4.5 rounded border-slate-300 text-[#0B5D3B] focus:ring-emerald-500 mt-0.5"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">Person with Disability (PWD)</p>
                          <p className="text-xs text-slate-500 mt-0.5 font-bold">Check if listed as a PWD in municipal records.</p>
                        </div>
                      </label>
                      <AnimatePresence>
                        {profileForm.is_pwd && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="pl-7 pt-1 overflow-hidden"
                          >
                            <label className="text-xs font-black text-[#0B5D3B] uppercase tracking-wider block mb-1">Disability type *</label>
                            <input
                              type="text"
                              value={profileForm.pwd_type}
                              onChange={(e) => setProfileForm({ ...profileForm, pwd_type: e.target.value })}
                              placeholder="e.g. Visually Impaired"
                              required
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] transition"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Solo Parent Card */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={profileForm.is_solo_parent}
                        onChange={(e) => setProfileForm({ ...profileForm, is_solo_parent: e.target.checked })}
                        className="h-4.5 w-4.5 rounded border-slate-300 text-[#0B5D3B] focus:ring-emerald-500 mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">Solo Parent</p>
                        <p className="text-xs text-slate-500 mt-0.5 font-bold">Check if single parent supporting dependents.</p>
                      </div>
                    </div>

                    {/* 4Ps Beneficiary Card */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={profileForm.is_4ps_member}
                        onChange={(e) => setProfileForm({ ...profileForm, is_4ps_member: e.target.checked })}
                        className="h-4.5 w-4.5 rounded border-slate-300 text-[#0B5D3B] focus:ring-emerald-500 mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">4Ps Beneficiary</p>
                        <p className="text-xs text-slate-500 mt-0.5 font-bold">Check if household is registered 4Ps recipient.</p>
                      </div>
                    </div>

                  </div>
                </div>

                {profileMessage && (
                  <div className={`rounded-xl px-4 py-2.5 text-xs font-bold ${
                    profileMessage.type === "success"
                      ? "bg-emerald-50 border border-emerald-250 text-[#0B5D3B] dark:bg-emerald-950/20"
                      : "bg-rose-50 border border-rose-250 text-rose-800 dark:bg-rose-950/20 dark:text-rose-450"
                  }`}>
                    {profileMessage.text}
                  </div>
                )}

                <div className="flex gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0B5D3B] to-[#157347] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:scale-101 transition disabled:opacity-50"
                  >
                    {savingProfile ? <Loader size={12} className="animate-spin" /> : <FileCheck2 size={12} />}
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (resident) {
                        setProfileForm({
                          ...profileForm,
                          first_name: resident.first_name || "",
                          middle_name: resident.middle_name || "",
                          last_name: resident.last_name || "",
                          suffix: resident.suffix || "",
                          sex: resident.sex || resident.gender || "Male",
                          birthday: resident.birthday || "",
                          age: resident.age ?? "",
                          civil_status: resident.civil_status || "Single",
                          birthplace: resident.birthplace || "",
                          phone: resident.phone || "",
                          email: resident.email || "",
                          house_no: resident.house_no || "",
                          purok: resident.purok || "",
                          address: resident.address || "",
                          household_no: resident.household_no || "",
                          relationship_to_household_head: resident.relationship_to_household_head || "Head",
                          occupation: resident.occupation || "",
                          educational_attainment: resident.educational_attainment || "",
                          is_pwd: Boolean(resident.is_pwd),
                          pwd_type: resident.pwd_type || "",
                          is_solo_parent: Boolean(resident.is_solo_parent),
                          is_4ps_member: Boolean(resident.is_4ps_member),
                        });
                      }
                      setProfileMessage(null);
                    }}
                    className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition ${
                      isDarkMode ? "border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-800" : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:bg-slate-950"
                    }`}
                  >
                    Cancel
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* TAB: BARANGAY OFFICIALS */}
          {activeNav === "officials" && (
            <div className="border border-slate-200 rounded-2xl p-6 shadow-xs animate-fadeIn bg-white text-slate-900">
              <div className="border-b pb-3 mb-5 border-slate-100">
                <h2 className="text-base font-black uppercase tracking-wider text-[#14532D]">
                  Barangay Officials & Directory
                </h2>
                <p className="text-xs text-slate-500 font-bold mt-0.5">Meet the barangay council and official representatives of Upper Mingading.</p>
              </div>

              <div className="grid gap-4.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {getOrganizationOfficials().map((off) => {
                  const initials = off.name
                    ? off.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()
                    : "OF";
                  return (
                    <article
                      key={off.id}
                      className="flex gap-4.5 rounded-xl border border-slate-200 bg-white p-4.5 shadow-2xs hover:shadow-md transition duration-200"
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-50 flex items-center justify-center font-bold text-xs border border-slate-200 text-[#14532D]">
                        {off.photoUrl ? (
                          <img src={off.photoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-slate-900">{off.name}</p>
                        <p className="text-xs font-black text-[#14532D] uppercase mt-0.5 tracking-wider">{off.position || "Council Officer"}</p>
                        {off.focusArea && (
                          <p className="text-xs text-slate-500 mt-2 font-semibold truncate leading-tight">{off.focusArea}</p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: SYSTEM SETTINGS */}
          {activeNav === "settings" && (
            <div className="border border-slate-200 rounded-2xl p-6 shadow-xs animate-fadeIn bg-white text-slate-900">
              
              <div className="flex flex-col md:flex-row gap-7">
                {/* Left settings sidebar */}
                <div className="w-full md:w-56 shrink-0 flex flex-col gap-1.5">
                  {[
                    { key: "security", label: "Account & Security", icon: KeyRound, desc: "Change username/password." },
                    { key: "notifications", label: "Alerts & Notifications", icon: Bell, desc: "SMS and update configuration." },
                    { key: "support", label: "Help & Support Info", icon: HelpCircle, desc: "FAQ list and software legal info." }
                  ].map((tabItem) => (
                    <button
                      key={tabItem.key}
                      type="button"
                      onClick={() => setSettingsTab(tabItem.key)}
                      className={`w-full flex items-start text-left gap-3 px-4 py-3 rounded-xl border transition-all ${
                        settingsTab === tabItem.key
                          ? "bg-[#14532D]/10 border-[#14532D]/20 text-[#14532D] font-black"
                          : "border-transparent text-slate-600 hover:bg-slate-50 font-semibold"
                      }`}
                    >
                      <tabItem.icon size={15} className="mt-0.5 shrink-0 text-[#14532D]" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-none">{tabItem.label}</p>
                        <p className="text-xs text-slate-500 font-medium mt-1 leading-normal">{tabItem.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Right settings content */}
                <div className="flex-1 w-full min-w-0">
                  
                  {/* SUBTAB 1: ACCOUNT SECURITY */}
                  {settingsTab === "security" && (
                    <div className="space-y-6">
                      <div className="border-b pb-2 mb-4 border-slate-100">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Account & Security Settings</h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-bold">Manage authentication settings and login credentials.</p>
                      </div>

                      <div className="grid gap-5 md:grid-cols-2">
                        {/* Current Credentials overview */}
                        <div className="p-4.5 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                          <p className="text-xs font-black uppercase tracking-widest text-[#14532D]">Login Registry File</p>
                          <div>
                            <p className="text-xs font-black text-slate-900">{displayName}</p>
                            <p className="text-xs text-slate-600 mt-1 font-semibold">Username ID: <span className="font-bold font-mono text-slate-900">{residentUsername}</span></p>
                          </div>
                          <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-[#14532D]">
                            Synchronized Account Registry
                          </span>
                        </div>

                        {/* Change Password Form */}
                        <div className="p-4.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-4">
                          <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#14532D]/10 text-[#14532D]">
                              <KeyRound size={14} />
                            </span>
                            <div>
                              <p className="text-xs font-bold text-slate-900">Change Household Password</p>
                              <p className="text-xs text-slate-500 mt-0.5 font-bold font-mono">Updated passwords apply instantly.</p>
                            </div>
                          </div>

                          <form onSubmit={handlePasswordUpdate} className="space-y-3.5">
                            {/* Current Password Field with Eye Toggle */}
                            <div className="space-y-1">
                              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">Current Password *</label>
                              <div className="relative">
                                <input
                                  type={showCurrentPassword ? "text" : "password"}
                                  value={passwordForm.currentPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none pr-10 focus:border-[#14532D] focus:bg-white transition"
                                  placeholder="••••••••"
                                  required
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center text-slate-400 hover:text-slate-700 transition"
                                  aria-label="Toggle password view"
                                >
                                  {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </div>

                            {/* New Password Field with Eye Toggle */}
                            <div className="space-y-1">
                              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">New Password *</label>
                              <div className="relative">
                                <input
                                  type={showNewPassword ? "text" : "password"}
                                  value={passwordForm.newPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none pr-10 focus:border-[#14532D] focus:bg-white transition"
                                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                                  required
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center text-slate-400 hover:text-slate-700 transition"
                                  aria-label="Toggle password view"
                                >
                                  {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </div>

                            {/* Confirm New Password Field with Eye Toggle */}
                            <div className="space-y-1">
                              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">Confirm New Password *</label>
                              <div className="relative">
                                <input
                                  type={showConfirmNewPassword ? "text" : "password"}
                                  value={passwordForm.confirmPassword}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none pr-10 focus:border-[#14532D] focus:bg-white transition"
                                  placeholder="••••••••"
                                  required
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center text-slate-400 hover:text-slate-700 transition"
                                  aria-label="Toggle password view"
                                >
                                  {showConfirmNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </div>

                            {passwordMessage && (
                              <div className={`rounded-xl px-4 py-2.5 text-xs font-bold ${
                                passwordMessage.type === "success"
                                  ? "bg-emerald-50 border border-emerald-200 text-[#14532D]"
                                  : "bg-rose-50 border border-rose-200 text-rose-800"
                              }`}>
                                {passwordMessage.text}
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={savingPassword}
                              className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#14532D] to-[#0F4324] px-4 py-2.5 text-xs font-bold text-white shadow-xs border border-white/10 disabled:opacity-50 hover:scale-101 transition cursor-pointer"
                            >
                              {savingPassword ? <Loader size={12} className="animate-spin" /> : <KeyRound size={12} />}
                              Change Password
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 2: NOTIFICATIONS */}
                  {settingsTab === "notifications" && (
                    <div className="space-y-6">
                      <div className="border-b pb-2 mb-4 border-slate-100">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Alerts & Notifications</h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-bold">Configure announcement SMS triggers and document queue update alerts.</p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 rounded-xl border border-slate-200 bg-slate-50">
                          <div>
                            <p className="text-xs font-bold text-slate-900">SMS Text Notifications</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">Receive immediate SMS notifications when clearances are approved/released.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSmsToggle(!smsNotificationsEnabled)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              smsNotificationsEnabled ? "bg-[#14532D]" : "bg-slate-300"
                            }`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              smsNotificationsEnabled ? "translate-x-5" : "translate-x-0"
                            }`} />
                          </button>
                        </div>

                        <div className="flex justify-between items-center p-4 rounded-xl border border-slate-200 bg-slate-50">
                          <div>
                            <p className="text-xs font-bold text-slate-900">Council Announcement Broadcasts</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">Send emergency municipal announcement SMS texts to your mobile phone number.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAnnouncementToggle(!announcementSmsAlerts)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              announcementSmsAlerts ? "bg-[#14532D]" : "bg-slate-300"
                            }`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              announcementSmsAlerts ? "translate-x-5" : "translate-x-0"
                            }`} />
                          </button>
                        </div>

                        <div className="flex justify-between items-center p-4 rounded-xl border border-slate-200 bg-slate-50">
                          <div className="flex-1 pr-4">
                            <p className="text-xs font-bold text-slate-900">Browser Push Notifications</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                              Show floating desktop and mobile push alerts for announcements. Current status: <span className="font-extrabold uppercase text-[#14532D]">{typeof window !== "undefined" && "Notification" in window ? Notification.permission : "Not Supported"}</span>
                            </p>
                            {typeof window !== "undefined" && "Notification" in window && Notification.permission === "denied" && (
                              <span className="block text-[11px] text-rose-500 mt-1.5 font-bold">
                                ⚠️ Permission is blocked. Please click the lock icon next to the browser website address URL and change "Notification" settings to "Allow".
                              </span>
                            )}
                          </div>
                          {typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted" && (
                            <button
                              type="button"
                              onClick={async () => {
                                await Notification.requestPermission();
                                window.location.reload();
                              }}
                              className="px-3.5 py-2 text-xs font-black rounded-lg bg-[#14532D] text-white transition active:scale-95 shadow-sm"
                            >
                              Request Access
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 3: HELP & SUPPORT */}
                  {settingsTab === "support" && (
                    <div className="space-y-6">
                      <div className="border-b pb-2 mb-4 border-slate-100">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Help & Support Center</h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-bold">Frequently asked questions, software documentation, and support contacts.</p>
                      </div>

                      {/* Collapsible FAQ accordion */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3.5 text-slate-700">
                        <div className="flex items-center gap-2 border-b pb-2 border-slate-200">
                          <HelpCircle size={14} className="text-[#14532D]" />
                          <p className="text-xs font-bold text-slate-900">Common FAQ Guide</p>
                        </div>
                        <div className="space-y-3 text-xs">
                          <div>
                            <p className="font-bold text-slate-900">How do I request a Barangay clearance certificate?</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">Navigate to the **Request Documents** tab in the sidebar, choose a clearance template, and click submit. You can track requests directly on the dashboard timeline.</p>
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">How does direct synchronization work?</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">Changes saved in the Personal Information form write directly to the database and are synchronized instantly with the Admin Dashboard.</p>
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">Can I request clearances without a household password?</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">No. To maintain security validation, you must confirm your household password when saving profile information or credentials changes.</p>
                          </div>
                        </div>
                      </div>

                      {/* Technical support card */}
                      <div className="p-4.5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-900">Contact Barangay Technical Support</p>
                          <p className="text-xs text-slate-500 font-medium">Having system account or credentials issues? We can help.</p>
                        </div>
                        <a
                          href="mailto:support@barangaymingading.gov"
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#14532D] text-white px-3.5 py-2 text-xs font-bold hover:scale-101 transition shadow-xs shrink-0"
                        >
                          Email Support
                        </a>
                      </div>

                      {/* System and Policy info */}
                      <div className="flex justify-between items-center text-xs text-slate-400 uppercase tracking-widest font-bold">
                        <span>KaagapAI v1.2.0 • Active Server</span>
                        <div className="flex gap-2">
                          <span className="cursor-pointer hover:text-slate-600 transition">Privacy Policy</span>
                          <span>•</span>
                          <span className="cursor-pointer hover:text-slate-600 transition">Terms of Service</span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>
          )}

      {/* 6. PASSWORD CONFIRMATION MODAL */}
      <AnimatePresence>
        {passwordConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setPasswordConfirmOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl z-10 animate-fadeIn text-slate-900"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[#14532D]">
                  <Shield size={16} />
                </span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Authorize Registry Update</h3>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">Authorization credentials verify safety.</p>
                </div>
              </div>

              <form onSubmit={handleProfileUpdateConfirm} className="space-y-4">
                <p className="text-xs leading-relaxed font-medium text-slate-600">
                  To finalize and synchronize your registry profile updates with our barangay database, please verify your current household password.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">Household Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none pr-10 focus:border-[#14532D] focus:bg-white transition"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center text-slate-400 hover:text-slate-700 transition"
                      aria-label="Toggle password view"
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {confirmPasswordError && (
                  <div className="rounded-xl px-4 py-2 text-xs font-bold bg-rose-50 border border-rose-200 text-rose-800">
                    {confirmPasswordError}
                  </div>
                )}

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#14532D] to-[#0F4324] py-2.5 text-xs font-bold text-white shadow-xs disabled:opacity-50 hover:scale-101 transition"
                  >
                    {savingProfile ? <Loader size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                    Confirm & Update
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasswordConfirmOpen(false)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-bold text-xs hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        </div>
      </main>

      {/* 5. Meta AI Style Alternating Pill Chatbot FAB Button */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-[9950]">
        <div className="relative">
          {!assistantOpen && !chatFabExpanded && (
            <span 
              className="absolute -inset-1 rounded-full border border-[#C8A14A] bg-[#C8A14A]/20 animate-ping pointer-events-none" 
              style={{ animationDuration: "2.8s" }} 
            />
          )}

          {/* Main Floating Button / Pill Container */}
          <motion.button
            type="button"
            onClick={() => setAssistantOpen(!assistantOpen)}
            layout
            initial={{ borderRadius: 9999 }}
            animate={{ borderRadius: 9999 }}
            transition={{ layout: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }}
            className="flex items-center gap-2 bg-gradient-to-br from-[#14532D] via-[#0E6B46] to-[#0a2916] text-white shadow-2xl border-2 border-[#C8A14A] p-1.5 cursor-pointer overflow-hidden backdrop-blur-md hover:shadow-[0_8px_30px_rgba(200,161,74,0.45)] transition-all shrink-0"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="KaagapAI Virtual Assistant"
          >
            {assistantOpen ? (
              <div className="flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-rose-700/90 text-white shrink-0 shadow-xs">
                <X size={22} />
              </div>
            ) : (
              <>
                {/* Barangay Seal Logo Icon */}
                <div className="h-11 w-11 sm:h-13 sm:w-13 rounded-full bg-white p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-inner ring-2 ring-emerald-900/30">
                  <img
                    src="/logo.png"
                    alt="Barangay Seal"
                    className="h-full w-full object-contain rounded-full shrink-0"
                    onError={(e) => {
                      e.target.src = "https://placehold.co/100x100/14532d/ffffff?text=Brgy";
                    }}
                  />
                </div>

                {/* 5-Second Alternating Meta AI "Ask KaagapAI" Pill Label */}
                <AnimatePresence mode="wait">
                  {chatFabExpanded && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden whitespace-nowrap pr-3 pl-0.5"
                    >
                      <span className="text-xs sm:text-sm font-black tracking-wide text-white flex items-center gap-1.5">
                        Ask KaagapAI
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Floating AI Assistant Window (Sleek Floating Card Widget) */}
      <AnimatePresence>
        {assistantOpen && (
          <div className="fixed inset-0 z-[9995] flex items-end justify-end p-2 sm:p-5 pb-20 sm:pb-5 pointer-events-none">
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs pointer-events-auto"
              onClick={() => setAssistantOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            {/* Floating Chat Container */}
            <motion.div
              className="relative z-10 flex h-[85vh] max-h-[720px] w-full sm:w-[430px] flex-col overflow-hidden rounded-3xl border border-emerald-500/30 bg-[#042015]/95 shadow-2xl backdrop-blur-2xl pointer-events-auto ring-1 ring-emerald-500/20"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex h-14 shrink-0 items-center justify-between bg-gradient-to-r from-[#0B5D3B] via-[#0E6B46] to-[#157347] px-3 text-white relative shadow-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  {/* Recents Navigation Menu Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setChatNavOpen(!chatNavOpen)}
                    className="p-1.5 rounded-xl hover:bg-white/15 text-emerald-100 hover:text-white transition flex items-center gap-1"
                    title="Open Recent Chats Navigation"
                  >
                    <Menu size={18} />
                    <div className="h-7 w-7 overflow-hidden rounded-full border border-white/20 bg-emerald-950/40 shrink-0 flex items-center justify-center">
                      <AssistantAiIcon />
                    </div>
                  </button>

                  <div className="min-w-0 cursor-pointer" onClick={() => setChatNavOpen(!chatNavOpen)}>
                    <h3 className="text-sm font-black leading-none truncate flex items-center gap-1">
                      KaagapAI
                      <span className="text-[10px] font-bold bg-white/20 px-1.5 py-0.2 rounded-full text-emerald-100">AI</span>
                    </h3>
                    <span className="text-[11px] text-emerald-200 mt-0.5 block truncate">Upper Mingading Virtual Assistant</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Voice Assistant Audio Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (voiceEnabled) {
                        stopAssistantSpeech();
                        setVoiceEnabled(false);
                      } else {
                        setVoiceEnabled(true);
                      }
                    }}
                    className={`flex items-center justify-center p-1.5 rounded-xl text-xs font-bold transition border border-white/10 active:scale-95 ${
                      voiceEnabled
                        ? "bg-emerald-500/30 text-white border-emerald-400/40"
                        : "bg-white/10 text-white/60 hover:text-white"
                    }`}
                    title={voiceEnabled ? "Voice Assistant Enabled (Click to Mute Voice)" : "Voice Assistant Muted (Click to Enable Voice)"}
                  >
                    {voiceEnabled ? <Volume2 size={16} className="text-emerald-300 animate-pulse" /> : <VolumeX size={16} />}
                  </button>

                  {/* New Chat Button */}
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition shadow-2xs border border-white/10 active:scale-95"
                    title="Start New Clean Chat"
                  >
                    <Plus size={14} />
                    <span className="hidden sm:inline">New Chat</span>
                  </button>

                  {/* Close Drawer Button */}
                  <button
                    type="button"
                    onClick={() => setAssistantOpen(false)}
                    className="rounded-xl p-1.5 text-emerald-100 hover:bg-white/10 hover:text-white transition"
                    aria-label="Close assistant"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Slide-out Recents Navigation Bar Sidebar (ChatGPT Style) */}
              <AnimatePresence>
                {chatNavOpen && (
                  <motion.div
                    initial={{ x: "-100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "-100%", opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                    className="absolute inset-0 z-30 bg-slate-900/95 text-white backdrop-blur-md flex flex-col p-4 border-r border-slate-800"
                  >
                    {/* Recents Nav Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <History size={18} className="text-emerald-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">Recent Chats</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setChatNavOpen(false)}
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* New Chat Action in Nav */}
                    <div className="py-3">
                      <button
                        type="button"
                        onClick={handleNewChat}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#0B5D3B] to-[#157347] text-white text-xs font-bold shadow-md hover:scale-101 transition border border-white/10"
                      >
                        <Plus size={15} />
                        <span>Start New Clean Chat</span>
                      </button>
                    </div>

                    {/* List of Recent Sessions */}
                    <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1 scrollbar-hide">
                      {chatSessions.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center text-slate-500 text-xs font-semibold px-4 space-y-2">
                          <Clock size={24} className="text-slate-600" />
                          <p>No recent chat history yet.</p>
                          <p className="text-[11px] text-slate-600">Start a conversation and it will automatically appear here!</p>
                        </div>
                      ) : (
                        chatSessions.map((session) => {
                          const isActive = session.id === currentSessionId;
                          return (
                            <div
                              key={session.id}
                              onClick={() => handleSelectSession(session)}
                              className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
                                isActive
                                  ? "bg-emerald-600/20 border border-emerald-500/40 text-emerald-300"
                                  : "hover:bg-slate-800/80 text-slate-300 hover:text-white"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <MessageSquare size={14} className={isActive ? "text-emerald-400 shrink-0" : "text-slate-500 shrink-0 group-hover:text-slate-300"} />
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold leading-snug">{session.title || "Chat session"}</p>
                                  <span className="text-[10px] text-slate-500 block">{new Date(session.updatedAt || session.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => handleDeleteSession(session.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 transition"
                                title="Delete chat"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer in Recents Nav */}
                    {chatSessions.length > 0 && (
                      <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium text-[11px]">{chatSessions.length} saved thread(s)</span>
                        <button
                          type="button"
                          onClick={handleClearAllRecents}
                          className="text-[11px] text-rose-400 hover:text-rose-300 font-bold hover:underline"
                        >
                          Clear all recents
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chat messages & Vertical Suggested Questions */}
              <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-[#042015] via-[#062e1e] to-[#041a11]">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {assistantMessages.length === 0 && (
                    <div className="space-y-4 py-2">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#14532D] text-white shadow-sm mb-2">
                          <Bot size={22} />
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-100">
                          Magandang araw! Ako si KaagapAI
                        </h4>
                        <p className="mt-1 text-xs text-slate-400">
                          Ang iyong Upper Mingading Virtual Assistant. Piliin ang alinman sa mga madalas itanong sa ibaba o mag-type ng katanungan:
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-1">
                          <Sparkles size={13} className="text-emerald-400" />
                          Suggested Questions / Mga Madalas Itanong:
                        </p>
                        <div className="flex flex-col gap-2">
                          {[
                            { text: "Paano kumuha ng Clearance?", icon: FileText },
                            { text: "Magkano ang bayad sa Residency?", icon: CreditCard },
                            { text: "Sino ang Barangay Kapitan?", icon: UserCheck },
                            { text: "Anong oras bukas ang Barangay Hall?", icon: Clock },
                            { text: "May livelihood programs ba?", icon: Briefcase },
                            { text: "Paano mag-reklamo ng maingay?", icon: Megaphone },
                            { text: "Where is the evacuation center?", icon: Shield },
                            { text: "Can I change my password?", icon: KeyRound },
                            { text: "Who approves my account?", icon: UserCheck },
                          ].map((item) => (
                            <button
                              key={item.text}
                              type="button"
                              onClick={() => handlePrompt(item.text)}
                              className="group flex items-center justify-between w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 px-3 text-left text-xs font-bold text-slate-200 transition hover:bg-[#14532D] hover:text-white hover:border-[#14532D] shadow-2xs active:scale-[0.98]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#14532D]/30 group-hover:bg-white/20 text-emerald-300 group-hover:text-white transition">
                                  <item.icon size={14} />
                                </div>
                                <span className="truncate">{item.text}</span>
                              </div>
                              <ChevronRight size={14} className="shrink-0 text-slate-500 group-hover:text-white transition ml-1" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {assistantMessages.map((chat) => {
                    const isUser = chat.role === "user";
                    return (
                      <motion.div
                        key={chat.id}
                        initial={{ opacity: 0, y: 12, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        {!isUser && (
                          <div className="h-7 w-7 overflow-hidden rounded-full shrink-0 border border-emerald-500/40 bg-[#062c1e] shadow-sm flex items-center justify-center">
                            <AssistantAiIcon />
                          </div>
                        )}
                        <div
                          className={`group relative max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed font-semibold shadow-xl transition-all ${
                            isUser
                              ? "bg-emerald-600/30 backdrop-blur-lg border border-emerald-400/40 text-white rounded-br-none shadow-emerald-950/20"
                              : "bg-white/10 backdrop-blur-xl border border-white/20 text-emerald-50 rounded-bl-none shadow-black/20 hover:bg-white/15"
                          }`}
                        >
                          {isUser ? (
                            <p className="whitespace-pre-line leading-relaxed font-medium">{chat.text}</p>
                          ) : (
                            <div>
                              <RenderChatChart text={chat.text} />
                              <button
                                type="button"
                                onClick={() => speakAssistantText(chat.text)}
                                className="mt-2 inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-300/80 hover:text-emerald-100 bg-emerald-950/50 hover:bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-500/20 transition active:scale-95"
                                title="Listen to AI voice reply"
                              >
                                <Volume2 size={11} className="text-emerald-400" />
                                <span>Listen Voice</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}

                  {assistantLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-end gap-2"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        className="h-6 w-6 overflow-hidden rounded-full shrink-0 border border-emerald-700 ring-2 ring-emerald-500/20"
                      >
                        <AssistantAiIcon />
                      </motion.div>
                      <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-none border border-emerald-900/30 bg-emerald-900/20 px-4 py-2.5 shadow-sm">
                        <span className="text-xs font-bold text-emerald-400">KaagapAI is thinking</span>
                        <TypingIndicator className="text-emerald-400" />
                      </div>
                    </motion.div>
                  )}
                  <div ref={assistantMessagesEndRef} />
                </div>

                {/* Input form */}
                <form onSubmit={handleAssistantSubmit} className="flex h-14 items-center gap-2 border-t border-slate-800 bg-slate-900 px-3 shrink-0">
                  <input
                    value={assistantInput}
                    onChange={(e) => setAssistantInput(e.target.value)}
                    placeholder="Ask KaagapAI..."
                    className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs outline-none focus:border-emerald-500 focus:bg-slate-900 font-semibold text-slate-100 placeholder-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={assistantLoading || !assistantInput.trim()}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#0B5D3B] to-[#157347] text-white shadow-xs disabled:opacity-50 hover:scale-101 transition"
                  >
                    <Send size={13} />
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Document Request Modal */}
      <FloatingModal
        open={documentModalOpen}
        onClose={() => setDocumentModalOpen(false)}
        title="Apply for Document Clearance"
        eyebrow="Application Desk"
        maxWidth="max-w-md"
      >
        {renderDocumentRequestForm()}
      </FloatingModal>

      {/* 7. Livelihood Opportunities Application Wizard */}
      <FloatingModal
        open={!!selectedOppForApplication}
        onClose={() => setSelectedOppForApplication(null)}
        title={selectedOppForApplication?.title || "Application Wizard"}
        eyebrow="Application Wizard"
        maxWidth="max-w-md"
      >
        {selectedOppForApplication && (
          <div>
            <div className="px-1 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Step {jobAppStep} of 4</span>
              <span className="text-[#14532D] dark:text-emerald-400 uppercase font-black">
                {jobAppStep === 1 && "Personal details"}
                {jobAppStep === 2 && "Profile qualifications"}
                {jobAppStep === 3 && "Resume attachment"}
                {jobAppStep === 4 && "Review details"}
              </span>
            </div>

            <form onSubmit={handleJobAppSubmit} className="pt-4 space-y-4">
              {jobAppSuccess ? (
                <div className="py-6 text-center space-y-3 animate-fadeIn">
                  <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950 text-[#14532D] dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner border border-emerald-100 dark:border-emerald-900">
                    <CheckCircle size={26} />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Application Submitted!</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                    Your application has been received and synchronized successfully with the council organizers.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedOppForApplication(null)}
                    className="py-2.5 px-6 rounded-xl bg-[#14532D] hover:bg-[#0f3e21] text-white font-bold text-xs transition shadow-md mt-3 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {jobAppError && (
                    <div className="flex gap-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl animate-fadeIn">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <span>{jobAppError}</span>
                    </div>
                  )}

                  <div className="min-h-[160px]">
                    {jobAppStep === 1 && (
                      <div className="space-y-2 text-xs">
                        <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs">Pre-filled Resident Registry</p>
                        <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs font-semibold text-slate-700 dark:text-slate-300">
                          <div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase block font-extrabold">Full Name</span>
                            <span className="text-slate-900 dark:text-slate-100 font-bold">{displayName}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase block font-extrabold">Purok Area</span>
                            <span className="text-slate-900 dark:text-slate-100 font-bold">{resident?.purok || "Upper Mingading"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase block font-extrabold">Age</span>
                            <span className="text-slate-900 dark:text-slate-100 font-bold">{resident?.age || "Not specified"} yrs</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase block font-extrabold">Phone Contact</span>
                            <span className="text-slate-900 dark:text-slate-100 font-bold">{resident?.phone || "-"}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {jobAppStep === 2 && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block">Highest Education</label>
                          <input
                            type="text"
                            value={jobAppForm.education}
                            onChange={(e) => setJobAppForm({ ...jobAppForm, education: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-[#14532D] text-slate-900 dark:text-slate-100"
                            placeholder="e.g. College Graduate"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block">Skills *</label>
                          <input
                            type="text"
                            value={jobAppForm.skills}
                            onChange={(e) => setJobAppForm({ ...jobAppForm, skills: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-[#14532D] text-slate-900 dark:text-slate-100"
                            placeholder="e.g. Encoding, Clerical work"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block">Work Experience (Optional)</label>
                          <input
                            type="text"
                            value={jobAppForm.experience}
                            onChange={(e) => setJobAppForm({ ...jobAppForm, experience: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-[#14532D] text-slate-900 dark:text-slate-100"
                            placeholder="Describe previous job..."
                          />
                        </div>
                      </div>
                    )}

                    {jobAppStep === 3 && (
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block">Upload Resume / CV File *</label>
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 p-5 text-center hover:bg-emerald-50/20 hover:border-[#14532D] transition cursor-pointer relative shadow-xs">
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,image/*"
                            onChange={(e) => setJobAppResume(e.target.files?.[0])}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          {jobAppResume ? (
                            <div className="flex flex-col items-center text-xs font-bold text-[#14532D] dark:text-emerald-400">
                              <FileCheck2 size={24} className="mb-1" />
                              <span className="truncate max-w-[200px]">{jobAppResume.name}</span>
                              <span className="text-[10px] text-slate-500 mt-0.5">{(jobAppResume.size / 1024 / 1024).toFixed(2)} MB • Replace</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center text-slate-500 font-semibold">
                              <Upload size={20} className="mb-1 text-slate-400" />
                              <span className="text-xs">Select PDF or Word Document</span>
                              <span className="text-[10px] text-slate-400 mt-0.5">Max 5MB</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {jobAppStep === 4 && (
                      <div className="space-y-3 text-xs leading-normal">
                        <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs border-b border-slate-100 dark:border-slate-800 pb-1">Review details</p>
                        <div className="space-y-2 bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                          <div className="flex justify-between">
                            <span className="text-slate-500 uppercase text-[10px]">Applicant</span>
                            <span className="text-slate-900 dark:text-slate-100 font-bold">{displayName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 uppercase text-[10px]">Opportunity</span>
                            <span className="text-[#14532D] dark:text-emerald-400 font-bold">{selectedOppForApplication.title}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 uppercase text-[10px]">Education</span>
                            <span className="text-slate-900 dark:text-slate-100">{jobAppForm.education || "None"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 uppercase text-[10px]">Skills</span>
                            <span className="text-slate-900 dark:text-slate-100">{jobAppForm.skills}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 uppercase text-[10px]">Attachment</span>
                            <span className="text-slate-900 dark:text-slate-100 truncate max-w-[160px]">{jobAppResume?.name}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-3.5 mt-4">
                    {jobAppStep > 1 && (
                      <button
                        type="button"
                        onClick={() => setJobAppStep(jobAppStep - 1)}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition cursor-pointer"
                      >
                        Back
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={jobAppLoading}
                      className="flex-1 flex justify-center items-center gap-1.5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#0f3e21] text-white font-bold text-xs transition shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {jobAppLoading ? (
                        <Loader size={14} className="animate-spin text-white" />
                      ) : jobAppStep === 4 ? (
                        <CheckCircle size={14} className="text-white" />
                      ) : (
                        <ChevronRight size={14} className="text-white" />
                      )}
                      <span className="text-white font-bold">{jobAppLoading ? "Submitting..." : jobAppStep === 4 ? "Submit Details" : "Continue"}</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        )}
      </FloatingModal>


      {/* FLOATING TOAST NOTIFICATION (BOTTOM-RIGHT) */}
      <AnimatePresence>
        {(latestAnnouncementToast || latestNotificationToast) && (
          <motion.div
            initial={{ opacity: 0, x: 200 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 200 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-4 right-4 z-50 w-full max-w-sm flex flex-col gap-3"
          >
            {latestAnnouncementToast && (
              <div className="p-4 rounded-2xl border border-slate-800 shadow-2xl bg-slate-950/90 backdrop-blur-md text-white flex items-start gap-3 relative overflow-hidden transition-all duration-300">
                {/* Visual Accent Bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#C8A14A]" />
                
                {/* App Logo Circular Indicator */}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#14532D] border border-[#C8A14A]/40 text-white shadow-inner">
                  <Megaphone size={18} className="text-[#C8A14A] animate-pulse" />
                </span>

                <div className="min-w-0 flex-1 space-y-1 pl-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wider text-[#C8A14A] uppercase">KaagapA.I</p>
                    <span className="text-[10px] text-slate-400 font-medium">Just Now</span>
                  </div>
                  
                  <div className="pt-0.5" onClick={viewAnnouncementFromToast} style={{ cursor: "pointer" }}>
                    <p className="text-sm font-extrabold text-white truncate leading-tight">
                      {latestAnnouncementToast.title}
                    </p>
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mt-1">
                      {latestAnnouncementToast.body}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={viewAnnouncementFromToast}
                      className="px-3.5 py-1.5 text-xs font-black rounded-lg bg-[#14532D] hover:bg-[#14532D]/90 text-white border border-[#C8A14A]/20 transition active:scale-95 shadow-sm"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (resident?.id) {
                          localStorage.setItem(`kaagapai_last_viewed_announcement_id_${resident.id}`, String(latestAnnouncementToast.id));
                        }
                        setLatestAnnouncementToast(null);
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-slate-200 transition"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (resident?.id) {
                        localStorage.setItem(`kaagapai_last_viewed_announcement_id_${resident.id}`, String(latestAnnouncementToast.id));
                      }
                      setLatestAnnouncementToast(null);
                    }}
                    className="rounded-full p-1 hover:bg-white/10 text-slate-400 hover:text-white transition"
                    aria-label="Close notification"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
            
            {latestNotificationToast && (
              <div className="p-4 rounded-2xl border shadow-xl portal-theme-glass text-slate-800 dark:text-white flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Bell size={16} className="animate-bounce" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black uppercase tracking-wider text-[#0B5D3B] dark:text-emerald-400">🔔 New Notification</p>
                    <span className="text-sm text-slate-400 font-bold">Just Now</span>
                  </div>
                  <p className="text-xs font-black truncate">{latestNotificationToast.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-450 line-clamp-2 leading-normal font-bold">
                    {latestNotificationToast.body}
                  </p>
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={viewNotificationFromToast}
                      className="px-3.5 py-1.5 text-sm font-black rounded-lg bg-[#0B5D3B] hover:bg-[#0B5D3B]/90 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white transition active:scale-95"
                    >
                      View Update
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (resident?.id) {
                          localStorage.setItem(`kaagapai_last_viewed_notification_id_${resident.id}`, String(latestNotificationToast.id));
                        }
                        setLatestNotificationToast(null);
                      }}
                      className="text-sm font-bold text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 transition"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (resident?.id) {
                      localStorage.setItem(`kaagapai_last_viewed_notification_id_${resident.id}`, String(latestNotificationToast.id));
                    }
                    setLatestNotificationToast(null);
                  }}
                  className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 transition shrink-0"
                  aria-label="Close notification"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Pending Document Request Modal */}
      <AnimatePresence>
        {editingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setEditingRequest(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 z-10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Pencil size={18} className="text-[#0B5D3B]" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    Edit Document Request
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRequest(null)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveEditRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    Select New Document Type
                  </label>
                  <select
                    value={editDocumentType}
                    onChange={(e) => setEditDocumentType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-[#0B5D3B] text-slate-900 dark:text-white transition"
                    required
                  >
                    <option value="">Choose Document Template</option>
                    {documentTemplates.map((t) => {
                      const label = t.template_name || t.document_type;
                      return (
                        <option key={t.id || label} value={label}>
                          {label} {t.fee ? `(${t.fee})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    Purpose of Request
                  </label>
                  <textarea
                    value={editDocumentPurpose}
                    onChange={(e) => setEditDocumentPurpose(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-[#0B5D3B] text-slate-900 dark:text-white transition"
                    placeholder="Specify purpose (e.g. Job Application, Scholarship, Local Travel, etc.)"
                    rows={2}
                    required
                  />
                </div>

                <p className="text-[11px] text-slate-500 font-medium">
                  Updating your request will automatically notify the system and update your record for the Secretary.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingRequest(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingRequest || !editDocumentType || !editDocumentPurpose.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0B5D3B] to-[#157347] text-white text-xs font-bold shadow-xs hover:scale-101 transition disabled:opacity-50"
                  >
                    {updatingRequest ? <Loader size={12} className="animate-spin" /> : null}
                    Save Updates
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Announcement Detail Modal */}
      {selectedAnnouncementModal && (
        <FloatingModal
          open={Boolean(selectedAnnouncementModal)}
          onClose={() => setSelectedAnnouncementModal(null)}
          title={selectedAnnouncementModal.title || "Barangay Announcement"}
          eyebrow="BARANGAY OFFICIAL ADVISORY"
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-slate-800 dark:text-slate-100">
            <div className="flex justify-between items-center flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full border ${
                String(selectedAnnouncementModal.category || "").toLowerCase().includes("emergency")
                  ? "bg-rose-600/90 text-white border-rose-400"
                  : "bg-emerald-500/20 text-[#14532D] dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
              }`}>
                {selectedAnnouncementModal.category || "General Announcement"}
              </span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-400">
                Published: {new Date(selectedAnnouncementModal.publish_date || selectedAnnouncementModal.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                {selectedAnnouncementModal.title}
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-line">
                {selectedAnnouncementModal.body}
              </p>
            </div>

            {selectedAnnouncementModal.audience && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                <p className="font-bold text-slate-500 dark:text-slate-400">Target Audience / Coverage:</p>
                <p className="font-black text-[#14532D] dark:text-emerald-400">{selectedAnnouncementModal.audience}</p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedAnnouncementModal(null);
                  openModule("announcements");
                }}
                className="px-4 py-2 text-xs font-black rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              >
                View All Bulletins
              </button>
              <button
                type="button"
                onClick={() => setSelectedAnnouncementModal(null)}
                className="px-4 py-2 text-xs font-black rounded-xl bg-[#14532D] hover:bg-[#0f3e21] text-white transition active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </FloatingModal>
      )}

      <SettingsDrawer isOpen={isSettingsDrawerOpen} onClose={() => setIsSettingsDrawerOpen(false)} />

      {/* Fixed Mobile Bottom Navigation Bar (Matching User Design - Image 1) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[9900] bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] px-1 py-1.5 flex items-center justify-around">
        {[
          { key: "dashboard", label: "Dashboard", icon: Home },
          { key: "documents", label: "Document Request", icon: FileText },
          { key: "livelihood", label: "Livelihoods & Jobs", icon: Briefcase },
          { key: "announcements", label: "Announcements", icon: Megaphone },
          { key: "my_documents", label: "Document Logs", icon: FileCheck2 },
          { key: "officials", label: "Officials", icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeNav === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => openModule(tab.key)}
              className={`relative flex flex-col items-center justify-center py-1 px-1 flex-1 min-w-0 transition-all duration-200 cursor-pointer ${
                isActive ? "text-[#0B6635]" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {isActive && (
                <span className="absolute -top-1.5 h-1 w-8 rounded-b-full bg-[#0B6635] shadow-xs" />
              )}
              <Icon size={19} className={`shrink-0 mb-0.5 transition-transform ${isActive ? "text-[#0B6635] scale-110" : "text-slate-500"}`} />
              <span className={`text-[9.5px] truncate font-black leading-tight max-w-full ${isActive ? "text-[#0B6635]" : "text-slate-500"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default UserDashboard;