/** Small shared building blocks for the lean Plan mode. */

export function Card({ className = '', children }) {
  return (
    <section className={`rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900/70 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">{children}</h2>
      {action}
    </div>
  );
}

const BUTTON_TONES = {
  primary: 'bg-moss-500 text-white hover:bg-moss-600 disabled:opacity-40',
  ghost: 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800',
  outline: 'border border-stone-300 text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800',
  danger: 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40',
};

export function Button({ tone = 'outline', size = 'md', className = '', ...props }) {
  const sizing = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1 rounded-lg font-sans font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-moss-500/50 ${sizing} ${BUTTON_TONES[tone]} ${className}`}
      {...props}
    />
  );
}

export function Check({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
        checked ? 'border-moss-500 bg-moss-500 text-white' : 'border-stone-300 hover:border-moss-500 dark:border-stone-600'
      }`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export function Badge({ tone = 'stone', children, title }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
    moss: 'bg-moss-100 text-moss-600 dark:bg-moss-500/20 dark:text-moss-200',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-sans text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Empty({ children }) {
  return <p className="py-3 text-center font-sans text-sm text-stone-400 dark:text-stone-500">{children}</p>;
}

export const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-sans text-sm text-stone-900 placeholder:text-stone-400 focus:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/30 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100';

export const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

export function formatMinutes(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${m}` : `${h}h`;
}

export function DurationSelect({ value, onChange, className = '' }) {
  return (
    <select aria-label="Duration" value={value} onChange={(e) => onChange(Number(e.target.value))} className={`${inputClass} w-auto ${className}`}>
      {DURATIONS.map((d) => <option key={d} value={d}>{formatMinutes(d)}</option>)}
    </select>
  );
}

export function ProjectSelect({ projects, value, onChange, className = '', allowNew = true }) {
  return (
    <select aria-label="Project" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${inputClass} w-auto max-w-[12rem] ${className}`}>
      {projects.length === 0 && <option value="">General</option>}
      {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      {allowNew && <option value="__new">+ New project…</option>}
    </select>
  );
}
