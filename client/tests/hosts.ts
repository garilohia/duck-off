import assert from 'node:assert/strict';
import {DbConnection} from '../src/module_bindings';

const uri=process.env.TEST_STDB_URI??'ws://127.0.0.1:3030';
const database=process.env.TEST_STDB_MODULE??'duckoff';
const room=`H-${Date.now().toString(36).toUpperCase()}`;
const clients:DbConnection[]=[];
const beats=new Map<DbConnection,ReturnType<typeof setInterval>>();
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

async function until(check:()=>boolean,timeout=20000){
 const started=Date.now();
 while(!check()){
  if(Date.now()-started>timeout)throw new Error(`Timed out: ${check}`);
  await sleep(30);
 }
}

async function connect(name:string){
 const c=await new Promise<DbConnection>((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Connection timed out')),20000);
  DbConnection.builder().withCompression('none').withUri(uri).withDatabaseName(database)
   .onConnect(c=>{
    clients.push(c);
    c.subscriptionBuilder().onApplied(()=>{clearTimeout(timer);resolve(c)})
     .subscribeToAllTables();
   })
   .onConnectError((_c,error)=>{clearTimeout(timer);reject(error)})
   .build();
 });
 await c.reducers.join({name,duckIndex:0,room});
 beats.set(c,setInterval(()=>{void c.reducers.heartbeat({}).catch(()=>{})},1000));
 await until(()=>!!c.db.race.id.find(room));
 return c;
}

async function main(){
 const creator=await connect('Creator');
 const race=()=>creator.db.race.id.find(room)!;
 assert.equal(race().hostIdentity,creator.identity!.toHexString());
 await sleep(4000);
 assert.equal(race().status,'lobby','creating a room does not start it');
 assert.equal(race().phaseTicksLeft,0,'no countdown runs while waiting for friends');

 const friend=await connect('Friend');
 await assert.rejects(friend.reducers.startRace({}),/host/);
 await sleep(4000);
 assert.equal(race().status,'lobby','joining and a guest start attempt leave the room waiting');
 assert.equal(race().hostIdentity,creator.identity!.toHexString());
 console.log('PASS: only the creator has start permission; the lobby waits before and after friends join.');

 clearInterval(beats.get(creator));
 await creator.reducers.leaveRoom({});
 await until(()=>race().hostIdentity===friend.identity!.toHexString());
 assert.equal(race().status,'lobby','host handoff never starts a race');
 await creator.reducers.join({name:'Creator returned',duckIndex:0,room});
 beats.set(creator,setInterval(()=>{void creator.reducers.heartbeat({}).catch(()=>{})},1000));
 assert.equal(race().hostIdentity,friend.identity!.toHexString(),'returning does not steal hosting');
 await assert.rejects(creator.reducers.startRace({}),/host/);
 console.log('PASS: leaving hands hosting to the remaining friend, without starting the timer.');

 // A sleeping phone may keep its socket open; the replacement host must still be able to start.
 clearInterval(beats.get(friend));
 await until(()=>race().hostIdentity===creator.identity!.toHexString());
 assert.equal(race().status,'lobby');
 await friend.reducers.heartbeat({});
 await assert.rejects(friend.reducers.startRace({}),/host/);
 await Promise.all([creator.reducers.startRace({}),creator.reducers.startRace({})]);
 await until(()=>race().status==='countdown');
 assert.equal(race().raceNumber,1,'duplicate host clicks start just one countdown');
 assert.equal(race().hostIdentity,creator.identity!.toHexString());
 await until(()=>race().status==='racing');
 console.log('PASS: a silent host is replaced; only an explicit host start begins the countdown and race.');
}

main().catch(error=>{console.error(error);process.exitCode=1})
 .finally(()=>{for(const timer of beats.values())clearInterval(timer);for(const c of clients)c.disconnect()});
