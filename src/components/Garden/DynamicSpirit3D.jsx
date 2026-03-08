import { useRef, useMemo, useEffect, useContext, Component } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles, Float } from '@react-three/drei';
import { AdditiveBlending, CanvasTexture } from 'three';
import { LowPerfContext, MotionPausedContext } from './Garden3D';
import AnimatedModel from './AnimatedModel';
import Mochi3D from './Mochi3D';
import Owl3D from './Owl3D';
import Rabbit3D from './Rabbit3D';
import Frog3D from './Frog3D';
import Butterfly3D from './Butterfly3D';

function FlameSpirit({ lowPerf, motionPaused }) {
  const count = lowPerf ? 8 : 36;
  const outerRef = useRef(null);
  const midRef = useRef(null);
  const coreRef = useRef(null);
  const lightRef = useRef(null);
  const flameTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const baseY = canvas.height - 18;
    const tipY = 18;

    const grad = ctx.createLinearGradient(cx, tipY, cx, baseY);
    grad.addColorStop(0, 'rgba(255,190,120,0.9)');
    grad.addColorStop(0.25, 'rgba(255,150,70,0.88)');
    grad.addColorStop(0.6, 'rgba(238,105,32,0.8)');
    grad.addColorStop(1, 'rgba(160,50,0,0)');

    ctx.beginPath();
    ctx.moveTo(cx, tipY);
    ctx.bezierCurveTo(cx + 40, 55, cx + 56, 125, cx + 24, baseY);
    ctx.bezierCurveTo(cx + 12, baseY + 14, cx - 12, baseY + 14, cx - 24, baseY);
    ctx.bezierCurveTo(cx - 56, 125, cx - 40, 55, cx, tipY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    const coreGrad = ctx.createLinearGradient(cx, 44, cx, baseY);
    coreGrad.addColorStop(0, 'rgba(255,205,145,0.9)');
    coreGrad.addColorStop(0.5, 'rgba(255,165,95,0.82)');
    coreGrad.addColorStop(1, 'rgba(255,120,70,0)');
    ctx.beginPath();
    ctx.moveTo(cx, 44);
    ctx.bezierCurveTo(cx + 16, 72, cx + 19, 125, cx + 8, baseY - 16);
    ctx.bezierCurveTo(cx + 4, baseY - 7, cx - 4, baseY - 7, cx - 8, baseY - 16);
    ctx.bezierCurveTo(cx - 19, 125, cx - 16, 72, cx, 44);
    ctx.closePath();
    ctx.fillStyle = coreGrad;
    ctx.fill();

    const tex = new CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => () => flameTexture?.dispose(), [flameTexture]);

  useFrame((state) => {
    if (motionPaused) return;
    const t = state.clock.getElapsedTime();
    const flickerA = Math.sin(t * 11) * 0.08;
    const flickerB = Math.sin(t * 17 + 1.2) * 0.06;
    const flickerC = Math.sin(t * 9.5 + 0.5) * 0.05;
    const stretch = 1 + Math.sin(t * 6.5) * 0.1;

    if (outerRef.current) {
      outerRef.current.scale.y = (1.2 + flickerA) * stretch;
      outerRef.current.scale.x = 0.78 + flickerB;
      outerRef.current.position.x = Math.sin(t * 3.5) * 0.02;
      outerRef.current.position.y = 0.28 + Math.sin(t * 4) * 0.015;
    }
    if (midRef.current) {
      midRef.current.scale.y = 0.98 + flickerB;
      midRef.current.scale.x = 0.62 + flickerC * 0.8;
      midRef.current.position.x = Math.sin(t * 4.6 + 0.7) * 0.016;
      midRef.current.position.y = 0.26 + Math.sin(t * 5.1 + 0.4) * 0.014;
    }
    if (coreRef.current) {
      coreRef.current.scale.y = 0.73 + flickerC;
      coreRef.current.scale.x = 0.42 + flickerA * 0.5;
      coreRef.current.position.y = 0.23 + Math.sin(t * 8) * 0.01;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 1.9 + Math.sin(t * 13) * 0.35 + Math.sin(t * 6.7 + 0.8) * 0.2;
    }
  });

  return (
    <Float enabled={!motionPaused} speed={1.4} floatIntensity={0.5}>
      <group>
        <sprite ref={outerRef} position={[0, 0.28, 0]} scale={[0.78, 1.2, 1]}>
          <spriteMaterial map={flameTexture} color="#e56a22" transparent opacity={0.78} blending={AdditiveBlending} depthWrite={false} />
        </sprite>
        <sprite ref={midRef} position={[0, 0.26, 0]} scale={[0.62, 0.98, 1]}>
          <spriteMaterial map={flameTexture} color="#d95c1a" transparent opacity={0.72} blending={AdditiveBlending} depthWrite={false} />
        </sprite>
        <sprite ref={coreRef} position={[0, 0.23, 0]} scale={[0.42, 0.73, 1]}>
          <spriteMaterial map={flameTexture} color="#ff9a54" transparent opacity={0.88} blending={AdditiveBlending} depthWrite={false} />
        </sprite>
        <Sparkles count={count} scale={[1.1, 1.5, 1.1]} color="#fde68a" speed={motionPaused ? 0 : (lowPerf ? 1.5 : 2.8)} size={lowPerf ? 2 : 3} />
        <pointLight ref={lightRef} color="#fb923c" intensity={2} distance={4.5} decay={1.8} position={[0, 0.32, 0]} />
      </group>
    </Float>
  );
}

function CloudSpirit({ lowPerf, motionPaused }) {
  const count = lowPerf ? 5 : 20;
  return (
    <Float enabled={!motionPaused} speed={2} floatIntensity={2}>
      <group>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.35, 16, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
        <mesh position={[0.25, 0.1, 0]}>
          <sphereGeometry args={[0.28, 16, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
        <mesh position={[-0.2, 0.05, 0.1]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
        <Sparkles count={count} scale={2} color="#ffffff" opacity={0.5} speed={motionPaused ? 0 : 1} />
      </group>
    </Float>
  );
}

function WispSpirit({ lowPerf, motionPaused }) {
  const count = lowPerf ? 5 : 40;
  return (
    <Float enabled={!motionPaused} speed={3} floatIntensity={1.5}>
      <mesh>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial color="#c084fc" emissive="#818cf8" emissiveIntensity={2} transparent opacity={0.8} />
      </mesh>
      <Sparkles count={count} scale={2} color="#e879f9" speed={motionPaused ? 0 : 1.5} size={3} />
      <pointLight color="#c084fc" intensity={2} distance={4} />
    </Float>
  );
}

function CatSpiritFallback({ isWalking }) {
  const motionPaused = useContext(MotionPausedContext);
  const rootRef = useRef(null);
  const headRef = useRef(null);
  const tailRef = useRef(null);
  const earLRef = useRef(null);
  const earRRef = useRef(null);
  const pawLRef = useRef(null);
  const pawRRef = useRef(null);

  useFrame((state) => {
    if (motionPaused) return;
    const t = state.clock.getElapsedTime();
    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(t * 1.9) * 0.01;
      rootRef.current.rotation.y = Math.sin(t * (isWalking ? 4.3 : 2.1)) * (isWalking ? 0.12 : 0.04);
    }
    if (headRef.current) {
      headRef.current.rotation.x = Math.sin(t * 2.3 + 0.7) * 0.035;
      headRef.current.rotation.z = Math.sin(t * 2.1) * 0.025;
    }
    if (tailRef.current) {
      tailRef.current.rotation.z = 1.0 + Math.sin(t * (isWalking ? 6.6 : 3.8)) * 0.24;
    }
    if (earLRef.current) earLRef.current.rotation.z = -0.18 + Math.sin(t * 5.3) * 0.05;
    if (earRRef.current) earRRef.current.rotation.z = 0.18 + Math.sin(t * 5.3 + 0.8) * 0.05;
    if (pawLRef.current && pawRRef.current) {
      pawLRef.current.position.y = 0.1 + Math.sin(t * 4.8 + 0.3) * (isWalking ? 0.008 : 0.0015);
      pawRRef.current.position.y = 0.1 + Math.sin(t * 4.8 + 3.1) * (isWalking ? 0.008 : 0.0015);
    }
  });

  return (
    <Float enabled={!motionPaused} speed={1.1} floatIntensity={0.32}>
      <group ref={rootRef}>
        <mesh position={[0, 0.21, -0.02]}>
          <sphereGeometry args={[0.165, 20, 20]} />
          <meshToonMaterial color="#c4ad92" />
        </mesh>
        <mesh position={[0, 0.31, 0.08]}>
          <sphereGeometry args={[0.14, 20, 20]} />
          <meshToonMaterial color="#ccb59c" />
        </mesh>
        <group ref={headRef} position={[0, 0.52, 0.17]}>
          <mesh>
            <sphereGeometry args={[0.16, 22, 22]} />
            <meshToonMaterial color="#dbc6ae" />
          </mesh>
          <mesh position={[0, -0.04, 0.11]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshToonMaterial color="#f6eee2" />
          </mesh>
          <mesh position={[-0.056, 0.025, 0.121]}>
            <sphereGeometry args={[0.023, 14, 14]} />
            <meshToonMaterial color="#2b3b52" />
          </mesh>
          <mesh position={[0.056, 0.025, 0.121]}>
            <sphereGeometry args={[0.023, 14, 14]} />
            <meshToonMaterial color="#2b3b52" />
          </mesh>
          <mesh position={[-0.053, 0.032, 0.137]}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshToonMaterial color="#f8fbff" />
          </mesh>
          <mesh position={[0.059, 0.032, 0.137]}>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshToonMaterial color="#f8fbff" />
          </mesh>
          <mesh position={[0, -0.005, 0.145]}>
            <sphereGeometry args={[0.011, 10, 10]} />
            <meshToonMaterial color="#7f1d1d" />
          </mesh>
          <mesh position={[0, -0.03, 0.137]}>
            <capsuleGeometry args={[0.004, 0.03, 4, 8]} />
            <meshToonMaterial color="#7f1d1d" />
          </mesh>
          <mesh ref={earLRef} position={[-0.075, 0.13, 0.02]} rotation={[0, 0, -0.22]}>
            <coneGeometry args={[0.06, 0.16, 3]} />
            <meshToonMaterial color="#dbc6ae" />
          </mesh>
          <mesh ref={earRRef} position={[0.075, 0.13, 0.02]} rotation={[0, 0, 0.22]}>
            <coneGeometry args={[0.06, 0.16, 3]} />
            <meshToonMaterial color="#dbc6ae" />
          </mesh>
          <mesh position={[-0.075, 0.13, 0.03]} rotation={[0, 0, -0.22]}>
            <coneGeometry args={[0.03, 0.09, 3]} />
            <meshToonMaterial color="#e8a9a0" />
          </mesh>
          <mesh position={[0.075, 0.13, 0.03]} rotation={[0, 0, 0.22]}>
            <coneGeometry args={[0.03, 0.09, 3]} />
            <meshToonMaterial color="#e8a9a0" />
          </mesh>
        </group>
        <mesh ref={pawLRef} position={[-0.065, 0.095, 0.16]}>
          <sphereGeometry args={[0.052, 14, 14]} />
          <meshToonMaterial color="#f0e5d8" />
        </mesh>
        <mesh ref={pawRRef} position={[0.065, 0.095, 0.16]}>
          <sphereGeometry args={[0.052, 14, 14]} />
          <meshToonMaterial color="#f0e5d8" />
        </mesh>
        <mesh position={[0, 0.29, -0.085]} rotation={[0.2, 0, 0]}>
          <capsuleGeometry args={[0.016, 0.14, 8, 14]} />
          <meshToonMaterial color="#af9478" />
        </mesh>
        <mesh ref={tailRef} position={[-0.15, 0.35, -0.08]} rotation={[0.15, 0.25, 1.02]}>
          <capsuleGeometry args={[0.028, 0.3, 8, 16]} />
          <meshToonMaterial color="#8f755c" />
        </mesh>
        <mesh position={[-0.12, 0.43, 0.015]} rotation={[0.1, 0.1, 1.0]}>
          <capsuleGeometry args={[0.012, 0.08, 6, 10]} />
          <meshToonMaterial color="#a3876b" />
        </mesh>
        <mesh position={[0.12, 0.43, 0.015]} rotation={[0.1, -0.1, -1.0]}>
          <capsuleGeometry args={[0.012, 0.08, 6, 10]} />
          <meshToonMaterial color="#a3876b" />
        </mesh>
      </group>
    </Float>
  );
}

function CatSpiritModel({ isWalking }) {
  // Source: Quaternius "Cat" via Poly Pizza (CC0 1.0)
  return <AnimatedModel path="/models/Cat-Quaternius-CC0-v2.glb" scale={0.3} rotation={[0, Math.PI / 2, 0]} isWalking={isWalking} />;
}

class CatSpiritErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <CatSpiritFallback isWalking={this.props.isWalking} />;
    }
    return this.props.children;
  }
}

function CatSpirit({ isWalking }) {
  return (
    <CatSpiritErrorBoundary isWalking={isWalking}>
      <CatSpiritModel isWalking={isWalking} />
    </CatSpiritErrorBoundary>
  );
}

export default function DynamicSpirit3D({ form, position = [0, 0, 0], isWalking = false }) {
  const lowPerf = useContext(LowPerfContext);
  const motionPaused = useContext(MotionPausedContext);
  const key = form != null && String(form).length > 0 ? String(form).toLowerCase() : 'mochi';

  switch (key) {
    case 'flame':
      return (
        <group position={position}>
          <FlameSpirit lowPerf={lowPerf} motionPaused={motionPaused} />
        </group>
      );
    case 'cloud':
      return (
        <group position={position}>
          <CloudSpirit lowPerf={lowPerf} motionPaused={motionPaused} />
        </group>
      );
    case 'guide':
      return (
        <group position={position} scale={0.8}>
          <Owl3D isWalking={isWalking} />
        </group>
      );
    case 'cat':
      return (
        <group position={position}>
          <CatSpirit isWalking={isWalking} />
        </group>
      );
    case 'rabbit':
      return (
        <group position={position}>
          <Rabbit3D isWalking={isWalking} />
        </group>
      );
    case 'frog':
      return (
        <group position={position}>
          <Frog3D isWalking={isWalking} />
        </group>
      );
    case 'butterfly':
      return (
        <group position={position}>
          <Butterfly3D isWalking={isWalking} />
        </group>
      );
    case 'mochi':
      return <Mochi3D position={position} isWalking={isWalking} />;
    default:
      return (
        <group position={position}>
          <WispSpirit lowPerf={lowPerf} motionPaused={motionPaused} />
        </group>
      );
  }
}
