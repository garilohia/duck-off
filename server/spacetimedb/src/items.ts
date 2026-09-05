// Ten characters on the client picker; twelve lanes fit the 32-unit river without ducks overlapping,
// and random matching already treats a room with twelve ducks as full.
export const DUCK_COUNT = 10;
export const MAX_DUCKS = 12;
export const LANES = 5;
export const TRACK = 2400;
export const ITEM_KINDS = ['bomb', 'bubble', 'turbo', 'shield'] as const;
export type ItemState = { slowTicks: number; shieldTicks: number; turboTicks: number };
export type Feature = { kind: string; lane: number; pos: number; seq: number };

export function travelSpeed(velocity: number, state?: ItemState): number {
  return velocity * (state?.slowTicks ? .5 : 1) * (state?.turboTicks ? 1.55 : 1);
}

export function hitState(state: ItemState, kind: string): ItemState {
  if (state.shieldTicks > 0) return { ...state, shieldTicks: 0 };
  // Repeated hits refresh a short slowdown; they never stack into a standstill.
  return { ...state, slowTicks: Math.max(state.slowTicks, kind === 'bomb' ? 25 : kind === 'bubble' ? 18 : 15) };
}

export function itemAt(lane: number, raceNumber: number, pickup: number): string {
  // Each duck cycles through all four toys, with a different starting toy per race.
  return ITEM_KINDS[(lane + raceNumber + pickup) % ITEM_KINDS.length];
}

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
      const kind = (seed + k) % 4 < 2 ? 'rock' : 'log';
      const first = (seed * 2 + k * 2) % LANES;
      features.push({ kind, lane: first, pos, seq: k });
      if (k > 1) features.push({ kind, lane: (first + 3) % LANES, pos, seq: k });
    }
  }
  return features;
}
