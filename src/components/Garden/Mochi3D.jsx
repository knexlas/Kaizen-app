import { useRef, useState, useEffect, useContext } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Cone, Html } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import { useGarden } from '../../context/GardenContext';
import { getGoalProgressPercent } from './GardenWalk';
import { LowPerfContext } from './Garden3D';

export default function Mochi3D({ isWalking }) {
  const { goals } = useGarden();
  const lowPerf = useContext(LowPerfContext);
  const shadow = !lowPerf;
  const group = useRef(null);
  const [thought, setThought] = useState(null);
  const [isHappy, setIsHappy] = useState(false);
  const wasWalkingRef = useRef(isWalking);

  useEffect(() => {
    if (isWalking) {
      setThought(null);
      wasWalkingRef.current = true;
      return;
    }
    if (wasWalkingRef.current) {
      wasWalkingRef.current = false;
      if (Math.random() < 0.3) {
        const activeGoals = goals?.filter((g) => {
          const p = getGoalProgressPercent(g);
          return p < 100 && p > 0;
        }) || [];
        const randomGoal = activeGoals.length > 0 ? activeGoals[Math.floor(Math.random() * activeGoals.length)] : null;
        const thoughts = [
          "It's so peaceful out here... 🍃",
          "Don't forget to drink water! 💧",
          "I'm so proud of you! ✨",
        ];
        if (randomGoal) {
          thoughts.push(`I see you working hard on '${randomGoal.title}'! 🚀`);
          thoughts.push(`'${randomGoal.title}' is growing so beautifully! 🌱`);
        }
        const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];
        setThought(randomThought);
        const t = setTimeout(() => setThought(null), 4000);
        return () => clearTimeout(t);
      }
    }
  }, [isWalking, goals]);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const jump = isHappy ? Math.abs(Math.sin(state.clock.elapsedTime * 15)) * 0.3 : 0;
    group.current.position.y = Math.sin(t * 2) * 0.1 + jump;
    if (isWalking) {
      group.current.rotation.z = Math.sin(t * 4) * 0.08;
    }
  });

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        setIsHappy(true);
        setThought('Hehe! 💖');
        setTimeout(() => setIsHappy(false), 2000);
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <Sphere args={[0.5, 32, 32]} castShadow={shadow}>
        <meshStandardMaterial color="#ffffff" roughness={0.2} />
      </Sphere>
      <Sphere args={[0.06, 16, 16]} position={[-0.18, 0.1, 0.45]}>
        <meshBasicMaterial color="#2d2d2d" />
      </Sphere>
      <Sphere args={[0.06, 16, 16]} position={[0.18, 0.1, 0.45]}>
        <meshBasicMaterial color="#2d2d2d" />
      </Sphere>
      <Sphere args={[0.08, 16, 16]} position={[-0.3, -0.05, 0.4]}>
        <meshBasicMaterial color="#ffb7b2" opacity={0.6} transparent />
      </Sphere>
      <Sphere args={[0.08, 16, 16]} position={[0.3, -0.05, 0.4]}>
        <meshBasicMaterial color="#ffb7b2" opacity={0.6} transparent />
      </Sphere>
      <Cone args={[0.15, 0.3, 16]} position={[0, 0.55, 0]} rotation={[0, 0, 0.3]}>
        <meshStandardMaterial color="#8fa967" />
      </Cone>
      <AnimatePresence>
        {thought && (
          <Html position={[0, 1.2, 0]} center zIndexRange={[100, 0]}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="px-3 py-2 bg-white rounded-2xl shadow-xl border-2 border-stone-200 text-sm font-serif text-stone-800 whitespace-nowrap animate-bounce-slight relative"
            >
              {thought}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white" />
            </motion.div>
          </Html>
        )}
        {isHappy && (
          <Html position={[0, 1.8, 0]} center className="pointer-events-none">
            <div className="text-2xl animate-bounce text-rose-500 drop-shadow-md">❤️</div>
          </Html>
        )}
      </AnimatePresence>
      {/* Watering Can */}
      <group position={[0.4, -0.05, 0.45]} rotation={[0, -0.4, -0.2]}>
        {/* Can Body */}
        <mesh castShadow={shadow}>
          <cylinderGeometry args={[0.12, 0.12, 0.2, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.3} />
        </mesh>
        {/* Spout */}
        <mesh position={[0.15, -0.02, 0]} rotation={[0, 0, -1.2]} castShadow={shadow}>
          <cylinderGeometry args={[0.02, 0.04, 0.2, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.3} />
        </mesh>
        {/* Handle */}
        <mesh position={[-0.1, 0.05, 0]} castShadow={shadow}>
          <torusGeometry args={[0.06, 0.02, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}
