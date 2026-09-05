import {useEffect,useMemo,useState} from 'react';
import {SpacetimeDBProvider,useSpacetimeDB,useTable,useReducer} from 'spacetimedb/react';
import {DbConnection,tables,reducers} from './module_bindings';
import {useGameTools} from './useGameTools';
import NameEntry from './NameEntry';
import RaceScreen from './RaceScreen';
function Game(){
 const {isActive,identity,connectionError}=useSpacetimeDB();
 const [room,setRoom]=useState(()=>new URLSearchParams(location.search).get('room')?.trim().toUpperCase()||'PUBLIC');
 const [races,raceReady]=useTable(tables.race.where(r=>r.id.eq(room)));
 const [players,playersReady]=useTable(tables.racePlayer.where(p=>p.room.eq(room)));
 const [legends,legendsReady]=useTable(tables.player.where(p=>p.room.eq(room)));
 const [results]=useTable(tables.raceResult.where(p=>p.room.eq(room)));
 const [items]=useTable(tables.raceItem.where(p=>p.room.eq(room)));
 const [effects]=useTable(tables.itemEffect.where(p=>p.room.eq(room)));
 const join=useReducer(reducers.join),tap=useReducer(reducers.tap),start=useReducer(reducers.startRace);
 const useItem=useReducer(reducers.useItem);
 const [entered,setEntered]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false),[slow,setSlow]=useState(false);
 useEffect(()=>{if(isActive){setSlow(false);return;}const timer=setTimeout(()=>setSlow(true),10000);return()=>clearTimeout(timer)},[isActive]);
 const joinGame=async(name:string,duckIndex:number,selectedRoom=room)=>{
  const nextRoom=selectedRoom.trim().toUpperCase()||'PUBLIC';
  await join({name,duckIndex,room:nextRoom});setRoom(nextRoom);
  const url=new URL(location.href);url.searchParams.set('room',nextRoom);history.replaceState(null,'',url);
  localStorage.setItem('duckoff_name',name.trim()||'Duck');localStorage.setItem('duckoff_duck',String(duckIndex));
  setEntered(true);setEditing(false);setError('');
 };
 useGameTools({connected:isActive,race:races[0],items:items.map(i=>({...i,identity:i.identity.toHexString()})),players:players.map(p=>({name:p.name,active:p.active,pos:p.pos,place:p.place,rank:p.rank,taps:p.taps}))},joinGame,()=>tap(),()=>start(),()=>useItem());
 if(!isActive||!raceReady||!playersReady||!legendsReady)return <main className="splash"><div className="splash-duck" aria-hidden="true">🦆</div><h1>{connectionError||slow?'A little ripple in the connection':'Filling the little lagoon…'}</h1><p>{connectionError||slow?'Your duck is safe. Check your connection and try again.':'Getting the water just right for you.'}</p>{(connectionError||slow)&&<button className="primary" onClick={()=>location.reload()}>Try again ↻</button>}</main>;
 if(!entered||editing)return <NameEntry initialRoom={room} error={error} onCancel={editing?()=>{setEditing(false);setError('')}:undefined} onJoin={async(name,index,nextRoom)=>{try{await joinGame(name,index,nextRoom)}catch(e){setError(e instanceof Error?e.message:'Couldn’t hop in. Please try again.')}}}/>;
 if(!races[0])return <main className="splash"><h1>Opening room {room}…</h1><button className="primary" onClick={()=>setEntered(false)}>Back to my duck</button></main>;
 return <RaceScreen race={races[0]} players={players} legends={legends} items={items} effects={effects} results={results.filter(r=>r.raceNumber===races[0].raceNumber)} identity={identity?.toHexString()??''} onTap={()=>tap()} onStart={()=>start()} onUseItem={()=>useItem()} onEdit={()=>setEditing(true)}/>;
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
