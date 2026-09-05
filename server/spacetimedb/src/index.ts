import { schema, table, t, SenderError, type ReducerCtx, type InferSchema } from 'spacetimedb/server';
import { ScheduleAt, type Infer } from 'spacetimedb';
import { PICKUPS, travelSpeed, hitState, itemAt } from './items';
const player = table({public:true},{identity:t.identity().primaryKey(),room:t.string().index('btree'),name:t.string(),duckIndex:t.u8(),online:t.bool(),racesWon:t.u32(),racesPlayed:t.u32()});
const race = table({public:true},{id:t.string().primaryKey(),status:t.string(),phaseTicksLeft:t.u32(),finishCounter:t.u32(),raceNumber:t.u32(),winnerName:t.string(),winnerDuckIndex:t.u8()});
const racePlayer = table({public:true},{identity:t.identity().primaryKey(),room:t.string().index('btree'),name:t.string(),duckIndex:t.u8(),active:t.bool(),pos:t.f64(),vel:t.f64(),taps:t.u32(),boostMeter:t.u32(),boostTicksLeft:t.u32(),place:t.u32(),rank:t.u32(),lastTapAt:t.u64()});
const raceResult = table({public:true},{id:t.string().primaryKey(),room:t.string().index('btree'),raceNumber:t.u32(),identity:t.identity(),name:t.string(),duckIndex:t.u8(),place:t.u32(),taps:t.u32(),pos:t.f64()});
const raceItem = table({public:true},{identity:t.identity().primaryKey(),room:t.string().index('btree'),held:t.string(),nextPickup:t.u32(),slowTicks:t.u32(),shieldTicks:t.u32(),turboTicks:t.u32()});
const itemEffect = table({public:true},{id:t.u64().primaryKey().autoInc(),room:t.string().index('btree'),source:t.identity(),target:t.identity(),kind:t.string(),sourcePos:t.f64(),targetPos:t.f64(),flightTicks:t.u32(),lifeTicks:t.u32(),blocked:t.bool()});
const presence = table({public:true},{connectionId:t.connectionId().primaryKey(),identity:t.identity()});
const raceTick = table({}, {scheduledId:t.u64().primaryKey().autoInc(),scheduledAt:t.scheduleAt()});
const stdb = schema({player,race,racePlayer,raceResult,raceItem,itemEffect,presence,raceTick});
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
function joinRoom(ctx:Ctx,name:string,duckIndex:number,room:string){
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
}
export const join = stdb.reducer({name:t.string(),duckIndex:t.u8(),room:t.string()},(ctx,{name,duckIndex,room})=>joinRoom(ctx,name,duckIndex,room));
export const joinRandom = stdb.reducer({name:t.string(),duckIndex:t.u8()},(ctx,{name,duckIndex})=>{
 const current=ctx.db.racePlayer.identity.find(ctx.sender);
 if(current?.active&&['countdown','racing'].includes(ctx.db.race.id.find(current.room)?.status??''))throw new SenderError('Finish this race before finding another room.');
 // Match globally on the server so simultaneous clicks share the same live roster.
 const candidates=[...ctx.db.race.iter()].map(r=>({race:r,count:[...ctx.db.player.room.filter(r.id)].filter(p=>p.online&&!p.identity.isEqual(ctx.sender)).length})).filter(r=>r.count>0&&r.count<12);
 const waiting=candidates.filter(r=>r.race.status==='lobby'||r.race.status==='finished');
 const pool=waiting.length?waiting:candidates;
 let room:string;
 if(pool.length){pool.sort((a,b)=>a.race.id<b.race.id?-1:1);room=pool[ctx.random.integerInRange(0,pool.length-1)].race.id;}
 else{
  const publicRoom=ctx.db.race.id.find('PUBLIC');
  const publicCount=[...ctx.db.player.room.filter('PUBLIC')].filter(p=>p.online&&!p.identity.isEqual(ctx.sender)).length;
  if((!publicRoom||publicRoom.status==='lobby')&&publicCount<12)room='PUBLIC';
  else{do{room=`POND-${ctx.random.integerInRange(0,2176782335).toString(36).toUpperCase().padStart(6,'0')}`;}while(ctx.db.race.id.find(room));}
 }
 joinRoom(ctx,name,duckIndex,room);
});
export const startRace=stdb.reducer(ctx=>{
 const p=ctx.db.player.identity.find(ctx.sender);
 if(!p?.online||!ctx.db.racePlayer.identity.find(ctx.sender))throw new SenderError('Join a room before starting a race.');
 const current=ctx.db.race.id.find(p.room);
 if(!current)throw new SenderError('Join a room first.');
 if(current.status!=='lobby'&&current.status!=='finished')return; // Concurrent start clicks are idempotent.
 for(const result of ctx.db.raceResult.room.filter(p.room))ctx.db.raceResult.id.delete(result.id);
 for(const item of ctx.db.raceItem.room.filter(p.room))ctx.db.raceItem.identity.delete(item.identity);
 for(const effect of ctx.db.itemEffect.room.filter(p.room))ctx.db.itemEffect.id.delete(effect.id);
 for(const row of ctx.db.racePlayer.room.filter(p.room))ctx.db.racePlayer.identity.delete(row.identity);
 const rows=[...ctx.db.player.room.filter(p.room)].filter(user=>user.online).map(user=>lane(user)).sort(tie);
 rows.forEach((row,i)=>ctx.db.racePlayer.insert({...row,rank:i+1}));
 rows.forEach(row=>{ctx.db.raceItem.identity.delete(row.identity);ctx.db.raceItem.insert({identity:row.identity,room:p.room,held:'',nextPickup:0,slowTicks:0,shieldTicks:0,turboTicks:0});});
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
export const useItem = stdb.reducer(ctx=>{
 const racer=ctx.db.racePlayer.identity.find(ctx.sender),item=ctx.db.raceItem.identity.find(ctx.sender);
 if(!racer?.active||racer.place||!item||item.room!==racer.room||ctx.db.race.id.find(racer.room)?.status!=='racing')throw new SenderError('Items are for active racers.');
 if(!item.held)throw new SenderError('Collect an item buoy first.');
 if(item.held==='turbo'||item.held==='shield'){
  ctx.db.raceItem.identity.update({...item,held:'',...(item.held==='turbo'?{turboTicks:30,slowTicks:0}:{shieldTicks:60,slowTicks:0})});
  return;
 }
 const rivals=[...ctx.db.racePlayer.room.filter(racer.room)].filter(p=>p.active&&!p.place&&!p.identity.isEqual(ctx.sender));
 const ahead=rivals.filter(p=>p.pos>racer.pos).sort((a,b)=>a.pos-b.pos||tie(a,b));
 const target=item.held==='bubble'?ahead[0]:[...rivals].sort((a,b)=>Math.abs(a.pos-racer.pos)-Math.abs(b.pos-racer.pos)||tie(a,b))[0];
 if(!target)throw new SenderError(item.held==='bubble'?'No duck ahead. Save your bubble!':'No rivals in range. Save your bomb!');
 ctx.db.raceItem.identity.update({...item,held:''});
 ctx.db.itemEffect.insert({id:0n,room:racer.room,source:ctx.sender,target:target.identity,kind:item.held,sourcePos:racer.pos,targetPos:target.pos,flightTicks:6,lifeTicks:18,blocked:false});
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
   for(const effect of ctx.db.itemEffect.room.filter(room)){
    if(effect.lifeTicks<=1){ctx.db.itemEffect.id.delete(effect.id);continue;}
    let blocked=effect.blocked;
    if(effect.flightTicks===1){
     const target=ctx.db.racePlayer.identity.find(effect.target);
     if(target?.room===room&&target.active&&!target.place){
      const victims=[...ctx.db.racePlayer.room.filter(room)].filter(p=>p.active&&!p.place&&!p.identity.isEqual(effect.source)&&(effect.kind==='bomb'?Math.abs(p.pos-target.pos)<=180:p.identity.isEqual(target.identity)));
      for(const victim of victims){const state=ctx.db.raceItem.identity.find(victim.identity);if(state){if(victim.identity.isEqual(target.identity))blocked=state.shieldTicks>0;ctx.db.raceItem.identity.update({...state,...hitState(state,effect.kind)});}}
     }
    }
    ctx.db.itemEffect.id.update({...effect,blocked,flightTicks:Math.max(0,effect.flightTicks-1),lifeTicks:effect.lifeTicks-1});
   }
   const racers=[...ctx.db.racePlayer.room.filter(room)].filter(p=>p.active);
   const lanes=new Map([...racers].sort(tie).map((p,i)=>[p.identity.toHexString(),i]));
   const speeds=new Map(racers.map(p=>[p.identity.toHexString(),travelSpeed(p.vel,ctx.db.raceItem.identity.find(p.identity)??undefined)]));
   const speed=(p:Racer)=>speeds.get(p.identity.toHexString())??p.vel;
   // Interpolate crossing time within the tick, rather than relying on row iteration order.
   const crossing=racers.filter(p=>!p.place&&p.pos+speed(p)*.1>=TRACK).sort((a,b)=>(TRACK-a.pos)/Math.max(speed(a),.01)-(TRACK-b.pos)/Math.max(speed(b),.01)||tie(a,b));
   for(const p of crossing){award(ctx,r,p);if(p.place===1)r.phaseTicksLeft=Math.min(r.phaseTicksLeft,50);}
   for(const p of racers){
    p.pos=Math.min(TRACK,p.pos+speed(p)*.1);p.vel=p.place?0:p.vel*.88;p.boostTicksLeft=Math.max(0,p.boostTicksLeft-1);
    const item=ctx.db.raceItem.identity.find(p.identity);
    if(item){
     let {held,nextPickup}=item;
     while(nextPickup<PICKUPS.length&&p.pos>=PICKUPS[nextPickup]){if(!held&&!p.place){held=itemAt(lanes.get(p.identity.toHexString())??0,r.raceNumber,nextPickup);if(racers.length===1)held=held==='bomb'?'turbo':held==='bubble'?'shield':held;}nextPickup++;}
     ctx.db.raceItem.identity.update({...item,held,nextPickup,slowTicks:Math.max(0,item.slowTicks-1),shieldTicks:Math.max(0,item.shieldTicks-1),turboTicks:Math.max(0,item.turboTicks-1)});
    }
   }
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
