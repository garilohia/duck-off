import {useRef,useMemo} from 'react';
import {Canvas,useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import Duck3D from './Duck3D';
import SceneBoundary from './SceneBoundary';
import {PAL} from '../palette';
import type {RacePlayer,Race} from '../module_bindings/types';
const dropletGeometry=new THREE.SphereGeometry(1,7,5);
function Splashes({taps,speed}:{taps:number;speed:number}){
 const ref=useRef<THREE.InstancedMesh>(null),ring=useRef<THREE.Mesh>(null),age=useRef(2),last=useRef(taps);
 const dummy=useMemo(()=>new THREE.Object3D(),[]);
 useFrame((_,dt)=>{if(last.current!==taps){age.current=0;last.current=taps;}age.current+=dt;const t=age.current;
  if(ref.current){for(let i=0;i<10;i++){const angle=i*Math.PI*.2;const life=Math.max(0,1-t*2);dummy.position.set(Math.cos(angle)*(1+t*1.8),.08+Math.sin(Math.min(1,t*1.7)*Math.PI)*(.3+(i%3)*.15),Math.sin(angle)*(1.1+t*2));dummy.scale.setScalar(life*(.05+(i%3)*.025));dummy.scale.y*=1.6;dummy.updateMatrix();ref.current.setMatrixAt(i,dummy.matrix)}ref.current.instanceMatrix.needsUpdate=true;}
  if(ring.current){const pulse=(t%1);ring.current.scale.set(1+pulse*.8,1.3+pulse,1);(ring.current.material as THREE.MeshBasicMaterial).opacity=(1-pulse)*(speed>1?.4:.2);}
 });
 return <><instancedMesh ref={ref} args={[dropletGeometry,undefined,10]} frustumCulled={false}><meshBasicMaterial color={PAL.foam}/></instancedMesh><mesh ref={ring} rotation={[-Math.PI/2,0,0]} position={[0,.07,0]}><ringGeometry args={[1.05,1.09,32]}/><meshBasicMaterial color={PAL.foam} transparent opacity={.4} depthWrite={false}/></mesh></>;
}
function Racer({p,mine,x,lobby}:{p:RacePlayer;mine:boolean;x:number;lobby:boolean}){
 const ref=useRef<THREE.Group>(null);
 useFrame((_,dt)=>{if(!ref.current)return;const z=lobby?0:-p.pos/10;ref.current.position.x=THREE.MathUtils.damp(ref.current.position.x,x,7,dt);ref.current.position.z=Math.abs(ref.current.position.z-z)>35?z:THREE.MathUtils.damp(ref.current.position.z,z,15,dt)});
 return <group ref={ref} position={[x,0,lobby?0:-p.pos/10]}><Duck3D duckIndex={p.duckIndex} speed={p.vel} taps={p.taps}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,.015,.1]} scale={[1,1.4,1]}><circleGeometry args={[.85,24]}/><meshBasicMaterial color={PAL.deep} transparent opacity={.16} depthWrite={false}/></mesh><Splashes taps={p.taps} speed={p.vel}/>{p.boostTicksLeft>0&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.04,0]}><ringGeometry args={[1.1,1.2,32]}/><meshBasicMaterial color={PAL.yellow}/></mesh>}<Html position={[0,2.85,0]} center distanceFactor={12} zIndexRange={[2,1]}><div className={`name-tag ${mine?'you':''}`}>{mine?'you ♡':p.name}</div></Html></group>;
}
function Camera({target,x,lobby}:{target?:RacePlayer;x:number;lobby:boolean}){
 const initialized=useRef(false),destination=useMemo(()=>new THREE.Vector3(),[]);
 useFrame(({camera,size},dt)=>{const portrait=size.width<size.height,z=lobby?0:-(target?.pos??0)/10;
  // Keep the duck above the bottom controls, and show its face from the front.
  destination.set(x+(lobby?3:4),lobby?6:9,z-(lobby?11:16));
  if(!initialized.current||Math.abs(camera.position.z-destination.z)>40){camera.position.copy(destination);initialized.current=true;}else camera.position.lerp(destination,1-Math.exp(-7*dt));
  camera.lookAt(x,lobby?-1.7:-1.2,z+(lobby?0:2));
  const cam=camera as THREE.PerspectiveCamera;const fov=lobby?(portrait?50:42):(portrait?62:53);if(Math.abs(cam.fov-fov)>.1){cam.fov=fov;cam.updateProjectionMatrix();}
 });return null;
}
function Water(){
 const shader=useRef<THREE.ShaderMaterial>(null);
 const uniforms=useMemo(()=>({uTime:{value:0},uBlue:{value:new THREE.Color(PAL.water)},uFoam:{value:new THREE.Color('#bceeff')}}),[]);
 useFrame(({clock})=>{if(shader.current)shader.current.uniforms.uTime.value=clock.elapsedTime});
 return <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.05,-120]}><planeGeometry args={[32,360,16,120]}/><shaderMaterial ref={shader} uniforms={uniforms} vertexShader={`varying vec2 vUv; uniform float uTime; void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*.8+uTime)*cos(p.y*.5+uTime*.7)*.035;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`} fragmentShader={`varying vec2 vUv;uniform float uTime;uniform vec3 uBlue;uniform vec3 uFoam;void main(){vec2 p=vUv*vec2(16.,180.);float t=uTime*.28;vec2 q=p+vec2(sin(p.y*.7+t),cos(p.x*.9-t))*.32;float a=sin(q.x*2.2+q.y*.5+t),b=sin(q.y*1.8-q.x*.6-t);float caustic=pow(1.-abs(a*b),12.);float ripple=sin(q.y*3.+sin(q.x*2.+t)+t);vec3 color=mix(uBlue*.91,uBlue*1.06,.5+.5*ripple);color=mix(color,uFoam,caustic*.24);float edge=smoothstep(.46,.5,abs(vUv.x-.5));color=mix(color,uFoam,edge*.55);gl_FragColor=vec4(color,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`}/></mesh>;
}
function Track(){
 return <><color attach="background" args={['#fcdea8']}/><fog attach="fog" args={['#fcdea8',45,125]}/><hemisphereLight args={['#fff8e7','#8fbacb',2.2]}/><directionalLight position={[-8,18,-15]} intensity={2.5} color="#fff0cd"/><directionalLight position={[12,8,3]} intensity={1} color="#d2f1ff"/><Water/>{[-1,1].map(side=><group key={side}><mesh position={[side*26,-.3,-120]}><boxGeometry args={[20,1,360]}/><meshStandardMaterial color={PAL.sand}/></mesh>{Array.from({length:22},(_,i)=><group key={i} position={[side*15.8,.12,20-i*13]}><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[.37,.14,8,16]}/><meshStandardMaterial color={i%2?PAL.yellow:PAL.paper}/></mesh></group>)}</group>)}<group position={[0,0,-240]}>{[-1,1].map(s=><mesh key={s} position={[s*15,5.5,0]}><cylinderGeometry args={[.23,.23,11,12]}/><meshStandardMaterial color={PAL.paper}/></mesh>)}<mesh position={[0,10.7,0]}><boxGeometry args={[30,1.4,.25]}/><meshStandardMaterial color={PAL.yellow}/></mesh>{Array.from({length:32},(_,i)=><mesh key={i} rotation={[-Math.PI/2,0,0]} position={[-15+(i%16)*2,.04,Math.floor(i/16)*2]}><planeGeometry args={[2,2]}/><meshBasicMaterial color={(i+Math.floor(i/16))%2?PAL.foam:PAL.deep}/></mesh>)}</group></>;
}
export default function RaceScene({race,players,identity}:{race:Race;players:readonly RacePlayer[];identity:string}){
 const sorted=[...players].filter(p=>p.active).sort((a,b)=>a.identity.toHexString()<b.identity.toHexString()?-1:1);
 const mine=sorted.find(p=>p.identity.toHexString()===identity),target=mine??sorted.find(p=>p.rank===1)??sorted[0];
 const xFor=(i:number)=>(i-(sorted.length-1)/2)*Math.min(3.1,26/Math.max(1,sorted.length-1));
 const targetX=Math.max(0,sorted.indexOf(target!)),lobby=race.status==='lobby';
 return <SceneBoundary><Canvas camera={{position:[0,7,-13],fov:54}} dpr={[1,1.4]} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}><Track/><Camera target={target} x={xFor(targetX)} lobby={lobby}/>{sorted.map((p,i)=><Racer key={p.identity.toHexString()} p={p} x={xFor(i)} mine={p.identity.toHexString()===identity} lobby={lobby}/>)}</Canvas></SceneBoundary>;
}
