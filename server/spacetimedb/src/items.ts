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
export type Feature = { kind: string; lane: number; pos: number; seq: number };

export function travelSpeed(velocity: number, state?: ItemState): number {
  return velocity * (state?.slowTicks ? .5 : 1) * (state?.turboTicks ? 1.55 : 1);
}

// How long each kind of knock slows a duck (ticks) and how much of its speed survives the hit.
export const IMPACT: Record<string, { slow: number; keep: number }> = {
  bomb: { slow: 25, keep: 1 },
  bubble: { slow: 18, keep: 1 },
  rock: { slow: 15, keep: .35 },
  log: { slow: 10, keep: .6 },
  tackle: { slow: 12, keep: .6 },
};
export function hitState(state: ItemState, kind: string): ItemState {
  if (state.shieldTicks > 0) return { ...state, shieldTicks: 0 };
  // Repeated hits refresh a short slowdown; they never stack into a standstill.
  return { ...state, slowTicks: Math.max(state.slowTicks, IMPACT[kind]?.slow ?? 15) };
}

export function itemAt(lane: number, raceNumber: number, pickup: number): string {
  // Each duck cycles through all four toys, with a different starting toy per race.
  return ITEM_KINDS[(lane + raceNumber + pickup) % ITEM_KINDS.length];
}

// Kart-style catch-up: the leader never draws a rocket, the tail never draws a shield.
export function weightedItem(kind: string, rank: number, field: number): string {
  if (field < 4) return kind;
  if (rank === 1 && kind === 'turbo') return 'shield';
  if (rank >= field - 1 && kind === 'shield') return 'turbo';
  return kind;
}

// Slipstream: sitting close behind a duck in your lane is a little faster.
export const DRAFT_RANGE = 35;
export const DRAFT_BONUS = 1.12;
// Barging into a lane knocks rivals within this distance.
export const TACKLE_RANGE = 45;

// The river layout for one race, ten segments long. Even segments hold a pair of "?" buoys in two
// lanes only; odd segments alternate obstacles (never more than two of the five lanes) with bands of
// rapids across three lanes that push a duck along. The seed shifts the lanes from race to race.
export function trackLayout(seed: number): Feature[] {
  const features: Feature[] = [];
  for (let k = 0; k < 10; k++) {
    const pos = 220 + k * 200;
    if (k % 2 === 0) {
      const first = (seed + k * 3) % LANES;
      features.push({ kind: 'buoy', lane: first, pos, seq: k }, { kind: 'buoy', lane: (first + 2) % LANES, pos, seq: k });
    } else if (k === 3 || k === 7) {
      const first = (seed + k) % (LANES - 2);
      for (let lane = first; lane < first + 3; lane++) features.push({ kind: 'rapids', lane, pos, seq: k });
    } else {
      // Rocks bonk hard, logs bonk softly, and the one whirlpool per race pulls a duck under.
      const kind = (seed + k) % 4 < 2 ? 'rock' : 'log';
      const first = (seed * 2 + k * 2) % LANES;
      features.push({ kind, lane: first, pos, seq: k });
      if (k === 5) features.push({ kind: 'whirlpool', lane: (first + 3) % LANES, pos, seq: k });
      else if (k > 1) features.push({ kind: kind === 'rock' ? 'log' : 'rock', lane: (first + 3) % LANES, pos, seq: k });
    }
  }
  return features;
}
