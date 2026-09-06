// Runs the integration suites against a disposable SpacetimeDB database: publish the module to a fresh
// name, run every suite against it, then delete it. Nothing touches the dev database or each other.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, '..');
const modulePath = path.resolve(here, '../../server/spacetimedb');
const server = process.env.TEST_STDB_SERVER ?? 'http://127.0.0.1:3030';
const uri = process.env.TEST_STDB_URI ?? server.replace(/^http/, 'ws');
const database = process.env.TEST_STDB_MODULE ?? `duckoff-test-${Date.now().toString(36)}`;
const suites = process.argv.slice(2).length ? process.argv.slice(2) : ['hosts', 'items', 'random', 'multiplayer'];

const run = (cmd, args, extraEnv = {}) =>
  spawnSync(cmd, args, { stdio: 'inherit', cwd: clientDir, env: { ...process.env, ...extraEnv } }).status ?? 1;

console.log(`Publishing module to ${database} on ${server}`);
if (
  run('spacetime', ['publish', '--server', server, '--module-path', modulePath, database, '--delete-data=always', '-y']) !== 0
) {
  console.error('Could not publish the module. Is `spacetime start --listen-addr 0.0.0.0:3030` running?');
  process.exit(1);
}

let failed = false;
for (const suite of suites) {
  console.log(`\n=== ${suite}`);
  const status = run('npx', ['tsx', `tests/${suite}.ts`], { TEST_STDB_URI: uri, TEST_STDB_MODULE: database });
  if (status !== 0) {
    failed = true;
    console.error(`--- ${suite} failed (exit ${status})`);
    break;
  }
}

if (!process.env.TEST_STDB_MODULE) {
  console.log(`\nDeleting ${database}`);
  run('spacetime', ['delete', '--server', server, database, '-y']);
}
process.exit(failed ? 1 : 0);
