export const LANES = 5;
export const TRACK = 2400;
/** World x for a lane; the river is 32 units wide, so five lanes sit 4.5 apart. */
export const laneX = (lane: number) => (lane - (LANES - 1) / 2) * 4.5;
export const ITEMS: Record<string, { name: string; icon: string; hint: string }> = {
  bomb: { name: 'Splash bomb', icon: '💣', hint: 'Splash the nearest rival and nearby ducks for 2.5s.' },
  bubble: { name: 'Homing bubble', icon: '🫧', hint: 'Chase the next duck ahead. Slow them for 1.8s.' },
  turbo: { name: 'Rocket rush', icon: '🚀', hint: 'Go 55% faster for 3s. Clears a slowdown.' },
  shield: { name: 'Bubble shield', icon: '🛡', hint: 'Block one hit for 6s. Clears a slowdown.' },
};
export const OBSTACLES: Record<string, { name: string; hint: string }> = {
  rock: { name: 'Rocks', hint: 'Bump one and you lose most of your speed for 1.5s. Swerve around it.' },
  log: { name: 'Logs', hint: 'Same bonk as a rock, just floatier. A bubble shield takes the hit for you.' },
};
