import { useEffect, useRef, useState } from 'react';
import { bonk, buzz, chime, crowdCheer, fanfare, glub, honk } from '../squeak';
import type { Race, RaceItem, RacePlayer, RaceResult } from '../module_bindings/types';

// Sounds, haptics and the confetti moment, all driven by rising edges in the server state.

function useRisingEdge(on: boolean, fire: () => void) {
  const was = useRef(on);
  useEffect(() => {
    if (on && !was.current) fire();
    was.current = on;
  }, [on, fire]);
}

type Options = { race: Race; mine?: RacePlayer; myItem?: RaceItem; myResult?: RaceResult; racing: boolean };

export function useRaceFeedback({ race, mine, myItem, myResult, racing }: Options) {
  const [celebrate, setCelebrate] = useState(false);
  const duck = mine?.duckIndex ?? 0;

  useRisingEdge(racing && !!mine?.boostTicksLeft, () => {
    honk(duck);
    buzz(30);
  });
  useRisingEdge(racing && !!myItem?.slowTicks, () => {
    bonk();
    buzz([30, 40, 30]);
  });
  useRisingEdge(racing && !!mine?.place, () => {
    fanfare(duck);
    buzz([40, 60, 80]);
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 4000);
  });
  useRisingEdge(racing && !!mine?.drowned, () => {
    glub(duck);
    buzz([60, 30, 60, 30, 120]);
  });
  // A little chime when a toy is grabbed.
  useRisingEdge(racing && !!myItem?.held, () => {
    chime();
    buzz(12);
  });
  // Confetti always comes with the crowd.
  useEffect(() => {
    if (celebrate) crowdCheer();
  }, [celebrate]);
  // The winner gets a shower on the podium too; every other phase change clears it.
  const won = race.status === 'finished' && myResult?.place === 1 && !race.forfeited;
  useEffect(() => {
    setCelebrate(won);
  }, [race.status, won]);

  return { celebrate };
}
