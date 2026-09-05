import {useEffect,useRef,type PointerEvent as ReactPointerEvent} from 'react';
import * as THREE from 'three';
import {PAL} from '../palette';
import {Canvas} from '@react-three/fiber';
import Duck3D,{type Spin} from './Duck3D';
import SceneBoundary from './SceneBoundary';
const MAX_VELOCITY=14;
export default function DuckPreview({index,spinnable=false}:{index:number;spinnable?:boolean}){
 const spin=useRef<Spin>({angle:0,velocity:0,dragging:false});
 const pointer=useRef({x:0,at:0});
 // A freshly chosen duck always faces the camera.
 useEffect(()=>{spin.current.angle=0;spin.current.velocity=0},[index]);
 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{if(!spinnable||!e.isPrimary)return;spin.current.dragging=true;spin.current.velocity=0;pointer.current={x:e.clientX,at:performance.now()};try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}};
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{const s=spin.current;if(!s.dragging||!e.isPrimary)return;const now=performance.now(),dx=e.clientX-pointer.current.x,seconds=Math.max(8,now-pointer.current.at)/1000;s.angle+=dx*.012;s.velocity=THREE.MathUtils.clamp(dx*.012/seconds,-MAX_VELOCITY,MAX_VELOCITY);pointer.current={x:e.clientX,at:now}};
 const up=()=>{const s=spin.current;if(!s.dragging)return;s.dragging=false;if(performance.now()-pointer.current.at>90)s.velocity=0};
 return <div className={`duck-stage${spinnable?' spinnable':''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}>
  <SceneBoundary fallback={<div className="duck-fallback" role="img" aria-label="Your little duck">🦆</div>}><Canvas camera={{position:[1.6,2.0,-5.1],fov:38}} dpr={[1,1.5]} gl={{alpha:true,antialias:true,powerPreference:'low-power',toneMapping:THREE.NeutralToneMapping,toneMappingExposure:1}}><hemisphereLight args={['#ffffff','#dcad75',1.65]}/><directionalLight position={[-3,5,-4]} intensity={2.5} color="#fff9f0"/><directionalLight position={[4,3,2]} intensity={.8} color="#e4edff"/><group position={[0,-1.1,0]}><Duck3D duckIndex={index} preview spin={spin}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} scale={[1,1.25,1]}><ringGeometry args={[1.04,1.085,40]}/><meshBasicMaterial color={PAL.foam} transparent opacity={.7}/></mesh></group></Canvas></SceneBoundary>
 </div>;
}
