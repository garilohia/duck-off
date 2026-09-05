import { schema, table, t, SenderError } from 'spacetimedb/server';
import { ScheduleAt, type Infer } from 'spacetimedb';
const player = table({public:true},{identity:t.identity().primaryKey(),room:t.string().index('btree'),name:t.string(),duckIndex:t.u8(),online:t.bool(),racesWon:t.u32(),racesPlayed:t.u32()});
const race = table({public:true},{id:t.string().primaryKey(),status:t.string(),phaseTicksLeft:t.u32(),finishCounter:t.u32(),raceNumber:t.u32(),winnerName:t.string(),winnerDuckIndex:t.u8()});
const racePlayer = table({public:true},{identity:t.identity().primaryKey(),room:t.string().index('btree'),name:t.string(),duckIndex:t.u8(),active:t.bool(),pos:t.f64(),vel:t.f64(),taps:t.u32(),boostMeter:t.u32(),boostTicksLeft:t.u32(),place:t.u32(),rank:t.u32(),lastTapAt:t.u64()});
const presence = table({public:true},{connectionId:t.connectionId().primaryKey(),identity:t.identity()});
const raceTick = table({}, {scheduledId:t.u64().primaryKey().autoInc(),scheduledAt:t.scheduleAt()});
const stdb = schema({player,race,racePlayer,presence,raceTick});
export default stdb;
const TRACK=2400;
const lane = (p:Infer<typeof player.rowType>,active=true) => ({identity:p.identity,room:p.room,name:p.name,duckIndex:p.duckIndex,active,pos:0,vel:0,taps:0,boostMeter:0,boostTicksLeft:0,place:0,rank:1,lastTapAt:0n});
export const init = stdb.init(ctx=>{
 ctx.db.race.insert({id:'PUBLIC',status:'lobby',phaseTicksLeft:80,finishCounter:0,raceNumber:1,winnerName:'',winnerDuckIndex:0});
 ctx.db.raceTick.insert({scheduledId:0n,scheduledAt:ScheduleAt.interval(100_000n)});
});
export const onConnect = stdb.clientConnected(ctx=>{
 // Disconnect hooks remove live presence. Preserve other live tabs sharing a token.
 if(ctx.connectionId){ctx.db.presence.connectionId.delete(ctx.connectionId);ctx.db.presence.insert({connectionId:ctx.connectionId,identity:ctx.sender});}
 const p=ctx.db.player.identity.find(ctx.sender);if(p)ctx.db.player.identity.update({...p,online:true});
});
export const onDisconnect = stdb.clientDisconnected(ctx=>{
 if(ctx.connectionId)ctx.db.presence.connectionId.delete(ctx.connectionId);
 if([...ctx.db.presence.iter()].some(p=>p.identity.isEqual(ctx.sender)))return;
 const p=ctx.db.player.identity.find(ctx.sender);if(p)ctx.db.player.identity.update({...p,online:false});
 if(ctx.db.race.id.find(p?.room??'PUBLIC')?.status!=='racing')ctx.db.racePlayer.identity.delete(ctx.sender);
});
export const join = stdb.reducer({name:t.string(),duckIndex:t.u8(),room:t.string()},(ctx,{name,duckIndex,room})=>{
 if(duckIndex>7)throw new SenderError('Pick one of the eight ducks.');
 room=room.trim().toUpperCase()||'PUBLIC';
 if(!/^[A-Z0-9-]{1,16}$/.test(room))throw new SenderError('Use 1–16 letters, numbers, or hyphens for the room.');
 if(!ctx.db.race.id.find(room))ctx.db.race.insert({id:room,status:'lobby',phaseTicksLeft:80,finishCounter:0,raceNumber:1,winnerName:'',winnerDuckIndex:0});
 const old=ctx.db.player.identity.find(ctx.sender);
 if(old&&old.room!==room)ctx.db.racePlayer.identity.delete(ctx.sender);
 const p={identity:ctx.sender,room,name:name.trim().replace(/[\u0000-\u001f]/g,'').slice(0,14)||'Duck',duckIndex,online:true,racesWon:old?.racesWon??0,racesPlayed:old?.racesPlayed??0};
 if(old)ctx.db.player.identity.update(p);else ctx.db.player.insert(p);
 const r=ctx.db.race.id.find(room)!;const existing=ctx.db.racePlayer.identity.find(ctx.sender);
 if(existing && (r.status==='racing'||r.status==='finished'))return;
 const row=lane(p,r.status==='lobby'||r.status==='countdown');
 if(existing)ctx.db.racePlayer.identity.update(row);else ctx.db.racePlayer.insert(row);
});
export const tap = stdb.reducer(ctx=>{
 const p=ctx.db.racePlayer.identity.find(ctx.sender);if(!p)return;const r=ctx.db.race.id.find(p.room)!;
 if(r.status!=='racing'||!p?.active||p.place)return;
 const now=ctx.timestamp.microsSinceUnixEpoch;if(now-p.lastTapAt<40_000n)return;
 const leader=Math.max(0,...[...ctx.db.racePlayer.room.filter(p.room)].filter(x=>x.active).map(x=>x.pos));
 let meter=p.boostMeter+1,boost=p.boostTicksLeft;if(meter>=20){meter=0;boost=20;}
 const impulse=18*(1+0.35*Math.max(0,leader-p.pos)/TRACK)*(boost>0?1.5:1);
 ctx.db.racePlayer.identity.update({...p,taps:p.taps+1,boostMeter:meter,boostTicksLeft:boost,vel:Math.min(260,p.vel+impulse),lastTapAt:now});
});
export const tick = stdb.reducer({onSchedule:raceTick},{arg:raceTick.rowType},(ctx)=>{
 if(!ctx.sender.isEqual(ctx.identity))throw new SenderError('Only the river clock can tick.');
 for(const currentRace of ctx.db.race.iter()){
 const room=currentRace.id;
 let r=currentRace;
 if(![...ctx.db.player.room.filter(room)].some(p=>p.online)){
  for(const p of ctx.db.racePlayer.room.filter(room))ctx.db.racePlayer.identity.delete(p.identity);
  if(room!=='PUBLIC')ctx.db.race.id.delete(room);
  else ctx.db.race.id.update({...r,status:'lobby',phaseTicksLeft:80,finishCounter:0,winnerName:'',winnerDuckIndex:0});
  continue;
 }
 if(r.status==='lobby'){
  for(const p of ctx.db.player.room.filter(room))if(p.online&&!ctx.db.racePlayer.identity.find(p.identity))ctx.db.racePlayer.insert(lane(p));
  if(![...ctx.db.racePlayer.room.filter(room)].some(p=>p.active)){ctx.db.race.id.update({...r,phaseTicksLeft:80});continue;}
 }
 r={...r,phaseTicksLeft:Math.max(0,r.phaseTicksLeft-1)};
 if(r.status==='lobby'&&r.phaseTicksLeft===0){r.status='countdown';r.phaseTicksLeft=30;}
 else if(r.status==='countdown'&&r.phaseTicksLeft===0){r.status='racing';r.phaseTicksLeft=400;for(const p of ctx.db.racePlayer.room.filter(room))if(p.active){const user=ctx.db.player.identity.find(p.identity);if(user)ctx.db.player.identity.update({...user,racesPlayed:user.racesPlayed+1});}}
 else if(r.status==='racing'){
  const racers=[...ctx.db.racePlayer.room.filter(room)].filter(p=>p.active);
  const crossing=racers.filter(p=>!p.place&&p.pos+p.vel*.1>=TRACK).sort((a,b)=>(TRACK-a.pos)/Math.max(a.vel,.01)-(TRACK-b.pos)/Math.max(b.vel,.01));
  for(const p of crossing){r.finishCounter++;p.place=r.finishCounter;if(p.place===1){r.winnerName=p.name;r.winnerDuckIndex=p.duckIndex;r.phaseTicksLeft=Math.min(r.phaseTicksLeft,50);const user=ctx.db.player.identity.find(p.identity);if(user)ctx.db.player.identity.update({...user,racesWon:user.racesWon+1});}}
  for(const p of racers){p.pos=Math.min(TRACK,p.pos+p.vel*.1);p.vel=p.place?0:p.vel*.88;p.boostTicksLeft=Math.max(0,p.boostTicksLeft-1);}
  racers.sort((a,b)=>a.place&&b.place?a.place-b.place:a.place?-1:b.place?1:b.pos-a.pos||a.identity.toHexString().localeCompare(b.identity.toHexString()));
  racers.forEach((p,i)=>ctx.db.racePlayer.identity.update({...p,rank:i+1}));
  if(r.phaseTicksLeft===0||racers.every(p=>p.place>0)){
   // At the cap, server ranks unfinished ducks by distance; no client authority.
   for(const p of racers)if(!p.place){r.finishCounter++;ctx.db.racePlayer.identity.update({...p,place:r.finishCounter,vel:0});if(r.finishCounter===1){r.winnerName=p.name;r.winnerDuckIndex=p.duckIndex;const user=ctx.db.player.identity.find(p.identity);if(user)ctx.db.player.identity.update({...user,racesWon:user.racesWon+1});}}
   r.status='finished';r.phaseTicksLeft=100;
  }
 }else if(r.status==='finished'&&r.phaseTicksLeft===0){
  for(const p of ctx.db.racePlayer.room.filter(room))ctx.db.racePlayer.identity.delete(p.identity);
  for(const p of ctx.db.player.room.filter(room))if(p.online)ctx.db.racePlayer.insert(lane(p));
  r={...r,status:'lobby',phaseTicksLeft:80,finishCounter:0,raceNumber:r.raceNumber+1,winnerName:'',winnerDuckIndex:0};
 }
 ctx.db.race.id.update(r);
 }
});
