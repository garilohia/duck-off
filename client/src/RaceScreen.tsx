import {useEffect,useRef,useState,useCallback} from 'react';
import RaceScene from './three/RaceScene';
import DuckPreview from './three/DuckPreview';
import {ordinal,DUCK_COLORS} from './palette';
import {squeak,unlockAudio,setMuted,isMuted,honk,bonk,fanfare,buzz} from './squeak';
import {ITEMS,OBSTACLES,LANES,TRACK} from './items';
import type {Player,Race,RacePlayer,RaceResult,RaceItem,ItemEffect,RaceFeature} from './module_bindings/types';
type Props={race:Race;players:readonly RacePlayer[];legends:readonly Player[];results:readonly RaceResult[];items:readonly RaceItem[];effects:readonly ItemEffect[];features:readonly RaceFeature[];identity:string;onTap:()=>Promise<void>;onStart:()=>Promise<void>;onUseItem:()=>Promise<void>;onSwitchLane:(direction:number)=>Promise<void>;onLeave:()=>void};
const COMBO_WINDOW=520;
// A little paper shower for crossing the line. Pure CSS; the pieces are laid out deterministically.
function Confetti(){return <div className="confetti" aria-hidden="true">{Array.from({length:42},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,animationDelay:`${(i%7)*.12}s`,animationDuration:`${2.4+(i%5)*.3}s`,background:['#ffd02b','#f27860','#428fda','#63c27a','#fffdf5'][i%5],transform:`rotate(${i*23}deg)`}}/>)}</div>;}
export default function RaceScreen({race,players,legends,results,items,effects,features,identity,onTap,onStart,onUseItem,onSwitchLane,onLeave}:Props){
 const [muted,updateMuted]=useState(isMuted),[error,setError]=useState(''),[starting,setStarting]=useState(false),[copied,setCopied]=useState(false),[showLink,setShowLink]=useState(false),[showRanks,setShowRanks]=useState(false);
 const lastTap=useRef(0),tapPending=useRef(0),comboRef=useRef({count:0,at:0}),[combo,setCombo]=useState(0),[celebrate,setCelebrate]=useState(false);
 const itemPending=useRef(false),[usingItem,setUsingItem]=useState(false),lanePending=useRef(false);
 const mine=players.find(p=>p.identity.toHexString()===identity),racing=race.status==='racing',spectator=!mine?.active,finished=race.status==='finished',countdown=race.status==='countdown';
 const secs=Math.ceil(race.phaseTicksLeft/10),online=legends.filter(p=>p.online),active=players.filter(p=>p.active),standings=[...active].sort((a,b)=>a.rank-b.rank),orderedResults=[...results].sort((a,b)=>a.place-b.place),myResult=results.find(p=>p.identity.toHexString()===identity);
 const leaders=[...legends].filter(p=>p.racesWon>0).sort((a,b)=>b.racesWon-a.racesWon||(a.identity.toHexString()<b.identity.toHexString()?-1:1)).slice(0,3);
 const myItem=items.find(p=>p.identity.toHexString()===identity),held=ITEMS[myItem?.held??''];
 const canDrive=(racing||countdown)&&!spectator&&!mine?.place;
 const useItem=useCallback(async()=>{
  if(!racing||spectator||mine?.place||!myItem?.held||itemPending.current)return;
  itemPending.current=true;setUsingItem(true);unlockAudio();
  try{await onUseItem();squeak(mine?.duckIndex??0,.2);buzz(15)}catch(e){setError(e instanceof Error?e.message:'Your item missed. Try again.')}finally{itemPending.current=false;setUsingItem(false)}
 },[racing,spectator,mine,myItem?.held,onUseItem]);
 const switchLane=useCallback((direction:number)=>{
  if(!canDrive||lanePending.current)return;const lane=(mine?.lane??2)+direction;if(lane<0||lane>=LANES)return;
  lanePending.current=true;unlockAudio();squeak(mine?.duckIndex??0,.09,direction*.5,1.3);buzz(6);
  void onSwitchLane(direction).catch(()=>{}).finally(()=>{lanePending.current=false});
 },[canDrive,mine?.lane,mine?.duckIndex,onSwitchLane]);
 const url=new URL(location.href);url.searchParams.set('room',race.id);
 const shareRoom=async()=>{try{await navigator.clipboard.writeText(url.toString());setCopied(true)}catch{setShowLink(true)}};
 const start=async()=>{unlockAudio();setStarting(true);setError('');try{await onStart()}catch{setError('Couldn’t start just yet. Please try again.')}finally{setStarting(false)}};
 const tap=useCallback(()=>{
  if(!racing||spectator||mine?.place)return;const now=performance.now();if(now-lastTap.current<40||tapPending.current>=4)return;
  lastTap.current=now;tapPending.current++;unlockAudio();
  // The squeak climbs with the boost meter; consistent tapping builds a combo.
  const meter=mine?.boostTicksLeft?20:(mine?.boostMeter??0);squeak(mine?.duckIndex??0,.13,0,1+meter/20*.55);buzz(8);
  const c=comboRef.current;c.count=now-c.at<COMBO_WINDOW?c.count+1:1;c.at=now;setCombo(c.count);
  void onTap().catch(()=>setError('Connection hiccup. Keep your duck here and try another tap.')).finally(()=>tapPending.current--);
 },[racing,spectator,mine,onTap]);
 // Combo fades when the tapping stops.
 useEffect(()=>{if(!combo)return;const timer=setTimeout(()=>{comboRef.current.count=0;setCombo(0)},COMBO_WINDOW*1.6);return()=>clearTimeout(timer)},[combo]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{const el=e.target instanceof Element?e.target:null;if(e.repeat||el?.closest('input,textarea,summary'))return;if(e.code==='KeyE'){e.preventDefault();void useItem()}else if(e.code==='ArrowLeft'||e.code==='KeyA'){e.preventDefault();switchLane(-1)}else if(e.code==='ArrowRight'||e.code==='KeyD'){e.preventDefault();switchLane(1)}else if((e.code==='Space'||e.code==='Enter')&&!el?.closest('button')){e.preventDefault();tap()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[tap,useItem,switchLane]);
 // Swipe left or right anywhere on the race screen to hop a lane. Taps still tap; a swipe that starts on
 // the paddle button counts as one paddle plus the hop.
 useEffect(()=>{
  let start:{x:number;y:number;id:number}|undefined;
  const down=(e:PointerEvent)=>{if(!e.isPrimary||(e.target instanceof Element&&e.target.closest('input,.results-scroll,.live-standings,details')))return;start={x:e.clientX,y:e.clientY,id:e.pointerId}};
  const up=(e:PointerEvent)=>{if(!start||e.pointerId!==start.id)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=undefined;if(Math.abs(dx)>36&&Math.abs(dx)>Math.abs(dy)*1.2)switchLane(Math.sign(dx))};
  const cancel=()=>{start=undefined};
  window.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);
  return()=>{window.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel)};
 },[switchLane]);
 // Boost honk, bonk on a hit, fanfare and confetti on crossing the line.
 const boosting=!!mine?.boostTicksLeft,slowed=!!myItem?.slowTicks,placed=!!mine?.place;
 const wasBoosting=useRef(false),wasSlowed=useRef(false),wasPlaced=useRef(false);
 useEffect(()=>{if(boosting&&!wasBoosting.current&&racing){honk(mine?.duckIndex??0);buzz(30)}wasBoosting.current=boosting},[boosting,racing,mine?.duckIndex]);
 useEffect(()=>{if(slowed&&!wasSlowed.current&&racing){bonk();buzz([30,40,30])}wasSlowed.current=slowed},[slowed,racing]);
 useEffect(()=>{if(placed&&!wasPlaced.current&&racing){fanfare(mine?.duckIndex??0);buzz([40,60,80]);setCelebrate(true);setTimeout(()=>setCelebrate(false),4000)}wasPlaced.current=placed},[placed,racing,mine?.duckIndex]);
 useEffect(()=>{setShowRanks(false);setError('');comboRef.current.count=0;setCombo(0);if(race.status==='finished'&&myResult?.place===1)setCelebrate(true);if(race.status!=='finished')setCelebrate(false)},[race.status]); // eslint-disable-line react-hooks/exhaustive-deps
 const startButton=<button className="primary start-button" disabled={starting} onClick={start}>{starting?'Gathering the ducks…':finished?'Play again':'Start race'} <span aria-hidden="true">↗</span></button>;
 const laneRow=<div className="lane-row" aria-label="Lane"><button className="lane-arrow" aria-label="Move left" disabled={!canDrive||(mine?.lane??0)===0} onPointerDown={e=>{e.preventDefault();e.stopPropagation();switchLane(-1)}}>◀</button><span className="lane-dots" aria-hidden="true">{Array.from({length:LANES},(_,i)=><i key={i} className={i===mine?.lane?'on':''}/>)}</span><button className="lane-arrow" aria-label="Move right" disabled={!canDrive||(mine?.lane??0)===LANES-1} onPointerDown={e=>{e.preventDefault();e.stopPropagation();switchLane(1)}}>▶</button></div>;
 return <main className={`race-screen phase-${race.status}`} data-phase={race.status}>
  <div className="river-fallback" aria-hidden="true"><div className="fallback-racers">{active.map((p,i)=><span key={p.identity.toHexString()} style={{left:`${8+i/Math.max(active.length,1)*80}%`,bottom:`${10+p.pos/TRACK*65}%`}}>🦆<small>{p.name}</small></span>)}</div></div>
  <div className="scene-layer" onPointerDown={e=>{if(e.isPrimary)tap()}}><RaceScene race={race} players={players} items={items} effects={effects} features={features} identity={identity}/></div>
  {celebrate&&<Confetti/>}
  <header className="race-header"><div className="race-brand"><button className="brand-mini brand-home" aria-label="Back to the home screen" onClick={onLeave}>duck off<span>!</span></button></div><div className="header-actions"><button className="icon-button" aria-label={muted?'Unmute squeaks':'Mute squeaks'} onClick={()=>{unlockAudio();updateMuted(!muted);setMuted(!muted)}}>{muted?'♪̸':'♫'}</button></div></header>
  {!finished&&<div className="room-strip"><span>ROOM <b>{race.id}</b></span><button onClick={shareRoom}>{copied?'Copied ✓':'Invite friends ↗'}</button></div>}
  {showLink&&<div className="share-fallback"><label htmlFor="share-link">Copy this room link</label><input id="share-link" readOnly value={url.toString()} onFocus={e=>e.target.select()}/><button className="text-button" onClick={()=>setShowLink(false)}>Done</button></div>}
  {race.status==='lobby'&&<section className="lobby-panel surface"><div className="eyebrow">THE FLOCK IS GATHERING</div><h1>Everyone here?</h1><p>Share your room. Start when you’re ready.</p><div className="roster" aria-label="Players in the room">{online.map(p=><span key={p.identity.toHexString()}><i style={{background:DUCK_COLORS[p.duckIndex]}} aria-hidden="true">♥</i>{p.name}{p.identity.toHexString()===identity&&<small>you</small>}</span>)}</div>{startButton}<span className="panel-note">{online.length} {online.length===1?'duck':'ducks'} ready · anyone can start</span><details className="item-guide"><summary>How to play</summary><p>Tap to paddle. Swipe left or right (or use ◀ ▶) to change lanes. Steer into a ? buoy to collect a toy, then tap its button (or press E) to use it. Ride the white rapids for a free whoosh.</p><ul>{Object.values(ITEMS).map(item=><li key={item.name}><b>{item.icon} {item.name}</b><span>{item.hint}</span></li>)}{Object.values(OBSTACLES).map(o=><li key={o.name}><b>⚠ {o.name}</b><span>{o.hint}</span></li>)}</ul></details></section>}
  {countdown&&<section className="countdown-overlay" aria-live="assertive"><p>{spectator?'You’ll join the next race':'Pick your lane. Little wings at the ready…'}</p><strong key={secs}>{secs}</strong><span>Tap to paddle · swipe to dodge rocks and logs</span></section>}
  {countdown&&!spectator&&<section className="race-controls">{laneRow}</section>}
  {racing&&<><section className="race-status"><span className="status-pill">{spectator?'CHEERING SECTION':mine?.place?`${ordinal(mine.place)} · FINISHED`:`${ordinal(mine?.rank||1)} of ${active.length}`}</span><button className="status-pill" onClick={()=>setShowRanks(!showRanks)} aria-expanded={showRanks}>{showRanks?'Close standings':'Standings'} {showRanks?'×':'↗'}</button><span className="status-pill timer">{secs}s</span></section>
   {showRanks&&<section className="live-standings surface" aria-label="Live standings"><h2>Little league leaders</h2><ol>{standings.map(p=><li key={p.identity.toHexString()} className={p.identity.toHexString()===identity?'is-you':''}><b>{p.rank}</b><span>{p.name}{p.identity.toHexString()===identity?' (you)':''}</span><small>{p.place?'Finished':`${Math.floor(p.pos/24)}%`}</small></li>)}</ol></section>}
   {race.phaseTicksLeft>390&&!showRanks&&<div className="go-flash" aria-live="polite">GO!</div>}
   {combo>=5&&!mine?.place&&<div className="combo" key={combo} aria-live="off">×{combo}<small>combo</small></div>}
   <section className="race-controls">{spectator?<div className="waiting-message surface"><h2>Your turn is coming.</h2><p>Enjoy the splashes. You’re in the next race.</p></div>:mine?.place?<div className="waiting-message surface"><h2>A {ordinal(mine.place)} place splash!</h2><p>Let’s cheer the others home.</p></div>:<><div className="progress-info"><span>{Math.floor((mine?.pos??0)/24)}% of the way</span><span>{mine?.boostTicksLeft?'A little extra whoosh!':`${mine?.boostMeter??0}/20 to a boost`}</span></div><div className="boost-track" role="progressbar" aria-label="Boost meter" aria-valuemin={0} aria-valuemax={20} aria-valuenow={mine?.boostTicksLeft?20:mine?.boostMeter??0}><div style={{width:`${mine?.boostTicksLeft?100:(mine?.boostMeter??0)*5}%`}}/></div>{laneRow}<div className="driving-controls"><button className={`tap-button ${mine?.boostTicksLeft||myItem?.turboTicks?'boosting':''}`} onPointerDown={e=>{e.preventDefault();if(e.isPrimary)tap()}} onClick={e=>{if(e.detail===0)tap()}}>TAP TO PADDLE <span aria-hidden="true">♡</span></button><button className={`item-button ${held?'has-item':''}`} disabled={!held||usingItem} onClick={()=>void useItem()} aria-label={held?`Use ${held.name}`:'Empty item slot'} title={held?.hint}><span aria-hidden="true">{held?.icon??'?'}</span><b>{usingItem?'Sending…':held?.name??'Item buoy'}</b></button></div><p className="item-hint">{myItem?.slowTicks?`Bonk! Half speed · ${(myItem.slowTicks/10).toFixed(1)}s`:myItem?.shieldTicks?`Shield ready · ${(myItem.shieldTicks/10).toFixed(1)}s`:myItem?.turboTicks?`Rocket rush! · ${(myItem.turboTicks/10).toFixed(1)}s`:held?held.hint:'Steer into a ? buoy for a toy. Swipe to dodge rocks and logs.'}</p></>}</section>
  </>}
  {finished&&<div className="results-scroll"><section className="results-card surface" aria-label="Race results"><div className="eyebrow">A VERY GOOD LITTLE RACE</div><h1>{orderedResults[0]?.name??race.winnerName} wins!</h1><div className="winner-portrait"><DuckPreview index={orderedResults[0]?.duckIndex??race.winnerDuckIndex} spinnable/><span className="winner-medal">1</span></div><p className="result-message">{myResult?`You splashed into ${ordinal(myResult.place)}. ${myResult.place===1?'Look at you go!':'Your duck is proud of you.'}`:'Your little duck is up next.'}</p>
   <ol className="results-list" aria-label="Final rankings">{orderedResults.map(p=><li key={p.id} data-place={p.place} className={p.identity.toHexString()===identity?'is-you':''}><b className="result-place">{p.place<=3?['①','②','③'][p.place-1]:p.place}</b><span className="result-name">{p.name}{p.identity.toHexString()===identity&&<small>you</small>}<em>{p.pos>=TRACK?'Crossed the line':`${Math.floor(p.pos/24)}% at the buzzer`}</em></span><span className="result-taps">{p.taps}<small>taps</small></span></li>)}</ol>
   <p className="ranking-note">Finishers first. At the buzzer, remaining ducks are ranked by distance. Exact ties use a fixed order.</p><section className="legends" aria-label="Flock legends"><h2>Flock legends</h2><p>Lifetime wins · ducks in this room</p>{leaders.length?<ol>{leaders.map(p=><li key={p.identity.toHexString()}><span>{p.name}</span><b>{p.racesWon} {p.racesWon===1?'win':'wins'}</b></li>)}</ol>:<p>The first little legend is on the way.</p>}</section><div className="results-actions">{startButton}<button className="text-button" onClick={onLeave}>Back to main menu</button><span className="panel-note">No automatic rematch. Take your time. ♡</span></div>
  </section></div>}
  {error&&<div className="connection-warning" role="alert"><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={()=>setError('')}>×</button></div>}
 </main>;
}
