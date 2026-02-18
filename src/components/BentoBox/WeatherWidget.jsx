// Simple weather icons (Lucide-style)
const CloudRain = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
  </svg>
);
const Sun = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);
const Cloud = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

function formatDomain(domain) {
  if (!domain) return '';
  const map = { trading: 'Finance', fitness: 'Health', family: 'Creation' };
  return map[domain] || domain.charAt(0).toUpperCase() + domain.slice(1);
}

function WeatherWidget({ localEvents = [], crossDomainEvents = [] }) {
  const hasLocal = localEvents.length > 0;
  const hasCross = crossDomainEvents.length > 0;
  if (!hasLocal && !hasCross) return null;

  const getAtmosphere = (impact) => {
    if (impact === 'high') return { theme: 'storm', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', Icon: CloudRain, label: 'Storm' };
    if (impact === 'low') return { theme: 'sun', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', Icon: Sun, label: 'Sun' };
    return { theme: 'cloud', bg: 'bg-stone-100', text: 'text-stone-600', border: 'border-stone-300', Icon: Cloud, label: 'Cloud' };
  };

  return (
    <ul className="flex flex-col gap-2 w-full list-none p-0 m-0">
      {localEvents.map((event) => {
        const { bg, text, border, Icon, label } = getAtmosphere(event.impact);
        return (
          <li
            key={event.id}
            className={`flex items-center gap-4 px-3 py-2 rounded-md font-sans text-sm border ${bg} ${text} ${border}`}
          >
            <span className="shrink-0 w-32 opacity-90">{event.date}</span>
            <span className="flex-1 font-medium truncate text-center">{event.title}</span>
            <span className="shrink-0 flex items-center gap-1.5">
              <span className="[&_svg]:block"><Icon /></span>
              <span className="text-xs font-medium opacity-90">{label}</span>
            </span>
          </li>
        );
      })}
      {crossDomainEvents.map((event) => (
        <li
          key={`cross-${event.id}`}
          className="flex items-center gap-2 px-3 py-2 rounded-md font-sans text-sm border-2 border-dashed border-slate-300 bg-slate-100 text-slate-700"
        >
          <span className="shrink-0 [&_svg]:block"><CloudRain /></span>
          <span className="flex-1 font-medium">
            Strong headwinds from {formatDomain(event.domain)}: {event.title}
          </span>
          <span className="shrink-0 text-xs opacity-90">{event.date}</span>
        </li>
      ))}
    </ul>
  );
}

export default WeatherWidget;
