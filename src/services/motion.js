/**
 * Whether to reduce motion based on settings (and optionally OS).
 * Use for framer-motion: when true, use opacity-only or no transition.
 */
export function shouldReduceMotion(settings) {
  if (!settings) return false;
  if (settings.motionPref === 'reduce') return true;
  if (settings.motionPref === 'full') return false;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return true;
  return false;
}
