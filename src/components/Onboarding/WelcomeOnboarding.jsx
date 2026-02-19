import { useEffect } from 'react';

/**
 * Validation-first onboarding (ADHD/disability). Shown before morning check-in on first launch.
 */
export default function WelcomeOnboarding({ open, onClose, onComplete }) {
  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  if (!open) return null;

  const handleDone = () => {
    onComplete?.();
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-onboarding-title"
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-stone-200 bg-stone-50 shadow-xl p-6 text-stone-900">
        <h2 id="welcome-onboarding-title" className="font-serif text-xl mb-2">
          Welcome
        </h2>
        <p className="font-sans text-stone-600 text-sm mb-6">
          Start gently. Set your energy when you are ready, and pick one tiny step at a time.
        </p>
        <button
          type="button"
          onClick={handleDone}
          className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
