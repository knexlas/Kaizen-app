import React, { useEffect, useState, useMemo } from 'react';
import { Stars } from '@react-three/drei';
import { useGarden } from '../../context/GardenContext';

const PHASE_COLORS = {
  night: { bg: '#0f172a', ambient: 0.2, lightColor: '#93c5fd' },
  morning: { bg: '#bae6fd', ambient: 0.6, lightColor: '#fdf4ff' },
  day: { bg: '#87ceeb', ambient: 0.8, lightColor: '#ffffff' },
  evening: { bg: '#fb923c', ambient: 0.4, lightColor: '#fed7aa' },
};

/** Low energy: overcast/muted. High energy: vibrant. Values applied on top of time-of-day. */
const ENERGY_MOOD = {
  low: { ambientColor: '#94a3b8', ambientScale: 0.85, dirScale: 0.9 },
  normal: { ambientColor: null, ambientScale: 1, dirScale: 1 },
  high: { ambientColor: null, ambientScale: 1.1, dirScale: 1.15 },
};

export default function EnvironmentManager({ setTimePhase }) {
  const [phase, setPhase] = useState('day');
  const { dailySpoonCount } = useGarden();

  useEffect(() => {
    const hour = new Date().getHours();
    let currentPhase = 'day';
    if (hour >= 20 || hour <= 5) currentPhase = 'night';
    else if (hour >= 6 && hour <= 9) currentPhase = 'morning';
    else if (hour >= 17 && hour <= 19) currentPhase = 'evening';

    setPhase(currentPhase);
    if (setTimePhase) setTimePhase(currentPhase);
  }, [setTimePhase]);

  const base = PHASE_COLORS[phase] ?? PHASE_COLORS.day;
  const mood = useMemo(() => {
    const spoons = dailySpoonCount ?? 5;
    if (spoons <= 3) return 'low';
    if (spoons >= 8) return 'high';
    return 'normal';
  }, [dailySpoonCount]);

  const colors = useMemo(() => {
    const m = ENERGY_MOOD[mood];
    const ambientColor = m.ambientColor ?? base.lightColor;
    const ambientIntensity = base.ambient * m.ambientScale;
    const dirIntensity = base.ambient * 1.5 * m.dirScale;
    return {
      bg: base.bg,
      ambient: ambientIntensity,
      lightColor: ambientColor,
      dirIntensity,
    };
  }, [base, mood]);

  const hemisphereSky = phase === 'night' ? '#1e293b' : phase === 'evening' ? '#fef3c7' : phase === 'morning' ? '#e0f2fe' : '#f0f9ff';
  const hemisphereGround = phase === 'night' ? '#0f172a' : '#2d5a27';

  return (
    <>
      <color attach="background" args={[colors.bg]} />
      <ambientLight intensity={colors.ambient} color={colors.lightColor} />
      <hemisphereLight
        args={[hemisphereSky, hemisphereGround, 0.4]}
        position={[0, 20, 0]}
      />
      <directionalLight
        position={[10, 20, 10]}
        intensity={colors.dirIntensity}
        color={colors.lightColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {phase === 'night' && (
        <Stars radius={50} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      )}
    </>
  );
}
