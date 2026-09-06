import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PAL, DUCK_COLORS } from '../palette';
type V = [number, number, number];
// Shared by DuckPreview: a pointer drag writes angle/velocity, the duck applies momentum each frame.
export type Spin = { angle: number; velocity: number; dragging: boolean };
const sphere = new THREE.SphereGeometry(1, 24, 16);
const materials = new Map<string, THREE.MeshPhysicalMaterial>();
function material(color: string) {
  if (!materials.has(color))
    materials.set(color, new THREE.MeshPhysicalMaterial({ color, roughness: 0.29, clearcoat: 0.55, clearcoatRoughness: 0.22 }));
  return materials.get(color)!;
}
function Ball({ at, scale, color, rotation = [0, 0, 0] }: { at: V; scale: V; color: string; rotation?: V }) {
  return <mesh position={at} scale={scale} rotation={rotation} geometry={sphere} material={material(color)} />;
}
const SILVER = '#dfe7ef',
  STEEL = '#b8c4d0',
  WOOD = '#8a5a30',
  LEATHER = '#b0743c',
  TOY_BLUE = '#4ea8ff';
export default function Duck3D({
  duckIndex = 0,
  speed = 0,
  taps = 0,
  preview = false,
  spin,
  lean,
}: {
  duckIndex?: number;
  speed?: number;
  taps?: number;
  preview?: boolean;
  spin?: RefObject<Spin>;
  lean?: RefObject<number>;
}) {
  const group = useRef<THREE.Group>(null),
    eyes = useRef<THREE.Group>(null),
    wingL = useRef<THREE.Group>(null),
    wingR = useRef<THREE.Group>(null);
  const last = useRef(taps),
    hop = useRef(0),
    roll = useRef(0),
    pace = useRef(0),
    color = DUCK_COLORS[duckIndex] ?? DUCK_COLORS[0];
  useFrame(({ clock }, dt) => {
    const time = clock.elapsedTime;
    // Taps give a soft hop that blends into the last one instead of restarting it; pace eases toward the real speed.
    if (last.current !== taps) {
      last.current = taps;
      hop.current = Math.min(1, hop.current * 0.4 + 0.75);
    }
    hop.current = Math.max(0, hop.current - dt * 3.2);
    pace.current = THREE.MathUtils.damp(pace.current, speed, 6, dt);
    roll.current = THREE.MathUtils.damp(roll.current, lean?.current ?? 0, 8, dt);
    let twirl = 0;
    if (spin?.current) {
      const s = spin.current;
      if (!s.dragging) {
        s.angle += s.velocity * dt;
        s.velocity *= Math.exp(-2.6 * dt);
        if (Math.abs(s.velocity) < 0.02) s.velocity = 0;
      }
      twirl = s.angle;
    }
    if (group.current) {
      const bob = 1 + pace.current / 260;
      group.current.position.y = 0.1 + Math.sin(time * 2.4 * bob + duckIndex) * 0.045 + Math.sin(hop.current * Math.PI) * 0.15;
      group.current.rotation.z = Math.sin(time * 3 + duckIndex) * (0.025 + pace.current * 0.00015) + roll.current;
      group.current.rotation.x = -pace.current * 0.0009 - hop.current * 0.05;
      group.current.rotation.y = (preview ? -0.12 : 0) + Math.sin(time * 1.7) * 0.055 + twirl;
      group.current.scale.set(1 + hop.current * 0.05, 1 - hop.current * 0.04, 1 + hop.current * 0.05);
    }
    if (eyes.current) eyes.current.scale.y = (time + duckIndex * 0.43) % 4.8 < 0.13 ? 0.08 : 1;
    const flap = Math.sin(time * (6 + pace.current * 0.03)) * (0.06 + pace.current * 0.0004);
    if (wingL.current) wingL.current.rotation.z = -0.15 - flap - hop.current * 0.3;
    if (wingR.current) wingR.current.rotation.z = 0.15 + flap + hop.current * 0.3;
  });
  return (
    <group ref={group}>
      <Ball at={[0, 0.6, 0.13]} scale={[0.89, 0.68, 1.0]} color={color} />
      <Ball at={[0, 1.4, -0.47]} scale={[0.83, 0.78, 0.75]} color={color} />
      <Ball at={[0, 0.54, -0.57]} scale={[0.6, 0.4, 0.26]} color={color} />
      <Ball at={[0, 1.115, -1.2]} scale={[0.29, 0.11, 0.24]} color="#e96b0e" />
      <Ball at={[0, 1.175, -1.29]} scale={[0.285, 0.033, 0.19]} color="#a94a14" />
      <Ball at={[0, 1.255, -1.23]} scale={[0.34, 0.125, 0.27]} color={PAL.beak} />
      <Ball at={[-0.49, 1.26, -1.075]} scale={[0.14, 0.075, 0.035]} color="#f79763" />
      <Ball at={[0.49, 1.26, -1.075]} scale={[0.14, 0.075, 0.035]} color="#f79763" />
      <group position={[0, 1.49, 0]} ref={eyes}>
        {[-1, 1].map((s) => (
          <group key={s}>
            <Ball at={[s * 0.355, 0, -1.155]} scale={[0.145, 0.175, 0.08]} color="#152333" />
            <Ball at={[s * 0.355 - 0.04, 0.059, -1.227]} scale={[0.043, 0.05, 0.013]} color="#ffffff" />
            <Ball at={[s * 0.355 + 0.042, -0.051, -1.226]} scale={[0.02, 0.023, 0.01]} color="#c8eeff" />
          </group>
        ))}
      </group>
      <group position={[-0.72, 0.65, 0.12]} ref={wingL}>
        <Ball at={[-0.06, 0, 0]} scale={[0.22, 0.33, 0.55]} color={color} />
      </group>
      <group position={[0.72, 0.65, 0.12]} ref={wingR}>
        <Ball at={[0.06, 0, 0]} scale={[0.22, 0.33, 0.55]} color={color} />
        {/* Chef Nibbles tucks a rounded little cake knife under the wing, blade forward. */}
        {duckIndex === 8 && (
          <group position={[0.2, 0.06, -0.42]}>
            <Ball at={[0, 0, 0.28]} scale={[0.06, 0.075, 0.17]} color={WOOD} />
            <Ball at={[0, 0, 0.1]} scale={[0.075, 0.11, 0.035]} color={STEEL} />
            <Ball at={[0, 0.02, -0.22]} scale={[0.03, 0.1, 0.36]} color={SILVER} />
            <Ball at={[0, 0.05, -0.5]} scale={[0.028, 0.075, 0.12]} color={SILVER} />
          </group>
        )}
        {/* Deputy Dumpling keeps a toy water pistol at the ready. */}
        {duckIndex === 9 && (
          <group position={[0.24, 0.04, -0.28]}>
            <mesh position={[0, 0.02, -0.02]} material={material(PAL.pink)}>
              <boxGeometry args={[0.13, 0.17, 0.3]} />
            </mesh>
            <mesh position={[0, 0.08, -0.34]} rotation={[Math.PI / 2, 0, 0]} material={material(TOY_BLUE)}>
              <cylinderGeometry args={[0.055, 0.065, 0.36, 12]} />
            </mesh>
            <Ball at={[0, 0.08, -0.53]} scale={[0.06, 0.06, 0.04]} color={PAL.beak} />
            <mesh position={[0, -0.14, 0.06]} rotation={[0.35, 0, 0]} material={material(PAL.pink)}>
              <boxGeometry args={[0.11, 0.2, 0.1]} />
            </mesh>
            <Ball at={[0, 0.08, 0.05]} scale={[0.075, 0.09, 0.075]} color={TOY_BLUE} />
          </group>
        )}
      </group>
      <Ball at={[0, 0.91, 0.89]} scale={[0.31, 0.34, 0.4]} rotation={[0.5, 0, 0]} color={color} />
      {[-1, 1].map((s) => (
        <Ball key={`foot-${s}`} at={[s * 0.38, 0.09, -0.58]} scale={[0.24, 0.095, 0.3]} color={PAL.beak} />
      ))}
      {duckIndex === 0 && (
        <>
          <Ball at={[-0.13, 2.05, -0.43]} scale={[0.12, 0.29, 0.14]} rotation={[0, 0, 0.4]} color={color} />
          <Ball at={[0.08, 2.1, -0.43]} scale={[0.12, 0.32, 0.14]} rotation={[0, 0, -0.3]} color={color} />
        </>
      )}
      {/* Pudding: a floppy nightcap with a pompom, permanently ready for a nap. */}
      {duckIndex === 1 && (
        <group>
          <mesh position={[0, 1.98, -0.46]} rotation={[Math.PI / 2, 0, 0]} material={material(PAL.paper)}>
            <torusGeometry args={[0.5, 0.11, 10, 24]} />
          </mesh>
          <mesh position={[0.12, 2.32, -0.5]} rotation={[0.15, 0, -0.55]} material={material(PAL.pink)}>
            <coneGeometry args={[0.46, 0.85, 18]} />
          </mesh>
          <Ball at={[0.5, 2.55, -0.55]} scale={[0.16, 0.16, 0.16]} color={PAL.paper} />
        </group>
      )}
      {duckIndex === 2 && (
        <group>
          <Ball at={[0, 2.02, -0.46]} scale={[0.57, 0.18, 0.47]} color={PAL.paper} />
          <Ball at={[0, 2.12, -0.46]} scale={[0.37, 0.18, 0.34]} color={PAL.deep} />
          <Ball at={[0, 1.97, -0.89]} scale={[0.52, 0.06, 0.18]} color={PAL.navy} />
          <Ball at={[0, 2.16, -0.77]} scale={[0.08, 0.085, 0.03]} color={PAL.yellow} />
        </group>
      )}
      {duckIndex === 2 && (
        <group position={[0, 0.5, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 4]} material={material(i % 2 ? PAL.paper : PAL.deep)}>
              <torusGeometry args={[1.02, 0.14, 8, 10, Math.PI / 4]} />
            </mesh>
          ))}
        </group>
      )}
      {duckIndex === 3 && (
        <group>
          <Ball at={[0, 2.05, -0.43]} scale={[0.5, 0.36, 0.46]} color="#f27860" />
          {[-1, 1].map((s) => (
            <Ball key={s} at={[s * 0.17, 2.39, -0.43]} scale={[0.22, 0.055, 0.13]} rotation={[0, 0, s * 0.4]} color="#52aa86" />
          ))}
          {[-0.22, 0, 0.22].map((x, i) => (
            <Ball key={i} at={[x, 2.09 + (i % 2) * 0.14, -0.84]} scale={[0.025, 0.05, 0.014]} color={PAL.paper} />
          ))}
        </group>
      )}
      {duckIndex === 4 && (
        <group>
          <Ball at={[0, 2.19, -0.43]} scale={[0.04, 0.25, 0.04]} color="#38906d" />
          <Ball at={[-0.16, 2.24, -0.43]} scale={[0.22, 0.08, 0.13]} rotation={[0, 0, -0.35]} color="#66b88c" />
          <Ball at={[0.16, 2.37, -0.43]} scale={[0.22, 0.08, 0.13]} rotation={[0, 0, 0.4]} color="#66b88c" />
        </group>
      )}
      {duckIndex === 5 && (
        <group>
          <Ball at={[0, 2.06, -0.46]} scale={[0.7, 0.14, 0.42]} color={PAL.navy} />
          <Ball at={[0, 2.2, -0.46]} scale={[0.45, 0.26, 0.33]} color={PAL.navy} />
          <Ball at={[0, 2.21, -0.77]} scale={[0.1, 0.11, 0.025]} color={PAL.paper} />
          <Ball at={[-0.53, 1.73, -0.91]} scale={[0.1, 0.05, 0.035]} rotation={[0, 0, -0.2]} color={PAL.beak} />
        </group>
      )}
      {duckIndex === 6 && (
        <group position={[0.43, 1.97, -0.68]} rotation={[0, 0, -0.3]}>
          <Ball at={[-0.16, 0, 0]} scale={[0.21, 0.17, 0.1]} color="#f27860" />
          <Ball at={[0.16, 0, 0]} scale={[0.21, 0.17, 0.1]} color="#f27860" />
          <Ball at={[0, 0, -0.05]} scale={[0.09, 0.1, 0.08]} color="#da5949" />
        </group>
      )}
      {duckIndex === 7 && (
        <group>
          <mesh position={[0, 2.02, -0.46]} material={material('#f5b947')}>
            <cylinderGeometry args={[0.43, 0.38, 0.19, 20]} />
          </mesh>
          {[-0.3, 0, 0.3].map((x, i) => (
            <group key={i}>
              <Ball at={[x, 2.19 + (i === 1 ? 0.07 : 0), -0.54]} scale={[0.085, 0.22, 0.09]} color={PAL.yellow} />
              <Ball at={[x, 2.39 + (i === 1 ? 0.07 : 0), -0.54]} scale={[0.075, 0.075, 0.075]} color={PAL.beak} />
            </group>
          ))}
          <Ball at={[0, 2.04, -0.86]} scale={[0.07, 0.08, 0.025]} color={PAL.deep} />
        </group>
      )}
      {/* Chef Nibbles: a puffy toque with a pink band. */}
      {duckIndex === 8 && (
        <group>
          <mesh position={[0, 2.06, -0.46]} material={material(PAL.paper)}>
            <cylinderGeometry args={[0.4, 0.42, 0.26, 20]} />
          </mesh>
          <Ball at={[0, 1.96, -0.46]} scale={[0.46, 0.07, 0.42]} color={PAL.pink} />
          <Ball at={[0, 2.3, -0.46]} scale={[0.5, 0.3, 0.46]} color={PAL.paper} />
          <Ball at={[-0.28, 2.4, -0.46]} scale={[0.24, 0.22, 0.24]} color={PAL.paper} />
          <Ball at={[0.26, 2.42, -0.5]} scale={[0.24, 0.22, 0.24]} color={PAL.paper} />
        </group>
      )}
      {/* Deputy Dumpling: a wide-brimmed sheriff hat and a star badge. */}
      {duckIndex === 9 && (
        <group>
          <mesh position={[0, 1.99, -0.46]} rotation={[0.08, 0, 0]} material={material(LEATHER)}>
            <cylinderGeometry args={[0.66, 0.7, 0.06, 24]} />
          </mesh>
          <Ball at={[0, 2.2, -0.46]} scale={[0.4, 0.3, 0.38]} color={LEATHER} />
          <Ball at={[0, 2.06, -0.46]} scale={[0.43, 0.06, 0.41]} color={PAL.navy} />
          <mesh position={[-0.34, 1.02, -0.9]} rotation={[Math.PI / 2, 0, 0]} material={material(PAL.yellow)}>
            <cylinderGeometry args={[0.12, 0.12, 0.05, 5]} />
          </mesh>
        </group>
      )}
    </group>
  );
}
