export default function InfoTooltip({ text }) {
  if (!text) return null;
  return (
    <span className="group relative inline-flex items-center align-middle ml-0.5">
      <button
        type="button"
        className="text-xs text-stone-400 cursor-help select-none focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-1 rounded-full"
        aria-label={text}
      >
        (?)
      </button>
      <div className="absolute left-0 bottom-full mb-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity bg-stone-800 text-white p-2 rounded-lg text-xs w-48 z-50 pointer-events-none">
        {text}
      </div>
    </span>
  );
}
