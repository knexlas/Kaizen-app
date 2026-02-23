import { useMemo, Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Environment, RoundedBox, useGLTF, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useGarden } from '../../context/GardenContext';
import { getGoalProgressPercent } from './GardenWalk';
import WanderingCreature from './WanderingCreature';
import ProceduralFlora from './ProceduralFlora';
import AnimatedModel from './AnimatedModel';
import Mochi3D from './Mochi3D';
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

function OrbitControlsWithFollowTarget() {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));
  useFrame(() => {
    targetRef.current.set(camera.position.x, 0, camera.position.z);
  });
  return (
    <OrbitControls
      makeDefault
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

function Ground({ onClick }) {
  return (
    <RoundedBox
      args={[30, 0.5, 30]}
      radius={0.1}
      position={[0, -0.3, 0]}
      receiveShadow
      onClick={onClick}
    >
      <meshStandardMaterial color="#2d5a27" />
    </RoundedBox>
  );
}

function GoalNode({ goal, onGoalClick, activeTool, waterGoal, fireToast, setActiveTool }) {
  const [hovered, setHovered] = useState(false);
  const scale = hovered ? 1.05 : 1;
  return (
    <group
      position={goal.position3D}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        if (activeTool?.type === 'water') {
          try {
            waterGoal(goal.id);
            if (typeof fireToast === 'function') fireToast('Watered! +5 Embers 💦');
            if (typeof setActiveTool === 'function') setActiveTool(null);
          } catch (err) {
            if (typeof fireToast === 'function') fireToast(err?.message ?? 'No water left');
          }
          return;
        }
        onGoalClick(goal);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <ProceduralFlora goal={goal} isHovered={hovered} />
    </group>
  );
}

function DecorationNode({ decoration }) {
  if (!decoration?.position3D || !Array.isArray(decoration.position3D) || !decoration.model) return null;
  const isOrganic = decoration.id?.startsWith('anim_') || decoration.id?.startsWith('dec_pot') || decoration.id?.startsWith('dec_lily');
  const yRotation = useMemo(() => (isOrganic ? Math.random() * Math.PI * 2 : 0), [isOrganic]);
  return (
    <group position={decoration.position3D}>
      <AnimatedModel
        path={`/models/${decoration.model}`}
        rotation={[0, yRotation, 0]}
        scale={decoration.id?.startsWith('anim_') ? 0.6 : 1}
      />
    </group>
  );
}

function Scene({ placedGoals, onPlant, onGoalClick, timePhase, activeTool, waterGoal, fireToast, setActiveTool, decorations }) {
  return (
    <>
      <TerrainTiles />
      <Ground onClick={onPlant} />
      {decorations?.map((dec) => (
        <DecorationNode key={dec.id} decoration={dec} />
      )) ?? null}
      {placedGoals?.map((goal) => (
        <GoalNode
          key={goal.id}
          goal={goal}
          onGoalClick={onGoalClick}
          activeTool={activeTool}
          waterGoal={waterGoal}
          fireToast={fireToast}
          setActiveTool={setActiveTool}
        />
      )) ?? null}
      <Ecosystem placedGoals={placedGoals} timePhase={timePhase} />
    </>
  );
}

function Ecosystem({ placedGoals, timePhase = 'day' }) {
  const { unlockedAnimals } = useGarden();
  const goalPositions = placedGoals
    ?.map((g) => g.position3D)
    .filter((p) => Array.isArray(p) && p.length >= 3) ?? [];
  const phase = timePhase ?? 'day';

  return (
    <group name="ecosystem">
      {unlockedAnimals?.includes('fish') && (
        <WanderingCreature emoji="🐟" allowedTerrain="water" speed={0.8} zOffset={0.2} scale={0.7} />
      )}
      {unlockedAnimals?.includes('rabbit') && (
        <WanderingCreature
          customComponent={<Rabbit3D isWalking={true} />}
          allowedTerrain="grass"
          speed={2.5}
          jumpHeight={0.6}
          zOffset={0}
          scale={0.8}
        />
      )}
      <WanderingCreature allowedTerrain="water" speed={0.5} zOffset={0} customComponent={<Frog3D />} />
      {phase !== 'night' && (
        <WanderingCreature allowedTerrain="grass" speed={1.5} zOffset={1.5} customComponent={<Butterfly3D />} />
      )}
      {phase === 'night' && (
        <Sparkles count={40} scale={[15, 4, 15]} position={[0, 2, 0]} size={4} speed={0.4} opacity={0.8} color="#fef08a" />
      )}
      <WanderingCreature
        customComponent={<Mochi3D isWalking={true} />}
        allowedTerrain="grass"
        speed={1.2}
        zOffset={0.5}
        scale={0.6}
        goalPositions={goalPositions}
      />
    </group>
  );
}

function ShopCornerTree() {
  const { scene } = useGLTF('/models/tree_pineTallA.glb');
  const cloned = useMemo(() => (scene ? scene.clone() : null), [scene]);
  if (!cloned) return null;
  return <primitive object={cloned} position={[10, 0, -8]} scale={1} />;
}

function fireToast(message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message } }));
  }
}

useGLTF.preload('/models/tree_pineTallA.glb');

export default function Garden3D({ onGoalClick, onOpenShop, focusGoal }) {
  const [timePhase, setTimePhase] = useState('day');
  const { goals, editGoal, activeTool, setActiveTool, paintTerrain, updateDecoration, waterGoal, decorations = [] } = useGarden();
  const placedGoals = goals?.filter((g) => Array.isArray(g.position3D) && g.position3D.length >= 3) ?? [];
  const unplacedGoals = goals?.filter((g) => !g.position3D || !Array.isArray(g.position3D)) ?? [];

  const handlePlant = (e) => {
    e.stopPropagation();
    if (!activeTool) return;
    let { x, z } = e.point;
    x = Math.round(x);
    z = Math.round(z);

    if (activeTool?.type === 'place') {
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
            <Sky sunPosition={[10, 20, 10]} />
            <Environment preset="forest" />
            <KeyboardController />
            <OrbitControlsWithFollowTarget />
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
          </SceneErrorBoundary>
        </Canvas>
    </div>
    </Garden3DErrorBoundary>
  );
}
