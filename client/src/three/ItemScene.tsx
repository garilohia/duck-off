import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import {PAL} from '../palette';
import {PICKUPS} from '../items';
import type {ItemEffect,RaceItem} from '../module_bindings/types';

export function ItemBuoys({nextPickup}:{nextPickup:number}){
 const ref=useRef<THREE.Group>(null);
 useFrame(({clock})=>{if(ref.current)ref.current.children.forEach((row,i)=>{row.position.y=.9+Math.sin(clock.elapsedTime*2+i)*.18;row.children.forEach((buoy,j)=>{buoy.rotation.y=clock.elapsedTime*.7+j;});});});
 return <group ref={ref}>{PICKUPS.map((pos,i)=>i>=nextPickup&&i<nextPickup+2&&<group key={pos} position={[0,1,-pos/10]}>{[-12,-6,0,6,12].map(x=><group key={x} position={[x,0,0]}><mesh rotation={[.15,0,Math.PI/4]}><boxGeometry args={[1.1,1.1,1.1]}/><meshStandardMaterial color={PAL.deep} emissive={PAL.deep} emissiveIntensity={.4} roughness={.25}/></mesh><Html center position={[0,.1,0]} distanceFactor={13} zIndexRange={[2,1]}><span className="item-buoy-label" aria-hidden="true">?</span></Html></group>)}</group>)}</group>;
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
  if(projectile.current){projectile.current.visible=effect.flightTicks>0;projectile.current.position.set(THREE.MathUtils.lerp(sourceX,targetX,t),1.2+Math.sin(t*Math.PI)*(effect.kind==='bomb'?5:2),-THREE.MathUtils.lerp(effect.sourcePos,targetPos,t)/10);projectile.current.rotation.z+=dt*4;}
  if(burst.current){burst.current.visible=effect.flightTicks===0;burst.current.position.set(targetX,.2,-targetPos/10);const fade=1-effect.lifeTicks/12;burst.current.scale.setScalar(1+Math.max(0,fade)*4);(burst.current.material as THREE.MeshBasicMaterial).opacity=Math.max(0,effect.lifeTicks/12)*.8;}
 });
 return <>
  <group ref={projectile}>
   <mesh><sphereGeometry args={[effect.kind==='bomb'?.45:.65,16,12]}/><meshStandardMaterial color={effect.kind==='bomb'?PAL.navy:'#a6dfff'} roughness={.15} transparent opacity={effect.kind==='bomb'?1:.7}/></mesh>
   {effect.kind==='bomb'&&<><mesh position={[0,.5,0]} rotation={[0,0,-.3]}><cylinderGeometry args={[.045,.045,.28,6]}/><meshBasicMaterial color={PAL.pink}/></mesh><mesh position={[.05,.68,0]}><octahedronGeometry args={[.12]}/><meshBasicMaterial color={PAL.yellow}/></mesh></>}
  </group>
  <mesh ref={burst} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.7,1.1,32]}/><meshBasicMaterial color={effect.blocked?PAL.yellow:effect.kind==='bomb'?PAL.pink:PAL.foam} transparent depthWrite={false}/></mesh>
 </>;
}
