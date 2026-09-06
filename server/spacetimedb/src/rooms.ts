import { SenderError, t } from 'spacetimedb/server';
import { DUCK_COUNT, LANES, MAX_DUCKS, trackLayout } from './items';
import stdb, { bump, emptyRace, isLive, laneRow, type Ctx } from './schema';
import { othersOnline, refreshHost, roomIsFull } from './presence';
import { tie } from './scoring';

const ROOM_CODE = /^[A-Z0-9-]{1,16}$/;

function cleanName(name: string) {
  return (
    name
      .trim()
      .replace(/[\u0000-\u001f]/g, '')
      .slice(0, 14) || 'Duck'
  );
}

// Enter a room (creating it if needed). Capacity is checked whenever the caller is not already an
// online member of that room, so a duck that left cannot slip back into a room that filled up meanwhile.
function joinRoom(ctx: Ctx, name: string, duckIndex: number, room: string, mode: string = 'race') {
  if (duckIndex >= DUCK_COUNT) throw new SenderError(`Pick one of the ${DUCK_COUNT} ducks.`);
  room = room.trim().toUpperCase() || 'PUBLIC';
  if (!ROOM_CODE.test(room)) throw new SenderError('Use 1–16 letters, numbers, or hyphens for the room.');
  const old = ctx.db.player.identity.find(ctx.sender);
  const existing = ctx.db.racePlayer.identity.find(ctx.sender);
  const alreadyMember = !!old && old.online && old.room === room;
  if (!alreadyMember && roomIsFull(ctx, room, ctx.sender)) {
    throw new SenderError(`That room is full (${MAX_DUCKS} ducks). Try another code or a random room.`);
  }
  if (old && old.room !== room) {
    const previous = ctx.db.race.id.find(old.room);
    if (existing?.active && previous && isLive(previous.status)) {
      throw new SenderError('Finish this race before changing rooms. You can still change your duck for the next race.');
    }
    ctx.db.racePlayer.identity.delete(ctx.sender);
  }
  if (!ctx.db.race.id.find(room)) ctx.db.race.insert(emptyRace(room, mode));
  const p = {
    identity: ctx.sender,
    room,
    name: cleanName(name),
    duckIndex,
    online: true,
    racesWon: old?.racesWon ?? 0,
    racesPlayed: old?.racesPlayed ?? 0,
    lastSeen: ctx.timestamp,
  };
  if (old) ctx.db.player.identity.update(p);
  else {
    ctx.db.player.insert(p);
    bump(ctx, 'players');
  }
  const r = refreshHost(ctx, ctx.db.race.id.find(room)!);
  // Cosmetic edits never reset progress or change the recorded finisher's name.
  if (existing?.room === room && r.status !== 'lobby') return;
  const row = laneRow(p, r.status === 'lobby', [...ctx.db.racePlayer.room.filter(room)].length % LANES);
  if (ctx.db.racePlayer.identity.find(ctx.sender)) ctx.db.racePlayer.identity.update(row);
  else ctx.db.racePlayer.insert(row);
}

export const join = stdb.reducer({ name: t.string(), duckIndex: t.u8(), room: t.string() }, (ctx, { name, duckIndex, room }) =>
  joinRoom(ctx, name, duckIndex, room),
);

// Random matching: a room that is waiting (lobby or podium), has company and has space; never a practice
// river, never a race already under way. Nobody is made to spectate a stranger's race: if no such room
// exists, the newcomer opens a fresh one and becomes the next duck's match.
export const joinRandom = stdb.reducer({ name: t.string(), duckIndex: t.u8() }, (ctx, { name, duckIndex }) => {
  const current = ctx.db.racePlayer.identity.find(ctx.sender);
  if (current?.active && isLive(ctx.db.race.id.find(current.room)?.status ?? '')) {
    throw new SenderError('Finish this race before finding another room.');
  }
  const pool = [...ctx.db.race.iter()]
    .filter((r) => r.mode !== 'practice' && (r.status === 'lobby' || r.status === 'finished'))
    .map((r) => ({ race: r, count: othersOnline(ctx, r.id, ctx.sender) }))
    .filter((r) => r.count > 0 && r.count < MAX_DUCKS);
  let room: string;
  if (pool.length) {
    pool.sort((a, b) => (a.race.id < b.race.id ? -1 : 1));
    room = pool[ctx.random.integerInRange(0, pool.length - 1)].race.id;
  } else {
    const publicRoom = ctx.db.race.id.find('PUBLIC');
    if ((!publicRoom || publicRoom.status === 'lobby') && !roomIsFull(ctx, 'PUBLIC', ctx.sender)) room = 'PUBLIC';
    else {
      do room = `POND-${ctx.random.integerInRange(0, 2176782335).toString(36).toUpperCase().padStart(6, '0')}`;
      while (ctx.db.race.id.find(room));
    }
  }
  joinRoom(ctx, name, duckIndex, room);
});

// Practice alone: a private river nobody is matched into. Friends can still follow an invite link.
export const startPractice = stdb.reducer({ name: t.string(), duckIndex: t.u8() }, (ctx, { name, duckIndex }) => {
  let room: string;
  do room = `SOLO-${ctx.random.integerInRange(0, 60466175).toString(36).toUpperCase().padStart(5, '0')}`;
  while (ctx.db.race.id.find(room));
  joinRoom(ctx, name, duckIndex, room, 'practice');
});

// Back to the home screen: step out of the roster so the room no longer waits for this duck.
// Leaving mid-race simply drops the duck out of that race.
export const leaveRoom = stdb.reducer((ctx) => {
  const p = ctx.db.player.identity.find(ctx.sender);
  if (!p) return;
  ctx.db.player.identity.update({ ...p, online: false });
  ctx.db.racePlayer.identity.delete(ctx.sender);
  ctx.db.raceItem.identity.delete(ctx.sender);
});

// Only the host starts a race (or a rematch). Everyone online in the room lines up in the lanes.
export const startRace = stdb.reducer((ctx) => {
  const p = ctx.db.player.identity.find(ctx.sender);
  if (!p?.online) throw new SenderError('Join a room before starting a race.');
  const stored = ctx.db.race.id.find(p.room);
  if (!stored) throw new SenderError('Join a room first.');
  const current = refreshHost(ctx, stored);
  if (current.hostIdentity !== ctx.sender.toHexString()) throw new SenderError('Only the room host can start the race.');
  if (current.status !== 'lobby' && current.status !== 'finished') return; // Concurrent start clicks are idempotent.
  const room = p.room;
  for (const result of ctx.db.raceResult.room.filter(room)) ctx.db.raceResult.id.delete(result.id);
  for (const item of ctx.db.raceItem.room.filter(room)) ctx.db.raceItem.identity.delete(item.identity);
  for (const effect of ctx.db.itemEffect.room.filter(room)) ctx.db.itemEffect.id.delete(effect.id);
  for (const row of ctx.db.racePlayer.room.filter(room)) ctx.db.racePlayer.identity.delete(row.identity);
  for (const f of ctx.db.raceFeature.room.filter(room)) ctx.db.raceFeature.id.delete(f.id);
  const rows = [...ctx.db.player.room.filter(room)]
    .filter((user) => user.online)
    .map((user) => laneRow(user))
    .sort(tie);
  rows.forEach((row, i) => ctx.db.racePlayer.insert({ ...row, rank: i + 1, lane: i % LANES }));
  for (const row of rows) {
    ctx.db.raceItem.insert({ identity: row.identity, room, held: '', slowTicks: 0, shieldTicks: 0, turboTicks: 0 });
  }
  const raceNumber = current.raceNumber + (current.status === 'finished' ? 1 : 0);
  const solo = rows.length === 1 || current.mode === 'practice';
  // A fresh seed every race, so nobody can memorise where the whirlpool sits.
  for (const f of trackLayout(ctx.random.integerInRange(0, 1_000_000_000), solo)) {
    ctx.db.raceFeature.insert({ id: 0n, room, ...f });
  }
  ctx.db.race.id.update({
    ...emptyRace(room, current.mode),
    status: 'countdown',
    phaseTicksLeft: 30,
    raceNumber,
    solo,
    hostIdentity: current.hostIdentity,
  });
  bump(ctx, solo ? 'soloRuns' : 'races');
});
