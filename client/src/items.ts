export const LANES = 5;
/** Steer-only build (the `steer-only` branch flips this): no paddle button, ducks swim on their own. Must match AUTO_CRUISE on the server. */
export const STEER_ONLY = false;
export const TRACK = 2400;
/** World x for a lane; the river is 32 units wide, so five lanes sit 4.5 apart. */
export const laneX = (lane: number) => (lane - (LANES - 1) / 2) * 4.5;
export const ITEMS: Record<string, { name: string; icon: string; hint: string; auto?: boolean }> = {
  bomb: { name: 'Splash bomb', icon: '💣', hint: 'Fire it and it flies at the nearest duck ahead, splashing everyone near them: half speed for 2.5s. Nobody ahead? It hits the duck behind you.' },
  bubble: { name: 'Homing bubble', icon: '🫧', hint: 'Fire it and it chases the duck ahead and slows them for 1.8s. Leading the pack? It floats behind you as a trap.' },
  turbo: { name: 'Rocket', icon: '🚀', hint: 'Works the moment you grab it: 55% faster for 3s and any slowdown is gone.', auto: true },
  shield: { name: 'Shield', icon: '🛡', hint: 'Works the moment you grab it: blocks the next hit, for up to 15s.', auto: true },
};
export const OBSTACLES: Record<string, { name: string; icon: string; hint: string }> = {
  rock: { name: 'Rocks', icon: '🪨', hint: 'A hard bonk: most of your speed is gone for 1.5s. Swerve around it.' },
  log: { name: 'Logs', icon: '🪵', hint: 'A soft bonk: a small wobble for 1s. A bubble shield takes any hit for you.' },
  whirlpool: { name: 'Whirlpool', icon: '🌀', hint: 'Glub. A duck that paddles into it goes under and is out of the race. One per river, always in one lane. Shields save you.' },
  tackle: { name: 'Tackles', icon: '💥', hint: 'Hop into a lane right beside a rival to shove them: they wobble for 1.2s, you lose a little pace.' },
  rapids: { name: 'Rapids', icon: '🌊', hint: 'The white water across two lanes. Ride it for an instant push and a short boost.' },
  draft: { name: 'Slipstream', icon: '💨', hint: 'Tuck in close behind a duck in your lane and you swim 12% faster.' },
};
