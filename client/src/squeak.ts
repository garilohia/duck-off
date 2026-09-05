let context:AudioContext|undefined;
const MUTE_KEY='duckoff_muted';
const read=()=>{try{return localStorage.getItem(MUTE_KEY)==='1'}catch{return false}};
// Mute is a saved preference: it survives screen changes and reloads.
let muted=read();
export function isMuted(){return muted;}
export function setMuted(value:boolean){muted=value;try{localStorage.setItem(MUTE_KEY,value?'1':'0')}catch{}}
export function unlockAudio(){context??=new AudioContext();if(context.state==='suspended')void context.resume();}
const ready=()=>context&&context.state==='running'&&!muted?context:undefined;
// Phone haptics (Android Chrome and friends; iOS Safari ignores it). Independent of the mute switch.
export function buzz(pattern:number|number[]){try{navigator.vibrate?.(pattern)}catch{}}
/** A short rubber-duck squeak. `pitch` scales the whole chirp, so a filling boost meter can climb. */
export function squeak(index:number,volume=.32,pan=0,pitch=1,at=0){const c=ready();if(!c)return;const now=c.currentTime+at,base=620*1.05**index*pitch;const osc=c.createOscillator(),gain=c.createGain(),panner=c.createStereoPanner();osc.type='triangle';osc.frequency.setValueAtTime(base*.75,now);osc.frequency.exponentialRampToValueAtTime(base*1.6,now+.035);osc.frequency.exponentialRampToValueAtTime(base*.65,now+.12);gain.gain.setValueAtTime(.001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.012);gain.gain.exponentialRampToValueAtTime(.001,now+.125);panner.pan.value=Math.max(-1,Math.min(1,pan));osc.connect(gain);gain.connect(panner);panner.connect(c.destination);osc.start(now);osc.stop(now+.13);const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*.12),c.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.3;const noise=c.createBufferSource(),filter=c.createBiquadFilter();noise.buffer=buffer;filter.type='bandpass';filter.frequency.value=base*2;filter.Q.value=3;noise.connect(filter);filter.connect(gain);noise.start(now);noise.stop(now+.12);osc.onended=()=>{osc.disconnect();noise.disconnect();filter.disconnect();gain.disconnect();panner.disconnect()};}
/** The big honk when a boost kicks in. */
export function honk(index:number){const c=ready();if(!c)return;const now=c.currentTime,base=620*1.05**index*.42;const osc=c.createOscillator(),vib=c.createOscillator(),vibGain=c.createGain(),gain=c.createGain();osc.type='sawtooth';osc.frequency.setValueAtTime(base*.8,now);osc.frequency.exponentialRampToValueAtTime(base*1.15,now+.08);osc.frequency.exponentialRampToValueAtTime(base,now+.4);vib.frequency.value=9;vibGain.gain.value=base*.06;vib.connect(vibGain);vibGain.connect(osc.frequency);gain.gain.setValueAtTime(.001,now);gain.gain.exponentialRampToValueAtTime(.28,now+.03);gain.gain.setValueAtTime(.28,now+.28);gain.gain.exponentialRampToValueAtTime(.001,now+.45);osc.connect(gain);gain.connect(c.destination);osc.start(now);vib.start(now);osc.stop(now+.46);vib.stop(now+.46);osc.onended=()=>{osc.disconnect();vib.disconnect();vibGain.disconnect();gain.disconnect()};}
/** A soft thud for bumping a rock, a log or a splash bomb. */
export function bonk(){const c=ready();if(!c)return;const now=c.currentTime;const osc=c.createOscillator(),gain=c.createGain();osc.type='sine';osc.frequency.setValueAtTime(150,now);osc.frequency.exponentialRampToValueAtTime(55,now+.18);gain.gain.setValueAtTime(.35,now);gain.gain.exponentialRampToValueAtTime(.001,now+.2);osc.connect(gain);gain.connect(c.destination);osc.start(now);osc.stop(now+.21);osc.onended=()=>{osc.disconnect();gain.disconnect()};}
/** Three rising squeaks for crossing the line. */
export function fanfare(index:number){[0,.13,.26].forEach((at,i)=>squeak(index,.3,0,1+i*.25,at));squeak(index,.34,0,1.9,.46);}
/** Bank ducks cheering as you pass, panned to their side of the river. */
export function cheer(pan:number){squeak(4,.07,pan,1.6);squeak(7,.06,pan,1.9,.07);}
