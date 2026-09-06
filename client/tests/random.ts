import assert from 'node:assert/strict';
import { DbConnection } from '../src/module_bindings';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Every test client heartbeats like the app does, so the 12-second staleness sweep never drops it.
const beats: ReturnType<typeof setInterval>[] = [];
const clients: DbConnection[] = [];
const uri = process.env.TEST_STDB_URI ?? 'ws://127.0.0.1:3030',
  database = process.env.TEST_STDB_MODULE ?? 'duckoff';
async function connect() {
  return new Promise<DbConnection>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Connection timed out')), 20000);
    DbConnection.builder()
      .withCompression('none')
      .withUri(uri)
      .withDatabaseName(database)
      .onConnect((c) => {
        clients.push(c);
        beats.push(
          setInterval(() => {
            try {
              void c.reducers.heartbeat({}).catch(() => {});
            } catch {}
          }, 4000),
        );
        c.subscriptionBuilder()
          .onApplied(() => {
            clearTimeout(timer);
            resolve(c);
          })
          .subscribeToAllTables();
      })
      .onConnectError((_c, e) => {
        clearTimeout(timer);
        reject(e);
      })
      .build();
  });
}
async function until(check: () => boolean, timeout = 65000) {
  const t = Date.now();
  while (!check()) {
    if (Date.now() - t > timeout) throw Error(`Timed out waiting for: ${check.toString().slice(0, 160)}`);
    await sleep(30);
  }
}
const roomOf = (c: DbConnection) => c.db.player.identity.find(c.identity!)?.room;
const onlineIn = (c: DbConnection, room: string) => [...c.db.player.iter()].filter((p) => p.room === room && p.online).length;
async function main() {
  const a = await connect();
  await a.reducers.joinRandom({ name: 'Solo', duckIndex: 0 });
  const first = roomOf(a);
  assert(first, 'random join assigns a room');
  assert(a.db.racePlayer.identity.find(a.identity!)?.active, 'random joiner is an active racer in a waiting room');
  const b = await connect();
  await b.reducers.joinRandom({ name: 'Pal', duckIndex: 1 });
  assert.equal(roomOf(b), first);
  assert.equal(b.db.race.id.find(first)?.hostIdentity, a.identity!.toHexString(), 'the first random joiner hosts the room');
  await assert.rejects(b.reducers.startRace({}), /host/);
  assert.equal(b.db.race.id.find(first)?.status, 'lobby');
  console.log(`PASS: random joiners share the live room ${first}; the row is readable as soon as the reducer resolves.`);
  // A practice river is private: a random joiner never lands in it, even when it is the only room with company.
  const solo = await connect();
  await solo.reducers.startPractice({ name: 'Loner', duckIndex: 0 });
  const soloRoom = roomOf(solo)!;
  assert(soloRoom.startsWith('SOLO-'));
  assert.equal(solo.db.race.id.find(soloRoom)?.mode, 'practice');
  const wanderer = await connect();
  await wanderer.reducers.joinRandom({ name: 'Wanderer', duckIndex: 1 });
  assert.notEqual(roomOf(wanderer), soloRoom, 'random matching skips practice rooms');
  console.log('PASS: practice rivers are never handed to random joiners.');
  const codeRoom = `R-${Date.now().toString(36).toUpperCase()}`;
  const c = await connect();
  await c.reducers.join({ name: 'Coder', duckIndex: 2, room: codeRoom });
  assert.equal(roomOf(c), codeRoom);
  const d = await connect();
  await d.reducers.joinRandom({ name: 'Drifter', duckIndex: 3 });
  assert([first, codeRoom].includes(roomOf(d)!), `joined a waiting room with players, got ${roomOf(d)}`);
  console.log('PASS: a typed code opens its own room; random matching only picks rooms with ducks in them.');
  await a.reducers.startRace({});
  await until(() => a.db.race.id.find(first)?.status === 'racing');
  await assert.rejects(a.reducers.joinRandom({ name: 'Solo', duckIndex: 0 }), /Finish this race/);
  const e = await connect();
  await e.reducers.joinRandom({ name: 'Newbie', duckIndex: 4 });
  assert.equal(roomOf(e), codeRoom, 'a waiting room beats a racing one');
  console.log('PASS: racers stay put mid-race; newcomers prefer a room that is waiting to start.');
  // The drifter may have picked the code room too, so fill it to exactly twelve based on the live count.
  await Promise.all(
    Array.from({ length: 12 - onlineIn(e, codeRoom) }, async (_, i) => {
      const x = await connect();
      await x.reducers.join({ name: `Filler ${i}`, duckIndex: i % 10, room: codeRoom });
    }),
  );
  await until(() => onlineIn(e, codeRoom) >= 12);
  const f = await connect();
  await f.reducers.joinRandom({ name: 'Latecomer', duckIndex: 5 });
  assert.notEqual(roomOf(f), codeRoom, 'a full room is skipped');
  assert.notEqual(roomOf(f), first, 'a race already under way is never handed to a random joiner');
  assert.equal(f.db.race.id.find(roomOf(f)!)?.status, 'lobby', 'the newcomer gets a fresh waiting room instead');
  assert(f.db.racePlayer.identity.find(f.identity!)?.active, 'and races straight away, never spectates');
  console.log('PASS: full and racing rooms are skipped by matching; a newcomer opens a fresh room instead of waiting.');
  // With every room full, a random joiner is never turned away: they open a fresh room and wait alone.
  await Promise.all(
    Array.from({ length: 12 - onlineIn(a, first) }, async (_, i) => {
      const x = await connect();
      await x.reducers.join({ name: `Packer ${i}`, duckIndex: i % 10, room: first });
    }),
  );
  await until(() => onlineIn(a, first) >= 12);
  const h = await connect();
  await h.reducers.joinRandom({ name: 'Thirteenth', duckIndex: 7 });
  assert(![first, codeRoom].includes(roomOf(h)!), `got a waiting room, not ${roomOf(h)}`);
  assert.equal(roomOf(h), roomOf(f), "the fresh room a newcomer opened becomes the next duck's match");
  assert.equal(h.db.race.id.find(roomOf(h)!)?.status, 'lobby');
  console.log('PASS: when every room is full or racing, a random joiner opens a new room and the next one joins it.');
  // A phone that goes quiet drops off the roster after 12s even though its socket is still open.
  const base = onlineIn(h, roomOf(h)!);
  const quiet = await connect();
  clearInterval(beats.pop()!);
  await quiet.reducers.join({ name: 'Sleepy', duckIndex: 2, room: roomOf(h)! });
  await until(() => onlineIn(h, roomOf(h)!) === base + 1);
  await until(() => onlineIn(h, roomOf(h)!) === base, 20000);
  assert.equal(h.db.player.identity.find(quiet.identity!)?.online, false);
  assert.equal(h.db.racePlayer.identity.find(quiet.identity!), null, 'the lobby lets a silent duck go');
  await quiet.reducers.heartbeat({});
  await until(() => onlineIn(h, roomOf(h)!) === base + 1);
  console.log('PASS: a silent client is dropped from the lobby after 12s and comes back with a heartbeat.');
  beats.forEach(clearInterval);
  for (const x of clients) x.disconnect();
  console.log('ALL RANDOM ROOM CHECKS PASSED');
}
main().catch((e) => {
  console.error(e);
  beats.forEach(clearInterval);
  for (const c of clients) c.disconnect();
  process.exitCode = 1;
});
