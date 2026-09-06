import { useCallback, useEffect, useRef, useState } from 'react';
import { buzz, squeak, unlockAudio } from '../squeak';
import { LANES, STEER_ONLY } from '../items';
import type { RacePlayer } from '../module_bindings/types';

// Everything that turns a finger, a thumb, a key or a phone tilt into a reducer call.

const COMBO_WINDOW = 520;
const TILT_DEADZONE = 7;
const TILT_FULL = 38;
const SHAKE_G = 19;

export const touchDevice = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// iOS shares motion data only after a permission prompt that must come from a real click or touch end,
// never from pointerdown. Tilt is always on; if the prompt is refused we simply keep asking on later taps.
type MotionCtor = { requestPermission?: () => Promise<string> };
type MotionWindow = { DeviceOrientationEvent?: MotionCtor; DeviceMotionEvent?: MotionCtor };
const motionWindow = () => window as unknown as MotionWindow;
export const needsMotionPrompt = () => typeof motionWindow().DeviceOrientationEvent?.requestPermission === 'function';

// Orientation drives steering, motion drives shake-to-use; iOS prompts for both.
async function requestMotion(): Promise<boolean> {
  const w = motionWindow();
  if (!w.DeviceOrientationEvent) return false;
  if (typeof w.DeviceOrientationEvent.requestPermission !== 'function') return true;
  try {
    const ok = (await w.DeviceOrientationEvent.requestPermission()) === 'granted';
    if (typeof w.DeviceMotionEvent?.requestPermission === 'function')
      await w.DeviceMotionEvent.requestPermission().catch(() => {});
    return ok;
  } catch {
    return false;
  }
}

type Options = {
  mine?: RacePlayer;
  racing: boolean;
  canDrive: boolean;
  spectator: boolean;
  onTap: (count: number) => Promise<void>;
  onSteer: (amount: number) => Promise<void>;
  onSwitchLane: (direction: number) => Promise<void>;
  useItem: () => Promise<void>;
  onError: (message: string) => void;
};

export function useRaceInput({ mine, racing, canDrive, spectator, onTap, onSteer, onSwitchLane, useItem, onError }: Options) {
  const [combo, setCombo] = useState(0);
  const [motionGranted, setMotionGranted] = useState(() => !needsMotionPrompt());
  const queued = useRef(0);
  const inFlight = useRef(false);
  const comboRef = useRef({ count: 0, at: 0 });
  const steering = useRef({ sent: 0, at: 0 });
  const lanePending = useRef(false);
  const shakeAt = useRef(0);
  // Latest props for callbacks that must stay referentially stable (so listeners never re-register mid-push).
  const latest = useRef({ onSteer, onTap, canDrive, mine, useItem, onError });
  latest.current = { onSteer, onTap, canDrive, mine, useItem, onError };

  const armMotion = useCallback(async () => {
    if (motionGranted) return;
    if (await requestMotion()) setMotionGranted(true);
  }, [motionGranted]);

  // Taps are counted locally and sent in batches, one call in flight at a time, so a slow connection
  // never drops a tap: whatever piled up goes out with the next call.
  const flushTaps = useCallback(() => {
    if (inFlight.current || !queued.current) return;
    const count = Math.min(12, queued.current);
    queued.current -= count;
    inFlight.current = true;
    void latest.current
      .onTap(count)
      .catch(() => latest.current.onError('Connection hiccup. Keep tapping, your duck is still here.'))
      .finally(() => {
        inFlight.current = false;
        if (queued.current) flushTaps();
      });
  }, []);

  const tap = useCallback(() => {
    const duck = latest.current.mine;
    if (STEER_ONLY || !racing || spectator || duck?.place || duck?.drowned) return;
    const now = performance.now();
    unlockAudio();
    // The squeak climbs with the boost meter; consistent tapping builds a combo.
    const meter = duck?.boostTicksLeft ? 20 : (duck?.boostMeter ?? 0);
    squeak(duck?.duckIndex ?? 0, 0.13, 0, 1 + (meter / 20) * 0.55);
    buzz(8);
    const c = comboRef.current;
    c.count = now - c.at < COMBO_WINDOW ? c.count + 1 : 1;
    c.at = now;
    setCombo(c.count);
    queued.current++;
    flushTaps();
  }, [racing, spectator, flushTaps]);

  // Fluid steering: how hard we push sideways (-1..1), at most 10 times a second and only when it changes.
  const pushSteer = useCallback((amount: number, force = false) => {
    if (!latest.current.canDrive) return;
    const now = performance.now();
    const s = steering.current;
    const next = Math.abs(amount) < 0.02 ? 0 : Math.max(-1, Math.min(1, amount));
    if (!force && (Math.abs(next - s.sent) < 0.06 || (now - s.at < 100 && next !== 0))) return;
    s.sent = next;
    s.at = now;
    void latest.current.onSteer(next).catch(() => {});
  }, []);

  // A whole-lane hop: swipes, side taps in steer-only mode, and tool calls.
  const switchLane = useCallback(
    (direction: number) => {
      const duck = latest.current.mine;
      if (!latest.current.canDrive || lanePending.current) return;
      const lane = (duck?.lane ?? 2) + direction;
      if (lane < 0 || lane >= LANES) return;
      lanePending.current = true;
      unlockAudio();
      squeak(duck?.duckIndex ?? 0, 0.09, direction * 0.5, 1.3);
      buzz(6);
      void onSwitchLane(direction)
        .catch(() => {})
        .finally(() => {
          lanePending.current = false;
        });
    },
    [onSwitchLane],
  );

  // Combo fades when the tapping stops.
  useEffect(() => {
    if (!combo) return;
    const timer = setTimeout(() => {
      comboRef.current.count = 0;
      setCombo(0);
    }, COMBO_WINDOW * 1.6);
    return () => clearTimeout(timer);
  }, [combo]);

  // Keyboard: space/enter paddle, held arrows steer, E fires the toy.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (e.repeat || el?.closest('input,textarea,summary')) return;
      if (e.code === 'KeyE') {
        e.preventDefault();
        void latest.current.useItem();
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        pushSteer(-1, true);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        pushSteer(1, true);
      } else if ((e.code === 'Space' || e.code === 'Enter') && !el?.closest('button')) {
        e.preventDefault();
        tap();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) pushSteer(0, true);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [tap, pushSteer]);

  // Swipe left or right anywhere on the race screen to hop a lane.
  useEffect(() => {
    let start: { x: number; y: number; id: number } | undefined;
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || (e.target instanceof Element && e.target.closest('input,.results-scroll,.live-standings,details')))
        return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = undefined;
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.2) switchLane(Math.sign(dx));
    };
    const cancel = () => {
      start = undefined;
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [switchLane]);

  // Ask for motion access from real gestures (click / touchend) until it is granted.
  useEffect(() => {
    if (motionGranted) return;
    const ask = () => void armMotion();
    window.addEventListener('click', ask);
    window.addEventListener('touchend', ask);
    return () => {
      window.removeEventListener('click', ask);
      window.removeEventListener('touchend', ask);
    };
  }, [motionGranted, armMotion]);

  // Tilt to steer, portrait only: a small dead zone, then the harder you tilt the faster the duck slides across.
  useEffect(() => {
    if (!canDrive) return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || window.innerWidth > window.innerHeight) return;
      const g = e.gamma;
      const amount =
        Math.abs(g) < TILT_DEADZONE ? 0 : Math.sign(g) * Math.min(1, (Math.abs(g) - TILT_DEADZONE) / (TILT_FULL - TILT_DEADZONE));
      pushSteer(amount);
    };
    window.addEventListener('deviceorientation', onTilt);
    return () => {
      window.removeEventListener('deviceorientation', onTilt);
      pushSteer(0, true);
    };
  }, [canDrive, pushSteer]);

  // Shake the phone to use the toy you are holding, so your thumbs never leave the paddle.
  useEffect(() => {
    if (!racing || spectator) return;
    const onShake = (e: DeviceMotionEvent) => {
      const a = e.acceleration;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const now = performance.now();
      if (Math.hypot(a.x, a.y, a.z) > SHAKE_G && now - shakeAt.current > 900) {
        shakeAt.current = now;
        void latest.current.useItem();
      }
    };
    window.addEventListener('devicemotion', onShake);
    return () => window.removeEventListener('devicemotion', onShake);
  }, [racing, spectator]);

  return { tap, switchLane, combo, motionGranted, armMotion };
}
