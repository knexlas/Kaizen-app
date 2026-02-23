import React, { useMemo, useState } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import { getGoalProgressPercent, getHash } from './GardenWalk';

function KenneyModel({ path, scale = 1 }) {
  const { scene } = useGLTF(path);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  return <primitive object={clonedScene} scale={scale} />;
}

const TREES = ['/models/tree_oak.glb', '/models/tree_fat.glb', '/models/tree_detailed.glb'];
const PINES = ['/models/tree_pineSmallA.glb', '/models/tree_pineTallA.glb'];
const FLOWERS = ['/models/flower_purpleA.glb', '/models/flower_redA.glb', '/models/flower_yellowA.glb'];
const MUSHROOMS = ['/models/mushroom_red.glb', '/models/mushroom_tan.glb'];

const ALL_PATHS = [...TREES, ...PINES, ...FLOWERS, ...MUSHROOMS];
ALL_PATHS.forEach((path) => useGLTF.preload(path));

export default function ProceduralFlora({ goal }) {
  const [hovered, setHovered] = useState(false);
  const title = goal?.title ?? 'Goal';

  const progress = getGoalProgressPercent(goal);
  const scale = progress === 0 ? 0.15 : 0.3 + (progress / 100) * 2.2;
  const displayScale = scale * 0.8;

  const isProject = goal?._projectGoal;
  const hash = getHash(goal?.id ?? '');
  let modelPath = '';
  if (isProject) {
    const bigTrees = [...TREES, ...PINES];
    modelPath = bigTrees.length > 0 ? bigTrees[Math.abs(hash) % bigTrees.length] : FLOWERS[0] ?? ALL_PATHS[0];
  } else {
    const smallPlants = [...FLOWERS, ...MUSHROOMS];
    modelPath = smallPlants.length > 0 ? smallPlants[Math.abs(hash) % smallPlants.length] : TREES[0] ?? ALL_PATHS[0];
  }

  const sproutPath = FLOWERS[0] ?? ALL_PATHS[0];
  const path = progress === 0 ? sproutPath : modelPath;

  if (!path) return null;

  return (
    <group
      position={[0, 0, 0]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.5, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
      </mesh>
      <KenneyModel path={path} scale={displayScale} />
      <Html position={[0, displayScale + 0.6, 0]} center zIndexRange={[100, 0]}>
        <div
          className={`pointer-events-none transition-all duration-200 ${
            hovered
              ? 'opacity-100 scale-100'
              : 'opacity-70 scale-75'
          }`}
        >
          {hovered ? (
            <div className="px-3 py-1.5 bg-white/95 backdrop-blur-sm border border-stone-200 rounded-xl shadow-lg text-sm font-serif text-stone-800 whitespace-nowrap">
              {title}
            </div>
          ) : (
            <span className="text-stone-400 text-xs font-serif" title={title}>•</span>
          )}
        </div>
      </Html>
    </group>
  );
}
