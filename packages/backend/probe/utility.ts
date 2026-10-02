import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

import type { MessagePortMain } from 'electron';
import { ProbeRequest, ProbeResponse } from '../../contracts/probe/g0';

const generation = randomUUID();
const filename = process.argv[2]!;
let slow: Worker | undefined;
const workers = new Set<Worker>();
const snapshotText = 'Career G0 技术验证：中文文字可选择。固定输入快照。';

// One persistent write executor; temporary SQL connections never move into Main.
const writer = new Worker(path.join(__dirname, 'sqlite-worker.cjs'), { workerData: { filename } });
workers.add(writer);
let writeQueue: Promise<unknown> = Promise.resolve();
function transaction(write: boolean): Promise<{ count: number; sqlite: string }> {
  const job = writeQueue.then(() => new Promise<{ count: number; sqlite: string }>((resolve, reject) => {
    const failed = () => { cleanup(); reject(new Error('G0_SQL_WORKER_EXIT')); };
    const received = (result: { count: number; sqlite: string; error?: string }) => {
      cleanup();
      if (result.error) reject(new Error('G0_SQL_FAILED')); else resolve(result);
    };
    const cleanup = () => { writer.off('message', received); writer.off('error', failed); writer.off('exit', failed); };
    writer.once('message', received); writer.once('error', failed); writer.once('exit', failed);
    writer.postMessage({ write });
  }));
  writeQueue = job.catch(() => undefined);
  return job;
}

async function respond(input: unknown): Promise<ProbeResponse> {
  const request = ProbeRequest.parse(input);
  if (request.kind === 'echo') return { generation, echo: request.text };
  if (request.kind === 'snapshot') return { generation, snapshot: {
    id: createHash('sha256').update(snapshotText).digest('hex'), text: snapshotText,
  } };
  if (request.kind === 'stop') {
    const running = Boolean(slow);
    const worker = slow;
    slow = undefined;
    if (worker) await worker.terminate();
    return { generation, stopped: true, workerRunning: running };
  }
  if (request.kind === 'slow-start') {
    if (slow) throw new Error('G0_ALREADY_RUNNING');
    const worker = new Worker(path.join(__dirname, 'sqlite-worker.cjs'), { workerData: { filename, slow: true } });
    slow = worker;
    workers.add(worker);
    await new Promise<void>((resolve, reject) => { worker.once('message', () => resolve()); worker.once('error', reject); });
    worker.once('exit', () => { workers.delete(worker); if (slow === worker) slow = undefined; });
    return { generation, workerRunning: true };
  }
  return { generation, ...await transaction(request.kind === 'transaction') };
}

process.parentPort!.on('message', event => {
  const port: MessagePortMain = event.ports[0]!;
  port.on('message', async event => {
    const envelope = event.data as { id: string; input: unknown };
    try { port.postMessage({ id: envelope.id, result: ProbeResponse.parse(await respond(envelope.input)) }); }
    catch { port.postMessage({ id: envelope.id, error: 'G0_REQUEST_FAILED' }); }
  });
  port.start();
  port.postMessage({ ready: true, generation });
});
process.on('SIGTERM', async () => { await Promise.all([...workers].map(w => w.terminate())); process.exit(0); });
