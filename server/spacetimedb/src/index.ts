import { schema, table, t, SenderError, type ReducerCtx, type InferSchema } from 'spacetimedb/server';
import { ScheduleAt, type Infer } from 'spacetimedb';
const player = table({public:true},{identity:t.identity().primaryKey(),room:t.string().index('btree'),name:t.string(),duckIndex:t.u8(),online:t.bool(),racesWon:t.u32(),racesPlayed:t.u32()});
const race = table({public:true},{id:t.string().primaryKey(),status:t.string(),phaseTicksLeft:t.u32(),finishCounter:t.u32(),raceNumber:t.u32(),winnerName:t.string(),winnerDuckIndex:t.u8()});
const racePlayer = table({public:true},{identity:t.identity().primaryKey(),room:t.string().index('btree'),name:t.string(),duckIndex:t.u8(),active:t.bool(),pos:t.f64(),vel:t.f64(),taps:t.u32(),boostMeter:t.u32(),boostTicksLeft:t.u32(),place:t.u32(),rank:t.u32(),lastTapAt:t.u64()});
const raceResult = table({public:true},{id:t.string().primaryKey(),room:t.string().index('btree'),raceNumber:t.u32(),identity:t.identity(),name:t.string(),duckIndex:t.u8(),place:t.u32(),taps:t.u32(),pos:t.f64()});
const presence = table({public:true},{connectionId:t.connectionId().primaryKey(),identity:t.identity()});
const raceTick = table({}, {scheduledId:t.u64().primaryKey().autoInc(),scheduledAt:t.scheduleAt()});
const stdb = schema({player,race,racePlayer,raceResult,presence,raceTick});
export default stdb;
type Ctx = ReducerCtx<InferSchema<typeof stdb>>;
type Racer = Infer<typeof racePlayer.rowType>;
const TRACK=2400;
const lane = (p:Infer<typeof player.rowType>,active=true):Racer => ({identity:p.identity,room:p.room,name:p.name,duckIndex:p.duckIndex,active,pos:0,vel:0,taps:0,boostMeter:0,boostTicksLeft:0,place:0,rank:0,lastTapAt:0n});
const emptyRace=(id:string)=>({id,status:'lobby',phaseTicksLeft:0,finishCounter:0,raceNumber:1,winnerName:'',winnerDuckIndex:0});
// Stable identity order resolves exact distance / crossing-time ties on every client.
function tie(a:Racer,b:Racer){const x=a.identity.toHexString(),y=b.identity.toHexString();return x<y?-1:x>y?1:0;}
function standing(a:Racer,b:Racer){return a.place&&b.place?a.place-b.place:a.place?-1:b.place?1:b.pos-a.pos||tie(a,b);}
function award(ctx:Ctx,r:Infer<typeof race.rowType>,p:Racer){
 p.place=++r.finishCounter;
 if(p.place===1){r.winnerName=p.name;r.winnerDuckIndex=p.duckIndex;const user=ctx.db.player.identity.find(p.identity);if(user)ctx.db.player.identity.update({...user,racesWon:user.racesWon+1});}
}
export const init = stdb.init(ctx=>{
 ctx.db.race.insert(emptyRace('PUBLIC'));
 ctx.db.raceTick.insert({scheduledId:0n,scheduledAt:ScheduleAt.interval(100_000n)});
});
export const onConnect = stdb.clientConnected(ctx=>{
 if(ctx.connectionId){ctx.db.presence.connectionId.delete(ctx.connectionId);ctx.db.presence.insert({connectionId:ctx.connectionId,identity:ctx.sender});}
 const p=ctx.db.player.identity.find(ctx.sender);if(p)ctx.db.player.identity.update({...p,online:true});
});
export const onDisconnect = stdb.clientDisconnected(ctx=>{
 if(ctx.connectionId)ctx.db.presence.connectionId.delete(ctx.connectionId);
 if([...ctx.db.presence.iter()].some(p=>p.identity.isEqual(ctx.sender)))return;
 const p=ctx.db.player.identity.find(ctx.sender);if(p)ctx.db.player.identity.update({...p,online:false});
 // Keep the race roster and podium intact when a phone disconnects or sleeps.
 if(ctx.db.race.id.find(p?.room??'PUBLIC')?.status==='lobby')ctx.db.racePlayer.identity.delete(ctx.sender);
});
export const join = stdb.reducer({name:t.string(),duckIndex:t.u8(),room:t.string()},(ctx,{name,duckIndex,room})=>{
 if(duckIndex>7)throw new SenderError('Pick one of the eight ducks.');
 room=room.trim().toUpperCase()||'PUBLIC';
 if(!/^[A-Z0-9-]{1,16}$/.test(room))throw new SenderError('Use 1–16 letters, numbers, or hyphens for the room.');
 const old=ctx.db.player.identity.find(ctx.sender),existing=ctx.db.racePlayer.identity.find(ctx.sender);
 if(old&&old.room!==room){
  const previous=ctx.db.race.id.find(old.room);
  if(existing?.active&&previous&&['countdown','racing'].includes(previous.status))throw new SenderError('Finish this race before changing rooms. You can still change your duck for the next race.');
  ctx.db.racePlayer.identity.delete(ctx.sender);
 }
 if(!ctx.db.race.id.find(room))ctx.db.race.insert(emptyRace(room));
 const p={identity:ctx.sender,room,name:name.trim().replace(/[\u0000-\u001f]/g,'').slice(0,14)||'Duck',duckIndex,online:true,racesWon:old?.racesWon??0,racesPlayed:old?.racesPlayed??0};
 if(old)ctx.db.player.identity.update(p);else ctx.db.player.insert(p);
 const r=ctx.db.race.id.find(room)!;
 // Cosmetic edits never reset progress or change the recorded finisher's name.
 if(existing?.room===room&&r.status!=='lobby')return;
 const row=lane(p,r.status==='lobby');
 if(ctx.db.racePlayer.identity.find(ctx.sender))ctx.db.racePlayer.identity.update(row);else ctx.db.racePlayer.insert(row);
});
export const startRace=stdb.reducer(ctx=>{
 const p=ctx.db.player.identity.find(ctx.sender);
 if(!p?.online||!ctx.db.racePlayer.identity.find(ctx.sender))throw new SenderError('Join a room before starting a race.');
 const current=ctx.db.race.id.find(p.room);
 if(!current)throw new SenderError('Join a room first.');
 if(current.status!=='lobby'&&current.status!=='finished')return; // Concurrent start clicks are idempotent.
 for(const result of ctx.db.raceResult.room.filter(p.room))ctx.db.raceResult.id.delete(result.id);
 for(const row of ctx.db.racePlayer.room.filter(p.room))ctx.db.racePlayer.identity.delete(row.identity);
 const rows=[...ctx.db.player.room.filter(p.room)].filter(user=>user.online).map(user=>lane(user)).sort(tie);
 rows.forEach((row,i)=>ctx.db.racePlayer.insert({...row,rank:i+1}));
 ctx.db.race.id.update({...emptyRace(p.room),status:'countdown',phaseTicksLeft:30,raceNumber:current.raceNumber+(current.status==='finished'?1:0)});
});
export const tap = stdb.reducer(ctx=>{
 const p=ctx.db.racePlayer.identity.find(ctx.sender);if(!p)return;const r=ctx.db.race.id.find(p.room);
 if(r?.status!=='racing'||!p.active||p.place)return;
 const now=ctx.timestamp.microsSinceUnixEpoch;if(now-p.lastTapAt<40_000n)return;
 const leader=Math.max(0,...[...ctx.db.racePlayer.room.filter(p.room)].filter(x=>x.active).map(x=>x.pos));
 let meter=p.boostMeter+1,boost=p.boostTicksLeft;if(meter>=20){meter=0;boost=20;}
 const impulse=18*(1+0.35*Math.max(0,leader-p.pos)/TRACK)*(boost>0?1.5:1);
 ctx.db.racePlayer.identity.update({...p,taps:p.taps+1,boostMeter:meter,boostTicksLeft:boost,vel:Math.min(260,p.vel+impulse),lastTapAt:now});
});
export const tick = stdb.reducer({onSchedule:raceTick},{arg:raceTick.rowType},ctx=>{
 if(!ctx.sender.isEqual(ctx.identity))throw new SenderError('Only the river clock can tick.');
 for(const current of ctx.db.race.iter()){
  const room=current.id;
  // An empty waiting room can be reclaimed. Active races and results survive disconnection.
  if(current.status==='lobby'){
   const online=[...ctx.db.player.room.filter(room)].filter(p=>p.online);
   for(const p of online)if(!ctx.db.racePlayer.identity.find(p.identity))ctx.db.racePlayer.insert(lane(p));
   if(!online.length&&room!=='PUBLIC')ctx.db.race.id.delete(room);
   continue; // Only startRace can begin the countdown.
  }
  if(current.status==='finished')continue; // Results stay until someone chooses Play again.
  const r={...current,phaseTicksLeft:Math.max(0,current.phaseTicksLeft-1)};
  if(r.status==='countdown'&&r.phaseTicksLeft===0){
   r.status='racing';r.phaseTicksLeft=400;
   for(const p of ctx.db.racePlayer.room.filter(room))if(p.active){const user=ctx.db.player.identity.find(p.identity);if(user)ctx.db.player.identity.update({...user,racesPlayed:user.racesPlayed+1});}
  }else if(r.status==='racing'){
   const racers=[...ctx.db.racePlayer.room.filter(room)].filter(p=>p.active);
   // Interpolate crossing time within the tick, rather than relying on row iteration order.
   const crossing=racers.filter(p=>!p.place&&p.pos+p.vel*.1>=TRACK).sort((a,b)=>(TRACK-a.pos)/Math.max(a.vel,.01)-(TRACK-b.pos)/Math.max(b.vel,.01)||tie(a,b));
   for(const p of crossing){award(ctx,r,p);if(p.place===1)r.phaseTicksLeft=Math.min(r.phaseTicksLeft,50);}
   for(const p of racers){p.pos=Math.min(TRACK,p.pos+p.vel*.1);p.vel=p.place?0:p.vel*.88;p.boostTicksLeft=Math.max(0,p.boostTicksLeft-1);}
   racers.sort(standing);
   if(r.phaseTicksLeft===0||racers.every(p=>p.place>0)){
    for(const p of racers)if(!p.place)award(ctx,r,p);
    r.status='finished';r.phaseTicksLeft=0;
    for(const p of racers)ctx.db.raceResult.insert({id:`${room}:${r.raceNumber}:${p.identity.toHexString()}`,room,raceNumber:r.raceNumber,identity:p.identity,name:p.name,duckIndex:p.duckIndex,place:p.place,taps:p.taps,pos:p.pos});
   }
   racers.forEach((p,i)=>ctx.db.racePlayer.identity.update({...p,rank:i+1,vel:r.status==='finished'?0:p.vel}));
  }
  ctx.db.race.id.update(r);
 }
});
