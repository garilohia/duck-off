import {useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {PAL} from '../palette';
import {place,ribbonGeometry} from './river';
import {cheer} from '../squeak';
type V=[number,number,number];
type Item={p:V;s:V;r?:number};
// Deterministic layout so every client sees the same banks (and so React StrictMode re-renders match).
function rng(seed:number){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const ball=new THREE.SphereGeometry(1,10,8),lowBall=new THREE.SphereGeometry(1,7,5),trunk=new THREE.CylinderGeometry(.18,.28,1,7),stem=new THREE.CylinderGeometry(.05,.07,1,5);
function Instances({geometry,color,items,flat=false}:{geometry:THREE.BufferGeometry;color:string;items:Item[];flat?:boolean}){
 const ref=useRef<THREE.InstancedMesh>(null);
 useLayoutEffect(()=>{const mesh=ref.current;if(!mesh)return;const o=new THREE.Object3D();items.forEach((it,i)=>{o.position.set(...it.p);o.scale.set(...it.s);o.rotation.set(0,it.r??0,0);o.updateMatrix();mesh.setMatrixAt(i,o.matrix)});mesh.instanceMatrix.needsUpdate=true;},[items]);
 return <instancedMesh ref={ref} args={[geometry,undefined,items.length]} frustumCulled={false}>{flat?<meshBasicMaterial color={color}/>:<meshStandardMaterial color={color} roughness={.9}/>}</instancedMesh>;
}
const GRASS='#8fd18a',GRASS_DARK='#5fb36e',LEAF='#63c27a',LEAF_DARK='#3f9a5f',TRUNK='#9a6a3c',ROCK='#c5c9d4',REED='#6fae5c',CATTAIL='#8a5a30',CLOUD='#ffffff',HILL='#a9dca3';
// Bank-relative (x across, z along) → world, keeping the object upright.
const at=(x:number,y:number,z:number):V=>{const p=place(x,z);return [p.x,y,p.z]};
function useLayout(){
 return useMemo(()=>{
  const r=rng(20260906);
  const trunks:Item[]=[],canopies:Item[]=[],canopiesDark:Item[]=[],bushes:Item[]=[],rocks:Item[]=[],flowersPink:Item[]=[],flowersYellow:Item[]=[],flowersWhite:Item[]=[],reeds:Item[]=[],cattails:Item[]=[],clouds:Item[]=[],hills:Item[]=[],pebbles:Item[]=[],fans:{p:V;side:number;heading:number}[]=[];
  for(const side of [-1,1]){
   for(let z=18;z>-250;z-=7+r()*5){
    const kind=r();
    if(kind<.42){const x=side*(27+r()*11),h=2.2+r()*2.4,w=1.5+r()*1.4;trunks.push({p:at(x,h/2-.2,z),s:[1,h,1]});canopies.push({p:at(x,h+.1,z),s:[w,w*.85,w]});canopiesDark.push({p:at(x+side*.5,h-.5,z+.4),s:[w*.7,w*.6,w*.7]});if(r()<.5)canopies.push({p:at(x-side*.6,h+.8,z-.3),s:[w*.6,w*.55,w*.6]});}
    else if(kind<.68){const x=side*(19+r()*5),w=.7+r()*.8;bushes.push({p:at(x,.15,z),s:[w,w*.7,w]});if(r()<.6)bushes.push({p:at(x+side*.8,.1,z+.6),s:[w*.7,w*.5,w*.7]});}
    else if(kind<.8){const x=side*(17.5+r()*4),w=.35+r()*.6;rocks.push({p:at(x,.05,z),s:[w,w*.6,w*.8],r:r()*3});}
    else{const x=side*(25+r()*12);for(let i=0;i<5;i++){const target=[flowersPink,flowersYellow,flowersWhite][Math.floor(r()*3)];target.push({p:at(x+(r()-.5)*3,.32,z+(r()-.5)*3),s:[.16,.16,.16]});}}
   }
   for(let z=14;z>-245;z-=4+r()*6){const x=side*(15.4+r()*.9);const count=1+Math.floor(r()*3);for(let i=0;i<count;i++){const h=.9+r()*.9,xx=x+(r()-.5)*.8,zz=z+(r()-.5)*1.2;reeds.push({p:at(xx,h/2-.05,zz),s:[1,h,1],r:r()});if(r()<.5)cattails.push({p:at(xx,h-.05,zz),s:[.09,.22,.09]});}}
   for(let z=16;z>-250;z-=2+r()*3){const w=.12+r()*.16;pebbles.push({p:at(side*(16.6+r()*2.2),.18,z),s:[w,w*.5,w*.8],r:r()*3});}
   for(let z=0;z>-240;z-=28+r()*14){const zz=z-r()*6,p=place(side*(18.6+r()*1.2),zz);fans.push({p:[p.x,.35,p.z],side,heading:p.heading});}
   for(let z=20;z>-300;z-=34+r()*20)clouds.push({p:at(side*(12+r()*40),11+r()*6,z),s:[3+r()*3,1.1+r()*.6,2+r()*1.5]});
   for(let z=0;z>-320;z-=30+r()*20)hills.push({p:at(side*(46+r()*14),-4,z),s:[20+r()*12,7+r()*5,18+r()*10]});
  }
  for(let i=0;i<6;i++)hills.push({p:at(-40+i*16,-4,-300-i*4),s:[18,9+(i%3)*2,16]});
  return {trunks,canopies,canopiesDark,bushes,rocks,flowersPink,flowersYellow,flowersWhite,reeds,cattails,clouds,hills,pebbles,fans};
 },[]);
}
// Tiny rubber ducks on the banks. They bob all race and jump up cheering as the player's duck passes.
function Fans({spots}:{spots:{p:V;side:number;heading:number}[]}){
 const ref=useRef<THREE.Group>(null),passed=useRef<boolean[]>(spots.map(()=>false));
 useFrame(({clock,camera})=>{if(!ref.current)return;const t=clock.elapsedTime,duckZ=camera.position.z-14;ref.current.children.forEach((fan,i)=>{const dz=spots[i].p[2]-duckZ;const near=dz>-6&&dz<18;const behind=dz>1;if(behind&&!passed.current[i]&&dz<12){passed.current[i]=true;cheer(spots[i].side*.7);}if(dz<-40)passed.current[i]=false;const lift=near?.7:.22,rate=near?7:3;fan.position.y=spots[i].p[1]+Math.abs(Math.sin(t*rate+i*1.3))*lift;fan.rotation.z=Math.sin(t*rate+i*1.3)*(near?.28:.12);});});
 return <group ref={ref}>{spots.map((f,i)=><group key={i} position={f.p} rotation={[0,(f.side<0?.9:-.9)+f.heading,0]} scale={.4}>
  <mesh position={[0,.6,.1]} scale={[.9,.7,1]} geometry={ball}><meshStandardMaterial color={PAL.yellow} roughness={.35}/></mesh>
  <mesh position={[0,1.35,-.45]} scale={[.8,.75,.72]} geometry={ball}><meshStandardMaterial color={PAL.yellow} roughness={.35}/></mesh>
  <mesh position={[0,1.25,-1.15]} scale={[.32,.12,.26]} geometry={ball}><meshStandardMaterial color={PAL.beak}/></mesh>
  {[-1,1].map(s=><mesh key={s} position={[s*.3,1.45,-1.05]} scale={[.11,.14,.06]} geometry={lowBall}><meshBasicMaterial color="#152333"/></mesh>)}
  <mesh position={[0,.1,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.9,12]}/><meshBasicMaterial color="#00000018" transparent depthWrite={false}/></mesh>
 </group>)}</group>;
}
export function Scenery(){
 const L=useLayout();
 const banks=useMemo(()=>({sandL:ribbonGeometry(-25,-16,70,-330,2,100,.2),sandR:ribbonGeometry(16,25,70,-330,2,100,.2),grassL:ribbonGeometry(-72,-25,70,-330,3,100,.3),grassR:ribbonGeometry(25,72,70,-330,3,100,.3),edgeL:ribbonGeometry(-25.6,-24.6,70,-330,1,100,.32),edgeR:ribbonGeometry(24.6,25.6,70,-330,1,100,.32)}),[]);
 return <group>
  {/* Sand by the water, grass beyond, soft hills on the horizon. The strips follow the river's bends. */}
  <mesh geometry={banks.sandL}><meshStandardMaterial color={PAL.sand} roughness={1}/></mesh><mesh geometry={banks.sandR}><meshStandardMaterial color={PAL.sand} roughness={1}/></mesh>
  <mesh geometry={banks.grassL}><meshStandardMaterial color={GRASS} roughness={1}/></mesh><mesh geometry={banks.grassR}><meshStandardMaterial color={GRASS} roughness={1}/></mesh>
  <mesh geometry={banks.edgeL}><meshStandardMaterial color={GRASS_DARK} roughness={1}/></mesh><mesh geometry={banks.edgeR}><meshStandardMaterial color={GRASS_DARK} roughness={1}/></mesh>
  <Instances geometry={lowBall} color={HILL} items={L.hills}/>
  <Instances geometry={lowBall} color={CLOUD} items={L.clouds} flat/>
  <Instances geometry={trunk} color={TRUNK} items={L.trunks}/>
  <Instances geometry={ball} color={LEAF} items={L.canopies}/>
  <Instances geometry={ball} color={LEAF_DARK} items={L.canopiesDark}/>
  <Instances geometry={ball} color={LEAF_DARK} items={L.bushes}/>
  <Instances geometry={lowBall} color={ROCK} items={L.rocks}/>
  <Instances geometry={lowBall} color="#d9cfc0" items={L.pebbles}/>
  <Instances geometry={lowBall} color={PAL.pink} items={L.flowersPink} flat/>
  <Instances geometry={lowBall} color={PAL.yellow} items={L.flowersYellow} flat/>
  <Instances geometry={lowBall} color={PAL.paper} items={L.flowersWhite} flat/>
  <Instances geometry={stem} color={REED} items={L.reeds}/>
  <Instances geometry={lowBall} color={CATTAIL} items={L.cattails}/>
  <Fans spots={L.fans}/>
 </group>;
}
const VERT=`varying vec2 vUv;uniform float uTime;
#include <fog_pars_vertex>
void main(){vUv=uv;vec3 p=position;p.y+=sin(p.x*.8+uTime)*cos(p.z*.5+uTime*.7)*.06+sin(p.z*1.3-uTime*1.1)*.03;vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;
// A river, not a pool: deep teal down the middle, sandy shallows at the banks, flow streaks drifting
// downstream, soft caustics and sun glints, and lace foam where the water meets the sand.
const FRAG=`varying vec2 vUv;uniform float uTime;uniform vec3 uBlue;uniform vec3 uDeep;uniform vec3 uShallow;uniform vec3 uFoam;uniform vec3 uSky;
#include <fog_pars_fragment>
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float height(vec2 p,float t){return noise(p*.9+vec2(t*.35,t*.2))*.6+noise(p*2.1-vec2(t*.25,t*.4))*.3+sin(p.y*1.7+p.x*.8+t*1.4)*.1;}
void main(){
 vec2 p=vUv*vec2(16.,200.);float t=uTime;
 float h=height(p,t);float e=.15;float hx=height(p+vec2(e,0.),t)-h,hy=height(p+vec2(0.,e),t)-h;
 vec3 n=normalize(vec3(-hx*3.,1.,-hy*3.));vec3 L=normalize(vec3(-.4,.9,.5));vec3 V=normalize(vec3(0.,.8,.6));vec3 H=normalize(L+V);
 float spec=pow(max(dot(n,H),0.),90.)*.8;float fres=pow(1.-max(dot(n,V),0.),3.);
 float bank=abs(vUv.x-.5)*2.;
 vec3 color=mix(mix(uDeep,uBlue,smoothstep(.15,.85,h)),uShallow,smoothstep(.55,1.,bank)*.55);
 float flow=noise(vec2(p.x*2.2,p.y*.28-t*1.6))*noise(vec2(p.x*1.1+3.,p.y*.5-t*.9));color=mix(color,uFoam,smoothstep(.5,.7,flow)*.06);
 vec2 q=p*1.3+vec2(noise(p*.45+vec2(t*.3,0.)),noise(p*.45-vec2(0.,t*.25)))*3.2;float a=sin(q.x*1.7+q.y*.6+t),b=sin(q.y*1.4-q.x*.8-t*.9);float caustic=pow(1.-abs(a*b),8.);
 color=mix(color,uFoam,caustic*.1);color=mix(color,uSky,fres*.3);color+=spec;
 float edge=smoothstep(.86,1.,bank);float lace=noise(vec2(p.y*2.5+t*1.2,p.x*4.))*.5+.5;color=mix(color,uFoam,edge*(.3+.5*lace));
 gl_FragColor=vec4(color,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
export function Water(){
 const shader=useRef<THREE.ShaderMaterial>(null);
 const geometry=useMemo(()=>ribbonGeometry(-16,16,70,-330,12,160,-.05),[]);
 const uniforms=useMemo(()=>THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{uTime:{value:0},uBlue:{value:new THREE.Color('#3d8fcf')},uDeep:{value:new THREE.Color('#1f5c9c')},uShallow:{value:new THREE.Color('#7ec1c9')},uFoam:{value:new THREE.Color(PAL.foam)},uSky:{value:new THREE.Color('#dce8ff')}}]),[]);
 useFrame(({clock})=>{if(shader.current)shader.current.uniforms.uTime.value=clock.elapsedTime});
 return <mesh geometry={geometry}><shaderMaterial toneMapped={false} fog ref={shader} uniforms={uniforms} vertexShader={VERT} fragmentShader={FRAG}/></mesh>;
}
