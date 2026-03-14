import React, { useMemo, useRef, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { getGoalProgressPercent, getHash } from './gardenProgress';
import { LowPerfContext } from './Garden3D';
import { GOAL_GARDEN_STATE } from '../../services/gardenStateService';

export function KenneyModel({ path, scale = 1, lowPerf = false }) {
  const { scene } = useGLTF(path);
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = !lowPerf;
        child.receiveShadow = !lowPerf;
      }
    });
    return clone;
  }, [scene, lowPerf]);
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

/**
 * Visual state from project/activity: nurtured (normal), neglected (dormant), restored (back to life), stuck (gentle wilt).
 * Motivating, not punitive: dormant = resting; restored = small glow.
 */
export default function ProceduralFlora({ goal, isHovered, gardenState }) {
  const lowPerf = useContext(LowPerfContext);
  const progress = getGoalProgressPercent(goal) || 0;
  const growthScale = Math.max(0.3, progress / 100);

  const lastWateredOrCreated = getLastWateredOrCreated(goal);
  const isThirsty =
    lastWateredOrCreated == null
      ? false
      : Date.now() - lastWateredOrCreated > THIRSTY_HOURS * 60 * 60 * 1000;

  const state = gardenState ?? GOAL_GARDEN_STATE.NURTURED;
  const isNeglected = state === GOAL_GARDEN_STATE.NEGLECTED;
  const isRestored = state === GOAL_GARDEN_STATE.RESTORED;
  const isStuck = state === GOAL_GARDEN_STATE.STUCK;

  const dormant = isThirsty || isNeglected;
  const droop = dormant ? [0.25, 0, 0.2] : isStuck ? [0.12, 0, 0.08] : [0, 0, 0];
  const soilColor = dormant ? '#a8a29e' : isStuck ? '#57534e' : '#4a3f35';
  const scaleMod = isNeglected ? 0.85 : isRestored ? 1.02 : 1;

  const isProject = goal?._projectGoal;
  const hash = getHash(String(goal?.id ?? ''));
  const FLORA_MODELS = isProject ? [...TREES, ...PINES] : [...FLOWERS, ...MUSHROOMS];
  const hashFallback = FLORA_MODELS.length > 0 ? FLORA_MODELS[Math.abs(hash) % FLORA_MODELS.length] : (FLOWERS[0] ?? ALL_PATHS[0]);
  const modelFile = goal?.seedModel ? `/models/${goal.seedModel}` : hashFallback;

  const plantRef = useRef();
  useFrame((state) => {
    if (!plantRef.current || lowPerf) return;
    const time = state.clock.elapsedTime;
    plantRef.current.rotation.x = Math.sin(time * 0.5 + hash) * 0.02;
    plantRef.current.rotation.z = Math.cos(time * 0.4 + hash) * 0.02;
  });

  return (
    <group scale={0.8 * scaleMod} position={[0, 0, 0]}>
      <mesh position={[0, 0.05, 0]} receiveShadow={!lowPerf} castShadow={!lowPerf}>
        <cylinderGeometry args={[0.45, 0.5, 0.1, 8]} />
        <meshStandardMaterial color={soilColor} roughness={1} />
      </mesh>
      <group rotation={droop}>
        <group ref={plantRef}>
          <KenneyModel path={modelFile} scale={growthScale} lowPerf={lowPerf} />
        </group>
      </group>
    </group>
  );
}
