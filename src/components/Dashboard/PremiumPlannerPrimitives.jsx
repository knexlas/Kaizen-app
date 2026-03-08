function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function PremiumPlannerShell({ id, className = '', children }) {
  return (
    <section id={id} className={cx('premium-shell p-3 md:p-4', className)}>
      {children}
    </section>
  );
}

export function PremiumSection({ className = '', children }) {
  return <section className={cx('premium-surface p-3 md:p-4', className)}>{children}</section>;
}

export function PremiumSectionHeader({ title, description, right = null, className = '' }) {
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-2', className)}>
      <div className="min-w-0">
        <h3 className="font-serif text-stone-900 dark:text-stone-100 text-lg">{title}</h3>
        {description ? <p className="font-sans text-sm text-stone-500 dark:text-stone-400 mt-1">{description}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function PremiumActionRow({ className = '', children }) {
  return <div className={cx('premium-surface-muted p-2 flex flex-wrap items-center gap-2 premium-transition', className)}>{children}</div>;
}

export function PremiumEmptyState({ message, className = '' }) {
  return <p className={cx('font-sans text-sm text-stone-500 dark:text-stone-400 italic', className)}>{message}</p>;
}

export function PlannerSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={cx('space-y-2 animate-pulse', className)} aria-hidden>
      {Array.from({ length: Math.max(1, lines) }, (_, i) => (
        <div
          key={i}
          className={`h-3.5 rounded-md bg-stone-200/80 dark:bg-stone-700/70 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function PrimaryPlannerAction({ className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center gap-2 py-2 px-3 rounded-lg font-sans text-sm font-semibold bg-moss-600 text-white hover:bg-moss-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-moss-500/40 premium-transition',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryPlannerAction({ className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center gap-2 py-2 px-3 rounded-lg font-sans text-sm font-medium border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/70 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-stone-400/30 premium-transition',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function PlannerKpiStrip({ items = [], className = '' }) {
  return (
    <div className={cx('premium-surface-muted px-3 py-2', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {items.map((item) => (
          <p key={item.label} className="font-sans text-xs text-stone-600 dark:text-stone-300">
            <span className="font-semibold text-stone-800 dark:text-stone-100">{item.value}</span> {item.label}
          </p>
        ))}
      </div>
    </div>
  );
}
