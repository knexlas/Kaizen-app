import { useRef, useState, useMemo, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Cylinder, MeshTransmissionMaterial, Sparkles } from '@react-three/drei';
import { useGarden } from '../../context/GardenContext';
import DynamicSpirit3D from './DynamicSpirit3D';
import { MotionPausedContext } from './Garden3D';

/** Map context spirit type to DynamicSpirit3D form (same as Garden3D). */
function spiritTypeToForm(spiritConfig, userSettings, propForm) {
  const form = userSettings?.spirit?.form ?? spiritConfig?.type ?? propForm ?? 'mochi';
  const t = String(form).toLowerCase();
  if (t === 'ember') return 'flame';
  if (t === 'nimbus') return 'cloud';
  if (t === 'custom') return 'guide';
  return t || 'mochi';
}

const FRAME_COLOR = '#3d4d3a'; // dark wood / moss green
const GLASS_ROUGHNESS = 0.2;
const GLASS_THICKNESS = 0.15;

/** Low-perf fallback: standard transparent material to save mobile battery. */
function GlassMaterial({ lowPerf }) {
  if (lowPerf) {
    return <meshStandardMaterial color="#e8f0e8" transparent opacity={0.55} roughness={0.4} />;
  }
  return (
    <MeshTransmissionMaterial
      backside
      samples={4}
      thickness={GLASS_THICKNESS}
      chromaticAberration={0.02}
      anisotropy={0.1}
      distortion={0}
      distortionScale={0}
      temporalDistortion={0}
      ior={1.2}
      transmission={1}
      roughness={GLASS_ROUGHNESS}
      color="#e8f0e8"
    />
  );
}

/** Stylized glass greenhouse: rectangular base, pitched roof, frosted glass, dark frame. */
export default function Greenhouse3D({ form: formProp, position = [0, 0, 0], onClick, lowPerf = false }) {
  const groupRef = useRef(null);
  const spiritRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const { spiritConfig, userSettings } = useGarden();
  const motionPaused = useContext(MotionPausedContext);
  const effectiveForm = useMemo(
    () => spiritTypeToForm(spiritConfig, userSettings, formProp),
    [spiritConfig, userSettings, formProp]
  );

  // Compound animation: bobbing + scanning rotation so the spirit looks like it's tending the plants
  useFrame((state) => {
    if (!spiritRef.current || motionPaused) return;
    const t = state.clock.elapsedTime;
    spiritRef.current.position.y = 0.35 + Math.sin(t * 2) * 0.05;
    spiritRef.current.rotation.y = Math.sin(t * 0.5) * 0.15;
  });

  const handlePointerOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const handleClick = (e) => {
    e.stopPropagation();
    onClick?.(e);
  };

  return (
    <group ref={groupRef} position={position} onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
      {/* Base frame (rectangular) */}
      <Box args={[1.6, 0.12, 1.2]} position={[0, 0.06, 0]}>
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.85} />
      </Box>

      {/* Corner posts */}
      {[[-0.7, 0.5], [0.7, 0.5], [-0.7, -0.5], [0.7, -0.5]].map(([x, z], i) => (
        <Cylinder key={i} args={[0.04, 0.04, 0.88]} position={[x, 0.5, z]}>
          <meshStandardMaterial color={FRAME_COLOR} roughness={0.85} />
        </Cylinder>
      ))}

      {/* Horizontal frame rails (front/back, left/right) */}
      <Box args={[1.6, 0.04, 0.06]} position={[0, 0.44, -0.53]}>
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.85} />
      </Box>
      <Box args={[1.6, 0.04, 0.06]} position={[0, 0.44, 0.53]}>
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.85} />
      </Box>
      <Box args={[0.06, 0.04, 1.12]} position={[-0.77, 0.44, 0]}>
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.85} />
      </Box>
      <Box args={[0.06, 0.04, 1.12]} position={[0.77, 0.44, 0]}>
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.85} />
      </Box>

      {/* Glass walls (frosted); use standard transparent material when lowPerf */}
      <Box args={[1.52, 0.72, 0.04]} position={[0, 0.5, -0.56]}>
        <GlassMaterial lowPerf={lowPerf} />
      </Box>
      <Box args={[1.52, 0.72, 0.04]} position={[0, 0.5, 0.56]}>
        <GlassMaterial lowPerf={lowPerf} />
      </Box>
      <Box args={[0.04, 0.72, 1.12]} position={[-0.74, 0.5, 0]}>
        <GlassMaterial lowPerf={lowPerf} />
      </Box>
      <Box args={[0.04, 0.72, 1.12]} position={[0.74, 0.5, 0]}>
        <GlassMaterial lowPerf={lowPerf} />
      </Box>

      {/* Pitched roof (two panels) */}
      <Box args={[1.68, 0.04, 0.75]} position={[-0.35, 0.92, 0]} rotation={[0, 0, Math.PI * 0.5 - 0.32]}>
        <GlassMaterial lowPerf={lowPerf} />
      </Box>
      <Box args={[1.68, 0.04, 0.75]} position={[0.35, 0.92, 0]} rotation={[0, 0, -Math.PI * 0.5 + 0.32]}>
        <GlassMaterial lowPerf={lowPerf} />
      </Box>
      {/* Roof ridge frame */}
      <Box args={[0.06, 0.06, 1.16]} position={[0, 1.08, 0]}>
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.85} />
      </Box>

      {/* 3 tiny plant sprouts inside (incubating habits) */}
      <mesh position={[-0.35, 0.18, -0.2]}>
        <coneGeometry args={[0.08, 0.22, 8]} />
        <meshStandardMaterial color="#4a7c4a" roughness={0.9} />
      </mesh>
      <mesh position={[0.1, 0.2, 0.15]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#5a8f5a" roughness={0.9} />
      </mesh>
      <mesh position={[0.4, 0.16, -0.15]}>
        <coneGeometry args={[0.06, 0.18, 8]} />
        <meshStandardMaterial color="#3d6b3d" roughness={0.9} />
      </mesh>

      {/* Golden pointLight inside when hovered */}
      {hovered && (
        <pointLight position={[0, 0.5, 0]} color="#fef08a" intensity={1.2} distance={2} />
      )}

      {/* Spirit next to greenhouse: bobbing + scanning animation + watering Sparkles */}
      <group ref={spiritRef} position={[1.05, 0.35, 0]} scale={0.6}>
        <DynamicSpirit3D form={effectiveForm} />
        {/* Magical watering/nurturing particles drifting down toward the plants */}
        {!lowPerf && (
          <group position={[0, -0.15, 0.4]}>
            <Sparkles
              count={15}
              speed={0.4}
              size={1.5}
              color="#60a5fa"
              scale={[1.2, 1, 1.2]}
            />
          </group>
        )}
      </group>
    </group>
  );
}
