import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
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
  const progress = getGoalProgressPercent(goal);
  const scale = progress === 0 ? 0.15 : 0.3 + (progress / 100) * 2.2;

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

  return (
    <group scale={scale * 0.8} position={[0, 0, 0]}>
      <KenneyModel path={progress === 0 ? FLOWERS[0] : modelPath} />
    </group>
  );
}
