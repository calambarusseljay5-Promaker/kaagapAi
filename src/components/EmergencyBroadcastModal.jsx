import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Volume2,
  VolumeX,
  BellRing,
  PhoneCall,
  ShieldAlert,
  Flame,
  Activity,
  Car,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  playEmergencyAlarm,
  stopEmergencyAlarm,
  markEmergencyAcknowledged,
} from "../utils/emergencyAlertSound";

export default function EmergencyBroadcastModal({
  emergencyAnnouncement,
  residentId = "guest",
  onAcknowledge = null,
  onClose = null,
}) {
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  if (!emergencyAnnouncement) return null;

  const title = emergencyAnnouncement.title || "Urgent Barangay Emergency Alert";
  const body = emergencyAnnouncement.body || "Please remain alert and follow official safety directives.";
  const lowerTitle = title.toLowerCase();
  const lowerBody = body.toLowerCase();

  // Determine emergency category icon & accent
  let EmergencyIcon = ShieldAlert;
  let emergencyTheme = "from-red-600 to-rose-700";
  let emergencyLabel = "COMMUNITY SAFETY EMERGENCY";

  if (lowerTitle.includes("earthquake") || lowerBody.includes("earthquake") || lowerTitle.includes("lindol")) {
    EmergencyIcon = Activity;
    emergencyTheme = "from-amber-600 via-orange-600 to-red-700";
    emergencyLabel = "EARTHQUAKE DISASTER ADVISORY";
  } else if (lowerTitle.includes("carnap") || lowerBody.includes("carnap") || lowerTitle.includes("theft") || lowerTitle.includes("security")) {
    EmergencyIcon = Car;
    emergencyTheme = "from-red-700 via-rose-800 to-red-950";
    emergencyLabel = "CARNAPPING & CRIME SECURITY ALERT";
  } else if (lowerTitle.includes("fire") || lowerBody.includes("fire") || lowerTitle.includes("sunog")) {
    EmergencyIcon = Flame;
    emergencyTheme = "from-orange-600 via-red-600 to-rose-700";
    emergencyLabel = "FIRE EMERGENCY EVACUATION ADVISORY";
  } else if (lowerTitle.includes("flood") || lowerTitle.includes("typhoon") || lowerTitle.includes("bagyo")) {
    EmergencyIcon = AlertTriangle;
    emergencyTheme = "from-blue-700 via-indigo-700 to-red-700";
    emergencyLabel = "TYPHOON & FLOOD WARNING";
  }

  // Attempt to sound the siren immediately upon mounting
  useEffect(() => {
    let alarmHandle = null;
    try {
      alarmHandle = playEmergencyAlarm({
        loop: true,
        maxDurationSeconds: 40,
        onStop: () => setIsPlayingSound(false),
      });
      setIsPlayingSound(true);
      setAudioBlocked(false);
    } catch (err) {
      console.warn("Autoplay blocked:", err);
      setAudioBlocked(true);
      setIsPlayingSound(false);
    }

    return () => {
      stopEmergencyAlarm();
    };
  }, [emergencyAnnouncement.id]);

  const handleStartSoundManually = () => {
    try {
      playEmergencyAlarm({
        loop: true,
        maxDurationSeconds: 40,
        onStop: () => setIsPlayingSound(false),
      });
      setIsPlayingSound(true);
      setAudioBlocked(false);
    } catch (e) {
      console.warn("Manual audio start failed:", e);
    }
  };

  const handleSilenceAlarm = () => {
    stopEmergencyAlarm();
    setIsPlayingSound(false);
  };

  const handleAcknowledge = () => {
    stopEmergencyAlarm();
    setIsPlayingSound(false);
    markEmergencyAcknowledged(emergencyAnnouncement.id, residentId);
    if (onAcknowledge) onAcknowledge(emergencyAnnouncement);
    if (onClose) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border-4 border-red-500/80 bg-slate-950 text-white shadow-2xl shadow-red-900/70 ring-8 ring-red-500/20 animate-scaleUp">
        {/* Animated Emergency Strobe Bar */}
        <div className="h-3 w-full bg-gradient-to-r from-red-600 via-amber-400 to-red-600 animate-pulse" />

        {/* Hazard Strip Header */}
        <div className={`relative px-5 py-4 bg-gradient-to-r ${emergencyTheme} flex items-center justify-between text-white shadow-md`}>
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-black/40 ring-2 ring-white/40 shadow-inner">
              <EmergencyIcon className="h-7 w-7 text-amber-300 animate-bounce" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500"></span>
              </span>
            </div>
            <div>
              <span className="inline-block rounded-full bg-black/50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-200 ring-1 ring-amber-400/40">
                {emergencyLabel}
              </span>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white drop-shadow">
                EMERGENCY BROADCAST ALERT
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPlayingSound ? (
              <button
                type="button"
                onClick={handleSilenceAlarm}
                className="flex items-center gap-1.5 rounded-xl bg-black/40 hover:bg-black/60 px-3 py-1.5 text-xs font-bold text-amber-200 ring-1 ring-amber-400/30 transition active:scale-95"
                title="Silence siren"
              >
                <VolumeX className="h-4 w-4 text-amber-300 animate-pulse" />
                <span className="hidden sm:inline">Mute Siren</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartSoundManually}
                className="flex items-center gap-1.5 rounded-xl bg-red-800/80 hover:bg-red-700 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-red-400/40 transition active:scale-95"
                title="Sound siren"
              >
                <Volume2 className="h-4 w-4 text-amber-300" />
                <span className="hidden sm:inline">Play Siren</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleAcknowledge}
              className="rounded-full bg-black/30 p-1.5 text-white/80 hover:bg-black/50 hover:text-white transition"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Siren Ringing Alert Bar */}
        {isPlayingSound && (
          <div className="flex items-center justify-between gap-3 bg-red-900/50 px-5 py-2.5 border-y border-red-500/30 text-xs font-semibold text-red-100">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-amber-400 animate-spin" />
              <span>Device Siren & Vibration Active (NDRRMC Emergency Standard)</span>
            </div>
            <button
              type="button"
              onClick={handleSilenceAlarm}
              className="text-amber-300 underline font-bold hover:text-amber-100"
            >
              Silence Siren
            </button>
          </div>
        )}

        {/* Browser Autoplay Blocked Fallback Bar */}
        {audioBlocked && !isPlayingSound && (
          <div className="flex items-center justify-between gap-3 bg-amber-950/70 px-5 py-2.5 border-y border-amber-500/40 text-xs font-semibold text-amber-100">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-yellow-300 animate-pulse" />
              <span>Tap below to hear the loud emergency alarm siren on your device.</span>
            </div>
            <button
              type="button"
              onClick={handleStartSoundManually}
              className="rounded-lg bg-amber-600 hover:bg-amber-500 px-2.5 py-1 text-[11px] font-black uppercase text-black"
            >
              Sound Siren
            </button>
          </div>
        )}

        {/* Emergency Content Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wide mb-1">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              Official Public Safety Advisory
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
              {title}
            </h3>
          </div>

          <div className="rounded-2xl bg-red-950/40 p-4 border border-red-500/30 text-sm text-slate-200 leading-relaxed whitespace-pre-line select-text font-normal">
            {body}
          </div>

          {/* Emergency Hotlines Box */}
          <div className="rounded-2xl bg-slate-900/90 p-4 border border-slate-700/60">
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-emerald-400" />
              Direct Emergency Hotlines:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <a
                href="tel:09306259795"
                className="flex items-center justify-between rounded-xl bg-slate-800/80 hover:bg-slate-800 p-2.5 border border-slate-700 text-slate-200 transition"
              >
                <span className="font-semibold">Barangay Hotline:</span>
                <span className="font-black text-emerald-400 font-mono">09306259795</span>
              </a>
              <a
                href="tel:911"
                className="flex items-center justify-between rounded-xl bg-slate-800/80 hover:bg-slate-800 p-2.5 border border-slate-700 text-slate-200 transition"
              >
                <span className="font-semibold">National Emergency:</span>
                <span className="font-black text-red-400 font-mono">911</span>
              </a>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border-t border-slate-800 flex flex-col sm:flex-row gap-2.5 items-center justify-end">
          {isPlayingSound ? (
            <button
              type="button"
              onClick={handleSilenceAlarm}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 hover:bg-slate-700 px-4 py-3 text-xs font-bold text-slate-200 ring-1 ring-slate-600 transition active:scale-95"
            >
              <VolumeX className="h-4 w-4 text-amber-400" />
              Silence Siren
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartSoundManually}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-red-950/70 hover:bg-red-900/80 px-4 py-3 text-xs font-bold text-red-200 ring-1 ring-red-500/40 transition active:scale-95"
            >
              <Volume2 className="h-4 w-4 text-amber-400" />
              Test Siren Sound
            </button>
          )}

          <button
            type="button"
            onClick={handleAcknowledge}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-900/60 ring-2 ring-red-400 transition active:scale-95"
          >
            <CheckCircle2 className="h-4 w-4" />
            Acknowledge & Dismiss Alert
          </button>
        </div>
      </div>
    </div>
  );
}
