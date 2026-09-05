import * as THREE from 'three';
import {PAL} from '../palette';
import {Canvas} from '@react-three/fiber';
import Duck3D from './Duck3D';
import SceneBoundary from './SceneBoundary';
export default function DuckPreview({index}:{index:number}){return <SceneBoundary fallback={<div className="duck-fallback" role="img" aria-label="Your little duck">🦆</div>}><Canvas camera={{position:[1.6,2.0,-5.1],fov:38}} dpr={[1,1.5]} gl={{alpha:true,antialias:true,powerPreference:'low-power',toneMapping:THREE.NeutralToneMapping,toneMappingExposure:1}}><hemisphereLight args={['#ffffff','#dcad75',1.65]}/><directionalLight position={[-3,5,-4]} intensity={2.5} color="#fff9f0"/><directionalLight position={[4,3,2]} intensity={.8} color="#e4edff"/><group position={[0,-1.1,0]}><Duck3D duckIndex={index} preview/><mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} scale={[1,1.25,1]}><ringGeometry args={[1.04,1.085,40]}/><meshBasicMaterial color={PAL.foam} transparent opacity={.7}/></mesh></group></Canvas></SceneBoundary>}
