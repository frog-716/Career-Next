import { parentPort, workerData } from 'node:worker_threads';
import { openWorkspace } from '../platform/database/database';
import { materialsMigration } from '../domains/materials/migration';
import { createWriterCommands } from './writer-commands';
import { releases } from './releases';
async function start() {
const workspace = await openWorkspace(workerData.root, materialsMigration,releases);
const store=createWriterCommands(workspace.database,workspace.workspaceInstance,workerData.generation);
parentPort!.postMessage({ ready: true });
let queue = Promise.resolve();
parentPort!.on('message', (message: { id: string; call?: {method: keyof typeof store;args:unknown[]}; close?: boolean }) => {
  queue = queue.then(async () => {
  try {
    if (message.close) { workspace.close(); parentPort!.postMessage({ id: message.id, result: true }); parentPort!.close(); return; }
    const call = message.call!;
    const method = store[call.method] as (...args: unknown[]) => unknown;
    const result = await method(...call.args);
    parentPort!.postMessage({ id: message.id, result });
  } catch (error) {
    const allowed = ['invalid_capability','file_failed','storage_failed','conflict','not_found','workspace_busy','invalid_request'];
    const code = error instanceof Error && allowed.includes(error.message) ? error.message : 'db_failed';
    parentPort!.postMessage({ id: message.id, error: code });
  }
  });
});

}
void start().catch(error => {throw error;});
