// Small seed/sprout SVG
function SproutIcon({ stormy }) {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-moss-500 transition-transform duration-300 ${stormy ? 'origin-bottom -rotate-6' : ''}`}
      aria-hidden
    >
      {/* Leaf */}
      <path d="M12 22v-8M12 14c-2-2-5-2-7 0" />
      <path d="M12 14c2-2 5-2 7 0" />
      {/* Stem */}
      <path d="M12 14v-6" />
      {/* Seed body */}
      <ellipse cx="12" cy="6" rx="3" ry="2" />
    </svg>
  );
}

function GoalCardPlaceholder({ stormy = false, dimmed = false, highCost = false }) {
  const disabled = dimmed && highCost;
  return (
    <div
      className={`rounded-lg border-2 border-dashed border-moss-500 bg-stone-50 p-6 min-h-[140px] flex flex-col items-center justify-center gap-2 transition-opacity ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
      aria-disabled={disabled || undefined}
    >
      <SproutIcon stormy={stormy} />
      <span className="font-sans text-stone-900/60 text-sm">Select a Big Goal</span>
    </div>
  );
}

export default GoalCardPlaceholder;
