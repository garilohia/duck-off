import { SenderError, t } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';
import {
  AUTO_CRUISE,
  CRUISE_SPEED,
  DRAFT_BONUS,
  DRAFT_RANGE,
  IDLE_FORFEIT_TICKS,
  IMPACT,
  LANES,
  OVERLAP,
  RACE_TICKS,
  SHIELD_TICKS,
  STEER_RATE,
  TACKLE_RANGE,
  TRACK,
  TRAP_DROP_BACK,
  TURBO_TICKS,
  hitState,
  travelSpeed,
} from './items';
import stdb, { emptyRace, isLive, laneRow, raceTick, type Ctx, type FeatureRow, type Race, type Racer } from './schema';
import { refreshHost, sweepStale } from './presence';
import { award, recordResults, standing, tie } from './scoring';

export const init = stdb.init((ctx) => {
  ctx.db.stats.insert({ id: 0, visitors: 0, players: 0, races: 0, soloRuns: 0 });
  ctx.db.race.insert(emptyRace('PUBLIC'));
  ctx.db.raceTick.insert({ scheduledId: 0n, scheduledAt: ScheduleAt.interval(100_000n) });
});

type ItemState = { held: string; slowTicks: number; shieldTicks: number; turboTicks: number };

// Moving sideways into rivals shoves them: anyone you now overlap that you did not overlap before the move
// wobbles for a moment (a shield takes the shove), and you lose a little pace for the barge.
function tackle(ctx: Ctx, p: Racer, fromLane: number): number {
  let vel = p.vel;
  for (const rival of ctx.db.racePlayer.room.filter(p.room)) {
    if (!rival.active || rival.place || rival.drowned || rival.identity.isEqual(p.identity)) continue;
    if (Math.abs(rival.pos - p.pos) > TACKLE_RANGE) continue;
    if (Math.abs(rival.lane - fromLane) < OVERLAP || Math.abs(rival.lane - p.lane) >= OVERLAP) continue;
    const state = ctx.db.raceItem.identity.find(rival.identity);
    if (!state) continue;
    const shielded = state.shieldTicks > 0;
    ctx.db.raceItem.identity.update({ ...state, ...hitState(state, 'tackle') });
    ctx.db.racePlayer.identity.update({ ...rival, vel: shielded ? rival.vel : rival.vel * IMPACT.tackle.keep });
    vel *= 0.85;
  }
  return vel;
}

// The caller's racer and race, if the caller can currently drive.
function drivable(ctx: Ctx) {
  const p = ctx.db.racePlayer.identity.find(ctx.sender);
  if (!p) return undefined;
  const r = ctx.db.race.id.find(p.room);
  if (!p.active || p.place || p.drowned || !r || !isLive(r.status)) return undefined;
  return { p, r };
}

function wake(ctx: Ctx, r: Race) {
  if (r.idleTicks) ctx.db.race.id.update({ ...r, idleTicks: 0 });
}

// Hop one whole lane left (-1) or right (+1): a swipe, a side tap, or a tool call. Allowed from the countdown.
export const switchLane = stdb.reducer({ direction: t.i8() }, (ctx, { direction }) => {
  const d = drivable(ctx);
  if (!d) return;
  const { p, r } = d;
  const next = Math.max(0, Math.min(LANES - 1, Math.round(p.lane) + Math.sign(direction)));
  if (next === p.lane) return;
  const moved = { ...p, lane: next };
  const vel = r.status === 'racing' ? tackle(ctx, moved, p.lane) : p.vel;
  ctx.db.racePlayer.identity.update({ ...moved, vel, steer: 0 });
  wake(ctx, r);
});

// Fluid steering: a tilt or a held key sets how hard the duck is pushing sideways (-1..1); the tick moves it.
export const steer = stdb.reducer({ amount: t.f64() }, (ctx, { amount }) => {
  const d = drivable(ctx);
  if (!d) return;
  const { p, r } = d;
  const next = Number.isFinite(amount) ? Math.max(-1, Math.min(1, amount)) : 0;
  if (next !== p.steer) ctx.db.racePlayer.identity.update({ ...p, steer: next });
  if (next) wake(ctx, r);
});

// Paddle. Clients batch their taps (count) so a slow connection never drops any; the river still
// accepts at most one tap per 25ms of real time, so a batch cannot be faster than a human.
export const tap = stdb.reducer({ count: t.u8() }, (ctx, { count }) => {
  if (AUTO_CRUISE) return; // Ducks swim by themselves in steer-only mode.
  const d = drivable(ctx);
  if (!d || d.r.status !== 'racing') return;
  const { p, r } = d;
  const now = ctx.timestamp.microsSinceUnixEpoch;
  const byTime = Math.floor(Number(now - p.lastTapAt) / 25_000);
  const n = Math.min(Math.max(0, count), 12, Math.max(0, byTime));
  if (n <= 0) return;
  const leader = Math.max(0, ...[...ctx.db.racePlayer.room.filter(p.room)].filter((x) => x.active).map((x) => x.pos));
  let meter = p.boostMeter;
  let boost = p.boostTicksLeft;
  let vel = p.vel;
  for (let i = 0; i < n; i++) {
    meter++;
    if (meter >= 20) {
      meter = 0;
      boost = 20;
    }
    vel = Math.min(260, vel + 24 * (1 + (0.35 * Math.max(0, leader - p.pos)) / TRACK) * (boost > 0 ? 1.5 : 1));
  }
  ctx.db.racePlayer.identity.update({ ...p, taps: p.taps + n, boostMeter: meter, boostTicksLeft: boost, vel, lastTapAt: now });
  wake(ctx, r);
});

// Fire the held toy. Bombs go forward when there is anyone to catch, and only fall back to the duck behind
// when you lead. A bubble with nobody ahead is left floating behind as a trap in this lane.
export const useItem = stdb.reducer((ctx) => {
  const racer = ctx.db.racePlayer.identity.find(ctx.sender);
  const item = ctx.db.raceItem.identity.find(ctx.sender);
  const racing = racer && ctx.db.race.id.find(racer.room)?.status === 'racing';
  if (!racer?.active || racer.place || racer.drowned || !item || item.room !== racer.room || !racing) {
    throw new SenderError('Items are for active racers.');
  }
  if (!item.held) throw new SenderError('Collect a toy first.');
  if (item.held === 'turbo' || item.held === 'shield') {
    const boost = item.held === 'turbo' ? { turboTicks: TURBO_TICKS, slowTicks: 0 } : { shieldTicks: SHIELD_TICKS, slowTicks: 0 };
    ctx.db.raceItem.identity.update({ ...item, held: '', ...boost });
    return;
  }
  const rivals = [...ctx.db.racePlayer.room.filter(racer.room)].filter(
    (p) => p.active && !p.place && !p.drowned && !p.identity.isEqual(ctx.sender),
  );
  const ahead = rivals.filter((p) => p.pos > racer.pos).sort((a, b) => a.pos - b.pos || tie(a, b));
  const nearest = (list: Racer[]) =>
    [...list].sort((a, b) => Math.abs(a.pos - racer.pos) - Math.abs(b.pos - racer.pos) || tie(a, b))[0];
  const target = item.held === 'bubble' ? ahead[0] : (nearest(ahead) ?? nearest(rivals));
  if (!target && item.held === 'bubble') {
    ctx.db.raceItem.identity.update({ ...item, held: '' });
    ctx.db.raceFeature.insert({
      id: 0n,
      room: racer.room,
      kind: 'trap',
      lane: Math.round(racer.lane),
      pos: Math.max(1, racer.pos - TRAP_DROP_BACK),
      seq: 99,
      item: '',
    });
    return;
  }
  if (!target) throw new SenderError('No rivals in range. Save your bomb!');
  ctx.db.raceItem.identity.update({ ...item, held: '' });
  ctx.db.itemEffect.insert({
    id: 0n,
    room: racer.room,
    source: ctx.sender,
    target: target.identity,
    kind: item.held,
    sourcePos: racer.pos,
    targetPos: target.pos,
    flightTicks: 6,
    lifeTicks: 18,
    blocked: false,
  });
});

// Waiting rooms: everyone online gets a lane; an empty room (other than PUBLIC) is reclaimed.
function tickWaiting(ctx: Ctx, r: Race) {
  const room = r.id;
  const online = [...ctx.db.player.room.filter(room)].filter((p) => p.online);
  if (!online.length && room !== 'PUBLIC') {
    for (const result of ctx.db.raceResult.room.filter(room)) ctx.db.raceResult.id.delete(result.id);
    for (const item of ctx.db.raceItem.room.filter(room)) ctx.db.raceItem.identity.delete(item.identity);
    for (const effect of ctx.db.itemEffect.room.filter(room)) ctx.db.itemEffect.id.delete(effect.id);
    for (const f of ctx.db.raceFeature.room.filter(room)) ctx.db.raceFeature.id.delete(f.id);
    for (const row of ctx.db.racePlayer.room.filter(room)) ctx.db.racePlayer.identity.delete(row.identity);
    ctx.db.race.id.delete(room);
    return;
  }
  // Whoever is here and has no roster row gets one, in the lobby and on the podium alike.
  for (const p of online) {
    if (ctx.db.racePlayer.identity.find(p.identity)) continue;
    ctx.db.racePlayer.insert(laneRow(p, true, [...ctx.db.racePlayer.room.filter(room)].length % LANES));
  }
}

// Ducks drift sideways under their steering during the countdown and the race.
function tickSteering(ctx: Ctx, r: Race) {
  for (const p of ctx.db.racePlayer.room.filter(r.id)) {
    if (!p.active || !p.steer || p.place || p.drowned) continue;
    const moved = { ...p, lane: Math.max(0, Math.min(LANES - 1, p.lane + p.steer * STEER_RATE)) };
    if (moved.lane === p.lane) {
      ctx.db.racePlayer.identity.update({ ...p, steer: 0 });
      continue;
    }
    const vel = r.status === 'racing' ? tackle(ctx, moved, p.lane) : p.vel;
    ctx.db.racePlayer.identity.update({ ...moved, vel });
  }
}

// Bombs and bubbles in flight land on their target (bombs splash everyone within 180 of it).
function tickEffects(ctx: Ctx, room: string) {
  for (const effect of ctx.db.itemEffect.room.filter(room)) {
    if (effect.lifeTicks <= 1) {
      ctx.db.itemEffect.id.delete(effect.id);
      continue;
    }
    let blocked = effect.blocked;
    if (effect.flightTicks === 1) {
      const target = ctx.db.racePlayer.identity.find(effect.target);
      if (target?.room === room && target.active && !target.place) {
        const victims = [...ctx.db.racePlayer.room.filter(room)].filter(
          (p) =>
            p.active &&
            !p.place &&
            !p.drowned &&
            !p.identity.isEqual(effect.source) &&
            (effect.kind === 'bomb' ? Math.abs(p.pos - target.pos) <= 180 : p.identity.isEqual(target.identity)),
        );
        for (const victim of victims) {
          const state = ctx.db.raceItem.identity.find(victim.identity);
          if (!state) continue;
          if (victim.identity.isEqual(target.identity)) blocked = state.shieldTicks > 0;
          ctx.db.raceItem.identity.update({ ...state, ...hitState(state, effect.kind) });
        }
      }
    }
    ctx.db.itemEffect.id.update({
      ...effect,
      blocked,
      flightTicks: Math.max(0, effect.flightTicks - 1),
      lifeTicks: effect.lifeTicks - 1,
    });
  }
}

// Everything in this lane between last tick's position and this one is crossed now. Consumed toys and
// traps leave both the river and this tick's list, so two ducks can never share one.
function crossFeatures(ctx: Ctx, p: Racer, from: number, features: FeatureRow[], state: ItemState) {
  const crossed = features
    .filter((f) => Math.abs(f.lane - p.lane) < OVERLAP && f.pos > from && f.pos <= p.pos)
    .sort((a, b) => a.pos - b.pos);
  const consume = (f: FeatureRow) => {
    ctx.db.raceFeature.id.delete(f.id);
    features.splice(features.indexOf(f), 1);
  };
  for (const f of crossed) {
    if (f.kind === 'trap') {
      consume(f);
      const before = state.shieldTicks;
      Object.assign(state, hitState(state, 'trap'));
      if (!before) p.bonks++;
    } else if (f.kind === 'buoy') {
      // Rockets and shields work the moment you grab them; bombs and bubbles wait for your moment.
      if (f.item === 'turbo') {
        state.turboTicks = TURBO_TICKS;
        state.slowTicks = 0;
      } else if (f.item === 'shield') {
        state.shieldTicks = SHIELD_TICKS;
        state.slowTicks = 0;
      } else if (!state.held) state.held = f.item;
      else continue; // Already holding a bomb or bubble: leave this one floating.
      consume(f);
    } else if (f.kind === 'rapids') {
      p.vel = Math.min(260, p.vel + 45);
      p.boostTicksLeft = Math.max(p.boostTicksLeft, 15);
    } else if (f.kind === 'whirlpool') {
      if (state.shieldTicks > 0) state.shieldTicks = 0;
      else {
        p.drowned = true;
        p.vel = 0;
        p.boostTicksLeft = 0;
        state.held = '';
        break;
      }
    } else {
      const before = state.shieldTicks;
      Object.assign(state, hitState(state, f.kind));
      if (!before) {
        p.vel *= IMPACT[f.kind]?.keep ?? 0.5;
        p.bonks++;
      }
    }
  }
}

// One tick of a live race: effects land, ducks move and cross features, standings and the clock update.
function tickRacing(ctx: Ctx, r: Race) {
  const room = r.id;
  r.elapsedTicks += 1;
  tickEffects(ctx, room);
  const racers = [...ctx.db.racePlayer.room.filter(room)].filter((p) => p.active);
  if (AUTO_CRUISE) {
    const leader = Math.max(0, ...racers.map((p) => p.pos));
    for (const p of racers) {
      if (p.place || p.drowned) continue;
      p.vel = Math.max(p.vel, CRUISE_SPEED * (1 + (0.25 * (leader - p.pos)) / TRACK) * (p.boostTicksLeft ? 1.3 : 1));
    }
  }
  const drafting = (p: Racer) =>
    racers.some(
      (o) => o !== p && Math.abs(o.lane - p.lane) < OVERLAP && !o.drowned && o.pos > p.pos && o.pos - p.pos <= DRAFT_RANGE,
    );
  const speeds = new Map(
    racers.map((p) => [
      p.identity.toHexString(),
      p.drowned
        ? 0
        : travelSpeed(p.vel, ctx.db.raceItem.identity.find(p.identity) ?? undefined) * (drafting(p) ? DRAFT_BONUS : 1),
    ]),
  );
  const speed = (p: Racer) => speeds.get(p.identity.toHexString()) ?? p.vel;
  // Interpolate crossing time within the tick, rather than relying on row iteration order.
  const crossing = racers
    .filter((p) => !p.place && p.pos + speed(p) * 0.1 >= TRACK)
    .sort((a, b) => (TRACK - a.pos) / Math.max(speed(a), 0.01) - (TRACK - b.pos) / Math.max(speed(b), 0.01) || tie(a, b));
  for (const p of crossing) {
    award(ctx, r, p, speed(p));
    if (p.place === 1) r.phaseTicksLeft = Math.min(r.phaseTicksLeft, 50);
  }
  const features = [...ctx.db.raceFeature.room.filter(room)];
  for (const p of racers) {
    const from = p.pos;
    p.pos = Math.min(TRACK, p.pos + speed(p) * 0.1);
    p.vel = p.place ? 0 : p.vel * 0.88;
    p.boostTicksLeft = Math.max(0, p.boostTicksLeft - 1);
    const item = ctx.db.raceItem.identity.find(p.identity);
    if (!item) continue;
    const state: ItemState = {
      held: item.held,
      slowTicks: Math.max(0, item.slowTicks - 1),
      shieldTicks: Math.max(0, item.shieldTicks - 1),
      turboTicks: Math.max(0, item.turboTicks - 1),
    };
    if (!p.place && !p.drowned) crossFeatures(ctx, p, from, features, state);
    ctx.db.raceItem.identity.update({ ...item, ...state });
  }
  racers.sort(standing);
  const swimming = racers.filter((p) => !p.place && !p.drowned);
  r.idleTicks = swimming.length && swimming.every((p) => speed(p) < 1) ? r.idleTicks + 1 : 0;
  // No podium when there is nothing to crown: everyone left, nobody crossed and the whirlpool got the rest,
  // or the whole field sat still for 15 seconds. A solo run is never forfeited for standing still.
  const forfeit =
    !r.finishCounter &&
    (!racers.length
      ? 'empty'
      : racers.every((p) => p.drowned)
        ? 'drowned'
        : r.idleTicks >= IDLE_FORFEIT_TICKS && racers.length > 1
          ? 'idle'
          : '');
  if (forfeit) {
    r.status = 'finished';
    r.forfeited = true;
    r.forfeitReason = forfeit;
    r.phaseTicksLeft = 0;
    r.winnerName = '';
    racers.forEach((p, i) => ctx.db.racePlayer.identity.update({ ...p, rank: i + 1, vel: 0 }));
    return;
  }
  if (r.phaseTicksLeft === 0 || racers.every((p) => p.place > 0 || p.drowned)) {
    for (const p of racers) if (!p.place) award(ctx, r, p);
    r.status = 'finished';
    r.phaseTicksLeft = 0;
    recordResults(ctx, room, r, racers);
  }
  racers.forEach((p, i) => ctx.db.racePlayer.identity.update({ ...p, rank: i + 1, vel: r.status === 'finished' ? 0 : p.vel }));
}

export const tick = stdb.reducer({ onSchedule: raceTick }, { arg: raceTick.rowType }, (ctx) => {
  if (!ctx.sender.isEqual(ctx.identity)) throw new SenderError('Only the river clock can tick.');
  sweepStale(ctx);
  for (const stored of ctx.db.race.iter()) {
    const current = refreshHost(ctx, stored);
    if (current.status === 'lobby' || current.status === 'finished') {
      tickWaiting(ctx, current);
      continue;
    }
    tickSteering(ctx, current);
    const r = { ...current, phaseTicksLeft: Math.max(0, current.phaseTicksLeft - 1) };
    if (r.status === 'countdown' && r.phaseTicksLeft === 0) {
      r.status = 'racing';
      r.phaseTicksLeft = RACE_TICKS;
      r.elapsedTicks = 0;
      for (const p of ctx.db.racePlayer.room.filter(r.id)) {
        if (!p.active) continue;
        const user = ctx.db.player.identity.find(p.identity);
        if (user) ctx.db.player.identity.update({ ...user, racesPlayed: user.racesPlayed + 1 });
      }
    } else if (r.status === 'racing') tickRacing(ctx, r);
    ctx.db.race.id.update(r);
  }
});
