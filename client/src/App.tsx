import { useEffect, useMemo, useRef, useState } from 'react';
import { SpacetimeDBProvider, useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { Identity } from 'spacetimedb';
import { DbConnection, tables, reducers } from './module_bindings';
import { useGameTools } from './useGameTools';
import NameEntry from './NameEntry';
import RaceScreen from './RaceScreen';
import RubberDuck from './RubberDuck';
import { PREF, readPref, writePref } from './storage';

const LIVE_DATABASE = 'duckoff-rooms-gari-20260905';

function Game() {
  const { isActive, identity, connectionError, getConnection } = useSpacetimeDB();
  const [linkedRoom, setLinkedRoom] = useState(
    () => new URLSearchParams(location.search).get('room')?.trim().toUpperCase() || '',
  );
  const [room, setRoom] = useState(linkedRoom || 'PUBLIC');
  // Only rooms the player typed (or followed a link to) are treated as a code they know.
  // Randomly matched rooms get generated names, which must never reappear as a "room code".
  const [viaCode, setViaCode] = useState(!!linkedRoom);
  const [races, raceReady] = useTable(tables.race.where((r) => r.id.eq(room)));
  const [players, playersReady] = useTable(tables.racePlayer.where((p) => p.room.eq(room)));
  const [legends, legendsReady] = useTable(tables.player.where((p) => p.room.eq(room)));
  const [results] = useTable(tables.raceResult.where((p) => p.room.eq(room)));
  const [items] = useTable(tables.raceItem.where((p) => p.room.eq(room)));
  const [effects] = useTable(tables.itemEffect.where((p) => p.room.eq(room)));
  const [features] = useTable(tables.raceFeature.where((p) => p.room.eq(room)));
  const [statsRows] = useTable(tables.stats);
  // Our own player row follows us across rooms, so random matching can read the server's assignment.
  const [, selfReady] = useTable(
    tables.player.where((p) => p.identity.eq(identity ?? new Identity(0n))),
    { enabled: !!identity },
  );
  const join = useReducer(reducers.join);
  const joinRandom = useReducer(reducers.joinRandom);
  const startPractice = useReducer(reducers.startPractice);
  const tap = useReducer(reducers.tap);
  const start = useReducer(reducers.startRace);
  const useItem = useReducer(reducers.useItem);
  const leaveRoom = useReducer(reducers.leaveRoom);
  const switchLane = useReducer(reducers.switchLane);
  const heartbeat = useReducer(reducers.heartbeat);
  const steer = useReducer(reducers.steer);
  const [entered, setEntered] = useState(false);
  const [error, setError] = useState('');
  const [slow, setSlow] = useState(false);
  const rejoining = useRef(false);

  useEffect(() => {
    if (isActive) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(timer);
  }, [isActive]);

  // Tell the room we're still here; a phone that sleeps stops sending and drops off the roster after 12s.
  useEffect(() => {
    if (!isActive || !entered) return;
    const beat = () => {
      if (document.visibilityState === 'visible') void heartbeat().catch(() => {});
    };
    beat();
    const timer = setInterval(beat, 4000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [isActive, entered, heartbeat]);

  const finishJoin = (name: string, duckIndex: number, nextRoom: string, byCode: boolean) => {
    setRoom(nextRoom);
    setViaCode(byCode);
    const url = new URL(location.href);
    if (byCode) url.searchParams.set('room', nextRoom);
    else url.searchParams.delete('room');
    history.replaceState(null, '', url);
    writePref(PREF.name, name.trim() || 'Duck');
    writePref(PREF.duck, String(duckIndex));
    setEntered(true);
    setError('');
  };

  // Main menu: leave the results behind and start over with a clean entry screen (random matching by default).
  const leave = () => {
    void leaveRoom().catch(() => {});
    setEntered(false);
    setViaCode(false);
    setLinkedRoom('');
    setError('');
    const url = new URL(location.href);
    url.searchParams.delete('room');
    history.replaceState(null, '', url);
  };

  const joinGame = async (name: string, duckIndex: number, selectedRoom = room, byCode = true) => {
    const nextRoom = selectedRoom.trim().toUpperCase() || 'PUBLIC';
    await join({ name, duckIndex, room: nextRoom });
    finishJoin(name, duckIndex, nextRoom, byCode);
  };

  // The server picks the room for random matching and practice runs: read the assignment from our player row.
  // The row update usually lands before the reducer resolves, but not always: give the cache a moment.
  const assignedRoom = async (previous?: string) => {
    const me = () => (identity ? (getConnection() as DbConnection | null)?.db.player.identity.find(identity) : undefined);
    let assignment = me();
    for (
      let waited = 0;
      (!assignment || (previous && assignment.room === previous && waited < 400)) && waited < 3000;
      waited += 50
    ) {
      await new Promise((r) => setTimeout(r, 50));
      assignment = me();
    }
    if (!assignment?.room) throw new Error('Your room is still connecting. Please try again.');
    return assignment.room;
  };
  const findRoom = async (name: string, duckIndex: number) => {
    const previous = identity ? (getConnection() as DbConnection | null)?.db.player.identity.find(identity)?.room : undefined;
    await joinRandom({ name, duckIndex });
    finishJoin(name, duckIndex, await assignedRoom(previous), false);
  };
  const practiceRun = async (name: string, duckIndex: number) => {
    const previous = identity ? (getConnection() as DbConnection | null)?.db.player.identity.find(identity)?.room : undefined;
    await startPractice({ name, duckIndex });
    finishJoin(name, duckIndex, await assignedRoom(previous), false);
  };

  // If our room's row vanished (the room was tidied away while this tab slept), quietly open it again.
  // If we cannot get back in (the room filled up meanwhile), say so and return to the menu.
  useEffect(() => {
    if (!entered || !raceReady || races[0] || rejoining.current) return;
    rejoining.current = true;
    const name = readPref(PREF.name) || 'Duck';
    const duckIndex = Number(readPref(PREF.duck)) || 0;
    void join({ name, duckIndex, room })
      .catch((e: unknown) => {
        setEntered(false);
        setError(e instanceof Error && e.message ? e.message : 'That room is no longer open.');
      })
      .finally(() => {
        rejoining.current = false;
      });
  }, [entered, raceReady, races, room, join]);

  const friendly = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

  useGameTools(
    {
      connected: isActive,
      race: races[0],
      items: items.map((i) => ({ ...i, identity: i.identity.toHexString() })),
      features: features.map((f) => ({ kind: f.kind, lane: f.lane, pos: f.pos })),
      players: players.map((p) => ({
        name: p.name,
        active: p.active,
        lane: p.lane,
        pos: p.pos,
        place: p.place,
        rank: p.rank,
        taps: p.taps,
      })),
    },
    (name, index) => joinGame(name, index, room, viaCode),
    () => tap({ count: 1 }),
    () => start(),
    () => useItem(),
    (direction) => switchLane({ direction }),
    (amount) => steer({ amount }),
  );

  if (!isActive || !identity || !selfReady || !raceReady || !playersReady || !legendsReady) {
    const trouble = connectionError || slow;
    return (
      <main className="splash">
        <div className="splash-duck">
          <RubberDuck size={112} bob />
        </div>
        <h1>{trouble ? 'A little ripple in the connection' : 'Filling the little lagoon…'}</h1>
        <p>{trouble ? 'Your duck is safe. Check your connection and try again.' : 'Getting the water just right for you.'}</p>
        {trouble && (
          <button className="primary" onClick={() => location.reload()}>
            Try again ↻
          </button>
        )}
      </main>
    );
  }
  if (!entered) {
    return (
      <NameEntry
        initialRoom={linkedRoom}
        error={error}
        stats={statsRows[0]}
        onJoin={async (name, index, nextRoom) => {
          try {
            await joinGame(name, index, nextRoom);
          } catch (e) {
            setError(friendly(e, 'Couldn’t hop in. Please try again.'));
          }
        }}
        onRandomJoin={async (name, index) => {
          try {
            await findRoom(name, index);
          } catch (e) {
            setError(friendly(e, 'Couldn’t find a room. Please try again.'));
          }
        }}
        onSolo={async (name, index) => {
          try {
            await practiceRun(name, index);
          } catch (e) {
            setError(friendly(e, 'Couldn’t open a practice river. Please try again.'));
          }
        }}
      />
    );
  }
  if (!races[0]) {
    return (
      <main className="splash">
        <h1>Opening room {room}…</h1>
        <button className="primary" onClick={() => setEntered(false)}>
          Back to my duck
        </button>
      </main>
    );
  }
  return (
    <RaceScreen
      race={races[0]}
      players={players}
      legends={legends}
      items={items}
      effects={effects}
      features={features}
      results={results.filter((r) => r.raceNumber === races[0].raceNumber)}
      identity={identity.toHexString()}
      onTap={(count) => tap({ count })}
      onStart={() => start()}
      onUseItem={() => useItem()}
      onSwitchLane={(direction) => switchLane({ direction })}
      onSteer={(amount) => steer({ amount })}
      onLeave={leave}
    />
  );
}

export default function App() {
  const builder = useMemo(() => {
    const uri =
      process.env.NEXT_PUBLIC_STDB_URI ||
      (location.protocol === 'https:' ? 'wss://maincloud.spacetimedb.com' : `ws://${location.hostname}:3030`);
    const database = process.env.NEXT_PUBLIC_STDB_MODULE || (location.protocol === 'https:' ? LIVE_DATABASE : 'duckoff');
    const key = `duckoff_token:${uri}:${database}`;
    // The token lives in localStorage so one browser keeps one identity across visits: that is how we count
    // people without accounts. Storage can be unavailable, in which case the session simply gets a fresh identity.
    const read = () => readPref(key) ?? undefined;
    // SDK 2.9 decompresses messages concurrently; small tap messages can overtake compressed race ticks
    // and roll back standings. Room-scoped updates are small, so compression is off.
    return DbConnection.builder()
      .withCompression('none')
      .withUri(uri)
      .withDatabaseName(database)
      .withToken(read())
      .onConnect((_ctx, _identity, token) => writePref(key, token));
  }, []);
  return (
    <SpacetimeDBProvider connectionBuilder={builder}>
      <Game />
    </SpacetimeDBProvider>
  );
}
