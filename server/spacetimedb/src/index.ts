import { schema, table, t, SenderError, type ReducerCtx, type InferSchema } from 'spacetimedb/server';
import { ScheduleAt, type Infer, type Identity } from 'spacetimedb';
import { DUCK_COUNT, MAX_DUCKS, LANES, TRACK, AUTO_CRUISE, CRUISE_SPEED, STALE_AFTER_MICROS, IMPACT, DRAFT_RANGE, DRAFT_BONUS, TACKLE_RANGE, travelSpeed, hitState, itemAt, weightedItem, trackLayout } from './items';
const player = table({public:true},{identity:t.identity().primaryKey(),room:t.string().index('btree'),name:t.string(),duckIndex:t.u8(),online:t.bool(),racesWon:t.u32(),racesPlayed:t.u32(),lastSeen:t.timestamp()});
const race = table({public:true},{id:t.string().primaryKey(),status:t.string(),phaseTicksLeft:t.u32(),finishCounter:t.u32(),raceNumber:t.u32(),winnerName:t.string(),winnerDuckIndex:t.u8(),idleTicks:t.u32(),forfeited:t.bool(),forfeitReason:t.string(),solo:t.bool()});
const racePlayer = table({public:true},{identity:t.identity().primaryKey(),room:t.string().index('btree'),name:t.string(),duckIndex:t.u8(),active:t.bool(),lane:t.u8(),pos:t.f64(),vel:t.f64(),taps:t.u32(),boostMeter:t.u32(),boostTicksLeft:t.u32(),place:t.u32(),rank:t.u32(),lastTapAt:t.u64(),drowned:t.bool(),bonks:t.u32(),seconds:t.f64()});
const raceResult = table({public:true},{id:t.string().primaryKey(),room:t.string().index('btree'),raceNumber:t.u32(),identity:t.identity(),name:t.string(),duckIndex:t.u8(),place:t.u32(),taps:t.u32(),pos:t.f64(),drowned:t.bool(),bonks:t.u32(),seconds:t.f64()});
const raceItem = table({public:true},{identity:t.identity().primaryKey(),room:t.string().index('btree'),held:t.string(),slowTicks:t.u32(),shieldTicks:t.u32(),turboTicks:t.u32()});
// Buoys and obstacles for the current race, laid out per lane so ducks have to steer.
const raceFeature = table({public:true},{id:t.u64().primaryKey().autoInc(),room:t.string().index('btree'),kind:t.string(),lane:t.u8(),pos:t.f64(),seq:t.u32()});
const itemEffect = table({public:true},{id:t.u64().primaryKey().autoInc(),room:t.string().index('btree'),source:t.identity(),target:t.identity(),kind:t.string(),sourcePos:t.f64(),targetPos:t.f64(),flightTicks:t.u32(),lifeTicks:t.u32(),blocked:t.bool()});
const presence = table({public:true},{connectionId:t.connectionId().primaryKey(),identity:t.identity()});
const raceTick = table({}, {scheduledId:t.u64().primaryKey().autoInc(),scheduledAt:t.scheduleAt()});
const stdb = schema({player,race,racePlayer,raceResult,raceItem,itemEffect,raceFeature,presence,raceTick});
export default stdb;
type Ctx = ReducerCtx<InferSchema<typeof stdb>>;
type Racer = Infer<typeof racePlayer.rowType>;
const lane = (p:Infer<typeof player.rowType>,active=true,laneIndex=2):Racer => ({identity:p.identity,room:p.room,name:p.name,duckIndex:p.duckIndex,active,lane:laneIndex,pos:0,vel:0,taps:0,boostMeter:0,boostTicksLeft:0,place:0,rank:0,lastTapAt:0n,drowned:false,bonks:0,seconds:0});
const emptyRace=(id:string)=>({id,status:'lobby',phaseTicksLeft:0,finishCounter:0,raceNumber:1,winnerName:'',winnerDuckIndex:0,idleTicks:0,forfeited:false,forfeitReason:'',solo:false});
// A race where nobody paddles or steers for this long is forfeited: no winner, no podium.
const IDLE_FORFEIT_TICKS=150;
// Stable identity order resolves exact distance / crossing-time ties on every client.
function tie(a:Racer,b:Racer){const x=a.identity.toHexString(),y=b.identity.toHexString();return x<y?-1:x>y?1:0;}
// Finishers first, then ducks still swimming by distance, then anyone the whirlpool took (also by distance).
function standing(a:Racer,b:Racer){return a.place&&b.place?a.place-b.place:a.place?-1:b.place?1:a.drowned!==b.drowned?(a.drowned?1:-1):b.pos-a.pos||tie(a,b);}
const RACE_TICKS=400;
function award(ctx:Ctx,r:Infer<typeof race.rowType>,p:Racer){
 p.place=++r.finishCounter;p.seconds=(RACE_TICKS-r.phaseTicksLeft)/10;
 if(p.place===1){r.winnerName=p.name;r.winnerDuckIndex=p.duckIndex;const user=ctx.db.player.identity.find(p.identity);if(user&&!p.drowned)ctx.db.player.identity.update({...user,racesWon:user.racesWon+1});}
}
export const init = stdb.init(ctx=>{
 ctx.db.race.insert(emptyRace('PUBLIC'));
 ctx.db.raceTick.insert({scheduledId:0n,scheduledAt:ScheduleAt.interval(100_000n)});
});
export const onConnect = stdb.clientConnected(ctx=>{
 if(ctx.connectionId){ctx.db.presence.connectionId.delete(ctx.connectionId);ctx.db.presence.insert({connectionId:ctx.connectionId,identity:ctx.sender});}
 const p=ctx.db.player.identity.find(ctx.sender);if(p)ctx.db.player.identity.update({...p,online:true,lastSeen:ctx.timestamp});
});
// Phones that sleep or lose signal keep their socket open for a while; a heartbeat every few seconds
// tells the room the duck is really still here.
export const heartbeat = stdb.reducer(ctx=>{
 const p=ctx.db.player.identity.find(ctx.sender);if(!p)return;
 ctx.db.player.identity.update({...p,online:true,lastSeen:ctx.timestamp});
});
function dropOffline(ctx:Ctx,identity:Identity,room:string){
 if(ctx.db.race.id.find(room)?.status!=='racing'&&ctx.db.race.id.find(room)?.status!=='countdown')ctx.db.racePlayer.identity.delete(identity);
}
export const onDisconnect = stdb.clientDisconnected(ctx=>{
 if(ctx.connectionId)ctx.db.presence.connectionId.delete(ctx.connectionId);
 if([...ctx.db.presence.iter()].some(p=>p.identity.isEqual(ctx.sender)))return;
 const p=ctx.db.player.identity.find(ctx.sender);if(p)ctx.db.player.identity.update({...p,online:false});
 // Keep the race roster and podium intact when a phone disconnects or sleeps.
 if(ctx.db.race.id.find(p?.room??'PUBLIC')?.status==='lobby')ctx.db.racePlayer.identity.delete(ctx.sender);
});
function joinRoom(ctx:Ctx,name:string,duckIndex:number,room:string){
 if(duckIndex>=DUCK_COUNT)throw new SenderError(`Pick one of the ${DUCK_COUNT} ducks.`);
 room=room.trim().toUpperCase()||'PUBLIC';
 if(!/^[A-Z0-9-]{1,16}$/.test(room))throw new SenderError('Use 1–16 letters, numbers, or hyphens for the room.');
 const old=ctx.db.player.identity.find(ctx.sender),existing=ctx.db.racePlayer.identity.find(ctx.sender);
 // A room holds MAX_DUCKS ducks, counting everyone online there except the caller (who may already be a member).
 if(old?.room!==room&&[...ctx.db.player.room.filter(room)].filter(p=>p.online&&!p.identity.isEqual(ctx.sender)).length>=MAX_DUCKS)throw new SenderError(`That room is full (${MAX_DUCKS} ducks). Try another code or a random room.`);
 if(old&&old.room!==room){
  const previous=ctx.db.race.id.find(old.room);
  if(existing?.active&&previous&&['countdown','racing'].includes(previous.status))throw new SenderError('Finish this race before changing rooms. You can still change your duck for the next race.');
  ctx.db.racePlayer.identity.delete(ctx.sender);
 }
 if(!ctx.db.race.id.find(room))ctx.db.race.insert(emptyRace(room));
 const p={identity:ctx.sender,room,name:name.trim().replace(/[\u0000-\u001f]/g,'').slice(0,14)||'Duck',duckIndex,online:true,racesWon:old?.racesWon??0,racesPlayed:old?.racesPlayed??0,lastSeen:ctx.timestamp};
 if(old)ctx.db.player.identity.update(p);else ctx.db.player.insert(p);
 const r=ctx.db.race.id.find(room)!;
 // Cosmetic edits never reset progress or change the recorded finisher's name.
 if(existing?.room===room&&r.status!=='lobby')return;
 const row=lane(p,r.status==='lobby',[...ctx.db.racePlayer.room.filter(room)].length%LANES);
 if(ctx.db.racePlayer.identity.find(ctx.sender))ctx.db.racePlayer.identity.update(row);else ctx.db.racePlayer.insert(row);
}
export const join = stdb.reducer({name:t.string(),duckIndex:t.u8(),room:t.string()},(ctx,{name,duckIndex,room})=>joinRoom(ctx,name,duckIndex,room));
export const joinRandom = stdb.reducer({name:t.string(),duckIndex:t.u8()},(ctx,{name,duckIndex})=>{
 const current=ctx.db.racePlayer.identity.find(ctx.sender);
 if(current?.active&&['countdown','racing'].includes(ctx.db.race.id.find(current.room)?.status??''))throw new SenderError('Finish this race before finding another room.');
 // Match globally on the server so simultaneous clicks share the same live roster.
 const candidates=[...ctx.db.race.iter()].map(r=>({race:r,count:[...ctx.db.player.room.filter(r.id)].filter(p=>p.online&&!p.identity.isEqual(ctx.sender)).length})).filter(r=>r.count>0&&r.count<MAX_DUCKS);
 const waiting=candidates.filter(r=>r.race.status==='lobby'||r.race.status==='finished');
 const pool=waiting.length?waiting:candidates;
 let room:string;
 if(pool.length){pool.sort((a,b)=>a.race.id<b.race.id?-1:1);room=pool[ctx.random.integerInRange(0,pool.length-1)].race.id;}
 else{
  const publicRoom=ctx.db.race.id.find('PUBLIC');
  const publicCount=[...ctx.db.player.room.filter('PUBLIC')].filter(p=>p.online&&!p.identity.isEqual(ctx.sender)).length;
  if((!publicRoom||publicRoom.status==='lobby')&&publicCount<MAX_DUCKS)room='PUBLIC';
  else{do{room=`POND-${ctx.random.integerInRange(0,2176782335).toString(36).toUpperCase().padStart(6,'0')}`;}while(ctx.db.race.id.find(room));}
 }
 joinRoom(ctx,name,duckIndex,room);
});
// Back to the home screen: step out of the roster so the room no longer waits for this duck.
// Leaving mid-race simply drops the duck out of that race.
export const leaveRoom = stdb.reducer(ctx=>{
 const p=ctx.db.player.identity.find(ctx.sender);if(!p)return;
 ctx.db.player.identity.update({...p,online:false});
 ctx.db.racePlayer.identity.delete(ctx.sender);
 ctx.db.raceItem.identity.delete(ctx.sender);
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
 rows.forEach((row,i)=>ctx.db.racePlayer.insert({...row,rank:i+1,lane:i%LANES}));
 rows.forEach(row=>{ctx.db.raceItem.identity.delete(row.identity);ctx.db.raceItem.insert({identity:row.identity,room:p.room,held:'',slowTicks:0,shieldTicks:0,turboTicks:0});});
 const raceNumber=current.raceNumber+(current.status==='finished'?1:0),solo=rows.length===1;
 for(const f of ctx.db.raceFeature.room.filter(p.room))ctx.db.raceFeature.id.delete(f.id);
 // A fresh seed every race, so nobody can memorise where the whirlpool sits.
 for(const f of trackLayout(ctx.random.integerInRange(0,1_000_000_000),solo))ctx.db.raceFeature.insert({id:0n,room:p.room,...f});
 ctx.db.race.id.update({...emptyRace(p.room),status:'countdown',phaseTicksLeft:30,raceNumber,solo});
});
// Hop one lane left (-1) or right (+1). Allowed from the countdown so ducks can line up.
export const switchLane = stdb.reducer({direction:t.i8()},(ctx,{direction})=>{
 const p=ctx.db.racePlayer.identity.find(ctx.sender);if(!p)return;const r=ctx.db.race.id.find(p.room);
 if(!p.active||p.place||!r||!['countdown','racing'].includes(r.status))return;
 const next=Math.max(0,Math.min(LANES-1,p.lane+Math.sign(direction)));
 if(next===p.lane||p.drowned)return;
 let vel=p.vel;
 if(r.status==='racing'){
  // Barging into a lane shoves the rivals beside you; a shield takes the shove, and you lose a little pace too.
  for(const rival of ctx.db.racePlayer.room.filter(p.room)){
   if(rival.lane!==next||!rival.active||rival.place||rival.drowned||rival.identity.isEqual(ctx.sender)||Math.abs(rival.pos-p.pos)>TACKLE_RANGE)continue;
   const state=ctx.db.raceItem.identity.find(rival.identity);if(!state)continue;
   const shielded=state.shieldTicks>0;ctx.db.raceItem.identity.update({...state,...hitState(state,'tackle')});
   ctx.db.racePlayer.identity.update({...rival,vel:shielded?rival.vel:rival.vel*IMPACT.tackle.keep});
   vel*=.85;
  }
 }
 ctx.db.racePlayer.identity.update({...p,lane:next,vel});
 if(r.idleTicks)ctx.db.race.id.update({...r,idleTicks:0});
});
export const tap = stdb.reducer(ctx=>{
 if(AUTO_CRUISE)return; // Ducks swim by themselves in steer-only mode.
 const p=ctx.db.racePlayer.identity.find(ctx.sender);if(!p)return;const r=ctx.db.race.id.find(p.room);
 if(r?.status!=='racing'||!p.active||p.place||p.drowned)return;
 const now=ctx.timestamp.microsSinceUnixEpoch;if(now-p.lastTapAt<40_000n)return;
 const leader=Math.max(0,...[...ctx.db.racePlayer.room.filter(p.room)].filter(x=>x.active).map(x=>x.pos));
 let meter=p.boostMeter+1,boost=p.boostTicksLeft;if(meter>=20){meter=0;boost=20;}
 const impulse=18*(1+0.35*Math.max(0,leader-p.pos)/TRACK)*(boost>0?1.5:1);
 ctx.db.racePlayer.identity.update({...p,taps:p.taps+1,boostMeter:meter,boostTicksLeft:boost,vel:Math.min(260,p.vel+impulse),lastTapAt:now});
 if(r.idleTicks)ctx.db.race.id.update({...r,idleTicks:0});
});
export const useItem = stdb.reducer(ctx=>{
 const racer=ctx.db.racePlayer.identity.find(ctx.sender),item=ctx.db.raceItem.identity.find(ctx.sender);
 if(!racer?.active||racer.place||racer.drowned||!item||item.room!==racer.room||ctx.db.race.id.find(racer.room)?.status!=='racing')throw new SenderError('Items are for active racers.');
 if(!item.held)throw new SenderError('Collect an item buoy first.');
 if(item.held==='turbo'||item.held==='shield'){
  ctx.db.raceItem.identity.update({...item,held:'',...(item.held==='turbo'?{turboTicks:30,slowTicks:0}:{shieldTicks:60,slowTicks:0})});
  return;
 }
 const rivals=[...ctx.db.racePlayer.room.filter(racer.room)].filter(p=>p.active&&!p.place&&!p.drowned&&!p.identity.isEqual(ctx.sender));
 const ahead=rivals.filter(p=>p.pos>racer.pos).sort((a,b)=>a.pos-b.pos||tie(a,b));
 // Bombs go forward when there is anyone to catch, and only fall back to the duck behind when you lead.
 const nearest=(list:Racer[])=>[...list].sort((a,b)=>Math.abs(a.pos-racer.pos)-Math.abs(b.pos-racer.pos)||tie(a,b))[0];
 const target=item.held==='bubble'?ahead[0]:(nearest(ahead)??nearest(rivals));
 if(!target)throw new SenderError(item.held==='bubble'?'No duck ahead. Save your bubble!':'No rivals in range. Save your bomb!');
 ctx.db.raceItem.identity.update({...item,held:''});
 ctx.db.itemEffect.insert({id:0n,room:racer.room,source:ctx.sender,target:target.identity,kind:item.held,sourcePos:racer.pos,targetPos:target.pos,flightTicks:6,lifeTicks:18,blocked:false});
});
export const tick = stdb.reducer({onSchedule:raceTick},{arg:raceTick.rowType},ctx=>{
 if(!ctx.sender.isEqual(ctx.identity))throw new SenderError('Only the river clock can tick.');
 // Ducks whose phone went quiet stop counting as here; a lobby or podium lets them go, a live race keeps their lane.
 for(const p of ctx.db.player.iter())if(p.online&&ctx.timestamp.microsSinceUnixEpoch-p.lastSeen.microsSinceUnixEpoch>STALE_AFTER_MICROS){ctx.db.player.identity.update({...p,online:false});dropOffline(ctx,p.identity,p.room);}
 for(const current of ctx.db.race.iter()){
  const room=current.id;
  // An empty waiting room can be reclaimed. Active races and results survive disconnection.
  if(current.status==='lobby'){
   const online=[...ctx.db.player.room.filter(room)].filter(p=>p.online);
   for(const p of online)if(!ctx.db.racePlayer.identity.find(p.identity))ctx.db.racePlayer.insert(lane(p,true,[...ctx.db.racePlayer.room.filter(room)].length%LANES));
   if(!online.length&&room!=='PUBLIC')ctx.db.race.id.delete(room);
   continue; // Only startRace can begin the countdown.
  }
  if(current.status==='finished'){
   // Results stay until someone chooses Play again; a podium nobody is watching is cleaned up.
   if(room!=='PUBLIC'&&![...ctx.db.player.room.filter(room)].some(p=>p.online)){
    for(const result of ctx.db.raceResult.room.filter(room))ctx.db.raceResult.id.delete(result.id);
    for(const item of ctx.db.raceItem.room.filter(room))ctx.db.raceItem.identity.delete(item.identity);
    for(const effect of ctx.db.itemEffect.room.filter(room))ctx.db.itemEffect.id.delete(effect.id);
    for(const f of ctx.db.raceFeature.room.filter(room))ctx.db.raceFeature.id.delete(f.id);
    for(const row of ctx.db.racePlayer.room.filter(room))ctx.db.racePlayer.identity.delete(row.identity);
    ctx.db.race.id.delete(room);
   }
   continue;
  }
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
      const victims=[...ctx.db.racePlayer.room.filter(room)].filter(p=>p.active&&!p.place&&!p.drowned&&!p.identity.isEqual(effect.source)&&(effect.kind==='bomb'?Math.abs(p.pos-target.pos)<=180:p.identity.isEqual(target.identity)));
      for(const victim of victims){const state=ctx.db.raceItem.identity.find(victim.identity);if(state){if(victim.identity.isEqual(target.identity))blocked=state.shieldTicks>0;ctx.db.raceItem.identity.update({...state,...hitState(state,effect.kind)});}}
     }
    }
    ctx.db.itemEffect.id.update({...effect,blocked,flightTicks:Math.max(0,effect.flightTicks-1),lifeTicks:effect.lifeTicks-1});
   }
   const racers=[...ctx.db.racePlayer.room.filter(room)].filter(p=>p.active);
   if(AUTO_CRUISE){const leader=Math.max(0,...racers.map(p=>p.pos));for(const p of racers)if(!p.place&&!p.drowned)p.vel=Math.max(p.vel,CRUISE_SPEED*(1+.25*(leader-p.pos)/TRACK)*(p.boostTicksLeft?1.3:1));}
   const lanes=new Map([...racers].sort(tie).map((p,i)=>[p.identity.toHexString(),i]));
   const drafting=(p:Racer)=>racers.some(o=>o!==p&&o.lane===p.lane&&!o.drowned&&o.pos>p.pos&&o.pos-p.pos<=DRAFT_RANGE);
   const speeds=new Map(racers.map(p=>[p.identity.toHexString(),p.drowned?0:travelSpeed(p.vel,ctx.db.raceItem.identity.find(p.identity)??undefined)*(drafting(p)?DRAFT_BONUS:1)]));
   const speed=(p:Racer)=>speeds.get(p.identity.toHexString())??p.vel;
   // Interpolate crossing time within the tick, rather than relying on row iteration order.
   const crossing=racers.filter(p=>!p.place&&p.pos+speed(p)*.1>=TRACK).sort((a,b)=>(TRACK-a.pos)/Math.max(speed(a),.01)-(TRACK-b.pos)/Math.max(speed(b),.01)||tie(a,b));
   for(const p of crossing){award(ctx,r,p);if(p.place===1)r.phaseTicksLeft=Math.min(r.phaseTicksLeft,50);}
   const features=[...ctx.db.raceFeature.room.filter(room)];
   for(const p of racers){
    const from=p.pos;
    p.pos=Math.min(TRACK,p.pos+speed(p)*.1);p.vel=p.place?0:p.vel*.88;p.boostTicksLeft=Math.max(0,p.boostTicksLeft-1);
    const item=ctx.db.raceItem.identity.find(p.identity);
    if(item){
     let state={held:item.held,slowTicks:Math.max(0,item.slowTicks-1),shieldTicks:Math.max(0,item.shieldTicks-1),turboTicks:Math.max(0,item.turboTicks-1)};
     // Anything in this lane between last tick's position and this one is crossed now.
     if(!p.place&&!p.drowned)for(const f of features.filter(f=>f.lane===p.lane&&f.pos>from&&f.pos<=p.pos).sort((a,b)=>a.pos-b.pos)){
      if(f.kind==='buoy'){if(!state.held){let held=weightedItem(itemAt(lanes.get(p.identity.toHexString())??0,r.raceNumber,f.seq),p.rank,racers.length);if(racers.length===1)held=held==='bomb'?'turbo':held==='bubble'?'shield':held;state.held=held;}}
      else if(f.kind==='rapids'){p.vel=Math.min(260,p.vel+45);p.boostTicksLeft=Math.max(p.boostTicksLeft,15);}
      else if(f.kind==='whirlpool'){if(state.shieldTicks>0)state.shieldTicks=0;else{p.drowned=true;p.vel=0;p.boostTicksLeft=0;state.held='';break;}}
      else{const before=state.shieldTicks;state={...state,...hitState(state,f.kind)};if(!before){p.vel*=IMPACT[f.kind]?.keep??.5;p.bonks++;}}
     }
     ctx.db.raceItem.identity.update({...item,...state});
    }
   }
   racers.sort(standing);
   const swimming=racers.filter(p=>!p.place&&!p.drowned);
   r.idleTicks=swimming.length&&swimming.every(p=>speed(p)<1)?r.idleTicks+1:0;
   // No podium when there is nothing to crown: everyone left, nobody crossed and the whirlpool got the rest,
   // or the whole field sat still for 15 seconds. Ducks that already crossed keep their places.
   // A solo run is never forfeited for standing still; it is a practice course and simply waits.
   const forfeit=!r.finishCounter&&(!racers.length?'empty':racers.every(p=>p.drowned)?'drowned':r.idleTicks>=IDLE_FORFEIT_TICKS&&racers.length>1?'idle':'');
   if(forfeit){
    r.status='finished';r.forfeited=true;r.forfeitReason=forfeit;r.phaseTicksLeft=0;r.winnerName='';
    racers.forEach((p,i)=>ctx.db.racePlayer.identity.update({...p,rank:i+1,vel:0}));
    ctx.db.race.id.update(r);continue;
   }
   if(r.phaseTicksLeft===0||racers.every(p=>p.place>0||p.drowned)){
    for(const p of racers)if(!p.place)award(ctx,r,p);
    r.status='finished';r.phaseTicksLeft=0;
    for(const p of racers)ctx.db.raceResult.insert({id:`${room}:${r.raceNumber}:${p.identity.toHexString()}`,room,raceNumber:r.raceNumber,identity:p.identity,name:p.name,duckIndex:p.duckIndex,place:p.place,taps:p.taps,pos:p.pos,drowned:p.drowned,bonks:p.bonks,seconds:p.seconds});
   }
   racers.forEach((p,i)=>ctx.db.racePlayer.identity.update({...p,rank:i+1,vel:r.status==='finished'?0:p.vel}));
  }
  ctx.db.race.id.update(r);
 }
});
