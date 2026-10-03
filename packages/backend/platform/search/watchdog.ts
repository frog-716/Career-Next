import { Worker, isMainThread, workerData } from 'node:worker_threads';

/** Fixed lifecycle branch of the same artifact; it never opens a database. */
export function runReadWatchdog(): boolean {
  if (isMainThread || workerData?.kind !== 'local-search.parent-watchdog') return false;
  const { parentPid, deadlineMs } = workerData as { parentPid: number; deadlineMs: number };
  const deadline = Date.now() + deadlineMs;
  setInterval(() => {
    let parentExists = true;
    try { process.kill(parentPid, 0); } catch { parentExists = false; }
    // These OS checks run independently of a native SQL call on the main thread.
    if (process.ppid !== parentPid || !parentExists || Date.now() >= deadline) process.kill(process.pid, 'SIGKILL');
  }, 50);
  return true;
}

export function startReadWatchdog(parentPid: number, timeoutMs: number) {
  if (!Number.isSafeInteger(parentPid) || parentPid <= 1 || !Number.isFinite(timeoutMs)) process.exit(1);
  // The artifact and limits come only from the trusted fixed process launcher.
  return new Worker(process.argv[1], { workerData: { kind: 'local-search.parent-watchdog', parentPid, deadlineMs: Math.min(5000, Math.max(50, timeoutMs)) } });
}
