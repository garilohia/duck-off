export const PAL={water:'#428fda',deep:'#2854c7',sand:'#fce4d9',pink:'#f27860',yellow:'#ffd02b',navy:'#173d72',beak:'#f58220',paper:'#fffdf5',foam:'#e2f3ff'};
export const DUCKS=[['Buttercup','a little pocket of sunshine'],['Pudding','bakes hugs, mostly'],['Skipper','tiny sailor. big feelings.'],['Berry','berry small. berry brave.'],['Sprout','growing at their own pace'],['Captain Pip','steals hearts, not treasure'],['Mochi','soft on the outside. also inside.'],['Your Fluffiness','royally round']];
export const DUCK_COLORS=['#ffcb0d','#ffd21a','#ffcc12','#ffcf1c','#ffd324','#ffc70e','#ffd52b','#ffcd16'];
export function laneX(id:string){let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);return ((hash>>>0)%10000)/10000*24-12;}
export const ordinal=(n:number)=>`${n}${n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th'}`;
