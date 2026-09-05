import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import {PAL} from '../palette';
import {laneX} from '../items';
import {place,zFor} from './river';
import type {ItemEffect,RaceItem,RaceFeature} from '../module_bindings/types';
const ROCK='#aeb6c4',ROCK_DARK='#8e97a8',LOG='#8a5a30',LOG_END='#c9925a';
const RAPID_OFFSETS=[[-1.4,0],[1.2,3.5],[-.3,7],[1.5,-3.2],[-1.6,-6.4],[.4,-1.5]];
/** The river's buoys, rocks and logs for this race, one per lane spot. */
export function Features({features}:{features:readonly RaceFeature[]}){
 const ref=useRef<THREE.Group>(null);
 useFrame(({clock})=>{if(!ref.current)return;const t=clock.elapsedTime;ref.current.children.forEach((node,i)=>{const kind=node.userData.kind as string,heading=node.userData.heading as number;node.position.y=(kind==='buoy'?.9:kind==='log'?.05:0)+Math.sin(t*2+i)*(kind==='buoy'?.18:kind==='rapids'?0:.06);if(kind==='buoy')node.rotation.y=t*.7+i;else if(kind==='log')node.rotation.z=Math.sin(t*1.3+i)*.06;else if(kind==='whirlpool'){node.rotation.y=heading;node.children.forEach((ring,j)=>{ring.rotation.z=t*(1.6+j*.5)*(j%2?-1:1);ring.scale.setScalar(1+Math.sin(t*3+j)*.06);});}else if(kind==='rapids'){node.rotation.y=heading;node.children.forEach((streak,j)=>{if(j===0)return;const [ox,oz]=RAPID_OFFSETS[(j-1)%RAPID_OFFSETS.length];streak.position.set(ox,.12+Math.sin(t*9+j)*.05,((oz-t*7+100)%14)-7);});}});});
 return <group ref={ref}>{features.map((f,i)=>{const p=place(laneX(f.lane),zFor(f.pos));return <group key={f.id.toString()} position={[p.x,0,p.z]} rotation={[0,p.heading,0]} userData={{kind:f.kind,heading:p.heading}}>
  {f.kind==='buoy'&&<><mesh rotation={[.15,0,Math.PI/4]}><boxGeometry args={[1.1,1.1,1.1]}/><meshStandardMaterial color={PAL.deep} emissive={PAL.deep} emissiveIntensity={.4} roughness={.25}/></mesh><Html center position={[0,.1,0]} distanceFactor={13} zIndexRange={[2,1]}><span className="item-buoy-label" aria-hidden="true">?</span></Html></>}
  {f.kind==='rock'&&<><mesh position={[0,.25,0]} scale={[1.25,.85,1.05]}><sphereGeometry args={[1,9,7]}/><meshStandardMaterial color={ROCK} roughness={.95} flatShading/></mesh><mesh position={[.8,.1,.5]} scale={[.6,.45,.55]} rotation={[0,i,0]}><sphereGeometry args={[1,7,6]}/><meshStandardMaterial color={ROCK_DARK} roughness={.95} flatShading/></mesh><mesh position={[-.75,.05,-.4]} scale={[.5,.35,.5]}><sphereGeometry args={[1,7,6]}/><meshStandardMaterial color={ROCK_DARK} roughness={.95} flatShading/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[0,.02,0]}><ringGeometry args={[1.3,1.6,24]}/><meshBasicMaterial color={PAL.foam} transparent opacity={.5} depthWrite={false}/></mesh></>}
  {f.kind==='rapids'&&<><mesh rotation={[-Math.PI/2,0,0]} position={[0,.04,0]}><planeGeometry args={[4.4,14]}/><meshBasicMaterial color={PAL.foam} transparent opacity={.28} depthWrite={false}/></mesh>{RAPID_OFFSETS.map((_,j)=><mesh key={j} scale={[.28,.12,1.3]}><sphereGeometry args={[1,7,5]}/><meshBasicMaterial color="#ffffff"/></mesh>)}</>}
  {f.kind==='whirlpool'&&<>{[0,1,2].map(j=><mesh key={j} rotation={[-Math.PI/2,0,0]} position={[0,.06-j*.012,0]}><ringGeometry args={[.5+j*.8,.85+j*.8,40]}/><meshBasicMaterial color={j===1?PAL.foam:'#123c7a'} transparent opacity={.55-j*.1} depthWrite={false}/></mesh>)}<mesh rotation={[-Math.PI/2,0,0]} position={[0,.03,0]}><circleGeometry args={[.6,24]}/><meshBasicMaterial color="#0c2a5c"/></mesh></>}
  {f.kind==='log'&&<><mesh rotation={[0,0,Math.PI/2]} position={[0,.3,0]}><cylinderGeometry args={[.42,.42,3.4,10]}/><meshStandardMaterial color={LOG} roughness={.9}/></mesh>{[-1,1].map(s=><mesh key={s} rotation={[0,0,Math.PI/2]} position={[s*1.71,.3,0]}><cylinderGeometry args={[.34,.34,.06,10]}/><meshStandardMaterial color={LOG_END} roughness={.9}/></mesh>)}<mesh position={[.5,.62,.1]} scale={[.16,.22,.16]}><sphereGeometry args={[1,6,5]}/><meshStandardMaterial color="#63c27a"/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[0,.02,0]} scale={[1.9,1,1]}><ringGeometry args={[1.05,1.3,24]}/><meshBasicMaterial color={PAL.foam} transparent opacity={.45} depthWrite={false}/></mesh></>}
 </group>})}</group>;
}

export function DuckAura({item}:{item?:RaceItem}){
 if(!item)return null;
 return <>
  {item.shieldTicks>0&&<mesh position={[0,1.1,0]} scale={[1.15,1.2,1.25]}><sphereGeometry args={[1.25,20,14]}/><meshPhysicalMaterial color="#a6cfff" transparent opacity={.22} roughness={.08} metalness={.1} depthWrite={false}/></mesh>}
  {item.slowTicks>0&&<mesh position={[0,.1,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.1,1.4,32]}/><meshBasicMaterial color={PAL.pink} transparent opacity={.8} depthWrite={false}/></mesh>}
  {item.turboTicks>0&&[1.5,2.3,3.1].map((z,i)=><mesh key={z} position={[0,.05,z]} rotation={[-Math.PI/2,0,0]} scale={[1,.7,1]}><ringGeometry args={[.8+i*.2,.96+i*.2,24]}/><meshBasicMaterial color={PAL.yellow} transparent opacity={.75-i*.18} depthWrite={false}/></mesh>)}
 </>;
}

export function FlyingItem({effect,sourceX,targetX,targetPos}:{effect:ItemEffect;sourceX:number;targetX:number;targetPos:number}){
 const projectile=useRef<THREE.Group>(null),burst=useRef<THREE.Mesh>(null),age=useRef((6-effect.flightTicks)/10);
 useFrame((_,dt)=>{
  age.current=Math.max((6-effect.flightTicks)/10,age.current+dt);
  const t=Math.min(1,age.current/.6);
  const from=place(sourceX,zFor(effect.sourcePos)),to=place(targetX,zFor(targetPos));
  if(projectile.current){projectile.current.visible=effect.flightTicks>0;projectile.current.position.set(THREE.MathUtils.lerp(from.x,to.x,t),1.2+Math.sin(t*Math.PI)*(effect.kind==='bomb'?5:2),THREE.MathUtils.lerp(from.z,to.z,t));projectile.current.rotation.z+=dt*4;}
  if(burst.current){burst.current.visible=effect.flightTicks===0;burst.current.position.set(to.x,.2,to.z);const fade=1-effect.lifeTicks/12;burst.current.scale.setScalar(1+Math.max(0,fade)*4);(burst.current.material as THREE.MeshBasicMaterial).opacity=Math.max(0,effect.lifeTicks/12)*.8;}
 });
 return <>
  <group ref={projectile}>
   <mesh><sphereGeometry args={[effect.kind==='bomb'?.45:.65,16,12]}/><meshStandardMaterial color={effect.kind==='bomb'?PAL.navy:'#a6dfff'} roughness={.15} transparent opacity={effect.kind==='bomb'?1:.7}/></mesh>
   {effect.kind==='bomb'&&<><mesh position={[0,.5,0]} rotation={[0,0,-.3]}><cylinderGeometry args={[.045,.045,.28,6]}/><meshBasicMaterial color={PAL.pink}/></mesh><mesh position={[.05,.68,0]}><octahedronGeometry args={[.12]}/><meshBasicMaterial color={PAL.yellow}/></mesh></>}
  </group>
  <mesh ref={burst} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.7,1.1,32]}/><meshBasicMaterial color={effect.blocked?PAL.yellow:effect.kind==='bomb'?PAL.pink:PAL.foam} transparent depthWrite={false}/></mesh>
 </>;
}
