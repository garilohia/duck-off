import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {PAL} from '../palette';
import {laneX} from '../items';
import {place,zFor} from './river';
import type {ItemEffect,RaceItem,RaceFeature} from '../module_bindings/types';
const ROCK='#aeb6c4',ROCK_DARK='#8e97a8',LOG='#8a5a30',LOG_END='#c9925a';
const RAPID_OFFSETS=[[-1.4,0],[1.2,3.5],[-.3,7],[1.5,-3.2],[-1.6,-6.4],[.4,-1.5]];
// Floating toys sit on a foam ring and show exactly what you will pick up.
function Toy({item}:{item:string}){
 return <group scale={1.3}>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.72,0]}><ringGeometry args={[.7,1.05,28]}/><meshBasicMaterial color={PAL.foam} transparent opacity={.75} depthWrite={false}/></mesh>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.7,0]}><ringGeometry args={[1.15,1.3,28]}/><meshBasicMaterial color={item==='bomb'?PAL.pink:item==='turbo'?PAL.yellow:'#a6dfff'} transparent opacity={.55} depthWrite={false}/></mesh>
  {item==='bomb'&&<><mesh><sphereGeometry args={[.62,18,14]}/><meshPhysicalMaterial color={PAL.navy} roughness={.25} clearcoat={.6}/></mesh><mesh position={[0,.62,0]}><cylinderGeometry args={[.16,.2,.16,10]}/><meshStandardMaterial color="#5b6b82"/></mesh><mesh position={[.12,.86,0]} rotation={[0,0,-.4]}><cylinderGeometry args={[.045,.045,.4,6]}/><meshBasicMaterial color={PAL.pink}/></mesh><mesh position={[.24,1.05,0]}><octahedronGeometry args={[.14]}/><meshBasicMaterial color={PAL.yellow}/></mesh><mesh position={[-.22,.2,-.5]} scale={[.16,.1,.05]}><sphereGeometry args={[1,8,6]}/><meshBasicMaterial color="#ffffff" transparent opacity={.6}/></mesh></>}
  {item==='bubble'&&<><mesh><sphereGeometry args={[.72,20,14]}/><meshPhysicalMaterial color="#bfe6ff" transparent opacity={.5} roughness={.05} clearcoat={1} depthWrite={false}/></mesh><mesh position={[-.25,.28,-.5]} scale={[.16,.1,.06]}><sphereGeometry args={[1,8,6]}/><meshBasicMaterial color="#ffffff" transparent opacity={.9}/></mesh><mesh position={[.42,.5,-.1]}><sphereGeometry args={[.18,10,8]}/><meshPhysicalMaterial color="#bfe6ff" transparent opacity={.5} roughness={.05} depthWrite={false}/></mesh><mesh position={[.3,-.42,.42]}><sphereGeometry args={[.12,10,8]}/><meshPhysicalMaterial color="#bfe6ff" transparent opacity={.5} roughness={.05} depthWrite={false}/></mesh></>}
  {item==='turbo'&&<group rotation={[.2,0,-.25]}><mesh><cylinderGeometry args={[.3,.34,1.1,14]}/><meshPhysicalMaterial color={PAL.paper} roughness={.3} clearcoat={.5}/></mesh><mesh position={[0,.8,0]}><coneGeometry args={[.32,.5,14]}/><meshStandardMaterial color={PAL.pink}/></mesh><mesh position={[0,.1,.3]}><circleGeometry args={[.13,12]}/><meshBasicMaterial color={PAL.deep}/></mesh>{[0,1,2].map(i=><mesh key={i} position={[Math.sin(i*2.1)*.34,-.5,Math.cos(i*2.1)*.34]} rotation={[0,i*2.1,0]}><boxGeometry args={[.06,.42,.3]}/><meshStandardMaterial color={PAL.pink}/></mesh>)}<mesh position={[0,-.78,0]}><coneGeometry args={[.2,.35,10]}/><meshBasicMaterial color={PAL.yellow}/></mesh></group>}
  {item==='shield'&&<><mesh><sphereGeometry args={[.78,20,14]}/><meshPhysicalMaterial color="#a6cfff" transparent opacity={.35} roughness={.08} clearcoat={1} depthWrite={false}/></mesh><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[.8,.07,10,32]}/><meshStandardMaterial color={PAL.deep} emissive={PAL.deep} emissiveIntensity={.3}/></mesh><mesh><sphereGeometry args={[.3,14,10]}/><meshStandardMaterial color={PAL.yellow}/></mesh></>}
 </group>;
}
/** The river's buoys, rocks and logs for this race, one per lane spot. */
export function Features({features}:{features:readonly RaceFeature[]}){
 const ref=useRef<THREE.Group>(null);
 useFrame(({clock})=>{if(!ref.current)return;const t=clock.elapsedTime;ref.current.children.forEach((node,i)=>{const kind=node.userData.kind as string,heading=node.userData.heading as number;node.position.y=(kind==='buoy'?1.0:kind==='log'?.05:0)+Math.sin(t*2+i)*(kind==='buoy'?.14:kind==='rapids'?0:kind==='trap'?.15:.06);if(kind==='buoy'){node.rotation.y=t*.9+i;node.rotation.z=Math.sin(t*1.6+i)*.08;}else if(kind==='log')node.rotation.z=Math.sin(t*1.3+i)*.06;else if(kind==='whirlpool'){node.rotation.y=heading;node.children.forEach(part=>{if(part.userData.swirl)part.rotation.z=-t*2.8;else if(part.userData.foam)part.rotation.y=-t*2.2;});node.scale.setScalar(1+Math.sin(t*2.4)*.04);}else if(kind==='rapids'){node.rotation.y=heading;node.children.forEach((streak,j)=>{if(j===0)return;const [ox,oz]=RAPID_OFFSETS[(j-1)%RAPID_OFFSETS.length];streak.position.set(ox,.12+Math.sin(t*9+j)*.05,((oz-t*7+100)%14)-7);});}});});
 return <group ref={ref}>{features.map((f,i)=>{const p=place(laneX(f.lane),zFor(f.pos));return <group key={f.id.toString()} position={[p.x,0,p.z]} rotation={[0,p.heading,0]} userData={{kind:f.kind,heading:p.heading}}>
  {f.kind==='buoy'&&<Toy item={f.item}/>}
  {f.kind==='rock'&&<><mesh position={[0,.25,0]} scale={[1.25,.85,1.05]}><sphereGeometry args={[1,9,7]}/><meshStandardMaterial color={ROCK} roughness={.95} flatShading/></mesh><mesh position={[.8,.1,.5]} scale={[.6,.45,.55]} rotation={[0,i,0]}><sphereGeometry args={[1,7,6]}/><meshStandardMaterial color={ROCK_DARK} roughness={.95} flatShading/></mesh><mesh position={[-.75,.05,-.4]} scale={[.5,.35,.5]}><sphereGeometry args={[1,7,6]}/><meshStandardMaterial color={ROCK_DARK} roughness={.95} flatShading/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[0,.02,0]}><ringGeometry args={[1.3,1.6,24]}/><meshBasicMaterial color={PAL.foam} transparent opacity={.5} depthWrite={false}/></mesh></>}
  {f.kind==='rapids'&&<><mesh rotation={[-Math.PI/2,0,0]} position={[0,.04,0]}><planeGeometry args={[4.4,14]}/><meshBasicMaterial color={PAL.foam} transparent opacity={.28} depthWrite={false}/></mesh>{RAPID_OFFSETS.map((_,j)=><mesh key={j} scale={[.28,.12,1.3]}><sphereGeometry args={[1,7,5]}/><meshBasicMaterial color="#ffffff"/></mesh>)}</>}
  {f.kind==='trap'&&<><mesh position={[0,.7,0]}><sphereGeometry args={[.75,16,12]}/><meshPhysicalMaterial color="#a6dfff" transparent opacity={.55} roughness={.05} depthWrite={false}/></mesh><mesh position={[-.22,.95,-.4]}><sphereGeometry args={[.14,8,6]}/><meshBasicMaterial color="#ffffff" transparent opacity={.8}/></mesh></>}
  {f.kind==='whirlpool'&&<>
   <mesh position={[0,-.75,0]} rotation={[Math.PI,0,0]}><coneGeometry args={[1.75,1.5,28,1,true]}/><meshBasicMaterial color="#0a2451" side={THREE.DoubleSide} transparent opacity={.9} depthWrite={false}/></mesh>
   <mesh rotation={[-Math.PI/2,0,0]} position={[0,.02,0]}><ringGeometry args={[1.7,2.2,40]}/><meshBasicMaterial color="#1d5aa6" transparent opacity={.45} depthWrite={false}/></mesh>
   <group rotation={[-Math.PI/2,0,0]} position={[0,.05,0]} userData={{swirl:true}}>{[0,1,2,3,4].map(j=><mesh key={j} rotation={[0,0,j*1.26]} position={[0,0,-j*.05]}><torusGeometry args={[.45+j*.32,.07+j*.015,6,24,2.6]}/><meshBasicMaterial color={j%2?PAL.foam:'#7fb9ff'} transparent opacity={.85-j*.1} depthWrite={false}/></mesh>)}</group>
   <group position={[0,.12,0]} userData={{foam:true}}>{[0,1,2,3,4,5].map(j=><mesh key={j} position={[Math.cos(j*1.05)*(1.4+(j%2)*.3),0,Math.sin(j*1.05)*(1.4+(j%2)*.3)]} scale={[.16,.08,.16]}><sphereGeometry args={[1,7,5]}/><meshBasicMaterial color="#ffffff" transparent opacity={.8}/></mesh>)}</group>
   <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.05,0]}><circleGeometry args={[.42,20]}/><meshBasicMaterial color="#061a3d"/></mesh>
  </>}
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
