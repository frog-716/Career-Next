import { fork } from 'node:child_process';
import path from 'node:path';
import { LocalSearchRequest, LocalSearchResult } from '../../../contracts/application/local-search';
export interface LocalSearchBudget { rows: number; bytes: number; comparisons: number; results: number; timeoutMs: number }
export const defaultLocalSearchBudget: LocalSearchBudget = { rows: 256, bytes: 256 * 1024, comparisons: 500000, results: 50, timeoutMs: 1500 };
export interface ReadProcessInput { filename: string; request: LocalSearchRequest; budget: LocalSearchBudget }
/** Trusted Main can replace Node fork with a fixed utilityProcess launcher. */
export interface ReadProcess {
  send(input: ReadProcessInput): void;
  onMessage(callback: (value: unknown) => void): void;
  onFailure(callback: () => void): void;
  terminate(): void;
  exited: Promise<void>;
}
export type ReadProcessSpawner = (fixedArtifact: string) => ReadProcess;
const spawnReadProcess: ReadProcessSpawner = fixedArtifact => {
  const child = fork(fixedArtifact, [], { execArgv: [], env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let resolveExit!: () => void;
  const exited = new Promise<void>(resolve => { resolveExit = resolve; });
  child.once('exit', resolveExit); child.once('error', resolveExit);
  return {
    send: input => child.send(input), onMessage: callback => child.on('message', callback),
    onFailure: callback => { child.on('error', callback); child.once('exit', callback); },
    terminate() { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, exited,
  };
};
/** Private process settings come from trusted bootstrap, never from the renderer. */
export function createLocalSearch(directory: string, workerArtifact = path.join(__dirname, 'local-search.cjs'), options?: { budget?: Partial<LocalSearchBudget>; spawn?: ReadProcessSpawner }) {
  const running = new Set<ReadProcess>(); let closed = false;
  const budget = { ...defaultLocalSearchBudget, ...options?.budget }, spawn = options?.spawn ?? spawnReadProcess;
  const failure = (code: 'invalid_request' | 'index_unavailable' | 'cancelled' | 'disconnected'): LocalSearchResult => ({ kind: 'local-search.failure', code, partial: true, notice: '结果未完整检索' });
  return {
    search(input: unknown, signal?: AbortSignal): Promise<LocalSearchResult> {
      const parsed = LocalSearchRequest.safeParse(input);
      if (!parsed.success) return Promise.resolve(failure('invalid_request'));
      if (closed) return Promise.resolve(failure('disconnected'));
      if (signal?.aborted) return Promise.resolve(failure('cancelled'));
      if (running.size >= 2) return Promise.resolve(failure('index_unavailable'));
      return new Promise(resolve => {
        let reader: ReadProcess;
        try { reader = spawn(path.resolve(workerArtifact)); } catch { resolve(failure('index_unavailable')); return; }
        running.add(reader); let settled = false;
        const finish = async (result: LocalSearchResult) => {
          if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
          reader.terminate(); await reader.exited; running.delete(reader); resolve(result);
        };
        const abort = () => { void finish(failure('cancelled')); };
        const timer = setTimeout(() => { void finish(failure('index_unavailable')); }, budget.timeoutMs);
        signal?.addEventListener('abort', abort, { once: true });
        reader.onFailure(() => { void finish(failure(closed ? 'disconnected' : 'index_unavailable')); });
        reader.onMessage(value => { const result = LocalSearchResult.safeParse(value); void finish(result.success ? result.data : failure('index_unavailable')); });
        try { reader.send({ filename: path.join(directory, 'career.sqlite'), request: parsed.data, budget }); }
        catch { void finish(failure('index_unavailable')); }
      });
    },
    async close() { closed = true; for (const reader of running) reader.terminate(); await Promise.all([...running].map(reader => reader.exited)); },
  };
}
