import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { getGoalProgressPercent, getHash } from './GardenWalk';

function KenneyModel({ path }) {
  const { scene } = useGLTF(path);
  const clonedScene = useMemo(() => scene.clone(), [scene, path]);
  return <primitive object={clonedScene} />;
}

const TREES = ['/models/tree_oak.glb', '/models/tree_fat.glb', '/models/tree_detailed.glb'];
const PINES = ['/models/tree_pineSmallA.glb', '/models/tree_pineTallA.glb'];
const FLOWERS = ['/models/flower_purpleA.glb', '/models/flower_redA.glb', '/models/flower_yellowA.glb'];
const MUSHROOMS = ['/models/mushroom_red.glb', '/models/mushroom_tan.glb'];

[...TREES, ...PINES, ...FLOWERS, ...MUSHROOMS].forEach((p) => useGLTF.preload(p));

export default function ProceduralFlora({ goal }) {
  const progress = getGoalProgressPercent(goal);
  const scale = progress === 0 ? 0.15 : 0.3 + (progress / 100) * 2.2;

  const isProject = goal?._projectGoal;
  const hash = getHash(goal?.id ?? '');
  let modelPath = '';
  if (isProject) {
    const bigTrees = [...TREES, ...PINES];
    modelPath = bigTrees[Math.abs(hash) % bigTrees.length];
  } else {
    const smallPlants = [...FLOWERS, ...MUSHROOMS];
    modelPath = smallPlants[Math.abs(hash) % smallPlants.length];
  }

  return (
    <group scale={scale * 0.8} position={[0, 0, 0]}>
      {progress === 0 ? (
        <KenneyModel path={FLOWERS[0]} />
      ) : (
        <KenneyModel path={modelPath} />
      )}
    </group>
  );
}
