import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';
import { probeTransaction } from './sqlite';

// Slow SQLite stays off the utilityProcess control loop.
async function run() {
if (workerData.slow) {
  const database = new Database(workerData.filename, { readonly: true });
  database.function('g0_pause', () => {
    parentPort!.postMessage({ running: true });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3_000);
    return 1;
  });
  database.prepare('SELECT g0_pause()').get();
  database.close();
  parentPort!.postMessage({ finished: true });
} else {
  let queue = Promise.resolve();
  parentPort!.on('message', (job: { write: boolean }) => {
    queue = queue.then(async () => {
      const result = await probeTransaction(workerData.filename, job.write);
      parentPort!.postMessage({ count: result.count, sqlite: result.sqlite.version });
    }).catch(() => { parentPort!.postMessage({ error: 'G0_SQL_FAILED' }); });
  });
}

}
void run().catch(() => { process.exitCode = 1; });
