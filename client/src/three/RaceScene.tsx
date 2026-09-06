import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import Duck3D from './Duck3D';
import SceneBoundary from './SceneBoundary';
import { PAL } from '../palette';
import { laneX } from '../items';
import { Features, DuckAura, FlyingItem } from './ItemScene';
import { Scenery, Water } from './Scenery';
import { place, zFor } from './river';
import type { RacePlayer, Race, RaceItem, ItemEffect, RaceFeature } from '../module_bindings/types';
const dropletGeometry = new THREE.SphereGeometry(1, 7, 5);
function Splashes({ taps, speed }: { taps: number; speed: number }) {
  const ref = useRef<THREE.InstancedMesh>(null),
    ring = useRef<THREE.Mesh>(null),
    age = useRef(2),
    last = useRef(taps);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    if (last.current !== taps) {
      age.current = 0;
      last.current = taps;
    }
    age.current += dt;
    const t = age.current;
    if (ref.current) {
      for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI * 0.2;
        const life = Math.max(0, 1 - t * 2);
        dummy.position.set(
          Math.cos(angle) * (1 + t * 1.8),
          0.08 + Math.sin(Math.min(1, t * 1.7) * Math.PI) * (0.3 + (i % 3) * 0.15),
          Math.sin(angle) * (1.1 + t * 2),
        );
        dummy.scale.setScalar(life * (0.05 + (i % 3) * 0.025));
        dummy.scale.y *= 1.6;
        dummy.updateMatrix();
        ref.current.setMatrixAt(i, dummy.matrix);
      }
      ref.current.instanceMatrix.needsUpdate = true;
    }
    if (ring.current) {
      const pulse = t % 1;
      ring.current.scale.set(1 + pulse * 0.8, 1.3 + pulse, 1);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - pulse) * (speed > 1 ? 0.4 : 0.2);
    }
  });
  return (
    <>
      <instancedMesh ref={ref} args={[dropletGeometry, undefined, 10]} frustumCulled={false}>
        <meshBasicMaterial color={PAL.foam} />
      </instancedMesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <ringGeometry args={[1.05, 1.09, 32]} />
        <meshBasicMaterial color={PAL.foam} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </>
  );
}
// Smooth motion between server ticks (10 Hz): each duck's forward speed and sideways drift are estimated from
// the last updates and extrapolated a little ahead, then the rendered position eases toward that prediction.
// The camera reads the same prediction, so the whole scene glides instead of stepping.
type Smooth = { pos: number; lane: number; serverPos: number; serverLane: number; at: number; vPos: number; vLane: number };
const smooth = new Map<string, Smooth>();
const LOOKAHEAD = 0.25;
function predict(id: string, p: RacePlayer, now: number, lobby: boolean): Smooth {
  let s = smooth.get(id);
  if (!s) {
    s = { pos: p.pos, lane: p.lane, serverPos: p.pos, serverLane: p.lane, at: now, vPos: 0, vLane: 0 };
    smooth.set(id, s);
  }
  if (p.pos !== s.serverPos || p.lane !== s.serverLane) {
    const dt = Math.max(0.02, now - s.at);
    const jump = Math.abs(p.pos - s.serverPos) > 350;
    s.vPos = jump ? 0 : THREE.MathUtils.lerp(s.vPos, (p.pos - s.serverPos) / dt, 0.6);
    s.vLane = jump ? 0 : THREE.MathUtils.lerp(s.vLane, (p.lane - s.serverLane) / dt, 0.6);
    if (jump) {
      s.pos = p.pos;
      s.lane = p.lane;
    }
    s.serverPos = p.pos;
    s.serverLane = p.lane;
    s.at = now;
  }
  const age = Math.min(now - s.at, LOOKAHEAD),
    still = p.place || p.drowned || lobby;
  const targetPos = still ? p.pos : Math.max(p.pos, p.pos + s.vPos * age),
    targetLane = THREE.MathUtils.clamp(still ? p.lane : p.lane + s.vLane * age, 0, 4);
  return { ...s, pos: targetPos, lane: targetLane };
}
function Racer({ p, mine, x, lobby, item }: { p: RacePlayer; mine: boolean; x: number; lobby: boolean; item?: RaceItem }) {
  const ref = useRef<THREE.Group>(null),
    shown = useRef({ pos: p.pos, lane: lobby ? x : p.lane }),
    id = p.identity.toHexString(),
    lean = useRef(0),
    boostRing = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    const now = clock.elapsedTime,
      guess = predict(id, p, now, lobby);
    const wantPos = lobby ? 0 : guess.pos,
      wantLane = lobby ? x : laneX(guess.lane);
    const snap = Math.abs(shown.current.pos - wantPos) > 350;
    shown.current.pos = snap ? wantPos : THREE.MathUtils.damp(shown.current.pos, wantPos, 18, dt);
    shown.current.lane = snap ? wantLane : THREE.MathUtils.damp(shown.current.lane, wantLane, 12, dt);
    const target = place(shown.current.lane, lobby ? 0 : zFor(shown.current.pos));
    ref.current.position.x = target.x;
    ref.current.position.z = target.z;
    ref.current.rotation.y = target.heading + (lobby ? 0 : THREE.MathUtils.clamp(-guess.vLane * 0.18, -0.3, 0.3));
    // Lean into the turn (roll), and let the boost ring breathe.
    lean.current = lobby ? 0 : THREE.MathUtils.clamp(guess.vLane * 0.22, -0.32, 0.32);
    if (boostRing.current) {
      const pulse = 1 + Math.sin(now * 9) * 0.08;
      boostRing.current.scale.set(pulse, pulse, 1);
      (boostRing.current.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(now * 9) * 0.2;
    }
    // A drowned duck spins down under the surface and bobs there, upside down and unbothered.
    const sunk = p.drowned ? -1.35 + Math.sin(now * 2) * 0.08 : 0;
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, sunk, 3, dt);
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, p.drowned ? Math.PI : 0, 2.5, dt);
    if (p.drowned) ref.current.rotation.y += now * 0.8;
  });
  const start = place(lobby ? x : laneX(p.lane), lobby ? 0 : zFor(p.pos));
  return (
    <group ref={ref} position={[start.x, 0, start.z]} rotation={[0, start.heading, 0]}>
      <Duck3D duckIndex={p.duckIndex} speed={p.vel} taps={p.taps} lean={lean} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0.1]} scale={[1, 1.4, 1]}>
        <circleGeometry args={[0.85, 24]} />
        <meshBasicMaterial color={PAL.deep} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <Splashes taps={p.taps} speed={p.vel} />
      <DuckAura item={item} />
      {p.boostTicksLeft > 0 && (
        <mesh ref={boostRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[1.1, 1.22, 32]} />
          <meshBasicMaterial color={PAL.yellow} transparent depthWrite={false} />
        </mesh>
      )}
      <Html position={[0, p.drowned ? 4.4 : 3.05, 0]} center distanceFactor={12} zIndexRange={[2, 1]}>
        <div className={`name-tag ${mine ? 'you' : ''}`}>
          {p.drowned ? 'glub… ' : ''}
          {mine ? 'you ♡' : p.name}
        </div>
      </Html>
    </group>
  );
}
function Camera({ target, x, lobby }: { target?: RacePlayer; x: number; lobby: boolean }) {
  const initialized = useRef(false),
    destination = useMemo(() => new THREE.Vector3(), []),
    focus = useMemo(() => new THREE.Vector3(), []),
    aim = useMemo(() => new THREE.Vector3(), []),
    across = useRef(x),
    along = useRef(target?.pos ?? 0);
  useFrame(({ camera, size, clock }, dt) => {
    const portrait = size.width < size.height;
    // Follow the predicted, eased position rather than the raw 10 Hz server value.
    const guess = target ? predict(target.identity.toHexString(), target, clock.elapsedTime, lobby) : undefined;
    along.current =
      Math.abs(along.current - (guess?.pos ?? 0)) > 350
        ? (guess?.pos ?? 0)
        : THREE.MathUtils.damp(along.current, guess?.pos ?? 0, 18, dt);
    const z = lobby ? 0 : zFor(along.current);
    across.current = THREE.MathUtils.damp(across.current, lobby ? x : laneX(guess?.lane ?? 2), 6, dt);
    // Follow from behind along the river, so the bends, rivals, buoys and rapids are visible ahead.
    // Narrow portrait screens follow the lane fully so an edge lane is never cut off; wide screens sit a little off-axis.
    const follow = portrait ? 1 : 0.75,
      side = portrait ? 0.6 : 1.6;
    const behind = place(across.current * follow + (lobby ? 2.2 : side), z + (lobby ? 15.5 : 14)),
      ahead = place(across.current * follow, lobby ? z + 3 : z - 8);
    destination.set(behind.x, lobby ? 6.4 : 7, behind.z);
    focus.set(ahead.x, lobby ? 0.3 : 0, ahead.z);
    if (!initialized.current || Math.abs(camera.position.z - destination.z) > 40) {
      camera.position.copy(destination);
      aim.copy(focus);
      initialized.current = true;
    } else {
      camera.position.lerp(destination, 1 - Math.exp(-7 * dt));
      aim.lerp(focus, 1 - Math.exp(-7 * dt));
    }
    camera.lookAt(aim);
    const cam = camera as THREE.PerspectiveCamera;
    const fov = lobby ? (portrait ? 56 : 46) : portrait ? 62 : 53;
    if (Math.abs(cam.fov - fov) > 0.1) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}
function Track() {
  const markers = useMemo(
    () => [-1, 1].flatMap((side) => Array.from({ length: 24 }, (_, i) => ({ ...place(side * 15.8, 20 - i * 13), i }))),
    [],
  );
  const finish = useMemo(
    () => ({
      posts: [-1, 1].map((s) => place(s * 15, -240)),
      banner: place(0, -240),
      tiles: Array.from({ length: 32 }, (_, i) => ({
        ...place(-15 + (i % 16) * 2, -240 + Math.floor(i / 16) * 2),
        dark: (i + Math.floor(i / 16)) % 2 === 0,
      })),
    }),
    [],
  );
  return (
    <>
      <color attach="background" args={['#dce8ff']} />
      <fog attach="fog" args={['#dce8ff', 45, 125]} />
      <hemisphereLight args={['#ffffff', '#dcad75', 1.65]} />
      <directionalLight position={[-8, 14, 15]} intensity={2.5} color="#fff9f0" />
      <directionalLight position={[12, 8, -10]} intensity={0.8} color="#e4edff" />
      <Water />
      <Scenery />
      {markers.map((m) => (
        <mesh key={`${m.x}-${m.i}`} position={[m.x, 0.12, m.z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.37, 0.14, 8, 16]} />
          <meshStandardMaterial color={m.i % 2 ? PAL.yellow : PAL.paper} />
        </mesh>
      ))}
      {finish.posts.map((p, i) => (
        <mesh key={i} position={[p.x, 5.5, p.z]}>
          <cylinderGeometry args={[0.23, 0.23, 11, 12]} />
          <meshStandardMaterial color={PAL.paper} />
        </mesh>
      ))}
      <mesh position={[finish.banner.x, 10.7, finish.banner.z]} rotation={[0, finish.banner.heading, 0]}>
        <boxGeometry args={[30, 1.4, 0.25]} />
        <meshStandardMaterial color={PAL.yellow} />
      </mesh>
      {finish.tiles.map((t, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, -t.heading]} position={[t.x, 0.04, t.z]}>
          <planeGeometry args={[2, 2]} />
          <meshBasicMaterial color={t.dark ? PAL.deep : PAL.foam} />
        </mesh>
      ))}
    </>
  );
}
export default function RaceScene({
  race,
  players,
  items,
  effects,
  features,
  identity,
}: {
  race: Race;
  players: readonly RacePlayer[];
  items: readonly RaceItem[];
  effects: readonly ItemEffect[];
  features: readonly RaceFeature[];
  identity: string;
}) {
  // The motion cache only keeps ducks that are still in the room; anyone who left is forgotten.
  useEffect(() => {
    const keep = new Set(players.map((p) => p.identity.toHexString()));
    for (const id of [...smooth.keys()]) if (!keep.has(id)) smooth.delete(id);
  }, [players]);
  const sorted = [...players]
    .filter((p) => p.active)
    .sort((a, b) => (a.identity.toHexString() < b.identity.toHexString() ? -1 : 1));
  const mine = sorted.find((p) => p.identity.toHexString() === identity),
    target = mine ?? sorted.find((p) => p.rank === 1) ?? sorted[0];
  const lobby = race.status === 'lobby';
  // In the lobby ducks spread evenly to say hello; once racing they sit in their lanes.
  const xFor = (p: RacePlayer, i: number) =>
    lobby ? (i - (sorted.length - 1) / 2) * Math.min(3.1, 26 / Math.max(1, sorted.length - 1)) : laneX(p.lane);
  return (
    <SceneBoundary>
      <Canvas
        camera={{ position: [0, 7, 14], fov: 54 }}
        dpr={[1, 1.4]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: 1,
        }}
      >
        <Track />
        <Camera target={target} x={target ? xFor(target, Math.max(0, sorted.indexOf(target))) : 0} lobby={lobby} />
        {sorted.map((p, i) => (
          <Racer
            key={p.identity.toHexString()}
            p={p}
            x={xFor(p, i)}
            mine={p.identity.toHexString() === identity}
            lobby={lobby}
            item={items.find((item) => item.identity.isEqual(p.identity))}
          />
        ))}
        {!lobby && <Features features={features} />}
        {effects.map((effect) => (
          <FlyingItem
            key={effect.id.toString()}
            effect={effect}
            sourceX={laneX(sorted.find((p) => p.identity.isEqual(effect.source))?.lane ?? 2)}
            targetX={laneX(sorted.find((p) => p.identity.isEqual(effect.target))?.lane ?? 2)}
            targetPos={sorted.find((p) => p.identity.isEqual(effect.target))?.pos ?? effect.targetPos}
          />
        ))}
      </Canvas>
    </SceneBoundary>
  );
}
