import React, { useRef, useState, useCallback } from 'react';

export const joystickState = { x: 0, y: 0 };

const RADIUS = 48; // half of w-24 (6rem) in px, for clamp

function VirtualJoystickInner() {
  const containerRef = useRef(null);
  const [thumbOffset, setThumbOffset] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef(null);

  const getCenter = useCallback(() => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

  const clampToCircle = (dx, dy) => {
    const len = Math.hypot(dx, dy);
    if (len <= RADIUS) return { x: dx, y: dy };
    const scale = RADIUS / len;
    return { x: dx * scale, y: dy * scale };
  };

  const handleTouchStart = (e) => {
    if (touchIdRef.current != null) return;
    const touch = e.changedTouches[0];
    if (touch) touchIdRef.current = touch.identifier;
  };

  const handleTouchMove = (e) => {
    const touch = Array.from(e.touches).find((t) => t.identifier === touchIdRef.current);
    if (!touch || !containerRef.current) return;
    e.preventDefault();
    const center = getCenter();
    const dx = touch.clientX - center.x;
    const dy = touch.clientY - center.y;
    const { x: cx, y: cy } = clampToCircle(dx, dy);
    const normX = cx / RADIUS;
    const normY = -cy / RADIUS; // up on screen = positive y (forward)
    joystickState.x = normX;
    joystickState.y = normY;
    setThumbOffset({ x: cx, y: cy });
  };

  const handleTouchEnd = (e) => {
    const touch = e.changedTouches[0];
    if (touch && touch.identifier === touchIdRef.current) {
      touchIdRef.current = null;
      joystickState.x = 0;
      joystickState.y = 0;
      setThumbOffset({ x: 0, y: 0 });
    }
  };

  return (
    <div
      ref={containerRef}
      role="presentation"
      className="absolute bottom-6 left-6 z-10 w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 touch-none select-none flex items-center justify-center"
      style={{ touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className="absolute left-1/2 top-1/2 w-12 h-12 rounded-full bg-white/70 shadow-md border border-white/50 pointer-events-none transition-transform duration-75"
        style={{
          transform: `translate(calc(-50% + ${thumbOffset.x}px), calc(-50% + ${thumbOffset.y}px))`,
        }}
      />
    </div>
  );
}

export default function VirtualJoystick() {
  if (typeof window !== 'undefined' && !('ontouchstart' in window)) return null;
  return <VirtualJoystickInner />;
}
