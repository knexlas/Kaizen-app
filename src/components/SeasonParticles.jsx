import { useMemo } from 'react';

const PARTICLE_COUNT = 24;

function useParticles(type) {
  return useMemo(() => Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: type === 'fireflies' ? Math.random() * 100 : undefined,
    delay: Math.random() * 12,
    duration: 10 + Math.random() * 10,
    size: 4 + Math.random() * 6,
    alt: Math.random() > 0.5,
  })), [type]);
}

export default function SeasonParticles({ particleType }) {
  const particles = useParticles(particleType);

  if (!particleType) return null;

  const isFirefly = particleType === 'fireflies';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className={`absolute rounded-full ${isFirefly ? 'animate-firefly bg-amber-300/80' : p.alt ? 'animate-particle-fall-slow' : 'animate-particle-fall'}`}
          style={{
            left: `${p.left}%`,
            top: isFirefly ? `${p.top}%` : '-2%',
            width: isFirefly ? `${p.size}px` : particleType === 'snow' ? `${p.size}px` : `${p.size * 1.5}px`,
            height: isFirefly ? `${p.size}px` : particleType === 'snow' ? `${p.size}px` : `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: isFirefly ? `${4 + (p.id % 4)}s` : `${p.duration}s`,
            opacity: 0.6,
          }}
        >
          {particleType === 'snow' && (
            <span className="block h-full w-full rounded-full bg-white/90 shadow-sm" />
          )}
          {particleType === 'petals' && (
            <span
              className="block h-full w-full rounded-full bg-pink-200/70"
              style={{ borderRadius: '60% 40% 50% 50%' }}
            />
          )}
          {particleType === 'fireflies' && (
            <span className="block h-full w-full rounded-full bg-amber-300/90 shadow-[0_0_6px_2px_rgba(251,191,36,0.5)]" />
          )}
          {particleType === 'leaves' && (
            <span
              className="block h-full w-full rounded-sm bg-amber-700/50"
              style={{
                borderRadius: '2px 12px 2px 8px',
                transform: `rotate(${p.id * 37}deg)`,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
