export const PAL={water:'#2273e6',sand:'#f2e5c9',pink:'#f0a8c0',yellow:'#f9c74f',navy:'#2b2d42',beak:'#e9a23b',paper:'#fffdf6'};
export const DUCKS=[['Classic Duck','the OG'],['Chef Duck','gordon quacksay'],['Police Duck','officer waddles'],['Knife Duck','stabby mcquack'],['Gun Duck','quackshot'],['Pirate Duck','captain quackbeard'],['Ninja Duck','shinobird'],['King Duck','sir quacksalot']];
export function laneX(id:string){let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);return ((hash>>>0)%10000)/10000*24-12;}
export const ordinal=(n:number)=>`${n}${n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th'}`;
