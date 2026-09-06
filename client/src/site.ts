const slogan = 'Race your friends';

export const site = {
  name: 'Duck Off',
  url: 'https://duckoff.fun',
  slogan,
  title: `Duck Off — ${slogan}`,
  description: 'Race rubber ducks with friends in your browser. Tap to paddle, dodge obstacles, and use toys to race ahead in a real-time multiplayer duck race.',
  themeColor: '#fce4d9',
  image: {
    url: '/opengraph-image',
    width: 1200,
    height: 630,
    alt: `Duck Off — ${slogan}, with a yellow rubber duck beside the title`,
  },
} as const;
