import { useState } from 'react';
import DuckPreview from './three/DuckPreview';
import { DUCKS, DUCK_COUNT } from './palette';
import { unlockAudio, squeak } from './squeak';
import { PREF, readPref } from './storage';
type Mode = 'random' | 'code';
type Props = {
  onJoin: (name: string, index: number, room: string) => Promise<void>;
  onRandomJoin: (name: string, index: number) => Promise<void>;
  onSolo: (name: string, index: number) => Promise<void>;
  error?: string;
  initialRoom: string;
  stats?: { visitors: number; players: number; races: number; soloRuns: number };
};
export default function NameEntry({ onJoin, onRandomJoin, onSolo, error, initialRoom, stats }: Props) {
  const [room, setRoom] = useState(initialRoom);
  // A shared link pre-selects the code path; everyone else gets random matching.
  const [mode, setMode] = useState<Mode>(initialRoom ? 'code' : 'random');
  const [index, setIndex] = useState(() => {
    const saved = Number(readPref(PREF.duck));
    return Number.isInteger(saved) && saved >= 0 && saved < DUCK_COUNT ? saved : 0;
  });
  const [name, setName] = useState(() => readPref(PREF.name) ?? ''),
    [busy, setBusy] = useState(false);
  const choose = (i: number) => {
    unlockAudio();
    setIndex(i);
    squeak(i, 0.12);
  };
  const duck = DUCKS[index],
    useCode = mode === 'code';
  const submit = async () => {
    if (mode === 'code') await onJoin(name, index, room);
    else await onRandomJoin(name, index);
  };
  const label = busy
    ? mode === 'code'
      ? 'Hopping in…'
      : 'Finding your flock…'
    : mode === 'code'
      ? 'Join this room'
      : 'Join a random room';
  return (
    <main className="entry-screen">
      <header className="entry-top">
        <span className="brand-mini">
          duck off<span>!</span>
        </span>
        <span className="live-pill">
          <i /> a little friendly rivalry
        </span>
      </header>
      <div className="entry-content">
        <div className="entry-heading">
          <div className="eyebrow">TINY DUCKS. BIG HEART.</div>
          <h1 className="logo">
            duck off<span>!</span>
          </h1>
          <p>Your new favourite little race.</p>
          <div className="tagline">Pick a friend. Bring your friends. Make a splash.</div>
        </div>
        <section className="entry-card" aria-label="Choose your duck and room">
          <div className="character-pane">
            <div className="card-heading">
              <span>MEET YOUR LITTLE DUCK</span>
              <span>
                {String(index + 1).padStart(2, '0')} / {String(DUCK_COUNT).padStart(2, '0')}
              </span>
            </div>
            <div className="picker">
              <div className="preview-water">
                <DuckPreview index={index} spinnable />
              </div>
              <button
                className="arrow prev"
                aria-label="Previous duck"
                onClick={() => choose((index + DUCK_COUNT - 1) % DUCK_COUNT)}
              >
                ‹
              </button>
              <button className="arrow next" aria-label="Next duck" onClick={() => choose((index + 1) % DUCK_COUNT)}>
                ›
              </button>
              <span className="spin-hint" aria-hidden="true">
                ↔ drag to twirl
              </span>
              <span className="toy-sticker" key={index} aria-hidden="true">
                {duck.sticker.split(' ').map((word, i) => (
                  <b key={i}>{word}</b>
                ))}
              </span>
            </div>
            <div className="character-info" aria-live="polite">
              <h2>{duck.name}</h2>
              <span>{duck.tagline}</span>
              <span className="visually-hidden">{duck.sticker}</span>
            </div>
            <div className="picker-dots" aria-label="Duck characters">
              {DUCKS.map((d, i) => (
                <button
                  key={d.name}
                  aria-label={d.name}
                  aria-pressed={i === index}
                  onClick={() => choose(i)}
                  className={i === index ? 'selected' : ''}
                >
                  <span />
                </button>
              ))}
            </div>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              unlockAudio();
              squeak(index);
              setBusy(true);
              try {
                await submit();
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="duck-name">Your duck’s name</label>
            <div className="name-input">
              <input
                id="duck-name"
                placeholder="e.g. Waddles"
                maxLength={14}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
                enterKeyHint={useCode ? 'next' : 'go'}
              />
              <span>{name.length}/14</span>
            </div>
            {useCode && (
              <>
                <label className="room-label" htmlFor="room-code">
                  Room code <span>Same code, same lagoon.</span>
                </label>
                <div className="name-input">
                  <input
                    id="room-code"
                    value={room}
                    placeholder="e.g. SUNNY-DUCKS"
                    maxLength={16}
                    pattern="[A-Za-z0-9\-]{1,16}"
                    required
                    onChange={(e) => setRoom(e.target.value.toUpperCase())}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    enterKeyHint="go"
                  />
                </div>
                <p className="room-help">An unused code opens a brand new room. Rooms hold up to 12 ducks.</p>
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {label} <span aria-hidden="true">↗</span>
            </button>
            <button
              type="button"
              className="secondary solo-button"
              disabled={busy}
              onClick={async () => {
                unlockAudio();
                squeak(index);
                setBusy(true);
                try {
                  await onSolo(name, index);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Practice alone <small>dodge everything on the river</small>
            </button>
            <div className="mode-links">
              <button
                type="button"
                className="text-button room-mode"
                disabled={busy}
                onClick={() => setMode(useCode ? 'random' : 'code')}
              >
                {useCode ? 'Join a random room instead' : 'Have a room code?'}
              </button>
            </div>
            <p className="entry-note">
              {mode === 'code'
                ? 'Share the code with friends. Start when you’re ready.'
                : 'We’ll find a room with other ducks somewhere in the world. If the river is quiet, you’ll open one for the next duck to find.'}
            </p>
          </form>
        </section>
      </div>
      <footer className="entry-footer">
        <span>Made for little moments together.</span>
        {stats && stats.players > 0 && (
          <span className="flock-count">
            🦆 {stats.players.toLocaleString()} {stats.players === 1 ? 'duck has' : 'ducks have'} raced ·{' '}
            {(stats.races + stats.soloRuns).toLocaleString()} {stats.races + stats.soloRuns === 1 ? 'race' : 'races'}
          </span>
        )}
        <span>Sound on for tiny squeaks ♫</span>
      </footer>
    </main>
  );
}
