import type { Identity } from 'spacetimedb';
import { MAX_DUCKS, LANES, STALE_AFTER_MICROS } from './items';
import stdb, { bump, isLive, laneRow, type Ctx, type Player, type Race } from './schema';

// Everyone online in a room except `except` (the caller, who may already be a member).
export function othersOnline(ctx: Ctx, room: string, except?: Identity) {
  return [...ctx.db.player.room.filter(room)].filter((p) => p.online && !(except && p.identity.isEqual(except))).length;
}

export const roomIsFull = (ctx: Ctx, room: string, except?: Identity) => othersOnline(ctx, room, except) >= MAX_DUCKS;

// The first member hosts the room. Keep that host until they leave or go offline; then choose a connected
// member without starting a countdown automatically.
export function refreshHost(ctx: Ctx, r: Race): Race {
  const online = [...ctx.db.player.room.filter(r.id)].filter((p) => p.online);
  if (online.some((p) => p.identity.toHexString() === r.hostIdentity)) return r;
  const hostIdentity = online.map((p) => p.identity.toHexString()).sort()[0] ?? '';
  if (hostIdentity === r.hostIdentity) return r;
  const updated = { ...r, hostIdentity };
  ctx.db.race.id.update(updated);
  return updated;
}

// A duck that is back in a waiting room (lobby or podium) gets its roster row again.
export function restoreRoster(ctx: Ctx, p: Player) {
  const r = ctx.db.race.id.find(p.room);
  if (!r || isLive(r.status) || ctx.db.racePlayer.identity.find(p.identity)) return;
  const inRoom = [...ctx.db.racePlayer.room.filter(p.room)].length;
  ctx.db.racePlayer.insert(laneRow(p, true, inRoom % LANES));
}

// A duck that stops counting as here leaves a waiting roster; a live race keeps its lane.
export function dropOffline(ctx: Ctx, identity: Identity, room: string) {
  const status = ctx.db.race.id.find(room)?.status;
  if (!isLive(status ?? '')) ctx.db.racePlayer.identity.delete(identity);
}

// Coming back online is a room membership event: if the room filled up while this duck was away,
// it cannot slip back in past the cap. It is parked outside the room and the client re-joins properly.
function comeBack(ctx: Ctx, p: Player) {
  if (!p.online && p.room && roomIsFull(ctx, p.room, p.identity)) {
    ctx.db.player.identity.update({ ...p, online: false, room: '', lastSeen: ctx.timestamp });
    return;
  }
  const updated = { ...p, online: true, lastSeen: ctx.timestamp };
  ctx.db.player.identity.update(updated);
  restoreRoster(ctx, updated);
}

export const onConnect = stdb.clientConnected((ctx) => {
  const seen = ctx.db.visitor.identity.find(ctx.sender);
  if (seen) ctx.db.visitor.identity.update({ ...seen, lastSeen: ctx.timestamp, visits: seen.visits + 1 });
  else {
    ctx.db.visitor.insert({ identity: ctx.sender, firstSeen: ctx.timestamp, lastSeen: ctx.timestamp, visits: 1 });
    bump(ctx, 'visitors');
  }
  if (ctx.connectionId) {
    ctx.db.presence.connectionId.delete(ctx.connectionId);
    ctx.db.presence.insert({ connectionId: ctx.connectionId, identity: ctx.sender });
  }
  const p = ctx.db.player.identity.find(ctx.sender);
  if (p) comeBack(ctx, p);
});

// Phones that sleep or lose signal keep their socket open for a while; a heartbeat every few seconds
// tells the room the duck is really still here.
export const heartbeat = stdb.reducer((ctx) => {
  const p = ctx.db.player.identity.find(ctx.sender);
  if (p) comeBack(ctx, p);
});

export const onDisconnect = stdb.clientDisconnected((ctx) => {
  if (ctx.connectionId) ctx.db.presence.connectionId.delete(ctx.connectionId);
  if ([...ctx.db.presence.iter()].some((p) => p.identity.isEqual(ctx.sender))) return;
  const p = ctx.db.player.identity.find(ctx.sender);
  if (!p) return;
  ctx.db.player.identity.update({ ...p, online: false });
  // Keep the race roster and podium intact when a phone disconnects or sleeps.
  dropOffline(ctx, ctx.sender, p.room);
});

// Ducks whose phone went quiet stop counting as here. Only online rows are scanned, via the index.
export function sweepStale(ctx: Ctx) {
  const now = ctx.timestamp.microsSinceUnixEpoch;
  for (const p of ctx.db.player.online.filter(true)) {
    if (now - p.lastSeen.microsSinceUnixEpoch <= STALE_AFTER_MICROS) continue;
    ctx.db.player.identity.update({ ...p, online: false });
    dropOffline(ctx, p.identity, p.room);
  }
}
