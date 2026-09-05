import assert from 'node:assert/strict';
import {DbConnection} from '../src/module_bindings';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const clients:DbConnection[]=[];
const uri=process.env.TEST_STDB_URI??'ws://127.0.0.1:3030',database=process.env.TEST_STDB_MODULE??'duckoff-mobile';
async function connect(){return new Promise<DbConnection>((resolve,reject)=>{
 const timer=setTimeout(()=>reject(Error('Connection timed out')),20000);
 DbConnection.builder().withCompression('none').withUri(uri).withDatabaseName(database).onConnect(c=>{clients.push(c);c.subscriptionBuilder().onApplied(()=>{clearTimeout(timer);resolve(c)}).subscribeToAllTables()}).onConnectError((_c,e)=>{clearTimeout(timer);reject(e)}).build();
})}
async function until(check:()=>boolean,timeout=65000){const t=Date.now();while(!check()){if(Date.now()-t>timeout)throw Error('Timed out');await sleep(30)}}
const roomOf=(c:DbConnection)=>c.db.player.identity.find(c.identity!)?.room;
const onlineIn=(c:DbConnection,room:string)=>[...c.db.player.iter()].filter(p=>p.room===room&&p.online).length;
async function main(){
 const a=await connect();await a.reducers.joinRandom({name:'Solo',duckIndex:0});
 const first=roomOf(a);assert(first,'random join assigns a room');
 assert(a.db.racePlayer.identity.find(a.identity!)?.active,'random joiner is an active racer in a waiting room');
 const b=await connect();await b.reducers.joinRandom({name:'Pal',duckIndex:1});
 assert.equal(roomOf(b),first);
 console.log(`PASS: random joiners share the live room ${first}; the row is readable as soon as the reducer resolves.`);
 const codeRoom=`R-${Date.now().toString(36).toUpperCase()}`;
 const c=await connect();await c.reducers.join({name:'Coder',duckIndex:2,room:codeRoom});assert.equal(roomOf(c),codeRoom);
 const d=await connect();await d.reducers.joinRandom({name:'Drifter',duckIndex:3});
 assert([first,codeRoom].includes(roomOf(d)!),`joined a waiting room with players, got ${roomOf(d)}`);
 console.log('PASS: a typed code opens its own room; random matching only picks rooms with ducks in them.');
 await a.reducers.startRace({});await until(()=>a.db.race.id.find(first)?.status==='racing');
 await assert.rejects(a.reducers.joinRandom({name:'Solo',duckIndex:0}),/Finish this race/);
 const e=await connect();await e.reducers.joinRandom({name:'Newbie',duckIndex:4});
 assert.equal(roomOf(e),codeRoom,'a waiting room beats a racing one');
 console.log('PASS: racers stay put mid-race; newcomers prefer a room that is waiting to start.');
 await Promise.all(Array.from({length:10},async(_,i)=>{const x=await connect();await x.reducers.join({name:`Filler ${i}`,duckIndex:i%10,room:codeRoom})}));
 await until(()=>onlineIn(e,codeRoom)>=12);
 const f=await connect();await f.reducers.joinRandom({name:'Latecomer',duckIndex:5});
 assert.equal(roomOf(f),first,'a full room is skipped');
 const g=await connect();await assert.rejects(g.reducers.join({name:'Overflow',duckIndex:6,room:codeRoom}),/full/);
 assert.equal(roomOf(g),undefined,'a rejected join leaves no player row behind');
 assert.equal(f.db.racePlayer.identity.find(f.identity!)?.active,a.db.race.id.find(first)?.status==='finished','late arrivals spectate a live race');
 console.log('PASS: full rooms are skipped by matching and refuse typed joins; late arrivals wait for the next race.');
 for(const x of clients)x.disconnect();console.log('ALL RANDOM ROOM CHECKS PASSED');
}
main().catch(e=>{console.error(e);for(const c of clients)c.disconnect();process.exitCode=1});
