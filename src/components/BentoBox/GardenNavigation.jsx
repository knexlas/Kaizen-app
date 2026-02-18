// Natural brush-stroke underline (SVG)
function BrushUnderline({ active }) {
  if (!active) return null;
  return (
    <svg
      className="absolute bottom-0 left-0 w-full h-2 text-moss-500 pointer-events-none"
      viewBox="0 0 120 8"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M2 6 Q 30 2, 60 5 T 118 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const PLOTS = [
  { id: 'all', label: 'All' },
  { id: 'finance', label: 'Finance' },
  { id: 'health', label: 'Health' },
  { id: 'creation', label: 'Creation' },
];

function GardenNavigation({ activePlot, onSelect }) {
  return (
    <nav aria-label="Garden plots" className="flex flex-wrap gap-6 border-b border-stone-200 pb-2">
      {PLOTS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className="relative pb-1 font-serif text-stone-900 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded px-1"
        >
          {label}
          <BrushUnderline active={activePlot === id} />
        </button>
      ))}
    </nav>
  );
}

export default GardenNavigation;
