export const PAL={water:'#58b7dc',deep:'#236cb5',sand:'#fcdea8',pink:'#f6aa76',yellow:'#ffcf59',navy:'#103e70',beak:'#ed8838',paper:'#fff9e9',foam:'#d9f5ff'};
export const DUCKS=[['Buttercup','a little pocket of sunshine'],['Pudding','bakes hugs, mostly'],['Skipper','tiny sailor. big feelings.'],['Berry','berry small. berry brave.'],['Sprout','growing at their own pace'],['Captain Pip','steals hearts, not treasure'],['Mochi','soft on the outside. also inside.'],['Your Fluffiness','royally round']];
export const DUCK_COLORS=['#ffcf59','#ffe49b','#ffdc7b','#fff0c4','#ffda73','#ffd56b','#fff0cc','#ffe08a'];
export function laneX(id:string){let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);return ((hash>>>0)%10000)/10000*24-12;}
export const ordinal=(n:number)=>`${n}${n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th'}`;
