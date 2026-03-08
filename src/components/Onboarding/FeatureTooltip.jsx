import { useState, useEffect, useRef } from 'react';
import { useGarden } from '../../context/GardenContext';

/**
 * Non-blocking floating tooltip for the Day 1 Guide. Positions near a target element (by ID).
 * Uses pointer-events: none on the overlay so the rest of the app stays clickable; only the
 * tooltip card and buttons use pointer-events: auto.
 */
export default function FeatureTooltip({ targetId, message, onNext, onDismiss, isLastStep = false }) {
  const [rect, setRect] = useState(null);
  const cardRef = useRef(null);
  const { spiritConfig } = useGarden();

  const spiritName = spiritConfig?.name || 'Mochi';
  const spiritEmoji = (() => {
    if (!spiritConfig) return '✨';
    const t = spiritConfig?.type;
    if (t === 'ember') return '🔥';
    if (t === 'nimbus') return '☁️';
    if (t === 'cat') return '🐱';
    if (t === 'owl' || t === 'guide') return '🦉';
    if (t === 'rabbit') return '🐰';
    if (t === 'frog') return '🐸';
    if (t === 'butterfly') return '🦋';
    if (t === 'custom') {
      const HEADS = { bunny: '🐰', cat: '🐱', bear: '🐻', fox: '🦊', bot: '🤖', owl: '🦉' };
      return HEADS[spiritConfig?.head] || '✨';
    }
    return '✨';
  })();
  const messageText = typeof message === 'function' ? message({ spiritName, spiritEmoji, spiritType: spiritConfig?.type || 'mochi' }) : message;

  useEffect(() => {
    if (!targetId || typeof document === 'undefined') return;
    const el = document.getElementById(targetId);
    if (!el) {
      setRect('fallback');
      return;
    }
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('scroll', update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update, true);
    };
  }, [targetId]);

  if (!messageText) return null;

  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const cardWidth = 280;
  const isFallback = rect === 'fallback' || !rect;
  const effectiveRect = isFallback
    ? { top: 80, left: viewportW / 2 - 100, width: 200, height: 60 }
    : rect;

  const ringPadding = 8;
  const cardGap = 12;
  const spaceBelow = viewportH - (effectiveRect.top + effectiveRect.height);
  const placeBelow = spaceBelow >= 140;
  const cardLeft = Math.max(12, Math.min(effectiveRect.left + effectiveRect.width / 2 - cardWidth / 2, viewportW - cardWidth - 12));
  const cardTop = placeBelow
    ? effectiveRect.top + effectiveRect.height + cardGap
    : effectiveRect.top - cardGap - 160;

  return (
    <div
      className="fixed inset-0 z-[90] pointer-events-none"
      aria-live="polite"
      aria-label="Feature guide"
    >
      {/* Pulsing highlight ring — only when we have a real target (not fallback) */}
      {!isFallback && (
        <div
          className="absolute pointer-events-none rounded-xl border-2 border-amber-400 animate-pulse"
          style={{
            top: effectiveRect.top - ringPadding,
            left: effectiveRect.left - ringPadding,
            width: effectiveRect.width + ringPadding * 2,
            height: effectiveRect.height + ringPadding * 2,
            boxShadow: '0 0 0 2px rgba(251, 191, 36, 0.3)',
          }}
        />
      )}

      {/* Tooltip card — only this area captures pointer events */}
      <div
        ref={cardRef}
        className="absolute z-[91] pointer-events-auto rounded-xl bg-white border-2 border-stone-200 shadow-xl p-4 w-[280px]"
        style={{
          left: cardLeft,
          top: cardTop,
        }}
      >
        <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-stone-400 mb-2 text-center">
          {spiritEmoji} {spiritName} guide
        </p>
        <p className="font-sans text-sm text-stone-800 mb-4">{messageText}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="font-sans text-xs font-medium text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-lg px-2 py-1.5"
          >
            Dismiss Guide
          </button>
          <button
            type="button"
            onClick={onNext}
            className="font-sans text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-lg px-3 py-1.5"
          >
            {isLastStep ? 'Finish' : 'Next Tip'}
          </button>
        </div>
      </div>
    </div>
  );
}
