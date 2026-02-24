import { useTheme } from '../../context/ThemeContext';

const TABS = [
  { id: 'now', label: 'Now', icon: '⚡', aria: "Today's execution" },
  { id: 'plan', label: 'Plan', icon: '🗺️', aria: 'Future thinking' },
  { id: 'garden', label: 'Garden', icon: '🌱', aria: 'Reflection and rewards' },
];

export default function GlobalBottomNav({ activeId, onSelect, hideGarden = false }) {
  const { darkMode: themeDarkMode } = useTheme();
  const isDark = themeDarkMode;

  const items = hideGarden ? TABS.filter((t) => t.id !== 'garden') : TABS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 safe-area-pb flex justify-center px-2 py-2"
      role="tablist"
      aria-label="Main navigation"
    >
      <div
        className="flex items-center justify-around gap-1 w-full max-w-md rounded-2xl py-2 px-3 min-h-[56px]"
        style={{
          background: isDark
            ? 'rgba(30, 41, 59, 0.85)'
            : 'rgba(255, 251, 235, 0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: isDark
            ? '0 -2px 20px -4px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 -2px 24px -6px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        }}
      >
        {items.map((tab) => {
          const isActive = activeId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={tab.aria}
              onClick={() => onSelect(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] py-2 px-3 rounded-xl font-sans text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 focus:ring-offset-transparent ${
                isActive
                  ? isDark
                    ? 'text-indigo-200 bg-slate-600/80'
                    : 'text-moss-800 bg-moss-100/90'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-600/40'
                    : 'text-stone-600 hover:text-stone-800 hover:bg-stone-200/60'
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
