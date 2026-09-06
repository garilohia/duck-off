import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PAL } from '../palette';
import { laneX } from '../items';
import { place, zFor } from './river';
import type { ItemEffect, RaceItem, RaceFeature } from '../module_bindings/types';
const ROCK = '#aeb6c4',
  ROCK_DARK = '#8e97a8',
  LOG = '#8a5a30',
  LOG_END = '#c9925a';
// A heater shield: flat top, sides sweeping to a point.
function heater(w: number, h: number) {
  const sh = new THREE.Shape();
  sh.moveTo(-w, h);
  sh.lineTo(w, h);
  sh.bezierCurveTo(w, h * 0.2, w * 0.55, -h * 0.55, 0, -h);
  sh.bezierCurveTo(-w * 0.55, -h * 0.55, -w, h * 0.2, -w, h);
  return sh;
}
const shieldGeometry = new THREE.ExtrudeGeometry(heater(0.62, 0.72), {
  depth: 0.14,
  bevelEnabled: true,
  bevelSize: 0.04,
  bevelThickness: 0.04,
  bevelSegments: 2,
});
const shieldRimGeometry = new THREE.ExtrudeGeometry(heater(0.72, 0.82), { depth: 0.08, bevelEnabled: false });
const RAPID_OFFSETS = [
  [-1.4, 0],
  [1.2, 3.5],
  [-0.3, 7],
  [1.5, -3.2],
  [-1.6, -6.4],
  [0.4, -1.5],
];
// Floating toys sit on a foam ring and show exactly what you will pick up.
function Toy({ item }: { item: string }) {
  return (
    <group scale={1.3}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.72, 0]}>
        <ringGeometry args={[0.7, 1.05, 28]} />
        <meshBasicMaterial color={PAL.foam} transparent opacity={0.75} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.7, 0]}>
        <ringGeometry args={[1.15, 1.3, 28]} />
        <meshBasicMaterial
          color={item === 'bomb' ? PAL.pink : item === 'turbo' ? PAL.yellow : '#a6dfff'}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      {item === 'bomb' && (
        <>
          <mesh>
            <sphereGeometry args={[0.62, 18, 14]} />
            <meshPhysicalMaterial color={PAL.navy} roughness={0.25} clearcoat={0.6} />
          </mesh>
          <mesh position={[0, 0.62, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 0.16, 10]} />
            <meshStandardMaterial color="#5b6b82" />
          </mesh>
          <mesh position={[0.12, 0.86, 0]} rotation={[0, 0, -0.4]}>
            <cylinderGeometry args={[0.045, 0.045, 0.4, 6]} />
            <meshBasicMaterial color={PAL.pink} />
          </mesh>
          <mesh position={[0.24, 1.05, 0]}>
            <octahedronGeometry args={[0.14]} />
            <meshBasicMaterial color={PAL.yellow} />
          </mesh>
          <mesh position={[-0.22, 0.2, -0.5]} scale={[0.16, 0.1, 0.05]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
          </mesh>
        </>
      )}
      {item === 'bubble' && (
        <>
          <mesh>
            <sphereGeometry args={[0.72, 20, 14]} />
            <meshPhysicalMaterial color="#bfe6ff" transparent opacity={0.5} roughness={0.05} clearcoat={1} depthWrite={false} />
          </mesh>
          <mesh position={[-0.25, 0.28, -0.5]} scale={[0.16, 0.1, 0.06]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
          </mesh>
          <mesh position={[0.42, 0.5, -0.1]}>
            <sphereGeometry args={[0.18, 10, 8]} />
            <meshPhysicalMaterial color="#bfe6ff" transparent opacity={0.5} roughness={0.05} depthWrite={false} />
          </mesh>
          <mesh position={[0.3, -0.42, 0.42]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshPhysicalMaterial color="#bfe6ff" transparent opacity={0.5} roughness={0.05} depthWrite={false} />
          </mesh>
        </>
      )}
      {item === 'turbo' && (
        <group rotation={[0.2, 0, -0.25]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.34, 1.1, 14]} />
            <meshPhysicalMaterial color={PAL.paper} roughness={0.3} clearcoat={0.5} />
          </mesh>
          <mesh position={[0, 0.8, 0]}>
            <coneGeometry args={[0.32, 0.5, 14]} />
            <meshStandardMaterial color={PAL.pink} />
          </mesh>
          <mesh position={[0, 0.1, 0.3]}>
            <circleGeometry args={[0.13, 12]} />
            <meshBasicMaterial color={PAL.deep} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.sin(i * 2.1) * 0.34, -0.5, Math.cos(i * 2.1) * 0.34]} rotation={[0, i * 2.1, 0]}>
              <boxGeometry args={[0.06, 0.42, 0.3]} />
              <meshStandardMaterial color={PAL.pink} />
            </mesh>
          ))}
          <mesh position={[0, -0.78, 0]}>
            <coneGeometry args={[0.2, 0.35, 10]} />
            <meshBasicMaterial color={PAL.yellow} />
          </mesh>
        </group>
      )}
      {item === 'shield' && (
        <group rotation={[0, 0, 0.15]}>
          <mesh geometry={shieldGeometry} position={[0, -0.55, -0.08]}>
            <meshPhysicalMaterial color={PAL.deep} roughness={0.3} clearcoat={0.7} />
          </mesh>
          <mesh geometry={shieldRimGeometry} position={[0, -0.55, -0.1]}>
            <meshStandardMaterial color={PAL.yellow} />
          </mesh>
          <mesh position={[0, -0.05, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.08, 5]} />
            <meshStandardMaterial color={PAL.yellow} emissive={PAL.yellow} emissiveIntensity={0.25} />
          </mesh>
        </group>
      )}
    </group>
  );
}
/** The river's buoys, rocks and logs for this race, one per lane spot. */
export function Features({ features }: { features: readonly RaceFeature[] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.children.forEach((node, i) => {
      const kind = node.userData.kind as string,
        heading = node.userData.heading as number;
      node.position.y =
        (kind === 'buoy' ? 1.0 : kind === 'log' ? 0.05 : 0) +
        Math.sin(t * 2 + i) * (kind === 'buoy' ? 0.14 : kind === 'rapids' ? 0 : kind === 'trap' ? 0.15 : 0.06);
      if (kind === 'buoy') {
        node.rotation.y = t * 0.9 + i;
        node.rotation.z = Math.sin(t * 1.6 + i) * 0.08;
      } else if (kind === 'log') node.rotation.z = Math.sin(t * 1.3 + i) * 0.06;
      else if (kind === 'whirlpool') {
        node.rotation.y = heading;
        node.children.forEach((part) => {
          if (part.userData.swirl) part.rotation.z = -t * 2.8;
          else if (part.userData.foam) part.rotation.y = -t * 2.2;
        });
        node.scale.setScalar(1 + Math.sin(t * 2.4) * 0.04);
      } else if (kind === 'rapids') {
        node.rotation.y = heading;
        node.children.forEach((streak, j) => {
          if (j === 0) return;
          const [ox, oz] = RAPID_OFFSETS[(j - 1) % RAPID_OFFSETS.length];
          streak.position.set(ox, 0.12 + Math.sin(t * 9 + j) * 0.05, ((oz - t * 7 + 100) % 14) - 7);
        });
      }
    });
  });
  return (
    <group ref={ref}>
      {features.map((f, i) => {
        const p = place(laneX(f.lane), zFor(f.pos));
        return (
          <group
            key={f.id.toString()}
            position={[p.x, 0, p.z]}
            rotation={[0, p.heading, 0]}
            userData={{ kind: f.kind, heading: p.heading }}
          >
            {f.kind === 'buoy' && <Toy item={f.item} />}
            {f.kind === 'rock' && (
              <>
                <mesh position={[0, 0.25, 0]} scale={[1.25, 0.85, 1.05]}>
                  <sphereGeometry args={[1, 9, 7]} />
                  <meshStandardMaterial color={ROCK} roughness={0.95} flatShading />
                </mesh>
                <mesh position={[0.8, 0.1, 0.5]} scale={[0.6, 0.45, 0.55]} rotation={[0, i, 0]}>
                  <sphereGeometry args={[1, 7, 6]} />
                  <meshStandardMaterial color={ROCK_DARK} roughness={0.95} flatShading />
                </mesh>
                <mesh position={[-0.75, 0.05, -0.4]} scale={[0.5, 0.35, 0.5]}>
                  <sphereGeometry args={[1, 7, 6]} />
                  <meshStandardMaterial color={ROCK_DARK} roughness={0.95} flatShading />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                  <ringGeometry args={[1.3, 1.6, 24]} />
                  <meshBasicMaterial color={PAL.foam} transparent opacity={0.5} depthWrite={false} />
                </mesh>
              </>
            )}
            {f.kind === 'rapids' && (
              <>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
                  <planeGeometry args={[4.4, 14]} />
                  <meshBasicMaterial color={PAL.foam} transparent opacity={0.28} depthWrite={false} />
                </mesh>
                {RAPID_OFFSETS.map((_, j) => (
                  <mesh key={j} scale={[0.28, 0.12, 1.3]}>
                    <sphereGeometry args={[1, 7, 5]} />
                    <meshBasicMaterial color="#ffffff" />
                  </mesh>
                ))}
              </>
            )}
            {f.kind === 'trap' && (
              <>
                <mesh position={[0, 0.7, 0]}>
                  <sphereGeometry args={[0.75, 16, 12]} />
                  <meshPhysicalMaterial color="#a6dfff" transparent opacity={0.55} roughness={0.05} depthWrite={false} />
                </mesh>
                <mesh position={[-0.22, 0.95, -0.4]}>
                  <sphereGeometry args={[0.14, 8, 6]} />
                  <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
                </mesh>
              </>
            )}
            {f.kind === 'whirlpool' && (
              <>
                <mesh position={[0, -0.75, 0]} rotation={[Math.PI, 0, 0]}>
                  <coneGeometry args={[1.75, 1.5, 28, 1, true]} />
                  <meshBasicMaterial color="#0a2451" side={THREE.DoubleSide} transparent opacity={0.9} depthWrite={false} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                  <ringGeometry args={[1.7, 2.2, 40]} />
                  <meshBasicMaterial color="#1d5aa6" transparent opacity={0.45} depthWrite={false} />
                </mesh>
                <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} userData={{ swirl: true }}>
                  {[0, 1, 2, 3, 4].map((j) => (
                    <mesh key={j} rotation={[0, 0, j * 1.26]} position={[0, 0, -j * 0.05]}>
                      <torusGeometry args={[0.45 + j * 0.32, 0.07 + j * 0.015, 6, 24, 2.6]} />
                      <meshBasicMaterial
                        color={j % 2 ? PAL.foam : '#7fb9ff'}
                        transparent
                        opacity={0.85 - j * 0.1}
                        depthWrite={false}
                      />
                    </mesh>
                  ))}
                </group>
                <group position={[0, 0.12, 0]} userData={{ foam: true }}>
                  {[0, 1, 2, 3, 4, 5].map((j) => (
                    <mesh
                      key={j}
                      position={[Math.cos(j * 1.05) * (1.4 + (j % 2) * 0.3), 0, Math.sin(j * 1.05) * (1.4 + (j % 2) * 0.3)]}
                      scale={[0.16, 0.08, 0.16]}
                    >
                      <sphereGeometry args={[1, 7, 5]} />
                      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
                    </mesh>
                  ))}
                </group>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
                  <circleGeometry args={[0.42, 20]} />
                  <meshBasicMaterial color="#061a3d" />
                </mesh>
              </>
            )}
            {f.kind === 'log' && (
              <>
                <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.3, 0]}>
                  <cylinderGeometry args={[0.42, 0.42, 3.4, 10]} />
                  <meshStandardMaterial color={LOG} roughness={0.9} />
                </mesh>
                {[-1, 1].map((s) => (
                  <mesh key={s} rotation={[0, 0, Math.PI / 2]} position={[s * 1.71, 0.3, 0]}>
                    <cylinderGeometry args={[0.34, 0.34, 0.06, 10]} />
                    <meshStandardMaterial color={LOG_END} roughness={0.9} />
                  </mesh>
                ))}
                <mesh position={[0.5, 0.62, 0.1]} scale={[0.16, 0.22, 0.16]}>
                  <sphereGeometry args={[1, 6, 5]} />
                  <meshStandardMaterial color="#63c27a" />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[1.9, 1, 1]}>
                  <ringGeometry args={[1.05, 1.3, 24]} />
                  <meshBasicMaterial color={PAL.foam} transparent opacity={0.45} depthWrite={false} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function DuckAura({ item }: { item?: RaceItem }) {
  if (!item) return null;
  return (
    <>
      {item.shieldTicks > 0 && (
        <mesh position={[0, 1.1, 0]} scale={[1.15, 1.2, 1.25]}>
          <sphereGeometry args={[1.25, 20, 14]} />
          <meshPhysicalMaterial color="#a6cfff" transparent opacity={0.22} roughness={0.08} metalness={0.1} depthWrite={false} />
        </mesh>
      )}
      {item.slowTicks > 0 && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.4, 32]} />
          <meshBasicMaterial color={PAL.pink} transparent opacity={0.8} depthWrite={false} />
        </mesh>
      )}
      {item.turboTicks > 0 &&
        [1.5, 2.3, 3.1].map((z, i) => (
          <mesh key={z} position={[0, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.7, 1]}>
            <ringGeometry args={[0.8 + i * 0.2, 0.96 + i * 0.2, 24]} />
            <meshBasicMaterial color={PAL.yellow} transparent opacity={0.75 - i * 0.18} depthWrite={false} />
          </mesh>
        ))}
    </>
  );
}

export function FlyingItem({
  effect,
  sourceX,
  targetX,
  targetPos,
}: {
  effect: ItemEffect;
  sourceX: number;
  targetX: number;
  targetPos: number;
}) {
  const projectile = useRef<THREE.Group>(null),
    burst = useRef<THREE.Mesh>(null),
    age = useRef((6 - effect.flightTicks) / 10);
  useFrame((_, dt) => {
    age.current = Math.max((6 - effect.flightTicks) / 10, age.current + dt);
    const t = Math.min(1, age.current / 0.6);
    const from = place(sourceX, zFor(effect.sourcePos)),
      to = place(targetX, zFor(targetPos));
    if (projectile.current) {
      projectile.current.visible = effect.flightTicks > 0;
      projectile.current.position.set(
        THREE.MathUtils.lerp(from.x, to.x, t),
        1.2 + Math.sin(t * Math.PI) * (effect.kind === 'bomb' ? 5 : 2),
        THREE.MathUtils.lerp(from.z, to.z, t),
      );
      projectile.current.rotation.z += dt * 4;
    }
    if (burst.current) {
      burst.current.visible = effect.flightTicks === 0;
      burst.current.position.set(to.x, 0.2, to.z);
      const fade = 1 - effect.lifeTicks / 12;
      burst.current.scale.setScalar(1 + Math.max(0, fade) * 4);
      (burst.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, effect.lifeTicks / 12) * 0.8;
    }
  });
  return (
    <>
      <group ref={projectile}>
        <mesh>
          <sphereGeometry args={[effect.kind === 'bomb' ? 0.45 : 0.65, 16, 12]} />
          <meshStandardMaterial
            color={effect.kind === 'bomb' ? PAL.navy : '#a6dfff'}
            roughness={0.15}
            transparent
            opacity={effect.kind === 'bomb' ? 1 : 0.7}
          />
        </mesh>
        {effect.kind === 'bomb' && (
          <>
            <mesh position={[0, 0.5, 0]} rotation={[0, 0, -0.3]}>
              <cylinderGeometry args={[0.045, 0.045, 0.28, 6]} />
              <meshBasicMaterial color={PAL.pink} />
            </mesh>
            <mesh position={[0.05, 0.68, 0]}>
              <octahedronGeometry args={[0.12]} />
              <meshBasicMaterial color={PAL.yellow} />
            </mesh>
          </>
        )}
      </group>
      <mesh ref={burst} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 1.1, 32]} />
        <meshBasicMaterial
          color={effect.blocked ? PAL.yellow : effect.kind === 'bomb' ? PAL.pink : PAL.foam}
          transparent
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
