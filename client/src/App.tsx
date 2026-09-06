import {useEffect,useMemo,useRef,useState} from 'react';
import {SpacetimeDBProvider,useSpacetimeDB,useTable,useReducer} from 'spacetimedb/react';
import {Identity} from 'spacetimedb';
import {DbConnection,tables,reducers} from './module_bindings';
import {useGameTools} from './useGameTools';
import NameEntry from './NameEntry';
import RaceScreen from './RaceScreen';
import RubberDuck from './RubberDuck';
function Game(){
 const {isActive,identity,connectionError,getConnection}=useSpacetimeDB();
 const [linkedRoom,setLinkedRoom]=useState(()=>new URLSearchParams(location.search).get('room')?.trim().toUpperCase()||'');
 const [room,setRoom]=useState(linkedRoom||'PUBLIC');
 // Only rooms the player typed (or followed a link to) are treated as a code they know.
 // Randomly matched rooms get generated names, which must never reappear as a "room code".
 const [viaCode,setViaCode]=useState(!!linkedRoom);
 const [races,raceReady]=useTable(tables.race.where(r=>r.id.eq(room)));
 const [players,playersReady]=useTable(tables.racePlayer.where(p=>p.room.eq(room)));
 const [legends,legendsReady]=useTable(tables.player.where(p=>p.room.eq(room)));
 const [results]=useTable(tables.raceResult.where(p=>p.room.eq(room)));
 const [items]=useTable(tables.raceItem.where(p=>p.room.eq(room)));
 const [effects]=useTable(tables.itemEffect.where(p=>p.room.eq(room)));
 const [features]=useTable(tables.raceFeature.where(p=>p.room.eq(room)));
 // Our own player row follows us across rooms, so random matching can read the server's assignment.
 const [,selfReady]=useTable(tables.player.where(p=>p.identity.eq(identity??new Identity(0n))),{enabled:!!identity});
 const join=useReducer(reducers.join),joinRandom=useReducer(reducers.joinRandom),tap=useReducer(reducers.tap),start=useReducer(reducers.startRace);
 const useItem=useReducer(reducers.useItem),leaveRoom=useReducer(reducers.leaveRoom),switchLane=useReducer(reducers.switchLane),heartbeat=useReducer(reducers.heartbeat),steer=useReducer(reducers.steer);
 const [entered,setEntered]=useState(false),[error,setError]=useState(''),[slow,setSlow]=useState(false);
 useEffect(()=>{if(isActive){setSlow(false);return;}const timer=setTimeout(()=>setSlow(true),10000);return()=>clearTimeout(timer)},[isActive]);
 // Tell the room we're still here; a phone that sleeps stops sending and drops off the roster after 12s.
 useEffect(()=>{if(!isActive||!entered)return;const beat=()=>{if(document.visibilityState==='visible')void heartbeat().catch(()=>{})};beat();const timer=setInterval(beat,4000);document.addEventListener('visibilitychange',beat);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',beat)}},[isActive,entered,heartbeat]);
 const finishJoin=(name:string,duckIndex:number,nextRoom:string,byCode:boolean)=>{
  setRoom(nextRoom);setViaCode(byCode);
  const url=new URL(location.href);if(byCode)url.searchParams.set('room',nextRoom);else url.searchParams.delete('room');history.replaceState(null,'',url);
  localStorage.setItem('duckoff_name',name.trim()||'Duck');localStorage.setItem('duckoff_duck',String(duckIndex));
  setEntered(true);setError('');
 };
 const joinGame=async(name:string,duckIndex:number,selectedRoom=room,byCode=true)=>{
  const nextRoom=selectedRoom.trim().toUpperCase()||'PUBLIC';
  await join({name,duckIndex,room:nextRoom});finishJoin(name,duckIndex,nextRoom,byCode);
 };
 const findRoom=async(name:string,duckIndex:number)=>{
  const me=()=>identity?(getConnection() as DbConnection|null)?.db.player.identity.find(identity):undefined;
  const before=me();
  await joinRandom({name,duckIndex});
  // The row update usually lands before the reducer resolves, but not always: give the cache a moment.
  let assignment=me();
  for(let waited=0;(!assignment||(before&&assignment.room===before.room&&waited<400))&&waited<3000;waited+=50){await new Promise(r=>setTimeout(r,50));assignment=me();}
  if(!assignment)throw new Error('Your room is still connecting. Please try again.');
  finishJoin(name,duckIndex,assignment.room,false);
 };
 // If our room's row vanished (the room was tidied away while this tab slept), quietly open it again.
 const rejoining=useRef(false);
 useEffect(()=>{if(!entered||!raceReady||races[0]||rejoining.current)return;rejoining.current=true;const name=localStorage.getItem('duckoff_name')||'Duck',duckIndex=Number(localStorage.getItem('duckoff_duck'))||0;void join({name,duckIndex,room}).catch(()=>{}).finally(()=>{rejoining.current=false})},[entered,raceReady,races,room,join]);
 // Main menu: leave the results behind and start over with a clean entry screen (random matching by default).
 const leave=()=>{void leaveRoom().catch(()=>{});setEntered(false);setViaCode(false);setLinkedRoom('');setError('');const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);};
 // Practice alone: a private room that starts straight away, with a denser obstacle course.
 const soloRun=async(name:string,duckIndex:number)=>{const nextRoom=`SOLO-${Math.floor(Math.random()*36**5).toString(36).toUpperCase().padStart(5,'0')}`;await join({name,duckIndex,room:nextRoom});finishJoin(name,duckIndex,nextRoom,false);};
 const friendly=(e:unknown,fallback:string)=>e instanceof Error&&e.message?e.message:fallback;
 useGameTools({connected:isActive,race:races[0],items:items.map(i=>({...i,identity:i.identity.toHexString()})),features:features.map(f=>({kind:f.kind,lane:f.lane,pos:f.pos})),players:players.map(p=>({name:p.name,active:p.active,lane:p.lane,pos:p.pos,place:p.place,rank:p.rank,taps:p.taps}))},(name,index)=>joinGame(name,index,room,viaCode),()=>tap(),()=>start(),()=>useItem(),direction=>switchLane({direction}),amount=>steer({amount}));
 if(!isActive||!identity||!selfReady||!raceReady||!playersReady||!legendsReady)return <main className="splash"><div className="splash-duck"><RubberDuck size={112} bob/></div><h1>{connectionError||slow?'A little ripple in the connection':'Filling the little lagoon…'}</h1><p>{connectionError||slow?'Your duck is safe. Check your connection and try again.':'Getting the water just right for you.'}</p>{(connectionError||slow)&&<button className="primary" onClick={()=>location.reload()}>Try again ↻</button>}</main>;
 if(!entered)return <NameEntry initialRoom={linkedRoom} error={error} onJoin={async(name,index,nextRoom)=>{try{await joinGame(name,index,nextRoom)}catch(e){setError(friendly(e,'Couldn’t hop in. Please try again.'))}}} onRandomJoin={async(name,index)=>{try{await findRoom(name,index)}catch(e){setError(friendly(e,'Couldn’t find a room. Please try again.'))}}} onSolo={async(name,index)=>{try{await soloRun(name,index)}catch(e){setError(friendly(e,'Couldn’t open a practice river. Please try again.'))}}}/>;
 if(!races[0])return <main className="splash"><h1>Opening room {room}…</h1><button className="primary" onClick={()=>setEntered(false)}>Back to my duck</button></main>;
 return <RaceScreen race={races[0]} players={players} legends={legends} items={items} effects={effects} features={features} results={results.filter(r=>r.raceNumber===races[0].raceNumber)} identity={identity.toHexString()} onTap={()=>tap()} onStart={()=>start()} onUseItem={()=>useItem()} onSwitchLane={direction=>switchLane({direction})} onSteer={amount=>steer({amount})} onLeave={leave}/>;
}
export default function App(){
 const builder=useMemo(()=>{
  const uri=process.env.NEXT_PUBLIC_STDB_URI||(location.protocol==='https:'?'wss://maincloud.spacetimedb.com':`ws://${location.hostname}:3030`);
  const database=process.env.NEXT_PUBLIC_STDB_MODULE||(location.protocol==='https:'?'duckoff-rooms-gari-20260905':'duckoff');
  const key=`duckoff_token:${uri}:${database}`;
  // SDK 2.9 decompresses messages concurrently; small tap messages can overtake
  // compressed race ticks and roll back standings. Room-scoped updates are small.
  return DbConnection.builder().withCompression('none').withUri(uri).withDatabaseName(database).withToken(sessionStorage.getItem(key)??undefined).onConnect((_ctx,_identity,token)=>sessionStorage.setItem(key,token));
 },[]);
 return <SpacetimeDBProvider connectionBuilder={builder}><Game/></SpacetimeDBProvider>;
}
