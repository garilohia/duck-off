import assert from 'node:assert/strict';
import {DbConnection} from '../src/module_bindings';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const clients:DbConnection[]=[];
const room=process.env.TEST_ROOM??`TEST-${Date.now().toString(36).toUpperCase()}`;
async function connect(name:string,i:number,selectedRoom=room){return new Promise<DbConnection>((resolve,reject)=>{DbConnection.builder().withUri(process.env.TEST_STDB_URI??'ws://127.0.0.1:3030').withDatabaseName(process.env.TEST_STDB_MODULE??'duckoff').onConnect(c=>{clients.push(c);c.subscriptionBuilder().onApplied(async()=>{await c.reducers.join({name,duckIndex:i%8,room:selectedRoom});resolve(c)}).subscribeToAllTables()}).onConnectError((_c,e)=>reject(e)).build()})}
async function until(check:()=>boolean,timeout=70000){const t=Date.now();while(!check()){if(Date.now()-t>timeout)throw Error('Timed out');await sleep(50)}}
async function main(){
 const first=await connect('Test Duck 1',0);await until(()=>first.db.race.id.find(room)?.status==='lobby');
 await Promise.all(Array.from({length:11},(_,i)=>connect(`Test Duck ${i+2}`,i+1)));
 await until(()=>[...first.db.racePlayer.iter()].filter(p=>p.room===room).filter(p=>p.active).length>=12);
 console.log('PASS: 12 independent anonymous clients joined one room.');
 const isolated=await connect('Other room',0,room+'-B');await until(()=>!!first.db.racePlayer.identity.find(isolated.identity!));assert.equal(first.db.racePlayer.identity.find(isolated.identity!)!.room,room+'-B');assert.equal([...first.db.racePlayer.iter()].filter(p=>p.room===room&&p.active).length,12);console.log('PASS: separate room has an independent race and roster.');
 await until(()=>first.db.race.id.find(room)?.status==='countdown');console.log('PASS: lobby → countdown.');
 await until(()=>first.db.race.id.find(room)?.status==='racing');const raceNumber=first.db.race.id.find(room)!.raceNumber;
 const late=await connect('Late Duck',7);await until(()=>!!late.db.racePlayer.identity.find(late.identity!));assert.equal(late.db.racePlayer.identity.find(late.identity!)!.active,false);await late.reducers.tap({});assert.equal(late.db.racePlayer.identity.find(late.identity!)!.pos,0);console.log('PASS: mid-race join is a spectator; taps cannot move it.');
 const active=clients.filter(c=>c!==late&&c!==isolated);let boosts=false,moving=false;
 const timer=setInterval(()=>{for(const c of active)void c.reducers.tap({});const rows=[...first.db.racePlayer.iter()].filter(p=>p.room===room);boosts ||= rows.some(p=>p.boostTicksLeft>0);moving ||= rows.filter(p=>p.pos>0).length>=12},65);
 try{await until(()=>first.db.race.id.find(room)?.status==='finished');}finally{clearInterval(timer)}
 assert(moving);assert(boosts);const results=[...first.db.racePlayer.iter()].filter(p=>p.room===room).filter(p=>p.active);assert.equal(new Set(results.map(p=>p.place)).size,results.length);assert(results.every(p=>p.place>0));assert(results.some(p=>p.pos===2400));console.log('PASS: 12 ducks move live, boost, finish, and have unique server-owned places.');
 const a=[...first.db.racePlayer.iter()].filter(p=>p.room===room).map(p=>[p.identity.toHexString(),p.pos,p.place]).sort();await sleep(200);const b=[...late.db.racePlayer.iter()].filter(p=>p.room===room).map(p=>[p.identity.toHexString(),p.pos,p.place]).sort();assert.deepEqual(a,b);console.log('PASS: independent clients agree on final state.');
 await until(()=>late.db.race.id.find(room)!.raceNumber>raceNumber);assert.equal(late.db.racePlayer.identity.find(late.identity!)!.active,true);assert.equal(late.db.racePlayer.identity.find(late.identity!)!.pos,0);console.log('PASS: podium → next lobby, spectator promoted without refresh.');
 for(const c of clients)c.disconnect();console.log('ALL MULTIPLAYER CHECKS PASSED');
}
main().catch(e=>{console.error(e);for(const c of clients)c.disconnect();process.exitCode=1});
