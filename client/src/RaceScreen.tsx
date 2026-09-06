import { useCallback, useEffect, useRef, useState } from 'react';
import RaceScene from './three/RaceScene';
import DuckPreview from './three/DuckPreview';
import RubberDuck from './RubberDuck';
import Confetti from './race/Confetti';
import HowTo from './race/HowTo';
import { touchDevice, useRaceInput } from './race/useRaceInput';
import { useRaceFeedback } from './race/useRaceFeedback';
import { ordinal, DUCK_COLORS } from './palette';
import { squeak, unlockAudio, setMuted, isMuted, buzz } from './squeak';
import { ITEMS, TRACK, STEER_ONLY } from './items';
import { PREF, readFlag, writeFlag } from './storage';
import type { Player, Race, RacePlayer, RaceResult, RaceItem, ItemEffect, RaceFeature } from './module_bindings/types';

type Props = {
  race: Race;
  players: readonly RacePlayer[];
  legends: readonly Player[];
  results: readonly RaceResult[];
  items: readonly RaceItem[];
  effects: readonly ItemEffect[];
  features: readonly RaceFeature[];
  identity: string;
  onTap: (count: number) => Promise<void>;
  onSteer: (amount: number) => Promise<void>;
  onSwitchLane: (direction: number) => Promise<void>;
  onStart: () => Promise<void>;
  onUseItem: () => Promise<void>;
  onLeave: () => void;
};

const percent = (pos: number) => Math.floor(pos / (TRACK / 100));
const bonks = (n: number) => `${n} ${n === 1 ? 'bonk' : 'bonks'}`;
const hex = (p: { identity: { toHexString(): string } }) => p.identity.toHexString();

export default function RaceScreen(props: Props) {
  const { race, players, legends, results, items, effects, features, identity, onStart, onUseItem, onLeave } = props;
  const [muted, updateMuted] = useState(isMuted);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showRanks, setShowRanks] = useState(false);
  const [usingItem, setUsingItem] = useState(false);
  const [showHowTo, setShowHowTo] = useState(() => !readFlag(PREF.howTo));
  const itemPending = useRef(false);

  const touch = touchDevice();
  const mine = players.find((p) => hex(p) === identity);
  const myItem = items.find((p) => hex(p) === identity);
  const myResult = results.find((p) => hex(p) === identity);
  const held = ITEMS[myItem?.held ?? ''];
  const racing = race.status === 'racing';
  const countdown = race.status === 'countdown';
  const finished = race.status === 'finished';
  const spectator = !mine?.active;
  const drowned = !!mine?.drowned;
  const canDrive = (racing || countdown) && !spectator && !mine?.place && !drowned;
  const isHost = race.hostIdentity === identity;
  const hostName = legends.find((p) => hex(p) === race.hostIdentity)?.name || 'the host';
  const secs = Math.ceil(race.phaseTicksLeft / 10);
  const online = legends.filter((p) => p.online);
  const active = players.filter((p) => p.active);
  const standings = [...active].sort((a, b) => a.rank - b.rank);
  const orderedResults = [...results].sort((a, b) => a.place - b.place);
  const leaders = [...legends]
    .filter((p) => p.racesWon > 0)
    .sort((a, b) => b.racesWon - a.racesWon || (hex(a) < hex(b) ? -1 : 1))
    .slice(0, 3);

  const useItem = useCallback(async () => {
    if (!racing || spectator || mine?.place || drowned || !myItem?.held || itemPending.current) return;
    itemPending.current = true;
    setUsingItem(true);
    unlockAudio();
    try {
      await onUseItem();
      squeak(mine?.duckIndex ?? 0, 0.2);
      buzz(15);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your item missed. Try again.');
    } finally {
      itemPending.current = false;
      setUsingItem(false);
    }
  }, [racing, spectator, mine, drowned, myItem?.held, onUseItem]);

  const { tap, switchLane, combo, motionGranted, armMotion } = useRaceInput({
    mine,
    racing,
    canDrive,
    spectator,
    onTap: props.onTap,
    onSteer: props.onSteer,
    onSwitchLane: props.onSwitchLane,
    useItem,
    onError: setError,
  });
  const { celebrate } = useRaceFeedback({ race, mine, myItem, myResult, racing });

  useEffect(() => {
    setShowRanks(false);
    setError('');
  }, [race.status]);

  const url = new URL(location.href);
  url.searchParams.set('room', race.id);
  const shareRoom = async () => {
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
    } catch {
      setShowLink(true);
    }
  };
  const start = async () => {
    unlockAudio();
    void armMotion();
    setStarting(true);
    setError('');
    try {
      await onStart();
    } catch {
      setError('Couldn’t start just yet. Please try again.');
    } finally {
      setStarting(false);
    }
  };
  const dismissHowTo = useCallback(() => {
    setShowHowTo(false);
    writeFlag(PREF.howTo, true);
    unlockAudio();
    void armMotion();
  }, [armMotion]);

  const startButton = isHost ? (
    <button className="primary start-button" disabled={starting} onClick={start}>
      {starting ? 'Gathering the ducks…' : finished ? 'Play again' : 'Start race'} <span aria-hidden="true">↗</span>
    </button>
  ) : (
    <p className="panel-note" role="status">
      Waiting for {hostName} to {finished ? 'start the next race' : 'start the race'}.
    </p>
  );

  const hint = myItem?.slowTicks
    ? `Bonk! Half speed · ${(myItem.slowTicks / 10).toFixed(1)}s`
    : myItem?.shieldTicks
      ? `Shield ready · ${(myItem.shieldTicks / 10).toFixed(1)}s`
      : myItem?.turboTicks
        ? `Rocket rush! · ${(myItem.turboTicks / 10).toFixed(1)}s`
        : held
          ? `${held.name} ready: ${held.hint}`
          : STEER_ONLY
            ? touch
              ? 'Tilt to steer. Grab a toy, dodge the rocks.'
              : '← → to steer. Grab a toy, dodge the rocks.'
            : touch
              ? 'Tap anywhere to paddle · tilt to steer'
              : 'Tap anywhere to paddle · ← → to steer';

  const controls = spectator ? (
    <div className="waiting-message surface">
      <h2>Your turn is coming.</h2>
      <p>Enjoy the splashes. You’re in the next one.</p>
    </div>
  ) : drowned ? (
    <div className="waiting-message surface">
      <h2>Glub. The whirlpool got you.</h2>
      <p>Your duck is fine, just very upside down. Cheer the others home.</p>
    </div>
  ) : mine?.place ? (
    <div className="waiting-message surface">
      <h2>A {ordinal(mine.place)} place splash!</h2>
      <p>Let’s cheer the others home.</p>
    </div>
  ) : (
    <>
      <div className="progress-info">
        <span>{percent(mine?.pos ?? 0)}% of the way</span>
        <span>
          {mine?.boostTicksLeft
            ? 'A little extra whoosh!'
            : STEER_ONLY
              ? 'Ride the rapids for a whoosh'
              : `${mine?.boostMeter ?? 0}/20 to a boost`}
        </span>
      </div>
      {!STEER_ONLY && (
        <div
          className={`boost-track ${mine?.boostTicksLeft || myItem?.turboTicks ? 'boosting' : ''}`}
          role="progressbar"
          aria-label="Boost meter"
          aria-valuemin={0}
          aria-valuemax={20}
          aria-valuenow={mine?.boostTicksLeft ? 20 : (mine?.boostMeter ?? 0)}
        >
          <div style={{ width: `${mine?.boostTicksLeft ? 100 : (mine?.boostMeter ?? 0) * 5}%` }} />
        </div>
      )}
      <p className="item-hint">{hint}</p>
    </>
  );

  const resultsActions = (
    <div className="results-actions">
      {startButton}
      <button className="text-button" onClick={onLeave}>
        Back to main menu
      </button>
      <span className="panel-note">The host starts the next race when everyone is ready.</span>
    </div>
  );

  const resultMessage = !myResult
    ? 'Your little duck is up next.'
    : myResult.drowned
      ? `The whirlpool took you at ${percent(myResult.pos)}%. ${ordinal(myResult.place)} place, and a very good story.`
      : race.solo
        ? myResult.pos >= TRACK
          ? `${myResult.seconds.toFixed(1)} seconds down the river${
              myResult.bonks ? ` with ${bonks(myResult.bonks)}. Smoother next time?` : ' without touching a thing. Perfect.'
            }`
          : `${percent(myResult.pos)}% of the river before the buzzer. Keep paddling!`
        : `You splashed into ${ordinal(myResult.place)}. ${myResult.place === 1 ? 'Look at you go!' : 'Your duck is proud of you.'}`;

  const soloHeadline =
    (orderedResults[0]?.pos ?? 0) >= TRACK
      ? orderedResults[0]?.bonks
        ? bonks(orderedResults[0].bonks)
        : 'Clean run!'
      : 'Ran out of river';

  return (
    <main
      className={`race-screen phase-${race.status}`}
      data-phase={race.status}
      onPointerDown={(e) => {
        if (!(e.target instanceof Element)) return;
        if (e.target.closest('button,input,a,details,.results-scroll,.live-standings,.howto,.share-fallback,.connection-warning'))
          return;
        if (STEER_ONLY) {
          if (e.isPrimary) switchLane(e.clientX < window.innerWidth / 2 ? -1 : 1);
        } else tap();
      }}
    >
      <div className="river-fallback" aria-hidden="true">
        <div className="fallback-racers">
          {active.map((p, i) => (
            <span
              key={hex(p)}
              style={{ left: `${8 + (i / Math.max(active.length, 1)) * 80}%`, bottom: `${10 + (p.pos / TRACK) * 65}%` }}
            >
              <RubberDuck size={40} />
              <small>{p.name}</small>
            </span>
          ))}
        </div>
      </div>
      <div className="scene-layer">
        <RaceScene race={race} players={players} items={items} effects={effects} features={features} identity={identity} />
      </div>
      {celebrate && <Confetti />}
      {racing && !spectator && !drowned && !mine?.place && held && (
        <button
          className="toy-fab has-item"
          disabled={usingItem}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => void useItem()}
          aria-label={`Use ${held.name}`}
          title={held.hint}
        >
          <span aria-hidden="true">{held.icon}</span>
          <b>{usingItem ? '…' : held.name}</b>
        </button>
      )}
      {showHowTo && !finished && <HowTo touch={touch} motionGranted={motionGranted} onDismiss={dismissHowTo} />}
      <header className="race-header">
        <div className="race-brand">
          <button className="brand-mini brand-home" aria-label="Back to the home screen" onClick={onLeave}>
            duck off<span>!</span>
          </button>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label={muted ? 'Unmute squeaks' : 'Mute squeaks'}
            onClick={() => {
              unlockAudio();
              updateMuted(!muted);
              setMuted(!muted);
            }}
          >
            {muted ? '♪̸' : '♫'}
          </button>
        </div>
      </header>
      {!finished && (
        <div className="room-strip">
          <span>
            ROOM <b>{race.id}</b>
          </span>
          <button onClick={shareRoom}>{copied ? 'Copied ✓' : 'Invite friends ↗'}</button>
        </div>
      )}
      {showLink && (
        <div className="share-fallback">
          <label htmlFor="share-link">Copy this room link</label>
          <input id="share-link" readOnly value={url.toString()} onFocus={(e) => e.target.select()} />
          <button className="text-button" onClick={() => setShowLink(false)}>
            Done
          </button>
        </div>
      )}
      {race.status === 'lobby' && (
        <section className="lobby-panel surface">
          <div className="eyebrow">{race.mode === 'practice' ? 'YOUR PRACTICE RIVER' : 'THE FLOCK IS GATHERING'}</div>
          <h1>Everyone here?</h1>
          <p>
            {isHost
              ? 'Invite your friends. Press Start race when everyone is here.'
              : `${hostName} is hosting. The race starts when they press Start race.`}
          </p>
          <div className="roster" aria-label="Players in the room">
            {online.map((p) => (
              <span key={hex(p)}>
                <i style={{ background: DUCK_COLORS[p.duckIndex] }} aria-hidden="true">
                  ♥
                </i>
                {p.name}
                {hex(p) === identity && <small>you</small>}
                {hex(p) === race.hostIdentity && <small>host</small>}
              </span>
            ))}
          </div>
          {startButton}
          <span className="panel-note">
            {online.length} {online.length === 1 ? 'duck' : 'ducks'} ready · only the host can start
          </span>
          <button type="button" className="text-button" onClick={() => setShowHowTo(true)}>
            How to play
          </button>
        </section>
      )}
      {countdown && (
        <section className="countdown-overlay" aria-live="assertive">
          <p>{spectator ? 'You’ll join the next race' : 'Pick your lane. Little wings at the ready…'}</p>
          <strong key={secs}>{secs}</strong>
          <span>
            {STEER_ONLY
              ? touch
                ? 'Your duck swims by itself · tilt, swipe or tap a side to steer'
                : 'Your duck swims by itself · ← → to steer'
              : touch
                ? 'Tap to paddle · tilt or swipe to dodge rocks and logs'
                : 'Tap to paddle · ← → to dodge rocks and logs'}
          </span>
        </section>
      )}
      {racing && (
        <>
          <section className="race-status">
            <span className="status-pill">
              {spectator
                ? 'CHEERING SECTION'
                : mine?.place
                  ? `${ordinal(mine.place)} · FINISHED`
                  : drowned
                    ? 'GLUB · OUT'
                    : `${ordinal(mine?.rank || 1)} of ${active.length}`}
            </span>
            <button className="status-pill" onClick={() => setShowRanks(!showRanks)} aria-expanded={showRanks}>
              {showRanks ? 'Close standings' : 'Standings'} {showRanks ? '×' : '↗'}
            </button>
            <span className="status-pill timer">{secs}s</span>
          </section>
          {showRanks && (
            <section className="live-standings surface" aria-label="Live standings">
              <h2>Little league leaders</h2>
              <ol>
                {standings.map((p) => (
                  <li key={hex(p)} className={hex(p) === identity ? 'is-you' : ''}>
                    <b>{p.rank}</b>
                    <span>
                      {p.name}
                      {hex(p) === identity ? ' (you)' : ''}
                    </span>
                    <small>{p.place ? 'Finished' : p.drowned ? 'Glub' : `${percent(p.pos)}%`}</small>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {race.phaseTicksLeft > 390 && !showRanks && (
            <div className="go-flash" aria-live="polite">
              GO!
            </div>
          )}
          {combo >= 5 && !mine?.place && (
            <div className="combo" key={combo} aria-live="off">
              ×{combo}
              <small>combo</small>
            </div>
          )}
          <section className="race-controls">{controls}</section>
        </>
      )}
      {finished && race.forfeited && (
        <div className="results-scroll">
          <section className="results-card surface" aria-label="Race forfeited">
            <div className="eyebrow">A VERY QUIET LITTLE RIVER</div>
            <h1>
              {race.forfeitReason === 'drowned'
                ? 'The river wins'
                : race.forfeitReason === 'empty'
                  ? 'Everyone wandered off'
                  : 'Race forfeited'}
            </h1>
            <div className="winner-portrait">
              <DuckPreview index={mine?.duckIndex ?? 0} spinnable />
            </div>
            <p className="result-message">
              {race.forfeitReason === 'drowned'
                ? 'The whirlpool got every duck before anyone reached the line. No winner this time, just a lot of bubbles.'
                : race.forfeitReason === 'empty'
                  ? 'All the racers left the river, so there is nothing to score.'
                  : 'Nobody paddled for 15 seconds, so there is no winner this time. The ducks are just bobbing.'}
            </p>
            {resultsActions}
          </section>
        </div>
      )}
      {finished && !race.forfeited && (
        <div className="results-scroll">
          <section className="results-card surface" aria-label="Race results">
            <div className="eyebrow">{race.solo ? 'A VERY GOOD PRACTICE RUN' : 'A VERY GOOD LITTLE RACE'}</div>
            <h1>{race.solo ? soloHeadline : `${orderedResults[0]?.name ?? race.winnerName} wins!`}</h1>
            <div className="winner-portrait">
              <DuckPreview index={orderedResults[0]?.duckIndex ?? race.winnerDuckIndex} spinnable />
              <span className="winner-medal">1</span>
            </div>
            <p className="result-message">{resultMessage}</p>
            <ol className="results-list" aria-label="Final rankings">
              {orderedResults.map((p) => (
                <li key={p.id} data-place={p.place} className={hex(p) === identity ? 'is-you' : ''}>
                  <b className="result-place">{p.place <= 3 ? ['①', '②', '③'][p.place - 1] : p.place}</b>
                  <span className="result-name">
                    {p.name}
                    {hex(p) === identity && <small>you</small>}
                    <em>
                      {p.pos >= TRACK
                        ? 'Crossed the line'
                        : p.drowned
                          ? `Went under at ${percent(p.pos)}%`
                          : `${percent(p.pos)}% at the buzzer`}
                    </em>
                  </span>
                  <span className="result-taps">
                    {p.pos >= TRACK ? `${p.seconds.toFixed(1)}s` : p.taps}
                    <small>{p.pos >= TRACK ? (p.bonks ? bonks(p.bonks) : 'clean run') : 'taps'}</small>
                  </span>
                </li>
              ))}
            </ol>
            <p className="ranking-note">
              Finishers first. At the buzzer, remaining ducks are ranked by distance, then anyone the whirlpool took. Exact ties
              use a fixed order.
            </p>
            <section className="legends" aria-label="Flock legends">
              <h2>Flock legends</h2>
              <p>Lifetime wins · ducks in this room</p>
              {leaders.length ? (
                <ol>
                  {leaders.map((p) => (
                    <li key={hex(p)}>
                      <span>{p.name}</span>
                      <b>
                        {p.racesWon} {p.racesWon === 1 ? 'win' : 'wins'}
                      </b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>The first little legend is on the way.</p>
              )}
            </section>
            {resultsActions}
          </section>
        </div>
      )}
      {error && (
        <div className="connection-warning" role="alert">
          <span>{error}</span>
          <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
    </main>
  );
}
