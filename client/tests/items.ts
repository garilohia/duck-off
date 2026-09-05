import assert from 'node:assert/strict';
import {DbConnection} from '../src/module_bindings';
import {hitState,travelSpeed,itemAt} from '../../server/spacetimedb/src/items';

const normal={slowTicks:0,shieldTicks:0,turboTicks:0};
assert.equal(travelSpeed(200,normal),200);
assert.equal(travelSpeed(200,{...normal,slowTicks:25}),100);
assert.equal(travelSpeed(200,{...normal,turboTicks:30}),310);
assert.equal(travelSpeed(200,{...normal,slowTicks:25,turboTicks:30}),155);
assert.deepEqual(hitState({...normal,shieldTicks:60},'bomb'),normal);
assert.equal(hitState(normal,'bubble').slowTicks,18);
assert.equal(hitState({...normal,slowTicks:24},'bomb').slowTicks,25);
assert.deepEqual(new Set(Array.from({length:4},(_,i)=>itemAt(0,1,i))),new Set(['bomb','bubble','turbo','shield']));
// Crossing order must use the actual slowed / boosted travel speed.
assert((2400-2390)/travelSpeed(200,{...normal,slowTicks:25}) > (2400-2385)/travelSpeed(200,{...normal,turboTicks:30}));
console.log('PASS: shields, non-stacking slowdowns, item rotation and modified crossing speeds.');

const clients:DbConnection[]=[],room=`I-${Date.now().toString(36).toUpperCase()}`;
const uri=process.env.TEST_STDB_URI??'ws://127.0.0.1:3030',database=process.env.TEST_STDB_MODULE??'duckoff-items';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(check:()=>boolean,timeout=60000){const started=Date.now();while(!check()){if(Date.now()-started>timeout)throw Error('Timed out');await sleep(25)}}
async function connect(name:string,selectedRoom=room){return new Promise<DbConnection>((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(Error('Connection timeout')),20000);
 DbConnection.builder().withCompression('none').withUri(uri).withDatabaseName(database).onConnect(c=>{
  clients.push(c);c.subscriptionBuilder().onApplied(()=>{void c.reducers.join({name,duckIndex:clients.length%8,room:selectedRoom}).then(()=>{clearTimeout(timeout);resolve(c)},reject)}).subscribeToAllTables();
 }).onConnectError((_c,e)=>{clearTimeout(timeout);reject(e)}).build();
})}

async function main(){
 const racers=await Promise.all(Array.from({length:12},(_,i)=>connect(`Toy Duck ${i+1}`)));
 const first=racers[0],state=(c:DbConnection)=>first.db.raceItem.identity.find(c.identity!)!;
 const row=(c:DbConnection)=>first.db.racePlayer.identity.find(c.identity!)!;
 const outsider=await connect('Separate duck',room+'-B');
 await assert.rejects(first.reducers.useItem({}));
 await first.reducers.startRace({});
 await until(()=>first.db.race.id.find(room)?.status==='racing');
 const spectator=await connect('Spectator');await assert.rejects(spectator.reducers.useItem({}));
 await assert.rejects(first.reducers.useItem({}));
 let timer:ReturnType<typeof setInterval>|undefined;
 let pending:Promise<void>[]=[];
 const paddling=()=>{timer=setInterval(()=>{for(const c of racers)pending.push(c.reducers.tap({}));},65)};
 const pause=async()=>{if(timer)clearInterval(timer);timer=undefined;await Promise.all(pending);pending=[]};
 try{
  paddling();await until(()=>racers.every(c=>!!state(c)?.held));await pause();
  assert.deepEqual(new Set(racers.map(c=>state(c).held)),new Set(['bomb','bubble','turbo','shield']));
  assert(racers.every(c=>state(c).nextPickup===1));
  console.log('PASS: 12 racers collect all four item types at the first buoy; spectators cannot use items.');
  const shields=racers.filter(c=>state(c).held==='shield'),turbo=racers.find(c=>state(c).held==='turbo')!;
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
  paddling();await until(()=>first.db.race.id.find(room)?.status==='finished');await pause();
  const results=[...first.db.raceResult.iter()].filter(r=>r.room===room).sort((a,b)=>a.place-b.place);
  assert.deepEqual(results.map(r=>r.place),Array.from({length:12},(_,i)=>i+1));
  for(const c of racers){await until(()=>[...c.db.raceResult.iter()].filter(r=>r.room===room).length===12);assert.deepEqual([...c.db.raceResult.iter()].filter(r=>r.room===room).sort((a,b)=>a.place-b.place).map(r=>[r.identity.toHexString(),r.place]),results.map(r=>[r.identity.toHexString(),r.place]));}
  await assert.rejects(first.reducers.useItem({}));
  await first.reducers.startRace({});
  await until(()=>first.db.race.id.find(room)?.status==='countdown');
  assert(racers.every(c=>state(c).held===''&&state(c).nextPickup===0&&state(c).slowTicks===0&&state(c).shieldTicks===0&&state(c).turboTicks===0));
  assert.equal([...first.db.itemEffect.iter()].filter(e=>e.room===room).length,0);
  console.log('PASS: all 12 clients agree on item-race results; rematches clear every item and effect.');
 }finally{await pause();}
}
main().then(()=>console.log('ALL ITEM CHECKS PASSED')).catch(e=>{console.error(e);process.exitCode=1}).finally(()=>clients.forEach(c=>c.disconnect()));
