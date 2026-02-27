import { useMemo, Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Environment, RoundedBox, useGLTF, Sparkles, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGarden } from '../../context/GardenContext';
import { getGoalProgressPercent } from './GardenWalk';
import WanderingCreature from './WanderingCreature';
import ProceduralFlora from './ProceduralFlora';
import AnimatedModel from './AnimatedModel';
import Mochi3D from './Mochi3D';
import DynamicSpirit3D from './DynamicSpirit3D';
import Rabbit3D from './Rabbit3D';
import Frog3D from './Frog3D';
import Butterfly3D from './Butterfly3D';
import EnvironmentManager from './EnvironmentManager';
import ShopStand from './ShopStand';
import Garden3DErrorBoundary from './Garden3DErrorBoundary';
import SceneErrorBoundary from './SceneErrorBoundary';
import { joystickState } from './VirtualJoystick';

const TERRAIN_COLORS = {
  water: '#4facfe',
  stone: '#78716c',
  sand: '#d2b48c',
};

function FocusCamera({ focusGoal }) {
  const { camera } = useThree();
  const controls = useThree((state) => state.controls);
  useFrame((state, delta) => {
    const pos = focusGoal?.position3D;
    if (!focusGoal || !Array.isArray(pos) || pos.length < 3 || !controls) return;
    const gx = Number(pos[0]) || 0;
    const gz = Number(pos[2]) || 0;
    const targetCamPos = new THREE.Vector3(gx + 3, 1.5, gz + 3);
    const targetLookAt = new THREE.Vector3(gx, 0.5, gz);
    camera.position.lerp(targetCamPos, delta * 2);
    controls.target.lerp(targetLookAt, delta * 2);
    controls.update();
  });
  return null;
}

function KeyboardController() {
  const { camera } = useThree();
  const keys = useRef({ w: false, a: false, s: false, d: false });
  useEffect(() => {
    const handleKey = (e, isDown) => {
      const key = e.key.toLowerCase();
      if (Object.hasOwn(keys.current, key)) keys.current[key] = isDown;
      if (e.key === 'ArrowUp') keys.current.w = isDown;
      if (e.key === 'ArrowDown') keys.current.s = isDown;
      if (e.key === 'ArrowLeft') keys.current.a = isDown;
      if (e.key === 'ArrowRight') keys.current.d = isDown;
    };
    const onKeyDown = (e) => handleKey(e, true);
    const onKeyUp = (e) => handleKey(e, false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
  useFrame(() => {
    const speed = 0.15;
    if (keys.current.w) camera.position.z -= speed;
    if (keys.current.s) camera.position.z += speed;
    if (keys.current.a) camera.position.x -= speed;
    if (keys.current.d) camera.position.x += speed;
    camera.position.x += joystickState.x * speed;
    camera.position.z += joystickState.y * speed;
  });
  return null;
}

function OrbitControlsWithFollowTarget({ enabled = true }) {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));
  useFrame(() => {
    targetRef.current.set(camera.position.x, 0, camera.position.z);
  });
  return (
    <OrbitControls
      makeDefault
      enabled={enabled}
      maxPolarAngle={Math.PI / 2 - 0.01}
      minDistance={2}
      maxDistance={25}
      target={targetRef.current}
      autoRotate
      autoRotateSpeed={0.5}
      enableDamping
      dampingFactor={0.05}
      enablePan={true}
    />
  );
}

function WaterTile({ x, z }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) ref.current.position.y = 0.02 + Math.sin(state.clock.elapsedTime * 2 + x + z) * 0.03;
  });
  return (
    <mesh ref={ref} position={[x, 0.02, z]} receiveShadow castShadow>
      <boxGeometry args={[1, 0.15, 1]} />
      <meshStandardMaterial color="#3b82f6" roughness={0.1} metalness={0.5} transparent opacity={0.85} />
    </mesh>
  );
}

function TerrainTiles() {
  const { terrainMap } = useGarden();
  const entries = Object.entries(terrainMap ?? {});
  return (
    <>
      {entries.map(([key, material]) => {
        const [x, z] = key.split(',').map(Number);
        if (Number.isNaN(x) || Number.isNaN(z)) return null;
        if (material === 'water') return <WaterTile key={key} x={x} z={z} />;
        if (material === 'sand') {
          return (
            <mesh key={key} position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[1, 1]} />
              <meshStandardMaterial color="#e6c280" roughness={1} />
            </mesh>
          );
        }
        if (material === 'stone') {
          return (
            <RoundedBox key={key} args={[0.95, 0.15, 0.95]} radius={0.02} position={[x, -0.05, z]} receiveShadow>
              <meshStandardMaterial color="#78716c" roughness={0.8} />
            </RoundedBox>
          );
        }
        const color = TERRAIN_COLORS[material] ?? TERRAIN_COLORS.stone;
        return (
          <RoundedBox key={key} args={[0.95, 0.2, 0.95]} radius={0.05} position={[x, -0.1, z]} receiveShadow>
            <meshStandardMaterial color={color} />
          </RoundedBox>
        );
      })}
    </>
  );
}

function Ground({ onClick, disabled }) {
  return (
    <RoundedBox
      args={[30, 0.5, 30]}
      radius={0.1}
      position={[0, -0.3, 0]}
      receiveShadow
      onClick={disabled ? undefined : onClick}
    >
      <meshStandardMaterial color="#256330" roughness={0.95} metalness={0} />
    </RoundedBox>
  );
}

/** Single static flora instance for ambient scatter (flowers/mushrooms). */
function StaticFloraNode({ path, position, scale = 0.4 }) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);
  if (!cloned) return null;
  return <primitive object={cloned} position={position} scale={scale} />;
}

/** Ambient scatter: a few static flowers/mushrooms around the garden for visual richness. */
function AmbientScatter() {
  const scatter = useMemo(
    () => [
      { path: '/models/flower_yellowA.glb', position: [-6, 0, 5], scale: 0.35 },
      { path: '/models/flower_purpleA.glb', position: [7, 0, -6], scale: 0.35 },
      { path: '/models/mushroom_red.glb', position: [4, 0, 8], scale: 0.4 },
      { path: '/models/mushroom_tan.glb', position: [-8, 0, -4], scale: 0.4 },
      { path: '/models/flower_redA.glb', position: [9, 0, 3], scale: 0.35 },
    ],
    []
  );
  return (
    <group>
      {scatter.map(({ path, position, scale }, i) => (
        <StaticFloraNode key={i} path={path} position={position} scale={scale} />
      ))}
    </group>
  );
}

function GoalNode({ goal, onGoalClick, activeTool, waterGoal, fireToast, setActiveTool, positionOverride }) {
  const [hovered, setHovered] = useState(false);
  const [justWatered, setJustWatered] = useState(false);
  const estimatedMinutes = goal.estimatedMinutes ?? (Number(goal.targetHours) || 0) * 60 || 1;
  const totalMinutes = Number(goal.totalMinutes) || 0;
  const progressRatio = Math.min(1, totalMinutes / estimatedMinutes);
  const baseScale = 0.5 + progressRatio * 1.0;
  const finalScale = (hovered ? 1.05 : 1) * baseScale;

  useEffect(() => {
    if (!justWatered) return;
    const t = setTimeout(() => setJustWatered(false), 1500);
    return () => clearTimeout(t);
  }, [justWatered]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (activeTool?.type === 'move') {
      setActiveTool?.({ type: 'place', item: goal, isRelocating: true, originalType: 'goal' });
      return;
    }
    if (activeTool?.type === 'water') {
      try {
        waterGoal(goal.id);
        setJustWatered(true);
        if (typeof fireToast === 'function') fireToast('Watered! +5 Embers 💦');
        if (typeof setActiveTool === 'function') setActiveTool(null);
      } catch (err) {
        if (typeof fireToast === 'function') fireToast(err?.message ?? 'No water left');
      }
      return;
    }
    onGoalClick(goal);
  };

  const position = Array.isArray(positionOverride) && positionOverride.length >= 3
    ? positionOverride
    : goal.position3D;

  return (
    <group
      position={position}
      scale={finalScale}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = activeTool?.type === 'move' ? 'grab' : 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <ProceduralFlora goal={goal} isHovered={hovered} />
      {justWatered && (
        <Sparkles count={20} scale={[2, 2, 2]} position={[0, 1.2, 0]} size={2} speed={0.3} color="#93c5fd" />
      )}
    </group>
  );
}

function DecorationNode({ decoration, activeTool, setActiveTool, positionOverride }) {
  if (!decoration?.position3D || !Array.isArray(decoration.position3D) || !decoration.model) return null;
  const isOrganic = decoration.id?.startsWith('anim_') || decoration.id?.startsWith('dec_pot') || decoration.id?.startsWith('dec_lily');
  const yRotation = useMemo(() => (isOrganic ? Math.random() * Math.PI * 2 : 0), [isOrganic]);
  return (
    <group
      position={Array.isArray(positionOverride) && positionOverride.length >= 3 ? positionOverride : decoration.position3D}
      onClick={(e) => {
        e.stopPropagation();
        if (activeTool?.type === 'move') {
          setActiveTool?.({ type: 'place', item: decoration, isRelocating: true, originalType: 'decoration' });
        }
      }}
      onPointerOver={() => activeTool?.type === 'move' && (document.body.style.cursor = 'grab')}
      onPointerOut={() => document.body.style.cursor = 'auto'}
    >
      <AnimatedModel
        path={`/models/${decoration.model}`}
        rotation={[0, yRotation, 0]}
        scale={decoration.id?.startsWith('anim_') ? 0.6 : 1}
      />
    </group>
  );
}

function Scene({ placedGoals, onPlant, onGoalClick, timePhase, activeTool, waterGoal, fireToast, setActiveTool, decorations, canvasInteractionDisabled, campfirePositions = [] }) {
  const { terrainMap } = useGarden();
  const isItemBeingMoved = (id, kind) =>
    activeTool?.type === 'place' && activeTool?.isRelocating && activeTool?.originalType === kind && (activeTool?.item?.id === id || activeTool?.decorationId === id || activeTool?.decoration?.id === id);
  const visibleDecorations = decorations?.filter((dec) => !isItemBeingMoved(dec.id, 'decoration')) ?? [];
  const visibleGoals = placedGoals?.filter((goal) => !isItemBeingMoved(goal.id, 'goal')) ?? [];

  const getTerrainHeightAt = (x, z) => {
    if (!terrainMap || typeof terrainMap !== 'object') return -0.05;
    if (typeof x !== 'number' || typeof z !== 'number' || Number.isNaN(x) || Number.isNaN(z)) return -0.05;
    const key = `${Math.round(x)},${Math.round(z)}`;
    const material = terrainMap[key];
    if (material === 'water') return 0.02;
    if (material === 'sand') return 0.01;
    if (material === 'stone') return -0.05;
    return -0.05;
  };

  const getDecorationYOffset = (model) => {
    if (!model) return 0;
    const m = String(model).toLowerCase();
    if (m.includes('campfire')) return 0.08;
    if (m.includes('bridge')) return 0.04;
    if (m.includes('canoe')) return 0.05;
    if (m.includes('stump')) return 0.03;
    if (m.includes('pot_') || m.includes('lily')) return 0.02;
    return 0;
  };

  return (
    <>
      <TerrainTiles />
      <Ground onClick={onPlant} disabled={canvasInteractionDisabled} />
      <AmbientScatter />
      {visibleDecorations.map((dec) => (
        <DecorationNode
          key={dec.id}
          decoration={dec}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          positionOverride={
            Array.isArray(dec.position3D) && dec.position3D.length >= 3
              ? [
                  dec.position3D[0],
                  getTerrainHeightAt(dec.position3D[0], dec.position3D[2]) + getDecorationYOffset(dec.model),
                  dec.position3D[2],
                ]
              : undefined
          }
        />
      ))}
      {visibleGoals.map((goal) => (
        <GoalNode
          key={goal.id}
          goal={goal}
          onGoalClick={onGoalClick}
          activeTool={activeTool}
          waterGoal={waterGoal}
          fireToast={fireToast}
          setActiveTool={setActiveTool}
          positionOverride={
            Array.isArray(goal.position3D) && goal.position3D.length >= 3
              ? [
                  goal.position3D[0],
                  getTerrainHeightAt(goal.position3D[0], goal.position3D[2]) + 0.02,
                  goal.position3D[2],
                ]
              : undefined
          }
        />
      ))}
      <Ecosystem placedGoals={placedGoals} timePhase={timePhase} campfirePositions={campfirePositions} />
    </>
  );
}

function Ecosystem({ placedGoals, timePhase = 'day', campfirePositions = [] }) {
  const { unlockedAnimals, spiritConfig, userSettings } = useGarden();
  const rawForm = userSettings?.spirit?.form ?? spiritConfig?.type ?? 'mochi';
  const effectiveForm = rawForm === 'ember' ? 'flame' : rawForm === 'nimbus' ? 'cloud' : rawForm === 'custom' ? 'guide' : (rawForm || 'mochi');
  const showBackgroundMochi = effectiveForm !== 'mochi';
  const goalPositions = placedGoals
    ?.map((g) => g.position3D)
    .filter((p) => Array.isArray(p) && p.length >= 3) ?? [];
  const phase = timePhase ?? 'day';

  return (
    <group name="ecosystem">
      <WanderingCreature
        customComponent={<DynamicSpirit3D form={effectiveForm} />}
        allowedTerrain="grass"
        speed={1.2}
        zOffset={0}
        scale={1}
        goalPositions={goalPositions}
        timePhase={phase}
        displayName="Spirit"
        campfirePositions={campfirePositions}
      />
      {unlockedAnimals?.includes('fish') && (
        <WanderingCreature emoji="🐟" allowedTerrain="water" speed={0.8} zOffset={0.2} scale={0.7} timePhase={phase} displayName="fish" campfirePositions={campfirePositions} />
      )}
      {unlockedAnimals?.includes('rabbit') && (
        <WanderingCreature
          customComponent={<Rabbit3D isWalking={true} />}
          allowedTerrain="grass"
          speed={2.5}
          jumpHeight={0.6}
          zOffset={0}
          scale={0.8}
          timePhase={phase}
          displayName="rabbit"
          campfirePositions={campfirePositions}
        />
      )}
      <WanderingCreature allowedTerrain="water" speed={0.5} zOffset={0} customComponent={<Frog3D />} timePhase={phase} displayName="frog" campfirePositions={campfirePositions} />
      {phase !== 'night' && (
        <WanderingCreature allowedTerrain="grass" speed={1.5} zOffset={1.5} customComponent={<Butterfly3D />} timePhase={phase} displayName="butterfly" campfirePositions={campfirePositions} />
      )}
      {phase === 'night' && (
        <Sparkles count={40} scale={[15, 4, 15]} position={[0, 2, 0]} size={4} speed={0.4} opacity={0.8} color="#fef08a" />
      )}
      {showBackgroundMochi && (
        <WanderingCreature
          customComponent={<Mochi3D isWalking={true} />}
          allowedTerrain="grass"
          speed={0.5}
          zOffset={0.5}
          scale={0.7}
          goalPositions={goalPositions}
          timePhase={phase}
          displayName="Mochi"
          campfirePositions={campfirePositions}
        />
      )}
    </group>
  );
}

function ShopCornerTree() {
  const { scene } = useGLTF('/models/tree_pineTallA.glb');
  const cloned = useMemo(() => (scene ? scene.clone() : null), [scene]);
  if (!cloned) return null;
  return <primitive object={cloned} position={[10, 0, -8]} scale={1} />;
}

function JournalMonument({ onClick }) {
  const { scene } = useGLTF('/models/sign.glb');
  const clone = useMemo(() => (scene ? scene.clone() : null), [scene]);
  if (!clone) return null;
  return (
    <group
      position={[-14, 0, -14]}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <primitive object={clone} scale={1.2} />
      <Billboard position={[0, 2, 0]}>
        <Text fontSize={0.4} color="#292524" outlineWidth={0.04} outlineColor="#ffffff">
          📔 Captain&apos;s Log
        </Text>
      </Billboard>
    </group>
  );
}

function InsightMonolith({ onClick }) {
  const { scene } = useGLTF('/models/statue_obelisk.glb');
  const clone = useMemo(() => (scene ? scene.clone() : null), [scene]);
  if (!clone) return null;
  return (
    <group
      position={[14, 0, -14]}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <primitive object={clone} scale={1} />
      <Billboard position={[0, 4, 0]}>
        <Text fontSize={0.4} color="#292524" outlineWidth={0.04} outlineColor="#ffffff">
          📊 Insights
        </Text>
      </Billboard>
      <pointLight position={[0, 2, 0]} color="#60a5fa" intensity={2} distance={5} />
    </group>
  );
}

function fireToast(message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message } }));
  }
}

/*
 * .glb usage: Fixed monuments (tree_pineTallA, sign, statue_obelisk) are used by ShopCornerTree,
 * JournalMonument, InsightMonolith. ProceduralFlora preloads TREES/PINES/FLOWERS/MUSHROOMS (see ProceduralFlora.jsx).
 * Shop decorations and pets are preloaded below so placing/unlocking from SpiritShop is instant.
 * AmbientScatter uses flower_* and mushroom_* (already preloaded by ProceduralFlora).
 */
useGLTF.preload('/models/tree_pineTallA.glb');
useGLTF.preload('/models/sign.glb');
useGLTF.preload('/models/statue_obelisk.glb');

// Preload all shop decoration & pet models so placing/unlocking is instant (no pop-in)
const SHOP_DECORATION_MODELS = [
  'tent_smallOpen.glb', 'campfire_logs.glb', 'campfire_stones.glb', 'campfire_bricks.glb', 'campfire_planks.glb',
  'log_stackLarge.glb', 'canoe.glb', 'bridge_wood.glb', 'fence_planks.glb', 'fence_gate.glb', 'sign.glb',
  'statue_obelisk.glb', 'statue_columnDamaged.glb', 'pot_large.glb', 'lily_large.glb', 'stump_oldTall.glb',
];
const SHOP_PET_MODELS = [
  'Pug.glb', 'ShibaInu-v10.glb', 'Husky-v9.glb', 'Fox-v6.glb', 'Wolf-v12.glb', 'Horse-v7.glb', 'Horse_White-v8.glb',
  'Alpaca-v1.glb', 'Llama.glb', 'Deer-v4.glb', 'Stag-v11.glb', 'Cow-v3.glb', 'Bull-v2.glb', 'Pig.glb', 'Sheep.glb',
  'Donkey-v5.glb', 'Fish1.glb', 'Manta ray.glb', 'Dolphin.glb',
];
const SPIRIT_ECOSYSTEM_MODELS = ['Cat.glb'];
[...SHOP_DECORATION_MODELS, ...SHOP_PET_MODELS, ...SPIRIT_ECOSYSTEM_MODELS].forEach((m) => useGLTF.preload(`/models/${m}`));

/** Map context spirit type to DynamicSpirit3D form (flame, cloud, guide, cat, mochi). */
function spiritTypeToForm(spiritConfig, userSettings) {
  const form = userSettings?.spirit?.form ?? spiritConfig?.type ?? 'mochi';
  const t = String(form).toLowerCase();
  if (t === 'ember') return 'flame';
  if (t === 'nimbus') return 'cloud';
  if (t === 'custom') return 'guide';
  return t || 'mochi';
}

export default function Garden3D({ onGoalClick, onOpenShop, focusGoal, onOpenJournal, onOpenInsights, uiBlocksCanvas = false }) {
  const [timePhase, setTimePhase] = useState('day');
  const { goals, editGoal, activeTool, setActiveTool, paintTerrain, updateDecoration, waterGoal, decorations = [], spiritConfig, userSettings } = useGarden();
  const chosenForm = spiritTypeToForm(spiritConfig, userSettings);
  const placedGoals = goals?.filter((g) => Array.isArray(g.position3D) && g.position3D.length >= 3) ?? [];
  const unplacedGoals = goals?.filter((g) => !g.position3D || !Array.isArray(g.position3D)) ?? [];
  const campfirePositions = useMemo(
    () =>
      (decorations ?? [])
        .filter((d) => d.model && String(d.model).toLowerCase().includes('campfire') && Array.isArray(d.position3D) && d.position3D.length >= 3)
        .map((d) => ({ x: Number(d.position3D[0]) || 0, y: Number(d.position3D[1]) ?? 0, z: Number(d.position3D[2]) || 0 })),
    [decorations]
  );

  const handlePlant = (e) => {
    e.stopPropagation();
    if (!activeTool) return;
    let { x, z } = e.point;
    x = Math.round(x);
    z = Math.round(z);

    if (activeTool?.type === 'place') {
      if (activeTool.isRelocating && activeTool.item) {
        const item = activeTool.item;
        if (activeTool.originalType === 'decoration') {
          updateDecoration(item.id, { position3D: [x, 0, z] });
        } else if (activeTool.originalType === 'goal') {
          editGoal(item.id, { position3D: [x, 0, z] });
        }
        setActiveTool(null);
        return;
      }
      const decorationId = activeTool.decoration?.id ?? activeTool.decorationId;
      if (decorationId) {
        updateDecoration(decorationId, { position3D: [x, 0, z] });
        setActiveTool(null);
      }
      return;
    }
    if (activeTool?.type === 'paint') {
      paintTerrain(x, z, activeTool.material);
      return;
    }
    if (activeTool?.type === 'plant') {
      editGoal(activeTool.goalId, { position3D: [x, 0, z] });
      setActiveTool(null);
      return;
    }
    if (unplacedGoals.length === 0) {
      fireToast('No unplaced seeds left in your bag! 🎒');
      return;
    }
    const goal = unplacedGoals[0];
    editGoal(goal.id, { position3D: [x, 0, z] });
    fireToast(`Planted ${goal.title}! 🌱`);
  };

  return (
    <Garden3DErrorBoundary>
      <div className="relative w-full h-full min-h-[400px] rounded-2xl overflow-hidden bg-stone-200">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-3 py-2 rounded-xl bg-stone-800/90 text-white text-sm font-medium shadow-lg">
          Tap the grass to plant a goal! 🌱
        </div>
        <Canvas shadows camera={{ position: [8, 6, 8], fov: 50 }}>
          <SceneErrorBoundary>
            <EnvironmentManager setTimePhase={setTimePhase} />
            <Sky sunPosition={[10, 20, 10]} turbidity={2.2} rayleigh={0.85} />
            <Environment preset="forest" />
            <KeyboardController />
            <OrbitControlsWithFollowTarget enabled={!uiBlocksCanvas} />
            <FocusCamera focusGoal={focusGoal} />
            <Scene
              placedGoals={placedGoals}
              onPlant={handlePlant}
              onGoalClick={onGoalClick}
              timePhase={timePhase}
              activeTool={activeTool}
              waterGoal={waterGoal}
              fireToast={fireToast}
              setActiveTool={setActiveTool}
              decorations={decorations}
              canvasInteractionDisabled={uiBlocksCanvas}
              campfirePositions={campfirePositions}
            />
            {onOpenShop && (
          <group>
            <ShopStand
              position={[8, 0, -8]}
              onClick={(e) => {
                e.stopPropagation();
                onOpenShop();
              }}
              timePhase={timePhase}
            />
            <Suspense fallback={null}>
              <ShopCornerTree />
            </Suspense>
          </group>
            )}
            <Suspense fallback={null}>
              {onOpenJournal && <JournalMonument onClick={onOpenJournal} />}
              {onOpenInsights && <InsightMonolith onClick={onOpenInsights} />}
            </Suspense>
          </SceneErrorBoundary>
        </Canvas>
    </div>
    </Garden3DErrorBoundary>
  );
}
