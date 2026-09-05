import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PAL } from '../palette';
type V=[number,number,number];
function Ball({at,scale,color=PAL.yellow}:{at:V;scale:V;color?:string}){return <mesh position={at} scale={scale} castShadow><sphereGeometry args={[1,32,24]}/><meshStandardMaterial color={color} roughness={.29}/></mesh>}
function Box({at,scale,color=PAL.navy,rotation=[0,0,0]}:{at:V;scale:V;color?:string;rotation?:V}){return <mesh position={at} rotation={rotation} castShadow><boxGeometry args={scale}/><meshStandardMaterial color={color} roughness={.35}/></mesh>}
export default function Duck3D({duckIndex=0,speed=0,taps=0,preview=false}:{duckIndex?:number;speed?:number;taps?:number;preview?:boolean}){
 const group=useRef<THREE.Group>(null);const last=useRef(taps);const hop=useRef(0);
 useFrame(({clock},dt)=>{if(!group.current)return;if(last.current!==taps){last.current=taps;hop.current=1;}hop.current=Math.max(0,hop.current-dt*5);const time=clock.elapsedTime;group.current.position.y=.12+Math.sin(time*2.8)*.06+Math.sin(hop.current*Math.PI)*.24;group.current.rotation.z=Math.sin(time*(3+speed*.025))*(.025+speed*.00025);group.current.rotation.y=(preview?-.55:0)+Math.sin(time*3)*(.025+speed*.00015);group.current.scale.set(1+hop.current*.08,1-hop.current*.09,1+hop.current*.08);});
 return <group ref={group}>
  <Ball at={[0,.62,0]} scale={[.85,.62,1.06]}/><Ball at={[0,1.46,-.58]} scale={[.64,.66,.62]}/>
  <Ball at={[0,1.27,-1.17]} scale={[.4,.15,.39]} color={PAL.beak}/><Ball at={[0,1.31,-1.2]} scale={[.4,.08,.38]} color="#f5b44e"/>
  {[-1,1].map(s=><group key={s}><Ball at={[s*.43,1.64,-1.015]} scale={[.145,.175,.06]} color={PAL.paper}/><Ball at={[s*.435,1.65,-1.071]} scale={[.083,.105,.035]} color={PAL.navy}/><Ball at={[s*.413,1.69,-1.097]} scale={[.027,.033,.012]} color={PAL.paper}/><Ball at={[s*.79,.7,.08]} scale={[.14,.32,.59]} color="#efb935"/></group>)}
  <mesh position={[0,.91,.91]} rotation={[.55,0,0]} castShadow><coneGeometry args={[.31,.65,24]}/><meshStandardMaterial color={PAL.yellow}/></mesh>
  {duckIndex===1&&<group><mesh position={[0,2.1,-.55]}><cylinderGeometry args={[.48,.44,.45,32]}/><meshStandardMaterial color={PAL.paper}/></mesh>{[-.3,0,.3].map((x,i)=><Ball key={i} at={[x,2.4,-.55]} scale={[.32,.36,.35]} color={PAL.paper}/>)}</group>}
  {duckIndex===2&&<group><Ball at={[0,2,-.57]} scale={[.65,.25,.58]} color={PAL.water}/><Box at={[0,1.98,-1.02]} scale={[1,.08,.5]}/><Ball at={[0,2.1,-1.06]} scale={[.11,.13,.035]} color={PAL.yellow}/></group>}
  {duckIndex===3&&<group rotation={[0,0,-.16]}><Box at={[.54,1.3,-1.4]} scale={[.8,.18,.08]} color="#ced9e4"/><Box at={[-.06,1.3,-1.4]} scale={[.4,.16,.14]}/></group>}
  {duckIndex===4&&<group><Box at={[.5,1.32,-1.45]} scale={[.82,.25,.22]}/><Box at={[.22,1.11,-1.45]} scale={[.22,.42,.21]} rotation={[0,0,.2]}/><Ball at={[.37,1.19,-1.58]} scale={[.055,.055,.025]} color={PAL.pink}/></group>}
  {duckIndex===5&&<group><mesh position={[0,2.06,-.55]} rotation={[0,Math.PI,0]}><coneGeometry args={[.8,.5,3]}/><meshStandardMaterial color={PAL.navy}/></mesh><Ball at={[-.44,1.65,-1.08]} scale={[.19,.2,.05]} color={PAL.navy}/><Box at={[0,1.87,-1.06]} scale={[1.02,.06,.035]} rotation={[0,0,-.3]}/><Ball at={[0,2.13,-.99]} scale={[.11,.12,.04]} color={PAL.paper}/></group>}
  {duckIndex===6&&<group><mesh position={[0,1.81,-.57]}><cylinderGeometry args={[.61,.63,.19,32]}/><meshStandardMaterial color={PAL.pink}/></mesh><Box at={[.74,1.83,-.31]} scale={[.62,.18,.09]} color={PAL.pink} rotation={[0,.5,.25]}/><Box at={[.71,1.72,-.25]} scale={[.58,.17,.09]} color={PAL.pink} rotation={[0,-.2,-.25]}/></group>}
  {duckIndex===7&&<group><mesh position={[0,2.01,-.54]}><cylinderGeometry args={[.5,.46,.28,32]}/><meshStandardMaterial color={PAL.beak} metalness={.45} roughness={.2}/></mesh>{Array.from({length:5},(_,i)=>{const a=i*Math.PI*2/5;return <mesh key={i} position={[Math.sin(a)*.4,2.3,-.54+Math.cos(a)*.4]}><coneGeometry args={[.17,.45,4]}/><meshStandardMaterial color={PAL.yellow}/></mesh>})}<Ball at={[0,2.03,-1.02]} scale={[.13,.15,.07]} color={PAL.pink}/></group>}
 </group>
}
