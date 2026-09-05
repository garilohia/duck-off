import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {PAL,DUCK_COLORS} from '../palette';
type V=[number,number,number];
const sphere=new THREE.SphereGeometry(1,20,14);
const materials=new Map<string,THREE.MeshStandardMaterial>();
function material(color:string){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.38}));return materials.get(color)!;}
function Ball({at,scale,color,rotation=[0,0,0]}:{at:V;scale:V;color:string;rotation?:V}){return <mesh position={at} scale={scale} rotation={rotation} geometry={sphere} material={material(color)}/>}
export default function Duck3D({duckIndex=0,speed=0,taps=0,preview=false}:{duckIndex?:number;speed?:number;taps?:number;preview?:boolean}){
 const group=useRef<THREE.Group>(null),eyes=useRef<THREE.Group>(null),wingL=useRef<THREE.Group>(null),wingR=useRef<THREE.Group>(null);
 const last=useRef(taps),hop=useRef(0),color=DUCK_COLORS[duckIndex]??DUCK_COLORS[0];
 useFrame(({clock},dt)=>{
  const time=clock.elapsedTime;
  if(last.current!==taps){last.current=taps;hop.current=1;}
  hop.current=Math.max(0,hop.current-dt*4);
  if(group.current){group.current.position.y=.1+Math.sin(time*2.4+duckIndex)*.045+Math.sin(hop.current*Math.PI)*.17;group.current.rotation.z=Math.sin(time*3+duckIndex)*(.025+speed*.00015);group.current.rotation.y=(preview?-.12:0)+Math.sin(time*1.7)*.055;group.current.scale.set(1+hop.current*.06,1-hop.current*.05,1+hop.current*.06);}
  if(eyes.current)eyes.current.scale.y=(time+duckIndex*.43)%4.8<.13?.08:1;
  if(wingL.current)wingL.current.rotation.z=-.15-Math.sin(time*6)*.06-hop.current*.3;
  if(wingR.current)wingR.current.rotation.z=.15+Math.sin(time*6)*.06+hop.current*.3;
 });
 return <group ref={group}>
  <Ball at={[0,.6,.13]} scale={[.85,.63,1.0]} color={color}/>
  <Ball at={[0,1.39,-.47]} scale={[.79,.76,.72]} color={color}/>
  <Ball at={[0,.54,-.57]} scale={[.6,.4,.26]} color="#fff0bc"/>
  <Ball at={[0,1.2,-1.13]} scale={[.32,.105,.25]} color={PAL.beak}/>
  <Ball at={[0,1.25,-1.18]} scale={[.33,.09,.24]} color="#ffb350"/>
  <Ball at={[-.49,1.28,-1.015]} scale={[.18,.095,.052]} color="#f5a17e"/>
  <Ball at={[.49,1.28,-1.015]} scale={[.18,.095,.052]} color="#f5a17e"/>
  <group position={[0,1.52,0]} ref={eyes}>{[-1,1].map(s=><group key={s}>
   <Ball at={[s*.34,0,-1.105]} scale={[.125,.157,.064]} color="#173957"/>
   <Ball at={[s*.34-.033,.057,-1.164]} scale={[.043,.05,.013]} color="#ffffff"/>
   <Ball at={[s*.34+.043,-.049,-1.164]} scale={[.02,.023,.01]} color="#c8eeff"/>
  </group>)}</group>
  <group position={[-.72,.65,.12]} ref={wingL}><Ball at={[-.06,0,0]} scale={[.22,.33,.55]} color={color}/></group>
  <group position={[.72,.65,.12]} ref={wingR}><Ball at={[.06,0,0]} scale={[.22,.33,.55]} color={color}/></group>
  <Ball at={[0,.91,.89]} scale={[.31,.34,.4]} rotation={[.5,0,0]} color={color}/>
  {duckIndex===0&&<><Ball at={[-.13,2.05,-.43]} scale={[.12,.29,.14]} rotation={[0,0,.4]} color={color}/><Ball at={[.08,2.1,-.43]} scale={[.12,.32,.14]} rotation={[0,0,-.3]} color={color}/></>}
  {duckIndex===1&&<group><Ball at={[0,2.04,-.46]} scale={[.58,.13,.49]} color={PAL.paper}/>{[-.3,0,.3].map((x,i)=><Ball key={i} at={[x,2.26,-.46]} scale={[.29,.3,.29]} color={PAL.paper}/>)}</group>}
  {duckIndex===2&&<group><Ball at={[0,2.02,-.46]} scale={[.57,.18,.47]} color={PAL.paper}/><Ball at={[0,2.12,-.46]} scale={[.37,.18,.34]} color={PAL.deep}/><Ball at={[0,1.97,-.89]} scale={[.52,.06,.18]} color={PAL.navy}/><Ball at={[0,2.16,-.77]} scale={[.08,.085,.03]} color={PAL.yellow}/></group>}
  {duckIndex===3&&<group><Ball at={[0,2.05,-.43]} scale={[.5,.36,.46]} color="#ed8358"/>{[-1,1].map(s=><Ball key={s} at={[s*.17,2.39,-.43]} scale={[.22,.055,.13]} rotation={[0,0,s*.4]} color="#75b7a3"/>)}{[-.22,0,.22].map((x,i)=><Ball key={i} at={[x,2.09+(i%2)*.14,-.84]} scale={[.025,.05,.014]} color={PAL.paper}/>)}</group>}
  {duckIndex===4&&<group><Ball at={[0,2.19,-.43]} scale={[.04,.25,.04]} color="#67a88c"/><Ball at={[-.16,2.24,-.43]} scale={[.22,.08,.13]} rotation={[0,0,-.35]} color="#84bea0"/><Ball at={[.16,2.37,-.43]} scale={[.22,.08,.13]} rotation={[0,0,.4]} color="#84bea0"/></group>}
  {duckIndex===5&&<group><Ball at={[0,2.06,-.46]} scale={[.7,.14,.42]} color={PAL.navy}/><Ball at={[0,2.2,-.46]} scale={[.45,.26,.33]} color={PAL.navy}/><Ball at={[0,2.21,-.77]} scale={[.1,.11,.025]} color={PAL.paper}/><Ball at={[-.53,1.73,-.91]} scale={[.1,.05,.035]} rotation={[0,0,-.2]} color={PAL.beak}/></group>}
  {duckIndex===6&&<group position={[.43,1.97,-.68]} rotation={[0,0,-.3]}><Ball at={[-.16,0,0]} scale={[.21,.17,.1]} color="#f6a778"/><Ball at={[.16,0,0]} scale={[.21,.17,.1]} color="#f6a778"/><Ball at={[0,0,-.05]} scale={[.09,.1,.08]} color="#ee8b55"/></group>}
  {duckIndex===7&&<group><mesh position={[0,2.02,-.46]} material={material('#f5b947')}><cylinderGeometry args={[.43,.38,.19,20]}/></mesh>{[-.3,0,.3].map((x,i)=><group key={i}><Ball at={[x,2.19+(i===1?.07:0),-.54]} scale={[.085,.22,.09]} color={PAL.yellow}/><Ball at={[x,2.39+(i===1?.07:0),-.54]} scale={[.075,.075,.075]} color={PAL.beak}/></group>)}<Ball at={[0,2.04,-.86]} scale={[.07,.08,.025]} color={PAL.deep}/></group>}
 </group>;
}
