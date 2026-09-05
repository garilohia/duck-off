import * as THREE from 'three';
// The race is one-dimensional (pos along the track); the world winds. Every placed object, the water,
// the banks and the camera go through `place`, so a lane offset always sits across the river's flow.
export const bendX=(z:number)=>9*Math.sin(z*.028)+4*Math.sin(z*.075+1.3);
const slope=(z:number)=>9*.028*Math.cos(z*.028)+4*.075*Math.cos(z*.075+1.3);
export type Placed={x:number;z:number;heading:number};
/** World position for a point `x` across the river at straight-line depth `z` (ducks travel toward -z). */
export function place(x:number,z:number):Placed{const heading=Math.atan(slope(z)),c=Math.cos(heading),s=Math.sin(heading);return {x:bendX(z)+x*c,z:z-x*s,heading};}
export const zFor=(pos:number)=>-pos/10;
/** A strip from x0..x1 across the river, z0 (near) to z1 (far), bent along the curve, with uvs u across / v along. */
export function ribbonGeometry(x0:number,x1:number,z0:number,z1:number,across:number,along:number,y=0){
 const positions:number[]=[],uvs:number[]=[],index:number[]=[];
 for(let j=0;j<=along;j++){const z=z0+(z1-z0)*j/along;for(let i=0;i<=across;i++){const p=place(x0+(x1-x0)*i/across,z);positions.push(p.x,y,p.z);uvs.push(i/across,j/along);}}
 // Counter-clockwise seen from above (z shrinks as j grows), so the strips face the sky and are not culled.
 for(let j=0;j<along;j++)for(let i=0;i<across;i++){const a=j*(across+1)+i,b=a+1,c=a+across+1,d=c+1;index.push(a,b,c,b,d,c);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(index);g.computeVertexNormals();return g;
}
