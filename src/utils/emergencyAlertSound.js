/**
 * Emergency Alert Sound & Device Ringing Utility (NDRRMC / EAS Standard)
 *
 * Synthesizes the authentic dual-tone emergency broadcast sound (853 Hz + 960 Hz warble
 * and high-urgency siren sweep) using the native HTML5 Web Audio API.
 * Works natively on laptops, desktops, and mobile phones (iOS & Android) without external audio files.
 * Also triggers high-intensity device vibration on supported mobile devices.
 */

let activeAudioCtx = null;
let activeOscillators = [];
let activeGainNodes = [];
let vibrationTimer = null;
let sirenLoopTimer = null;
let isAlarmCurrentlyPlaying = false;

/**
 * Checks if a given announcement is an urgent emergency requiring device alarms.
 */
export function isEmergencyAnnouncement(announcement) {
  if (!announcement) return false;
  const category = (announcement.category || "").toLowerCase();
  if (category === "emergency") return true;

  const title = (announcement.title || "").toLowerCase();
  const body = (announcement.body || "").toLowerCase();
  const emergencyKeywords = [
    "carnap",
    "carnapping",
    "earthquake",
    "lindol",
    "sunog",
    "fire alert",
    "fire emergency",
    "tsunami",
    "flood warning",
    "flash flood",
    "baha",
    "bagyo",
    "typhoon",
    "landslide",
    "evacuation",
    "security alert",
    "emergency advisory",
    "calamity",
    "ndrrmc",
  ];

  return emergencyKeywords.some(
    (kw) => title.includes(kw) || body.includes(kw)
  );
}

/**
 * Storage helpers to track acknowledged emergencies per resident
 */
export function isEmergencyAcknowledged(announcementId, residentId = "guest") {
  if (!announcementId) return false;
  try {
    const key = `kaagapai_acknowledged_emergency_${residentId}_${announcementId}`;
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function markEmergencyAcknowledged(announcementId, residentId = "guest") {
  if (!announcementId) return;
  try {
    const key = `kaagapai_acknowledged_emergency_${residentId}_${announcementId}`;
    localStorage.setItem(key, "true");
  } catch (e) {
    console.warn("Could not save emergency acknowledgement:", e);
  }
}

/**
 * Initializes and resumes an AudioContext safely handling autoplay policies.
 */
function getOrCreateAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!activeAudioCtx || activeAudioCtx.state === "closed") {
    activeAudioCtx = new AudioContextClass();
  }

  if (activeAudioCtx.state === "suspended") {
    activeAudioCtx.resume().catch(() => {});
  }

  return activeAudioCtx;
}

/**
 * Triggers mobile device vibration in repeated emergency pulses
 */
function startDeviceVibration() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      // NDRRMC standard vibration pattern: 800ms buzz, 200ms rest, 800ms buzz, 200ms rest, 1200ms buzz
      const pattern = [800, 200, 800, 200, 1200, 400];
      navigator.vibrate(pattern);

      if (vibrationTimer) clearInterval(vibrationTimer);
      vibrationTimer = setInterval(() => {
        try {
          navigator.vibrate(pattern);
        } catch {}
      }, 3600);
    } catch (e) {
      console.warn("Vibration not permitted or unsupported:", e);
    }
  }
}

/**
 * Stops mobile device vibration
 */
function stopDeviceVibration() {
  if (vibrationTimer) {
    clearInterval(vibrationTimer);
    vibrationTimer = null;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(0);
    } catch {}
  }
}

/**
 * Synthesizes one single burst of the NDRRMC dual-frequency warble tone + siren
 * Dual tones: 853 Hz + 960 Hz (Emergency Broadcast System standard)
 */
function playSirenCycle(audioCtx) {
  if (!audioCtx || audioCtx.state === "closed") return;

  const now = audioCtx.currentTime;

  // Master Gain for volume control and smooth fading
  const masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);
  masterGain.gain.setValueAtTime(0.01, now);
  masterGain.gain.exponentialRampToValueAtTime(0.85, now + 0.05);

  // Oscillator 1: 853 Hz
  const osc1 = audioCtx.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.setValueAtTime(853, now);
  // Frequency wobble for authentic siren warble
  osc1.frequency.linearRampToValueAtTime(853, now + 0.4);
  osc1.frequency.linearRampToValueAtTime(960, now + 0.8);
  osc1.frequency.linearRampToValueAtTime(853, now + 1.2);
  osc1.frequency.linearRampToValueAtTime(960, now + 1.6);
  osc1.frequency.linearRampToValueAtTime(853, now + 2.0);

  // Oscillator 2: 960 Hz
  const osc2 = audioCtx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(960, now);
  osc2.frequency.linearRampToValueAtTime(960, now + 0.4);
  osc2.frequency.linearRampToValueAtTime(853, now + 0.8);
  osc2.frequency.linearRampToValueAtTime(960, now + 1.2);
  osc2.frequency.linearRampToValueAtTime(853, now + 1.6);
  osc2.frequency.linearRampToValueAtTime(960, now + 2.0);

  // High-pitch alert siren sweep (1200 Hz - 700 Hz)
  const osc3 = audioCtx.createOscillator();
  osc3.type = "triangle";
  osc3.frequency.setValueAtTime(900, now);
  osc3.frequency.linearRampToValueAtTime(1300, now + 0.5);
  osc3.frequency.linearRampToValueAtTime(750, now + 1.0);
  osc3.frequency.linearRampToValueAtTime(1300, now + 1.5);
  osc3.frequency.linearRampToValueAtTime(900, now + 2.0);

  // Individual gains
  const gain1 = audioCtx.createGain();
  gain1.gain.value = 0.5;
  osc1.connect(gain1);
  gain1.connect(masterGain);

  const gain2 = audioCtx.createGain();
  gain2.gain.value = 0.5;
  osc2.connect(gain2);
  gain2.connect(masterGain);

  const gain3 = audioCtx.createGain();
  gain3.gain.value = 0.35;
  osc3.connect(gain3);
  gain3.connect(masterGain);

  // Pulsing envelope (2.2 seconds total cycle)
  masterGain.gain.setValueAtTime(0.85, now + 2.0);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 2.3);

  osc1.start(now);
  osc2.start(now);
  osc3.start(now);

  osc1.stop(now + 2.35);
  osc2.stop(now + 2.35);
  osc3.stop(now + 2.35);

  activeOscillators.push(osc1, osc2, osc3);
  activeGainNodes.push(masterGain, gain1, gain2, gain3);

  setTimeout(() => {
    activeOscillators = activeOscillators.filter(
      (o) => o !== osc1 && o !== osc2 && o !== osc3
    );
    activeGainNodes = activeGainNodes.filter(
      (g) => g !== masterGain && g !== gain1 && g !== gain2 && g !== gain3
    );
  }, 2400);
}

/**
 * Starts the full Emergency Alarm with siren sound and device vibration.
 * Loops automatically until stopped or until duration expires (default 45s).
 */
export function playEmergencyAlarm({
  loop = true,
  maxDurationSeconds = 45,
  onStop = null,
} = {}) {
  // Silence any existing alarm first
  stopEmergencyAlarm();

  const audioCtx = getOrCreateAudioContext();
  isAlarmCurrentlyPlaying = true;

  // Start mobile device vibration immediately
  startDeviceVibration();

  // Play first audio pulse
  if (audioCtx) {
    try {
      playSirenCycle(audioCtx);
    } catch (err) {
      console.warn("Could not play audio siren pulse:", err);
    }
  }

  // If looping, schedule successive pulses every 2.5 seconds
  if (loop) {
    sirenLoopTimer = setInterval(() => {
      if (!isAlarmCurrentlyPlaying) {
        clearInterval(sirenLoopTimer);
        sirenLoopTimer = null;
        return;
      }
      const ctx = getOrCreateAudioContext();
      if (ctx) {
        try {
          playSirenCycle(ctx);
        } catch {}
      }
    }, 2500);
  }

  // Safety auto-cutoff after maxDurationSeconds so it never sounds indefinitely
  const autoStopTimeout = setTimeout(() => {
    stopEmergencyAlarm();
    if (typeof onStop === "function") {
      onStop();
    }
  }, maxDurationSeconds * 1000);

  return {
    stop: () => {
      clearTimeout(autoStopTimeout);
      stopEmergencyAlarm();
      if (typeof onStop === "function") {
        onStop();
      }
    },
    isPlaying: () => isAlarmCurrentlyPlaying,
  };
}

/**
 * Stops all siren sound immediately, stops vibration, and clears all timers.
 */
export function stopEmergencyAlarm() {
  isAlarmCurrentlyPlaying = false;

  if (sirenLoopTimer) {
    clearInterval(sirenLoopTimer);
    sirenLoopTimer = null;
  }

  stopDeviceVibration();

  // Stop and disconnect any active oscillators
  activeOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {}
  });
  activeOscillators = [];

  activeGainNodes.forEach((gain) => {
    try {
      gain.disconnect();
    } catch {}
  });
  activeGainNodes = [];

  if (activeAudioCtx && activeAudioCtx.state === "running") {
    try {
      activeAudioCtx.suspend().catch(() => {});
    } catch {}
  }
}

/**
 * Plays a quick 3.5-second siren sample for testing or previewing on laptop/mobile.
 */
export function testEmergencyAlarmSound() {
  return playEmergencyAlarm({ loop: false, maxDurationSeconds: 3.5 });
}

/**
 * Checks if the alarm is currently ringing.
 */
export function isAlarmPlaying() {
  return isAlarmCurrentlyPlaying;
}
