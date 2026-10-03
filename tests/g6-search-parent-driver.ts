import { createLocalSearch } from '../packages/backend/platform/search/public';
import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
if (process.argv[4] === 'watchdog-only') {
  const filename = path.join(process.argv[2], 'career.sqlite');
  const child = fork(process.argv[3], [], { execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  child.once('exit', (code, signal) => writeFileSync(filename + '.helper-exit', JSON.stringify({ code, signal })));
  child.send({ filename, hostParentPid: process.pid, request: { operation: 'local-search.query', owner: 'wiki', query: '中文' }, budget: { rows: 256, bytes: 262144, comparisons: 500000, results: 50, timeoutMs: 300 } });
  setInterval(() => {}, 1000); // No host timeout: the child must enforce its own deadline.
} else {
  const search = createLocalSearch(process.argv[2], process.argv[3], { budget: { timeoutMs: 5000 } });
  void search.search({ operation: 'local-search.query', owner: 'wiki', query: '中文' });
}
