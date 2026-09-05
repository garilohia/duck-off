import {useMemo,useState} from 'react';
import {SpacetimeDBProvider,useSpacetimeDB,useTable,useReducer} from 'spacetimedb/react';
import {DbConnection,tables,reducers} from './module_bindings';
import {useGameTools} from './useGameTools';
import NameEntry from './NameEntry';
import RaceScreen from './RaceScreen';
function Game(){const {isActive,identity,connectionError}=useSpacetimeDB();const [allRaces,raceReady]=useTable(tables.race);const [allPlayers,playersReady]=useTable(tables.racePlayer);const [allLegends,legendsReady]=useTable(tables.player);const join=useReducer(reducers.join);const tap=useReducer(reducers.tap);const [entered,setEntered]=useState(false);const [error,setError]=useState('');const [editing,setEditing]=useState(false);
 const [room,setRoom]=useState(()=>new URLSearchParams(location.search).get('room')?.trim().toUpperCase()||'PUBLIC');
 const races=allRaces.filter(r=>r.id===room),players=allPlayers.filter(p=>p.room===room),legends=allLegends.filter(p=>p.room===room);
 const joinGame=async(name:string,duckIndex:number,selectedRoom=room)=>{const nextRoom=selectedRoom.trim().toUpperCase()||'PUBLIC';await join({name,duckIndex,room:nextRoom});setRoom(nextRoom);const url=new URL(location.href);url.searchParams.set('room',nextRoom);history.replaceState(null,'',url);localStorage.setItem('duckoff_name',name.trim()||'Duck');localStorage.setItem('duckoff_duck',String(duckIndex));setEntered(true);setEditing(false);setError('')};
 useGameTools({connected:isActive,race:races[0],players:players.map(p=>({name:p.name,active:p.active,pos:p.pos,place:p.place,rank:p.rank,taps:p.taps}))},joinGame,()=>tap());
 if(!isActive||!raceReady||!playersReady||!legendsReady)return <div className="splash"><div className="splash-duck">🦆</div><p>{connectionError?'The tub’s taking a breather.':'filling the tub…'}</p>{connectionError&&<><span>We couldn’t reach the river. Let’s try again.</span><button className="primary" onClick={()=>location.reload()}>REFILL THE TUB ↻</button></>}</div>;
 if(!entered||editing)return <NameEntry initialRoom={room} error={error} count={legends.filter(p=>p.online).length} onJoin={async(name,duckIndex,selectedRoom)=>{try{await joinGame(name,duckIndex,selectedRoom)}catch{setError('Couldn’t hop in. Give it another quack.')}}}/>;
 if(!races[0])return <div className="splash"><p>Opening room {room}…</p></div>;
 return <RaceScreen race={races[0]} players={players} legends={legends} identity={identity?.toHexString()??''} onTap={()=>tap()} onEdit={()=>setEditing(true)}/>;
}
export default function App(){const builder=useMemo(()=>DbConnection.builder().withUri(process.env.NEXT_PUBLIC_STDB_URI||(location.protocol==='https:'?'wss://maincloud.spacetimedb.com':`ws://${location.hostname}:3030`)).withDatabaseName(process.env.NEXT_PUBLIC_STDB_MODULE||(location.protocol==='https:'?'duckoff-rooms-gari-20260905':'duckoff')).withToken(sessionStorage.getItem('duckoff_rooms_token')??undefined).onConnect((_ctx,_identity,token)=>sessionStorage.setItem('duckoff_rooms_token',token)),[]);return <SpacetimeDBProvider connectionBuilder={builder}><Game/></SpacetimeDBProvider>}
