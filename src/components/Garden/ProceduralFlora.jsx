import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { getGoalProgressPercent, getHash } from './GardenWalk';

export function KenneyModel({ path, scale = 1 }) {
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

const THIRSTY_HOURS = 48;

function getLastWateredOrCreated(goal) {
  const iso = goal?.lastWatered ?? goal?.createdAt;
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export default function ProceduralFlora({ goal, isHovered }) {
  const progress = getGoalProgressPercent(goal);
  const scale = progress === 0 ? 0.15 : 0.3 + (progress / 100) * 2.2;

  const lastWateredOrCreated = getLastWateredOrCreated(goal);
  const isThirsty =
    lastWateredOrCreated == null
      ? false
      : Date.now() - lastWateredOrCreated > THIRSTY_HOURS * 60 * 60 * 1000;

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

  const plantRef = useRef();
  useFrame((state) => {
    if (!plantRef.current) return;
    const time = state.clock.elapsedTime;
    plantRef.current.rotation.x = Math.sin(time * 0.5 + hash) * 0.02;
    plantRef.current.rotation.z = Math.cos(time * 0.4 + hash) * 0.02;
  });

  return (
    <group scale={scale * 0.8} position={[0, 0, 0]}>
      {/* Tilled Soil Base */}
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.45, 0.5, 0.1, 8]} />
        <meshStandardMaterial color={isThirsty ? '#d6d3d1' : '#4a3f35'} roughness={1} />
      </mesh>
      {/* Droop wrapper when thirsty; inner group has sway animation */}
      <group rotation={isThirsty ? [0.2, 0, 0.2] : [0, 0, 0]}>
        <group ref={plantRef}>
          <KenneyModel path={progress === 0 ? FLOWERS[0] : modelPath} />
        </group>
      </group>
    </group>
  );
}
