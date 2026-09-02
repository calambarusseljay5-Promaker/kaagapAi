import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
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
  ArrowLeft,
  Bell,
  Bot,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Crown,
  FileCheck2,
  FileText,
  HelpCircle,
  Home,
  LayoutDashboard,
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
  Phone,
  Mail,
  TrendingUp,
  FileSpreadsheet,
  Info,
  CheckCircle,
  CheckCircle2,
  CheckCheck,
  BellOff,
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
  VolumeX,
  PieChart as PieChartIcon,
  BarChart3
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUserWithProfile, logoutUser, uploadProfilePhoto } from "../services/authService";
import { getResidentById } from "../services/adminService";
import { fetchPublishedAnnouncements } from "../services/announcementService";
import {
  cancelDocumentRequest,
  createDocumentRequest,
  deleteDocumentRequest,
  deleteDocumentRequests,
  fetchDocumentRequests,
  fetchDocumentTemplates,
  fetchResidentNotifications,
  getResidentDocumentRequests,
  markResidentNotificationRead,
  markAllResidentNotificationsRead,
  deleteResidentNotification,
  clearAllResidentNotifications,
  updateDocumentRequestType,
} from "../services/documentRequestService";
import { fetchLivelihoodPosts, applyForLivelihood, fetchResidentLivelihoodApplications } from "../services/livelihoodService";
import { fetchResidentKnowledge } from "../services/knowledgeService";
import { askResidentAssistant } from "../services/residentAssistantService";
import { useRealtimeSync } from "../services/realtimeSyncService";
import {
  DEFAULT_ORGANIZATION_OFFICIALS,
  getOrganizationOfficials,
  fetchOrganizationOfficials,
} from "../services/organizationService";
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
  standardOccupationOptions,
  getCustomPurokDefinitions,
} from "../utils/residentProfile";
import { getRealDocumentTemplateKey } from "../utils/realDocumentTemplates";
import TypingIndicator from "../components/TypingIndicator";
import FloatingModal from "../components/FloatingModal";
import { useBarangayLogo } from "../services/logoService";

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

const quickPurposes = [
  "OWWA",
  "Local Employment",
  "Job Application",
  "Scholarship",
  "Postal ID",
  "Bank Account",
  "Medical Assistance",
  "Financial Assistance",
  "4Ps Requirement",
  "CAFGU",
];

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

let cachedSpeechVoices = [];
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const loadVoices = () => {
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) cachedSpeechVoices = v;
    } catch {
      // ignore
    }
  };
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

let globalAudioPlayer = null;
let activeSpeechToken = null;
let speechHeartbeatTimer = null;
let currentSpeechUtterances = [];
let audioContextInstance = null;

// Get or initialize persistent HTML5 Audio element for mobile compatibility
const getGlobalAudioPlayer = () => {
  if (typeof window === "undefined") return null;
  if (!globalAudioPlayer) {
    globalAudioPlayer = new Audio();
    globalAudioPlayer.setAttribute("playsinline", "true");
    globalAudioPlayer.setAttribute("webkit-playsinline", "true");
    globalAudioPlayer.preload = "auto";
  }
  return globalAudioPlayer;
};

// Unlocks / primes browser speech synthesis and mobile audio channels during user interactions (tap/click)
const primeSpeechSynthesis = () => {
  if (typeof window === "undefined") return;

  // 1. Prime HTML5 Audio element (Essential for iOS Mobile Safari & Android Chrome)
  try {
    const player = getGlobalAudioPlayer();
    if (player) {
      // 1-sample silent WAV to unlock mobile hardware audio pipeline
      player.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      player.volume = 0.01;
      const playPromise = player.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            player.pause();
            player.currentTime = 0;
            player.volume = 1.0;
          })
          .catch(() => {
            // Ignore policy restriction during prime
          });
      }
    }
  } catch {
    // ignore
  }

  // 2. Prime Web AudioContext (Unlocks iOS system audio session)
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      if (!audioContextInstance) {
        audioContextInstance = new AudioContextClass();
      }
      if (audioContextInstance.state === "suspended") {
        audioContextInstance.resume();
      }
    }
  } catch {
    // ignore
  }

  // 3. Prime Web Speech Synthesis
  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.resume();
      const silent = new SpeechSynthesisUtterance(" ");
      silent.volume = 0.01;
      silent.rate = 10;
      window.speechSynthesis.speak(silent);
    }
  } catch {
    // ignore
  }
};

// Global listener to proactively prime audio context on any user tap/click on Mobile or Laptop
if (typeof window !== "undefined") {
  const handleInitialUserGesture = () => {
    primeSpeechSynthesis();
  };
  window.addEventListener("touchstart", handleInitialUserGesture, { passive: true, once: true });
  window.addEventListener("pointerdown", handleInitialUserGesture, { passive: true, once: true });
  window.addEventListener("click", handleInitialUserGesture, { passive: true, once: true });
}

const isTagalogText = (text = "") => {
  if (!text) return false;
  const lower = text.toLowerCase();
  const tagalogWords = [
    "po", "opo", "ang", "ng", "sa", "mga", "ay", "na", "may", "meron", "ito", "dito", "iyon",
    "doon", "taga", "purok", "kabuuan", "kabuuang", "populasyon", "lahat", "natin", "inyo",
    "namin", "tayo", "kami", "sino", "ilan", "ano", "paano", "kailan", "bakit", "batay",
    "rekord", "talaan", "residente", "barangay", "punong", "kapitan", "kagawad", "serbisyo",
    "tulong", "narito", "magandang", "araw", "salamat", "pwede", "kailangan", "makakuha",
    "proseso", "mangyaring", "pumunta", "opisina", "bayaran", "pirma", "rehistro", "hakbang"
  ];
  let matches = 0;
  for (const w of tagalogWords) {
    const reg = new RegExp(`\\b${w}\\b`, "i");
    if (reg.test(lower)) {
      matches++;
      if (matches >= 2) return true;
    }
  }
  return matches >= 1;
};

const isNotificationSupported = () => {
  try {
    return typeof window !== "undefined" && "Notification" in window && typeof window.Notification !== "undefined";
  } catch {
    return false;
  }
};

const getNotificationPermission = () => {
  try {
    if (isNotificationSupported()) {
      return window.Notification.permission;
    }
  } catch (e) {
    console.warn("Could not read notification permission:", e);
  }
  return "unsupported";
};

const isNativeFilipinoVoice = (voice) => {
  if (!voice) return false;
  const lang = (voice.lang || "").toLowerCase();
  const name = (voice.name || "").toLowerCase();
  return (
    lang.startsWith("fil") ||
    lang.startsWith("tl") ||
    name.includes("filipino") ||
    name.includes("tagalog") ||
    name.includes("blessica") ||
    name.includes("angelo") ||
    name.includes("rosa")
  );
};

// Conversational Voice Cleaner: makes text sound like a real person talking naturally to another person
const cleanTextForSpeech = (str = "", isTagalog = false, isNativeVoice = false) => {
  if (!str) return "";
  let cleaned = String(str)
    // Strip image embeds completely: ![alt text](/url) -> ""
    .replace(/!\[.*?\]\(.*?\)/gi, "")
    // Strip markdown links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Strip chart tags & code blocks
    .replace(/\[CHART:.*?\]/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    // Conversational divider pause
    .replace(/^---+$/gm, ". ")
    // Clean markdown headings, bold, italics
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    // Clean document headers into friendly spoken intros
    .replace(/^Kumpletong Gabay para sa/gmi, isTagalog ? "Narito ang gabay para sa" : "Here is the guide for")
    .replace(/^Hakbang sa Pag-request \(Step-by-Step Procedure\):/gmi, isTagalog ? "Para sa hakbang sa pag-request:" : "For the request steps:")
    .replace(/^Mga Pangunahing Requirements & Bayarin:/gmi, isTagalog ? "Para naman sa requirements at bayarin:" : "For the requirements and fees:")
    // Clean bullet list markers
    .replace(/^[•\-\*]\s+/gm, "")
    // Convert numbered lists into natural spoken transitions
    .replace(/^1\.\s*/gm, isTagalog ? "Una, " : "First, ")
    .replace(/^2\.\s*/gm, isTagalog ? "Pangalawa, " : "Second, ")
    .replace(/^3\.\s*/gm, isTagalog ? "Pangatlo, " : "Third, ")
    .replace(/^4\.\s*/gm, isTagalog ? "Pang-apat, " : "Fourth, ")
    .replace(/^5\.\s*/gm, isTagalog ? "Pang-lima, " : "Fifth, ")
    .replace(/^6\.\s*/gm, isTagalog ? "Pang-anim, " : "Sixth, ")
    .replace(/^7\.\s*/gm, isTagalog ? "Pang-pito, " : "Seventh, ")
    // Expand titles and official abbreviations for human natural speech
    .replace(/\bHon\.\s*/gi, "Honorable ")
    .replace(/\bBrgy\.?\b/gi, "Barangay")
    .replace(/\bSK\b/g, "S.K.")
    .replace(/\bLGU\b/g, "L.G.U.")
    .replace(/\bTESDA\b/g, "Tesda")
    .replace(/\bMRF\b/g, "M.R.F.")
    .replace(/\bPWD\b/g, "P.W.D.")
    .replace(/\bPWDs\b/g, "P.W.D.s")
    .replace(/\bPWED\b/g, "P.W.D.")
    .replace(/\bIDs\b/g, "I.D.s")
    .replace(/\bID\b/g, "I.D.")
    .replace(/\bRef\.?\s*No\.?\b/gi, "Reference Number")
    .replace(/\bNo\.\b/gi, "Number")
    .replace(/\be\.g\.?,?\b/gi, isTagalog ? "halimbawa," : "for example,")
    .replace(/\bi\.e\.?,?\b/gi, isTagalog ? "ibig sabihin," : "that is,")
    .replace(/\bvs\.?\b/gi, "versus")
    .replace(/\bapprox\.?\b/gi, isTagalog ? "tinatayang" : "approximately")
    .replace(/\b₱\s*(\d+)/g, "$1 pesos")
    .replace(/\bPhp\s*(\d+)/gi, "$1 pesos")
    .replace(/\bGovt\.?\b/gi, "Government")
    .replace(/\bKaagapA\.?I\b/gi, "Kaagapay")
    .replace(/\bKaagapAI\b/gi, "Kaagapay")
    .replace(/\bAI\b/g, "A.I.")
    // Remove all emojis so speech engines don't read verbose system descriptions
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    // Clean excessive spaces, double periods, and newlines
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/\.{2,}/g, ".")
    .trim();

  // If speaking Tagalog through a non-native English synthesizer, apply minimal phonetic particle fix
  if (isTagalog && !isNativeVoice) {
    cleaned = cleaned
      .replace(/\bmga\b/gi, "manga")
      .replace(/\bng\b/gi, "nang")
      .replace(/\bpo\b/gi, "poh")
      .replace(/\bopo\b/gi, "opoh");
  }

  return cleaned;
};

const getProfessionalVoice = (isTagalog = false) => {
  let voices = [];
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      voices = window.speechSynthesis.getVoices() || [];
    } catch {}
  }
  if (!voices || voices.length === 0) {
    voices = cachedSpeechVoices || [];
  }
  if (!voices || voices.length === 0) return null;

  if (isTagalog) {
    // 1. Native Filipino / Tagalog voices (Microsoft Natural Blessica/Angelo, Google Filipino, Android/iOS Tagalog)
    const nativeFilipino = voices.find((v) => isNativeFilipinoVoice(v));
    if (nativeFilipino) return nativeFilipino;

    // 2. English (Philippines) accent - speaks Filipino & English with authentic natural Filipino cadence
    const phEnglish = voices.find((v) => {
      const l = (v.lang || "").toLowerCase();
      const n = (v.name || "").toLowerCase();
      return (
        l === "en-ph" ||
        l === "en_ph" ||
        l.startsWith("en-ph") ||
        n.includes("philippines") ||
        n.includes("philippine") ||
        n.includes("filipino")
      );
    });
    if (phEnglish) return phEnglish;
  }

  // 3. Premium Natural Voices across Windows, Android, iOS Safari & macOS
  const preferredNaturalVoices = [
    voices.find((v) => v.name.includes("Blessica")),
    voices.find((v) => v.name.includes("Angelo")),
    voices.find((v) => v.name.includes("Jenny") && v.name.includes("Natural")),
    voices.find((v) => v.name.includes("Aria") && v.name.includes("Natural")),
    voices.find((v) => v.name.includes("Guy") && v.name.includes("Natural")),
    voices.find((v) => v.name.includes("Natural") && (v.lang || "").startsWith("en")),
    voices.find((v) => v.name.includes("Google US English") || v.name.includes("Google English")),
    voices.find((v) => v.name.includes("Google UK English Female") || v.name.includes("Google UK English")),
    voices.find((v) => ["Samantha", "Karen", "Victoria", "Daniel", "Serena"].includes(v.name)),
    voices.find((v) => v.name.includes("Zira")),
    voices.find((v) => v.name.includes("David")),
    voices.find((v) => (v.lang || "").toLowerCase().startsWith("en")),
  ];

  const foundVoice = preferredNaturalVoices.find(Boolean);
  return foundVoice || voices[0] || null;
};

// Universal Speech Synthesis Engine for Seamless Mobile & Laptop playback
const speakViaSpeechSynthesis = (sentences, isTagalog, chosenVoice, speechToken, onStart, onEnd) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    // Heartbeat to prevent Mobile Safari / Chrome 15-second speech cutoff
    if (speechHeartbeatTimer) clearInterval(speechHeartbeatTimer);
    speechHeartbeatTimer = setInterval(() => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.resume();
        }
      }
    }, 3000);

    let currentIndex = 0;
    let started = false;

    const speakNextSentence = () => {
      if (activeSpeechToken !== speechToken) {
        return;
      }

      if (currentIndex >= sentences.length) {
        activeSpeechToken = null;
        if (speechHeartbeatTimer) {
          clearInterval(speechHeartbeatTimer);
          speechHeartbeatTimer = null;
        }
        if (onEnd) onEnd();
        currentSpeechUtterances = [];
        return;
      }

      const sentence = sentences[currentIndex];
      currentIndex++;

      const utterance = new SpeechSynthesisUtterance(sentence);
      const isNative = isNativeFilipinoVoice(chosenVoice);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
        utterance.lang = chosenVoice.lang || (isNative ? "fil-PH" : "en-US");
      } else {
        utterance.lang = isTagalog ? "fil-PH" : "en-US";
      }

      // Natural, relaxed conversational cadence (not rushed, warm rhythm)
      utterance.rate = isTagalog ? 0.92 : 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        if (activeSpeechToken !== speechToken) {
          window.speechSynthesis.cancel();
          return;
        }
        if (!started) {
          started = true;
          if (onStart) onStart();
        }
      };

      utterance.onend = () => {
        if (activeSpeechToken === speechToken) {
          speakNextSentence();
        }
      };

      utterance.onerror = (e) => {
        console.warn("Speech synthesis utterance event:", e?.error);
        if (activeSpeechToken !== speechToken || e?.error === "canceled" || e?.error === "interrupted") {
          return;
        }
        speakNextSentence();
      };

      currentSpeechUtterances.push(utterance);
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    };

    setTimeout(() => {
      if (activeSpeechToken === speechToken) {
        window.speechSynthesis.resume();
        speakNextSentence();
      }
    }, 50);
  } catch (err) {
    console.warn("Speech synthesis fallback error:", err);
    activeSpeechToken = null;
    if (onEnd) onEnd();
  }
};

// Universal Voice Assistant: Web Speech API for seamless Mobile & Desktop performance
const speakAssistantText = (text, onStart = null, onEnd = null) => {
  stopAssistantSpeech();
  if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }

  const speechToken = Date.now() + Math.random();
  activeSpeechToken = speechToken;

  const isTagalog = isTagalogText(text);
  const chosenVoice = getProfessionalVoice(isTagalog);
  const isNative = isNativeFilipinoVoice(chosenVoice);
  const cleanText = cleanTextForSpeech(text, isTagalog, isNative);

  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  // Split text into natural conversational sentence chunks
  const rawChunks = cleanText.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [cleanText];
  const sentences = [];
  rawChunks.forEach((chunk) => {
    const trimmed = chunk.trim();
    if (!trimmed) return;
    if (trimmed.length > 110) {
      const subClauses = trimmed.split(/,\s+/);
      subClauses.forEach((sc) => {
        if (sc.trim()) sentences.push(sc.trim());
      });
    } else {
      sentences.push(trimmed);
    }
  });

  if (sentences.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  try {
    speakViaSpeechSynthesis(sentences, isTagalog, chosenVoice, speechToken, onStart, onEnd);
  } catch (audioErr) {
    console.warn("Speech Synthesis call error:", audioErr);
    if (onEnd) onEnd();
  }
};

const stopAssistantSpeech = () => {
  activeSpeechToken = null;
  if (speechHeartbeatTimer) {
    clearInterval(speechHeartbeatTimer);
    speechHeartbeatTimer = null;
  }
  currentSpeechUtterances = [];

  // Stop HTML5 Audio Player
  try {
    if (globalAudioPlayer) {
      globalAudioPlayer.pause();
      globalAudioPlayer.currentTime = 0;
      globalAudioPlayer.src = "";
    }
  } catch {}

  // Stop Web Speech Synthesis
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
};

const getAnnouncementVisualTheme = (title = "", body = "", category = "") => {
  const text = `${title} ${body} ${category}`.toLowerCase();
  
  // 1. HEALTH / MEDICAL / CLINIC / VACCINATION / CHECKUP
  if (
    text.includes("health") ||
    text.includes("medical") ||
    text.includes("clinic") ||
    text.includes("vaccine") ||
    text.includes("bakuna") ||
    text.includes("doktor") ||
    text.includes("kalusugan") ||
    text.includes("dengue") ||
    text.includes("covid") ||
    text.includes("checkup") ||
    text.includes("check-up") ||
    text.includes("gamot") ||
    text.includes("dental") ||
    text.includes("blood") ||
    text.includes("hospital")
  ) {
    return {
      type: "health",
      icon: "🏥",
      headerBg: "from-[#044E35] via-[#0D9488] to-[#0F766E] text-white border-teal-300/40",
      cardBg: "bg-teal-950/30 backdrop-blur-xl border border-teal-400/35 hover:border-teal-300/60 shadow-lg",
      badgeBg: "bg-teal-500/30 text-teal-200 border-teal-400/40 shadow-xs font-black",
      titleColor: "text-white font-black",
      bodyColor: "text-teal-100/90 font-medium",
      patternSvg: (
        <div className="absolute right-1 -bottom-2 pointer-events-none opacity-20 text-teal-300">
          <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h4.28" />
          </svg>
        </div>
      ),
    };
  }

  // 2. FIRE / SUNOG / BLAZE
  if (
    text.includes("fire") ||
    text.includes("sunog") ||
    text.includes("wildfire") ||
    text.includes("burn") ||
    text.includes("blaze") ||
    text.includes("arson")
  ) {
    return {
      type: "fire",
      icon: "🔥",
      headerBg: "from-[#9A3412] via-[#EA580C] to-[#F97316] text-white border-amber-400/40",
      cardBg: "bg-orange-950/30 backdrop-blur-xl border border-orange-400/35 hover:border-orange-300/60 shadow-lg",
      badgeBg: "bg-orange-500/30 text-orange-200 border-orange-400/40 shadow-xs font-black",
      titleColor: "text-white font-black",
      bodyColor: "text-orange-100/90 font-medium",
      patternSvg: (
        <div className="absolute right-1 -bottom-2 pointer-events-none opacity-20 text-orange-300">
          <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          </svg>
        </div>
      ),
    };
  }

  // 3. FLOOD / TYPHOON / STORM / RAIN / CALAMITY
  if (
    text.includes("typhoon") ||
    text.includes("bagyo") ||
    text.includes("flood") ||
    text.includes("baha") ||
    text.includes("rain") ||
    text.includes("storm") ||
    text.includes("tsunami") ||
    text.includes("landslide") ||
    text.includes("weather")
  ) {
    return {
      type: "storm",
      icon: "⛈️",
      headerBg: "from-[#1E3A8A] via-[#0284C7] to-[#0EA5E9] text-white border-sky-400/40",
      cardBg: "bg-sky-950/30 backdrop-blur-xl border border-sky-400/35 hover:border-sky-300/60 shadow-lg",
      badgeBg: "bg-sky-500/30 text-sky-200 border-sky-400/40 shadow-xs font-black",
      titleColor: "text-white font-black",
      bodyColor: "text-sky-100/90 font-medium",
      patternSvg: (
        <div className="absolute right-1 -bottom-2 pointer-events-none opacity-20 text-sky-300">
          <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="m9.2 22 3-7" />
            <path d="m9 13-2 3" />
            <path d="m17 13-2 3" />
          </svg>
        </div>
      ),
    };
  }

  // 4. EARTHQUAKE / LINDOL / SEISMIC
  if (
    text.includes("earthquake") ||
    text.includes("earth quake") ||
    text.includes("lindol") ||
    text.includes("quake") ||
    text.includes("tremor") ||
    text.includes("seismic") ||
    text.includes("pag-alog")
  ) {
    return {
      type: "earthquake",
      icon: "🌋",
      headerBg: "from-[#78350F] via-[#B45309] to-[#D97706] text-white border-amber-400/40",
      cardBg: "bg-amber-950/30 backdrop-blur-xl border border-amber-400/35 hover:border-amber-300/60 shadow-lg",
      badgeBg: "bg-gradient-to-r from-amber-700 to-yellow-700 text-white border-amber-300/40 shadow-xs font-black",
      titleColor: "text-white font-black",
      bodyColor: "text-amber-100/90 font-medium",
      patternSvg: (
        <div className="absolute right-1 -bottom-2 pointer-events-none opacity-20 text-amber-300">
          <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
          </svg>
        </div>
      ),
    };
  }

  // 5. POWER / UTILITIES / WATER INTERRUPTION
  if (
    text.includes("power") ||
    text.includes("brownout") ||
    text.includes("kuryente") ||
    text.includes("electric") ||
    text.includes("water") ||
    text.includes("tubig") ||
    text.includes("interruption") ||
    text.includes("outage") ||
    text.includes("blackout")
  ) {
    return {
      type: "power",
      icon: "⚡",
      headerBg: "from-[#312E81] via-[#4F46E5] to-[#7C3AED] text-white border-indigo-400/40",
      cardBg: "bg-indigo-950/30 backdrop-blur-xl border border-indigo-400/35 hover:border-indigo-300/60 shadow-lg",
      badgeBg: "bg-indigo-500/30 text-indigo-200 border-indigo-400/40 shadow-xs font-black",
      titleColor: "text-white font-black",
      bodyColor: "text-indigo-100/90 font-medium",
      patternSvg: (
        <div className="absolute right-1 -bottom-2 pointer-events-none opacity-20 text-indigo-300">
          <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
      ),
    };
  }

  // 6. LIVELIHOOD / AGRICULTURE / JOBS / TESDA / TRAINING
  if (
    text.includes("livelihood") ||
    text.includes("tesda") ||
    text.includes("training") ||
    text.includes("job") ||
    text.includes("farm") ||
    text.includes("agriculture") ||
    text.includes("seminar") ||
    text.includes("workshop") ||
    text.includes("tanim") ||
    text.includes("hanapbuhay")
  ) {
    return {
      type: "livelihood",
      icon: "🌾",
      headerBg: "from-[#064E3B] via-[#059669] to-[#10B981] text-white border-emerald-400/40",
      cardBg: "bg-emerald-950/30 backdrop-blur-xl border border-emerald-400/35 hover:border-emerald-300/60 shadow-lg",
      badgeBg: "bg-emerald-500/30 text-emerald-200 border-emerald-300/40 shadow-xs font-black",
      titleColor: "text-white font-black",
      bodyColor: "text-emerald-100/90 font-medium",
      patternSvg: (
        <div className="absolute right-1 -bottom-2 pointer-events-none opacity-20 text-emerald-300">
          <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 12" />
          </svg>
        </div>
      ),
    };
  }

  // 7. GENERAL EMERGENCY / CALAMITY / SECURITY
  if (
    category.toUpperCase().includes("EMERGENCY") ||
    text.includes("calamity") ||
    text.includes("evacuation") ||
    text.includes("tanod") ||
    text.includes("police") ||
    text.includes("security") ||
    text.includes("sakuna") ||
    text.includes("alert")
  ) {
    return {
      type: "emergency",
      icon: "🚨",
      headerBg: "from-[#991B1B] via-[#DC2626] to-[#EA580C] text-white border-rose-400/40",
      cardBg: "bg-rose-950/30 backdrop-blur-xl border border-rose-500/35 hover:border-rose-400/60 shadow-lg",
      badgeBg: "bg-rose-500/30 text-rose-200 border-rose-400/40 shadow-xs font-black animate-pulse",
      titleColor: "text-white font-black",
      bodyColor: "text-rose-100/90 font-medium",
      patternSvg: (
        <div className="absolute right-1 -bottom-2 pointer-events-none opacity-25 text-rose-400">
          <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m12 8 0 4" />
            <path d="m12 16 .01 0" />
          </svg>
        </div>
      ),
    };
  }

  // 8. DEFAULT / GENERAL ADVISORY / COMMUNITY
  return {
    type: "advisory",
    icon: "📢",
    headerBg: "from-[#044E35] via-[#057A55] to-[#046C4E] text-white border-emerald-400/30",
    cardBg: "bg-emerald-950/30 backdrop-blur-xl border border-emerald-400/35 hover:border-emerald-300/60 shadow-lg",
    badgeBg: "bg-emerald-500/30 text-emerald-200 border-emerald-400/30 shadow-xs font-black",
    titleColor: "text-white font-black",
    bodyColor: "text-emerald-100/90 font-medium",
    patternSvg: (
      <div className="absolute right-1 -bottom-2 pointer-events-none opacity-20 text-emerald-300">
        <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 11 18-5v12L3 14v-3z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
      </div>
    ),
  };
};

const getEventVisualTheme = (title = "", location = "") => {
  const text = `${title} ${location}`.toLowerCase();
  
  if (text.includes("computer") || text.includes("tesda") || text.includes("tech") || text.includes("digital") || text.includes("it") || text.includes("literacy")) {
    return {
      type: "tech",
      cardBg: "bg-gradient-to-br from-slate-950/80 via-[#031B33]/80 to-[#021324]/80 backdrop-blur-xl border-cyan-400/60 shadow-2xl",
      headerBg: "from-cyan-900 via-blue-800 to-teal-900 text-white border-cyan-400/50",
      dateBg: "bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-cyan-300/60 shadow-cyan-500/50 font-black",
      titleColor: "text-white font-black drop-shadow-md",
      subColor: "text-cyan-300 font-bold",
      icon: "💻",
      animation: (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-0 opacity-30">
          <div className="absolute -top-6 -right-6 w-36 h-36 bg-cyan-500 rounded-full blur-2xl animate-pulse" />
          <div className="absolute bottom-0 left-10 w-28 h-28 bg-blue-600 rounded-full blur-2xl animate-ping opacity-20" />
        </div>
      )
    };
  }
  if (text.includes("farm") || text.includes("livelihood") || text.includes("agriculture") || text.includes("tanim") || text.includes("tesda farm")) {
    return {
      type: "farm",
      cardBg: "bg-gradient-to-br from-slate-950/80 via-emerald-950/80 to-green-950/80 backdrop-blur-xl border-emerald-400/60 shadow-2xl",
      headerBg: "from-emerald-900 via-green-800 to-teal-900 text-white border-emerald-400/50",
      dateBg: "bg-gradient-to-br from-emerald-500 to-green-600 text-white border-emerald-300/60 shadow-emerald-500/50 font-black",
      titleColor: "text-white font-black drop-shadow-md",
      subColor: "text-emerald-300 font-bold",
      icon: "🌾",
      animation: (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-0 opacity-25">
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-emerald-500 rounded-full blur-2xl animate-pulse" />
        </div>
      )
    };
  }
  return {
    type: "default",
    cardBg: "bg-teal-950/30 backdrop-blur-xl border border-teal-400/35 shadow-lg text-white",
    headerBg: "from-[#044E35] via-[#057A55] to-[#046C4E] text-white border-emerald-400/30",
    dateBg: "bg-[#047857] text-white font-black",
    titleColor: "text-white font-black",
    subColor: "text-teal-200 font-bold",
    icon: "📅",
    animation: null
  };
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

const RenderChatChart = ({ text, isAi = true }) => {
  const match = text.match(/\[CHART:(PIE|BAR):(.*?)\]/);
  
  // Format conversational text with bold highlights, clean paragraphs, and official photo cards
  const renderFormattedParagraphs = (raw) => {
    if (!raw) return null;
    const lines = raw.split("\n");
    return (
      <div className="space-y-1.5 leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />;
          
          // Check for image tag ![Alt](url)
          const imgMatch = line.trim().match(/^!\[(.*?)\]\((.*?)\)$/);
          if (imgMatch) {
            const alt = imgMatch[1];
            const src = imgMatch[2];
            return (
              <div key={idx} className="my-2.5 flex flex-col items-center sm:items-start">
                <div className="relative group w-32 h-36 sm:w-36 sm:h-40 rounded-2xl overflow-hidden border-2 border-emerald-400/80 shadow-xl bg-gradient-to-b from-emerald-950/90 to-black ring-2 ring-emerald-500/30 transition hover:scale-105">
                  <img
                    src={src}
                    alt={alt}
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/logo.png";
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-3 pb-1 px-1.5 text-center">
                    <span className="text-[10px] font-black text-emerald-300 uppercase tracking-tight truncate block">
                      {alt}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // Check for bullet list item
          if (/^[•\-\*]\s+/.test(line)) {
            const content = line.replace(/^[•\-\*]\s+/, "");
            return (
              <div key={idx} className="flex items-start gap-2 pl-1 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span className="flex-1">{formatInlineMarkdown(content)}</span>
              </div>
            );
          }

          return <p key={idx}>{formatInlineMarkdown(line)}</p>;
        })}
      </div>
    );
  };

  const formatInlineMarkdown = (str) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-extrabold text-emerald-300">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  if (!match) {
    return renderFormattedParagraphs(text);
  }

  const cleanText = text.replace(match[0], "").trim();
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
    return renderFormattedParagraphs(cleanText || text);
  }

  if (!data || data.length === 0) {
    return renderFormattedParagraphs(cleanText || text);
  }

  const totalSum = data.reduce((acc, curr) => acc + curr.value, 0);
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Intro Text */}
      {cleanText && renderFormattedParagraphs(cleanText)}

      {/* Modern Glassmorphic Analytics & Visual Graph Card */}
      <div className="w-full rounded-2xl bg-black/50 border border-emerald-500/40 p-3 sm:p-4 shadow-xl backdrop-blur-md overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/15 mb-3">
          <div className="flex items-center gap-2 text-emerald-300 font-extrabold text-xs">
            <span className="h-6 w-6 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <BarChart3 size={13} className="text-emerald-400" />
            </span>
            <span className="tracking-wide">Barangay Demographics &amp; Analytics</span>
          </div>
          {totalSum > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10.5px] font-black shrink-0 flex items-center gap-1">
              <Users size={11} /> Total: {totalSum.toLocaleString()}
            </span>
          )}
        </div>

        {/* Visual Animated Progress Bars */}
        <div className="space-y-2.5">
          {data.map((item, idx) => {
            const percentage = totalSum > 0 ? ((item.value / totalSum) * 100).toFixed(1) : "0.0";
            const barWidth = `${Math.min(100, Math.max(6, (item.value / maxVal) * 100))}%`;
            const isHighlighted = idx === 0 || item.name.toLowerCase().includes("payhod");

            return (
              <div key={idx} className="space-y-1 group">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className={`truncate ${isHighlighted ? "text-white font-black" : "text-slate-200"}`}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[11px] font-black">
                    <span className="text-white">{item.value.toLocaleString()}</span>
                    <span className="text-emerald-300 text-[10px] bg-emerald-950/90 px-1.5 py-0.5 rounded-md border border-emerald-500/30">
                      {percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar track */}
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden p-0.5">
                  <div
                    style={{ width: barWidth }}
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      isHighlighted
                        ? "bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 shadow-xs shadow-emerald-400/50"
                        : "bg-gradient-to-r from-emerald-600 to-teal-600 opacity-80"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
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
  { key: "home", label: "Home", icon: Home },
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
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
      return "bg-amber-500/25 border-amber-400/40 text-amber-200";
    case "Processing":
      return "bg-blue-500/25 border-blue-400/40 text-blue-200";
    case "Approved":
      return "bg-emerald-500/25 border-emerald-400/40 text-emerald-200";
    case "Completed":
    case "Released":
      return "bg-emerald-500/30 border-emerald-300/50 text-emerald-100 font-bold";
    case "Rejected":
    case "Cancelled":
    case "Expired":
      return "bg-rose-500/25 border-rose-400/40 text-rose-200 font-bold";
    default:
      return "bg-white/10 border-white/20 text-white/80";
  }
};

const AssistantAiIcon = () => (
  <div className="flex h-full w-full items-center justify-center bg-slate-900/80 p-0.5 rounded-full shadow-inner overflow-hidden border border-emerald-400/50">
    <img
      src="/ai-robot.webp"
      alt="KaagapAI Robot"
      className="h-full w-full object-contain drop-shadow-xs"
      onError={(e) => {
        e.target.src = "/robot/Robot.cutout.png";
      }}
    />
  </div>
);

const FloatingRobotWidget = memo(({ assistantOpen, onOpenAssistant }) => {
  const [robotDismissed, setRobotDismissed] = useState(() => {
    try {
      return localStorage.getItem("kaagapai_robot_dismissed") === "true";
    } catch {
      return false;
    }
  });
  const [robotVisible, setRobotVisible] = useState(() => !robotDismissed);
  const [robotMessageIndex, setRobotMessageIndex] = useState(0);
  const [robotTypedText, setRobotTypedText] = useState("");

  const robotSayings = useMemo(() => [
    "Hai! I'm your KaagapAI Virtual Assistant! 🤖 Need help with barangay services, documents, or announcements? Click me!",
    "May kailangan ka bang tulong sa Certificate of Residency, Clearance, o Indigency? Pwede kitang gabayan! 📄✨",
    "Stay updated! Check out the latest Barangay Announcements & Livelihood Opportunities on your Home tab! 📢",
    "May tanong ka ba sa Barangay Officials o Office Hours? Mag-chat lang sa akin 24/7! 💬"
  ], []);

  // 15s Visible <-> 15s Hidden Cycle (isolated to widget)
  useEffect(() => {
    if (robotDismissed) {
      setRobotVisible(false);
      return;
    }

    let timer = null;
    if (robotVisible) {
      timer = setTimeout(() => {
        setRobotVisible(false);
      }, 15000);
    } else {
      timer = setTimeout(() => {
        if (!robotDismissed) {
          setRobotMessageIndex((prev) => (prev + 1) % robotSayings.length);
          setRobotVisible(true);
        }
      }, 15000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [robotVisible, robotDismissed, robotSayings.length]);

  // Typewriter effect isolated to this widget
  useEffect(() => {
    if (!robotVisible) {
      setRobotTypedText("");
      return;
    }

    let typeTimer = null;
    let charIndex = 0;
    const currentFullText = robotSayings[robotMessageIndex] || "";

    setRobotTypedText("");

    typeTimer = setInterval(() => {
      if (charIndex < currentFullText.length) {
        charIndex++;
        setRobotTypedText(currentFullText.slice(0, charIndex));
      } else {
        clearInterval(typeTimer);
      }
    }, 32);

    return () => {
      if (typeTimer) clearInterval(typeTimer);
    };
  }, [robotVisible, robotMessageIndex, robotSayings]);

  if (assistantOpen || !robotVisible || robotDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 15 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="fixed bottom-[8rem] right-3 sm:bottom-24 sm:right-6 z-[9945] w-16 sm:w-20 flex items-center justify-center pointer-events-auto"
      >
        <div className="relative w-full flex items-center justify-center">
          {/* Animated Typewriter Speech Bubble (Transparent White Glassmorphism) */}
          <div
            className="absolute right-[calc(100%+8px)] bottom-1.5 sm:bottom-2 w-[180px] sm:w-[260px] max-w-[calc(100vw-5.5rem)] bg-white/95 backdrop-blur-2xl border border-white/95 text-slate-900 p-2.5 sm:p-3 rounded-2xl shadow-xl sm:shadow-2xl shadow-slate-950/25 z-20 text-left pointer-events-auto select-none cursor-pointer"
            onClick={onOpenAssistant}
            title="Click to chat with KaagapAI Virtual Assistant"
          >
            {/* Chat Bubble Tail Pointer */}
            <div className="absolute -right-2 bottom-4 sm:bottom-5 w-0 h-0 border-t-[5px] sm:border-t-[6px] border-t-transparent border-l-[7px] sm:border-l-[8px] border-l-white/95 border-b-[5px] sm:border-b-[6px] border-b-transparent" />
            
            {/* Speech Bubble Header */}
            <div className="flex items-center justify-between pb-1 sm:pb-1.5 mb-1 sm:mb-1.5 border-b border-slate-200/80">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-800">KaagapAI Robot</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRobotVisible(false);
                  setRobotDismissed(true);
                  try {
                    localStorage.setItem("kaagapai_robot_dismissed", "true");
                  } catch {}
                }}
                className="text-slate-400 hover:text-slate-900 text-xs font-bold px-1.5 py-0.5 hover:bg-slate-200/80 rounded transition cursor-pointer"
                title="Dismiss permanently"
              >
                ✕
              </button>
            </div>

            {/* Typewriter Text */}
            <p className="text-[10.5px] sm:text-xs font-black leading-relaxed text-slate-900 font-sans">
              {robotTypedText}
              {robotTypedText.length < (robotSayings[robotMessageIndex]?.length || 0) && (
                <span className="inline-block w-1 h-3 ml-0.5 bg-emerald-600 animate-pulse" />
              )}
            </p>

            <div className="mt-1.5 pt-1 sm:pt-1.5 border-t border-slate-200/80 flex justify-between items-center text-[9px] sm:text-[9.5px] font-bold">
              <span className="text-emerald-700 font-black">Click to chat</span>
              <span className="text-amber-700">24/7 AI ⚡</span>
            </div>
          </div>

          {/* Levitating 3D Robot Avatar Image */}
          <motion.div
            animate={{ 
              y: [0, -7, 0],
              rotate: [0, -1.5, 1.5, 0]
            }}
            transition={{ 
              duration: 3.5, 
              repeat: Infinity, 
              repeatType: "mirror", 
              ease: "easeInOut" 
            }}
            onClick={onOpenAssistant}
            className="relative cursor-pointer group shrink-0 flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20"
            title="Click KaagapAI Robot to open Assistant"
          >
            {/* Soft Ambient Glow Halo */}
            <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/25 via-teal-400/25 to-cyan-500/25 rounded-full blur-md opacity-75 group-hover:opacity-100 transition duration-300 animate-pulse pointer-events-none" />

            {/* 3D Robot Image */}
            <img
              src="/ai-robot.webp"
              alt="KaagapAI Floating Robot Assistant"
              className="w-16 h-16 sm:w-20 sm:h-20 max-w-full max-h-full object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.5)] relative z-10 transition-transform duration-300 group-hover:scale-110"
              onError={(e) => {
                e.target.src = "/robot/Robot.cutout.png";
              }}
            />
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

const parsePurpose = (docType) => {
  if (!docType) return "";
  const match = docType.match(/\(Purpose:\s*(.*?)\)/i) || docType.match(/-\s*Purpose:\s*(.*)/i);
  return match ? match[1].trim() : "";
};

const UserDashboard = () => {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const shouldReduceMotion = useReducedMotion();
  const barangayLogo = useBarangayLogo();

  // App Telemetry States (Synchronously initialized for instantaneous 0ms rendering)
  const [userData, setUserData] = useState(() => {
    const s = getResidentSession();
    return s ? { user: { email: s.username || s.email }, profile: { role: "resident", resident_id: s.id } } : null;
  });
  const [resident, setResident] = useState(() => {
    const s = getResidentSession();
    return s ? { ...s, must_change_credentials: false } : null;
  });
  const [loading, setLoading] = useState(() => !getResidentSession());
  const [requests, setRequests] = useState([]);
  const [allSystemRequests, setAllSystemRequests] = useState([]);
  const [documentTemplates, setDocumentTemplates] = useState([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState("");
  const [requestPurpose, setRequestPurpose] = useState("");
  const [requestResidencyPreset, setRequestResidencyPreset] = useState("for a CAFGU");
  const [requestResidencyRecommendation, setRequestResidencyRecommendation] = useState("for a CAFGU");
  const [requestFourPsPreset, setRequestFourPsPreset] = useState("change_grantee_abroad");
  const [requestFourPsSpouse, setRequestFourPsSpouse] = useState("");
  const [requestIndigencyPreset, setRequestIndigencyPreset] = useState("MEDICAL ASSISTANCE");
  const [requestClearancePreset, setRequestClearancePreset] = useState("OWWA");
  const [requestSoloReasonPreset, setRequestSoloReasonPreset] = useState("death");
  const [requestSoloReason, setRequestSoloReason] = useState("");
  const [requestBusinessName, setRequestBusinessName] = useState("");
  const [requestCropsText, setRequestCropsText] = useState("Rice Field ½ hectare, and Fruits Crops 1 hectare");
  const [requestFarmSize, setRequestFarmSize] = useState("One (1) hectare");
  const [requestTenure, setRequestTenure] = useState("Owner");
  const [notifications, setNotifications] = useState([]);
  const [announcementReadIds, setAnnouncementReadIds] = useState([]);
  const [livelihoodReadIds, setLivelihoodReadIds] = useState([]);
  const [publishedAnnouncements, setPublishedAnnouncements] = useState([]);
  const [activeVmTab, setActiveVmTab] = useState("vision");
  
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
  const [selectedOfficialForModal, setSelectedOfficialForModal] = useState(null);
  const [officials, setOfficials] = useState(() => getOrganizationOfficials());

  useEffect(() => {
    let isMounted = true;
    fetchOrganizationOfficials()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setOfficials(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load organization officials:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Dynamic system settings (Office Email, Office Phone, etc.)
  const [systemSettings, setSystemSettings] = useState(() => getSystemSettings());

  const getOfficialById = useCallback(
    (id) => {
      return (
        officials.find((off) => off.id === id) ||
        DEFAULT_ORGANIZATION_OFFICIALS.find((off) => off.id === id) ||
        null
      );
    },
    [officials]
  );

  const captain = useMemo(() => getOfficialById("captain"), [getOfficialById]);
  const leftWingOfficials = useMemo(
    () =>
      [
        getOfficialById("kagawad-wilson-boy-capon-pon"),
        getOfficialById("kagawad-garry-bernal"),
        getOfficialById("kagawad-juanito-c-talaman"),
        getOfficialById("kagawad-loreto-c-calamba"),
      ].filter(Boolean),
    [getOfficialById]
  );

  const rightWingOfficials = useMemo(
    () =>
      [
        getOfficialById("kagawad-judy-c-cabaya"),
        getOfficialById("kagawad-kobi-gandawali"),
        getOfficialById("kagawad-mercy-joy-c-calamba"),
        getOfficialById("sk-chairman-chrystophyr-b-trance"),
      ].filter(Boolean),
    [getOfficialById]
  );

  const secretary = useMemo(() => getOfficialById("secretary-jovelyn-c-cabaya"), [getOfficialById]);
  const treasurer = useMemo(() => getOfficialById("treasurer-rosalie-c-calamba"), [getOfficialById]);

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
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("kaagapai_resident_font_size") || "medium");
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(() => localStorage.getItem("kaagapai_sms_notifications") !== "false");
  const [announcementSmsAlerts, setAnnouncementSmsAlerts] = useState(() => localStorage.getItem("kaagapai_announcements_pref") !== "false");
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);
  const [latestAnnouncementToast, setLatestAnnouncementToast] = useState(null);
  const [latestNotificationToast, setLatestNotificationToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [selectedAnnouncementModal, setSelectedAnnouncementModal] = useState(null);


  // Realtime Functional Search Index across all resident system items
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    
    const results = [];

    // 1. Search Document Request Templates
    const templates = [
      { title: "Certificate of Residency", desc: "Proof of residency certificate", code: "residency" },
      { title: "Barangay Clearance", desc: "Official clearance certificate", code: "clearance" },
      { title: "Indigency Certificate", desc: "Financial assistance indigency", code: "indigency" },
      { title: "Business Permit", desc: "Clearance for local business operation", code: "business" },
      { title: "First Time Job Seeker", desc: "Republic Act 11261 clearance", code: "jobseeker" },
    ];
    templates.forEach((t) => {
      if (t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)) {
        results.push({
          type: "Document Request",
          title: t.title,
          desc: t.desc,
          action: () => {
            setDocumentModalOpen(true);
            setSearchQuery("");
          },
        });
      }
    });

    // 2. Search Announcements
    (publishedAnnouncements || []).forEach((a) => {
      if (
        (a.title || "").toLowerCase().includes(q) ||
        (a.body || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q)
      ) {
        results.push({
          type: "Announcement",
          title: a.title || "Announcement",
          desc: a.category || "General",
          action: () => {
            setSelectedAnnouncementModal(a);
            setSearchQuery("");
          },
        });
      }
    });

    // 3. Search Livelihood Opportunities
    const livelihoods = [
      { title: "TESDA Computer Literacy Training", desc: "Basic computer training for residents" },
      { title: "Community Job Fair", desc: "Entry-level jobs with local employers" },
      { title: "Urban Gardening Livelihood Program", desc: "Sustainable vegetable production training" },
    ];
    livelihoods.forEach((l) => {
      if (l.title.toLowerCase().includes(q) || l.desc.toLowerCase().includes(q)) {
        results.push({
          type: "Job / Program",
          title: l.title,
          desc: l.desc,
          action: () => {
            openModule("livelihood");
            setSearchQuery("");
          },
        });
      }
    });

    // 4. Search Barangay Officials
    officials.forEach((o) => {
      if ((o.name || "").toLowerCase().includes(q) || (o.position || "").toLowerCase().includes(q)) {
        results.push({
          type: "Barangay Official",
          title: o.name,
          desc: o.position,
          action: () => {
            openModule("officials");
            setSearchQuery("");
          },
        });
      }
    });

    return results.slice(0, 10);
  }, [searchQuery, publishedAnnouncements]);

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

  const isAnnouncementExpired = (announcement) => {
    if (!announcement || !announcement.expires_at) return false;
    const expireDate = new Date(announcement.expires_at);
    if (isNaN(expireDate.getTime())) return false;
    expireDate.setHours(23, 59, 59, 999);
    return new Date().getTime() > expireDate.getTime();
  };

  useEffect(() => {
    const requestPerm = async () => {
      try {
        if (isNotificationSupported() && window.Notification.permission === "default") {
          await window.Notification.requestPermission();
        }
      } catch (e) {
        console.warn("Notification request permission failed:", e);
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
                  if (isNotificationSupported() && window.Notification.permission === "granted") {
                    try {
                      const nativeNotif = new window.Notification("Barangay Upper Mingading", {
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
                        try {
                          nativeNotif.close();
                        } catch (e) {}
                      }, 3000); // Swipe/close after 3 seconds!
                    } catch (e) {
                      console.warn("Native notification display failed:", e);
                    }
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

    const livelihoodChannel = supabase
      .channel("livelihood-realtime-user")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "livelihood_posts",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = payload.old?.id;
            if (oldId) {
              setOpportunities((current) => current.filter((o) => o.id !== oldId));
            }
            return;
          }

          const newPost = payload.new;
          if (newPost && newPost.status === "Open") {
            setOpportunities((current) => {
              const exists = current.some((o) => o.id === newPost.id);
              if (exists) {
                return current.map((o) => (o.id === newPost.id ? newPost : o));
              }
              return [newPost, ...current];
            });
          } else if (newPost?.id) {
            setOpportunities((current) => current.filter((o) => o.id !== newPost.id));
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
          if (resident?.id) {
            fetchResidentNotifications(resident.id)
              .then((freshNotifs) => {
                if (freshNotifs) setNotifications(freshNotifs);
              })
              .catch(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(announcementChannel);
      supabase.removeChannel(livelihoodChannel);
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
      if (isNotificationSupported() && window.Notification.permission === "granted") {
        try {
          const nativeNotif = new window.Notification("KaagapA.I Notification", {
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
            try {
              nativeNotif.close();
            } catch (e) {}
          }, 3000); // Close/swipe out after 3 seconds!
        } catch (e) {
          console.warn("Native notification display failed:", e);
        }
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
  const [requesting, setRequesting] = useState(false);
  const [refreshingRequests, setRefreshingRequests] = useState(false);
  const [requestMessage, setRequestMessage] = useState(null);
  const [activeNav, setActiveNav] = useState("home");
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [deletingLogs, setDeletingLogs] = useState(false);
  const [previousNav, setPreviousNav] = useState("home");
  const prevNavRef = useRef("home");

  useEffect(() => {
    if (activeNav !== prevNavRef.current) {
      setPreviousNav(prevNavRef.current);
      prevNavRef.current = activeNav;
    }
  }, [activeNav]);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);

  useEffect(() => {
    if (activeNav !== "settings") {
      setMobileSettingsOpen(false);
    }
  }, [activeNav]);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chatFabExpanded, setChatFabExpanded] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("kaagapai_chatbot_voice_enabled");
      return saved !== "false";
    } catch {
      return true;
    }
  });
  const [speakingChatId, setSpeakingChatId] = useState(null);
  const [selectedLivelihoodDetail, setSelectedLivelihoodDetail] = useState(null);
  const [selectedAnnouncementDetail, setSelectedAnnouncementDetail] = useState(null);

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

  // Account credential editing state
  const [editingUsername, setEditingUsername] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [credentialPassword, setCredentialPassword] = useState("");
  const [credentialMessage, setCredentialMessage] = useState(null);
  const [savingCredential, setSavingCredential] = useState(false);
  const [showCredentialPassword, setShowCredentialPassword] = useState(false);

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
      birthplace: resident.birthplace || "",
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
      house_no: resident.house_no || "",
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
      pwd_type: resident.pwd_type || "",
      is_solo_parent: Boolean(resident.is_solo_parent),
      is_4ps_member: Boolean(resident.is_4ps_member),
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

  // Realtime multi-tab & cross-device automatic synchronization (zero manual refresh needed!)
  useRealtimeSync(["announcements", "documents", "notifications", "livelihood"], () => {
    refreshResidentBroadcasts();
    if (resident?.id) {
      refreshResidentActivity(resident.id);
    }
  });

  // Mounting load logic (Ultra-fast non-blocking background hydration)
  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Never keep loading spinner active for more than 600ms
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 600);

    const loadDashboard = async () => {
      try {
        const residentSession = getResidentSession();
        if (residentSession) {
          if (isMounted) {
            setLoading(false);
            setUserData({
              user: { email: residentSession.username || residentSession.email },
              profile: { role: "resident", resident_id: residentSession.id },
            });
            setResident((prev) => prev || { ...residentSession, must_change_credentials: false });
          }
        }

        // Fire all critical & broadcast requests in parallel (non-blocking)
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
          setLoading(false);
        }

        if (residentSession) {
          try {
            const residentData = await getResidentById(residentSession.id);
            if (isMounted && residentData) {
              setResident({
                ...(residentData || {}),
                account_id: residentSession.account_id,
                username: residentSession.username || residentData?.portal_username || residentData?.username || "",
                account_status: residentSession.account_status,
                must_change_credentials: false,
              });
            }
          } catch (err) {
            // Keep existing cached resident
          }
          if (isMounted) {
            await refreshResidentActivity(residentSession.id);
          }
          return;
        }

        // Fallback for Supabase OAuth or direct user profile session
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
      clearTimeout(safetyTimer);
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
          window.history.pushState({ activeNav: "home" }, "", "");
          
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
          setActiveNav("home");
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    if (!window.history.state || !window.history.state.activeNav) {
      window.history.replaceState({ activeNav: "home" }, "", "");
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

  const allNotificationsMerged = useMemo(() => {
    const systemNotifs = notifications.map((n) => ({
      id: String(n.id),
      title: n.title,
      message: n.message || n.body || "",
      created_at: n.created_at,
      is_read: n.is_read,
      isAnnouncement: false,
      isLivelihood: false,
      original: n,
    }));

    const applicableAnn = publishedAnnouncements
      .filter((a) => !isAnnouncementExpired(a))
      .filter((a) => doesAnnouncementApplyToResident(a, resident))
      .map((a) => {
        const isRead = announcementReadIds.includes(a.id);
        return {
          id: `announcement-${a.id}`,
          title: `📢 Announcement: ${a.title}`,
          message: a.body,
          created_at: (a.publish_date || a.created_at || "") + (String(a.publish_date || "").includes("T") ? "" : "T00:00:00Z"),
          is_read: isRead,
          isAnnouncement: true,
          isLivelihood: false,
          announcement_id: a.id,
          original: a,
        };
      });

    const applicableLivelihood = opportunities
      .filter((o) => o.status === "Open")
      .map((o) => {
        const isRead = livelihoodReadIds.includes(o.id);
        return {
          id: `livelihood-${o.id}`,
          title: `💼 Livelihood: ${o.title}`,
          message: o.description || `New ${o.category || "Livelihood"} program available. Deadline: ${o.deadline || "Open"}.`,
          created_at: o.created_at || new Date().toISOString(),
          is_read: isRead,
          isAnnouncement: false,
          isLivelihood: true,
          livelihood_id: o.id,
          original: o,
        };
      });

    return [...systemNotifs, ...applicableAnn, ...applicableLivelihood].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [notifications, publishedAnnouncements, opportunities, resident, announcementReadIds, livelihoodReadIds]);

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

    const allLivIds = opportunities.map((o) => o.id);
    const nextLivReadIds = [...new Set([...livelihoodReadIds, ...allLivIds])];
    saveStoredReadIds(`${LIVELIHOOD_READ_KEY}:${resident.id}`, nextLivReadIds);
    setLivelihoodReadIds(nextLivReadIds);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllResidentNotificationsRead(resident.id);
    } catch (e) {
      console.warn("Failed to sync mark all notifications read:", e);
    }
  };

  const handleDeleteResidentNotification = async (e, notif) => {
    e.stopPropagation();
    if (!notif) return;
    if (notif.isAnnouncement) {
      const next = [...new Set([...announcementReadIds, notif.announcement_id])];
      saveStoredReadIds(`${ANNOUNCEMENT_READ_KEY}:${resident?.id}`, next);
      setAnnouncementReadIds(next);
      return;
    }
    if (notif.isLivelihood) {
      const next = [...new Set([...livelihoodReadIds, notif.livelihood_id])];
      saveStoredReadIds(`${LIVELIHOOD_READ_KEY}:${resident?.id}`, next);
      setLivelihoodReadIds(next);
      return;
    }
    setNotifications((prev) => prev.filter((item) => String(item.id) !== String(notif.id)));
    try {
      await deleteResidentNotification(notif.id);
    } catch (e) {
      console.warn("Failed to delete resident notification:", e);
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

  // User Personal Dashboard Metrics & Activity Calculations
  const userDashboardMetrics = useMemo(() => {
    const currentYear = new Date().getFullYear();

    // 1. User Document Requests Calculations
    const totalRequests = requests.length;
    const completedRequests = requests.filter((r) => ["Completed", "Released"].includes(r.status)).length;
    const pendingRequests = requests.filter((r) => ["Pending", "Processing", "Approved"].includes(r.status)).length;
    const rejectedRequests = requests.filter((r) => ["Rejected", "Cancelled", "Expired"].includes(r.status)).length;
    
    const completionRate = totalRequests > 0 
      ? Math.round((completedRequests / totalRequests) * 100) 
      : 0;

    // 2. Livelihood Applications
    const totalApplications = residentApplications.length;
    const activeApplications = residentApplications.filter((a) => 
      !["Rejected", "Cancelled"].includes(a.status)
    ).length;

    // 3. Announcements Engagement
    const validAnnouncements = publishedAnnouncements.filter((a) => !isAnnouncementExpired(a));
    const relevantAnnouncements = resident
      ? validAnnouncements.filter((a) => doesAnnouncementApplyToResident(a, resident))
      : validAnnouncements;
    const totalAnnouncements = relevantAnnouncements.length;
    const readAnnouncementsCount = relevantAnnouncements.filter((a) => announcementReadIds.includes(a.id)).length;
    const announcementReadRate = totalAnnouncements > 0
      ? Math.round((readAnnouncementsCount / totalAnnouncements) * 100)
      : 100;

    // 4. Profile Completeness Score (Evaluates all essential registered personal details)
    const profileFields = [
      Boolean(resident?.full_name || (resident?.first_name && resident?.last_name) || displayName),
      Boolean(resident?.phone || resident?.telephone || resident?.contact_number),
      Boolean(resident?.email || userData?.email),
      Boolean(resident?.birthday || resident?.birth_date),
      Boolean(resident?.purok || resident?.address),
      Boolean(resident?.civil_status),
      Boolean(resident?.gender || resident?.sex),
    ];
    const filledFields = profileFields.filter(Boolean).length;
    const profileCompleteness = filledFields >= profileFields.length ? 100 : Math.round((filledFields / profileFields.length) * 100);

    // 5. Overall Participation Index Score
    const indexScores = [
      totalRequests > 0 ? completionRate : 100,
      profileCompleteness,
      announcementReadRate,
      totalApplications > 0 ? 100 : 80,
    ];
    const overallIndexScore = Math.round(
      indexScores.reduce((sum, val) => sum + val, 0) / indexScores.length
    );

    // 6. Monthly Volume for Current Year
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyCounts = Array(12).fill(0);
    let totalThisYear = 0;

    requests.forEach((req) => {
      if (!req.created_at) return;
      const d = new Date(req.created_at);
      if (!isNaN(d.getTime()) && d.getFullYear() === currentYear) {
        const m = d.getMonth();
        if (m >= 0 && m < 12) {
          monthlyCounts[m]++;
          totalThisYear++;
        }
      }
    });

    const maxVal = Math.max(...monthlyCounts, 1);
    const monthlyData = monthNames.map((month, idx) => {
      const val = monthlyCounts[idx];
      const heightPercent = val === 0 ? 6 : Math.max(16, Math.round((val / maxVal) * 100));
      return {
        month,
        val,
        height: `${heightPercent}%`,
      };
    });

    let peakMonth = { month: "N/A", val: 0 };
    let lowestActiveMonth = { month: "N/A", val: Infinity };
    let activeMonthsCount = 0;

    monthlyData.forEach((m) => {
      if (m.val > peakMonth.val) {
        peakMonth = m;
      }
      if (m.val > 0) {
        activeMonthsCount++;
        if (m.val < lowestActiveMonth.val) {
          lowestActiveMonth = m;
        }
      }
    });
    if (lowestActiveMonth.val === Infinity) {
      lowestActiveMonth = { month: "N/A", val: 0 };
    }

    // 7. Document Types Breakdown
    const typeMap = {};
    requests.forEach((req) => {
      const raw = req.document_type || "Other Document";
      const clean = raw.replace(/\s*\(Purpose:.*?\)/i, "").replace(/\s*-\s*Purpose:.*$/i, "").trim() || "Other Document";
      typeMap[clean] = (typeMap[clean] || 0) + 1;
    });

    const docPalette = ["#047857", "#0D9488", "#0284C7", "#D97706", "#8B5CF6", "#EC4899", "#10B981"];
    const docEntries = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);

    const docTypeDistribution = docEntries.map(([label, count], i) => {
      const pctNum = totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0;
      return {
        label,
        count,
        pct: `${pctNum}%`,
        percentageNum: pctNum,
        color: docPalette[i % docPalette.length],
      };
    });

    // Donut SVG paths calculations
    let accumulatedOffset = 0;
    const donutSlices = docTypeDistribution.map((item) => {
      const strokeDasharray = `${item.percentageNum} 100`;
      const strokeDashoffset = -accumulatedOffset;
      accumulatedOffset += item.percentageNum;
      return {
        ...item,
        strokeDasharray,
        strokeDashoffset,
      };
    });

    // 8. Recent Activities (what user has done)
    const recentActivities = [];
    requests.slice(0, 5).forEach((r) => {
      recentActivities.push({
        id: `doc-${r.id}`,
        type: "document",
        title: r.document_type || "Document Request",
        subtitle: `Status: ${r.status}`,
        status: isRequestExpired(r) ? "Expired" : r.status,
        date: r.created_at,
        actionKey: "my_documents",
      });
    });

    residentApplications.slice(0, 4).forEach((app) => {
      recentActivities.push({
        id: `app-${app.id}`,
        type: "application",
        title: "Livelihood Application",
        subtitle: `Program Ref: #${app.livelihood_post_id ? String(app.livelihood_post_id).slice(0, 8) : "Job"}`,
        status: app.status || "Pending",
        date: app.created_at,
        actionKey: "livelihood",
      });
    });

    recentActivities.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return {
      currentYear,
      totalRequests,
      completedRequests,
      pendingRequests,
      rejectedRequests,
      completionRate,
      totalApplications,
      activeApplications,
      totalAnnouncements,
      readAnnouncementsCount,
      announcementReadRate,
      profileCompleteness,
      overallIndexScore,
      totalThisYear,
      monthlyData,
      peakMonth,
      lowestActiveMonth,
      activeMonthsCount,
      docTypeDistribution,
      donutSlices,
      recentActivities: recentActivities.slice(0, 6),
    };
  }, [requests, residentApplications, publishedAnnouncements, announcementReadIds, resident]);

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
    const validList = publishedAnnouncements.filter((a) => !isAnnouncementExpired(a));
    const total = validList.length;
    const lastViewedId = localStorage.getItem(`kaagapai_last_viewed_announcement_id_${resident?.id || ""}`);
    let unread = 0;
    if (total > 0 && lastViewedId) {
      unread = validList.filter(a => String(a.id) !== lastViewedId).length;
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
    let list = publishedAnnouncements.filter((a) => !isAnnouncementExpired(a));
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
    let list = publishedAnnouncements.filter((a) => !isAnnouncementExpired(a));
    if (resident) {
      list = list.filter((a) => doesAnnouncementApplyToResident(a, resident));
    }
    return [...list].sort((a, b) => {
      const timeA = new Date(a.publish_date || a.created_at || 0).getTime();
      const timeB = new Date(b.publish_date || b.created_at || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return (b.id || 0) - (a.id || 0);
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

    // Prime speech synthesis on user interaction to unlock audio context in production browsers
    if (voiceEnabled) {
      primeSpeechSynthesis();
    }

    const userMessage = { id: `user-${Date.now()}`, role: "user", text: question };
    const nextMessagesWithUser = [...assistantMessages, userMessage];
    setAssistantMessages(nextMessagesWithUser);
    setAssistantInput("");
    setAssistantLoading(true);

    try {
      const organizationOfficials = getOrganizationOfficials();
      const answer = await askResidentAssistant(question, {
        announcements: publishedAnnouncements,
        documentTemplates,
        opportunities,
        organizationOfficials,
        requests,
        resident,
        residentStats,
      });

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
        const replyId = `assistant-${Date.now()}`;
        speakAssistantText(
          answer,
          () => setSpeakingChatId(replyId),
          () => setSpeakingChatId(null)
        );
      } else {
        stopAssistantSpeech();
        setSpeakingChatId(null);
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
    if (voiceEnabled) {
      primeSpeechSynthesis();
    }
    submitAssistantQuestion(promptText);
  };

  const handleAssistantSubmit = async (event) => {
    event.preventDefault();
    if (voiceEnabled) {
      primeSpeechSynthesis();
    }
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

    const docKey = getRealDocumentTemplateKey(selectedDocumentType);
    let detailSuffix = "";

    if (docKey === "residency") {
      const rec = (requestResidencyRecommendation || requestPurpose || "for a CAFGU").trim();
      detailSuffix = `(Recommendation: ${rec})`;
    } else if (docKey === "4ps") {
      const spouse = (requestFourPsSpouse || "").trim();
      const p = (requestPurpose || (spouse ? `Change Grantee of wife/husband ${spouse} working Abroad` : "4Ps Cash Grant Requirement")).trim();
      detailSuffix = spouse ? `(Grantee: ${spouse}) (Purpose: ${p})` : `(Purpose: ${p})`;
    } else if (docKey === "indigency") {
      const p = (requestPurpose || "whatever legal purpose it may serve best").trim();
      detailSuffix = `(Purpose: ${p})`;
    } else if (docKey === "solo") {
      const isFemale = String(resident?.gender || resident?.sex || "").toLowerCase().includes("female");
      const defaultReason = isFemale ? "death of her husband" : "death of his wife";
      const finalReason = (requestSoloReason || defaultReason).trim();
      if (!finalReason) {
        setRequestMessage({ type: "error", text: "Pakilagay ang dahilan ng pagiging Solo Parent." });
        return;
      }
      detailSuffix = `(Reason: ${finalReason})`;
    } else if (docKey === "business") {
      const biz = (requestBusinessName || requestPurpose || "BANANA BUY AND SALE").trim();
      if (!biz) {
        setRequestMessage({ type: "error", text: "Pakilagay ang Pangalan at Uri ng Negosyo." });
        return;
      }
      detailSuffix = `(Business: ${biz})`;
    } else if (docKey === "rsbsa") {
      const crops = (requestCropsText || "Rice Field ½ hectare, and Fruits Crops 1 hectare").trim();
      const size = (requestFarmSize || "One (1) hectare").trim();
      const tenure = (requestTenure || "Owner").trim();
      detailSuffix = `(Crops: ${crops} | Size: ${size} | Tenure: ${tenure})`;
    } else {
      if (!requestPurpose.trim()) {
        setRequestMessage({ type: "error", text: "Please provide a purpose for your document request." });
        return;
      }
      detailSuffix = `(Purpose: ${requestPurpose.trim()})`;
    }

    setRequesting(true);
    setRequestMessage(null);

    try {
      const cleanDocType = selectedDocumentType.split(" (")[0].trim();
      const finalDocType = `${cleanDocType} ${detailSuffix}`.trim();
      const newRequest = await createDocumentRequest({
        resident_id: resident.id,
        document_type: finalDocType,
      });
      setRequests((current) => [newRequest, ...current]);
      await refreshResidentActivity(resident.id);
      setRequestMessage({
        type: "success",
        text: `Application for ${cleanDocType} submitted successfully.`,
      });
      setRequestPurpose("");
      setRequestSoloReason("");
      setRequestBusinessName("");
      setRequestFourPsSpouse("");
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
  const [editPurpose, setEditPurpose] = useState("");
  const [editResidencyRecommendation, setEditResidencyRecommendation] = useState("for a CAFGU");
  const [editFourPsSpouse, setEditFourPsSpouse] = useState("");
  const [editSoloReason, setEditSoloReason] = useState("");
  const [editBusinessName, setEditBusinessName] = useState("");
  const [editCropsText, setEditCropsText] = useState("Rice Field ½ hectare, and Fruits Crops 1 hectare");
  const [editFarmSize, setEditFarmSize] = useState("One (1) hectare");
  const [editTenure, setEditTenure] = useState("Owner");
  const [updatingRequest, setUpdatingRequest] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState(null);

  const handleOpenEditRequest = (req) => {
    if (isRequestExpired(req)) {
      alert("This document request has expired.");
      return;
    }
    setEditingRequest(req);
    const docTypeRaw = req.document_type || "";
    
    // Match template
    let matchedTemplate = documentTemplates.find((t) => {
      const tName = t.template_name || t.document_type || "";
      return docTypeRaw.toLowerCase().startsWith(tName.toLowerCase());
    });
    
    const cleanType = matchedTemplate ? (matchedTemplate.template_name || matchedTemplate.document_type) : docTypeRaw.split(" (")[0].split(" - ")[0].trim();
    setEditDocumentType(cleanType);

    const docKey = getRealDocumentTemplateKey(cleanType);
    if (docKey === "residency") {
      const match = docTypeRaw.match(/Recommendation:\s*([^)]+)/i);
      setEditResidencyRecommendation(match ? match[1].trim() : "for a CAFGU");
    } else if (docKey === "4ps") {
      const spouseMatch = docTypeRaw.match(/Grantee:\s*([^)]+)/i);
      const purposeMatch = docTypeRaw.match(/Purpose:\s*([^)]+)/i);
      setEditFourPsSpouse(spouseMatch ? spouseMatch[1].trim() : "");
      setEditPurpose(purposeMatch ? purposeMatch[1].trim() : "Change Grantee");
    } else if (docKey === "solo") {
      const reasonMatch = docTypeRaw.match(/Reason:\s*([^)]+)/i);
      const isFemale = String(resident?.gender || resident?.sex || "").toLowerCase().includes("female");
      setEditSoloReason(reasonMatch ? reasonMatch[1].trim() : (isFemale ? "death of her husband" : "death of his wife"));
    } else if (docKey === "business") {
      const bizMatch = docTypeRaw.match(/Business:\s*([^)]+)/i);
      setEditBusinessName(bizMatch ? bizMatch[1].trim() : "BANANA BUY AND SALE");
    } else if (docKey === "rsbsa") {
      const cropsMatch = docTypeRaw.match(/Crops:\s*([^|)]+)/i);
      const sizeMatch = docTypeRaw.match(/Size:\s*([^|)]+)/i);
      const tenureMatch = docTypeRaw.match(/Tenure:\s*([^|)]+)/i);
      setEditCropsText(cropsMatch ? cropsMatch[1].trim() : "Rice Field ½ hectare, and Fruits Crops 1 hectare");
      setEditFarmSize(sizeMatch ? sizeMatch[1].trim() : "One (1) hectare");
      setEditTenure(tenureMatch ? tenureMatch[1].trim() : "Owner");
    } else {
      const purposeMatch = docTypeRaw.match(/Purpose:\s*([^)]+)/i);
      setEditPurpose(purposeMatch ? purposeMatch[1].trim() : parsePurpose(docTypeRaw));
    }
  };

  const handleSaveEditRequest = async (e) => {
    e.preventDefault();
    if (!editingRequest || !editDocumentType) return;

    const docKey = getRealDocumentTemplateKey(editDocumentType);
    let detailSuffix = "";

    if (docKey === "residency") {
      const rec = (editResidencyRecommendation || editPurpose || "for a CAFGU").trim();
      detailSuffix = `(Recommendation: ${rec})`;
    } else if (docKey === "4ps") {
      const spouse = (editFourPsSpouse || "").trim();
      const p = (editPurpose || (spouse ? `Change Grantee of wife/husband ${spouse} working Abroad` : "4Ps Cash Grant Requirement")).trim();
      detailSuffix = spouse ? `(Grantee: ${spouse}) (Purpose: ${p})` : `(Purpose: ${p})`;
    } else if (docKey === "indigency") {
      const p = (editPurpose || "whatever legal purpose it may serve best").trim();
      detailSuffix = `(Purpose: ${p})`;
    } else if (docKey === "solo") {
      const isFemale = String(resident?.gender || resident?.sex || "").toLowerCase().includes("female");
      const defaultReason = isFemale ? "death of her husband" : "death of his wife";
      const finalReason = (editSoloReason || defaultReason).trim();
      detailSuffix = `(Reason: ${finalReason})`;
    } else if (docKey === "business") {
      const biz = (editBusinessName || editPurpose || "BANANA BUY AND SALE").trim();
      detailSuffix = `(Business: ${biz})`;
    } else if (docKey === "rsbsa") {
      const crops = (editCropsText || "Rice Field ½ hectare, and Fruits Crops 1 hectare").trim();
      const size = (editFarmSize || "One (1) hectare").trim();
      const tenure = (editTenure || "Owner").trim();
      detailSuffix = `(Crops: ${crops} | Size: ${size} | Tenure: ${tenure})`;
    } else {
      detailSuffix = `(Purpose: ${(editPurpose || "General Purpose").trim()})`;
    }

    const finalDocType = `${editDocumentType} ${detailSuffix}`.trim();

    setUpdatingRequest(true);
    try {
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
        text: `Document request updated successfully to "${editDocumentType}".`,
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
      message: `Are you sure you want to delete the record for "${req.document_type}" from your history?`,
      confirmText: "Delete Log",
      cancelText: "Cancel",
      confirmVariant: "danger",
    });
    if (!ok) return;

    try {
      await deleteDocumentRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      setSelectedLogIds((prev) => prev.filter((id) => id !== req.id));
      setRequestMessage({
        type: "success",
        text: `Log for "${req.document_type}" has been deleted successfully.`,
      });
    } catch (err) {
      console.error("Failed to delete request:", err);
      setRequestMessage({
        type: "error",
        text: err.message || "Failed to delete request log.",
      });
    }
  };

  const handleDeleteSelectedLogsAction = async () => {
    if (selectedLogIds.length === 0) return;
    const ok = await confirm({
      title: "Delete Selected Document Logs?",
      message: `Are you sure you want to delete ${selectedLogIds.length} selected document log(s) from your history?`,
      confirmText: `Delete ${selectedLogIds.length} Log(s)`,
      cancelText: "Cancel",
      confirmVariant: "danger",
    });
    if (!ok) return;

    setDeletingLogs(true);
    try {
      await deleteDocumentRequests(selectedLogIds);
      const count = selectedLogIds.length;
      setRequests((prev) => prev.filter((r) => !selectedLogIds.includes(r.id)));
      setSelectedLogIds([]);
      setRequestMessage({
        type: "success",
        text: `Successfully deleted ${count} document log(s).`,
      });
    } catch (err) {
      console.error("Failed to delete selected requests:", err);
      try {
        await Promise.allSettled(selectedLogIds.map((id) => deleteDocumentRequest(id)));
        setRequests((prev) => prev.filter((r) => !selectedLogIds.includes(r.id)));
        setSelectedLogIds([]);
      } catch (fallbackErr) {
        console.error("Fallback delete error:", fallbackErr);
      }
    } finally {
      setDeletingLogs(false);
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

  const handleCancelPersonalInfo = useCallback(() => {
    if (resident) {
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
        birthplace: resident.birthplace || "",
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
        house_no: resident.house_no || "",
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
        pwd_type: resident.pwd_type || "",
        is_solo_parent: Boolean(resident.is_solo_parent),
        is_4ps_member: Boolean(resident.is_4ps_member),
        indigenous_group: resident.indigenous_group || "",
        philhealth_no: resident.philhealth_no || "",
        sss_no: resident.sss_no || "",
        tin_no: resident.tin_no || "",
      });
    }
    setProfileMessage(null);

    const targetNav = previousNav && previousNav !== "personal_info" ? previousNav : "home";
    setActiveNav(targetNav);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [resident, previousNav]);

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

  // Change Username with password verification
  const handleUsernameChange = async (e) => {
    if (e) e.preventDefault();
    const trimmedUsername = (newUsername || "").trim().toLowerCase();
    if (!trimmedUsername) {
      setCredentialMessage({ type: "error", text: "Please enter a new username." });
      return;
    }
    if (trimmedUsername === residentUsername) {
      setCredentialMessage({ type: "error", text: "New username is the same as the current one." });
      return;
    }
    if (!credentialPassword.trim()) {
      setCredentialMessage({ type: "error", text: "Please enter your current password to verify." });
      return;
    }

    setSavingCredential(true);
    setCredentialMessage(null);

    try {
      const result = await updateResidentCredentials({
        currentUsername: residentUsername,
        currentPassword: credentialPassword,
        newUsername: trimmedUsername,
        newPassword: credentialPassword, // keep same password
      });

      const nextSession = { ...resident, username: trimmedUsername };
      saveResidentSession(nextSession);
      setResident(nextSession);
      setEditingUsername(false);
      setCredentialPassword("");
      setNewUsername("");
      setCredentialMessage({ type: "success", text: `Username updated to "${trimmedUsername}". Admin records synchronized.` });
    } catch (err) {
      setCredentialMessage({ type: "error", text: err.message || "Failed to update username. Please verify your password." });
    } finally {
      setSavingCredential(false);
    }
  };

  // Change Email with direct database sync
  const handleEmailChange = async (e) => {
    if (e) e.preventDefault();
    const trimmedEmail = (newEmail || "").trim().toLowerCase();
    if (!trimmedEmail) {
      setCredentialMessage({ type: "error", text: "Please enter a new email address." });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setCredentialMessage({ type: "error", text: "Please enter a valid email address." });
      return;
    }
    if (trimmedEmail === (resident?.email || "").toLowerCase()) {
      setCredentialMessage({ type: "error", text: "New email is the same as the current one." });
      return;
    }
    if (!credentialPassword.trim()) {
      setCredentialMessage({ type: "error", text: "Please enter your current password to verify." });
      return;
    }

    setSavingCredential(true);
    setCredentialMessage(null);

    try {
      await updateResidentProfileDirect({
        residentId: resident.id,
        currentUsername: residentUsername,
        currentPassword: credentialPassword,
        requestedUsername: null,
        changes: { email: trimmedEmail },
      });

      const nextSession = { ...resident, email: trimmedEmail };
      saveResidentSession(nextSession);
      setResident(nextSession);
      setEditingEmail(false);
      setCredentialPassword("");
      setNewEmail("");
      setCredentialMessage({ type: "success", text: `Email updated to "${trimmedEmail}". Admin records synchronized.` });
    } catch (err) {
      setCredentialMessage({ type: "error", text: err.message || "Failed to update email. Please verify your password." });
    } finally {
      setSavingCredential(false);
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

  const renderDocumentRequestForm = () => {
    const docKey = getRealDocumentTemplateKey(selectedDocumentType);
    const isFemale = String(resident?.gender || resident?.sex || "").toLowerCase().includes("female");

    return (
      <form onSubmit={handleDocumentRequest} className="space-y-4 text-slate-800">
        {/* Document Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-black uppercase tracking-wider text-emerald-200 drop-shadow-xs">
            SELECT DOCUMENT (CLEARANCE / CERTIFICATE) *
          </label>
          <select
            value={selectedDocumentType}
            onChange={(event) => {
              const val = event.target.value;
              setSelectedDocumentType(val);
              const nextKey = getRealDocumentTemplateKey(val);
              if (nextKey === "solo" && !requestSoloReason) {
                setRequestSoloReason(isFemale ? "death of her husband" : "death of his wife");
              }
            }}
            className="w-full rounded-2xl border border-slate-300 bg-white/95 backdrop-blur-md px-4 py-3 text-xs font-bold text-slate-900 outline-none transition-all focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 shadow-xs cursor-pointer"
          >
            {documentTemplates.length === 0 ? (
              <option value="">No templates available</option>
            ) : (
              documentTemplates.map((template) => (
                <option key={template.id} value={template.document_type || template.template_name}>
                  {template.template_name || template.document_type}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Auto-filled Info Summary Card */}
        <div className="rounded-2xl bg-white/95 border-2 border-emerald-300/80 p-3.5 text-xs space-y-1.5 shadow-sm">
          <p className="font-extrabold text-[#064e3b] uppercase text-[10.5px] tracking-wider flex items-center gap-1.5">
            <UserCheck size={15} className="text-emerald-700 shrink-0" />
            <span>AUTOMATICALLY APPLIED FROM YOUR RESIDENT PROFILE:</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1.5 text-[11px] text-slate-700 font-semibold pt-0.5">
            <p>Full Name: <b className="text-slate-950 font-black">{resident?.full_name || displayName}</b></p>
            <p>Sex / Gender: <b className="text-slate-950 font-black">{resident?.gender || resident?.sex || "Male"}</b></p>
            <p>Age: <b className="text-slate-950 font-black">{resident?.age || calculateAge(resident?.birth_date) || "Legal age"} yrs. old</b></p>
            <p>Birthdate: <b className="text-slate-950 font-black">{resident?.birth_date ? formatBirthdate(resident.birth_date) : "N/A"}</b></p>
            <p>Civil Status: <b className="text-slate-950 font-black">{resident?.civil_status || "Single"}</b></p>
            <p>Purok / Zone: <b className="text-slate-950 font-black">Purok {resident?.purok || "Upper Mingading"}</b></p>
          </div>
        </div>

        {/* ─── DYNAMIC TEMPLATE-SPECIFIC FIELDS ─── */}

        {/* 1. RESIDENCY CERTIFICATION FIELDS */}
        {docKey === "residency" && (
          <div className="space-y-2 rounded-2xl bg-white/95 border-2 border-blue-300 p-3.5 shadow-sm">
            <label className="block text-xs font-black uppercase tracking-wider text-blue-950 flex items-center justify-between">
              <span>RECOMMENDATION / PURPOSE (PEACE & ORDER) *</span>
              <span className="text-[10px] text-blue-700 font-bold">Certificate of Residency</span>
            </label>
            <p className="text-[10.5px] text-blue-900 font-medium">
              Select purpose or specify why the barangay peace and order committee recommends you:
            </p>
            <select
              value={requestResidencyPreset}
              onChange={(e) => {
                const val = e.target.value;
                setRequestResidencyPreset(val);
                if (val !== "custom") {
                  setRequestResidencyRecommendation(val);
                  setRequestPurpose(val);
                } else {
                  setRequestResidencyRecommendation("");
                }
              }}
              className="w-full rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
            >
              <option value="for a CAFGU">for a CAFGU</option>
              <option value="for Local Employment">for Local Employment</option>
              <option value="for Scholarship">for Scholarship / School Requirement</option>
              <option value="for Bank Account Opening">for Bank Account Opening / Loan</option>
              <option value="for Barangay ID Application">for Barangay ID Application</option>
              <option value="for Police Clearance">for Police Clearance / NBI Requirement</option>
              <option value="for Postal ID Application">for Postal ID Application</option>
              <option value="for whatever legal purpose it may serve best">for whatever legal purpose it may serve best</option>
              <option value="custom">Other Purpose (Custom)</option>
            </select>
            <input
              type="text"
              value={requestResidencyRecommendation}
              onChange={(e) => {
                setRequestResidencyPreset("custom");
                setRequestResidencyRecommendation(e.target.value);
                setRequestPurpose(e.target.value);
              }}
              placeholder="e.g., for a CAFGU / for Local Employment"
              className="w-full rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500 shadow-2xs"
              required
            />
            <p className="text-[10px] text-blue-800 italic font-medium">
              Will appear on certificate as: <em>"From our barangay peace and order committee we are recommending {isFemale ? "her" : "him"} <b>{requestResidencyRecommendation || "____________________"}</b>.."</em>
            </p>
          </div>
        )}

        {/* 2. 4PS CERTIFICATION FIELDS */}
        {docKey === "4ps" && (
          <div className="space-y-2.5 rounded-2xl bg-white/95 border-2 border-emerald-300 p-3.5 shadow-sm">
            <label className="block text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center justify-between">
              <span>4PS PURPOSE / GRANTEE DETAILS *</span>
              <span className="text-[10px] text-emerald-700 font-bold">4Ps Certificate</span>
            </label>
            <select
              value={requestFourPsPreset}
              onChange={(e) => {
                const val = e.target.value;
                setRequestFourPsPreset(val);
                const rel = isFemale ? "her husband" : "her wife";
                if (val === "change_grantee_abroad") {
                  setRequestPurpose(requestFourPsSpouse ? `Change Grantee of ${rel} ${requestFourPsSpouse} working Abroad` : `Change Grantee of ${rel} working Abroad`);
                } else if (val === "change_grantee_transfer") {
                  setRequestPurpose("Change Grantee / Transfer of Cash Grant Beneficiary");
                } else if (val === "cash_grant_requirement") {
                  setRequestPurpose("Pantawid Pamilyang Pilipino Program (4Ps) Requirement");
                } else if (val === "member_verification") {
                  setRequestPurpose("4Ps Beneficiary & Household Member Verification");
                } else if (val === "profile_update") {
                  setRequestPurpose("Updating of 4Ps Household Profile & Records");
                } else {
                  setRequestPurpose("whatever legal purpose it may serve best");
                }
              }}
              className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 shadow-2xs cursor-pointer"
            >
              <option value="change_grantee_abroad">Change Grantee (Spouse Working Abroad)</option>
              <option value="change_grantee_transfer">Change Grantee / Transfer of Cash Grant Beneficiary</option>
              <option value="cash_grant_requirement">4Ps Cash Grant / Program Requirement</option>
              <option value="member_verification">4Ps Beneficiary & Household Member Verification</option>
              <option value="profile_update">Updating of 4Ps Household Profile & Records</option>
              <option value="legal_purpose">Whatever legal purpose it may serve best</option>
              <option value="custom">Other Purpose (Custom)</option>
            </select>

            <div>
              <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Name of Spouse / Current Grantee Abroad (for Change Grantee):</label>
              <input
                type="text"
                value={requestFourPsSpouse}
                onChange={(e) => {
                  const spouse = e.target.value;
                  setRequestFourPsSpouse(spouse);
                  const rel = isFemale ? "her husband" : "her wife";
                  setRequestPurpose(spouse ? `Change Grantee of ${rel} ${spouse} working Abroad` : `Change Grantee of ${rel} working Abroad`);
                }}
                placeholder="e.g., Maria Balad"
                className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 shadow-2xs"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Full Purpose Text (Appears on Certificate):</label>
              <input
                type="text"
                value={requestPurpose || `Change Grantee of ${isFemale ? "her husband" : "her wife"} working Abroad`}
                onChange={(e) => {
                  setRequestFourPsPreset("custom");
                  setRequestPurpose(e.target.value);
                }}
                className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 shadow-2xs"
                required
              />
            </div>
          </div>
        )}

        {/* 3. CERTIFICATE OF INDIGENCY FIELDS */}
        {docKey === "indigency" && (
          <div className="space-y-2 rounded-2xl bg-white/95 border-2 border-emerald-300 p-3.5 shadow-sm">
            <label className="block text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center justify-between">
              <span>TYPE OF ASSISTANCE / PURPOSE *</span>
              <span className="text-[10px] text-emerald-700 font-bold">Certificate of Indigency</span>
            </label>
            <select
              value={requestIndigencyPreset}
              onChange={(e) => {
                const val = e.target.value;
                setRequestIndigencyPreset(val);
                if (val !== "custom") {
                  setRequestPurpose(val);
                } else {
                  setRequestPurpose("");
                }
              }}
              className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 shadow-2xs cursor-pointer"
            >
              <option value="MEDICAL ASSISTANCE">Medical Assistance</option>
              <option value="HOSPITALIZATION">Hospitalization</option>
              <option value="FINANCIAL ASSISTANCE">Financial Assistance</option>
              <option value="BURIAL ASSISTANCE">Burial Assistance</option>
              <option value="EDUCATIONAL ASSISTANCE">Educational Assistance</option>
              <option value="LEGAL ASSISTANCE">Public Attorney / Legal Assistance</option>
              <option value="whatever legal purpose it may serve best">General / Whatever legal purpose it may serve best</option>
              <option value="custom">Other Purpose (Custom)</option>
            </select>
            <input
              type="text"
              value={requestPurpose || requestIndigencyPreset}
              onChange={(e) => {
                setRequestIndigencyPreset("custom");
                setRequestPurpose(e.target.value);
              }}
              placeholder="e.g., MEDICAL ASSISTANCE / HOSPITALIZATION"
              className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 shadow-2xs"
              required
            />
          </div>
        )}

        {/* 4. BARANGAY CLEARANCE FIELDS */}
        {docKey === "clearance" && (
          <div className="space-y-2 rounded-2xl bg-white/95 border-2 border-emerald-300 p-3.5 shadow-sm">
            <label className="block text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center justify-between">
              <span>PURPOSE OF BARANGAY CLEARANCE *</span>
              <span className="text-[10px] text-emerald-700 font-bold">Barangay Clearance</span>
            </label>
            <select
              value={requestClearancePreset}
              onChange={(e) => {
                const val = e.target.value;
                setRequestClearancePreset(val);
                if (val !== "custom") {
                  setRequestPurpose(val);
                } else {
                  setRequestPurpose("");
                }
              }}
              className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 shadow-2xs cursor-pointer"
            >
              <option value="OWWA">OWWA / Overseas Worker</option>
              <option value="LOCAL EMPLOYMENT">Local Employment</option>
              <option value="POSTAL ID">Postal ID Application</option>
              <option value="NBI CLEARANCE">NBI Clearance Application</option>
              <option value="POLICE CLEARANCE">Police Clearance Application</option>
              <option value="BANK REQUIREMENT">Bank Account / Loan Requirement</option>
              <option value="SCHOOL REQUIREMENT">School / Scholarship Requirement</option>
              <option value="LEGAL PURPOSE">Whatever legal purpose it may serve best</option>
              <option value="custom">Other Purpose (Custom)</option>
            </select>
            <input
              type="text"
              value={requestPurpose || requestClearancePreset}
              onChange={(e) => {
                setRequestClearancePreset("custom");
                setRequestPurpose(e.target.value);
              }}
              placeholder="e.g., OWWA / LOCAL EMPLOYMENT"
              className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 shadow-2xs"
              required
            />
          </div>
        )}

        {/* 5. SOLO PARENT CERTIFICATION FIELDS */}
        {docKey === "solo" && (
          <div className="space-y-2 rounded-2xl bg-white/95 border-2 border-amber-300 p-3.5 shadow-sm">
            <label className="block text-xs font-black uppercase tracking-wider text-amber-950">
              REASON FOR SOLO PARENT APPLICATION *
            </label>
            <p className="text-[10.5px] text-amber-900 font-medium">
              Select reason or specify the exact circumstance to be stated on the certificate:
            </p>
            <select
              value={requestSoloReasonPreset}
              onChange={(e) => {
                const val = e.target.value;
                setRequestSoloReasonPreset(val);
                if (val === "death") {
                  setRequestSoloReason(isFemale ? "death of her husband" : "death of his wife");
                } else if (val === "separation") {
                  setRequestSoloReason(isFemale ? "separation from her husband" : "separation from his wife");
                } else if (val === "abandonment") {
                  setRequestSoloReason(isFemale ? "abandonment by her husband" : "abandonment by his wife");
                } else if (val === "unwed") {
                  setRequestSoloReason(isFemale ? "being an unmarried mother" : "being a single father");
                } else if (val === "detention") {
                  setRequestSoloReason("incarceration / detention of spouse");
                } else {
                  setRequestSoloReason("");
                }
              }}
              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
            >
              <option value="death">Death of Spouse (Death of {isFemale ? "her husband" : "his wife"})</option>
              <option value="separation">Separation from Spouse (Separation from {isFemale ? "her husband" : "his wife"})</option>
              <option value="abandonment">Abandonment by Spouse</option>
              <option value="unwed">Single Parent / Unmarried ({isFemale ? "unmarried mother" : "single father"})</option>
              <option value="detention">Incarceration / Detention of Spouse</option>
              <option value="custom">Other Reason (Custom)</option>
            </select>

            <input
              type="text"
              value={requestSoloReason || (isFemale ? "death of her husband" : "death of his wife")}
              onChange={(e) => {
                setRequestSoloReasonPreset("custom");
                setRequestSoloReason(e.target.value);
              }}
              placeholder="e.g., death of her husband / separation from spouse"
              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-amber-500 shadow-2xs"
              required
            />
            <p className="text-[10px] text-amber-800 italic font-medium">
              Preview: "...on application for solo parent due to <b>{requestSoloReason || (isFemale ? "death of her husband" : "death of his wife")}</b> and whatever any legal intent may serve best."
            </p>
          </div>
        )}

        {/* 6. BUSINESS PERMIT FIELDS */}
        {docKey === "business" && (
          <div className="space-y-2 rounded-2xl bg-white/95 border-2 border-blue-300 p-3.5 shadow-sm">
            <label className="block text-xs font-black uppercase tracking-wider text-blue-950">
              BUSINESS NAME & NATURE *
            </label>
            <input
              type="text"
              value={requestBusinessName || requestPurpose}
              onChange={(e) => {
                setRequestBusinessName(e.target.value);
                setRequestPurpose(e.target.value);
              }}
              placeholder="e.g., BANANA BUY AND SALE / SARI-SARI STORE"
              className="w-full rounded-xl border border-blue-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500 shadow-2xs"
              required
            />
            <p className="text-[10px] text-blue-800 italic font-medium">
              Preview: "...and he/she has a <b>{(requestBusinessName || requestPurpose || "BANANA BUY AND SALE").toUpperCase()}</b> at the said place."
            </p>
          </div>
        )}

        {/* 7. RSBSA CERTIFICATION FIELDS */}
        {docKey === "rsbsa" && (
          <div className="space-y-2.5 rounded-2xl bg-white/95 border-2 border-emerald-300 p-3.5 shadow-sm">
            <label className="block text-xs font-black uppercase tracking-wider text-emerald-950">
              CROP & FARM DETAILS *
            </label>
            <div>
              <span className="text-[10.5px] font-bold text-slate-700 block mb-1">Tilling Crop(s) / Farm Commodity:</span>
              <input
                type="text"
                value={requestCropsText}
                onChange={(e) => setRequestCropsText(e.target.value)}
                placeholder="e.g., Rice Field ½ hectare, and Fruit Crops 1 hectare"
                className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600 shadow-2xs"
                required
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[
                  "Rice Field ½ hectare, and Fruits Crops 1 hectare",
                  "Rice Field 1 hectare",
                  "Corn Field 1 hectare",
                  "Coconut Farm 2 hectares",
                  "Vegetable Farm ½ hectare",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRequestCropsText(preset)}
                    className="rounded-lg bg-emerald-100/80 hover:bg-emerald-200/90 px-2 py-0.5 text-[9px] font-bold text-emerald-900 border border-emerald-300 transition-colors cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10.5px] font-bold text-slate-700 block mb-1">Farm Size:</span>
                <input
                  type="text"
                  value={requestFarmSize}
                  onChange={(e) => setRequestFarmSize(e.target.value)}
                  placeholder="e.g., One (1) hectare"
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600 shadow-2xs"
                  required
                />
              </div>
              <div>
                <span className="text-[10.5px] font-bold text-slate-700 block mb-1">Land Tenure:</span>
                <select
                  value={requestTenure}
                  onChange={(e) => setRequestTenure(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 shadow-2xs cursor-pointer"
                >
                  <option value="Owner">Owner</option>
                  <option value="Farmer">Farmer</option>
                  <option value="Tenant">Tenant</option>
                  <option value="Lessee">Lessee</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 8. FALLBACK GENERAL PURPOSE */}
        {docKey !== "residency" && docKey !== "4ps" && docKey !== "indigency" && docKey !== "clearance" && docKey !== "solo" && docKey !== "business" && docKey !== "rsbsa" && (
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-wider text-emerald-200 drop-shadow-xs">
              PURPOSE OF REQUEST *
            </label>
            <textarea
              value={requestPurpose}
              onChange={(event) => setRequestPurpose(event.target.value)}
              placeholder="Enter purpose (e.g., OWWA, Local Employment, Scholarship, Postal ID, Bank, etc.)"
              className="w-full rounded-2xl border border-slate-300 bg-white/95 backdrop-blur-md px-4 py-3 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 shadow-xs"
              rows={2}
              required
            />
            {/* Quick Purpose Suggestion Chips */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {quickPurposes.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setRequestPurpose(p)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    requestPurpose === p
                      ? "bg-[#0B5D3B] text-white border-[#0B5D3B] shadow-xs"
                      : "bg-white/90 hover:bg-emerald-50 text-slate-800 border-slate-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {requestMessage && (
          <div
            className={`rounded-2xl px-4 py-3 text-xs font-black backdrop-blur-md shadow-lg transition-all ${
              requestMessage.type === "success"
                ? "border-2 border-emerald-400 bg-emerald-950/95 text-emerald-200 shadow-emerald-950/50"
                : "border-2 border-rose-400 bg-rose-950/95 text-rose-200 shadow-rose-950/50"
            }`}
          >
            {requestMessage.text}
          </div>
        )}

        <button
          type="submit"
          disabled={requesting || !selectedDocumentType}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#033E2A] via-[#045438] to-[#03442E] hover:opacity-95 active:scale-[0.99] py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-950/30 transition-all border border-emerald-400/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {requesting ? <Loader size={14} className="animate-spin text-white" /> : <PlusCircle size={14} className="text-white" />}
          <span className="text-white font-bold">{requesting ? "Submitting application..." : "Submit Application"}</span>
        </button>
      </form>
    );
  };

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
      className={`app-shell font-sans antialiased bg-gradient-to-br from-[#1c6448] via-[#247b59] to-[#17523c] text-white relative overflow-hidden min-h-screen ${isDarkMode ? "dark" : ""} ${fontSize === "small" ? "text-sm" : fontSize === "large" ? "text-sm" : "text-xs"}`}
      style={{
        gridTemplateColumns: isDesktop ? (sidebarCollapsed ? "80px 1fr" : "260px 1fr") : "1fr"
      }}
    >
      
      {/* 1. Desktop Sidebar Container */}
      <div 
        className="relative z-[100] h-full hidden lg:block"
        style={{ width: sidebarCollapsed ? "80px" : "260px" }}
      >
        <aside 
          className={`app-sidebar ${effectiveSidebarCollapsed ? "collapsed-sidebar" : "expanded-sidebar-hover"} flex flex-col justify-between transition-all duration-300 ease-in-out absolute left-0 top-0 h-full shadow-2xl bg-emerald-950/40 backdrop-blur-2xl border-r border-white/20 text-white overflow-hidden`}
          style={{
            width: effectiveSidebarCollapsed ? "80px" : "260px",
            padding: effectiveSidebarCollapsed ? "20px 8px" : "20px 14px",
            zIndex: 100,
          }}
        >
          {/* Subtle Graphic Background Silk Curves */}
          {!effectiveSidebarCollapsed && (
            <svg className="absolute bottom-0 left-0 w-full h-80 pointer-events-none opacity-20 z-0" viewBox="0 0 260 320" fill="none">
              <path d="M-20 200 C60 140, 160 280, 280 180" stroke="#34D399" strokeWidth="1.5" />
              <path d="M-40 240 C40 180, 180 300, 300 220" stroke="#10B981" strokeWidth="1" />
              <path d="M-10 280 C80 220, 140 320, 270 260" stroke="#059669" strokeWidth="1.2" />
            </svg>
          )}

          <div className="flex flex-col justify-between h-full w-full relative z-10">
            <div>
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/15">
                {!effectiveSidebarCollapsed && (
                  <div className="flex items-center gap-3 animate-fadeIn">
                    <div className="relative flex items-center justify-center shrink-0">
                      <img
                        src={barangayLogo || "/logo.png"}
                        alt="Brgy. Seal"
                        className="h-10 w-10 shrink-0 object-contain rounded-full shadow-md relative z-10"
                        style={{ width: "40px", height: "40px", minWidth: "40px", minHeight: "40px" }}
                        onError={(e) => {
                          e.target.src = "/logo.png";
                        }}
                      />
                    </div>
                    <div className="min-w-0 animate-fadeIn">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200">Upper Mingading</p>
                      <h2 className="text-sm font-black text-white truncate tracking-tight">KaagapAI</h2>
                    </div>
                  </div>
                )}
                {effectiveSidebarCollapsed && (
                  <div className="flex justify-center w-full animate-fadeIn mb-2">
                    <div className="relative flex items-center justify-center shrink-0">
                      <img
                        src={barangayLogo || "/logo.png"}
                        alt="Brgy. Seal"
                        className="h-9 w-9 object-contain rounded-full shadow-md relative z-10"
                        onError={(e) => {
                          e.target.src = "/logo.png";
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Desktop Collapse / Pin Button */}
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20 active:scale-95 ml-auto cursor-pointer"
                  title={sidebarCollapsed ? "Pin Sidebar Open" : "Collapse Sidebar"}
                >
                  {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
              </div>

              <nav className="space-y-1.5">
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
                      className={`nav-item relative w-full transition-all duration-200 cursor-pointer ${
                        active 
                          ? "bg-emerald-500/25 text-white shadow-lg border border-emerald-400/50 backdrop-blur-md rounded-xl" 
                          : "text-emerald-100/90 hover:bg-white/10 hover:text-white rounded-xl"
                      } ${effectiveSidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3.5 py-2.5"}`}
                      title={effectiveSidebarCollapsed ? item.label : undefined}
                    >
                      {/* Active Left Glowing Indicator Bar */}
                      {active && (
                        <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full bg-[#10B981] shadow-[0_0_12px_#10B981]" />
                      )}
                      <Icon size={18} className={`shrink-0 ${active ? "text-emerald-300" : "text-emerald-200/80"}`} />
                      {!effectiveSidebarCollapsed && (
                        <span className={`nav-label ml-2.5 truncate text-left text-xs ${active ? "font-black text-white" : "font-bold text-emerald-100/90"}`}>
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                })}
                
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`nav-item w-full text-rose-200 hover:bg-rose-950/40 hover:text-rose-100 border border-transparent hover:border-rose-400/30 rounded-xl mt-3 cursor-pointer transition ${effectiveSidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3.5 py-2.5"}`}
                  title={effectiveSidebarCollapsed ? "Logout" : undefined}
                >
                  <LogOut size={18} className="shrink-0 text-rose-400" />
                  {!effectiveSidebarCollapsed && <span className="nav-label ml-2.5 text-xs font-bold text-rose-200">Logout</span>}
                </button>
              </nav>
            </div>

            {/* Bottom Sidebar Office Card */}
            {!effectiveSidebarCollapsed && (
              <div className="mt-auto pt-4 pb-2 px-1">
                <div className="rounded-2xl bg-white/10 border border-white/20 p-3 text-center text-white space-y-1.5 shadow-lg backdrop-blur-xl relative overflow-hidden group">
                  <div className="relative mx-auto w-14 h-14 rounded-2xl overflow-hidden shadow-md border border-white/20 bg-emerald-900/40 p-1 flex items-center justify-center">
                    <img
                      src="/3d-barangay-hall.png"
                      alt="Barangay Hall 3D"
                      className="w-full h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <h4 className="text-xs font-black text-white tracking-wide">Barangay Office</h4>
                  <p className="text-[10.5px] font-bold text-emerald-300">Barangay Hall</p>
                  <p className="text-[9.5px] italic text-emerald-200/85 pt-1 border-t border-white/10">Serbisyong Tapat, Para sa Lahat.</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile Drawer Backdrop & Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-[9900] lg:hidden animate-fadeIn backdrop-blur-xs"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside 
        className={`app-sidebar lg:hidden ${mobileSidebarOpen ? "open" : ""} flex flex-col justify-between p-4 z-[9950] bg-emerald-950/80 backdrop-blur-2xl border-r border-white/20 text-white shadow-2xl overflow-hidden`}
      >
        <div className="flex flex-col justify-between h-full w-full relative z-10">
          <div>
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/15">
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center shrink-0">
                  <img
                    src={barangayLogo || "/logo.png"}
                    alt="Brgy. Seal"
                    className="h-9 w-9 shrink-0 object-contain rounded-full shadow-sm relative z-10"
                    onError={(e) => {
                      e.target.src = "/logo.png";
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-200">Upper Mingading</p>
                  <h2 className="text-xs font-black text-white truncate">KaagapAI</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-full p-1.5 hover:bg-white/10 text-white cursor-pointer"
              >
                <X size={18} />
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
                      setMobileSidebarOpen(false);
                    }}
                    className={`nav-item relative w-full ${
                      active 
                        ? "bg-emerald-500/25 text-white font-black shadow-md border border-emerald-400/50 backdrop-blur-md rounded-xl" 
                        : "text-emerald-100/90 hover:bg-white/10 hover:text-white rounded-xl"
                    } px-3 py-2.5 cursor-pointer`}
                  >
                    {active && (
                      <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-5 rounded-r-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                    )}
                    <Icon size={17} className={`shrink-0 ${active ? "text-emerald-300" : "text-emerald-200/80"}`} />
                    <span className="nav-label ml-2.5 truncate text-left text-xs font-bold">{item.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleLogout}
                className="nav-item w-full text-rose-200 hover:bg-rose-950/40 hover:text-rose-100 mt-2 px-3 py-2.5 cursor-pointer border-t border-white/10 rounded-xl"
              >
                <LogOut size={17} className="shrink-0 text-rose-400" />
                <span className="nav-label ml-2.5 text-xs font-bold text-rose-200">Logout</span>
              </button>
            </nav>
          </div>

          <div className="mt-auto pt-4 pb-2 text-center">
            <div className="rounded-xl bg-white/10 p-3 text-white text-xs border border-white/20 space-y-1 shadow-md backdrop-blur-xl">
              <div className="w-11 h-11 mx-auto rounded-xl overflow-hidden bg-emerald-900/60 p-0.5 border border-white/20 flex items-center justify-center">
                <img
                  src="/3d-barangay-hall.png"
                  alt="Barangay Hall 3D"
                  className="w-full h-full object-contain drop-shadow-md"
                />
              </div>
              <p className="font-bold text-xs mt-1">Barangay Office</p>
              <p className="text-[10px] text-emerald-300">Serbisyong Tapat, Para sa Lahat.</p>
            </div>
          </div>
        </div>
      </aside>

        {/* Main Content Area: Medium Emerald Glass Green Finish (Matching Sample 2) */}
        <main className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-[#1c6448] via-[#247b59] to-[#17523c] text-white relative overflow-hidden min-h-screen">
          {/* Ambient Glass Reflection Glows */}
          <div className="absolute top-10 right-10 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-teal-200/15 rounded-full blur-3xl pointer-events-none" />

          {/* DEDICATED FULLSCREEN TOP HEADER BAR (Sleek Dark Green Finish!) */}
          <header className="w-full relative bg-gradient-to-r from-[#033E2A] via-[#045438] to-[#03442E] text-white border-b-2 border-emerald-400/40 px-3 sm:px-8 py-2.5 sm:py-4.5 min-h-[58px] sm:min-h-[95px] flex items-center justify-between sticky top-0 z-30 shadow-xl">
            {/* Top Glossy Glass Sheen Effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-white/10 to-transparent pointer-events-none rounded-b-xl" />

            {/* Left: Greeting & Resident Name */}
            <div className="flex items-center gap-2.5 sm:gap-4.5 min-w-0 flex-1 relative z-10">

              <div className="min-w-0 space-y-0.5 sm:space-y-1">
                <div className="inline-flex items-center gap-1.5 bg-white/25 backdrop-blur-md border border-white/35 text-white text-[9.5px] sm:text-xs font-black px-2.5 py-0.5 rounded-full shadow-xs">
                  <span>{dynamicGreeting},</span>
                  <span>☀️</span>
                </div>
                <h1 className="text-xs sm:text-2xl font-black text-white leading-tight truncate flex items-center gap-1.5 sm:gap-2.5 drop-shadow-md font-sans tracking-tight">
                  {displayName}
                  <span className="text-xs sm:text-2xl shrink-0">👋</span>
                </h1>
              </div>
            </div>

            {/* Right: Bell Notification & Profile Avatar with Dropdowns */}
            <div className="flex items-center gap-2 sm:gap-3.5 shrink-0 relative z-10">

              {/* Bell Notification Button */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => { setShowAccountMenu(false); setShowNotificationMenu(!showNotificationMenu); }}
                  className="relative flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-full border-2 border-white/30 bg-emerald-950/50 text-white hover:bg-emerald-900/70 shadow-xl backdrop-blur-md transition active:scale-95 cursor-pointer"
                  title="Notifications"
                >
                  <Bell size={16} className="sm:hidden text-white drop-shadow-xs" />
                  <Bell size={20} className="hidden sm:block text-white drop-shadow-xs" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 sm:h-5 min-w-[1rem] sm:min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[8px] sm:text-[10px] font-black text-white ring-2 ring-white animate-pulse shadow-md">
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
                        className="fixed top-16 left-3 right-3 sm:absolute sm:right-0 sm:left-auto sm:top-full sm:mt-2 sm:w-80 sm:max-w-none overflow-hidden rounded-2xl border border-white/20 shadow-2xl bg-[#02221A]/95 backdrop-blur-xl text-white z-[999999]"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      >
                        <div className="flex items-center justify-between border-b px-4 py-3 border-white/10 bg-white/5">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black uppercase tracking-wider text-white">Notifications</p>
                            {unreadNotificationCount > 0 && (
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-black bg-rose-500/30 text-rose-200 border border-rose-400/30">
                                {unreadNotificationCount} New
                              </span>
                            )}
                          </div>
                          {unreadNotificationCount > 0 && (
                            <button
                              type="button"
                              onClick={handleMarkAllNotificationsRead}
                              className="text-[10px] font-bold text-emerald-300 hover:text-emerald-200 hover:underline cursor-pointer"
                            >
                              Mark all read
                            </button>
                          )}
                        </div>
                        <div className="max-h-72 divide-y divide-white/10 overflow-y-auto">
                          {allNotificationsMerged.length === 0 ? (
                            <div className="p-6 text-center text-xs text-white/60 font-bold flex flex-col items-center gap-1.5">
                              <CheckCircle2 size={18} className="text-emerald-400" />
                              <span>No notifications right now.</span>
                            </div>
                          ) : (
                            allNotificationsMerged.map((n) => (
                              <div
                                key={n.id}
                                onClick={() => {
                                  if (n.isAnnouncement) {
                                    const next = [...new Set([...announcementReadIds, n.announcement_id])];
                                    saveStoredReadIds(`${ANNOUNCEMENT_READ_KEY}:${resident?.id}`, next);
                                    setAnnouncementReadIds(next);
                                    setShowNotificationMenu(false);
                                    openModule("announcements");
                                  } else if (n.isLivelihood) {
                                    const next = [...new Set([...livelihoodReadIds, n.livelihood_id])];
                                    saveStoredReadIds(`${LIVELIHOOD_READ_KEY}:${resident?.id}`, next);
                                    setLivelihoodReadIds(next);
                                    setShowNotificationMenu(false);
                                    openModule("livelihood");
                                  } else {
                                    handleMarkNotificationRead(n.original);
                                    setShowNotificationMenu(false);
                                    const title = (n.title || "").toLowerCase();
                                    const msg = (n.message || "").toLowerCase();
                                    if (title.includes("announcement") || msg.includes("announcement")) {
                                      openModule("announcements");
                                    } else if (title.includes("livelihood") || msg.includes("livelihood")) {
                                      openModule("livelihood");
                                    } else {
                                      openModule("my_documents");
                                    }
                                  }
                                }}
                                className={`group w-full flex items-start gap-3 p-3.5 text-left transition-colors hover:bg-white/10 cursor-pointer ${
                                  !n.is_read ? "bg-emerald-950/40" : "bg-transparent opacity-80 hover:opacity-100"
                                }`}
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                  {n.isLivelihood ? <Briefcase size={14} /> : n.isAnnouncement ? <Megaphone size={14} /> : <FileText size={14} />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-1.5">
                                    <p className="truncate text-xs font-black text-white">{n.title}</p>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {!n.is_read && (
                                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteResidentNotification(e, n)}
                                        className="rounded p-1 text-white/40 opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-300 transition"
                                        title="Delete notification"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed font-medium text-white/70">{n.message}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Profile Avatar Button */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => { setShowNotificationMenu(false); setShowAccountMenu(!showAccountMenu); }}
                  className="relative flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-300 bg-slate-100 shadow-xl ring-2 ring-white/30 transition transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  {resident?.profile_photo_url ? (
                    <img src={resident.profile_photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-black text-white bg-[#064E3B]">
                      {displayName[0]?.toUpperCase() || "R"}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </button>

                {/* Account Menu Dropdown */}
                <AnimatePresence>
                  {showAccountMenu && (
                    <>
                      <div className="fixed inset-0 z-[99990]" onClick={() => setShowAccountMenu(false)} />
                      <motion.div
                        className="fixed top-16 left-3 right-3 sm:absolute sm:right-0 sm:left-auto sm:top-full sm:mt-2 sm:w-60 sm:max-w-none rounded-2xl border border-white/20 p-2 shadow-2xl bg-[#02221A]/95 backdrop-blur-xl text-white z-[999999]"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      >
                        <div className="px-3 py-3 mb-2 text-center rounded-xl border border-white/10 bg-white/10">
                          <div className="mx-auto h-11 w-11 overflow-hidden rounded-full border-2 border-emerald-400 mb-1.5 shadow-xs flex items-center justify-center text-xs font-black text-white bg-[#064E3B]">
                            {resident?.profile_photo_url ? (
                              <img src={resident.profile_photo_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              displayName[0]?.toUpperCase() || "R"
                            )}
                          </div>
                          <p className="truncate text-xs font-black text-white">{displayName}</p>
                          <p className="truncate text-[11px] text-emerald-200 font-bold mt-0.5">{residentUsername}</p>
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
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold transition text-white hover:bg-emerald-600/40 active:scale-98 cursor-pointer"
                          >
                            <item.icon size={15} className="text-emerald-300 shrink-0" />
                            <span className="font-bold text-xs">{item.label}</span>
                          </button>
                        ))}

                        <div className="my-1 border-t border-white/10" />
                        <button
                          type="button"
                          onClick={() => { setShowAccountMenu(false); handleLogout(); }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold transition text-rose-300 hover:bg-rose-900/40 active:scale-98 cursor-pointer"
                        >
                          <LogOut size={15} className="text-rose-400 shrink-0" />
                          <span className="font-bold text-xs">Log Out</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

            </div>

          </header>

        <div className="px-3 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto pt-4 sm:pt-6 pb-28 space-y-6">
          
          {portalError && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800 shadow-sm">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{portalError}</span>
            </div>
          )}

          {portalSuccess && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-sm">
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              <span>{portalSuccess}</span>
            </div>
          )}

          {/* TAB 0: HOME PAGE */}
          {activeNav === "home" && (
            <div className="space-y-4 sm:space-y-6 animate-fadeIn">
              
              {/* WELCOME HERO BANNER - TRANSLUCENT EMERALD GLASS */}
              <div className="relative rounded-[2.2rem] overflow-hidden border-2 border-white/20 shadow-2xl bg-emerald-950/35 backdrop-blur-2xl text-white p-4 sm:p-5 space-y-3">
                <div className="relative z-10 space-y-2.5">
                  <h2 className="text-base sm:text-xl font-black tracking-tight text-white leading-tight drop-shadow-sm">
                    Maligayang Pagdating sa KaagapA.I Portal
                  </h2>
                  
                  {/* 4 QUICK ACTION BUTTONS: COMPACT ICON-BASED RIBBON ON MOBILE, FULL CARDS ON DESKTOP */}
                  {/* Mobile View: Compact 1-Row Themed Icon Ribbon */}
                  <div className="grid grid-cols-4 gap-2 sm:hidden pt-1">
                    {[
                      { 
                        title: "Request Document", 
                        label: "Request", 
                        icon: FileText, 
                        bg: "bg-emerald-900/30 border-emerald-400/30 hover:bg-emerald-800/40", 
                        iconBg: "bg-emerald-500/25 text-emerald-200 border-emerald-400/30",
                        action: () => setDocumentModalOpen(true) 
                      },
                      { 
                        title: "Livelihoods & Jobs", 
                        label: "Jobs", 
                        icon: Briefcase, 
                        bg: "bg-teal-900/30 border-teal-400/30 hover:bg-teal-800/40", 
                        iconBg: "bg-teal-500/25 text-teal-200 border-teal-400/30",
                        action: () => openModule("livelihood") 
                      },
                      { 
                        title: "Announcements", 
                        label: "Advisories", 
                        icon: Megaphone, 
                        bg: "bg-blue-900/30 border-blue-400/30 hover:bg-blue-800/40", 
                        iconBg: "bg-blue-500/25 text-blue-200 border-blue-400/30",
                        action: () => openModule("announcements") 
                      },
                      { 
                        title: "Document Logs", 
                        label: "Logs", 
                        icon: FileCheck2, 
                        bg: "bg-amber-900/30 border-amber-400/30 hover:bg-amber-800/40", 
                        iconBg: "bg-amber-500/25 text-amber-200 border-amber-400/30",
                        action: () => openModule("my_documents") 
                      },
                    ].map((card, idx) => {
                      const Icon = card.icon;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={card.action}
                          className={`flex flex-col items-center justify-center p-2 rounded-2xl border ${card.bg} backdrop-blur-md shadow-md active:scale-95 transition-all text-center h-14 cursor-pointer group`}
                          title={card.title}
                        >
                          <div className={`h-7 w-7 rounded-xl border flex items-center justify-center ${card.iconBg} group-hover:scale-110 transition`}>
                            <Icon size={16} />
                          </div>
                          <span className="text-[10px] font-black text-white leading-none mt-1 truncate w-full">
                            {card.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Desktop View: Full Themed Detailed Cards with SVG Watermarks */}
                  <div className="hidden sm:grid sm:grid-cols-4 gap-3 w-full pt-1">
                    {[
                      { 
                        title: "Request Document", 
                        icon: FileText, 
                        badge: "INSTANT", 
                        bg: "bg-emerald-900/30 backdrop-blur-xl border-emerald-400/30 hover:border-emerald-400/60 hover:bg-emerald-800/40 hover:shadow-emerald-900/20", 
                        badgeBg: "bg-emerald-500/30 text-emerald-200 border-emerald-400/40", 
                        iconBg: "bg-emerald-500/25 border-emerald-400/40 text-emerald-200", 
                        textColor: "text-white font-black drop-shadow-xs",
                        action: () => setDocumentModalOpen(true),
                        watermark: (
                          <div className="absolute right-1 -bottom-2 pointer-events-none opacity-20 text-emerald-300">
                            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                              <polyline points="14 2 14 8 20 8" />
                              <path d="m9 15 2 2 4-4" />
                            </svg>
                          </div>
                        )
                      },
                      { 
                        title: "Livelihoods & Jobs", 
                        icon: Briefcase, 
                        badge: "ACTIVE", 
                        bg: "bg-teal-900/30 backdrop-blur-xl border-teal-400/30 hover:border-teal-400/60 hover:bg-teal-800/40 hover:shadow-teal-900/20", 
                        badgeBg: "bg-teal-500/30 text-teal-200 border-teal-400/40", 
                        iconBg: "bg-teal-500/25 border-teal-400/40 text-teal-200", 
                        textColor: "text-white font-black drop-shadow-xs",
                        action: () => openModule("livelihood"),
                        watermark: (
                          <div className="absolute right-1 -bottom-2 pointer-events-none opacity-20 text-teal-300">
                            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                            </svg>
                          </div>
                        )
                      },
                      { 
                        title: "Announcements", 
                        icon: Megaphone, 
                        badge: "OFFICIAL", 
                        bg: "bg-blue-900/30 backdrop-blur-xl border-blue-400/30 hover:border-blue-400/60 hover:bg-blue-800/40 hover:shadow-blue-900/20", 
                        badgeBg: "bg-blue-500/30 text-blue-200 border-blue-400/40", 
                        iconBg: "bg-blue-500/25 border-blue-400/40 text-blue-200", 
                        textColor: "text-white font-black drop-shadow-xs",
                        action: () => openModule("announcements"),
                        watermark: (
                          <div className="absolute right-1 -bottom-2 pointer-events-none opacity-20 text-blue-300">
                            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m3 11 18-5v12L3 14v-3z" />
                              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                            </svg>
                          </div>
                        )
                      },
                      { 
                        title: "Document Logs", 
                        icon: FileCheck2, 
                        badge: "HISTORY", 
                        bg: "bg-amber-900/30 backdrop-blur-xl border-amber-400/30 hover:border-amber-400/60 hover:bg-amber-800/40 hover:shadow-amber-900/20", 
                        badgeBg: "bg-amber-500/30 text-amber-200 border-amber-400/40", 
                        iconBg: "bg-amber-500/25 border-amber-400/40 text-amber-200", 
                        textColor: "text-white font-black drop-shadow-xs",
                        action: () => openModule("my_documents"),
                        watermark: (
                          <div className="absolute right-1 -bottom-2 pointer-events-none opacity-20 text-amber-300">
                            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                              <path d="M9 14h6" />
                              <path d="M9 18h6" />
                              <path d="M9 10h6" />
                            </svg>
                          </div>
                        )
                      },
                    ].map((card, idx) => {
                      const Icon = card.icon;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={card.action}
                          className={`relative overflow-hidden p-3.5 rounded-2xl border ${card.bg} shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer flex flex-col justify-between items-start text-left group min-h-[64px]`}
                        >
                          {card.watermark}
                          <div className="relative z-10 flex items-center justify-between w-full mb-1.5">
                            <div className={`h-7 w-7 rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-110 transition ${card.iconBg}`}>
                              <Icon size={14} />
                            </div>
                            <span className={`text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-xs ${card.badgeBg}`}>
                              {card.badge}
                            </span>
                          </div>
                          <span className={`relative z-10 text-xs font-black leading-snug w-full ${card.textColor}`}>
                            {card.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                
                {/* LEFT SIDE: ANNOUNCEMENTS & UPCOMING EVENTS */}
                <div className="space-y-5 sm:space-y-6">
                  {/* 1. BARANGAY ANNOUNCEMENTS - TRANSLUCENT EMERALD GLASS */}
                  {(() => {
                    const annTitle = featuredAnnouncement?.title || "No Active Announcements";
                    const annBody = featuredAnnouncement?.body || "There are currently no active barangay advisories or emergency announcements.";
                    const annCat = featuredAnnouncement?.category || "HEALTH";
                    const annTheme = getAnnouncementVisualTheme(annTitle, annBody, annCat);
                    return (
                      <div className="bg-emerald-950/35 backdrop-blur-2xl border-2 border-white/20 rounded-[2.2rem] p-4 sm:p-5 shadow-2xl hover:shadow-emerald-900/40 transition-all duration-300 space-y-3 text-white">
                        <div className={`bg-gradient-to-r ${annTheme.headerBg} px-3.5 py-2.5 rounded-2xl flex justify-between items-center shadow-md relative overflow-hidden`}>
                          <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent pointer-events-none" />
                          <div className="flex items-center gap-2 relative z-10">
                            <span className="text-base sm:text-lg animate-bounce">{annTheme.icon || "📢"}</span>
                            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                              BARANGAY ANNOUNCEMENTS
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => openModule("announcements")}
                            className="text-xs font-bold text-white/90 hover:text-white hover:underline flex items-center gap-0.5 relative z-10 cursor-pointer"
                          >
                            <span>View All</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>

                        {/* Space-Saving Item with Automatic Dynamic Category Background and SVG Watermark */}
                        <div 
                          onClick={() => featuredAnnouncement && setSelectedAnnouncementDetail(featuredAnnouncement)}
                          className={`relative overflow-hidden z-10 p-3.5 rounded-2xl border shadow-xs transition-all duration-300 ${annTheme.cardBg} cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99]`}
                          title="Click to view full announcement details"
                        >
                          {annTheme.patternSvg}
                          <div className="relative z-10 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-xs ${annTheme.badgeBg}`}>
                                {annCat}
                              </span>
                              <span className="text-[10px] text-emerald-200/80 font-bold">
                                {featuredAnnouncement?.publish_date ? new Date(featuredAnnouncement.publish_date).toLocaleDateString() : "8/13/2026"}
                              </span>
                            </div>
                            <h5 className={`text-xs sm:text-sm font-black leading-tight ${annTheme.titleColor}`}>
                              {annTitle}
                            </h5>
                            {/* Hide body text on mobile, show 2 lines on desktop */}
                            <p className={`text-xs font-medium leading-relaxed hidden sm:line-clamp-2 ${annTheme.bodyColor}`}>
                              {annBody}
                            </p>
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-300 hover:text-white hover:underline pt-0.5">
                              <span>Read Full Details</span>
                              <ChevronRight size={12} />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. UPCOMING EVENTS & OPPORTUNITIES - BLUE HEADER */}
                  {(() => {
                    const topOpportunity = opportunities[0];
                    const eventTitle = topOpportunity?.title || "TESDA Computer Literacy Training";
                    const eventLoc = topOpportunity?.location || "Barangay Hall";
                    const eventDate = topOpportunity?.deadline ? new Date(topOpportunity.deadline) : new Date("2026-06-15");
                    const monthStr = eventDate.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
                    const dayStr = eventDate.getDate();
                    return (
                      <div className="bg-emerald-950/35 backdrop-blur-2xl border-2 border-white/20 rounded-[2.2rem] p-4 sm:p-5 shadow-2xl hover:shadow-blue-900/30 transition-all duration-300 space-y-3 text-white">
                        <div className="bg-gradient-to-r from-[#0F366C] via-[#1D4ED8] to-[#1E40AF] text-white px-3.5 py-2.5 rounded-2xl flex justify-between items-center shadow-md relative overflow-hidden border border-blue-400/30">
                          <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent pointer-events-none" />
                          <div className="flex items-center gap-2 relative z-10">
                            <span className="text-base sm:text-lg animate-pulse">💻</span>
                            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                              UPCOMING EVENTS & OPPORTUNITIES
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => openModule("livelihood")}
                            className="text-xs font-bold text-blue-200 hover:text-white hover:underline flex items-center gap-0.5 relative z-10 cursor-pointer"
                          >
                            <span>View All</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>

                        <div className="relative z-10">
                          <div 
                            onClick={() => {
                              if (topOpportunity) {
                                setSelectedLivelihoodDetail(topOpportunity);
                              } else {
                                openModule("livelihood");
                              }
                            }}
                            className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-950/30 hover:bg-blue-900/40 backdrop-blur-xl border border-blue-400/30 hover:border-blue-400/60 shadow-md transition cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                            title="Click to view full event and opportunity details"
                          >
                            <div className="rounded-xl px-3 py-1.5 text-center shrink-0 shadow-md bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white border border-blue-400/30">
                              <p className="text-[9.5px] font-black uppercase leading-none text-blue-200 tracking-wider">{monthStr}</p>
                              <p className="text-base font-black leading-none mt-0.5 text-white">{dayStr}</p>
                            </div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <h5 className="text-xs sm:text-sm font-black leading-tight truncate text-white">
                                {eventTitle}
                              </h5>
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-200">
                                <Clock size={13} className="text-blue-400 shrink-0" />
                                <span className="truncate">8:00 AM - 5:00 PM • {eventLoc}</span>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-300 hover:text-white hover:underline pt-0.5">
                                <span>View Full Program Details</span>
                                <ChevronRight size={12} />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* RIGHT SIDE: RECENT DOCUMENT REQUESTS, NEED HELP, & WORKING HOURS */}
                <div className="space-y-5 sm:space-y-6">
                  {/* 1. RECENT DOCUMENT REQUESTS (Moved here in place of Mission & Vision) */}
                  <div className="bg-emerald-950/35 backdrop-blur-2xl border-2 border-white/20 rounded-[2.2rem] p-4 sm:p-5 shadow-2xl hover:shadow-emerald-900/40 transition-all duration-300 space-y-3 text-white">
                    <div className="bg-gradient-to-r from-[#044E35] via-[#057A55] to-[#046C4E] text-white px-3.5 py-2.5 rounded-2xl flex justify-between items-center shadow-md relative overflow-hidden border border-emerald-400/30">
                      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />
                      <div className="flex items-center gap-2 relative z-10">
                        <FileText size={16} className="text-emerald-200" />
                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                          RECENT DOCUMENT REQUESTS
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => openModule("my_documents")}
                        className="text-xs font-bold text-emerald-200 hover:text-white hover:underline flex items-center gap-0.5 relative z-10 cursor-pointer"
                      >
                        <span>View All</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-white/15 bg-emerald-950/30 backdrop-blur-xl">
                      <table className="w-full text-left text-[11px] min-w-[320px]">
                        <thead>
                          <tr className="border-b text-[9px] font-black uppercase tracking-wider border-white/15 bg-white/10 text-emerald-200">
                            <th className="px-2.5 py-2">Document Type</th>
                            <th className="px-2.5 py-2">Ref No.</th>
                            <th className="px-2.5 py-2">Date</th>
                            <th className="px-2.5 py-2">Status</th>
                            <th className="px-2.5 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y font-medium divide-white/10 text-emerald-100">
                          {requests && requests.length > 0 ? (
                            requests.slice(0, 3).map((req, idx) => {
                              const expired = isRequestExpired(req);
                              const displayStatus = expired ? "Expired" : (req.status || "Pending");
                              return (
                                <tr key={req.id || idx} className="hover:bg-white/10 transition">
                                  <td className="px-2.5 py-2 font-bold text-white truncate max-w-[100px]">{req.document_type}</td>
                                  <td className="px-2.5 py-2 font-mono text-[10px] text-emerald-200/75">{req.tracking_number || req.ref || `REQ-${String(req.id || idx + 1).slice(0, 8)}`}</td>
                                  <td className="px-2.5 py-2 text-emerald-200/75 text-[10px]">{req.created_at ? new Date(req.created_at).toLocaleDateString() : (req.date || "-")}</td>
                                  <td className="px-2.5 py-2">
                                    <span className={`inline-flex rounded-md px-1.5 py-0.2 text-[8.5px] font-black ${
                                      expired || String(req.status || "").toLowerCase() === "rejected" || String(req.status || "").toLowerCase() === "cancelled"
                                        ? "bg-rose-500/25 text-rose-200 border border-rose-400/40"
                                        : String(req.status || "").toLowerCase() === "completed" || String(req.status || "").toLowerCase() === "ready"
                                        ? "bg-emerald-500/25 text-emerald-200 border border-emerald-400/40"
                                        : "bg-amber-500/25 text-amber-200 border border-amber-400/40"
                                    }`}>
                                      {displayStatus}
                                    </span>
                                  </td>
                                  <td className="px-2.5 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => openModule("my_documents")}
                                      className="text-[10px] font-black text-emerald-300 hover:text-white hover:underline cursor-pointer"
                                    >
                                      View
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="5" className="px-3 py-6 text-center text-xs text-emerald-200/60 font-semibold">
                                <FileText size={20} className="mx-auto mb-1.5 text-emerald-400/40" />
                                Walang kasalukuyang document requests.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 2. NEED HELP? CARD */}
                  <div className="bg-emerald-950/35 backdrop-blur-2xl border-2 border-white/20 rounded-[2.2rem] p-4 sm:p-5 shadow-2xl hover:shadow-emerald-900/40 transition-all duration-300 flex items-center justify-between gap-3 text-white">
                    <div className="space-y-1 w-full">
                      <div className="bg-gradient-to-r from-[#044E35] via-[#057A55] to-[#046C4E] text-white px-3.5 py-2 rounded-xl flex items-center justify-between gap-2 shadow-md relative overflow-hidden border border-emerald-400/30">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />
                        <h4 className="text-xs sm:text-sm font-black uppercase text-white relative z-10">NEED HELP?</h4>
                        <button
                          type="button"
                          onClick={() => openModule("announcements")}
                          className="text-[10px] sm:text-xs font-bold text-emerald-200 hover:text-white hover:underline relative z-10 cursor-pointer"
                        >
                          Contact Office
                        </button>
                      </div>
                      <p className="text-[10.5px] sm:text-xs text-emerald-100/80 font-medium">For inquiries and assistance, you may contact the barangay office.</p>
                      <div className="pt-1.5 space-y-0.5 text-[10.5px] sm:text-xs font-bold text-emerald-300">
                        {Boolean(systemSettings?.officePhone && systemSettings.officePhone.trim()) && (
                          <p className="flex items-center gap-1.5">
                            📞 <span className="text-white font-extrabold">{systemSettings.officePhone.trim()}</span>
                          </p>
                        )}
                        {Boolean(systemSettings?.officeEmail && systemSettings.officeEmail.trim()) && (
                          <p className="flex items-center gap-1.5 truncate">
                            ✉ <span className="text-white font-extrabold truncate">{systemSettings.officeEmail.trim()}</span>
                          </p>
                        )}
                        {!systemSettings?.officePhone?.trim() && !systemSettings?.officeEmail?.trim() && (
                          <p className="text-[10px] text-emerald-200/70 italic">
                            Official hotline details not provided. Please visit during office hours.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-xs">
                      <HelpCircle size={22} />
                    </div>
                  </div>

                  {/* 3. BARANGAY OFFICE HOURS */}
                  <div className="bg-emerald-950/50 backdrop-blur-2xl text-white rounded-2xl p-4 sm:p-5 border-2 border-emerald-400/30 shadow-xl flex items-center justify-between">
                    <div className="space-y-1 text-left">
                      <div className="inline-flex items-center gap-1.5 text-emerald-300 text-xs font-black">
                        <Clock size={14} />
                        <span>Barangay Office Working Hours</span>
                      </div>
                      <h4 className="text-sm sm:text-base font-black text-white">Monday - Friday: 8:00 AM - 5:00 PM</h4>
                      <p className="text-xs text-emerald-200/80 font-medium">Barangay Hall, Upper Mingading, Aleosan, Cotabato</p>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 1: DASHBOARD OVERVIEW - FUNCTIONAL USER ACTIVITY & METRICS */}
          {activeNav === "dashboard" && (
            <div className="space-y-5 sm:space-y-6 animate-fadeIn">
              
              {/* HIGH-TECH HEADER BANNER */}
              <div className="relative rounded-2xl overflow-hidden border border-emerald-400/40 shadow-xl bg-gradient-to-r from-[#023322]/80 via-[#044E35]/80 to-[#02221A]/80 backdrop-blur-xl text-white p-4 sm:p-6">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-300/30 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black text-emerald-200 shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>My Resident Activity Hub</span>
                    </div>
                    <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white drop-shadow-sm">
                      Personal Dashboard & Activity Overview
                    </h2>
                    <p className="text-xs text-emerald-200/90 font-medium">
                      Real-time tracker of your document requests, livelihood applications, and community engagement.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDocumentModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <FileText size={14} />
                      <span>Request Document</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 REAL-TIME KPI SUMMARY CARDS (Calculated for logged-in user) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                {[
                  {
                    title: "Total Requests",
                    fullTitle: "Total Document Requests",
                    value: userDashboardMetrics.totalRequests,
                    change: `${userDashboardMetrics.completedRequests} Released`,
                    sub: `${userDashboardMetrics.pendingRequests} in progress`,
                    icon: FileText,
                    color: "from-emerald-900/60 to-teal-950/60",
                    border: "border-emerald-400/40",
                    text: "text-emerald-300",
                    onClick: () => setActiveNav("my_documents"),
                  },
                  {
                    title: "In Progress",
                    fullTitle: "Active Requests In Queue",
                    value: userDashboardMetrics.pendingRequests,
                    change: userDashboardMetrics.pendingRequests > 0 ? "Under Review" : "All Clear",
                    sub: userDashboardMetrics.pendingRequests > 0 ? "Being processed" : "No pending queue",
                    icon: Clock,
                    color: "from-teal-900/60 to-cyan-950/60",
                    border: "border-teal-400/40",
                    text: "text-teal-300",
                    onClick: () => setActiveNav("my_documents"),
                  },
                  {
                    title: "Applications",
                    fullTitle: "Livelihood & Jobs Applied",
                    value: userDashboardMetrics.totalApplications,
                    change: `${userDashboardMetrics.activeApplications} Active`,
                    sub: "Community programs",
                    icon: Briefcase,
                    color: "from-blue-900/60 to-indigo-950/60",
                    border: "border-blue-400/40",
                    text: "text-blue-300",
                    onClick: () => setActiveNav("livelihood"),
                  },
                  {
                    title: "Profile Standing",
                    fullTitle: "Profile Verification & Score",
                    value: `${userDashboardMetrics.profileCompleteness}%`,
                    change: resident?.status || "Active",
                    sub: userDashboardMetrics.profileCompleteness === 100 ? "Fully verified & complete" : "Complete your info",
                    icon: UserCheck,
                    color: "from-amber-900/60 to-yellow-950/60",
                    border: "border-amber-400/40",
                    text: "text-amber-300",
                    onClick: () => setActiveNav("personal_info"),
                  },
                ].map((kpi, idx) => {
                  const Icon = kpi.icon;
                  return (
                    <div
                      key={idx}
                      onClick={kpi.onClick}
                      className={`relative rounded-xl sm:rounded-2xl overflow-hidden p-3 sm:p-4 border ${kpi.border} bg-gradient-to-br ${kpi.color} backdrop-blur-xl text-white shadow-lg hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer group flex flex-col justify-between`}
                      title={`Click to open ${kpi.fullTitle || kpi.title}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[8.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-300 truncate">
                          <span className="sm:hidden">{kpi.title}</span>
                          <span className="hidden sm:inline">{kpi.fullTitle}</span>
                        </span>
                        <div className={`h-6 w-6 sm:h-7 sm:w-7 rounded-lg sm:rounded-xl bg-white/10 border border-white/20 flex items-center justify-center ${kpi.text} shrink-0 shadow-xs group-hover:scale-110 transition-transform duration-200`}>
                          <Icon size={13} className="sm:hidden" />
                          <Icon size={15} className="hidden sm:block" />
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between sm:justify-start gap-1">
                        <span className="text-lg sm:text-2xl font-black text-white leading-none">
                          {kpi.value}
                        </span>
                        <span className={`text-[7.5px] sm:text-[10px] font-extrabold ${kpi.text} bg-white/10 px-1.5 py-0.5 rounded border border-white/10 truncate`}>
                          {kpi.change}
                        </span>
                      </div>
                      <p className="text-[9px] sm:text-[10px] text-slate-300/80 font-medium mt-1 truncate">{kpi.sub}</p>
                    </div>
                  );
                })}
              </div>

              {/* 2 MAIN DYNAMIC CHARTS GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
                
                {/* CHART 1: USER'S MONTHLY DOCUMENT REQUEST VOLUME (BAR CHART) - TAKES 2 COLS */}
                <div className="lg:col-span-2 bg-emerald-950/35 backdrop-blur-2xl border-2 border-white/20 rounded-2xl p-4 sm:p-5 shadow-2xl hover:shadow-emerald-900/40 transition space-y-4 text-white">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center">
                        <BarChart3 size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                          MONTHLY DOCUMENT REQUEST VOLUME
                        </h4>
                        <p className="text-[10px] text-emerald-200/80 font-bold">Your document requests throughout {userDashboardMetrics.currentYear}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black bg-emerald-500/25 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/30">
                      {userDashboardMetrics.totalThisYear} {userDashboardMetrics.totalThisYear === 1 ? "Request" : "Requests"} in {userDashboardMetrics.currentYear}
                    </span>
                  </div>

                  {/* SVG ANIMATED BAR CHART (Calculated for user) */}
                  <div className="h-56 w-full pt-2 flex flex-col justify-between">
                    <div className="h-44 w-full flex items-end justify-between gap-1.5 px-2 pb-4 border-b border-white/10 relative">
                      {userDashboardMetrics.monthlyData.map((item, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                          {/* Tooltip */}
                          <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md pointer-events-none z-20 whitespace-nowrap border border-white/10">
                            {item.val} {item.val === 1 ? "Request" : "Requests"} in {item.month}
                          </div>
                          {/* Animated Bar */}
                          <div
                            style={{ height: item.height }}
                            className={`w-full max-w-[20px] rounded-t-md shadow-xs transition duration-300 relative overflow-hidden ${
                              item.val > 0
                                ? "bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-300 group-hover:brightness-125 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                : "bg-white/10 group-hover:bg-white/20"
                            }`}
                          >
                            {item.val > 0 && <div className="absolute top-0 inset-x-0 h-1 bg-emerald-200 opacity-90" />}
                          </div>
                          <span className={`text-[9px] font-black transition ${item.val > 0 ? "text-emerald-200 font-bold group-hover:text-white" : "text-emerald-300/50"}`}>
                            {item.month}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-emerald-200/80 font-bold px-2 pt-1">
                      <span>• Peak Month: {userDashboardMetrics.peakMonth.val > 0 ? `${userDashboardMetrics.peakMonth.month} (${userDashboardMetrics.peakMonth.val} requests)` : "None"}</span>
                      <span>• Active Months: {userDashboardMetrics.activeMonthsCount} months</span>
                      <span>• Ready for Pickup: {userDashboardMetrics.completedRequests} docs</span>
                    </div>
                  </div>
                </div>

                {/* CHART 2: USER'S DOCUMENT TYPE DISTRIBUTION (DONUT CHART) - TAKES 1 COL */}
                <div className="bg-emerald-950/35 backdrop-blur-2xl border-2 border-white/20 rounded-2xl p-4 sm:p-5 shadow-2xl hover:shadow-teal-900/40 transition space-y-4 text-white">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center justify-center">
                        <PieChartIcon size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                          DOCUMENT TYPES
                        </h4>
                        <p className="text-[10px] text-teal-200/80 font-bold">Your requested certificates</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black bg-teal-500/25 text-teal-200 px-2 py-0.5 rounded-full border border-teal-400/30">
                      {userDashboardMetrics.totalRequests} Total
                    </span>
                  </div>

                  {/* SVG ANIMATED DONUT CHART */}
                  {userDashboardMetrics.totalRequests > 0 ? (
                    <div className="flex flex-col items-center justify-center pt-1 space-y-3">
                      <div className="relative h-36 w-36 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-white/15"
                            strokeWidth="4"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          {userDashboardMetrics.donutSlices.map((slice, idx) => (
                            <path
                              key={idx}
                              stroke={slice.color}
                              strokeDasharray={slice.strokeDasharray}
                              strokeDashoffset={slice.strokeDashoffset}
                              strokeWidth="4.2"
                              strokeLinecap="round"
                              fill="none"
                              className="transition-all duration-700 hover:opacity-80 drop-shadow-sm"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          ))}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                          <span className="text-lg font-black text-white leading-none">
                            {userDashboardMetrics.totalRequests}
                          </span>
                          <span className="text-[8.5px] font-bold text-emerald-300 uppercase tracking-wider mt-0.5">
                            {userDashboardMetrics.totalRequests === 1 ? "Request" : "Requests"}
                          </span>
                        </div>
                      </div>

                      {/* LEGEND CHIPS */}
                      <div className="grid grid-cols-2 gap-1.5 w-full pt-1 max-h-32 overflow-y-auto custom-scrollbar">
                        {userDashboardMetrics.docTypeDistribution.map((lg, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-lg border border-white/15">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: lg.color }}
                            />
                            <div className="min-w-0 flex-1 flex items-center justify-between text-[9.5px]">
                              <span className="font-bold text-emerald-100 truncate" title={lg.label}>{lg.label}</span>
                              <span className="font-black text-white ml-1">{lg.pct}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-56 flex flex-col items-center justify-center text-center p-4 space-y-2 bg-emerald-950/30 rounded-xl border border-dashed border-white/20">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center">
                        <FileText size={20} />
                      </div>
                      <p className="text-xs font-bold text-white">No Document Requests Yet</p>
                      <p className="text-[10px] text-emerald-200/80 max-w-[200px]">
                        Once you request a barangay clearance or certificate, your breakdown will show here.
                      </p>
                      <button
                        type="button"
                        onClick={() => setDocumentModalOpen(true)}
                        className="text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 rounded-md transition cursor-pointer"
                      >
                        + Request Document
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {/* 3. PERFORMANCE GAUGES & USER PARTICIPATION SUMMARY */}
              <div className="bg-emerald-950/35 backdrop-blur-2xl border-2 border-white/20 rounded-2xl p-4 sm:p-5 shadow-2xl hover:shadow-emerald-900/40 transition space-y-4 text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                        SERVICE ADOPTION & QUALITY INDEX
                      </h4>
                      <p className="text-[10px] text-emerald-200/80 font-bold">Personal performance and community participation indicators</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-emerald-200 bg-emerald-500/25 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                    {userDashboardMetrics.overallIndexScore}% Activity Score
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Document Processing Rate",
                      pct: userDashboardMetrics.completionRate,
                      sub: `${userDashboardMetrics.completedRequests} of ${userDashboardMetrics.totalRequests} completed`,
                      color: "from-emerald-500 to-teal-400",
                    },
                    {
                      label: "Profile Completeness",
                      pct: userDashboardMetrics.profileCompleteness,
                      sub: userDashboardMetrics.profileCompleteness === 100 ? "All fields verified" : "Complete your profile",
                      color: "from-teal-500 to-cyan-400",
                    },
                    {
                      label: "Advisories Engagement",
                      pct: userDashboardMetrics.announcementReadRate,
                      sub: `${userDashboardMetrics.readAnnouncementsCount} of ${userDashboardMetrics.totalAnnouncements} viewed`,
                      color: "from-blue-500 to-indigo-400",
                    },
                    {
                      label: "Livelihood Participation",
                      pct: userDashboardMetrics.totalApplications > 0 ? Math.min(100, userDashboardMetrics.totalApplications * 34) : 0,
                      sub: `${userDashboardMetrics.totalApplications} program${userDashboardMetrics.totalApplications === 1 ? "" : "s"} applied`,
                      color: "from-amber-500 to-orange-400",
                    },
                  ].map((gauge, idx) => (
                    <div key={idx} className="bg-white/10 p-3 rounded-xl border border-white/15 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-emerald-100 truncate">{gauge.label}</span>
                        <span className="font-black text-white">{gauge.pct}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/15 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${gauge.pct}%` }}
                          className={`h-full bg-gradient-to-r ${gauge.color} rounded-full transition-all duration-1000 shadow-sm`}
                        />
                      </div>
                      <p className="text-[9.5px] text-emerald-200/70 font-medium truncate">{gauge.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. MY RECENT ACTIVITIES & ACTIONS */}
              <div className="bg-emerald-950/35 backdrop-blur-2xl border-2 border-white/20 rounded-2xl p-4 sm:p-5 shadow-2xl hover:shadow-emerald-900/40 transition space-y-4 text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center">
                      <History size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                        MY RECENT ACTIVITIES & ACTIONS
                      </h4>
                      <p className="text-[10px] text-emerald-200/80 font-bold">What you've submitted and updated recently</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModule("my_documents")}
                    className="text-xs font-bold text-emerald-300 hover:text-white hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View Document Logs</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                {userDashboardMetrics.recentActivities.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {userDashboardMetrics.recentActivities.map((act) => (
                      <div
                        key={act.id}
                        onClick={() => openModule(act.actionKey)}
                        className="group p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 hover:border-emerald-400/40 transition duration-200 cursor-pointer flex flex-col justify-between gap-2 shadow-xs text-white"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0 group-hover:scale-105 transition-transform">
                              {act.type === "document" ? <FileText size={16} /> : <Briefcase size={16} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition">
                                {act.title}
                              </h5>
                              <p className="text-[10px] text-emerald-200/80 font-medium truncate">{act.subtitle}</p>
                            </div>
                          </div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${getStatusClass(act.status)} shrink-0`}>
                            {act.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-emerald-300/80 font-medium pt-1 border-t border-white/10">
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />
                            {act.date ? new Date(act.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Recent"}
                          </span>
                          <span className="text-emerald-300 font-bold group-hover:underline flex items-center gap-0.5">
                            Open <ChevronRight size={10} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 px-4 bg-emerald-950/30 rounded-xl border border-dashed border-white/20">
                    <ClipboardList size={28} className="mx-auto text-emerald-300/60 mb-2" />
                    <p className="text-xs font-bold text-white">No Submissions or Activity Yet</p>
                    <p className="text-[10px] text-emerald-200/80 mt-1 max-w-sm mx-auto">
                      When you submit a document request, apply for a job or program, or update your information, your history will appear here.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: REQUEST DOCUMENTS - TRANSLUCENT EMERALD GLASS */}
          {activeNav === "documents" && (
            <div className="bg-emerald-950/35 backdrop-blur-2xl border-2 border-white/20 rounded-[2.2rem] p-6 shadow-2xl animate-fadeIn text-white">
              <div className="bg-gradient-to-r from-[#044E35] via-[#057A55] to-[#046C4E] text-white px-4 py-3 rounded-2xl flex justify-between items-center shadow-md mb-6 border border-emerald-400/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                    Document Request
                  </h2>
                  <p className="text-[10px] text-emerald-200 font-bold mt-0.5">Submit clearance and certificate requests directly to the Barangay Hall.</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {/* Form Card */}
                <div className="bg-emerald-950/30 backdrop-blur-xl border border-white/20 rounded-3xl p-5 shadow-md md:col-span-1 space-y-4 text-white">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300">Clearance Application</h3>
                    <p className="text-xs text-emerald-200/80 mt-0.5 font-bold">Choose a template type and supply any required details.</p>
                  </div>
                  {renderDocumentRequestForm()}
                </div>

                {/* Specs/Details Card */}
                <div className="bg-emerald-950/30 backdrop-blur-xl border border-white/20 rounded-3xl p-5 shadow-md md:col-span-2 text-white">
                  {selectedTemplateDetails ? (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center gap-2.5 border-b border-white/15 pb-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                          <Info size={16} />
                        </span>
                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-200">Clearance specifications</h4>
                      </div>
                      <h3 className="text-lg font-black text-white">{selectedTemplateDetails.template_name}</h3>
                      <div className="grid gap-4 sm:grid-cols-2 text-xs leading-relaxed font-semibold">
                        <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 shadow-xs">
                          <p className="text-xs text-emerald-300 font-bold uppercase block">Description</p>
                          <p className="mt-1 font-medium text-emerald-100">{selectedTemplateDetails.description || "Official document certificate."}</p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 shadow-xs">
                          <p className="text-xs text-emerald-300 font-bold uppercase block">Requirements</p>
                          <p className="mt-1 font-medium text-emerald-100">{selectedTemplateDetails.requirements || "None listed."}</p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 shadow-xs">
                          <p className="text-xs text-emerald-300 font-bold uppercase block">Processing Duration</p>
                          <p className="text-white font-black mt-0.5">{selectedTemplateDetails.processing_time || "Same Day"}</p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 shadow-xs">
                          <p className="text-xs text-emerald-300 font-bold uppercase block">Application Fee</p>
                          <p className="text-white font-black mt-0.5">{selectedTemplateDetails.fee || "Free"}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center py-12 space-y-2">
                      <FileText className="text-emerald-300/60" size={32} />
                      <p className="text-xs text-emerald-200/70 font-bold">Select document template to view specifications.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2.5: MY DOCUMENTS - TRANSLUCENT EMERALD GLASS */}
          {activeNav === "my_documents" && (
            <div className="bg-emerald-950/35 backdrop-blur-2xl border-2 border-white/20 rounded-[2.2rem] p-6 shadow-2xl animate-fadeIn text-white">
              <div className="bg-gradient-to-r from-[#044E35] via-[#057A55] to-[#046C4E] text-white px-4 py-3.5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md mb-6 border border-emerald-400/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                    My Documents
                  </h2>
                  <p className="text-[10px] text-emerald-200 font-bold mt-0.5">Logs and progress of your requested clearances.</p>
                </div>
                <button
                  type="button"
                  onClick={() => refreshResidentActivity(resident?.id, { showLoading: true })}
                  disabled={refreshingRequests}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-black transition border border-white/30 disabled:opacity-50 cursor-pointer relative z-10"
                >
                  <RefreshCw size={12} className={refreshingRequests ? "animate-spin" : ""} />
                  Refresh Logs
                </button>
              </div>

              {/* Batch Action Bar when rows are selected */}
              {selectedLogIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-rose-500/25 border border-rose-400/50 rounded-2xl px-4 py-2.5 mb-4 shadow-lg backdrop-blur-md animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white text-[11px] font-black">
                      {selectedLogIds.length}
                    </span>
                    <span className="text-xs font-bold text-rose-100">
                      {selectedLogIds.length} document log(s) selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLogIds([])}
                      className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/20 cursor-pointer"
                    >
                      Deselect All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedLogsAction}
                      disabled={deletingLogs}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black shadow-md transition border border-rose-400/50 cursor-pointer disabled:opacity-50"
                    >
                      {deletingLogs ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      <span>Delete Selected ({selectedLogIds.length})</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-2xl border border-white/15 bg-emerald-950/30 backdrop-blur-xl">
                {requests.length === 0 ? (
                  <p className="text-xs text-emerald-200/70 text-center py-10 font-bold">No clearance applications submitted.</p>
                ) : (
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead>
                      <tr className="border-b font-bold uppercase tracking-wider text-xs border-white/15 bg-white/10 text-emerald-200">
                        <th className="px-3 py-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={requests.length > 0 && selectedLogIds.length === requests.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLogIds(requests.map((r) => r.id));
                              } else {
                                setSelectedLogIds([]);
                              }
                            }}
                            className="h-4 w-4 rounded border-white/30 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#10b981]"
                            title="Select all logs"
                          />
                        </th>
                        <th className="px-4 py-3">Document Type</th>
                        <th className="px-4 py-3">Date Applied</th>
                        <th className="px-4 py-3">Last Updated</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-semibold divide-white/10 text-emerald-100">
                      {requests.map((req) => {
                        const expired = isRequestExpired(req);
                        const displayStatus = expired ? "Expired" : req.status;
                        const isPending = !expired && req.status === "Pending";
                        const isSelected = selectedLogIds.includes(req.id);
                        return (
                          <tr key={req.id} className={`transition hover:bg-white/10 ${isSelected ? "bg-white/15" : ""}`}>
                            <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedLogIds((prev) =>
                                    prev.includes(req.id) ? prev.filter((id) => id !== req.id) : [...prev, req.id]
                                  );
                                }}
                                className="h-4 w-4 rounded border-white/30 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-[#10b981]"
                              />
                            </td>
                            <td className="px-4 py-3 font-black text-white">{req.document_type}</td>
                            <td className="px-4 py-3 text-emerald-200/80">{new Date(req.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-emerald-200/80">{new Date(req.updated_at || req.created_at).toLocaleDateString()}</td>
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
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 text-xs font-bold transition border border-blue-400/30 shadow-2xs"
                                      title="Edit Request Type"
                                    >
                                      <Pencil size={12} />
                                      <span>Edit</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleCancelRequestAction(req)}
                                      disabled={cancellingRequestId === req.id}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold transition border border-rose-400/30 shadow-2xs disabled:opacity-50"
                                      title="Cancel Request"
                                    >
                                      {cancellingRequestId === req.id ? <Loader size={12} className="animate-spin" /> : <XCircle size={12} />}
                                      <span>Cancel</span>
                                    </button>
                                  </>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteRequestAction(req)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold transition border border-rose-400/30 cursor-pointer shadow-2xs"
                                  title="Delete Document Log"
                                >
                                  <Trash2 size={12} />
                                  <span>Delete</span>
                                </button>
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

          {/* TAB 3: ANNOUNCEMENTS - TRANSLUCENT EMERALD GLASS */}
          {activeNav === "announcements" && (
            <div className="bg-emerald-950/35 backdrop-blur-2xl border-2 border-white/20 rounded-[2.2rem] p-6 shadow-2xl space-y-5 animate-fadeIn text-white">
              <div className="bg-gradient-to-r from-[#044E35] via-[#057A55] to-[#046C4E] text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-md mb-5 border border-emerald-400/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Barangay Bulletins & Advisories</h3>
                  <p className="text-[10px] text-emerald-200 mt-0.5 font-bold">Verified public service announcements for residents.</p>
                </div>
                <span className="text-xs font-bold text-white bg-white/20 px-3 py-1 rounded-full border border-white/30 backdrop-blur-xs relative z-10">
                  {filteredAnnouncements.length} Active
                </span>
              </div>
              <div className="space-y-4">
                {filteredAnnouncements.map((ann) => {
                  const visualTheme = getAnnouncementVisualTheme(ann.title, ann.body, ann.category);
                  return (
                    <article
                      key={ann.id}
                      onClick={() => setSelectedAnnouncementDetail(ann)}
                      className={`relative overflow-hidden rounded-3xl border p-5 flex gap-4 transition-all duration-300 shadow-md hover:shadow-xl backdrop-blur-xl ${visualTheme.cardBg} cursor-pointer group hover:scale-[1.005]`}
                      title="Click to view full announcement details"
                    >
                      {visualTheme.patternSvg}
                      <span className={`h-11 w-11 flex items-center justify-center rounded-2xl text-xl shrink-0 shadow-md border relative z-10 ${visualTheme.badgeBg}`}>
                        {visualTheme.icon || "📢"}
                      </span>
                      <div className="space-y-2 min-w-0 flex-1 relative z-10">
                        <div className="flex items-center gap-2 flex-wrap justify-between">
                          <h4 className={`text-xs sm:text-sm font-black leading-snug ${visualTheme.titleColor}`}>{ann.title}</h4>
                          <span className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider border shadow-xs ${visualTheme.badgeBg}`}>
                            {ann.category || "General"}
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed font-medium whitespace-pre-line ${visualTheme.bodyColor}`}>{ann.body}</p>
                        <div className="flex justify-between items-center pt-2.5 text-[11px] border-t border-white/15">
                          <p className="text-emerald-200/80 font-bold">
                            Published: {new Date(ann.publish_date || ann.created_at).toLocaleDateString()}
                          </p>
                          <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-0.5 group-hover:underline">
                            <span>Read Full Advisory</span>
                            <ChevronRight size={13} />
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {filteredAnnouncements.length === 0 && (
                  <div className="text-center py-10 space-y-2">
                    <p className="text-2xl">📢</p>
                    <p className="text-xs text-emerald-200/80 font-bold">No active announcements available.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LIVELIHOODS & JOBS - TRANSLUCENT EMERALD GLASS */}
          {activeNav === "livelihood" && (
            <div className="bg-emerald-950/35 backdrop-blur-2xl border-2 border-white/20 rounded-[2.2rem] p-6 shadow-2xl space-y-5 animate-fadeIn text-white">
              <div className="bg-gradient-to-r from-[#044E35] via-[#057A55] to-[#046C4E] text-white px-4 py-3 rounded-2xl flex justify-between items-center shadow-md mb-5 border border-emerald-400/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Livelihoods & jobs</h3>
                  <p className="text-[10px] text-emerald-200 mt-0.5 font-bold">Active training sessions and program listings.</p>
                </div>
                <span className="text-xs font-bold bg-white/20 border border-white/30 text-white px-3 py-1 rounded-full backdrop-blur-xs relative z-10">
                  {opportunities.length} Openings
                </span>
              </div>
              <div className="grid gap-4.5 sm:grid-cols-2 xl:grid-cols-4">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="rounded-3xl border border-emerald-400/30 bg-emerald-950/30 backdrop-blur-xl p-5 flex flex-col justify-between hover:border-emerald-400/70 hover:shadow-2xl transition-all duration-300 shadow-md group relative overflow-hidden text-white"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2.5">
                        <span className="inline-flex rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200 shadow-2xs backdrop-blur-xs">
                          {opp.category}
                        </span>
                        {opp.slots && (
                          <span className="text-[10px] font-bold text-emerald-200/90 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                            {opp.slots} slots
                          </span>
                        )}
                      </div>
                      <h4 
                        onClick={() => setSelectedLivelihoodDetail(opp)}
                        className="text-xs font-black text-white leading-snug cursor-pointer hover:text-emerald-300 transition"
                        title="Click to view whole details"
                      >
                        {opp.title}
                      </h4>
                      <p 
                        onClick={() => setSelectedLivelihoodDetail(opp)}
                        className="text-xs text-emerald-100/90 mt-2 line-clamp-3 leading-relaxed font-semibold cursor-pointer"
                        title="Click to view whole details"
                      >
                        {opp.description || "No specific details provided."}
                      </p>
                    </div>
                    <div className="mt-4 pt-3.5 border-t border-white/15 space-y-2.5">
                      <div className="space-y-1 text-xs font-bold text-emerald-200/80">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-emerald-300 shrink-0" />
                          <span>Closing: {new Date(opp.deadline).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Home size={12} className="text-emerald-300 shrink-0" />
                          <span className="truncate">Venue: {opp.location || "Community Hall"}</span>
                        </div>
                      </div>

                      {/* VIEW WHOLE DETAILS BUTTON */}
                      <button
                        type="button"
                        onClick={() => setSelectedLivelihoodDetail(opp)}
                        className="w-full py-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/20 hover:bg-emerald-500/30 text-white font-black text-[11px] transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Search size={12} className="text-emerald-300" />
                        <span>View Whole Details</span>
                      </button>

                      {(() => {
                        if (opp.status !== "Open") return null;
                        const application = residentApplications.find(app => app.livelihood_post_id === opp.id);
                        if (!application) {
                          return (
                            <button
                              type="button"
                              onClick={() => handleApplyLivelihood(opp.id)}
                              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#044E35] via-[#057A55] to-[#046C4E] text-white font-black text-xs hover:scale-[1.02] active:scale-[0.99] hover:shadow-lg transition-all border border-emerald-400/30 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                            >
                              Apply Now
                            </button>
                          );
                        }
                        if (application.status === "Approved") {
                          return (
                            <div className="py-2 px-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold text-center backdrop-blur-md">
                              <p className="flex items-center justify-center gap-1.5 mb-1"><CheckCircle size={14} className="text-emerald-300"/> Application Approved</p>
                              <span className="text-[10px] font-semibold text-emerald-100 leading-tight">You are listed. You need to visit the barangay for your verifications, and orientations etc.</span>
                            </div>
                          );
                        }
                        if (application.status === "Rejected") {
                          return (
                            <div className="mt-2 py-2 px-3 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-bold text-center backdrop-blur-md">
                              Application Rejected
                            </div>
                          );
                        }
                        return (
                          <div className="mt-2 py-2 px-3 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold text-center backdrop-blur-md">
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
              <div className="border-b pb-3 mb-6 border-slate-100 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-[#0B5D3B]">
                    Personal Information Registry
                  </h2>
                  <p className="text-sm text-slate-500 font-bold mt-0.5">Demographic registry synchronized with administrative records.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelPersonalInfo}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
                >
                  <ArrowLeft size={14} className="text-slate-600" />
                  <span>Back</span>
                </button>
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
                      Mobile Number (Strictly 11 digits) *
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                          setProfileForm({ ...profileForm, phone: digits });
                        }}
                        maxLength={11}
                        placeholder="09171234567"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition font-mono"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Must be exactly 11 digits (e.g. 09171234567)</span>
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
                        {getCustomPurokDefinitions().map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
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
                    <div>
                      <label className="block text-xs font-bold text-slate-700">
                        Occupation
                        <select
                          value={
                            !profileForm.occupation
                              ? ""
                              : standardOccupationOptions.includes(profileForm.occupation) && profileForm.occupation !== "Others (Please Specify)"
                              ? profileForm.occupation
                              : "Others (Please Specify)"
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "Others (Please Specify)") {
                              setProfileForm({ ...profileForm, occupation: "" });
                            } else {
                              setProfileForm({ ...profileForm, occupation: val });
                            }
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white transition"
                        >
                          <option value="">Select Occupation</option>
                          {standardOccupationOptions.map((occ) => (
                            <option key={occ} value={occ}>{occ}</option>
                          ))}
                        </select>
                      </label>
                      {(!standardOccupationOptions.includes(profileForm.occupation) || profileForm.occupation === "" || profileForm.occupation === "Others (Please Specify)") && (
                        <div className="mt-1.5">
                          <input
                            type="text"
                            value={profileForm.occupation === "Others (Please Specify)" ? "" : profileForm.occupation}
                            onChange={(e) => setProfileForm({ ...profileForm, occupation: e.target.value })}
                            placeholder="Specify custom occupation..."
                            className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-[#0B5D3B] transition"
                          />
                        </div>
                      )}
                    </div>
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

                <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0B5D3B] to-[#157347] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:scale-101 transition disabled:opacity-50 cursor-pointer"
                  >
                    {savingProfile ? <Loader size={12} className="animate-spin" /> : <FileCheck2 size={12} />}
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelPersonalInfo}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-xs transition cursor-pointer shadow-xs active:scale-95"
                  >
                    Cancel
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* TAB: BARANGAY OFFICIALS */}
          {activeNav === "officials" && (
            <div className="bg-gradient-to-b from-[#e0f2fe]/80 via-[#f0f9ff] to-[#ffffff] border-2 border-sky-300 rounded-3xl p-3.5 sm:p-6 md:p-8 shadow-2xl animate-fadeIn text-slate-900 overflow-hidden max-w-[980px] mx-auto relative backdrop-blur-md">
              {/* Subtle Grid Pattern */}
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(#93c5fd_1px,transparent_1px)] [background-size:18px_18px] opacity-40" />

              {/* Header Bar */}
              <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-4 w-full mb-4 sm:mb-6 pb-2 px-1 sm:px-4">
                {/* Left: Municipality of Aleosan Seal */}
                <div className="flex items-center shrink-0">
                  <div className="flex h-11 w-11 sm:h-16 sm:w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-white/90 p-1 shadow-sm border border-sky-200">
                    <img
                      src="/aleosan.logo.png"
                      alt="Municipality of Aleosan Seal"
                      className="h-full w-full object-contain drop-shadow-xs"
                      onError={(e) => {
                        e.target.src = "/aleosan logo.png";
                      }}
                    />
                  </div>
                </div>

                {/* Center Title */}
                <div className="flex flex-col items-center text-center flex-1 min-w-0 px-1">
                  <h1 className="text-sm sm:text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-normal sm:tracking-wide text-[#064e3b] leading-tight drop-shadow-2xs">
                    BARANGAY UPPER MINGADING
                  </h1>
                  <h2 className="text-[9px] sm:text-xs md:text-sm font-black uppercase tracking-[0.12em] sm:tracking-[0.25em] text-[#16a34a] mt-0.5 sm:mt-1.5 flex items-center justify-center gap-1.5 sm:gap-2.5">
                    <span className="h-0.5 w-3 sm:w-8 md:w-12 bg-[#16a34a] inline-block" />
                    <span>OFFICIAL ORGANIZATIONAL CHART</span>
                    <span className="h-0.5 w-3 sm:w-8 md:w-12 bg-[#16a34a] inline-block" />
                  </h2>
                </div>

                {/* Right: Barangay Upper Mingading Seal */}
                <div className="flex items-center shrink-0">
                  <div className="flex h-11 w-11 sm:h-16 sm:w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-white/90 p-1 shadow-sm border border-sky-200">
                    <img
                      src={barangayLogo || "/logo.png"}
                      alt="Barangay Upper Mingading Seal"
                      className="h-full w-full object-contain drop-shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* ─── HIERARCHICAL FLOWCHART TREE ─── */}
              <div className="relative z-10 flex flex-col items-center w-full mx-auto pb-2">
                {/* Level 1: Punong Barangay */}
                {captain && (
                  <div className="relative flex flex-col items-center w-full">
                    <article
                      onClick={() => setSelectedOfficialForModal(captain)}
                      className="group relative flex items-center gap-2.5 sm:gap-3.5 w-full max-w-[290px] sm:max-w-[340px] rounded-2xl bg-white border-2 border-[#166534] ring-2 ring-emerald-400/30 p-2.5 sm:p-3 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-[0.98] select-none text-left"
                      title={`Click to view profile of ${captain.name}`}
                    >
                      <div className="relative h-14 w-12 sm:h-16 sm:w-14 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                        {captain.photoUrl ? (
                          <img
                            src={captain.photoUrl}
                            alt={captain.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs sm:text-sm">
                            <Crown size={22} className="text-amber-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                          <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-slate-900 shadow">
                            <Eye size={9} />
                            <span>Details</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-amber-100 text-amber-900 border-amber-300">
                          <Crown size={10} className="text-amber-600" />
                          <span>PUNONG BARANGAY</span>
                        </span>
                        <h4 className="font-black text-xs sm:text-[13.5px] text-slate-900 leading-tight truncate" title={captain.name}>
                          {captain.name}
                        </h4>
                        <p className="text-[8.5px] sm:text-[9px] text-slate-500 font-semibold leading-tight mt-0.5 truncate">
                          {captain.committee || "Executive Leadership"}
                        </p>
                      </div>
                    </article>
                  </div>
                )}

                {/* Central Stem Line from Captain */}
                <div className="w-[2px] h-5 sm:h-6 bg-[#166534]" />

                {/* Level 2: Sangguniang Barangay (Desktop: Connected 4-Column Tree / Mobile: Responsive Grid) */}
                
                {/* ─── MOBILE VIEW (< lg): Roomy Responsive Grid with Connected Stems ─── */}
                <div className="flex lg:hidden flex-col items-center w-full max-w-[620px] px-0.5">
                  <div className="w-full flex flex-col items-center mb-3">
                    <span className="inline-block text-[9px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100/90 border border-emerald-300/80 px-3 py-0.5 rounded-full shadow-2xs">
                      Sangguniang Barangay Council
                    </span>
                    <div className="w-[2px] h-3 bg-[#166534] mt-1" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                    {[...leftWingOfficials, ...rightWingOfficials].map((off) => {
                      const isSK = off.id?.includes("sk") || off.level === "sk";
                      return (
                        <article
                          key={off.id || off.name}
                          onClick={() => setSelectedOfficialForModal(off)}
                          className="group relative flex items-center gap-2.5 rounded-2xl bg-white border-2 border-[#166534] p-2.5 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-[0.98] select-none text-left w-full"
                          title={`Click to view profile of ${off.name}`}
                        >
                          <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                            {off.photoUrl ? (
                              <img
                                src={off.photoUrl}
                                alt={off.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs">
                                <User size={18} className="text-slate-300" />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-slate-900 shadow">
                                <Eye size={8} />
                                <span>Details</span>
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span
                              className={`inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border ${
                                isSK
                                  ? "bg-sky-100 text-sky-900 border-sky-300"
                                  : "bg-emerald-100 text-emerald-900 border-emerald-300"
                              }`}
                            >
                              {off.position || (isSK ? "SK CHAIRMAN" : "BARANGAY KAGAWAD")}
                            </span>
                            <h4 className="font-black text-xs text-slate-900 leading-tight truncate" title={off.name}>
                              {off.name}
                            </h4>
                            <p className="text-[8.5px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={off.committee}>
                              {off.committee || (isSK ? "Sangguniang Kabataan" : "Council Member")}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>

                {/* ─── DESKTOP VIEW (>= lg): Connected 4-Column Flowchart Tree ─── */}
                <div className="hidden lg:flex items-start justify-center w-full max-w-[980px]">
                  {/* LEFT WING: Col 1 & Col 2 */}
                  <div className="relative flex items-start gap-3">
                    {/* Continuous Horizontal Bus from Col 1 center to Right edge of Left Wing */}
                    <div className="absolute top-0 left-[102.5px] xl:left-[110px] right-0 h-[2px] bg-[#166534]" />

                    {/* Column 1: Wilson Boy -> Juanito */}
                    <div className="flex flex-col items-center">
                      <div className="w-[2px] h-5 sm:h-6 bg-[#166534]" />
                      {leftWingOfficials[0] && (
                        <article
                          onClick={() => setSelectedOfficialForModal(leftWingOfficials[0])}
                          className="group relative flex items-center gap-3 w-[205px] xl:w-[220px] rounded-2xl bg-white border-2 border-[#166534] p-2.5 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-1 active:scale-[0.98] select-none text-left"
                          title={`Click to view profile of ${leftWingOfficials[0].name}`}
                        >
                          <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                            {leftWingOfficials[0].photoUrl ? (
                              <img src={leftWingOfficials[0].photoUrl} alt={leftWingOfficials[0].name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs"><User size={18} className="text-slate-300" /></div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-slate-900 shadow"><Eye size={9} /><span>Details</span></span>
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-emerald-100 text-emerald-900 border-emerald-300">{leftWingOfficials[0].position || "BARANGAY KAGAWAD"}</span>
                            <h4 className="font-black text-xs text-slate-900 leading-tight truncate" title={leftWingOfficials[0].name}>{leftWingOfficials[0].name}</h4>
                            <p className="text-[8.5px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={leftWingOfficials[0].committee}>{leftWingOfficials[0].committee || "Council Member"}</p>
                          </div>
                        </article>
                      )}
                      <div className="w-[2px] h-3.5 sm:h-4.5 bg-[#166534]" />
                      {leftWingOfficials[2] && (
                        <article
                          onClick={() => setSelectedOfficialForModal(leftWingOfficials[2])}
                          className="group relative flex items-center gap-3 w-[205px] xl:w-[220px] rounded-2xl bg-white border-2 border-[#166534] p-2.5 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-1 active:scale-[0.98] select-none text-left"
                          title={`Click to view profile of ${leftWingOfficials[2].name}`}
                        >
                          <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                            {leftWingOfficials[2].photoUrl ? (
                              <img src={leftWingOfficials[2].photoUrl} alt={leftWingOfficials[2].name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs"><User size={18} className="text-slate-300" /></div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-slate-900 shadow"><Eye size={9} /><span>Details</span></span>
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-emerald-100 text-emerald-900 border-emerald-300">{leftWingOfficials[2].position || "BARANGAY KAGAWAD"}</span>
                            <h4 className="font-black text-xs text-slate-900 leading-tight truncate" title={leftWingOfficials[2].name}>{leftWingOfficials[2].name}</h4>
                            <p className="text-[8.5px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={leftWingOfficials[2].committee}>{leftWingOfficials[2].committee || "Council Member"}</p>
                          </div>
                        </article>
                      )}
                    </div>

                    {/* Column 2: Garry -> Loreto */}
                    <div className="flex flex-col items-center">
                      <div className="w-[2px] h-5 sm:h-6 bg-[#166534]" />
                      {leftWingOfficials[1] && (
                        <article
                          onClick={() => setSelectedOfficialForModal(leftWingOfficials[1])}
                          className="group relative flex items-center gap-3 w-[205px] xl:w-[220px] rounded-2xl bg-white border-2 border-[#166534] p-2.5 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-1 active:scale-[0.98] select-none text-left"
                          title={`Click to view profile of ${leftWingOfficials[1].name}`}
                        >
                          <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                            {leftWingOfficials[1].photoUrl ? (
                              <img src={leftWingOfficials[1].photoUrl} alt={leftWingOfficials[1].name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs"><User size={18} className="text-slate-300" /></div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-slate-900 shadow"><Eye size={9} /><span>Details</span></span>
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-emerald-100 text-emerald-900 border-emerald-300">{leftWingOfficials[1].position || "BARANGAY KAGAWAD"}</span>
                            <h4 className="font-black text-xs text-slate-900 leading-tight truncate" title={leftWingOfficials[1].name}>{leftWingOfficials[1].name}</h4>
                            <p className="text-[8.5px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={leftWingOfficials[1].committee}>{leftWingOfficials[1].committee || "Council Member"}</p>
                          </div>
                        </article>
                      )}
                      <div className="w-[2px] h-3.5 sm:h-4.5 bg-[#166534]" />
                      {leftWingOfficials[3] && (
                        <article
                          onClick={() => setSelectedOfficialForModal(leftWingOfficials[3])}
                          className="group relative flex items-center gap-3 w-[205px] xl:w-[220px] rounded-2xl bg-white border-2 border-[#166534] p-2.5 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-1 active:scale-[0.98] select-none text-left"
                          title={`Click to view profile of ${leftWingOfficials[3].name}`}
                        >
                          <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                            {leftWingOfficials[3].photoUrl ? (
                              <img src={leftWingOfficials[3].photoUrl} alt={leftWingOfficials[3].name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs"><User size={18} className="text-slate-300" /></div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-slate-900 shadow"><Eye size={9} /><span>Details</span></span>
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-emerald-100 text-emerald-900 border-emerald-300">{leftWingOfficials[3].position || "BARANGAY KAGAWAD"}</span>
                            <h4 className="font-black text-xs text-slate-900 leading-tight truncate" title={leftWingOfficials[3].name}>{leftWingOfficials[3].name}</h4>
                            <p className="text-[8.5px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={leftWingOfficials[3].committee}>{leftWingOfficials[3].committee || "Council Member"}</p>
                          </div>
                        </article>
                      )}
                    </div>
                  </div>

                  {/* CENTRAL CONNECTOR AISLE */}
                  <div className="flex flex-col items-center justify-between self-stretch px-3 relative min-w-[36px] sm:min-w-[48px]">
                    {/* Horizontal Bus Bridge */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#166534]" />
                    {/* Continuous Vertical Central Trunk */}
                    <div className="absolute top-0 bottom-0 w-[2px] bg-[#166534]" />
                  </div>

                  {/* RIGHT WING: Col 3 & Col 4 */}
                  <div className="relative flex items-start gap-3">
                    {/* Continuous Horizontal Bus from Left edge to Col 4 center */}
                    <div className="absolute top-0 left-0 right-[102.5px] xl:right-[110px] h-[2px] bg-[#166534]" />

                    {/* Column 3: Judy -> Mercy Joy */}
                    <div className="flex flex-col items-center">
                      <div className="w-[2px] h-5 sm:h-6 bg-[#166534]" />
                      {rightWingOfficials[0] && (
                        <article
                          onClick={() => setSelectedOfficialForModal(rightWingOfficials[0])}
                          className="group relative flex items-center gap-3 w-[205px] xl:w-[220px] rounded-2xl bg-white border-2 border-[#166534] p-2.5 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-1 active:scale-[0.98] select-none text-left"
                          title={`Click to view profile of ${rightWingOfficials[0].name}`}
                        >
                          <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                            {rightWingOfficials[0].photoUrl ? (
                              <img src={rightWingOfficials[0].photoUrl} alt={rightWingOfficials[0].name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs"><User size={18} className="text-slate-300" /></div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-slate-900 shadow"><Eye size={9} /><span>Details</span></span>
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-emerald-100 text-emerald-900 border-emerald-300">{rightWingOfficials[0].position || "BARANGAY KAGAWAD"}</span>
                            <h4 className="font-black text-xs text-slate-900 leading-tight truncate" title={rightWingOfficials[0].name}>{rightWingOfficials[0].name}</h4>
                            <p className="text-[8.5px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={rightWingOfficials[0].committee}>{rightWingOfficials[0].committee || "Council Member"}</p>
                          </div>
                        </article>
                      )}
                      <div className="w-[2px] h-3.5 sm:h-4.5 bg-[#166534]" />
                      {rightWingOfficials[2] && (
                        <article
                          onClick={() => setSelectedOfficialForModal(rightWingOfficials[2])}
                          className="group relative flex items-center gap-3 w-[205px] xl:w-[220px] rounded-2xl bg-white border-2 border-[#166534] p-2.5 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-1 active:scale-[0.98] select-none text-left"
                          title={`Click to view profile of ${rightWingOfficials[2].name}`}
                        >
                          <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                            {rightWingOfficials[2].photoUrl ? (
                              <img src={rightWingOfficials[2].photoUrl} alt={rightWingOfficials[2].name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs"><User size={18} className="text-slate-300" /></div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-slate-900 shadow"><Eye size={9} /><span>Details</span></span>
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-emerald-100 text-emerald-900 border-emerald-300">{rightWingOfficials[2].position || "BARANGAY KAGAWAD"}</span>
                            <h4 className="font-black text-xs text-slate-900 leading-tight truncate" title={rightWingOfficials[2].name}>{rightWingOfficials[2].name}</h4>
                            <p className="text-[8.5px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={rightWingOfficials[2].committee}>{rightWingOfficials[2].committee || "Council Member"}</p>
                          </div>
                        </article>
                      )}
                    </div>

                    {/* Column 4: Ruben / Kobi -> Chrystophyr SK */}
                    <div className="flex flex-col items-center">
                      <div className="w-[2px] h-5 sm:h-6 bg-[#166534]" />
                      {rightWingOfficials[1] && (
                        <article
                          onClick={() => setSelectedOfficialForModal(rightWingOfficials[1])}
                          className="group relative flex items-center gap-3 w-[205px] xl:w-[220px] rounded-2xl bg-white border-2 border-[#166534] p-2.5 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-1 active:scale-[0.98] select-none text-left"
                          title={`Click to view profile of ${rightWingOfficials[1].name}`}
                        >
                          <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                            {rightWingOfficials[1].photoUrl ? (
                              <img src={rightWingOfficials[1].photoUrl} alt={rightWingOfficials[1].name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs"><User size={18} className="text-slate-300" /></div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-slate-900 shadow"><Eye size={9} /><span>Details</span></span>
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-emerald-100 text-emerald-900 border-emerald-300">{rightWingOfficials[1].position || "BARANGAY KAGAWAD"}</span>
                            <h4 className="font-black text-xs text-slate-900 leading-tight truncate" title={rightWingOfficials[1].name}>{rightWingOfficials[1].name}</h4>
                            <p className="text-[8.5px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={rightWingOfficials[1].committee}>{rightWingOfficials[1].committee || "Council Member"}</p>
                          </div>
                        </article>
                      )}
                      <div className="w-[2px] h-3.5 sm:h-4.5 bg-[#166534]" />
                      {rightWingOfficials[3] && (
                        <article
                          onClick={() => setSelectedOfficialForModal(rightWingOfficials[3])}
                          className="group relative flex items-center gap-3 w-[205px] xl:w-[220px] rounded-2xl bg-white border-2 border-[#166534] p-2.5 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-1 active:scale-[0.98] select-none text-left"
                          title={`Click to view profile of ${rightWingOfficials[3].name}`}
                        >
                          <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                            {rightWingOfficials[3].photoUrl ? (
                              <img src={rightWingOfficials[3].photoUrl} alt={rightWingOfficials[3].name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs"><User size={18} className="text-slate-300" /></div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-slate-900 shadow"><Eye size={9} /><span>Details</span></span>
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-sky-100 text-sky-900 border-sky-300">{rightWingOfficials[3].position || "SK CHAIRMAN"}</span>
                            <h4 className="font-black text-xs text-slate-900 leading-tight truncate" title={rightWingOfficials[3].name}>{rightWingOfficials[3].name}</h4>
                            <p className="text-[8.5px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={rightWingOfficials[3].committee}>{rightWingOfficials[3].committee || "Sangguniang Kabataan"}</p>
                          </div>
                        </article>
                      )}
                    </div>
                  </div>
                </div>

                {/* Central Stem Line passing down to Staff */}
                <div className="w-[2px] h-5 sm:h-6 bg-[#166534]" />

                {/* Level 3: Secretary & Treasurer */}
                
                {/* ─── MOBILE VIEW (< lg): Responsive Staff Grid with Connected Stems ─── */}
                <div className="flex lg:hidden flex-col items-center w-full max-w-[620px] px-0.5">
                  <div className="w-full flex flex-col items-center mb-3">
                    <span className="inline-block text-[9px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100/90 border border-emerald-300/80 px-3 py-0.5 rounded-full shadow-2xs">
                      Appointed Barangay Officials
                    </span>
                    <div className="w-[2px] h-3 bg-[#166534] mt-1" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                    {secretary && (
                      <article
                        onClick={() => setSelectedOfficialForModal(secretary)}
                        className="group relative flex items-center gap-2.5 rounded-2xl bg-white border-2 border-[#166534] p-2.5 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-[0.98] select-none text-left w-full"
                        title={`Click to view profile of ${secretary.name}`}
                      >
                        <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                          {secretary.photoUrl ? (
                            <img
                              src={secretary.photoUrl}
                              alt={secretary.name}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs">
                              <User size={18} className="text-slate-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-emerald-100 text-emerald-900 border-emerald-300">
                            {secretary.position || "BARANGAY SECRETARY"}
                          </span>
                          <h4 className="font-black text-xs text-slate-900 leading-tight truncate" title={secretary.name}>
                            {secretary.name}
                          </h4>
                          <p className="text-[8.5px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={secretary.committee}>
                            {secretary.committee || "Administrative Records"}
                          </p>
                        </div>
                      </article>
                    )}

                    {treasurer && (
                      <article
                        onClick={() => setSelectedOfficialForModal(treasurer)}
                        className="group relative flex items-center gap-2.5 rounded-2xl bg-white border-2 border-[#166534] p-2.5 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-[0.98] select-none text-left w-full"
                        title={`Click to view profile of ${treasurer.name}`}
                      >
                        <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                          {treasurer.photoUrl ? (
                            <img
                              src={treasurer.photoUrl}
                              alt={treasurer.name}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs">
                              <User size={18} className="text-slate-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-emerald-100 text-emerald-900 border-emerald-300">
                            {treasurer.position || "BARANGAY TREASURER"}
                          </span>
                          <h4 className="font-black text-xs text-slate-900 leading-tight truncate" title={treasurer.name}>
                            {treasurer.name}
                          </h4>
                          <p className="text-[8.5px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={treasurer.committee}>
                            {treasurer.committee || "Finance & Accounting"}
                          </p>
                        </div>
                      </article>
                    )}
                  </div>
                </div>

                {/* ─── DESKTOP VIEW (>= lg): Side-by-side with Connected Branch Line ─── */}
                <div className="hidden lg:flex flex-col items-center w-full">
                  <div className="relative flex items-start gap-6 sm:gap-8">
                    {/* Horizontal Bus linking Secretary center and Treasurer center */}
                    <div className="absolute top-0 left-[105px] sm:left-[120px] right-[105px] sm:right-[120px] h-[2px] bg-[#166534]" />

                    {/* Secretary Column */}
                    {secretary && (
                      <div className="flex flex-col items-center">
                        <div className="w-[2px] h-4 sm:h-5 bg-[#166534]" />
                        <article
                          onClick={() => setSelectedOfficialForModal(secretary)}
                          className="group relative flex items-center gap-3 w-[210px] sm:w-[240px] rounded-2xl bg-white border-2 border-[#166534] p-2.5 sm:p-3 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-1 active:scale-[0.98] select-none text-left"
                          title={`Click to view profile of ${secretary.name}`}
                        >
                          <div className="relative h-14 w-12 sm:h-16 sm:w-14 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                            {secretary.photoUrl ? (
                              <img
                                src={secretary.photoUrl}
                                alt={secretary.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs">
                                <User size={18} className="text-slate-300" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[8.5px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-emerald-100 text-emerald-900 border-emerald-300">
                              {secretary.position || "BARANGAY SECRETARY"}
                            </span>
                            <h4 className="font-black text-[11px] sm:text-xs text-slate-900 leading-tight truncate" title={secretary.name}>
                              {secretary.name}
                            </h4>
                            <p className="text-[8.5px] sm:text-[9px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={secretary.committee}>
                              {secretary.committee || "Administrative Records"}
                            </p>
                          </div>
                        </article>
                      </div>
                    )}

                    {/* Treasurer Column */}
                    {treasurer && (
                      <div className="flex flex-col items-center">
                        <div className="w-[2px] h-4 sm:h-5 bg-[#166534]" />
                        <article
                          onClick={() => setSelectedOfficialForModal(treasurer)}
                          className="group relative flex items-center gap-3 w-[210px] sm:w-[240px] rounded-2xl bg-white border-2 border-[#166534] p-2.5 sm:p-3 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-1 active:scale-[0.98] select-none text-left"
                          title={`Click to view profile of ${treasurer.name}`}
                        >
                          <div className="relative h-14 w-12 sm:h-16 sm:w-14 shrink-0 overflow-hidden rounded-xl border-[1.5px] border-[#166534] bg-slate-100 shadow-xs">
                            {treasurer.photoUrl ? (
                              <img
                                src={treasurer.photoUrl}
                                alt={treasurer.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-xs">
                                <User size={18} className="text-slate-300" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[8.5px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-md w-fit leading-none mb-1 border bg-emerald-100 text-emerald-900 border-emerald-300">
                              {treasurer.position || "BARANGAY TREASURER"}
                            </span>
                            <h4 className="font-black text-[11px] sm:text-xs text-slate-900 leading-tight truncate" title={treasurer.name}>
                              {treasurer.name}
                            </h4>
                            <p className="text-[8.5px] sm:text-[9px] text-slate-500 font-semibold leading-tight mt-0.5 truncate" title={treasurer.committee}>
                              {treasurer.committee || "Finance and Accountability"}
                            </p>
                          </div>
                        </article>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SYSTEM SETTINGS */}
          {activeNav === "settings" && (
            <div className="border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs animate-fadeIn bg-white text-slate-900">
              
              <div className="flex flex-col md:flex-row gap-6 md:gap-7">
                {/* Settings menu list */}
                <div className={`w-full md:w-56 shrink-0 flex flex-col gap-2 ${mobileSettingsOpen ? "hidden md:flex" : "flex"}`}>
                  <div className="md:hidden pb-2 mb-1 border-b border-slate-100">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-800">Settings & Preferences</p>
                    <p className="text-[11px] text-slate-500 font-bold mt-0.5">Select a category to manage your account.</p>
                  </div>
                  {[
                    { key: "security", label: "Account & Security", icon: KeyRound, desc: "Change username/password." },
                    { key: "notifications", label: "Alerts & Notifications", icon: Bell, desc: "SMS and update configuration." },
                    { key: "support", label: "Help & Support Info", icon: HelpCircle, desc: "FAQ list and software legal info." }
                  ].map((tabItem) => (
                    <button
                      key={tabItem.key}
                      type="button"
                      onClick={() => {
                        setSettingsTab(tabItem.key);
                        setMobileSettingsOpen(true);
                      }}
                      className={`w-full flex items-center justify-between text-left gap-3 px-4 py-3.5 rounded-2xl border transition-all cursor-pointer ${
                        settingsTab === tabItem.key
                          ? "bg-[#14532D]/10 border-[#14532D]/30 text-[#14532D] font-black shadow-xs"
                          : "border-slate-200/80 bg-slate-50/70 text-slate-700 hover:bg-slate-100/80 font-semibold"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <tabItem.icon size={16} className="mt-0.5 shrink-0 text-[#14532D]" />
                        <div className="min-w-0">
                          <p className="text-xs font-black leading-tight text-slate-900">{tabItem.label}</p>
                          <p className="text-[11px] text-slate-500 font-medium mt-1 leading-normal">{tabItem.desc}</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-slate-400 shrink-0 md:hidden" />
                    </button>
                  ))}
                </div>

                {/* Settings detail content */}
                <div className={`flex-1 w-full min-w-0 ${!mobileSettingsOpen ? "hidden md:block" : "block"}`}>
                  {/* Mobile Back Button */}
                  <div className="md:hidden mb-4 pb-2 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => setMobileSettingsOpen(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition cursor-pointer shadow-2xs"
                    >
                      <ChevronLeft size={14} className="text-[#14532D]" />
                      <span>Back to Settings Menu</span>
                    </button>
                  </div>
                  
                  {/* SUBTAB 1: ACCOUNT SECURITY */}
                  {settingsTab === "security" && (
                    <div className="space-y-6">
                      <div className="border-b pb-2 mb-4 border-slate-100">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Account & Security Settings</h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-bold">Manage authentication settings and login credentials.</p>
                      </div>

                      <div className="grid gap-5 md:grid-cols-2">
                        {/* Interactive Credentials & Profile Sync Box */}
                        <div className="p-4.5 rounded-xl border border-slate-200 bg-slate-50 space-y-4 shadow-xs">
                          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                            <div>
                              <p className="text-xs font-black uppercase tracking-widest text-[#14532D]">Account Identity & Credentials</p>
                              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Connected to official Barangay Registry</p>
                            </div>
                            <span className="inline-flex rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-extrabold text-[#14532D]">
                              Live Admin Sync
                            </span>
                          </div>

                          {/* Full Name Display */}
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Resident Name</span>
                            <p className="text-xs font-black text-slate-900">{displayName}</p>
                          </div>

                          {/* 1. Username ID Section */}
                          <div className="pt-2 border-t border-slate-200/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Portal Username ID</span>
                                {!editingUsername && (
                                  <p className="text-xs font-bold font-mono text-slate-900 mt-0.5">{residentUsername}</p>
                                )}
                              </div>
                              {!editingUsername && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUsername(true);
                                    setEditingEmail(false);
                                    setNewUsername(residentUsername);
                                    setCredentialPassword("");
                                    setCredentialMessage(null);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-[#14532D] hover:bg-emerald-50 transition cursor-pointer shadow-2xs"
                                >
                                  <Pencil size={11} />
                                  <span>Edit Username</span>
                                </button>
                              )}
                            </div>

                            {/* Username Edit Form */}
                            {editingUsername && (
                              <form onSubmit={handleUsernameChange} className="p-3 rounded-xl bg-white border border-emerald-200 space-y-2.5 shadow-2xs">
                                <div className="space-y-1">
                                  <label className="text-[10.5px] font-black uppercase text-slate-700 block">New Username ID *</label>
                                  <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    placeholder="Enter new username"
                                    className="w-full h-8 px-3 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-900 outline-none focus:border-[#14532D] focus:bg-white transition"
                                    required
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10.5px] font-black uppercase text-slate-700 block">Current Password (To Confirm) *</label>
                                  <div className="relative">
                                    <input
                                      type={showCredentialPassword ? "text" : "password"}
                                      value={credentialPassword}
                                      onChange={(e) => setCredentialPassword(e.target.value)}
                                      placeholder="Confirm password"
                                      className="w-full h-8 pl-3 pr-8 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-900 outline-none focus:border-[#14532D] focus:bg-white transition"
                                      required
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowCredentialPassword(!showCredentialPassword)}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                    >
                                      {showCredentialPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="submit"
                                    disabled={savingCredential}
                                    className="flex-1 py-1.5 rounded-lg bg-[#14532D] hover:bg-[#0f3f22] text-white text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs disabled:opacity-50 cursor-pointer"
                                  >
                                    {savingCredential ? <Loader size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                    <span>Save Username</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingUsername(false);
                                      setCredentialMessage(null);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>

                          {/* 2. Email Address / Gmail Section */}
                          <div className="pt-2 border-t border-slate-200/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Email Address (Gmail)</span>
                                {!editingEmail && (
                                  <p className="text-xs font-bold text-slate-900 mt-0.5">
                                    {resident?.email || <span className="text-slate-400 italic">No email set</span>}
                                  </p>
                                )}
                              </div>
                              {!editingEmail && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEmail(true);
                                    setEditingUsername(false);
                                    setNewEmail(resident?.email || "");
                                    setCredentialPassword("");
                                    setCredentialMessage(null);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-[#14532D] hover:bg-emerald-50 transition cursor-pointer shadow-2xs"
                                >
                                  <Pencil size={11} />
                                  <span>Edit Email</span>
                                </button>
                              )}
                            </div>

                            {/* Email Edit Form */}
                            {editingEmail && (
                              <form onSubmit={handleEmailChange} className="p-3 rounded-xl bg-white border border-emerald-200 space-y-2.5 shadow-2xs">
                                <div className="space-y-1">
                                  <label className="text-[10.5px] font-black uppercase text-slate-700 block">New Email Address *</label>
                                  <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="resident@gmail.com"
                                    className="w-full h-8 px-3 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-900 outline-none focus:border-[#14532D] focus:bg-white transition"
                                    required
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10.5px] font-black uppercase text-slate-700 block">Current Password (To Confirm) *</label>
                                  <div className="relative">
                                    <input
                                      type={showCredentialPassword ? "text" : "password"}
                                      value={credentialPassword}
                                      onChange={(e) => setCredentialPassword(e.target.value)}
                                      placeholder="Confirm password"
                                      className="w-full h-8 pl-3 pr-8 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-900 outline-none focus:border-[#14532D] focus:bg-white transition"
                                      required
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowCredentialPassword(!showCredentialPassword)}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                    >
                                      {showCredentialPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="submit"
                                    disabled={savingCredential}
                                    className="flex-1 py-1.5 rounded-lg bg-[#14532D] hover:bg-[#0f3f22] text-white text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs disabled:opacity-50 cursor-pointer"
                                  >
                                    {savingCredential ? <Loader size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                    <span>Save Email</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingEmail(false);
                                      setCredentialMessage(null);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>

                          {/* Credential Status Feedback */}
                          {credentialMessage && (
                            <div className={`p-2.5 rounded-xl text-xs font-bold border ${
                              credentialMessage.type === "success"
                                ? "bg-emerald-50 border-emerald-200 text-[#14532D]"
                                : "bg-rose-50 border-rose-200 text-rose-800"
                            }`}>
                              {credentialMessage.text}
                            </div>
                          )}
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
                              Show floating desktop and mobile push alerts for announcements. Current status: <span className="font-extrabold uppercase text-[#14532D]">{isNotificationSupported() ? getNotificationPermission() : "Not Supported"}</span>
                            </p>
                            {isNotificationSupported() && getNotificationPermission() === "denied" && (
                              <span className="block text-[11px] text-rose-500 mt-1.5 font-bold">
                                ⚠️ Permission is blocked. Please click the lock icon next to the browser website address URL and change "Notification" settings to "Allow".
                              </span>
                            )}
                          </div>
                          {isNotificationSupported() && getNotificationPermission() !== "granted" && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  if (isNotificationSupported() && window.Notification.requestPermission) {
                                    await window.Notification.requestPermission();
                                    window.location.reload();
                                  }
                                } catch (e) {
                                  console.warn("Notification request permission failed:", e);
                                }
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

        </div>
      </main>

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
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#14532D] to-[#0F4324] py-2.5 text-xs font-bold text-white shadow-xs disabled:opacity-50 hover:scale-101 transition cursor-pointer"
                  >
                    {savingProfile ? <Loader size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                    Confirm & Update
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasswordConfirmOpen(false)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Floating 3D AI Robot Assistant Levitating Avatar & Typewriter Speech Bubble */}
      <FloatingRobotWidget assistantOpen={assistantOpen} onOpenAssistant={() => setAssistantOpen(true)} />

      {/* 6. Floating AI Assistant FAB Button */}
      <div className="fixed bottom-16 right-3 sm:bottom-6 sm:right-6 z-[9950] w-12 sm:w-16 flex items-center justify-center pointer-events-auto">
        <div className="relative flex items-center justify-center">
          {!assistantOpen && (
            <span 
              className="absolute -inset-1 rounded-full border-2 border-emerald-400 bg-emerald-400/20 animate-ping pointer-events-none" 
              style={{ animationDuration: "3s" }} 
            />
          )}

          {/* Clean Floating Button Container */}
          <motion.button
            type="button"
            onClick={() => setAssistantOpen(!assistantOpen)}
            animate={{ y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="relative flex items-center justify-center cursor-pointer transition-all drop-shadow-2xl"
            title="KaagapAI Virtual Assistant"
          >
            {assistantOpen ? (
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-rose-600 text-white shrink-0 shadow-2xl border-2 border-white/40">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            ) : (
              /* Enlarged Clean Animated Barangay Seal Logo Button */
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#022C22] text-white shrink-0 shadow-2xl border-2 border-emerald-300 ring-2 ring-emerald-400/40 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)] transition-all duration-300 hover:ring-emerald-300">
                <img
                  src={barangayLogo || "/logo.png"}
                  alt="Barangay Seal"
                  className="h-8.5 w-8.5 sm:h-10 sm:w-10 object-contain rounded-full drop-shadow-md"
                  onError={(e) => {
                    e.target.src = "/logo.png";
                  }}
                />
              </div>
            )}
          </motion.button>
        </div>
      </div>

      {/* Floating AI Assistant Window (Sleek Floating Card Widget) */}
      <AnimatePresence>
        {assistantOpen && (
          <div className="fixed inset-0 z-[9998] flex items-center sm:items-end justify-center sm:justify-end p-2 sm:p-5 pointer-events-none">
            {/* Backdrop: Visible only on mobile screens, non-blocking on laptop/desktop */}
            <motion.div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs pointer-events-auto sm:hidden"
              onClick={() => setAssistantOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            {/* Floating Chat Container */}
            <motion.div
              className="relative z-10 flex h-[min(650px,calc(100dvh-4.5rem))] max-h-[calc(100dvh-4.5rem)] w-full sm:w-[430px] flex-col overflow-hidden rounded-3xl border border-emerald-500/30 bg-[#042015]/95 shadow-2xl backdrop-blur-2xl pointer-events-auto ring-1 ring-emerald-500/20 mb-14 sm:mb-0"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
            >
              {/* Background A.I Image Overlay */}
              <div 
                className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none opacity-35 mix-blend-screen"
                style={{
                  backgroundImage: "url('/background.a.i.png')",
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                  backgroundRepeat: "no-repeat"
                }}
              />
              {/* Dark Emerald Vignette Overlay for Readability */}
              <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#042015]/80 via-[#022c22]/75 to-[#041a11]/85 pointer-events-none" />

              {/* Header */}
              <div className="flex h-14 shrink-0 items-center justify-between bg-gradient-to-r from-[#0B5D3B] via-[#0E6B46] to-[#157347] px-3 text-white relative shadow-sm z-10">
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
                        setSpeakingChatId(null);
                        setVoiceEnabled(false);
                        try {
                          localStorage.setItem("kaagapai_chatbot_voice_enabled", "false");
                        } catch {}
                      } else {
                        primeSpeechSynthesis();
                        setVoiceEnabled(true);
                        try {
                          localStorage.setItem("kaagapai_chatbot_voice_enabled", "true");
                        } catch {}
                      }
                    }}
                    className={`flex items-center justify-center p-1.5 rounded-xl text-xs font-bold transition border active:scale-95 cursor-pointer ${
                      voiceEnabled
                        ? "bg-emerald-500/30 text-emerald-200 border-emerald-400/40 hover:bg-emerald-500/40 shadow-xs"
                        : "bg-rose-500/20 text-rose-300 border-rose-400/30 hover:bg-rose-500/30"
                    }`}
                    title={voiceEnabled ? "Voice Output is ON (Click to Mute Voice)" : "Voice Output is MUTED (Click to Unmute Voice)"}
                  >
                    {voiceEnabled ? <Volume2 size={16} className="text-emerald-300 animate-pulse" /> : <VolumeX size={16} className="text-rose-300" />}
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
                    onClick={() => {
                      stopAssistantSpeech();
                      setSpeakingChatId(null);
                      setAssistantOpen(false);
                    }}
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
              <div className="flex-1 min-h-0 flex flex-col relative z-10 bg-transparent">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {assistantMessages.length === 0 && (
                    <div className="space-y-4 py-2">
                      <div className="rounded-2xl border border-emerald-500/25 bg-[#031d13]/85 backdrop-blur-md p-4 text-center shadow-lg">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#14532D] text-white shadow-sm mb-2">
                          <Bot size={22} />
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-100">
                          Magandang araw! Ako si KaagapAI
                        </h4>
                        <p className="mt-1 text-xs text-slate-300">
                          Ang iyong Upper Mingading Virtual Assistant. Piliin ang alinman sa mga madalas itanong sa ibaba o mag-type ng katanungan:
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5 px-1">
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
                              className="group flex items-center justify-between w-full rounded-xl border border-emerald-500/20 bg-[#031d13]/85 backdrop-blur-md p-2.5 px-3 text-left text-xs font-bold text-slate-100 transition hover:bg-[#14532D] hover:text-white hover:border-[#14532D] shadow-2xs active:scale-[0.98]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#14532D]/40 group-hover:bg-white/20 text-emerald-300 group-hover:text-white transition">
                                  <item.icon size={14} />
                                </div>
                                <span className="truncate">{item.text}</span>
                              </div>
                              <ChevronRight size={14} className="shrink-0 text-slate-400 group-hover:text-white transition ml-1" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {assistantMessages.map((chat) => {
                    const isAi = chat.role === "assistant";
                    const isFemale = String(resident?.gender || resident?.sex || "").toLowerCase().includes("female") || String(resident?.gender || resident?.sex || "").toLowerCase().includes("babae");

                    return (
                      <motion.div
                        key={chat.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className={`flex gap-2.5 ${isAi ? "items-start justify-start" : "items-end justify-end"}`}
                      >
                        {isAi && (
                          <div className="h-7 w-7 overflow-hidden rounded-full shrink-0 border border-emerald-500/50 bg-[#031d13] flex items-center justify-center shadow-xs">
                            <AssistantAiIcon />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-md ${
                            isAi
                              ? "bg-[#031d13]/90 backdrop-blur-md border border-emerald-500/30 text-slate-100 rounded-tl-xs leading-relaxed"
                              : "bg-gradient-to-r from-[#0B5D3B] to-[#157347] text-white rounded-br-xs font-semibold leading-relaxed border border-emerald-400/40"
                          }`}
                        >
                          <RenderChatChart text={chat.text} isAi={isAi} />
                          {isAi && (
                            <div className="mt-1.5 flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                              <button
                                type="button"
                                onClick={() => {
                                  if (speakingChatId === chat.id) {
                                    stopAssistantSpeech();
                                    setSpeakingChatId(null);
                                  } else {
                                    primeSpeechSynthesis();
                                    speakAssistantText(
                                      chat.text,
                                      () => setSpeakingChatId(chat.id),
                                      () => setSpeakingChatId(null)
                                    );
                                  }
                                }}
                                className={`mt-1 inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border transition active:scale-95 cursor-pointer ${
                                  speakingChatId === chat.id
                                    ? "bg-emerald-400 text-slate-950 border-emerald-300 shadow-md shadow-emerald-500/30 animate-pulse"
                                    : "text-emerald-300/90 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-500/30"
                                }`}
                                title={speakingChatId === chat.id ? "Click to Stop Voice" : "Listen in Professional English / Tagalog Voice"}
                              >
                                {speakingChatId === chat.id ? (
                                  <>
                                    <VolumeX size={12} className="text-slate-950" />
                                    <span>Stop Audio</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 size={12} className="text-emerald-400" />
                                    <span>Listen Voice</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {!isAi && (
                          <div className="h-7 w-7 overflow-hidden rounded-full shrink-0 border-2 border-emerald-400/60 bg-[#064E3B] flex items-center justify-center shadow-xs">
                            {resident?.profile_photo_url ? (
                              <img src={resident.profile_photo_url} alt="Resident Profile" className="h-full w-full object-cover" />
                            ) : isFemale ? (
                              <div className="flex h-full w-full items-center justify-center bg-pink-900/80 text-pink-200 text-xs font-black">
                                👩
                              </div>
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-emerald-900/80 text-emerald-200 text-xs font-black">
                                👨
                              </div>
                            )}
                          </div>
                        )}
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
                      <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-none border border-emerald-900/30 bg-emerald-900/40 px-4 py-2.5 shadow-sm">
                        <span className="text-xs font-bold text-emerald-400">KaagapAI is thinking</span>
                        <TypingIndicator className="text-emerald-400" />
                      </div>
                    </motion.div>
                  )}
                  <div ref={assistantMessagesEndRef} />
                </div>

                {/* Input form */}
                <form onSubmit={handleAssistantSubmit} className="flex h-14 items-center gap-2 border-t border-emerald-500/25 bg-[#02180f]/90 backdrop-blur-md px-3 shrink-0">
                  <input
                    value={assistantInput}
                    onChange={(e) => setAssistantInput(e.target.value)}
                    placeholder="Ask KaagapAI..."
                    className="min-w-0 flex-1 rounded-xl border border-emerald-500/30 bg-[#01120b]/90 px-3 py-2.5 text-xs outline-none focus:border-emerald-400 focus:bg-[#02180f] font-semibold text-slate-100 placeholder-emerald-200/50"
                  />
                  <button
                    type="submit"
                    disabled={assistantLoading || !assistantInput.trim()}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#0B5D3B] to-[#157347] text-white shadow-xs disabled:opacity-50 hover:scale-101 transition cursor-pointer"
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

      {/* 6.5 Official Details Glass Modal - White Transparent Glass */}
      <FloatingModal
        open={!!selectedOfficialForModal}
        onClose={() => setSelectedOfficialForModal(null)}
        title={selectedOfficialForModal?.name || "Official Details"}
        eyebrow={selectedOfficialForModal?.position || "Barangay Official"}
        maxWidth="max-w-md"
      >
        {selectedOfficialForModal && (
          <div className="space-y-4 animate-fadeIn py-1 text-slate-900">
            <div className="flex flex-col items-center text-center p-4 rounded-3xl bg-white/90 backdrop-blur-md border border-emerald-200/80 shadow-xs">
              <div className="h-32 w-32 shrink-0 overflow-hidden rounded-3xl border-2 border-emerald-500/60 bg-emerald-50 shadow-xl flex items-center justify-center font-black text-2xl text-[#033E2A] mb-3 relative group">
                {selectedOfficialForModal.photoUrl ? (
                  <img
                    src={selectedOfficialForModal.photoUrl}
                    alt={selectedOfficialForModal.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-2">
                    <User size={44} className="text-[#033E2A] mb-1" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">No Photo</span>
                  </div>
                )}
              </div>
              
              <span className="inline-block rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-[#033E2A] mb-1">
                {selectedOfficialForModal.position || "Barangay Official"}
              </span>
              <h3 className="text-lg font-black text-slate-900 leading-snug">
                {selectedOfficialForModal.name}
              </h3>
              {selectedOfficialForModal.committee && (
                <p className="text-xs font-bold text-[#033E2A] mt-0.5">
                  {selectedOfficialForModal.committee}
                </p>
              )}
            </div>

            {selectedOfficialForModal.focusArea && (
              <div className="p-4 rounded-2xl bg-white/90 backdrop-blur-md border border-emerald-200/80 space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#033E2A]">
                  Focus Area & Governance
                </h4>
                <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                  {selectedOfficialForModal.focusArea}
                </p>
              </div>
            )}

            {selectedOfficialForModal.background && (
              <div className="p-4 rounded-2xl bg-white/90 backdrop-blur-md border border-emerald-200/80 space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#033E2A]">
                  Biography & Background
                </h4>
                <p className="text-xs font-medium text-slate-700 leading-relaxed">
                  {selectedOfficialForModal.background}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/90 backdrop-blur-md border border-emerald-200/80 text-xs font-semibold text-slate-800">
                <Phone size={15} className="text-[#033E2A] shrink-0" />
                <span className="truncate">{selectedOfficialForModal.contact || "Barangay Hall Direct"}</span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/90 backdrop-blur-md border border-emerald-200/80 text-xs font-semibold text-slate-800">
                <Mail size={15} className="text-[#033E2A] shrink-0" />
                <span className="truncate">{selectedOfficialForModal.email || "Official Office Mail"}</span>
              </div>
            </div>
          </div>
        )}
      </FloatingModal>

      {/* 6.6 Resident Livelihood Opportunity Full Details Modal */}
      <FloatingModal
        open={!!selectedLivelihoodDetail}
        onClose={() => setSelectedLivelihoodDetail(null)}
        title={selectedLivelihoodDetail?.title || "Livelihood Opportunity Details"}
        eyebrow={selectedLivelihoodDetail?.category ? `${selectedLivelihoodDetail.category} Opportunity` : "Program Details"}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <span className="text-xs font-semibold text-slate-500">
              Deadline: {selectedLivelihoodDetail?.deadline ? new Date(selectedLivelihoodDetail.deadline).toLocaleDateString() : "Open"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedLivelihoodDetail(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
              {selectedLivelihoodDetail?.status === "Open" && (() => {
                const application = residentApplications.find(app => app.livelihood_post_id === selectedLivelihoodDetail.id);
                if (!application) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const oppId = selectedLivelihoodDetail.id;
                        setSelectedLivelihoodDetail(null);
                        handleApplyLivelihood(oppId);
                      }}
                      className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#044E35] via-[#057A55] to-[#046C4E] text-white text-xs font-black hover:brightness-110 shadow-md transition active:scale-95 cursor-pointer"
                    >
                      Apply for this Opportunity
                    </button>
                  );
                }
                if (application.status === "Approved") {
                  return (
                    <span className="px-4 py-2 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-emerald-700" />
                      Application Approved / Listed
                    </span>
                  );
                }
                return (
                  <span className="px-4 py-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold">
                    Application {application.status}
                  </span>
                );
              })()}
            </div>
          </div>
        }
      >
        {selectedLivelihoodDetail && (
          <div className="space-y-4 py-1 text-slate-900">
            {/* Category & Status Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-800 uppercase tracking-wider">
                  {selectedLivelihoodDetail.category || "Program"}
                </span>
                <span className={`rounded-xl px-3 py-1 text-xs font-bold ${selectedLivelihoodDetail.status === "Open" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                  {selectedLivelihoodDetail.status}
                </span>
              </div>
              {selectedLivelihoodDetail.slots && (
                <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-2xs">
                  Slots: <b className="text-emerald-800">{selectedLivelihoodDetail.slots}</b>
                </span>
              )}
            </div>

            {/* Meta details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Organization / Sponsor</span>
                <p className="font-bold text-slate-800">{selectedLivelihoodDetail.organization || "Barangay Upper Mingading"}</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Location / Venue</span>
                <p className="font-bold text-slate-800">{selectedLivelihoodDetail.location || "Barangay Hall / Covered Court"}</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Application Deadline</span>
                <p className="font-bold text-slate-800">{selectedLivelihoodDetail.deadline ? new Date(selectedLivelihoodDetail.deadline).toLocaleDateString() : "No deadline"}</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Contact Person / Hotline</span>
                <p className="font-bold text-slate-800">{selectedLivelihoodDetail.contact || "Barangay Office: 09306259795"}</p>
              </div>
            </div>

            {/* Eligibility Requirements */}
            {selectedLivelihoodDetail.eligibility && (
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                <h5 className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-emerald-700" />
                  <span>Qualifications & Eligibility Requirements:</span>
                </h5>
                <p className="text-xs font-medium text-slate-800 whitespace-pre-line leading-relaxed">
                  {selectedLivelihoodDetail.eligibility}
                </p>
              </div>
            )}

            {/* Program Description */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <FileText size={14} className="text-[#033E2A]" />
                <span>Full Program Details & Objectives:</span>
              </h5>
              <p className="text-xs font-medium text-slate-700 whitespace-pre-line leading-relaxed">
                {selectedLivelihoodDetail.description || "No further details provided."}
              </p>
            </div>
          </div>
        )}
      </FloatingModal>

      {/* 6.7 Resident Announcement Full Details Modal */}
      <FloatingModal
        open={!!selectedAnnouncementDetail}
        onClose={() => setSelectedAnnouncementDetail(null)}
        title={selectedAnnouncementDetail?.title || "Barangay Advisory & Event"}
        eyebrow={selectedAnnouncementDetail?.category ? `${selectedAnnouncementDetail.category} Notice` : "Official Advisory"}
        maxWidth="max-w-xl"
        footer={
          <div className="flex items-center justify-between w-full text-xs">
            <span className="text-slate-500 font-semibold">
              {selectedAnnouncementDetail?.publish_date ? `Published: ${new Date(selectedAnnouncementDetail.publish_date).toLocaleDateString()}` : ""}
            </span>
            <button
              type="button"
              onClick={() => setSelectedAnnouncementDetail(null)}
              className="px-5 py-2 font-bold text-white bg-gradient-to-r from-[#033E2A] to-[#057A55] rounded-xl hover:brightness-110 shadow-xs cursor-pointer"
            >
              Close Advisory
            </button>
          </div>
        }
      >
        {selectedAnnouncementDetail && (
          <div className="space-y-4 py-1 text-slate-900">
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-black text-xs uppercase tracking-wider">
                {selectedAnnouncementDetail.category || "General"}
              </span>
              <span className="text-xs font-bold text-slate-500">
                Barangay Upper Mingading
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <p className="text-xs font-medium text-slate-800 whitespace-pre-line leading-relaxed">
                {selectedAnnouncementDetail.body || "No announcement content."}
              </p>
            </div>
          </div>
        )}
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


      {/* FLOATING TOAST NOTIFICATION (UPPER Z-INDEX ABOVE CHATBOT FAB & MODALS) */}
      <AnimatePresence>
        {(latestAnnouncementToast || latestNotificationToast) && (
          <motion.div
            initial={{ opacity: 0, x: 200 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 200 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-20 right-3 sm:bottom-24 sm:right-6 z-[10000] w-[calc(100%-1.5rem)] max-w-sm flex flex-col gap-3 pointer-events-auto"
          >
            {latestAnnouncementToast && (() => {
              const toastTheme = getAnnouncementVisualTheme(
                latestAnnouncementToast.title,
                latestAnnouncementToast.body,
                latestAnnouncementToast.category
              );
              return (
                <div className="p-4 rounded-2xl border border-slate-700/80 shadow-2xl bg-slate-950/95 backdrop-blur-md text-white flex items-start gap-3 relative overflow-hidden transition-all duration-300 ring-1 ring-white/10">
                  {/* Visual Accent Bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    toastTheme.type === "earthquake" ? "bg-amber-500" :
                    toastTheme.type === "fire" ? "bg-rose-500" :
                    toastTheme.type === "storm" ? "bg-cyan-500" :
                    toastTheme.type === "health" ? "bg-emerald-500" :
                    toastTheme.type === "power" ? "bg-indigo-500" :
                    toastTheme.type === "emergency" ? "bg-rose-500" : "bg-[#C8A14A]"
                  }`} />
                  
                  {/* Category Emoji Icon Indicator */}
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 border text-lg shadow-inner ${
                    toastTheme.type === "earthquake" ? "border-amber-500/50" :
                    toastTheme.type === "fire" ? "border-rose-500/50" :
                    toastTheme.type === "storm" ? "border-cyan-500/50" :
                    toastTheme.type === "health" ? "border-emerald-500/50" :
                    toastTheme.type === "power" ? "border-indigo-500/50" : "border-[#C8A14A]/40"
                  }`}>
                    <span className="animate-bounce">{toastTheme.icon}</span>
                  </span>

                  <div className="min-w-0 flex-1 space-y-1 pl-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-black tracking-wider text-[#C8A14A] uppercase flex items-center gap-1">
                        <span>KAAGAPA.I</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white font-black">{latestAnnouncementToast.category || "Notice"}</span>
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">Just Now</span>
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
                        className="px-3.5 py-1.5 text-xs font-black rounded-lg bg-[#14532D] hover:bg-[#14532D]/90 text-white border border-[#C8A14A]/30 transition active:scale-95 shadow-sm cursor-pointer"
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
                        className="px-2.5 py-1 text-xs font-extrabold text-slate-300 hover:text-white hover:underline transition cursor-pointer"
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
                      className="rounded-full p-1.5 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
                      aria-label="Close notification"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })()}
            
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

      {/* Edit Pending Document Request Modal with Full Dynamic Customization Features */}
      <AnimatePresence>
        {editingRequest && (() => {
          const editDocKey = getRealDocumentTemplateKey(editDocumentType);
          const isFemale = String(resident?.gender || resident?.sex || "").toLowerCase().includes("female");

          return (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
                onClick={() => setEditingRequest(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative w-full max-w-lg rounded-3xl bg-[#042A1D] border-2 border-emerald-400/40 p-5 sm:p-6 shadow-2xl z-10 space-y-4 text-white my-auto max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      <Pencil size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                        Edit Document Request
                      </h3>
                      <p className="text-[10px] text-emerald-200/75 font-semibold">
                        Ref: {editingRequest.tracking_number || editingRequest.ref || `REQ-${String(editingRequest.id).slice(0, 8)}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingRequest(null)}
                    className="p-1.5 rounded-xl text-emerald-200/70 hover:bg-white/10 hover:text-white transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveEditRequest} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-emerald-300 mb-1.5">
                      Document Template Type *
                    </label>
                    <select
                      value={editDocumentType}
                      onChange={(e) => setEditDocumentType(e.target.value)}
                      className="w-full rounded-2xl border border-emerald-400/40 bg-black/40 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-emerald-400 text-white transition cursor-pointer"
                      required
                    >
                      <option value="" className="bg-[#022B1D] text-white">Choose Document Template</option>
                      {documentTemplates.map((t) => {
                        const label = t.template_name || t.document_type;
                        return (
                          <option key={t.id || label} value={label} className="bg-[#022B1D] text-white">
                            {label} {t.fee ? `(${t.fee})` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* 1. RESIDENCY CUSTOM RECOMMENDATION */}
                  {editDocKey === "residency" && (
                    <div className="space-y-2 rounded-2xl bg-black/30 border border-emerald-400/30 p-3.5">
                      <label className="block text-xs font-black uppercase tracking-wider text-emerald-300">
                        Inire-rekomendang Layunin (Recommendation) *
                      </label>
                      <input
                        type="text"
                        value={editResidencyRecommendation}
                        onChange={(e) => setEditResidencyRecommendation(e.target.value)}
                        placeholder="Halimbawa: for a CAFGU / for Scholarship"
                        className="w-full rounded-xl border border-emerald-400/40 bg-black/40 px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-emerald-300 shadow-inner"
                        required
                      />
                      <div className="flex flex-wrap gap-1 pt-1">
                        {["for a CAFGU", "for Scholarship", "for Bank Account", "for Postal ID", "for Local Employment"].map((rec) => (
                          <button
                            key={rec}
                            type="button"
                            onClick={() => setEditResidencyRecommendation(rec)}
                            className="rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 px-2 py-0.5 text-[9.5px] font-bold text-emerald-200 border border-emerald-400/30 transition cursor-pointer"
                          >
                            + {rec}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. 4PS CERTIFICATION FIELDS */}
                  {editDocKey === "4ps" && (
                    <div className="space-y-2.5 rounded-2xl bg-black/30 border border-emerald-400/30 p-3.5">
                      <label className="block text-xs font-black uppercase tracking-wider text-emerald-300">
                        Pangalan ng Asawa Abroad (Spouse working Abroad)
                      </label>
                      <input
                        type="text"
                        value={editFourPsSpouse}
                        onChange={(e) => setEditFourPsSpouse(e.target.value)}
                        placeholder="Pangalan ng asawa (hal. Maria Clara Dela Cruz)"
                        className="w-full rounded-xl border border-emerald-400/40 bg-black/40 px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-emerald-300 shadow-inner"
                      />
                      <label className="block text-xs font-black uppercase tracking-wider text-emerald-300 mt-2">
                        Layunin (Purpose) *
                      </label>
                      <input
                        type="text"
                        value={editPurpose}
                        onChange={(e) => setEditPurpose(e.target.value)}
                        placeholder="Change Grantee / 4Ps Cash Grant"
                        className="w-full rounded-xl border border-emerald-400/40 bg-black/40 px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-emerald-300 shadow-inner"
                        required
                      />
                    </div>
                  )}

                  {/* 3. SOLO PARENT CERTIFICATION FIELDS */}
                  {editDocKey === "solo" && (
                    <div className="space-y-2 rounded-2xl bg-black/30 border border-amber-400/30 p-3.5">
                      <label className="block text-xs font-black uppercase tracking-wider text-amber-300">
                        Dahilan ng Pagiging Solo Parent (Reason) *
                      </label>
                      <input
                        type="text"
                        value={editSoloReason}
                        onChange={(e) => setEditSoloReason(e.target.value)}
                        placeholder="Halimbawa: death of her husband / separation from spouse"
                        className="w-full rounded-xl border border-amber-400/40 bg-black/40 px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-amber-300 shadow-inner"
                        required
                      />
                      <div className="flex flex-wrap gap-1 pt-1">
                        {[
                          isFemale ? "death of her husband" : "death of his wife",
                          isFemale ? "separation from her husband" : "separation from his wife",
                          "abandonment by spouse",
                          isFemale ? "unmarried mother" : "single father",
                          "incarceration / detention of spouse"
                        ].map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setEditSoloReason(r)}
                            className="rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 text-[9.5px] font-bold text-amber-200 border border-amber-400/30 transition cursor-pointer"
                          >
                            + {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. BUSINESS PERMIT FIELDS */}
                  {editDocKey === "business" && (
                    <div className="space-y-2 rounded-2xl bg-black/30 border border-blue-400/30 p-3.5">
                      <label className="block text-xs font-black uppercase tracking-wider text-blue-300">
                        Pangalan at Uri ng Negosyo (Business Name & Nature) *
                      </label>
                      <input
                        type="text"
                        value={editBusinessName}
                        onChange={(e) => setEditBusinessName(e.target.value)}
                        placeholder="Halimbawa: BANANA BUY AND SALE / SARI-SARI STORE"
                        className="w-full rounded-xl border border-blue-400/40 bg-black/40 px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-blue-300 shadow-inner"
                        required
                      />
                    </div>
                  )}

                  {/* 5. RSBSA CERTIFICATION FIELDS */}
                  {editDocKey === "rsbsa" && (
                    <div className="space-y-2.5 rounded-2xl bg-black/30 border border-emerald-400/30 p-3.5">
                      <label className="block text-xs font-black uppercase tracking-wider text-emerald-300">
                        Pananim at Detalye ng Sakahan (Crop / Farm Details) *
                      </label>
                      <div>
                        <span className="text-[10px] font-bold text-emerald-200/80 block mb-1">Uri ng Pananim / Tilling Crop(s):</span>
                        <input
                          type="text"
                          value={editCropsText}
                          onChange={(e) => setEditCropsText(e.target.value)}
                          placeholder="Halimbawa: Rice Field ½ hectare, and Fruits Crops 1 hectare"
                          className="w-full rounded-xl border border-emerald-400/40 bg-black/40 px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-emerald-300 shadow-inner"
                          required
                        />
                        <div className="mt-1 flex flex-wrap gap-1">
                          {[
                            "Rice Field ½ hectare, and Fruits Crops 1 hectare",
                            "Rice Field 1 hectare",
                            "Corn Field 1 hectare",
                            "Coconut Farm 2 hectares",
                            "Vegetable Farm ½ hectare",
                          ].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setEditCropsText(preset)}
                              className="rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-200 border border-emerald-400/30 transition cursor-pointer"
                            >
                              + {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-200/80 block mb-1">Laki ng Lupa (Farm Size):</span>
                          <input
                            type="text"
                            value={editFarmSize}
                            onChange={(e) => setEditFarmSize(e.target.value)}
                            placeholder="e.g. One (1) hectare"
                            className="w-full rounded-xl border border-emerald-400/40 bg-black/40 px-3 py-2 text-xs font-bold text-white outline-none focus:border-emerald-300 shadow-inner"
                            required
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-emerald-200/80 block mb-1">Pag-aari (Tenure):</span>
                          <select
                            value={editTenure}
                            onChange={(e) => setEditTenure(e.target.value)}
                            className="w-full rounded-xl border border-emerald-400/40 bg-[#022B1D] px-3 py-2 text-xs font-bold text-white outline-none focus:border-emerald-300 shadow-inner cursor-pointer"
                          >
                            <option value="Owner" className="bg-[#022B1D] text-white">Owner</option>
                            <option value="Farmer" className="bg-[#022B1D] text-white">Farmer</option>
                            <option value="Tenant" className="bg-[#022B1D] text-white">Tenant</option>
                            <option value="Lessee" className="bg-[#022B1D] text-white">Lessee</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 6. GENERAL / INDIGENCY PURPOSE */}
                  {editDocKey !== "residency" && editDocKey !== "4ps" && editDocKey !== "solo" && editDocKey !== "business" && editDocKey !== "rsbsa" && (
                    <div className="space-y-2">
                      <label className="block text-xs font-black uppercase tracking-wider text-emerald-300">
                        Layunin ng Paghingi (Purpose of Request) *
                      </label>
                      <textarea
                        value={editPurpose}
                        onChange={(e) => setEditPurpose(e.target.value)}
                        placeholder="I-type ang layunin (hal. OWWA, Local Employment, Scholarship, Postal ID, Bank, etc.)"
                        className="w-full rounded-2xl border border-emerald-400/40 bg-black/40 px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-300 shadow-inner"
                        rows={2}
                        required
                      />
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {quickPurposes.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setEditPurpose(p)}
                            className="text-[9.5px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 transition cursor-pointer"
                          >
                            + {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t border-emerald-500/30">
                    <button
                      type="button"
                      onClick={() => setEditingRequest(null)}
                      className="px-4 py-2 rounded-xl border border-white/20 text-xs font-bold text-emerald-100 hover:bg-white/10 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updatingRequest || !editDocumentType}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:opacity-95 active:scale-95 text-white text-xs font-black shadow-lg shadow-emerald-950/40 transition disabled:opacity-50 cursor-pointer"
                    >
                      {updatingRequest ? <Loader size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                      <span>Save Updates</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Official Governance Profile Detail Modal */}
      {selectedOfficialForModal && (
        <FloatingModal
          open={Boolean(selectedOfficialForModal)}
          onClose={() => setSelectedOfficialForModal(null)}
          title={selectedOfficialForModal.name || "Barangay Official Profile"}
          eyebrow="BARANGAY OFFICIAL DIRECTORY"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-200 border border-slate-300/80 shadow-sm">
                {selectedOfficialForModal.photoUrl ? (
                  <img
                    src={selectedOfficialForModal.photoUrl}
                    alt={selectedOfficialForModal.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-800 text-white font-black text-sm">
                    {selectedOfficialForModal.level === "captain" ? "PB" : "BO"}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-block rounded-full bg-[#881337]/10 text-[#881337] dark:bg-rose-950/50 dark:text-rose-300 border border-[#881337]/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                  {selectedOfficialForModal.position || "Council Member"}
                </span>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1 leading-snug truncate">
                  {selectedOfficialForModal.name}
                </h3>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {selectedOfficialForModal.committee || "Sangguniang Barangay Council"}
                </p>
              </div>
            </div>

            {selectedOfficialForModal.focusArea && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 border border-emerald-200/80 dark:border-emerald-800/60 text-xs space-y-1">
                <p className="font-bold text-emerald-800 dark:text-emerald-300">Focus & Key Responsibilities:</p>
                <p className="font-medium text-emerald-950 dark:text-emerald-100 leading-relaxed">
                  {selectedOfficialForModal.focusArea}
                </p>
              </div>
            )}

            {selectedOfficialForModal.background && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                <p className="font-bold text-slate-500 dark:text-slate-400">Public Service Overview:</p>
                <p className="font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedOfficialForModal.background}
                </p>
              </div>
            )}

            {(selectedOfficialForModal.contact || selectedOfficialForModal.email) && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
                <p className="font-bold text-slate-500 dark:text-slate-400">Official Contact Information:</p>
                {selectedOfficialForModal.contact && (
                  <p className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                    <Phone size={13} className="text-emerald-600" />
                    <span>{selectedOfficialForModal.contact}</span>
                  </p>
                )}
                {selectedOfficialForModal.email && (
                  <p className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                    <Mail size={13} className="text-emerald-600" />
                    <span>{selectedOfficialForModal.email}</span>
                  </p>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOfficialForModal(null)}
                className="px-5 py-2 text-xs font-black rounded-xl bg-[#14532D] hover:bg-[#0f3e21] text-white transition active:scale-95 cursor-pointer shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </FloatingModal>
      )}

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
            {(() => {
              const modalTheme = getAnnouncementVisualTheme(
                selectedAnnouncementModal.title,
                selectedAnnouncementModal.body,
                selectedAnnouncementModal.category
              );
              return (
                <div className="flex justify-between items-center flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border flex items-center gap-1.5 shadow-sm ${modalTheme.badgeBg}`}>
                    <span>{modalTheme.icon}</span>
                    <span>{selectedAnnouncementModal.category || "General Announcement"}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-400">
                    Published: {new Date(selectedAnnouncementModal.publish_date || selectedAnnouncementModal.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              );
            })()}

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

      {/* Fixed Mobile Bottom Navigation Bar (Menu, Home, Dashboard, My Profile, Info) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[9900] bg-[#0d3b2b] border-t border-emerald-300/50 shadow-[0_-4px_25px_rgba(0,0,0,0.5)] px-1 py-1.5 flex items-center justify-around text-white">
        {[
          { key: "menu", label: "Menu", icon: Menu, action: () => setMobileSidebarOpen(true) },
          { key: "home", label: "Home", icon: Home, action: () => openModule("home") },
          { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, action: () => openModule("dashboard") },
          { key: "profile", label: "Profile", icon: User, action: () => openModule("profile") },
          { key: "personal_info", label: "My Info", icon: FileText, action: () => openModule("personal_info") },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === "menu" ? mobileSidebarOpen : activeNav === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={tab.action}
              className={`relative flex flex-col items-center justify-center py-1 px-1 flex-1 min-w-0 transition-all duration-200 cursor-pointer ${
                isActive ? "text-emerald-300" : "text-emerald-100/80 hover:text-white"
              }`}
            >
              {isActive && (
                <span className="absolute -top-1.5 h-1 w-7 rounded-b-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              )}
              <Icon size={20} className={`shrink-0 mb-0.5 transition-transform ${isActive ? "text-emerald-300 scale-110 drop-shadow-md" : "text-emerald-100/80 drop-shadow-xs"}`} />
              <span className={`text-[9.5px] truncate font-black leading-tight max-w-full ${isActive ? "text-emerald-300 drop-shadow-xs" : "text-emerald-100/80"}`}>
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