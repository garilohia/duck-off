import assert from 'node:assert/strict';
import {DbConnection} from '../src/module_bindings';
import {hitState,travelSpeed,itemAt,trackLayout,weightedItem,IMPACT,LANES} from '../../server/spacetimedb/src/items';

const normal={slowTicks:0,shieldTicks:0,turboTicks:0};
assert.equal(travelSpeed(200,normal),200);
assert.equal(travelSpeed(200,{...normal,slowTicks:25}),100);
assert.equal(travelSpeed(200,{...normal,turboTicks:30}),310);
assert.equal(travelSpeed(200,{...normal,slowTicks:25,turboTicks:30}),155);
assert.deepEqual(hitState({...normal,shieldTicks:60},'bomb'),normal);
assert.equal(hitState(normal,'bubble').slowTicks,18);
assert.equal(hitState(normal,'rock').slowTicks,IMPACT.rock.slow);assert.equal(hitState(normal,'log').slowTicks,IMPACT.log.slow);assert(IMPACT.log.keep>IMPACT.rock.keep,'logs are the softer bonk');
assert.equal(weightedItem('turbo',1,8),'shield');assert.equal(weightedItem('shield',8,8),'turbo');assert.equal(weightedItem('bomb',1,8),'bomb');assert.equal(weightedItem('turbo',1,2),'turbo');
assert.equal(hitState({...normal,slowTicks:24},'bomb').slowTicks,25);
assert.deepEqual(new Set(Array.from({length:4},(_,i)=>itemAt(0,1,i))),new Set(['bomb','bubble','turbo','shield']));
// Crossing order must use the actual slowed / boosted travel speed.
assert((2400-2390)/travelSpeed(200,{...normal,slowTicks:25}) > (2400-2385)/travelSpeed(200,{...normal,turboTicks:30}));
for(const seed of [1,2,3,4,5,6,77,12345,987654321]){
 const layout=trackLayout(seed);
 const bySeg=new Map<number,typeof layout>();for(const f of layout)bySeg.set(f.seq,[...(bySeg.get(f.seq)??[]),f]);
 for(const [seq,fs] of bySeg){
  assert(fs.every(f=>f.lane>=0&&f.lane<LANES&&f.pos===220+seq*200));
  const obstacles=fs.filter(f=>f.kind==='rock'||f.kind==='log'||f.kind==='whirlpool');
  assert(obstacles.length<=2,'obstacles never block more than two lanes');
  assert(new Set(fs.map(f=>f.lane)).size===fs.length,'one feature per lane spot');
  if(seq%2===0)assert.equal(fs.filter(f=>f.kind==='buoy').length,2,'buoys sit in two lanes only');
 }
 assert(layout.some(f=>f.kind==='rapids')&&layout.some(f=>f.kind==='rock')&&layout.some(f=>f.kind==='log'));
 assert.equal(layout.filter(f=>f.kind==='whirlpool').length,1,'exactly one whirlpool per river');
 assert(layout.filter(f=>f.kind==='rapids').every(f=>layout.filter(o=>o.kind==='rapids'&&o.seq===f.seq).length===2),'rapids span two lanes');
 const solo=trackLayout(seed,true);
 assert(solo.filter(f=>f.kind==='rock'||f.kind==='log').length>layout.filter(f=>f.kind==='rock'||f.kind==='log').length,'a solo run has more to dodge');
 assert(new Set(solo.map(f=>f.seq)).size===10&&solo.every(f=>solo.filter(o=>o.seq===f.seq).length<=LANES-1),'a solo run always leaves open water');
}
assert.notDeepEqual(trackLayout(77).map(f=>f.lane),trackLayout(12345).map(f=>f.lane),'different seeds give different rivers');
console.log('PASS: shields, non-stacking slowdowns, item rotation, modified crossing speeds and sparse track layouts.');

// Every test client heartbeats like the app does, so the 12-second staleness sweep never drops it.
const beats:ReturnType<typeof setInterval>[]=[];
const clients:DbConnection[]=[],room=`I-${Date.now().toString(36).toUpperCase()}`;
const uri=process.env.TEST_STDB_URI??'ws://127.0.0.1:3030',database=process.env.TEST_STDB_MODULE??'duckoff-items';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(check:()=>boolean,timeout=60000){const started=Date.now();while(!check()){if(Date.now()-started>timeout)throw Error(`Timed out waiting for: ${check.toString().slice(0,160)}`);await sleep(25)}}
async function connect(name:string,selectedRoom=room){return new Promise<DbConnection>((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(Error('Connection timeout')),20000);
 DbConnection.builder().withCompression('none').withUri(uri).withDatabaseName(database).onConnect(c=>{
  clients.push(c);beats.push(setInterval(()=>{try{void c.reducers.heartbeat({}).catch(()=>{})}catch{}},4000));c.subscriptionBuilder().onApplied(()=>{void c.reducers.join({name,duckIndex:clients.length%10,room:selectedRoom}).then(()=>{clearTimeout(timeout);resolve(c)},reject)}).subscribeToAllTables();
 }).onConnectError((_c,e)=>{clearTimeout(timeout);reject(e)}).build();
})}
// Hop lane by lane; each reducer call resolves once the caller's own row reflects the change.
// Send exactly the hops needed, then wait for the cache: a reducer can resolve a beat before its row update lands.
async function steer(c:DbConnection,lane:number){const row=()=>c.db.racePlayer.identity.find(c.identity!)!;for(let i=0;i<8&&row().lane!==lane;i++){const before=row().lane;await c.reducers.switchLane({direction:lane>before?1:-1});await until(()=>row().lane!==before,5000);}assert.equal(row().lane,lane);}

async function main(){
 // Eleven racers plus one spectator fill the room to its twelve-duck cap.
 const racers=await Promise.all(Array.from({length:11},(_,i)=>connect(`Toy Duck ${i+1}`)));
 const first=racers[0],state=(c:DbConnection)=>first.db.raceItem.identity.find(c.identity!)!;
 const row=(c:DbConnection)=>first.db.racePlayer.identity.find(c.identity!)!;
 const outsider=await connect('Separate duck',room+'-B');
 await assert.rejects(first.reducers.useItem({}));
 await first.reducers.startRace({});
 await until(()=>first.db.race.id.find(room)?.status==='countdown');
 const features=()=>[...first.db.raceFeature.iter()].filter(f=>f.room===room);
 await until(()=>features().length>=10);
 const layout=features().map(f=>({kind:f.kind,lane:f.lane,pos:f.pos,seq:f.seq}));
 assert.equal(layout.filter(f=>f.kind==='whirlpool').length,1);assert(layout.every(f=>f.pos===220+f.seq*200&&f.lane<LANES));
 assert.deepEqual(new Set(racers.map(c=>row(c).lane)),new Set([0,1,2,3,4]),'ducks start spread across all five lanes');
 // Obstacles and rapids are checked in later segments so coasting ducks never reach them early.
 const buoys=features().filter(f=>f.kind==='buoy'&&f.seq===0),obstacle=features().find(f=>f.seq===5&&f.kind!=='whirlpool')!,whirlpool=features().find(f=>f.kind==='whirlpool')!,rapids=features().filter(f=>f.kind==='rapids'&&f.seq===7);
 assert.equal(whirlpool.seq,5);
 // Everyone lines up on a buoy lane during the countdown; the spectator's hop is ignored.
 // Wait for each client's fresh race row first (startRace replaces the lobby rows, which carry rank 0).
 await until(()=>racers.every(c=>(c.db.racePlayer.identity.find(c.identity!)?.rank??0)>0));
 await Promise.all(racers.map((c,i)=>steer(c,buoys[i%2].lane)));
 await until(()=>first.db.race.id.find(room)?.status==='racing');
 // Tackle: hopping into the lane beside a rival at the start line shoves everyone within reach.
 const laneA=buoys[0].lane,tackler=racers.find(c=>row(c).lane!==laneA)!,targets=racers.filter(c=>row(c).lane===laneA);
 await steer(tackler,laneA);
 await until(()=>targets.every(c=>state(c).slowTicks>0));
 assert.equal(state(tackler).slowTicks,0,'the tackler is not slowed, only nudged');
 console.log('PASS: barging into a lane shoves the rivals beside you.');
 await until(()=>racers.every(c=>state(c).slowTicks===0));
 const spectator=await connect('Spectator');await assert.rejects(spectator.reducers.useItem({}));
 await spectator.reducers.switchLane({direction:1});assert.equal(spectator.db.racePlayer.identity.find(spectator.identity!)!.active,false);
 await assert.rejects(first.reducers.useItem({}));
 let timer:ReturnType<typeof setInterval>|undefined;
 let pending:Promise<void>[]=[];
 const paddling=(who=racers)=>{timer=setInterval(()=>{for(const c of who)pending.push(c.reducers.tap({}));},65)};
 const pause=async()=>{if(timer)clearInterval(timer);timer=undefined;await Promise.all(pending);pending=[]};
 try{
  paddling();await until(()=>racers.every(c=>!!state(c)?.held));await pause();
  assert.deepEqual(new Set(racers.map(c=>state(c).held)),new Set(['bomb','bubble','turbo','shield']));
  assert(racers.every(c=>row(c).pos>=220&&row(c).pos<620),'items came from the first buoy pair (ducks coast a long way once paddling pauses)');
  console.log('PASS: 11 racers steer into the first buoys and collect all four item types; spectators cannot use items or hop lanes.');
  const shields=racers.filter(c=>state(c).held==='shield'),turbo=racers.find(c=>state(c).held==='turbo')!;
  const keeper=shields.pop()!; // keeps the shield for the obstacle test below
  await Promise.all(shields.map(c=>c.reducers.useItem({})));
  await turbo.reducers.useItem({});
  await until(()=>shields.every(c=>state(c).shieldTicks>0)&&state(turbo).turboTicks>0);
  const bomber=racers.find(c=>state(c).held==='bomb')!;
  await bomber.reducers.useItem({});await assert.rejects(bomber.reducers.useItem({}));
  await until(()=>[...first.db.itemEffect.iter()].some(e=>e.room===room&&e.kind==='bomb'&&e.flightTicks===0));
  assert(shields.every(c=>state(c).shieldTicks===0&&state(c).slowTicks===0));
  assert.equal(state(bomber).slowTicks,0);
  assert(racers.some(c=>state(c).slowTicks>0));
  assert.equal(outsider.db.race.id.find(room+'-B')?.status,'lobby');
  assert.equal(first.db.racePlayer.identity.find(outsider.identity!)?.pos,0);
  assert.equal(first.db.raceItem.identity.find(spectator.identity!),null);
  console.log('PASS: bomb is consumed once, hits a group, excludes its thrower and other rooms, and shields absorb hits.');
  const bubble=racers.find(c=>state(c).held==='bubble'&&racers.some(other=>row(other).pos>row(c).pos))!;
  assert(bubble,'A homing-bubble holder should have a duck ahead');
  await bubble.reducers.useItem({});
  await until(()=>[...first.db.itemEffect.iter()].some(e=>e.room===room&&e.kind==='bubble'&&e.flightTicks===0));
  const shot=[...first.db.itemEffect.iter()].find(e=>e.room===room&&e.kind==='bubble')!;
  assert(first.db.raceItem.identity.find(shot.target)!.slowTicks>0);
  await until(()=>racers.every(c=>state(c).slowTicks===0&&state(c).turboTicks===0));
  console.log('PASS: homing bubbles hit an opponent ahead; slowdowns and turbo expire.');
  // Obstacles: a bare duck bonks, a shielded duck spends its shield; the rest swerve into open water.
  const victim=racers.find(c=>c!==keeper&&!state(c).held)!,sinker=racers.find(c=>c!==keeper&&c!==victim&&!state(c).held)!;
  assert(racers.every(c=>row(c).pos<obstacle.pos),'nobody has reached the first obstacle yet');
  const open=Array.from({length:LANES},(_,i)=>i).filter(l=>!features().some(f=>f.seq===obstacle.seq&&f.lane===l));
  await Promise.all(racers.map((c,i)=>steer(c,c===victim?obstacle.lane:c===keeper||c===sinker?whirlpool.lane:open[i%open.length])));
  await keeper.reducers.useItem({});await until(()=>state(keeper).shieldTicks>0);
  const velBefore=()=>row(victim).vel;
  paddling();await until(()=>racers.every(c=>row(c).pos>obstacle.pos+5||row(c).drowned));await pause();
  assert(state(victim).slowTicks>0,`the bare duck is slowed by the ${obstacle.kind}`);
  assert.equal(state(keeper).shieldTicks,0);assert.equal(state(keeper).slowTicks,0);assert.equal(row(keeper).drowned,false,'a shield saves you from the whirlpool');
  assert.equal(row(sinker).drowned,true,'a bare duck in the whirlpool lane goes under');assert.equal(row(sinker).vel,0);
  await sinker.reducers.tap({});await assert.rejects(sinker.reducers.useItem({}));
  assert(racers.filter(c=>c!==victim&&c!==keeper&&c!==sinker).every(c=>state(c).slowTicks===0),'ducks in open lanes are untouched');
  void velBefore;
  console.log(`PASS: ${obstacle.kind}s bonk a duck in their lane, the whirlpool drowns one and a shield saves another, open lanes are safe.`);
  // Rapids give a free boost to whoever rides them.
  await until(()=>racers.every(c=>state(c).slowTicks===0));
  const behind=racers.filter(c=>c!==victim&&c!==keeper&&!row(c).drowned&&row(c).pos<rapids[0].pos-40);assert(behind.length>=2,'two ducks still short of the rapids');
  const rider=behind[0],walker=behind[1];
  const dry=Array.from({length:LANES},(_,i)=>i).filter(l=>!rapids.some(f=>f.lane===l));
  await Promise.all(racers.filter(c=>!row(c).drowned).map((c,i)=>steer(c,c===rider?rapids[0].lane:dry[i%dry.length])));
  await Promise.all(racers.map(c=>c.reducers.tap({})));
  await until(()=>row(rider).boostTicksLeft===0&&row(walker).boostTicksLeft===0);
  paddling([rider,walker]);await until(()=>row(rider).pos>rapids[0].pos&&row(walker).pos>rapids[0].pos);
  assert(row(rider).boostTicksLeft>0||row(rider).pos>row(walker).pos+20,'the rapids rider is whooshed along');
  await pause();
  console.log('PASS: rapids whoosh the duck that rides them.');
  paddling();await until(()=>first.db.race.id.find(room)?.status==='finished');await pause();
  const results=[...first.db.raceResult.iter()].filter(r=>r.room===room).sort((a,b)=>a.place-b.place);
  assert.deepEqual(results.map(r=>r.place),Array.from({length:11},(_,i)=>i+1));
  assert.equal(results[10].identity.toHexString(),sinker.identity!.toHexString(),'the drowned duck finishes last');assert.equal(results[10].drowned,true);
  for(const c of racers){await until(()=>[...c.db.raceResult.iter()].filter(r=>r.room===room).length===11);assert.deepEqual([...c.db.raceResult.iter()].filter(r=>r.room===room).sort((a,b)=>a.place-b.place).map(r=>[r.identity.toHexString(),r.place]),results.map(r=>[r.identity.toHexString(),r.place]));}
  await assert.rejects(first.reducers.useItem({}));
  await first.reducers.startRace({});
  await until(()=>first.db.race.id.find(room)?.status==='countdown');
  assert(racers.every(c=>state(c).held===''&&state(c).slowTicks===0&&state(c).shieldTicks===0&&state(c).turboTicks===0));
  assert.equal([...first.db.itemEffect.iter()].filter(e=>e.room===room).length,0);
  await until(()=>features().length>=10&&features().every(f=>f.seq>=0));
  assert.equal(features().filter(f=>f.kind==='whirlpool').length,1,'a rematch lays out a fresh river with one whirlpool');
  console.log('PASS: all 11 clients agree on item-race results; rematches clear every item and effect and lay out a fresh river.');
  // Edge case: the whirlpool takes the only duck still swimming and nobody crossed, so the river wins and there is no podium.
  const solo=await connect('Solo swimmer',room+'-C');
  await solo.reducers.startRace({});await until(()=>solo.db.race.id.find(room+'-C')?.status==='countdown');
  const pool=[...solo.db.raceFeature.iter()].find(f=>f.room===room+'-C'&&f.kind==='whirlpool')!;
  await steer(solo,pool.lane);
  await until(()=>solo.db.race.id.find(room+'-C')?.status==='racing');
  paddling([solo]);await until(()=>solo.db.racePlayer.identity.find(solo.identity!)!.drowned);await pause();
  await until(()=>solo.db.race.id.find(room+'-C')?.status==='finished');
  const soloRace=solo.db.race.id.find(room+'-C')!;
  assert.equal(soloRace.solo,true);assert([...solo.db.raceFeature.iter()].filter(f=>f.room===room+'-C'&&(f.kind==='rock'||f.kind==='log')).length>layout.filter(f=>f.kind==='rock'||f.kind==='log').length,'a solo run is a denser obstacle course');
  assert.equal(soloRace.forfeited,true);assert.equal(soloRace.forfeitReason,'drowned');assert.equal(soloRace.winnerName,'');
  assert.equal([...solo.db.raceResult.iter()].filter(r=>r.room===room+'-C').length,0);
  assert.equal(solo.db.player.identity.find(solo.identity!)?.racesWon,0,'drowning is not a win');
  console.log('PASS: when every swimming duck drowns before anyone finishes, the race is forfeited with no winner.');
 }finally{await pause();}
}
main().then(()=>console.log('ALL ITEM CHECKS PASSED')).catch(e=>{console.error(e);process.exitCode=1}).finally(()=>(beats.forEach(clearInterval),clients.forEach(c=>c.disconnect())));
