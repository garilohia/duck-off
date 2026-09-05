// Ten characters on the client picker; twelve lanes fit the 32-unit river without ducks overlapping,
// and random matching already treats a room with twelve ducks as full.
export const DUCK_COUNT = 10;
export const MAX_DUCKS = 12;
export const LANES = 5;
// Steer-only mode (the `steer-only` branch flips this): ducks swim on their own at CRUISE_SPEED,
// taps do nothing, and the game is steering into rapids and buoys and away from rocks, logs and the whirlpool.
export const AUTO_CRUISE = false;
export const CRUISE_SPEED = 125;
export const TRACK = 2400;
export const ITEM_KINDS = ['bomb', 'bubble', 'turbo', 'shield'] as const;
export type ItemState = { slowTicks: number; shieldTicks: number; turboTicks: number };
export type Feature = { kind: string; lane: number; pos: number; seq: number; item: string };

export function travelSpeed(velocity: number, state?: ItemState): number {
  return velocity * (state?.slowTicks ? .5 : 1) * (state?.turboTicks ? 1.55 : 1);
}

// How long each kind of knock slows a duck (ticks) and how much of its speed survives the hit.
export const IMPACT: Record<string, { slow: number; keep: number }> = {
  bomb: { slow: 25, keep: 1 },
  bubble: { slow: 18, keep: 1 },
  trap: { slow: 18, keep: 1 },
  rock: { slow: 15, keep: .35 },
  log: { slow: 10, keep: .6 },
  tackle: { slow: 12, keep: .6 },
};
export function hitState(state: ItemState, kind: string): ItemState {
  if (state.shieldTicks > 0) return { ...state, shieldTicks: 0 };
  // Repeated hits refresh a short slowdown; they never stack into a standstill.
  return { ...state, slowTicks: Math.max(state.slowTicks, IMPACT[kind]?.slow ?? 15) };
}

// Which toy floats at buoy `slot` of segment `seq`: the two buoys in a segment always differ, and two
// consecutive buoy segments together offer all four toys. The seed rotates the pairing every race.
export function buoyItem(seed: number, seq: number, slot: number, solo = false): string {
  const kind = ITEM_KINDS[(Math.abs(seed) + seq + slot) % ITEM_KINDS.length];
  // Nobody to throw at on a solo run, so offensive toys float as speed and safety instead.
  return solo ? (kind === 'bomb' ? 'turbo' : kind === 'bubble' ? 'shield' : kind) : kind;
}
// A shield lasts until something hits it, or this long.
export const SHIELD_TICKS = 150;
// A bubble with nobody ahead is left floating behind as a trap for the next duck in that lane.
export const TRAP_DROP_BACK = 12;

// Slipstream: sitting close behind a duck in your lane is a little faster.
export const DRAFT_RANGE = 35;
export const DRAFT_BONUS = 1.12;
// Barging into a lane knocks rivals within this distance along the river...
export const TACKLE_RANGE = 45;
// ...and this close across it. Lanes are continuous (0..LANES-1); anything within half a lane overlaps.
export const OVERLAP = .55;
// How far across the river a duck moves per tick at full steering.
export const STEER_RATE = .32;

// The river layout for one race, ten segments long. Even segments hold a pair of "?" buoys in two
// lanes only; odd segments alternate obstacles (never more than two of the five lanes) with bands of
// rapids across two lanes that push a duck along. The seed is drawn fresh for every race, so the
// whirlpool never sits in a predictable lane. A solo run packs an obstacle into every segment too.
export function trackLayout(seed: number, solo = false): Feature[] {
  const features: Feature[] = [];
  const step = (n: number) => Math.abs(Math.floor(seed / 7 ** n)) % LANES;
  for (let k = 0; k < 10; k++) {
    const pos = 220 + k * 200;
    if (k % 2 === 0) {
      const first = step(k);
      features.push({ kind: 'buoy', lane: first, pos, seq: k, item: buoyItem(seed, k, 0, solo) }, { kind: 'buoy', lane: (first + 2) % LANES, pos, seq: k, item: buoyItem(seed, k, 1, solo) });
      if (solo) features.push({ kind: k % 4 ? 'rock' : 'log', lane: (first + 1) % LANES, pos, seq: k, item: '' });
    } else if (k === 3 || k === 7) {
      const first = step(k) % (LANES - 1);
      for (let lane = first; lane < first + 2; lane++) features.push({ kind: 'rapids', lane, pos, seq: k, item: '' });
      if (solo) features.push({ kind: 'rock', lane: (first + 3) % LANES, pos, seq: k, item: '' });
    } else {
      // Rocks bonk hard, logs bonk softly, and the one whirlpool per race pulls a duck under.
      const kind = step(k + 1) % 2 ? 'rock' : 'log';
      const first = step(k);
      features.push({ kind, lane: first, pos, seq: k, item: '' });
      if (k === 5) features.push({ kind: 'whirlpool', lane: (first + 3) % LANES, pos, seq: k, item: '' });
      else if (k > 1 || solo) features.push({ kind: kind === 'rock' ? 'log' : 'rock', lane: (first + 3) % LANES, pos, seq: k, item: '' });
      if (solo && k > 1) features.push({ kind: 'log', lane: (first + 1) % LANES, pos, seq: k, item: '' });
    }
  }
  return features;
}
// How long a silent client stays "online" before the room stops waiting for it (microseconds).
export const STALE_AFTER_MICROS = 12_000_000n;
