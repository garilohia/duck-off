export const PICKUPS = [180, 650, 1120, 1590, 2060];
export const ITEMS: Record<string, { name: string; icon: string; hint: string }> = {
  bomb: { name: 'Splash bomb', icon: '💣', hint: 'Splash the nearest rival and nearby ducks for 2.5s.' },
  bubble: { name: 'Homing bubble', icon: '🫧', hint: 'Chase the next duck ahead. Slow them for 1.8s.' },
  turbo: { name: 'Rocket rush', icon: '🚀', hint: 'Go 55% faster for 3s. Clears a slowdown.' },
  shield: { name: 'Bubble shield', icon: '🛡', hint: 'Block one hit for 6s. Clears a slowdown.' },
};
