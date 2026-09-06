// Module entry: the schema is the default export; every reducer and lifecycle hook is re-exported by name.
// Gameplay constants live in items.ts, tables in schema.ts, presence in presence.ts, matchmaking and
// room lifecycle in rooms.ts, the race simulation in simulation.ts and scoring in scoring.ts.
export { default } from './schema';
export { onConnect, onDisconnect, heartbeat } from './presence';
export { join, joinRandom, startPractice, leaveRoom, startRace } from './rooms';
export { init, switchLane, steer, tap, useItem, tick } from './simulation';
