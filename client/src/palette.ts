export const PAL = {
  water: '#428fda',
  deep: '#2854c7',
  sand: '#fce4d9',
  pink: '#f27860',
  yellow: '#ffd02b',
  navy: '#173d72',
  beak: '#f58220',
  paper: '#fffdf5',
  foam: '#e2f3ff',
};
// name, description, sticker tag (the yellow badge on the picker). Keep DUCK_COUNT in sync with the server.
export type Duck = { name: string; tagline: string; sticker: string };
export const DUCKS: readonly Duck[] = [
  { name: 'Buttercup', tagline: 'a little pocket of sunshine', sticker: 'very huggable' },
  { name: 'Pudding', tagline: 'professional napper. amateur racer.', sticker: 'do not disturb' },
  { name: 'Skipper', tagline: 'tiny sailor. big feelings.', sticker: 'sea legs' },
  { name: 'Berry', tagline: 'berry small. berry brave.', sticker: 'pocket sized' },
  { name: 'Sprout', tagline: 'growing at their own pace', sticker: 'fresh leaf' },
  { name: 'Captain Pip', tagline: 'steals hearts, not treasure', sticker: 'sails at dawn' },
  { name: 'Mochi', tagline: 'soft on the outside. also inside.', sticker: '100% squish' },
  { name: 'Your Fluffiness', tagline: 'royally round', sticker: 'crown included' },
  { name: 'Chef Nibbles', tagline: 'slices cake, never hearts', sticker: 'chef’s kiss' },
  { name: 'Deputy Dumpling', tagline: 'keeps the peace. and the crumbs.', sticker: 'on patrol' },
];
export const DUCK_COUNT = DUCKS.length;
export const DUCK_COLORS = [
  '#ffcb0d',
  '#ffd21a',
  '#ffcc12',
  '#ffcf1c',
  '#ffd324',
  '#ffc70e',
  '#ffd52b',
  '#ffcd16',
  '#ffd11e',
  '#ffc914',
];
export function laneX(id: string) {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (((hash >>> 0) % 10000) / 10000) * 24 - 12;
}
export const ordinal = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`;
