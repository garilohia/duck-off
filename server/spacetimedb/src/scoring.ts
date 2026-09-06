import { TRACK } from './items';
import type { Ctx, Race, Racer } from './schema';

// Stable identity order resolves exact distance / crossing-time ties on every client.
export function tie(a: Racer, b: Racer) {
  const x = a.identity.toHexString();
  const y = b.identity.toHexString();
  return x < y ? -1 : x > y ? 1 : 0;
}

// Finishers first, then ducks still swimming by distance, then anyone the whirlpool took (also by distance).
export function standing(a: Racer, b: Racer) {
  if (a.place && b.place) return a.place - b.place;
  if (a.place) return -1;
  if (b.place) return 1;
  if (a.drowned !== b.drowned) return a.drowned ? 1 : -1;
  return b.pos - a.pos || tie(a, b);
}

// Give a duck its place. Finish time is the race's own elapsed clock (plus the fraction of this tick it
// needed to reach the line), so the five-second wrap-up after the winner never distorts later times.
export function award(ctx: Ctx, r: Race, p: Racer, speed = 0) {
  p.place = ++r.finishCounter;
  const fraction = speed > 0 && p.pos < TRACK ? Math.min(1, (TRACK - p.pos) / (speed * 0.1)) : 0;
  p.seconds = Math.round((r.elapsedTicks + fraction) * 10) / 100;
  if (p.place === 1) {
    r.winnerName = p.name;
    r.winnerDuckIndex = p.duckIndex;
    const user = ctx.db.player.identity.find(p.identity);
    if (user && !p.drowned) ctx.db.player.identity.update({ ...user, racesWon: user.racesWon + 1 });
  }
}

// Record the podium for a finished race.
export function recordResults(ctx: Ctx, room: string, r: Race, racers: Racer[]) {
  for (const p of racers) {
    ctx.db.raceResult.insert({
      id: `${room}:${r.raceNumber}:${p.identity.toHexString()}`,
      room,
      raceNumber: r.raceNumber,
      identity: p.identity,
      name: p.name,
      duckIndex: p.duckIndex,
      place: p.place,
      taps: p.taps,
      pos: p.pos,
      drowned: p.drowned,
      bonks: p.bonks,
      seconds: p.seconds,
    });
  }
}
