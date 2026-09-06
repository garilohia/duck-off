import type { NextConfig } from 'next';
import path from 'node:path';

// The client imports gameplay constants straight from the SpacetimeDB module (../server), so the
// bundler's root is the repository, not just this package.
const config: NextConfig = {
  output: 'export',
  reactStrictMode: false,
  images: { unoptimized: true },
  turbopack: { root: path.resolve(__dirname, '..') },
};
export default config;
