# Duck Off

A tiny multiplayer duck race. Tap to paddle, tilt your phone to slide fluidly across five lanes (hold the arrow keys on a computer, or swipe to nudge a whole lane), shake to use a toy, steer into ? buoys for toys, dodge rocks (hard bonk), logs (soft bonk) and the one whirlpool per river (you're out), shove rivals by barging into their lane, slipstream behind a duck in your lane, ride the rapids, and race friends in a shared room or a random one. A race with no movement for 15 seconds, no racers left, or nobody left swimming is forfeited with no winner.

Two builds share this code: `main` is the tapping game; the `steer-only` branch flips `AUTO_CRUISE` (server) and `STEER_ONLY` (client) so ducks swim on their own and you only steer, and points at its own live database. The race is one-dimensional on the server (`pos` along a 2400-unit track, lanes are a column); the client bends the river with `client/src/three/river.ts`. Each race stores its buoys/obstacles/rapids in the `race_feature` table (`trackLayout` in `server/spacetimedb/src/items.ts`). A leading duck's homing bubble is left behind as a trap, shields last until hit (15s cap), and item draws get a random nudge each race. Rooms hold up to 12 ducks (`MAX_DUCKS` in `server/spacetimedb/src/items.ts`); the picker has 10 characters (`DUCK_COUNT`, mirrored by `DUCKS` in `client/src/palette.ts`).

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

The tests drive real clients against the local `duckoff` database (the same one the dev server uses). `npm test` republishes the module there with a data wipe first, so any open dev-server tabs will be kicked back to the home screen:

```bash
npm test
```

## Ship

- Site: push to `main`; Vercel builds `client/` via the root `vercel.json`.
- Server: `npm run publish:live` publishes the module to the live maincloud database.
