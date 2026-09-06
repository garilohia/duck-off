import { useEffect, useRef } from 'react';
import { STEER_ONLY } from '../items';

type Props = { touch: boolean; motionGranted: boolean; onDismiss: () => void };

// The instructions modal. It takes focus when it opens, keeps Tab inside itself, closes on Escape,
// and hands focus back to whatever opened it.
export default function HowTo({ touch, motionGranted, onDismiss }: Props) {
  const card = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    const focusable = () => [
      ...(card.current?.querySelectorAll<HTMLElement>('button,[href],input,[tabindex]:not([tabindex="-1"])') ?? []),
    ];
    card.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === card.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [onDismiss]);

  return (
    <div className="howto" role="dialog" aria-modal="true" aria-labelledby="howto-title">
      <section className="howto-card surface" ref={card} tabIndex={-1}>
        <div className="eyebrow">BEFORE YOU PADDLE</div>
        <h1 id="howto-title">How to play</h1>
        <ul>
          {STEER_ONLY ? (
            <li>
              <b>Your duck swims by itself.</b>
              <span>The river carries you; rapids and slipstreams carry you faster.</span>
            </li>
          ) : (
            <li>
              <b>Tap anywhere to paddle.</b>
              <span>Faster taps, faster duck. Twenty taps fill a boost.</span>
            </li>
          )}
          <li>
            <b>{touch ? 'Tilt your phone to steer.' : 'Hold ← → to steer.'}</b>
            <span>
              {touch
                ? 'Lean left or right and your duck slides across the river. A swipe nudges you a whole lane.'
                : 'You slide across the river while a key is held.'}
            </span>
          </li>
          {touch && (
            <li>
              <b>Turn off auto-rotate.</b>
              <span>Tilting works in portrait. Lock your screen rotation so the phone does not flip to landscape mid-race.</span>
            </li>
          )}
          <li>
            <b>Dodge rocks, logs and the whirlpool.</b>
            <span>Rocks and logs knock your speed. The whirlpool pulls you under and you are out of the race.</span>
          </li>
          <li>
            <b>Ride the white rapids.</b>
            <span>A free whoosh.</span>
          </li>
          <li>
            <b>Rockets and shields work on pickup.</b>
            <span>
              Swim into one and it is on: a rocket makes you 55% faster for 3s, a shield blocks the next hit for up to 15s.
            </span>
          </li>
          <li>
            <b>Bombs and bubbles wait for your moment.</b>
            <span>
              A toy button appears on the right{touch ? ' (or shake the phone)' : ''}. The bomb flies at the nearest duck ahead
              and splashes everyone near them. The bubble chases the duck ahead and slows them, or floats behind you as a trap if
              you are leading.
            </span>
          </li>
          <li>
            <b>Barge into a rival.</b>
            <span>Slide into a duck beside you and they wobble. A shield blocks any hit.</span>
          </li>
          <li>
            <b>Leave whenever you like.</b>
            <span>The Leave button at the top right (or the duck off! logo) takes you back to the home screen.</span>
          </li>
        </ul>
        {touch && !motionGranted && (
          <p className="howto-note">Allow motion access when asked, that is what makes tilt steering work.</p>
        )}
        <button className="primary" onClick={onDismiss}>
          Got it <span aria-hidden="true">↗</span>
        </button>
      </section>
    </div>
  );
}
