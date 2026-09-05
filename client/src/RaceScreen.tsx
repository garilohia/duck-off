import {useEffect,useRef,useState,useCallback} from 'react';
import RaceScene from './three/RaceScene';
import DuckPreview from './three/DuckPreview';
import {ordinal,DUCK_COLORS} from './palette';
import {squeak,unlockAudio,setMuted,isMuted,honk,bonk,fanfare,buzz,crowdCheer,glub} from './squeak';
import {ITEMS,OBSTACLES,LANES,TRACK,STEER_ONLY} from './items';
import type {Player,Race,RacePlayer,RaceResult,RaceItem,ItemEffect,RaceFeature} from './module_bindings/types';
type Props={onSteer:(amount:number)=>Promise<void>;race:Race;players:readonly RacePlayer[];legends:readonly Player[];results:readonly RaceResult[];items:readonly RaceItem[];effects:readonly ItemEffect[];features:readonly RaceFeature[];identity:string;onTap:()=>Promise<void>;onStart:()=>Promise<void>;onUseItem:()=>Promise<void>;onSwitchLane:(direction:number)=>Promise<void>;onLeave:()=>void};
const COMBO_WINDOW=520;
const touchDevice=()=>typeof window!=='undefined'&&('ontouchstart' in window||navigator.maxTouchPoints>0);
// iOS shares motion data only after a permission prompt that must come from a real click or touch end,
// never from pointerdown. Tilt is always on; if the prompt is refused we simply keep asking on later taps.
type MotionCtor={requestPermission?:()=>Promise<string>};
type MotionWindow={DeviceOrientationEvent?:MotionCtor;DeviceMotionEvent?:MotionCtor};
const needsMotionPrompt=()=>typeof (window as unknown as MotionWindow).DeviceOrientationEvent?.requestPermission==='function';
// Orientation drives steering, motion drives shake-to-use; iOS prompts for both.
async function requestTilt():Promise<boolean>{const w=window as unknown as MotionWindow;if(!w.DeviceOrientationEvent)return false;if(typeof w.DeviceOrientationEvent.requestPermission!=='function')return true;try{const ok=(await w.DeviceOrientationEvent.requestPermission())==='granted';if(typeof w.DeviceMotionEvent?.requestPermission==='function')await w.DeviceMotionEvent.requestPermission().catch(()=>{});return ok}catch{return false}}
const TILT_DEADZONE=4,TILT_FULL=24,SHAKE_G=19;
// A little paper shower for crossing the line. Pure CSS; the pieces are laid out deterministically.
function Confetti(){return <div className="confetti" aria-hidden="true">{Array.from({length:42},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,animationDelay:`${(i%7)*.12}s`,animationDuration:`${2.4+(i%5)*.3}s`,background:['#ffd02b','#f27860','#428fda','#63c27a','#fffdf5'][i%5],transform:`rotate(${i*23}deg)`}}/>)}</div>;}
export default function RaceScreen({race,players,legends,results,items,effects,features,identity,onTap,onStart,onUseItem,onSwitchLane,onSteer,onLeave}:Props){
 const [muted,updateMuted]=useState(isMuted),[error,setError]=useState(''),[starting,setStarting]=useState(false),[copied,setCopied]=useState(false),[showLink,setShowLink]=useState(false),[showRanks,setShowRanks]=useState(false);
 const lastTap=useRef(0),tapPending=useRef(0),comboRef=useRef({count:0,at:0}),[combo,setCombo]=useState(0),[celebrate,setCelebrate]=useState(false);
 const itemPending=useRef(false),[usingItem,setUsingItem]=useState(false),lanePending=useRef(false);
 const [motionGranted,setMotionGranted]=useState(()=>!needsMotionPrompt()),steering=useRef({sent:0,at:0}),shakeAt=useRef(0);
 const mine=players.find(p=>p.identity.toHexString()===identity),racing=race.status==='racing',spectator=!mine?.active,finished=race.status==='finished',countdown=race.status==='countdown';
 const secs=Math.ceil(race.phaseTicksLeft/10),online=legends.filter(p=>p.online),active=players.filter(p=>p.active),standings=[...active].sort((a,b)=>a.rank-b.rank),orderedResults=[...results].sort((a,b)=>a.place-b.place),myResult=results.find(p=>p.identity.toHexString()===identity);
 const leaders=[...legends].filter(p=>p.racesWon>0).sort((a,b)=>b.racesWon-a.racesWon||(a.identity.toHexString()<b.identity.toHexString()?-1:1)).slice(0,3);
 const myItem=items.find(p=>p.identity.toHexString()===identity),held=ITEMS[myItem?.held??''];
 const drowned=!!mine?.drowned;
 const canDrive=(racing||countdown)&&!spectator&&!mine?.place&&!drowned;
 const useItem=useCallback(async()=>{
  if(!racing||spectator||mine?.place||drowned||!myItem?.held||itemPending.current)return;
  itemPending.current=true;setUsingItem(true);unlockAudio();
  try{await onUseItem();squeak(mine?.duckIndex??0,.2);buzz(15)}catch(e){setError(e instanceof Error?e.message:'Your item missed. Try again.')}finally{itemPending.current=false;setUsingItem(false)}
 },[racing,spectator,mine,drowned,myItem?.held,onUseItem]);
 // Fluid steering: send how hard we push sideways (-1..1), at most 10 times a second and only when it changes.
 // Kept stable through refs so the tilt/key effects never re-run (and reset the push) on every server update.
 const steerRefs=useRef({onSteer,canDrive});steerRefs.current={onSteer,canDrive};
 const pushSteer=useCallback((amount:number,force=false)=>{
  if(!steerRefs.current.canDrive)return;const now=performance.now(),s=steering.current;const next=Math.abs(amount)<.02?0:Math.max(-1,Math.min(1,amount));
  if(!force&&(Math.abs(next-s.sent)<.06||(now-s.at<100&&next!==0)))return;
  s.sent=next;s.at=now;void steerRefs.current.onSteer(next).catch(()=>{});
 },[]);
 const switchLane=useCallback((direction:number)=>{
  if(!canDrive||lanePending.current)return;const lane=(mine?.lane??2)+direction;if(lane<0||lane>=LANES)return;
  lanePending.current=true;unlockAudio();squeak(mine?.duckIndex??0,.09,direction*.5,1.3);buzz(6);
  void onSwitchLane(direction).catch(()=>{}).finally(()=>{lanePending.current=false});
 },[canDrive,mine?.lane,mine?.duckIndex,onSwitchLane]);
 const url=new URL(location.href);url.searchParams.set('room',race.id);
 const shareRoom=async()=>{try{await navigator.clipboard.writeText(url.toString());setCopied(true)}catch{setShowLink(true)}};
 const armTilt=async()=>{if(motionGranted)return;if(await requestTilt())setMotionGranted(true)};
 const start=async()=>{unlockAudio();void armTilt();setStarting(true);setError('');try{await onStart()}catch{setError('Couldn’t start just yet. Please try again.')}finally{setStarting(false)}};
 const tap=useCallback(()=>{
  if(STEER_ONLY||!racing||spectator||mine?.place||drowned)return;const now=performance.now();if(now-lastTap.current<40||tapPending.current>=4)return;
  lastTap.current=now;tapPending.current++;unlockAudio();
  // The squeak climbs with the boost meter; consistent tapping builds a combo.
  const meter=mine?.boostTicksLeft?20:(mine?.boostMeter??0);squeak(mine?.duckIndex??0,.13,0,1+meter/20*.55);buzz(8);
  const c=comboRef.current;c.count=now-c.at<COMBO_WINDOW?c.count+1:1;c.at=now;setCombo(c.count);
  void onTap().catch(()=>setError('Connection hiccup. Keep your duck here and try another tap.')).finally(()=>tapPending.current--);
 },[racing,spectator,mine,drowned,onTap]);
 // Combo fades when the tapping stops.
 useEffect(()=>{if(!combo)return;const timer=setTimeout(()=>{comboRef.current.count=0;setCombo(0)},COMBO_WINDOW*1.6);return()=>clearTimeout(timer)},[combo]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{const el=e.target instanceof Element?e.target:null;if(e.repeat||el?.closest('input,textarea,summary'))return;if(e.code==='KeyE'){e.preventDefault();void useItem()}else if(e.code==='ArrowLeft'||e.code==='KeyA'){e.preventDefault();pushSteer(-1,true)}else if(e.code==='ArrowRight'||e.code==='KeyD'){e.preventDefault();pushSteer(1,true)}else if((e.code==='Space'||e.code==='Enter')&&!el?.closest('button')){e.preventDefault();tap()}};const up=(e:KeyboardEvent)=>{if(['ArrowLeft','KeyA','ArrowRight','KeyD'].includes(e.code))pushSteer(0,true)};window.addEventListener('keydown',key);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',up)}},[tap,useItem,pushSteer]);
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
 // Ask for motion access from real gestures (click / touchend) until it is granted.
 useEffect(()=>{if(motionGranted)return;const ask=()=>{void armTilt()};window.addEventListener('click',ask);window.addEventListener('touchend',ask);return()=>{window.removeEventListener('click',ask);window.removeEventListener('touchend',ask)}},[motionGranted]); // eslint-disable-line react-hooks/exhaustive-deps
 // Tilt the phone to steer, portrait only: a small dead zone, then the harder you tilt the faster the duck slides across.
 useEffect(()=>{
  if(!canDrive)return;
  const onTilt=(e:DeviceOrientationEvent)=>{if(e.gamma==null||window.innerWidth>window.innerHeight)return;const g=e.gamma;const amount=Math.abs(g)<TILT_DEADZONE?0:Math.sign(g)*Math.min(1,(Math.abs(g)-TILT_DEADZONE)/(TILT_FULL-TILT_DEADZONE));pushSteer(amount);};
  window.addEventListener('deviceorientation',onTilt);return()=>{window.removeEventListener('deviceorientation',onTilt);pushSteer(0,true)};
 },[canDrive,pushSteer]);
 // Shake the phone to use the toy you are holding, so your thumbs never leave the paddle.
 useEffect(()=>{
  if(!racing||spectator)return;
  const onShake=(e:DeviceMotionEvent)=>{const a=e.acceleration;if(!a||a.x==null||a.y==null||a.z==null)return;const g=Math.hypot(a.x,a.y,a.z);const now=performance.now();if(g>SHAKE_G&&now-shakeAt.current>900){shakeAt.current=now;void useItem()}};
  window.addEventListener('devicemotion',onShake);return()=>window.removeEventListener('devicemotion',onShake);
 },[racing,spectator,useItem]);
 // Boost honk, bonk on a hit, fanfare and confetti on crossing the line.
 const boosting=!!mine?.boostTicksLeft,slowed=!!myItem?.slowTicks,placed=!!mine?.place;
 const wasBoosting=useRef(false),wasSlowed=useRef(false),wasPlaced=useRef(false),wasDrowned=useRef(false);
 useEffect(()=>{if(boosting&&!wasBoosting.current&&racing){honk(mine?.duckIndex??0);buzz(30)}wasBoosting.current=boosting},[boosting,racing,mine?.duckIndex]);
 useEffect(()=>{if(slowed&&!wasSlowed.current&&racing){bonk();buzz([30,40,30])}wasSlowed.current=slowed},[slowed,racing]);
 useEffect(()=>{if(placed&&!wasPlaced.current&&racing){fanfare(mine?.duckIndex??0);buzz([40,60,80]);setCelebrate(true);setTimeout(()=>setCelebrate(false),4000)}wasPlaced.current=placed},[placed,racing,mine?.duckIndex]);
 useEffect(()=>{if(drowned&&!wasDrowned.current&&racing){glub(mine?.duckIndex??0);buzz([60,30,60,30,120])}wasDrowned.current=drowned},[drowned,racing,mine?.duckIndex]);
 // Confetti always comes with the crowd.
 useEffect(()=>{if(celebrate)crowdCheer()},[celebrate]);
 useEffect(()=>{setShowRanks(false);setError('');comboRef.current.count=0;setCombo(0);if(race.status==='finished'&&myResult?.place===1&&!race.forfeited)setCelebrate(true);if(race.status!=='finished')setCelebrate(false)},[race.status]); // eslint-disable-line react-hooks/exhaustive-deps
 const startButton=<button className="primary start-button" disabled={starting} onClick={start}>{starting?'Gathering the ducks…':finished?'Play again':'Start race'} <span aria-hidden="true">↗</span></button>;
 const laneRow=<div className="lane-row" aria-label="Lane"><span className="lane-track" aria-hidden="true">{Array.from({length:LANES},(_,i)=><i key={i}/>)}<b style={{left:`${((mine?.lane??2)/(LANES-1))*100}%`}}/></span><span className="lane-help">{touchDevice()?(motionGranted?'tilt to steer':<button type="button" className="tilt-toggle" onClick={()=>void armTilt()}>allow tilt steering</button>):'hold ← → to steer'}{touchDevice()&&<small>or swipe · shake to use a toy</small>}</span></div>;
 return <main className={`race-screen phase-${race.status}`} data-phase={race.status}>
  <div className="river-fallback" aria-hidden="true"><div className="fallback-racers">{active.map((p,i)=><span key={p.identity.toHexString()} style={{left:`${8+i/Math.max(active.length,1)*80}%`,bottom:`${10+p.pos/TRACK*65}%`}}>🦆<small>{p.name}</small></span>)}</div></div>
  <div className="scene-layer" onPointerDown={e=>{if(!e.isPrimary)return;if(STEER_ONLY)switchLane(e.clientX<window.innerWidth/2?-1:1);else tap()}}><RaceScene race={race} players={players} items={items} effects={effects} features={features} identity={identity}/></div>
  {celebrate&&<Confetti/>}
  <header className="race-header"><div className="race-brand"><button className="brand-mini brand-home" aria-label="Back to the home screen" onClick={onLeave}>duck off<span>!</span></button></div><div className="header-actions"><button className="icon-button" aria-label={muted?'Unmute squeaks':'Mute squeaks'} onClick={()=>{unlockAudio();updateMuted(!muted);setMuted(!muted)}}>{muted?'♪̸':'♫'}</button></div></header>
  {!finished&&<div className="room-strip"><span>ROOM <b>{race.id}</b></span><button onClick={shareRoom}>{copied?'Copied ✓':'Invite friends ↗'}</button></div>}
  {showLink&&<div className="share-fallback"><label htmlFor="share-link">Copy this room link</label><input id="share-link" readOnly value={url.toString()} onFocus={e=>e.target.select()}/><button className="text-button" onClick={()=>setShowLink(false)}>Done</button></div>}
  {race.status==='lobby'&&<section className="lobby-panel surface"><div className="eyebrow">{race.id.startsWith('SOLO-')?'YOUR PRACTICE RIVER':'THE FLOCK IS GATHERING'}</div><h1>Everyone here?</h1><p>Share your room. Start when you’re ready.</p><div className="roster" aria-label="Players in the room">{online.map(p=><span key={p.identity.toHexString()}><i style={{background:DUCK_COLORS[p.duckIndex]}} aria-hidden="true">♥</i>{p.name}{p.identity.toHexString()===identity&&<small>you</small>}</span>)}</div>{startButton}<span className="panel-note">{online.length} {online.length===1?'duck':'ducks'} ready · anyone can start</span><details className="item-guide"><summary>How to play</summary><p>{STEER_ONLY?'Your duck swims on its own.':'Tap to paddle.'} Tilt your phone to slide across the river (hold the arrow keys on a computer); a swipe nudges you a whole lane. Shake the phone (or press E) to use a toy. Steer into a floating toy to pick it up, then tap its button (shake the phone, or press E) to use it. Ride the white rapids for a free whoosh.</p><ul>{Object.values(ITEMS).map(item=><li key={item.name}><b>{item.icon} {item.name}</b><span>{item.hint}</span></li>)}{Object.values(OBSTACLES).map(o=><li key={o.name}><b>{o.icon} {o.name}</b><span>{o.hint}</span></li>)}</ul></details></section>}
  {countdown&&<section className="countdown-overlay" aria-live="assertive"><p>{spectator?'You’ll join the next race':'Pick your lane. Little wings at the ready…'}</p><strong key={secs}>{secs}</strong><span>{STEER_ONLY?(touchDevice()?'Your duck swims by itself · tilt, swipe or tap a side to steer':'Your duck swims by itself · ← → to steer'):touchDevice()?'Tap to paddle · tilt or swipe to dodge rocks and logs':'Tap to paddle · ← → to dodge rocks and logs'}</span></section>}
  {countdown&&!spectator&&<section className="race-controls">{laneRow}</section>}
  {racing&&<><section className="race-status"><span className="status-pill">{spectator?'CHEERING SECTION':mine?.place?`${ordinal(mine.place)} · FINISHED`:drowned?'GLUB · OUT':`${ordinal(mine?.rank||1)} of ${active.length}`}</span><button className="status-pill" onClick={()=>setShowRanks(!showRanks)} aria-expanded={showRanks}>{showRanks?'Close standings':'Standings'} {showRanks?'×':'↗'}</button><span className="status-pill timer">{secs}s</span></section>
   {showRanks&&<section className="live-standings surface" aria-label="Live standings"><h2>Little league leaders</h2><ol>{standings.map(p=><li key={p.identity.toHexString()} className={p.identity.toHexString()===identity?'is-you':''}><b>{p.rank}</b><span>{p.name}{p.identity.toHexString()===identity?' (you)':''}</span><small>{p.place?'Finished':p.drowned?'Glub':`${Math.floor(p.pos/24)}%`}</small></li>)}</ol></section>}
   {race.phaseTicksLeft>390&&!showRanks&&<div className="go-flash" aria-live="polite">GO!</div>}
   {combo>=5&&!mine?.place&&<div className="combo" key={combo} aria-live="off">×{combo}<small>combo</small></div>}
   <section className="race-controls">{spectator?<div className="waiting-message surface"><h2>Your turn is coming.</h2><p>Enjoy the splashes. You’re in the next race.</p></div>:drowned?<div className="waiting-message surface"><h2>Glub. The whirlpool got you.</h2><p>Your duck is fine, just very upside down. Cheer the others home.</p></div>:mine?.place?<div className="waiting-message surface"><h2>A {ordinal(mine.place)} place splash!</h2><p>Let’s cheer the others home.</p></div>:<><div className="progress-info"><span>{Math.floor((mine?.pos??0)/24)}% of the way</span><span>{mine?.boostTicksLeft?'A little extra whoosh!':STEER_ONLY?'Ride the rapids for a whoosh':`${mine?.boostMeter??0}/20 to a boost`}</span></div>{!STEER_ONLY&&<div className="boost-track" role="progressbar" aria-label="Boost meter" aria-valuemin={0} aria-valuemax={20} aria-valuenow={mine?.boostTicksLeft?20:mine?.boostMeter??0}><div style={{width:`${mine?.boostTicksLeft?100:(mine?.boostMeter??0)*5}%`}}/></div>}{laneRow}<div className={`driving-controls${STEER_ONLY?' steer-only':''}`}>{STEER_ONLY?<div className="steer-note surface"><b>Swimming on its own</b><span>{touchDevice()?'Tilt, swipe, or tap either side of the river to steer.':'← → to steer.'}</span></div>:<button className={`tap-button ${mine?.boostTicksLeft||myItem?.turboTicks?'boosting':''}`} onPointerDown={e=>{e.preventDefault();if(e.isPrimary)tap()}} onClick={e=>{if(e.detail===0)tap()}}>TAP TO PADDLE <span aria-hidden="true">♡</span></button>}<button className={`item-button ${held?'has-item':''}`} disabled={!held||usingItem} onClick={()=>void useItem()} aria-label={held?`Use ${held.name}`:'Empty item slot'} title={held?.hint}><span aria-hidden="true">{held?.icon??'🧸'}</span><b>{usingItem?'Sending…':held?.name??'No toy yet'}</b></button></div><p className="item-hint">{myItem?.slowTicks?`Bonk! Half speed · ${(myItem.slowTicks/10).toFixed(1)}s`:myItem?.shieldTicks?`Shield ready · ${(myItem.shieldTicks/10).toFixed(1)}s`:myItem?.turboTicks?`Rocket rush! · ${(myItem.turboTicks/10).toFixed(1)}s`:held?held.hint:touchDevice()?'Steer into a floating toy to grab it. Tilt to dodge rocks and logs.':'Steer into a floating toy to grab it. ← → to dodge rocks and logs.'}</p></>}</section>
  </>}
  {finished&&race.forfeited&&<div className="results-scroll"><section className="results-card surface" aria-label="Race forfeited"><div className="eyebrow">A VERY QUIET LITTLE RIVER</div><h1>{race.forfeitReason==='drowned'?'The river wins':race.forfeitReason==='empty'?'Everyone wandered off':'Race forfeited'}</h1><div className="winner-portrait"><DuckPreview index={mine?.duckIndex??0} spinnable/></div><p className="result-message">{race.forfeitReason==='drowned'?'The whirlpool got every duck before anyone reached the line. No winner this time, just a lot of bubbles.':race.forfeitReason==='empty'?'All the racers left the river, so there is nothing to score.':'Nobody paddled for 15 seconds, so there is no winner this time. The ducks are just bobbing.'}</p><div className="results-actions">{startButton}<button className="text-button" onClick={onLeave}>Back to main menu</button><span className="panel-note">Everyone here can start the next one. ♡</span></div></section></div>}
  {finished&&!race.forfeited&&<div className="results-scroll"><section className="results-card surface" aria-label="Race results"><div className="eyebrow">{race.solo?'A VERY GOOD PRACTICE RUN':'A VERY GOOD LITTLE RACE'}</div><h1>{race.solo?(orderedResults[0]?.pos??0)>=TRACK?(orderedResults[0]?.bonks?`${orderedResults[0].bonks} ${orderedResults[0].bonks===1?'bonk':'bonks'}`:'Clean run!'):'Ran out of river':`${orderedResults[0]?.name??race.winnerName} wins!`}</h1><div className="winner-portrait"><DuckPreview index={orderedResults[0]?.duckIndex??race.winnerDuckIndex} spinnable/><span className="winner-medal">1</span></div><p className="result-message">{myResult?myResult.drowned?`The whirlpool took you at ${Math.floor(myResult.pos/24)}%. ${ordinal(myResult.place)} place, and a very good story.`:race.solo?myResult.pos>=TRACK?`${myResult.seconds.toFixed(1)} seconds down the river${myResult.bonks?` with ${myResult.bonks} ${myResult.bonks===1?'bonk':'bonks'}. Smoother next time?`:' without touching a thing. Perfect.'}`:`${Math.floor(myResult.pos/24)}% of the river before the buzzer. Keep paddling!`:`You splashed into ${ordinal(myResult.place)}. ${myResult.place===1?'Look at you go!':'Your duck is proud of you.'}`:'Your little duck is up next.'}</p>
   <ol className="results-list" aria-label="Final rankings">{orderedResults.map(p=><li key={p.id} data-place={p.place} className={p.identity.toHexString()===identity?'is-you':''}><b className="result-place">{p.place<=3?['①','②','③'][p.place-1]:p.place}</b><span className="result-name">{p.name}{p.identity.toHexString()===identity&&<small>you</small>}<em>{p.pos>=TRACK?'Crossed the line':p.drowned?`Went under at ${Math.floor(p.pos/24)}%`:`${Math.floor(p.pos/24)}% at the buzzer`}</em></span><span className="result-taps">{p.pos>=TRACK?`${p.seconds.toFixed(1)}s`:p.taps}<small>{p.pos>=TRACK?(p.bonks?`${p.bonks} ${p.bonks===1?'bonk':'bonks'}`:'clean run'):'taps'}</small></span></li>)}</ol>
   <p className="ranking-note">Finishers first. At the buzzer, remaining ducks are ranked by distance, then anyone the whirlpool took. Exact ties use a fixed order.</p><section className="legends" aria-label="Flock legends"><h2>Flock legends</h2><p>Lifetime wins · ducks in this room</p>{leaders.length?<ol>{leaders.map(p=><li key={p.identity.toHexString()}><span>{p.name}</span><b>{p.racesWon} {p.racesWon===1?'win':'wins'}</b></li>)}</ol>:<p>The first little legend is on the way.</p>}</section><div className="results-actions">{startButton}<button className="text-button" onClick={onLeave}>Back to main menu</button><span className="panel-note">No automatic rematch. Take your time. ♡</span></div>
  </section></div>}
  {error&&<div className="connection-warning" role="alert"><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={()=>setError('')}>×</button></div>}
 </main>;
}
