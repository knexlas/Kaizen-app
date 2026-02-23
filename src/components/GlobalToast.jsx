import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function uniqueId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function GlobalToast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const message = e.detail?.message;
      if (message == null || String(message).trim() === '') return;
      const id = uniqueId();
      setToasts((prev) => [...prev, { id, message: String(message) }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    };
    window.addEventListener('kaizen:toast', handler);
    return () => window.removeEventListener('kaizen:toast', handler);
  }, []);

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col-reverse gap-2 items-center max-w-sm w-full mx-4 pointer-events-none"
      role="region"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="px-4 py-3 rounded-xl border border-stone-200/80 bg-stone-50 shadow-lg font-sans text-sm text-stone-800"
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
