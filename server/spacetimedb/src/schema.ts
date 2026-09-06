import { schema, table, t, type ReducerCtx, type InferSchema } from 'spacetimedb/server';
import type { Infer } from 'spacetimedb';

export const player = table(
  { public: true },
  {
    identity: t.identity().primaryKey(),
    room: t.string().index('btree'),
    name: t.string(),
    duckIndex: t.u8(),
    // Indexed so the stale-presence sweep only touches ducks that are currently counted as here.
    online: t.bool().index('btree'),
    racesWon: t.u32(),
    racesPlayed: t.u32(),
    lastSeen: t.timestamp(),
  },
);

export const race = table(
  { public: true },
  {
    id: t.string().primaryKey(),
    status: t.string(),
    phaseTicksLeft: t.u32(),
    finishCounter: t.u32(),
    raceNumber: t.u32(),
    winnerName: t.string(),
    winnerDuckIndex: t.u8(),
    idleTicks: t.u32(),
    forfeited: t.bool(),
    forfeitReason: t.string(),
    solo: t.bool(),
    hostIdentity: t.string().default(''),
    // 'race' or 'practice'. Practice rivers are private: random matching never hands them out.
    mode: t.string().default('race'),
    // Ticks since the race went live; finish times come from this, not from the finishing countdown.
    elapsedTicks: t.u32().default(0),
  },
);

export const racePlayer = table(
  { public: true },
  {
    identity: t.identity().primaryKey(),
    room: t.string().index('btree'),
    name: t.string(),
    duckIndex: t.u8(),
    active: t.bool(),
    lane: t.f64(),
    steer: t.f64(),
    pos: t.f64(),
    vel: t.f64(),
    taps: t.u32(),
    boostMeter: t.u32(),
    boostTicksLeft: t.u32(),
    place: t.u32(),
    rank: t.u32(),
    lastTapAt: t.u64(),
    drowned: t.bool(),
    bonks: t.u32(),
    seconds: t.f64(),
  },
);

export const raceResult = table(
  { public: true },
  {
    id: t.string().primaryKey(),
    room: t.string().index('btree'),
    raceNumber: t.u32(),
    identity: t.identity(),
    name: t.string(),
    duckIndex: t.u8(),
    place: t.u32(),
    taps: t.u32(),
    pos: t.f64(),
    drowned: t.bool(),
    bonks: t.u32(),
    seconds: t.f64(),
  },
);

export const raceItem = table(
  { public: true },
  {
    identity: t.identity().primaryKey(),
    room: t.string().index('btree'),
    held: t.string(),
    slowTicks: t.u32(),
    shieldTicks: t.u32(),
    turboTicks: t.u32(),
  },
);

// Buoys and obstacles for the current race, laid out per lane so ducks have to steer.
export const raceFeature = table(
  { public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    room: t.string().index('btree'),
    kind: t.string(),
    lane: t.u8(),
    pos: t.f64(),
    seq: t.u32(),
    item: t.string(),
  },
);

export const itemEffect = table(
  { public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    room: t.string().index('btree'),
    source: t.identity(),
    target: t.identity(),
    kind: t.string(),
    sourcePos: t.f64(),
    targetPos: t.f64(),
    flightTicks: t.u32(),
    lifeTicks: t.u32(),
    blocked: t.bool(),
  },
);

export const presence = table({ public: true }, { connectionId: t.connectionId().primaryKey(), identity: t.identity() });

// Account-free reach tracking: one row per identity (one identity per browser), plus public running totals.
export const visitor = table(
  {},
  { identity: t.identity().primaryKey(), firstSeen: t.timestamp(), lastSeen: t.timestamp(), visits: t.u32() },
);
export const stats = table(
  { public: true },
  { id: t.u8().primaryKey(), visitors: t.u32(), players: t.u32(), races: t.u32(), soloRuns: t.u32() },
);

export const raceTick = table({}, { scheduledId: t.u64().primaryKey().autoInc(), scheduledAt: t.scheduleAt() });

const stdb = schema({
  player,
  race,
  racePlayer,
  raceResult,
  raceItem,
  itemEffect,
  raceFeature,
  presence,
  visitor,
  stats,
  raceTick,
});
export default stdb;

export type Ctx = ReducerCtx<InferSchema<typeof stdb>>;
export type Racer = Infer<typeof racePlayer.rowType>;
export type Player = Infer<typeof player.rowType>;
export type Race = Infer<typeof race.rowType>;
export type FeatureRow = Infer<typeof raceFeature.rowType>;

export const laneRow = (p: Player, active = true, laneIndex = 2): Racer => ({
  identity: p.identity,
  room: p.room,
  name: p.name,
  duckIndex: p.duckIndex,
  active,
  lane: laneIndex,
  steer: 0,
  pos: 0,
  vel: 0,
  taps: 0,
  boostMeter: 0,
  boostTicksLeft: 0,
  place: 0,
  rank: 0,
  lastTapAt: 0n,
  drowned: false,
  bonks: 0,
  seconds: 0,
});

export const emptyRace = (id: string, mode: string = 'race'): Race => ({
  id,
  status: 'lobby',
  phaseTicksLeft: 0,
  finishCounter: 0,
  raceNumber: 1,
  winnerName: '',
  winnerDuckIndex: 0,
  idleTicks: 0,
  forfeited: false,
  forfeitReason: '',
  solo: false,
  hostIdentity: '',
  mode,
  elapsedTicks: 0,
});

export const isLive = (status: string) => status === 'countdown' || status === 'racing';

export function bump(ctx: Ctx, field: 'visitors' | 'players' | 'races' | 'soloRuns') {
  const row = ctx.db.stats.id.find(0) ?? ctx.db.stats.insert({ id: 0, visitors: 0, players: 0, races: 0, soloRuns: 0 });
  ctx.db.stats.id.update({ ...row, [field]: row[field] + 1 });
}
