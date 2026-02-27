import { useEffect } from 'react';
import { useGarden } from '../../context/GardenContext';

/**
 * First-step welcome. Starts the interactive tour (tourStep = 1) when user clicks Start Tour.
 */
export default function WelcomeOnboarding({ open, onClose, onComplete }) {
  const { setTourStep } = useGarden();

  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  if (!open) return null;

  const handleStartTour = () => {
    setTourStep?.(1);
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
        <h2 id="welcome-onboarding-title" className="font-serif text-xl mb-4">
          Welcome to Kaizen. Let me show you around!
        </h2>
        <button
          type="button"
          onClick={handleStartTour}
          className="w-full py-3 rounded-xl font-sans font-medium text-stone-50 bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500 focus:ring-offset-2"
        >
          Start Tour
        </button>
      </div>
    </div>
  );
}
