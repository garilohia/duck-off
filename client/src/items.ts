export const LANES = 5;
/** Steer-only build (the `steer-only` branch flips this): no paddle button, ducks swim on their own. Must match AUTO_CRUISE on the server. */
export const STEER_ONLY = false;
export const TRACK = 2400;
/** World x for a lane; the river is 32 units wide, so five lanes sit 4.5 apart. */
export const laneX = (lane: number) => (lane - (LANES - 1) / 2) * 4.5;
export const ITEMS: Record<string, { name: string; icon: string; hint: string }> = {
  bomb: { name: 'Splash bomb', icon: '💣', hint: 'Splash the nearest rival and nearby ducks for 2.5s.' },
  bubble: { name: 'Homing bubble', icon: '🫧', hint: 'Chase the next duck ahead and slow them for 1.8s. Leading? It floats behind you as a trap.' },
  turbo: { name: 'Rocket rush', icon: '🚀', hint: 'Go 55% faster for 3s. Clears a slowdown.' },
  shield: { name: 'Bubble shield', icon: '🛡', hint: 'Blocks the next hit, for up to 15s. Clears a slowdown.' },
};
export const OBSTACLES: Record<string, { name: string; icon: string; hint: string }> = {
  rock: { name: 'Rocks', icon: '🪨', hint: 'A hard bonk: most of your speed is gone for 1.5s. Swerve around it.' },
  log: { name: 'Logs', icon: '🪵', hint: 'A soft bonk: a small wobble for 1s. A bubble shield takes any hit for you.' },
  whirlpool: { name: 'Whirlpool', icon: '🌀', hint: 'Glub. A duck that paddles into it goes under and is out of the race. One per river, always in one lane. Shields save you.' },
  tackle: { name: 'Tackles', icon: '💥', hint: 'Hop into a lane right beside a rival to shove them: they wobble for 1.2s, you lose a little pace.' },
  draft: { name: 'Slipstream', icon: '💨', hint: 'Tuck in close behind a duck in your lane and you swim 12% faster.' },
};
