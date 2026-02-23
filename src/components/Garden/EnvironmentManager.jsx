import React, { useEffect, useState } from 'react';
import { Stars } from '@react-three/drei';

const PHASE_COLORS = {
  night: { bg: '#0f172a', ambient: 0.2, lightColor: '#93c5fd' },
  morning: { bg: '#bae6fd', ambient: 0.6, lightColor: '#fdf4ff' },
  day: { bg: '#87ceeb', ambient: 0.8, lightColor: '#ffffff' },
  evening: { bg: '#fb923c', ambient: 0.4, lightColor: '#fed7aa' },
};

export default function EnvironmentManager({ setTimePhase }) {
  const [phase, setPhase] = useState('day');

  useEffect(() => {
    const hour = new Date().getHours();
    let currentPhase = 'day';
    if (hour >= 20 || hour <= 5) currentPhase = 'night';
    else if (hour >= 6 && hour <= 9) currentPhase = 'morning';
    else if (hour >= 17 && hour <= 19) currentPhase = 'evening';

    setPhase(currentPhase);
    if (setTimePhase) setTimePhase(currentPhase);
  }, [setTimePhase]);

  const colors = PHASE_COLORS[phase] ?? PHASE_COLORS.day;

  return (
    <>
      <color attach="background" args={[colors.bg]} />
      <ambientLight intensity={colors.ambient} color={colors.lightColor} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={colors.ambient * 1.5}
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
