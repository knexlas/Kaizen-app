/**
 * Wooden spoon icon – cozy/tea aesthetic (Japandi). Brown styling, not metal.
 * Use for spoon-count UI in Morning Check-in and TimeSlicer battery.
 */
export default function WoodenSpoon({ className = '', size = 24, ariaHidden = true }) {
  const s = Number(size) || 24;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Bowl – oval, wooden */}
      <ellipse cx="12" cy="15.5" rx="5" ry="3.8" fill="#6B5344" stroke="#5C4033" strokeWidth="0.7" />
      {/* Handle – rounded rectangle */}
      <rect x="10.5" y="2" width="3" height="10" rx="1" fill="#7D6E63" stroke="#5C4033" strokeWidth="0.6" />
      {/* Soft highlight on handle */}
      <path d="M11.4 4v7" stroke="#8B7355" strokeWidth="0.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
