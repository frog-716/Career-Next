import { runLocalSearch } from './query';
import type { ReadProcessInput } from './client';
import { runReadWatchdog, startReadWatchdog } from './watchdog';
// The script is fixed; only validated bounded search DTOs reach this process.
const parent = (process as typeof process & { parentPort?: { on(event: 'message', callback: (event: { data: unknown }) => void): void; postMessage(value: unknown): void } }).parentPort;
function search(input: ReadProcessInput) {
  startReadWatchdog(input.hostParentPid, input.budget.timeoutMs);
  let result: unknown;
  try { result = runLocalSearch(input.filename, input.request, input.budget); }
  catch { result = { kind: 'local-search.failure', code: 'index_unavailable', partial: true, notice: '结果未完整检索' }; }
  if (parent) parent.postMessage(result);
  else process.send?.(result, () => process.exit(0));
}
if (!runReadWatchdog()) {
  // Before native SQL begins the ordinary event loop can handle a lost launcher.
  process.once('disconnect', () => process.exit(0));
  if (parent) parent.on('message', event => search(event.data as ReadProcessInput));
  else process.once('message', value => search(value as ReadProcessInput));
}
