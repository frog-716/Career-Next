import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
export async function startWriter<Store extends { [K in keyof Store]: (...args: never[]) => unknown }>(root: string, generation: string, artifact = path.join(__dirname, 'writer.cjs'),options?:{dataRoot?:string;control?:(action:string,args:unknown[])=>Promise<unknown>}) {
  const worker = new Worker(path.resolve(artifact), { workerData: { root, generation,dataRoot:options?.dataRoot } });
  const pending = new Map<string, { resolve(result: unknown): void; reject(error: Error): void }>();
  let dead = false;
  worker.on('error', () => { dead = true; for (const item of pending.values()) item.reject(new Error('db_failed')); pending.clear(); });
  worker.on('exit', () => { dead = true; for (const item of pending.values()) item.reject(new Error('disconnected')); pending.clear(); });
  await new Promise<void>((resolve, reject) => { worker.once('message', () => resolve()); worker.once('error', error => reject(new Error(error.message === 'workspace_busy' ? 'workspace_busy' : 'db_failed'))); });
  worker.on('message', ({ id, result, error,control,args }) => {
    if(control){void Promise.resolve(options?.control?.(control,args??[])).then(result=>worker.postMessage({controlReply:id,result}),()=>worker.postMessage({controlReply:id,error:'maintenance_failed'}));return;}
    const item = pending.get(id); if (!item) return; pending.delete(id);
    if (error) item.reject(new Error(error)); else item.resolve(result);
  });
  function send<T>(message: object): Promise<T> {
    if (dead) return Promise.reject(new Error('disconnected'));
    return new Promise((resolve, reject) => { const id = randomUUID(); pending.set(id, { resolve: value => resolve(value as T), reject }); worker.postMessage({ ...message, id }); });
  }
  return {
    call<K extends keyof Store>(method: K, ...args: Parameters<Store[K]>): Promise<Awaited<ReturnType<Store[K]>>> { return send({ call: { method, args } }); },
    async close() { if (!dead) { const exit = new Promise<void>(resolve => worker.once('exit', () => resolve())); await send({ close: true }); await exit; } },
  };
}
export type Writer = Awaited<ReturnType<typeof startWriter>>;
