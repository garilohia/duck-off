import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {PAL,DUCK_COLORS} from '../palette';
type V=[number,number,number];
const sphere=new THREE.SphereGeometry(1,24,16);
const materials=new Map<string,THREE.MeshPhysicalMaterial>();
function material(color:string){if(!materials.has(color))materials.set(color,new THREE.MeshPhysicalMaterial({color,roughness:.29,clearcoat:.55,clearcoatRoughness:.22}));return materials.get(color)!;}
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
  <Ball at={[0,.6,.13]} scale={[.89,.68,1.0]} color={color}/>
  <Ball at={[0,1.40,-.47]} scale={[.83,.78,.75]} color={color}/>
  <Ball at={[0,.54,-.57]} scale={[.6,.4,.26]} color={color}/>
  <Ball at={[0,1.115,-1.2]} scale={[.29,.11,.24]} color="#e96b0e"/>
  <Ball at={[0,1.175,-1.29]} scale={[.285,.033,.19]} color="#a94a14"/>
  <Ball at={[0,1.255,-1.23]} scale={[.34,.125,.27]} color={PAL.beak}/>
  <Ball at={[-.49,1.26,-1.075]} scale={[.14,.075,.035]} color="#f79763"/>
  <Ball at={[.49,1.26,-1.075]} scale={[.14,.075,.035]} color="#f79763"/>
  <group position={[0,1.49,0]} ref={eyes}>{[-1,1].map(s=><group key={s}>
   <Ball at={[s*.355,0,-1.155]} scale={[.145,.175,.08]} color="#152333"/>
   <Ball at={[s*.355-.04,.059,-1.227]} scale={[.043,.05,.013]} color="#ffffff"/>
   <Ball at={[s*.355+.042,-.051,-1.226]} scale={[.02,.023,.01]} color="#c8eeff"/>
  </group>)}</group>
  <group position={[-.72,.65,.12]} ref={wingL}><Ball at={[-.06,0,0]} scale={[.22,.33,.55]} color={color}/></group>
  <group position={[.72,.65,.12]} ref={wingR}><Ball at={[.06,0,0]} scale={[.22,.33,.55]} color={color}/></group>
  <Ball at={[0,.91,.89]} scale={[.31,.34,.4]} rotation={[.5,0,0]} color={color}/>
  {[-1,1].map(s=><Ball key={`foot-${s}`} at={[s*.38,.09,-.58]} scale={[.24,.095,.3]} color={PAL.beak}/>)}
  {duckIndex===0&&<><Ball at={[-.13,2.05,-.43]} scale={[.12,.29,.14]} rotation={[0,0,.4]} color={color}/><Ball at={[.08,2.1,-.43]} scale={[.12,.32,.14]} rotation={[0,0,-.3]} color={color}/></>}
  {duckIndex===1&&<group><Ball at={[0,2.10,-.46]} scale={[.56,.21,.49]} color={PAL.paper}/>{[-.3,0,.3].map((x,i)=><Ball key={i} at={[x,2.37,-.46]} scale={[.3,.31,.3]} color={PAL.paper}/>)}</group>}
  {duckIndex===2&&<group><Ball at={[0,2.02,-.46]} scale={[.57,.18,.47]} color={PAL.paper}/><Ball at={[0,2.12,-.46]} scale={[.37,.18,.34]} color={PAL.deep}/><Ball at={[0,1.97,-.89]} scale={[.52,.06,.18]} color={PAL.navy}/><Ball at={[0,2.16,-.77]} scale={[.08,.085,.03]} color={PAL.yellow}/></group>}
  {duckIndex===2&&<group position={[0,.5,.1]} rotation={[-Math.PI/2,0,0]}>{Array.from({length:8},(_,i)=><mesh key={i} rotation={[0,0,i*Math.PI/4]} material={material(i%2?PAL.paper:PAL.deep)}><torusGeometry args={[1.02,.14,8,10,Math.PI/4]}/></mesh>)}</group>}
  {duckIndex===3&&<group><Ball at={[0,2.05,-.43]} scale={[.5,.36,.46]} color="#f27860"/>{[-1,1].map(s=><Ball key={s} at={[s*.17,2.39,-.43]} scale={[.22,.055,.13]} rotation={[0,0,s*.4]} color="#52aa86"/>)}{[-.22,0,.22].map((x,i)=><Ball key={i} at={[x,2.09+(i%2)*.14,-.84]} scale={[.025,.05,.014]} color={PAL.paper}/>)}</group>}
  {duckIndex===4&&<group><Ball at={[0,2.19,-.43]} scale={[.04,.25,.04]} color="#38906d"/><Ball at={[-.16,2.24,-.43]} scale={[.22,.08,.13]} rotation={[0,0,-.35]} color="#66b88c"/><Ball at={[.16,2.37,-.43]} scale={[.22,.08,.13]} rotation={[0,0,.4]} color="#66b88c"/></group>}
  {duckIndex===5&&<group><Ball at={[0,2.06,-.46]} scale={[.7,.14,.42]} color={PAL.navy}/><Ball at={[0,2.2,-.46]} scale={[.45,.26,.33]} color={PAL.navy}/><Ball at={[0,2.21,-.77]} scale={[.1,.11,.025]} color={PAL.paper}/><Ball at={[-.53,1.73,-.91]} scale={[.1,.05,.035]} rotation={[0,0,-.2]} color={PAL.beak}/></group>}
  {duckIndex===6&&<group position={[.43,1.97,-.68]} rotation={[0,0,-.3]}><Ball at={[-.16,0,0]} scale={[.21,.17,.1]} color="#f27860"/><Ball at={[.16,0,0]} scale={[.21,.17,.1]} color="#f27860"/><Ball at={[0,0,-.05]} scale={[.09,.1,.08]} color="#da5949"/></group>}
  {duckIndex===7&&<group><mesh position={[0,2.02,-.46]} material={material('#f5b947')}><cylinderGeometry args={[.43,.38,.19,20]}/></mesh>{[-.3,0,.3].map((x,i)=><group key={i}><Ball at={[x,2.19+(i===1?.07:0),-.54]} scale={[.085,.22,.09]} color={PAL.yellow}/><Ball at={[x,2.39+(i===1?.07:0),-.54]} scale={[.075,.075,.075]} color={PAL.beak}/></group>)}<Ball at={[0,2.04,-.86]} scale={[.07,.08,.025]} color={PAL.deep}/></group>}
 </group>;
}
