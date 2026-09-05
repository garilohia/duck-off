import assert from 'node:assert/strict';
import {DbConnection} from '../src/module_bindings';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const clients:DbConnection[]=[];
// Ten racers plus two late joiners fill a room to its twelve-duck cap.
const RACERS=10;
const room=process.env.TEST_ROOM??`T-${Date.now().toString(36).toUpperCase()}`;
const uri=process.env.TEST_STDB_URI??'ws://127.0.0.1:3030',database=process.env.TEST_STDB_MODULE??'duckoff-mobile';
async function connect(name:string,i:number,selectedRoom=room,join=true){return new Promise<DbConnection>((resolve,reject)=>{
 const timer=setTimeout(()=>reject(Error('Connection timed out')),20000);
 DbConnection.builder().withCompression('none').withUri(uri).withDatabaseName(database).onConnect(c=>{clients.push(c);c.subscriptionBuilder().onApplied(()=>{void(async()=>{if(join)await c.reducers.join({name,duckIndex:i%10,room:selectedRoom});clearTimeout(timer);resolve(c)})().catch(reject)}).subscribeToAllTables()}).onConnectError((_c,e)=>{clearTimeout(timer);reject(e)}).build();
})}
async function until(check:()=>boolean,timeout=65000){const t=Date.now();while(!check()){if(Date.now()-t>timeout)throw Error('Timed out');await sleep(30)}}
const key=(p:{identity:{toHexString:()=>string}})=>p.identity.toHexString();
async function main(){
 const first=await connect('Speedy',0);await until(()=>first.db.race.id.find(room)?.status==='lobby');
 const stranger=await connect('Not joined',0,room,false);await assert.rejects(stranger.reducers.startRace({}));
 const racers=[first,...await Promise.all(Array.from({length:RACERS-1},(_,i)=>connect(`Duck ${i+2}`,i+1)))];
 await connect('Other room',0,room+'-B');
 await until(()=>[...first.db.racePlayer.iter()].filter(p=>p.room===room&&p.active).length===RACERS);
 await sleep(9000);assert.equal(first.db.race.id.find(room)?.status,'lobby');
 console.log(`PASS: ${RACERS} players wait for a manual start; unjoined users cannot start.`);
 await Promise.all([first.reducers.startRace({}),racers[1].reducers.startRace({})]);
 await until(()=>first.db.race.id.find(room)?.status==='countdown');assert.equal(first.db.race.id.find(room)?.raceNumber,1);
 // Everyone races the same lane, so rocks, logs and rapids treat the field equally and speed decides.
 await Promise.all(racers.map(async c=>{for(let i=0;i<4;i++)await c.reducers.switchLane({direction:-1});assert.equal(c.db.racePlayer.identity.find(c.identity!)!.lane,0)}));
 const duringCountdown=await connect('Countdown late',6);assert.equal(duringCountdown.db.racePlayer.identity.find(duringCountdown.identity!)!.active,false);
 await until(()=>first.db.race.id.find(room)?.status==='racing');
 assert.equal(first.db.race.id.find(room+'-B')?.status,'lobby');
 await assert.rejects(first.reducers.join({name:'Escape',duckIndex:0,room:room+'-B'}));
 const late=await connect('Late Duck',7);await late.reducers.tap({});assert.equal(late.db.racePlayer.identity.find(late.identity!)!.pos,0);
 await until(()=>[...first.db.player.iter()].filter(p=>p.room===room&&p.online).length===12);
 await assert.rejects(connect('Thirteenth',8),/full/);
 await assert.rejects(first.reducers.join({name:'Speedy',duckIndex:10,room}),/ducks/);
 console.log('PASS: a thirteenth duck is turned away from a full room; duck indexes past the roster are rejected.');
 console.log('PASS: concurrent start clicks create one countdown; room isolation and late-join rules hold.');
 let boosts=false,rankChecks=0;const started=Date.now(),last=Array(RACERS).fill(0),requests:Promise<void>[]=[];
 const timer=setInterval(()=>{const now=Date.now();racers.forEach((c,i)=>{const interval=i===0?60:95+i*8;if(now-last[i]>=interval){last[i]=now;requests.push(c.reducers.tap({}));}})},20);
 try{await until(()=>{
  const rows=[...first.db.racePlayer.iter()].filter(p=>p.room===room&&p.active);
  const oracle=[...rows].sort((a,b)=>a.place&&b.place?a.place-b.place:a.place?-1:b.place?1:b.pos-a.pos||(key(a)<key(b)?-1:1));
  if(Date.now()-started>300){oracle.forEach((p,i)=>assert.equal(p.rank,i+1,JSON.stringify(oracle.map(r=>({id:key(r),pos:r.pos,rank:r.rank,place:r.place})))));rankChecks++;}
  boosts ||= rows.some(p=>p.boostTicksLeft>0);
  return first.db.race.id.find(room)?.status==='finished';
 })}finally{clearInterval(timer);await Promise.all(requests)}
 const results=[...first.db.raceResult.iter()].filter(p=>p.room===room).sort((a,b)=>a.place-b.place);
 assert(boosts);assert(rankChecks>20);assert.equal(results.length,RACERS);assert.deepEqual(results.map(p=>p.place),Array.from({length:RACERS},(_,i)=>i+1));assert.equal(results[0].identity.toHexString(),first.identity!.toHexString());assert.equal(results[0].pos,2400);
 const unfinished=results.filter(p=>p.pos<2400);for(let i=1;i<unfinished.length;i++)assert(unfinished[i-1].pos>=unfinished[i].pos);
 for(const client of [...racers,late]){
  await until(()=>[...client.db.raceResult.iter()].filter(p=>p.room===room).length===RACERS);
  assert.deepEqual(results.map(p=>[key(p),p.place,p.pos]),[...client.db.raceResult.iter()].filter(p=>p.room===room).sort((a,b)=>a.place-b.place).map(p=>[key(p),p.place,p.pos]));
 }
 console.log(`PASS: ${rankChecks} live ranking checks; fastest duck wins; ${RACERS} unique places; clients agree.`);
 await first.reducers.join({name:'New room duck',duckIndex:3,room:room+'-B'});
 racers[1].disconnect();await sleep(11000);
 assert.equal(late.db.race.id.find(room)?.status,'finished');assert.equal([...late.db.raceResult.iter()].filter(p=>p.room===room).length,RACERS);assert.equal(late.db.race.id.find(room)?.raceNumber,1);
 console.log('PASS: results survive disconnects and room changes, with no automatic rematch.');
 await late.reducers.startRace({});await until(()=>late.db.race.id.find(room)?.raceNumber===2);
 assert.equal(late.db.racePlayer.identity.find(late.identity!)!.active,true);assert.equal(late.db.racePlayer.identity.find(late.identity!)!.pos,0);
 assert.equal([...late.db.raceResult.iter()].filter(p=>p.room===room).length,0);
 console.log('PASS: manual rematch promotes spectators and resets progress and results.');
 await late.reducers.leaveRoom({});
 assert.equal(late.db.player.identity.find(late.identity!)?.online,false);assert.equal(late.db.racePlayer.identity.find(late.identity!),null);
 await until(()=>late.db.race.id.find(room)?.status==='finished');
 assert(![...late.db.raceResult.iter()].some(r=>r.room===room&&r.identity.isEqual(late.identity!)),'a duck that left mid-race is not on the podium');
 assert.equal(late.db.race.id.find(room)?.status,'finished','the podium stays while other ducks are still online');
 console.log('PASS: leaving drops the duck from the roster, even mid-race, without breaking the finish.');
 for(const c of clients)c.disconnect();console.log('ALL MULTIPLAYER CHECKS PASSED');
}
main().catch(e=>{console.error(e);for(const c of clients)c.disconnect();process.exitCode=1});
