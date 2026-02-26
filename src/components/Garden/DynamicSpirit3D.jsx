import { useRef, Component } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles, Float } from '@react-three/drei';
import AnimatedModel from './AnimatedModel';
import Mochi3D from './Mochi3D';
import Owl3D from './Owl3D';
import Rabbit3D from './Rabbit3D';
import Frog3D from './Frog3D';
import Butterfly3D from './Butterfly3D';

function FlameSpirit() {
  return (
    <Float speed={1.5} floatIntensity={0.5}>
      <group>
        <mesh>
          <coneGeometry args={[0.3, 0.8, 16]} />
          <meshStandardMaterial emissive="#ea580c" emissiveIntensity={2} color="#ea580c" />
        </mesh>
        <Sparkles count={30} scale={1.5} color="#fef08a" speed={2} />
      </group>
    </Float>
  );
}

function CloudSpirit() {
  return (
    <Float speed={2} floatIntensity={2}>
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
        <Sparkles count={20} scale={2} color="#ffffff" opacity={0.5} />
      </group>
    </Float>
  );
}

function WispSpirit() {
  return (
    <Float speed={3} floatIntensity={1.5}>
      <mesh>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial color="#c084fc" emissive="#818cf8" emissiveIntensity={2} transparent opacity={0.8} />
      </mesh>
      <Sparkles count={40} scale={2} color="#e879f9" speed={1.5} size={3} />
      <pointLight color="#c084fc" intensity={2} distance={4} />
    </Float>
  );
}

/** Renders Cat model; falls back to Fox if Cat.glb does not exist. */
function CatSpiritInner() {
  return <AnimatedModel path="/models/Cat.glb" scale={0.4} />;
}

class CatSpiritErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <AnimatedModel path="/models/Fox-v6.glb" scale={0.4} />;
    }
    return this.props.children;
  }
}

function CatSpirit() {
  return (
    <CatSpiritErrorBoundary>
      <CatSpiritInner />
    </CatSpiritErrorBoundary>
  );
}

export default function DynamicSpirit3D({ form, position = [0, 0, 0] }) {
  const key = form != null && String(form).length > 0 ? String(form).toLowerCase() : 'mochi';

  switch (key) {
    case 'flame':
      return (
        <group position={position}>
          <FlameSpirit />
        </group>
      );
    case 'cloud':
      return (
        <group position={position}>
          <CloudSpirit />
        </group>
      );
    case 'guide':
      return (
        <group position={position} scale={0.8}>
          <Owl3D />
        </group>
      );
    case 'cat':
      return (
        <group position={position}>
          <CatSpirit />
        </group>
      );
    case 'rabbit':
      return (
        <group position={position}>
          <Rabbit3D />
        </group>
      );
    case 'frog':
      return (
        <group position={position}>
          <Frog3D />
        </group>
      );
    case 'butterfly':
      return (
        <group position={position}>
          <Butterfly3D />
        </group>
      );
    case 'mochi':
      return <Mochi3D position={position} />;
    default:
      return (
        <group position={position}>
          <WispSpirit />
        </group>
      );
  }
}
