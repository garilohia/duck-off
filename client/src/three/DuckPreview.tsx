import {Canvas} from '@react-three/fiber';
import {ContactShadows} from '@react-three/drei';
import Duck3D from './Duck3D';
import SceneBoundary from './SceneBoundary';
export default function DuckPreview({index}:{index:number}){return <SceneBoundary fallback={<div className="duck-fallback">🦆</div>}><Canvas camera={{position:[3,2.6,-5.4],fov:36}} dpr={[1,1.8]} gl={{alpha:true,antialias:true}}><ambientLight intensity={1.4}/><directionalLight position={[-3,5,-4]} intensity={3}/><directionalLight position={[4,3,2]} intensity={2} color="#fff2d8"/><group position={[0,-.85,0]}><Duck3D duckIndex={index} preview/><ContactShadows position={[0,-.04,0]} opacity={.3} scale={6} blur={2.6} far={3}/></group></Canvas></SceneBoundary>}
