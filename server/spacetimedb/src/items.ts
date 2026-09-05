export const PICKUPS = [180, 650, 1120, 1590, 2060];
export const ITEM_KINDS = ['bomb', 'bubble', 'turbo', 'shield'] as const;
export type ItemState = { slowTicks: number; shieldTicks: number; turboTicks: number };

export function travelSpeed(velocity: number, state?: ItemState): number {
  return velocity * (state?.slowTicks ? .5 : 1) * (state?.turboTicks ? 1.55 : 1);
}

export function hitState(state: ItemState, kind: string): ItemState {
  if (state.shieldTicks > 0) return { ...state, shieldTicks: 0 };
  // Repeated hits refresh a short slowdown; they never stack into a standstill.
  return { ...state, slowTicks: Math.max(state.slowTicks, kind === 'bomb' ? 25 : 18) };
}

export function itemAt(lane: number, raceNumber: number, pickup: number): string {
  // Each duck cycles through all four toys, with a different starting toy per race.
  return ITEM_KINDS[(lane + raceNumber + pickup) % ITEM_KINDS.length];
}
