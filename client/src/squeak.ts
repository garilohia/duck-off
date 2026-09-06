let context: AudioContext | undefined;
import { PREF, readFlag, writeFlag } from './storage';
const read = () => readFlag(PREF.muted);
// Mute is a saved preference: it survives screen changes and reloads.
let muted = read();
export function isMuted() {
  return muted;
}
export function setMuted(value: boolean) {
  muted = value;
  writeFlag(PREF.muted, value);
}
export function unlockAudio() {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
}
const ready = () => (context && context.state === 'running' && !muted ? context : undefined);
// Phone haptics (Android Chrome and friends; iOS Safari ignores it). Independent of the mute switch.
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
/** A short rubber-duck squeak. `pitch` scales the whole chirp, so a filling boost meter can climb. */
export function squeak(index: number, volume = 0.32, pan = 0, pitch = 1, at = 0) {
  const c = ready();
  if (!c) return;
  const now = c.currentTime + at,
    base = 620 * 1.05 ** index * pitch;
  const osc = c.createOscillator(),
    gain = c.createGain(),
    panner = c.createStereoPanner();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(base * 0.75, now);
  osc.frequency.exponentialRampToValueAtTime(base * 1.6, now + 0.035);
  osc.frequency.exponentialRampToValueAtTime(base * 0.65, now + 0.12);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.125);
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  osc.connect(gain);
  gain.connect(panner);
  panner.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.13);
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * 0.12), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  const noise = c.createBufferSource(),
    filter = c.createBiquadFilter();
  noise.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = base * 2;
  filter.Q.value = 3;
  noise.connect(filter);
  filter.connect(gain);
  noise.start(now);
  noise.stop(now + 0.12);
  osc.onended = () => {
    osc.disconnect();
    noise.disconnect();
    filter.disconnect();
    gain.disconnect();
    panner.disconnect();
  };
}
/** The big honk when a boost kicks in. */
export function honk(index: number) {
  const c = ready();
  if (!c) return;
  const now = c.currentTime,
    base = 620 * 1.05 ** index * 0.42;
  const osc = c.createOscillator(),
    vib = c.createOscillator(),
    vibGain = c.createGain(),
    gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(base * 0.8, now);
  osc.frequency.exponentialRampToValueAtTime(base * 1.15, now + 0.08);
  osc.frequency.exponentialRampToValueAtTime(base, now + 0.4);
  vib.frequency.value = 9;
  vibGain.gain.value = base * 0.06;
  vib.connect(vibGain);
  vibGain.connect(osc.frequency);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.28, now + 0.03);
  gain.gain.setValueAtTime(0.28, now + 0.28);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  vib.start(now);
  osc.stop(now + 0.46);
  vib.stop(now + 0.46);
  osc.onended = () => {
    osc.disconnect();
    vib.disconnect();
    vibGain.disconnect();
    gain.disconnect();
  };
}
/** A soft thud for bumping a rock, a log or a splash bomb. */
export function bonk() {
  const c = ready();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator(),
    gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.21);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}
/** Three rising squeaks for crossing the line. */
export function fanfare(index: number) {
  [0, 0.13, 0.26].forEach((at, i) => squeak(index, 0.3, 0, 1 + i * 0.25, at));
  squeak(index, 0.34, 0, 1.9, 0.46);
}
/** Bank ducks cheering as you pass, panned to their side of the river. */
export function cheer(pan: number) {
  squeak(4, 0.07, pan, 1.6);
  squeak(7, 0.06, pan, 1.9, 0.07);
}

/** A noisy "hooray": a swelling crowd of little voices. Uses /sounds/cheer.mp3 when the site ships one, else it is synthesised. */
let cheerClip: HTMLAudioElement | null | undefined;
export function crowdCheer() {
  if (muted) return;
  if (cheerClip === undefined) {
    cheerClip = null;
    try {
      const a = new Audio('/sounds/cheer.mp3');
      a.preload = 'auto';
      a.addEventListener(
        'canplaythrough',
        () => {
          cheerClip = a;
        },
        { once: true },
      );
      a.load();
    } catch {}
  }
  if (cheerClip) {
    cheerClip.currentTime = 0;
    cheerClip.volume = 0.7;
    void cheerClip.play().catch(() => {});
    return;
  }
  const c = ready();
  if (!c) return;
  const now = c.currentTime;
  const master = c.createGain();
  master.gain.setValueAtTime(0.001, now);
  master.gain.exponentialRampToValueAtTime(0.5, now + 0.25);
  master.gain.setValueAtTime(0.5, now + 1.4);
  master.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
  master.connect(c.destination);
  // Breathy crowd bed.
  const seconds = 2.7,
    buffer = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate),
    data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource(),
    band = c.createBiquadFilter();
  noise.buffer = buffer;
  band.type = 'bandpass';
  band.frequency.setValueAtTime(900, now);
  band.frequency.linearRampToValueAtTime(1600, now + 1.2);
  band.Q.value = 0.7;
  const bed = c.createGain();
  bed.gain.value = 0.22;
  noise.connect(band);
  band.connect(bed);
  bed.connect(master);
  noise.start(now);
  noise.stop(now + seconds);
  // A dozen little "yaaay" voices, each sliding up then down with its own vowel.
  const cleanup: AudioNode[] = [noise, band, bed];
  for (let v = 0; v < 12; v++) {
    const start = now + Math.random() * 0.5,
      len = 0.7 + Math.random() * 0.9,
      base = 520 + Math.random() * 420;
    const osc = c.createOscillator(),
      formant = c.createBiquadFilter(),
      g = c.createGain(),
      pan = c.createStereoPanner();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * 0.8, start);
    osc.frequency.exponentialRampToValueAtTime(base * 1.25, start + len * 0.35);
    osc.frequency.exponentialRampToValueAtTime(base * 0.9, start + len);
    formant.type = 'bandpass';
    formant.frequency.value = 700 + Math.random() * 900;
    formant.Q.value = 2.5;
    g.gain.setValueAtTime(0.001, start);
    g.gain.exponentialRampToValueAtTime(0.09, start + 0.08);
    g.gain.setValueAtTime(0.09, start + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, start + len);
    pan.pan.value = Math.random() * 1.6 - 0.8;
    osc.connect(formant);
    formant.connect(g);
    g.connect(pan);
    pan.connect(master);
    osc.start(start);
    osc.stop(start + len + 0.05);
    cleanup.push(osc, formant, g, pan);
  }
  setTimeout(
    () => {
      cleanup.forEach((n) => n.disconnect());
      master.disconnect();
    },
    (seconds + 0.5) * 1000,
  );
}
/** Glub glub: the whirlpool got you. */
export function glub(index: number) {
  const c = ready();
  if (!c) return;
  const now = c.currentTime,
    base = 620 * 1.05 ** index;
  const osc = c.createOscillator(),
    gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(base, now);
  osc.frequency.exponentialRampToValueAtTime(base * 0.28, now + 0.7);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.76);
  for (let i = 0; i < 5; i++) {
    const at = now + 0.15 + i * 0.13,
      b = c.createOscillator(),
      g = c.createGain();
    b.type = 'sine';
    b.frequency.setValueAtTime(300 + i * 90, at);
    b.frequency.exponentialRampToValueAtTime(900 + i * 120, at + 0.07);
    g.gain.setValueAtTime(0.001, at);
    g.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.09);
    b.connect(g);
    g.connect(c.destination);
    b.start(at);
    b.stop(at + 0.1);
    b.onended = () => {
      b.disconnect();
      g.disconnect();
    };
  }
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

/** A bright two-note chime for grabbing a toy. */
export function chime() {
  const c = ready();
  if (!c) return;
  const now = c.currentTime;
  [
    [880, 0],
    [1320, 0.09],
  ].forEach(([f, at]) => {
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.001, now + at);
    g.gain.exponentialRampToValueAtTime(0.25, now + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + at + 0.22);
    o.connect(g);
    g.connect(c.destination);
    o.start(now + at);
    o.stop(now + at + 0.24);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  });
}
