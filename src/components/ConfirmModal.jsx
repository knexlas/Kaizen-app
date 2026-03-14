import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    if (typeof onConfirm === 'function') onConfirm();
    onClose?.();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        onClick={(e) => e.target === e.currentTarget && onClose?.()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-sm rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 shadow-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 sm:p-5">
            {title ? (
              <h2 id="confirm-title" className="font-serif text-lg text-stone-900 dark:text-stone-100 mb-2">
                {title}
              </h2>
            ) : null}
            <p id="confirm-desc" className="font-sans text-sm text-stone-600 dark:text-stone-400">
              {message}
            </p>
          </div>
          <div className="flex flex-row-reverse gap-2 px-4 pb-4 sm:px-5 sm:pb-5 border-t border-stone-100 dark:border-stone-700 pt-3">
            <button
              type="button"
              onClick={handleConfirm}
              className={`px-4 py-2 rounded-lg font-sans text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                destructive
                  ? 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500/50'
                  : 'bg-moss-600 text-white hover:bg-moss-700 focus:ring-moss-500/50'
              }`}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-sans text-sm font-medium border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/70 focus:outline-none focus:ring-2 focus:ring-stone-400/30"
            >
              {cancelLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
