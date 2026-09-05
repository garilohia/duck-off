# Duck Off

A tiny multiplayer duck race. Tap to paddle, swipe (or ◀ ▶ / arrow keys) to hop between five lanes, steer into ? buoys for toys, dodge rocks and logs, ride the rapids, and race friends in a shared room or a random one. The race is one-dimensional on the server (`pos` along a 2400-unit track, lanes are a column); the client bends the river with `client/src/three/river.ts`. Each race stores its buoys/obstacles/rapids in the `race_feature` table (`trackLayout` in `server/spacetimedb/src/items.ts`). Rooms hold up to 12 ducks (`MAX_DUCKS` in `server/spacetimedb/src/items.ts`); the picker has 10 characters (`DUCK_COUNT`, mirrored by `DUCKS` in `client/src/palette.ts`).

- `client/` – Next.js static export (React Three Fiber scene, SpacetimeDB React SDK). Deploys to Vercel from `main`; no env vars needed.
- `server/spacetimedb/` – SpacetimeDB TypeScript module: rooms, matchmaking, race ticks, items. Live database: `duckoff-rooms-gari-20260905` on maincloud.
- `client/tests/` – integration tests that drive real clients against a local SpacetimeDB.

## Develop

```bash
npm run server          # local SpacetimeDB on :3030 (data in .stdb-data)
npm run publish:local   # publish the module to the local "duckoff" database
npm run dev             # Next dev server; connects to ws://localhost:3030/duckoff
```

After changing the module, run `npm run generate` to refresh `client/src/module_bindings`.

## Test

Publish the module to the local test databases first, then run everything:

```bash
spacetime publish --server http://127.0.0.1:3030 --module-path server/spacetimedb duckoff-mobile -y
spacetime publish --server http://127.0.0.1:3030 --module-path server/spacetimedb duckoff-items -y
npm test
```

## Ship

- Site: push to `main`; Vercel builds `client/` via the root `vercel.json`.
- Server: `npm run publish:live` publishes the module to the live maincloud database.
