import {useState} from 'react';
import DuckPreview from './three/DuckPreview';
import {DUCKS} from './palette';
import {unlockAudio,squeak} from './squeak';
export default function NameEntry({onJoin,error,initialRoom,onCancel}:{onJoin:(name:string,index:number,room:string)=>Promise<void>;error?:string;initialRoom:string;onCancel?:()=>void}){
 const [room,setRoom]=useState(initialRoom);
 const [index,setIndex]=useState(()=>{const saved=Number(localStorage.getItem('duckoff_duck'));return Number.isInteger(saved)&&saved>=0&&saved<8?saved:0;});
 const [name,setName]=useState(()=>localStorage.getItem('duckoff_name')??''),[busy,setBusy]=useState(false);
 const choose=(i:number)=>{unlockAudio();setIndex(i);squeak(i,.12)};
 return <main className="entry-screen">
  <header className="entry-top"><span className="brand-mini">duck off<span>!</span></span><span className="live-pill"><i/> a little friendly rivalry</span></header>
  <div className="entry-content">
   <div className="entry-heading"><div className="eyebrow">TINY DUCKS. BIG HEART.</div><h1 className="logo">duck off<span>!</span></h1><p>Your new favourite little race.</p><div className="tagline">Pick a friend. Bring your friends. Make a splash.</div></div>
   <section className="entry-card" aria-label="Choose your duck and room">
    <div className="character-pane"><div className="card-heading"><span>MEET YOUR LITTLE DUCK</span><span>0{index+1} / 08</span></div>
     <div className="picker"><div className="preview-water"><DuckPreview index={index}/></div><button className="arrow prev" aria-label="Previous duck" onClick={()=>choose((index+7)%8)}>‹</button><button className="arrow next" aria-label="Next duck" onClick={()=>choose((index+1)%8)}>›</button><span className="toy-sticker">very<br/>huggable</span></div>
     <div className="character-info" aria-live="polite"><h2>{DUCKS[index][0]}</h2><span>{DUCKS[index][1]}</span></div>
     <div className="picker-dots" aria-label="Duck characters">{DUCKS.map((d,i)=><button key={d[0]} aria-label={d[0]} aria-pressed={i===index} onClick={()=>choose(i)} className={i===index?'selected':''}><span/></button>)}</div>
    </div>
    <form onSubmit={async e=>{e.preventDefault();unlockAudio();squeak(index);setBusy(true);try{await onJoin(name,index,room)}finally{setBusy(false)}}}>
     <label htmlFor="duck-name">Your duck’s name</label><div className="name-input"><input id="duck-name" placeholder="e.g. Waddles" maxLength={14} value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" enterKeyHint="next"/><span>{name.length}/14</span></div>
     <label className="room-label" htmlFor="room-code">Room code <span>Same code, same lagoon.</span></label><div className="name-input"><input id="room-code" value={room} maxLength={16} pattern="[A-Za-z0-9-]{1,16}" required onChange={e=>setRoom(e.target.value.toUpperCase())} autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="go"/></div>
     <button className="new-room" type="button" onClick={()=>setRoom(crypto.randomUUID().slice(0,6).toUpperCase())}>＋ Make a new room</button>
     {error&&<p className="form-error" role="alert">{error}</p>}
     <button className="primary" disabled={busy}>{busy?'Hopping in…':'Let’s waddle in'} <span aria-hidden="true">↗</span></button>
     {onCancel&&<button type="button" className="text-button" onClick={onCancel}>Back to the race</button>}
     <p className="entry-note">No rush. Your race starts when you say so.</p>
    </form>
   </section>
  </div><footer className="entry-footer"><span>Made for little moments together.</span><span>Sound on for tiny squeaks ♫</span></footer>
 </main>;
}
