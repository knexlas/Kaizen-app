import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DURATION_SECONDS = 25 * 60; // 25 minutes
const BREATH_CYCLE_SECONDS = 4;
const CONTROLS_IDLE_MS = 2500;
const AMBIENCE_STORAGE_KEY = 'kaizenFocusAmbience';
const FADE_MS = 500;

const SOUNDS = {
  rain: 'https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-1253.mp3',
  brownNoise: 'https://assets.mixkit.co/sfx/preview/mixkit-white-noise-1254.mp3',
  gong: 'https://assets.mixkit.co/sfx/preview/mixkit-gong-sound-2746.mp3',
};

const AMBIENCE_OPTIONS = [
  { id: 'silence', label: 'Silence', icon: '🔇' },
  { id: 'rain', label: 'Rain', icon: '🌧️' },
  { id: 'brownNoise', label: 'Flow (Brown Noise)', icon: '🌊' },
];

function getStoredAmbience() {
  try {
    const s = localStorage.getItem(AMBIENCE_STORAGE_KEY);
    if (s === 'rain' || s === 'brownNoise') return s;
  } catch (_) {}
  return 'silence';
}

function fadeAudio(audio, toVolume, durationMs, onDone) {
  if (!audio) return;
  const start = performance.now();
  const startVol = audio.volume;
  let raf = null;
  const tick = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(1, elapsed / durationMs);
    audio.volume = startVol + (toVolume - startVol) * t;
    if (t < 1) raf = requestAnimationFrame(tick);
    else onDone?.();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

function safePlay(audio, volumeLevel, label = 'Audio') {
  if (!audio) return;
  try {
    audio.volume = volumeLevel;
    audio.play().catch((err) => {
      console.warn(`${label} play() blocked or failed:`, err?.name, err?.message);
    });
  } catch (err) {
    console.warn(`${label} play error:`, err?.name, err?.message);
  }
}

// --- Mochi Spirit (from GardenIntro, with breathing/celebration modes) ---
function MochiSpirit({ isComplete }) {
  return (
    <motion.svg
      width="80"
      height="90"
      viewBox="0 0 60 70"
      fill="none"
      className="overflow-visible"
      initial={false}
      animate={
        isComplete
          ? {
              scale: [1, 1.15, 1.08],
              transition: { duration: 0.5, ease: 'easeOut' },
            }
          : {
              scale: [1, 1.1, 1],
              transition: {
                duration: BREATH_CYCLE_SECONDS,
                repeat: Infinity,
                ease: 'easeInOut',
              },
            }
      }
    >
      {/* Glow */}
      <circle cx="30" cy="40" r="25" fill="white" filter="blur(15px)" opacity="0.5" />

      <g>
        <path
          d="M15 45 C15 30, 20 10, 30 10 C40 10, 45 30, 45 45 C45 55, 40 60, 30 60 C20 60, 15 55, 15 45 Z"
          fill="white"
          stroke="#F0EFE9"
          strokeWidth="2"
        />
        <motion.g
          animate={{ y: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        >
          <circle cx="24" cy="38" r="2.5" fill="#2D2D2D" opacity="0.9" />
          <circle cx="36" cy="38" r="2.5" fill="#2D2D2D" opacity="0.9" />
          <circle cx="22" cy="42" r="3" fill="#FFB7B2" opacity="0.4" />
          <circle cx="38" cy="42" r="3" fill="#FFB7B2" opacity="0.4" />
          <path
            d="M28 42 Q30 44 32 42"
            stroke="#2D2D2D"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.6"
          />
        </motion.g>
        <path d="M30 10 Q35 0 40 5 Q35 10 30 10" fill="#8FA967" />
      </g>
    </motion.svg>
  );
}

export default function FocusSession({
  activeTask,
  onComplete,
  onExit,
  durationSeconds = DURATION_SECONDS,
}) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [completedTimeSpentMinutes, setCompletedTimeSpentMinutes] = useState(null);
  const [showControls, setShowControls] = useState(false);
  const [showBrokenPath, setShowBrokenPath] = useState(false);
  const [ambience, setAmbience] = useState(getStoredAmbience);
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const controlsTimeoutRef = useRef(null);
  const ambienceAudioRef = useRef(null);
  const gongAudioRef = useRef(null);
  const fadeCancelRef = useRef(null);
  const hasAudioInteractionRef = useRef(false);
  const soundMenuRef = useRef(null);

  const elapsedSeconds = durationSeconds - secondsLeft;

  const persistAmbience = useCallback((value) => {
    setAmbience(value);
    try {
      localStorage.setItem(AMBIENCE_STORAGE_KEY, value);
    } catch (_) {}
  }, []);

  const playAmbienceLoop = useCallback(
    (volumeLevel = volume) => {
      const el = ambienceAudioRef.current;
      if (!el || ambience === 'silence') return;
      const src = ambience === 'rain' ? SOUNDS.rain : SOUNDS.brownNoise;
      if (el.src !== src) {
        el.src = src;
        el.loop = true;
      }
      el.volume = volumeLevel;
      safePlay(el, volumeLevel, 'Ambience');
    },
    [ambience, volume]
  );

  const stopAmbienceFaded = useCallback(() => {
    const el = ambienceAudioRef.current;
    if (!el) return;
    if (fadeCancelRef.current) fadeCancelRef.current();
    fadeCancelRef.current = fadeAudio(el, 0, FADE_MS, () => {
      el.pause();
      fadeCancelRef.current = null;
    });
  }, []);

  useEffect(() => {
    if (isPaused) {
      stopAmbienceFaded();
    } else if (!isComplete && ambience !== 'silence' && hasAudioInteractionRef.current) {
      playAmbienceLoop();
    }
  }, [isPaused, isComplete, ambience, playAmbienceLoop, stopAmbienceFaded]);

  const handleSelectAmbience = useCallback(
    (value) => {
      hasAudioInteractionRef.current = true;
      persistAmbience(value);
      setSoundMenuOpen(false);
      if (value === 'silence') {
        stopAmbienceFaded();
        return;
      }
      const el = ambienceAudioRef.current;
      if (el) {
        el.src = value === 'rain' ? SOUNDS.rain : SOUNDS.brownNoise;
        el.loop = true;
        el.volume = volume;
        safePlay(el, volume, 'Ambience');
      }
    },
    [persistAmbience, stopAmbienceFaded, volume]
  );

  const handleSoundMenuOpen = useCallback(() => {
    hasAudioInteractionRef.current = true;
    setSoundMenuOpen((o) => !o);
  }, []);

  useEffect(() => {
    if (isComplete) {
      if (ambienceAudioRef.current) {
        ambienceAudioRef.current.pause();
        ambienceAudioRef.current.currentTime = 0;
      }
      const gong = gongAudioRef.current;
      if (gong) {
        gong.src = SOUNDS.gong;
        safePlay(gong, volume, 'Gong');
      }
    }
  }, [isComplete, volume]);

  useEffect(() => {
    const ambienceEl = new Audio();
    const gongEl = new Audio();
    ambienceEl.volume = volume;
    gongEl.volume = volume;
    ambienceAudioRef.current = ambienceEl;
    gongAudioRef.current = gongEl;
    return () => {
      if (fadeCancelRef.current) fadeCancelRef.current();
      ambienceEl.pause();
      gongEl.pause();
      ambienceAudioRef.current = null;
      gongAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (ambienceAudioRef.current) ambienceAudioRef.current.volume = volume;
    if (gongAudioRef.current) gongAudioRef.current.volume = volume;
  }, [volume]);

  const openExitIntent = () => {
    setIsPaused(true);
    setShowBrokenPath(true);
  };

  const handleHarvestEarly = () => {
    setShowBrokenPath(false);
    const timeSpentMinutes = Math.max(1, Math.floor(elapsedSeconds / 60));
    onComplete?.({ timeSpentMinutes });
  };

  const handleDistraction = () => {
    console.log('Distraction event', { taskId: activeTask?.id, taskTitle: activeTask?.title });
    setShowBrokenPath(false);
    onExit?.();
  };

  const handleResumePath = () => {
    setShowBrokenPath(false);
    setIsPaused(false);
  };

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      controlsTimeoutRef.current = null;
    }, CONTROLS_IDLE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!soundMenuOpen) return;
    const handleClickOutside = (e) => {
      if (soundMenuRef.current && !soundMenuRef.current.contains(e.target)) setSoundMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [soundMenuOpen]);

  // Timer tick
  useEffect(() => {
    if (isComplete || isPaused) return;
    if (secondsLeft <= 0) {
      const mins = Math.max(1, Math.floor(durationSeconds / 60));
      setCompletedTimeSpentMinutes(mins);
      setIsComplete(true);
      return;
    }
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [isComplete, isPaused, secondsLeft, durationSeconds]);

  const progressPercent =
    secondsLeft <= 0 ? 100 : ((durationSeconds - secondsLeft) / durationSeconds) * 100;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!activeTask) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-100 flex flex-col items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Focus session"
      onMouseMove={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
    >
      {/* Audio elements created in useEffect for user-intent playback */}

      {/* Top-left: Sound / Ambience (faded until hover) */}
      <div ref={soundMenuRef} className="absolute top-6 left-6 z-20 flex items-center">
        <div className="relative group">
          <button
            type="button"
            onClick={handleSoundMenuOpen}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-200/80 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-opacity group-hover:opacity-100 opacity-60"
            aria-label="Sound / ambience"
            aria-expanded={soundMenuOpen}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          </button>
          <AnimatePresence>
            {soundMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-1 py-1 min-w-[180px] rounded-lg border border-stone-200 bg-stone-50/95 backdrop-blur shadow-lg z-30"
              >
                {AMBIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectAmbience(opt.id)}
                    className={`w-full px-3 py-2 text-left font-sans text-sm flex items-center gap-2 transition-colors first:rounded-t-lg last:rounded-b-lg focus:outline-none focus:bg-stone-100 ${
                      ambience === opt.id ? 'text-moss-700 bg-moss-50' : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span aria-hidden>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Top-right: Pause / X (opens Broken Path overlay) */}
      <AnimatePresence>
        {showControls && !isComplete && !showBrokenPath && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-6 right-6 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={openExitIntent}
              className="p-2 font-sans text-stone-600 bg-white/80 border border-stone-200 rounded-lg hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
              aria-label="Pause or exit"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              onClick={openExitIntent}
              className="px-4 py-2 font-sans text-sm text-stone-600 bg-white/80 border border-stone-200 rounded-lg hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
            >
              Pause
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Broken Path overlay (dark / glassmorphism) */}
      <AnimatePresence>
        {showBrokenPath && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="broken-path-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="bg-stone-100/95 backdrop-blur rounded-2xl border border-stone-200 shadow-xl max-w-sm w-full p-6"
            >
              <h2 id="broken-path-title" className="font-serif text-stone-800 text-xl text-center mb-6">
                The path is broken. Why?
              </h2>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleHarvestEarly}
                  className="w-full py-3 font-sans text-sm text-stone-800 bg-moss-100 border border-moss-500/40 rounded-xl hover:bg-moss-200/80 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
                >
                  Harvest Early
                </button>
                <button
                  type="button"
                  onClick={handleDistraction}
                  className="w-full py-3 font-sans text-sm text-stone-700 bg-stone-200/80 border border-stone-300 rounded-xl hover:bg-stone-300/80 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
                >
                  Distraction / Weed
                </button>
                <button
                  type="button"
                  onClick={handleResumePath}
                  className="w-full py-3 font-sans text-sm text-stone-600 border border-stone-300 rounded-xl hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
                >
                  Resume Path
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center: Spirit + task title */}
      <div className="flex flex-col items-center justify-center flex-1 px-6">
        <MochiSpirit isComplete={isComplete} />
        <h1 className="mt-8 font-serif text-3xl md:text-4xl text-stone-900 text-center max-w-md">
          {activeTask.title}
        </h1>
        <AnimatePresence mode="wait">
          {!isComplete ? (
            <motion.p
              key="flow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-2 font-sans text-sm text-stone-500"
            >
              Flow state active.
            </motion.p>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 flex flex-wrap justify-center gap-3"
            >
              <button
                type="button"
                onClick={() => onComplete?.({ timeSpentMinutes: completedTimeSpentMinutes, action: 'break' })}
                className="px-4 py-2.5 font-sans text-sm bg-moss-500 text-stone-50 rounded-lg hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
              >
                Take 5m Break
              </button>
              <button
                type="button"
                onClick={() => onComplete?.({ timeSpentMinutes: completedTimeSpentMinutes, action: 'plant' })}
                className="px-4 py-2.5 font-sans text-sm bg-stone-200 text-stone-800 rounded-lg hover:bg-stone-300 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
              >
                Plant Another Seed
              </button>
              <button
                type="button"
                onClick={() => onComplete?.({ timeSpentMinutes: completedTimeSpentMinutes })}
                className="px-4 py-2.5 font-sans text-sm border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
              >
                Log &amp; Exit
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom: 2px progress bar (no countdown shown) */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-stone-200">
        <motion.div
          className="h-full bg-moss-500 rounded-r"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
