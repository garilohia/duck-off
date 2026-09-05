# Duck Off

A tiny multiplayer duck race. Tap to paddle, grab item buoys, and race friends in a shared room or a random one.

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
