import { useMemo, useState } from 'react';

export default function FocusScaffoldCard({
  open = false,
  taskTitle = '',
  tinyStep = '',
  prepStep = '',
  encouragement = '',
  preferredMinutes = 3,
  onApplyTinyStep,
  onApplyPrepStep,
  onStart,
  onDismiss,
}) {
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [minutes, setMinutes] = useState(preferredMinutes === 5 ? 5 : 3);
  const [buddyTone, setBuddyTone] = useState(true);

  const encouragementLine = useMemo(() => {
    if (!buddyTone) return 'Keep this small. Start, then decide again.';
    return encouragement || 'I can stay with you while you begin. Just one small move.';
  }, [buddyTone, encouragement]);

  if (!open) return null;

  const runCountdownAndStart = () => {
    setCountdownActive(true);
    setCountdown(3);
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setCountdownActive(false);
          onStart?.(minutes);
          return 0;
        }
        return prev - 1;
      });
    }, 700);
  };

  return (
    <div className="rounded-2xl border border-moss-200 bg-white px-4 py-4 dark:border-moss-700/40 dark:bg-slate-800/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-moss-700 dark:text-moss-300">Guided start</p>
          <h3 className="mt-1 font-serif text-lg text-stone-900 dark:text-stone-100">{taskTitle || 'Start this task gently'}</h3>
          <p className="mt-1 font-sans text-sm text-stone-600 dark:text-stone-300">{encouragementLine}</p>
        </div>
        <button type="button" onClick={onDismiss} className="rounded-lg px-2 py-1 font-sans text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200">
          Hide
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => onApplyTinyStep?.()} className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-left dark:border-slate-600 dark:bg-slate-800/70">
          <p className="font-sans text-xs uppercase tracking-wide text-stone-500">Tiny first step</p>
          <p className="mt-1 font-sans text-sm text-stone-800 dark:text-stone-200">{tinyStep}</p>
        </button>
        <button type="button" onClick={() => onApplyPrepStep?.()} className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-left dark:border-slate-600 dark:bg-slate-800/70">
          <p className="font-sans text-xs uppercase tracking-wide text-stone-500">Prep first</p>
          <p className="mt-1 font-sans text-sm text-stone-800 dark:text-stone-200">{prepStep}</p>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMinutes(3)} className={`rounded-lg border px-2.5 py-1 text-xs font-sans ${minutes === 3 ? 'border-moss-500 text-moss-700' : 'border-stone-200 text-stone-600 dark:border-slate-600 dark:text-stone-300'}`}>3 min</button>
        <button type="button" onClick={() => setMinutes(5)} className={`rounded-lg border px-2.5 py-1 text-xs font-sans ${minutes === 5 ? 'border-moss-500 text-moss-700' : 'border-stone-200 text-stone-600 dark:border-slate-600 dark:text-stone-300'}`}>5 min</button>
        <button type="button" onClick={() => setBuddyTone((v) => !v)} className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-sans text-stone-600 dark:border-slate-600 dark:text-stone-300">
          {buddyTone ? 'Body-double tone on' : 'Body-double tone off'}
        </button>
        <button
          type="button"
          onClick={runCountdownAndStart}
          className="rounded-lg bg-moss-600 px-3 py-1.5 font-sans text-xs font-medium text-white hover:bg-moss-700"
        >
          {countdownActive ? `Starting in ${countdown}...` : `Start ${minutes} min with countdown`}
        </button>
      </div>
    </div>
  );
}

