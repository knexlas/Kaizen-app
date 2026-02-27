import { useGarden } from '../../context/GardenContext';

/**
 * Wraps a UI element and shows a pulse ring + floating tooltip when the interactive tour
 * is on this step. Use with tourStep 1–4 (Morning Check-in, OmniAdd, Task checkbox, Spirit).
 */
export default function TourHighlight({ step, tooltip, children, className = '' }) {
  const { tourStep } = useGarden();
  const isActive = tourStep === step;

  if (!isActive) return <>{children}</>;

  return (
    <div className={`relative ${className}`}>
      <div
        className="absolute -inset-1 rounded-2xl pointer-events-none z-10 border-2 border-moss-500 animate-[pulse_1.5s_ease-in-out_infinite]"
        aria-hidden
      />
      <div className="relative z-0">
        {children}
      </div>
      <div
        role="status"
        className="absolute left-1/2 -translate-x-1/2 -bottom-2 z-20 translate-y-full mt-2 px-4 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-sans shadow-lg max-w-[280px] text-center"
      >
        {tooltip}
      </div>
    </div>
  );
}
