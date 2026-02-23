import React from 'react';
import { getGoalProgressPercent, getHash } from './GardenWalk';

const FLOWER_COLORS = [
  '#fb7185',
  '#a78bfa',
  '#34d399',
  '#facc15',
  '#f472b6',
  '#38bdf8',
  '#fb923c',
];

const BROWN = '#8b6914';
const GREEN = '#22c55e';
const YELLOW = '#eab308';
const WHITE = '#fafafa';

function OakTree({ color }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 1, 5]} />
        <meshStandardMaterial color={BROWN} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 1.8, 0]}>
        <icosahedronGeometry args={[0.8, 1]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
}

function PineTree({ color }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 1, 5]} />
        <meshStandardMaterial color={BROWN} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.8, 0, 1.2, 5]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 2.7, 0]}>
        <cylinderGeometry args={[0.6, 0, 1, 5]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
}

function VibrantFlower({ color }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
        <meshStandardMaterial color={GREEN} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={YELLOW} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.1, 8, 8]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
}

function CozyMushroom({ color }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.2, 0.25, 0.6, 8]} />
        <meshStandardMaterial color={WHITE} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.6, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
}

export default function ProceduralFlora({ goal }) {
  const progress = getGoalProgressPercent(goal);
  const scale = progress === 0 ? 0.15 : 0.3 + (progress / 100) * 2.2;

  const hash = getHash(goal?.id ?? '');
  const colorIndex = Math.abs(hash) % FLOWER_COLORS.length;
  const color = FLOWER_COLORS[colorIndex];

  let typeIndex = (Math.abs(hash) >> 8) % 4;
  if (goal?._projectGoal) {
    typeIndex = Math.abs(hash) % 2; // 0: Oak, 1: Pine
  }

  const FloraComponent =
    typeIndex === 0
      ? OakTree
      : typeIndex === 1
        ? PineTree
        : typeIndex === 2
          ? VibrantFlower
          : CozyMushroom;

  return (
    <group scale={scale} position={[0, 0, 0]}>
      {progress === 0 ? <VibrantFlower color="#8fa967" /> : <FloraComponent color={color} />}
    </group>
  );
}
