import assert from 'node:assert/strict';
import {DbConnection} from '../src/module_bindings';
import {AUTO_CRUISE} from '../../server/spacetimedb/src/items';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
// Every test client heartbeats like the app does, so the 12-second staleness sweep never drops it.
const beats:ReturnType<typeof setInterval>[]=[];
const clients:DbConnection[]=[];
// Ten racers plus two late joiners fill a room to its twelve-duck cap.
const RACERS=10;
const room=process.env.TEST_ROOM??`T-${Date.now().toString(36).toUpperCase()}`;
const uri=process.env.TEST_STDB_URI??'ws://127.0.0.1:3030',database=process.env.TEST_STDB_MODULE??'duckoff';
async function connect(name:string,i:number,selectedRoom=room,join=true){return new Promise<DbConnection>((resolve,reject)=>{
 const timer=setTimeout(()=>reject(Error('Connection timed out')),20000);
 DbConnection.builder().withCompression('none').withUri(uri).withDatabaseName(database).onConnect(c=>{clients.push(c);beats.push(setInterval(()=>{try{void c.reducers.heartbeat({}).catch(()=>{})}catch{}},4000));c.subscriptionBuilder().onApplied(()=>{void(async()=>{if(join)await c.reducers.join({name,duckIndex:i%10,room:selectedRoom});clearTimeout(timer);resolve(c)})().catch(reject)}).subscribeToAllTables()}).onConnectError((_c,e)=>{clearTimeout(timer);reject(e)}).build();
})}
async function until(check:()=>boolean,timeout=65000){const t=Date.now();while(!check()){if(Date.now()-t>timeout)throw Error(`Timed out waiting for: ${check.toString().slice(0,160)}`);await sleep(30)}}
const key=(p:{identity:{toHexString:()=>string}})=>p.identity.toHexString();
async function main(){
 const first=await connect('Speedy',0);await until(()=>first.db.race.id.find(room)?.status==='lobby');
 const stranger=await connect('Not joined',0,room,false);await assert.rejects(stranger.reducers.startRace({}));
 const racers=[first,...await Promise.all(Array.from({length:RACERS-1},(_,i)=>connect(`Duck ${i+2}`,i+1)))];
 await connect('Other room',0,room+'-B');
 await until(()=>[...first.db.racePlayer.iter()].filter(p=>p.room===room&&p.active).length===RACERS);
 await sleep(9000);assert.equal(first.db.race.id.find(room)?.status,'lobby');
 console.log(`PASS: ${RACERS} players wait for a manual start; unjoined users cannot start.`);
 assert.equal(first.db.race.id.find(room)?.hostIdentity,first.identity!.toHexString(),'the room creator remains host');
 await assert.rejects(racers[1].reducers.startRace({}),/host/);
 assert.equal(first.db.race.id.find(room)?.status,'lobby','a guest cannot start the countdown');
 await Promise.all([first.reducers.startRace({}),first.reducers.startRace({})]);
 await until(()=>first.db.race.id.find(room)?.status==='countdown');assert.equal(first.db.race.id.find(room)?.raceNumber,1);
 // Everyone races the same whirlpool-free lane, so rocks, logs and rapids treat the field equally and speed decides.
 await until(()=>[...first.db.raceFeature.iter()].filter(f=>f.room===room).length>=10);
 // startRace replaces every racer row; wait until each client holds its fresh row (lobby rows carry rank 0) before reading lanes.
 await until(()=>racers.every(c=>(c.db.racePlayer.identity.find(c.identity!)?.rank??0)>0));
 const safeLane=[0,1,2,3,4].find(l=>![...first.db.raceFeature.iter()].some(f=>f.room===room&&f.kind==='whirlpool'&&f.lane===l))!;
 // Hop one lane at a time and wait for each hop to land in the cache before deciding on the next.
 await Promise.all(racers.map(async c=>{const lane=()=>c.db.racePlayer.identity.find(c.identity!)!.lane;for(let i=0;i<8&&lane()!==safeLane;i++){const before=lane();await c.reducers.switchLane({direction:safeLane>before?1:-1});await until(()=>lane()!==before,5000)}assert.equal(lane(),safeLane)}));
 await until(()=>racers.every(c=>first.db.racePlayer.identity.find(c.identity!)!.lane===safeLane),5000);
 const duringCountdown=await connect('Countdown late',6);assert.equal(duringCountdown.db.racePlayer.identity.find(duringCountdown.identity!)!.active,false);
 await until(()=>first.db.race.id.find(room)?.status==='racing');
 assert.equal(first.db.race.id.find(room+'-B')?.status,'lobby');
 await assert.rejects(first.reducers.join({name:'Escape',duckIndex:0,room:room+'-B'}));
 const late=await connect('Late Duck',7);await late.reducers.tap({count:1});assert.equal(late.db.racePlayer.identity.find(late.identity!)!.pos,0);
 await until(()=>[...first.db.player.iter()].filter(p=>p.room===room&&p.online).length===12);
 await assert.rejects(connect('Thirteenth',8),/full/);
 await assert.rejects(first.reducers.join({name:'Speedy',duckIndex:10,room}),/ducks/);
 console.log('PASS: a thirteenth duck is turned away from a full room; duck indexes past the roster are rejected.');
 console.log('PASS: concurrent start clicks create one countdown; room isolation and late-join rules hold.');
 let boosts=false,rankChecks=0;const started=Date.now(),last=Array(RACERS).fill(0),requests:Promise<void>[]=[];
 const timer=setInterval(()=>{const now=Date.now();racers.forEach((c,i)=>{const interval=i===0?60:95+i*8;if(now-last[i]>=interval){last[i]=now;requests.push(c.reducers.tap({count:1}));}})},20);
 try{await until(()=>{
  const rows=[...first.db.racePlayer.iter()].filter(p=>p.room===room&&p.active);
  const oracle=[...rows].sort((a,b)=>a.place&&b.place?a.place-b.place:a.place?-1:b.place?1:a.drowned!==b.drowned?(a.drowned?1:-1):b.pos-a.pos||(key(a)<key(b)?-1:1));
  if(Date.now()-started>300){oracle.forEach((p,i)=>assert.equal(p.rank,i+1,JSON.stringify(oracle.map(r=>({id:key(r).slice(0,8),lane:r.lane,drowned:r.drowned,pos:Math.round(r.pos),rank:r.rank,place:r.place})))));rankChecks++;}
  assert(rows.every(p=>!p.drowned),'nobody drowns in the whirlpool-free lane: '+JSON.stringify(rows.filter(p=>p.drowned).map(p=>({lane:p.lane,pos:Math.round(p.pos),safeLane}))));
  boosts ||= rows.some(p=>p.boostTicksLeft>0);
  return first.db.race.id.find(room)?.status==='finished';
 })}finally{clearInterval(timer);await Promise.all(requests)}
 const results=[...first.db.raceResult.iter()].filter(p=>p.room===room).sort((a,b)=>a.place-b.place);
 assert(rankChecks>20);assert.equal(results.length,RACERS);assert.deepEqual(results.map(p=>p.place),Array.from({length:RACERS},(_,i)=>i+1));
 if(!AUTO_CRUISE){assert(boosts);assert.equal(results[0].identity.toHexString(),first.identity!.toHexString(),'the fastest tapper wins');}
 assert.equal(results[0].pos,2400);
 const unfinished=results.filter(p=>p.pos<2400);for(let i=1;i<unfinished.length;i++)assert(unfinished[i-1].pos>=unfinished[i].pos);
 for(const client of [...racers,late]){
  await until(()=>[...client.db.raceResult.iter()].filter(p=>p.room===room).length===RACERS);
  assert.deepEqual(results.map(p=>[key(p),p.place,p.pos]),[...client.db.raceResult.iter()].filter(p=>p.room===room).sort((a,b)=>a.place-b.place).map(p=>[key(p),p.place,p.pos]));
 }
 console.log(`PASS: ${rankChecks} live ranking checks; ${AUTO_CRUISE?'cruising ducks finish':'fastest duck wins'}; ${RACERS} unique places; clients agree.`);
 await first.reducers.join({name:'New room duck',duckIndex:3,room:room+'-B'});
 racers[1].disconnect();await sleep(11000);
 assert.equal(late.db.race.id.find(room)?.status,'finished');assert.equal([...late.db.raceResult.iter()].filter(p=>p.room===room).length,RACERS);assert.equal(late.db.race.id.find(room)?.raceNumber,1);
 console.log('PASS: results survive disconnects and room changes, with no automatic rematch.');
 await until(()=>{const host=late.db.race.id.find(room)?.hostIdentity;return !!host&&host!==first.identity!.toHexString()&&host!==racers[1].identity!.toHexString()});
 const newHost=clients.find(c=>c.identity!.toHexString()===late.db.race.id.find(room)!.hostIdentity)!;
 const guest=newHost===late?racers[2]:late;
 await assert.rejects(guest.reducers.startRace({}),/host/);
 await newHost.reducers.startRace({});await until(()=>late.db.race.id.find(room)?.raceNumber===2);
 assert.equal(late.db.racePlayer.identity.find(late.identity!)!.active,true);assert.equal(late.db.racePlayer.identity.find(late.identity!)!.pos,0);
 assert.equal([...late.db.raceResult.iter()].filter(p=>p.room===room).length,0);
 console.log('PASS: the replacement host alone can start a rematch; spectators are promoted and results reset.');
 await late.reducers.leaveRoom({});
 assert.equal(late.db.player.identity.find(late.identity!)?.online,false);assert.equal(late.db.racePlayer.identity.find(late.identity!),null);
 // Nobody paddles in race 2: after 15 idle seconds it is forfeited, with no winner and no podium.
 // (In steer-only mode the ducks swim anyway, so race 2 simply finishes with a winner.)
 const idleStart=Date.now(),winsBefore=[...late.db.player.iter()].reduce((n,p)=>n+p.racesWon,0);
 await until(()=>late.db.race.id.find(room)?.status==='finished');
 const idleSeconds=(Date.now()-idleStart)/1000;
 if(AUTO_CRUISE){assert.equal(late.db.race.id.find(room)?.forfeited,false);assert([...late.db.raceResult.iter()].some(r=>r.room===room),'cruising ducks still produce a podium');}
 else{
  assert(idleSeconds>13&&idleSeconds<25,`forfeit after ~15s of stillness, took ${idleSeconds.toFixed(1)}s`);
  assert.equal(late.db.race.id.find(room)?.forfeited,true);assert.equal(late.db.race.id.find(room)?.forfeitReason,'idle');assert.equal(late.db.race.id.find(room)?.winnerName,'');
  assert.equal([...late.db.raceResult.iter()].filter(r=>r.room===room).length,0,'a forfeited race has no podium');
  assert.equal([...late.db.player.iter()].reduce((n,p)=>n+p.racesWon,0),winsBefore,'a forfeited race hands out no win');
 }
 console.log(`PASS: leaving drops the duck from the roster, even mid-race; ${AUTO_CRUISE?'race 2 finishes on cruise':'a still race is forfeited with no winner'}.`);
 beats.forEach(clearInterval);for(const c of clients)c.disconnect();console.log('ALL MULTIPLAYER CHECKS PASSED');
}
main().catch(e=>{console.error(e);beats.forEach(clearInterval);for(const c of clients)c.disconnect();process.exitCode=1});
