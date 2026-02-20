import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';

function CompostEmptyNote() {
  const [showHow, setShowHow] = useState(false);
  return (
    <div className="py-8 text-center">
      <p className="font-sans text-sm text-stone-500 italic mb-2">
        Your mind is clear. If a distraction appears, throw it here.
      </p>
      <p className="font-sans text-sm text-stone-600 mb-2">
        Compost is where &ldquo;not today&rdquo; goes—no shame.
      </p>
      <button
        type="button"
        onClick={() => setShowHow((v) => !v)}
        className="font-sans text-xs font-medium text-moss-700 hover:text-moss-800 underline underline-offset-1 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded"
      >
        How compost works
      </button>
      {showHow && (
        <p className="mt-3 p-3 rounded-lg bg-amber-50/80 border border-amber-200/80 font-sans text-xs text-stone-600 text-left max-w-sm mx-auto">
          Dump ideas or tasks here when you don&apos;t want to do them today. You can plant them later or break them into steps.
        </p>
      )}
    </div>
  );
}
import { useReward } from '../../context/RewardContext';
import { buildReward } from '../../services/dopamineEngine';
import { breakDownTask, processIncomingCompost } from '../../services/geminiService';

const MOBILE_BREAKPOINT = 640;

export default function CompostHeap({ open, onClose, onPlant, onPrism }) {
  const { compost = [], addToCompost, removeFromCompost } = useGarden();
  const { pushReward } = useReward();
  const [quickCapture, setQuickCapture] = useState('');
  const [prismLoadingId, setPrismLoadingId] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleAdd = (e) => {
    e.preventDefault();
    const text = quickCapture.trim();
    if (!text || !addToCompost) return;
    addToCompost(text).then(() => {
      const reward = buildReward({ type: 'COMPOST_ADDED', payload: { textLength: text.length } });
      if (reward) pushReward(reward);
    });
    setQuickCapture('');
  };

  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        resolve(typeof result === 'string' ? result : null);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e) => {
    const file = e.target?.files?.[0];
    if (!file || !addToCompost) return;
    const isImage = file.type.startsWith('image/');
    if (!isImage) return;
    setScanning(true);
    e.target.value = '';
    try {
      const base64 = await readFileAsBase64(file);
      if (!base64) return;
      const tasks = await processIncomingCompost(base64);
      if (Array.isArray(tasks) && tasks.length > 0) {
        tasks.forEach((task) => {
          const text = typeof task === 'string' ? task : (task?.text ?? '');
          addToCompost(text).then(() => {
            const reward = buildReward({ type: 'COMPOST_ADDED', payload: { textLength: text.length } });
            if (reward) pushReward(reward);
          });
        });
      }
    } finally {
      setScanning(false);
    }
  };

  const handlePlant = (item) => {
    onPlant?.(item.text);
    onClose?.();
  };

  const handlePrism = async (item) => {
    if (!onPrism || prismLoadingId) return;
    setPrismLoadingId(item.id);
    try {
      const subtasks = await breakDownTask(item.text);
      if (Array.isArray(subtasks) && subtasks.length > 0) {
        removeFromCompost?.(item.id);
        onPrism(item.text, subtasks);
        onClose?.();
      }
    } finally {
      setPrismLoadingId(null);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex justify-end bg-stone-900/30 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Compost Heap (Inbox)"
      >
        <motion.aside
          initial={isMobile ? { y: '100%' } : { x: '100%' }}
          animate={isMobile ? { y: 0 } : { x: 0 }}
          exit={isMobile ? { y: '100%' } : { x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={
            isMobile
              ? 'fixed bottom-0 left-0 right-0 w-full max-h-[90vh] rounded-t-2xl bg-stone-50 border-t border-stone-200 shadow-xl flex flex-col safe-area-pb'
              : 'w-full max-w-md h-full bg-stone-50 border-l border-stone-200 shadow-xl flex flex-col safe-area-pt safe-area-pb max-h-[100dvh]'
          }
        >
          {isMobile && (
            <div className="flex justify-center pt-2 pb-1 shrink-0" aria-hidden>
              <div className="w-10 h-1 rounded-full bg-stone-300" />
            </div>
          )}
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-amber-50/50 shrink-0">
            <h2 className="font-serif text-stone-900 text-lg">Compost Heap</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              aria-label="Close"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>

          {/* Quick Capture */}
          <form onSubmit={handleAdd} className="p-4 border-b border-stone-200 bg-stone-100/50">
            <label htmlFor="compost-quick-capture" className="sr-only">
              Quick capture
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Upload or capture image"
              onChange={handleFileSelect}
            />
            <div className="flex gap-2">
              <input
                ref={inputRef}
                id="compost-quick-capture"
                type="text"
                value={quickCapture}
                onChange={(e) => setQuickCapture(e.target.value)}
                placeholder="Dump an idea here…"
                className="flex-1 py-2.5 px-4 rounded-xl border border-stone-300 bg-white font-sans text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                aria-label="Quick capture"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="py-2.5 px-3 rounded-xl border border-stone-300 bg-white font-sans text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-60 disabled:pointer-events-none shrink-0"
                aria-label="Camera or upload image to scan for tasks"
                title="Scan image for tasks"
              >
                {scanning ? (
                  <span className="font-sans text-xs font-medium">Scanning…</span>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </button>
              <button
                type="submit"
                disabled={!quickCapture.trim()}
                className="py-2.5 px-4 rounded-xl bg-amber-600 text-stone-50 font-sans text-sm font-medium hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 disabled:pointer-events-none"
              >
                Add
              </button>
            </div>
            <p className="font-sans text-xs text-stone-500 mt-2">
              Later: plant as a goal or decompose. Or scan an image to extract tasks.
            </p>
          </form>

          {/* List: organic pile (paper scraps / leaves) */}
          <div className="flex-1 overflow-y-auto p-4">
            {compost.length === 0 ? (
              <CompostEmptyNote />
            ) : (
              <ul className="space-y-3">
                {compost.map((item, index) => (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="group relative"
                  >
                    <div
                      className="px-4 py-3 rounded-lg border border-amber-200/80 bg-amber-50/70 shadow-sm transition-shadow group-hover:shadow"
                      style={{
                        transform: `rotate(${(index % 3 - 1) * 0.5}deg)`,
                      }}
                    >
                      <p className="font-sans text-sm text-stone-800 pr-20 break-words">{item.text}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {onPrism && (
                          <button
                            type="button"
                            onClick={() => handlePrism(item)}
                            disabled={!!prismLoadingId}
                            className="px-2.5 py-1 rounded-md font-sans text-xs font-medium bg-violet-100 text-violet-800 hover:bg-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60 disabled:pointer-events-none flex items-center gap-1"
                            aria-label="Break down into steps (Prism)"
                            title="Break into small steps"
                          >
                            {prismLoadingId === item.id ? (
                              <span className="inline-block w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" aria-hidden />
                            ) : (
                              <span aria-hidden>💎</span>
                            )}
                            Prism
                          </button>
                        )}
                        {onPlant && (
                          <button
                            type="button"
                            onClick={() => handlePlant(item)}
                            className="px-2.5 py-1 rounded-md font-sans text-xs font-medium bg-moss-100 text-moss-800 hover:bg-moss-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                          >
                            Plant
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFromCompost?.(item.id)}
                          className="px-2.5 py-1 rounded-md font-sans text-xs font-medium text-stone-500 hover:bg-stone-200 hover:text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400/40"
                          aria-label={`Remove ${item.text}`}
                        >
                          Decompose
                        </button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}
