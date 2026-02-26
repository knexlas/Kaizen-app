import { motion, AnimatePresence } from 'framer-motion';

export default function PrioritizeModal({
  open,
  onClose,
  priorities = {},
  onSelectTask,
  todayTasks = [],
  recommendedTaskId = null,
  recommendedReason = null,
  onApplyPriority,
  prioritizeLoading = false,
  prioritizeSuccess = false,
}) {
  const { northStar, quickWin, care } = priorities;
  const recommendedTask = recommendedTaskId
    ? todayTasks.find((t) => t.id === recommendedTaskId)
    : null;
  const showAiRecommendation = todayTasks.length > 0 && typeof onApplyPriority === 'function';
  const showAiBlock = showAiRecommendation && (recommendedTask || prioritizeLoading || prioritizeSuccess);

  const cardClass =
    'rounded-2xl border border-stone-200/80 bg-white/80 shadow-sm p-4 text-left transition-colors hover:border-stone-300/80';
  const descriptionClass = 'font-sans text-sm text-stone-500 mt-1';
  const titleClass = 'font-serif text-stone-800 font-medium';
  const taskTitleClass = 'font-sans text-stone-700 mt-2';

  return (
    <AnimatePresence>
      {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(245, 243, 235, 0.98) 0%, rgba(231, 229, 219, 0.95) 100%)',
        }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prioritize-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl border border-stone-200/60 shadow-xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(253, 252, 245, 0.99) 0%, rgba(250, 249, 243, 0.99) 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div className="px-6 pt-6 pb-2">
            <h2 id="prioritize-modal-title" className="font-serif text-xl text-stone-800">
              Let&apos;s find your focus today.
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* AI recommendation: loading, then success with reason (priority already applied) */}
            {showAiBlock && (
              <div className={`${cardClass} ring-2 ring-amber-300/60 bg-amber-50/80`}>
                <p className="text-base" aria-hidden>
                  🎯 {prioritizeSuccess ? 'Your focus today' : 'Mochi, pick one for me'}
                </p>
                {prioritizeLoading && !recommendedTask ? (
                  <>
                    <p className={descriptionClass}>
                      Mochi is analyzing your energy and deadlines…
                    </p>
                    <p className="font-sans text-sm text-stone-500 mt-2 italic">One moment…</p>
                  </>
                ) : prioritizeSuccess && recommendedTask && recommendedReason ? (
                  <>
                    <p className={descriptionClass}>
                      The chosen task is now at the top with the Golden Pin. 🌟
                    </p>
                    <p className={taskTitleClass}>{recommendedTask.title}</p>
                    <p className="font-sans text-sm text-moss-700 mt-2 italic">&ldquo;{recommendedReason}&rdquo;</p>
                    <button
                      type="button"
                      onClick={() => onClose?.()}
                      className="mt-4 w-full py-2.5 rounded-xl font-sans text-sm font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 transition-colors"
                    >
                      Done
                    </button>
                  </>
                ) : recommendedTask && !prioritizeSuccess ? (
                  <>
                    <p className={descriptionClass}>
                      Mochi suggests focusing on this. We only mark it as priority — we won&apos;t move or change your fixed appointments.
                    </p>
                    <p className={taskTitleClass}>{recommendedTask.title}</p>
                    <button
                      type="button"
                      onClick={() => {
                        onApplyPriority(recommendedTaskId);
                        onClose?.();
                      }}
                      className="mt-4 w-full py-2.5 rounded-xl font-sans text-sm font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 transition-colors"
                    >
                      Focus on this
                    </button>
                  </>
                ) : null}
              </div>
            )}

            {/* The Main Quest */}
            <div className={cardClass}>
              <p className="text-base" aria-hidden>
                🌟 The Main Quest
              </p>
              <p className={descriptionClass}>
                If you only do one thing today, make it this.
              </p>
              {northStar ? (
                <>
                  <p className={taskTitleClass}>{northStar.title}</p>
                  <button
                    type="button"
                    onClick={() => onSelectTask?.(northStar)}
                    className="mt-4 w-full py-2.5 rounded-xl font-sans text-sm font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 transition-colors"
                  >
                    Add to Today
                  </button>
                </>
              ) : (
                <p className="font-sans text-sm text-stone-400 mt-2 italic">
                  No main quest today — rest or choose something small.
                </p>
              )}
            </div>

            {/* A Quick Win */}
            <div className={cardClass}>
              <p className="text-base" aria-hidden>
                🍃 A Quick Win
              </p>
              <p className={descriptionClass}>
                Low energy? Start here to build momentum.
              </p>
              {quickWin ? (
                <>
                  <p className={taskTitleClass}>{quickWin.title}</p>
                  <button
                    type="button"
                    onClick={() => onSelectTask?.(quickWin)}
                    className="mt-4 w-full py-2.5 rounded-xl font-sans text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:ring-offset-2 transition-colors"
                  >
                    Add to Today
                  </button>
                </>
              ) : (
                <p className="font-sans text-sm text-stone-400 mt-2 italic">
                  No quick win suggested — that&apos;s okay.
                </p>
              )}
            </div>

            {/* Nourishment */}
            <div className={cardClass}>
              <p className="text-base" aria-hidden>
                🍵 Nourishment
              </p>
              <p className={descriptionClass}>
                Take care of the gardener first.
              </p>
              {care ? (
                <>
                  <p className={taskTitleClass}>{care.title}</p>
                  <button
                    type="button"
                    onClick={() => onSelectTask?.(care)}
                    className="mt-4 w-full py-2.5 rounded-xl font-sans text-sm font-medium text-stone-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:ring-offset-2 transition-colors"
                  >
                    Add to Today
                  </button>
                </>
              ) : (
                <p className="font-sans text-sm text-stone-400 mt-2 italic">
                  No nourishment task today — drink some water anyway.
                </p>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-stone-200/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl font-sans text-sm font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400/40 focus:ring-offset-2 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
