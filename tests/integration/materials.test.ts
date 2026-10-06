import { it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createMaterialsBackend as createBackend } from '../../packages/backend/domains/materials/public';

// The source-level test runner injects the same built writer used by the Node host.
function createMaterialsBackend(root: string, makeBlobs?: Parameters<typeof createBackend>[1]) {
  return createBackend(root,makeBlobs,path.resolve('dist/application/writer.cjs'));
}

it('local selection previews actual text and cancel leaves no formal Raw', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'career-g1-test-'));
  const filename = path.join(root, '原件.txt');
  await writeFile(filename, '这是个人原始材料。\nNot verified as fact.');
  const backend = await createMaterialsBackend(path.join(root, 'workspace'));
  try {
    const session = await backend.connectHuman();
    const preview = await backend.selectFile(session, filename);
    expect(preview.text).toBe('这是个人原始材料。\nNot verified as fact.');
    expect(await backend.list(session)).toEqual([]);
    await backend.cancel(session, preview.importId);
    expect(await backend.list(session)).toEqual([]);
    expect(await backend.stagingCount()).toBe(0);
  } finally { await backend.close(); await rm(root, { recursive: true, force: true }); }
});

it('confirmation commits the previewed bytes once and resolves their exact SourceRef', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'career-g1-test-'));
  const filename = path.join(root, 'evidence.txt');
  await writeFile(filename, '用户确认的原文');
  const backend = await createMaterialsBackend(path.join(root, 'workspace'));
  try {
    const session = await backend.connectHuman();
    const preview = await backend.selectFile(session, filename);
    await writeFile(filename, '选择后原文件变了');
    const input = { commandId: crypto.randomUUID(), importId: preview.importId, expectedRevision: 1 as const, digest: preview.digest };
    const receipt = await backend.confirm(session, input);
    expect(receipt.status).toBe('committed');
    if (receipt.status !== 'committed') throw new Error('save failed');
    const raw = await backend.read(session, receipt.materialId);
    expect(raw.text).toBe('用户确认的原文');
    expect(raw.scope).toBe('personal'); expect(raw.lifecycle).toBe('evidence-original');
    expect(await backend.resolveSource(session, raw.source)).toEqual(raw);
    expect(await backend.confirm(session, input)).toEqual(receipt);
    expect(await backend.list(session)).toHaveLength(1);
    expect(await backend.collectGarbage()).toBe(0);
    expect((await backend.read(session,receipt.materialId)).text).toBe('用户确认的原文');
    expect(await backend.receipt(session, input.commandId)).toEqual(receipt);
    expect(await backend.stagingCount()).toBe(0);
  } finally { await backend.close(); await rm(root, { recursive: true, force: true }); }
});

it('publish hold and committed retention prevent GC, while invalidated imports cannot commit', async () => {
  const { createBlobBroker } = await import('../../packages/backend/platform/files/blobs');
  const root = await mkdtemp(path.join(tmpdir(), 'career-g1-test-'));
  const filename = path.join(root,'原件.txt'); await writeFile(filename,'hold protects original');
  let release!: () => void, published!: () => void;
  const blocked = new Promise<void>(resolve => { release=resolve; });
  const reached = new Promise<void>(resolve => { published=resolve; });
  const backend = await createMaterialsBackend(path.join(root,'workspace'),(directory,maxBytes) => {
    const real = createBlobBroker(directory,maxBytes);
    return { ...real, async publish(...args) { await real.publish(...args); published(); await blocked; } };
  });
  try {
    const session = await backend.connectHuman(); const preview = await backend.selectFile(session,filename);
    const input = { commandId: crypto.randomUUID(),importId:preview.importId,expectedRevision:1 as const,digest:preview.digest };
    const saving=backend.confirm(session,input); await reached;
    expect(await backend.collectGarbage()).toBe(0);
    expect((await backend.confirm(session,input)).status).toBe('pending');
    let drained=false;
    const cancelling = backend.cancel(session,preview.importId).then(()=>{drained=true;});
    await new Promise(resolve=>setTimeout(resolve,20));
    expect(drained).toBe(false);
    release(); await cancelling;
    expect((await saving).status).toBe('failed');
    expect(await backend.list(session)).toEqual([]);
    expect(await backend.collectGarbage()).toBe(0); // failed command's unreferenced blob already reclaimed
    await expect(backend.confirm(session,{ ...input,commandId:crypto.randomUUID() })).rejects.toThrow('invalid_capability');
  } finally { release(); await backend.close(); await rm(root,{recursive:true,force:true}); }
});

it('real read, staging and publish failures leave no formal Raw or false success', async () => {
  const { mkdir, rename, readdir } = await import('node:fs/promises');
  const root = await mkdtemp(path.join(tmpdir(),'career-g1-test-'));
  const directory=path.join(root,'workspace'), filename=path.join(root,'text.txt');
  await writeFile(filename,'原件内容');
  const backend=await createMaterialsBackend(directory);
  try {
    const session=await backend.connectHuman();
    await expect(backend.selectFile(session,path.join(root,'missing.txt'))).rejects.toThrow('file_failed');
    await rename(path.join(directory,'staging'),path.join(directory,'staging-old'));
    await writeFile(path.join(directory,'staging'),'not a directory');
    await expect(backend.selectFile(session,filename)).rejects.toThrow('file_failed');
    await rm(path.join(directory,'staging')); await rename(path.join(directory,'staging-old'),path.join(directory,'staging'));
    const preview=await backend.selectFile(session,filename);
    await rename(path.join(directory,'blobs'),path.join(directory,'blobs-old'));
    await writeFile(path.join(directory,'blobs'),'not a directory');
    const input={commandId:crypto.randomUUID(),importId:preview.importId,expectedRevision:1 as const,digest:preview.digest};
    const receipt=await backend.confirm(session,input);
    expect(receipt.status).toBe('failed');
    expect(await backend.list(session)).toEqual([]);
    await rm(path.join(directory,'blobs')); await rename(path.join(directory,'blobs-old'),path.join(directory,'blobs'));
    await backend.collectGarbage();
    expect(await readdir(path.join(directory,'blobs'))).toEqual([]);
  } finally { await backend.close(); await rm(root,{recursive:true,force:true}); }
});

it('real SQLite commit rejection rolls back material/retention and returns a failed receipt', async () => {
  const { default: Database }=await import('better-sqlite3');
  const { readdir }=await import('node:fs/promises');
  const root=await mkdtemp(path.join(tmpdir(),'career-g1-test-'));
  const directory=path.join(root,'workspace'), filename=path.join(root,'原件.txt'); await writeFile(filename,'不能假保存');
  let backend=await createMaterialsBackend(directory); await backend.close();
  // Fault injection only while the real writer is closed; no extra active business writer.
  const db=new Database(path.join(directory,'career.sqlite'));
  db.exec("CREATE TRIGGER g1_fault BEFORE INSERT ON materials_raw BEGIN SELECT RAISE(ABORT,'injected disk failure'); END"); db.close();
  backend=await createMaterialsBackend(directory);
  try {
    const session=await backend.connectHuman(), preview=await backend.selectFile(session,filename);
    const input={commandId:crypto.randomUUID(),importId:preview.importId,expectedRevision:1 as const,digest:preview.digest};
    expect(await backend.confirm(session,input)).toEqual({status:'failed',commandId:input.commandId,code:'db_failed'});
    expect(await backend.list(session)).toEqual([]);
    expect(await readdir(path.join(directory,'blobs'))).toEqual([]);
    expect((await backend.receipt(session,input.commandId)).status).toBe('failed');
  } finally { await backend.close(); await rm(root,{recursive:true,force:true}); }
});

it('restart preserves workspace/receipts, rejects old capability, and obtains a real exclusive writer lock', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'career-g1-test-')), directory=path.join(root,'workspace');
  const filename=path.join(root,'原件.txt'); await writeFile(filename,'只保存一份');
  let backend=await createMaterialsBackend(directory);
  try {
    const old=await backend.connectHuman(), preview=await backend.selectFile(old,filename);
    const input={commandId:crypto.randomUUID(),importId:preview.importId,expectedRevision:1 as const,digest:preview.digest};
    const committed=await backend.confirm(old,input);
    const unfinished=await backend.selectFile(old,filename);
    await expect(createMaterialsBackend(directory)).rejects.toThrow('workspace_busy');
    await backend.close(); backend=await createMaterialsBackend(directory);
    const current=await backend.connectHuman();
    expect(current.workspaceInstance).toBe(old.workspaceInstance);
    expect(current.backendGeneration).not.toBe(old.backendGeneration);
    expect(current.connectionGeneration).not.toBe(old.connectionGeneration);
    await expect(backend.confirm(old,{...input,commandId:crypto.randomUUID(),importId:unfinished.importId})).rejects.toThrow('invalid_capability');
    await expect(backend.confirm(current,{...input,commandId:crypto.randomUUID(),importId:unfinished.importId})).rejects.toThrow('invalid_capability');
    expect(await backend.receipt(current,input.commandId)).toEqual(committed);
    expect(await backend.confirm(current,input)).toEqual(committed);
    expect(await backend.list(current)).toHaveLength(1);
    expect(await backend.stagingCount()).toBe(0);
    const next=await backend.connectHuman();
    await expect(backend.list(current)).rejects.toThrow('invalid_capability');
    await expect(backend.list({...next,actor:{kind:'human',token:crypto.randomUUID()}})).rejects.toThrow('invalid_capability');
    await expect(backend.confirm(next,{...input,digest:'0'.repeat(64)})).rejects.toThrow('conflict');
  } finally { await backend.close(); await rm(root,{recursive:true,force:true}); }
});

it('unsupported, symlink, invalid UTF-8 and oversized files create no formal data', async () => {
  const {symlink}=await import('node:fs/promises');
  const root=await mkdtemp(path.join(tmpdir(),'career-g1-test-'));
  const backend=await createMaterialsBackend(path.join(root,'workspace'));
  try {
    const session=await backend.connectHuman();
    await writeFile(path.join(root,'binary.pdf'),'not text');
    await writeFile(path.join(root,'bad.txt'),Buffer.from([0xff,0xfe,0xff]));
    await writeFile(path.join(root,'large.txt'),'x'.repeat(256*1024+1));
    await writeFile(path.join(root,'valid.txt'),'valid');await symlink(path.join(root,'valid.txt'),path.join(root,'symlink.txt'));
    for(const name of ['binary.pdf','bad.txt','large.txt']) await expect(backend.selectFile(session,path.join(root,name))).rejects.toThrow('unsupported_file');
    await expect(backend.selectFile(session,path.join(root,'symlink.txt'))).rejects.toThrow('file_failed');
    expect(await backend.list(session)).toEqual([]);expect(await backend.stagingCount()).toBe(0);
  } finally {await backend.close();await rm(root,{recursive:true,force:true});}
});

it('same-backend reconnect retires old preview sinks and does not leave reclaimable staging forever', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'career-g1-test-'));
  const filename=path.join(root,'原件.txt');await writeFile(filename,'保留预览但不能复活执行权');
  const backend=await createMaterialsBackend(path.join(root,'workspace'));
  try {
    const old=await backend.connectHuman(),preview=await backend.selectFile(old,filename);
    const current=await backend.connectHuman();
    expect(current.backendGeneration).toBe(old.backendGeneration);expect(current.connectionGeneration).not.toBe(old.connectionGeneration);
    await expect(backend.confirm(current,{commandId:crypto.randomUUID(),importId:preview.importId,expectedRevision:1,digest:preview.digest})).rejects.toThrow('invalid_capability');
    expect(await backend.stagingCount()).toBe(0);
    expect(await backend.list(current)).toEqual([]);
  } finally {await backend.close();await rm(root,{recursive:true,force:true});}
});

it('failed filesystem startup releases the writer lock for a corrected retry', async () => {
  const {mkdir}=await import('node:fs/promises');
  const root=await mkdtemp(path.join(tmpdir(),'career-g1-test-')),directory=path.join(root,'workspace');
  await mkdir(directory);await writeFile(path.join(directory,'blobs'),'not a directory');
  await expect(createMaterialsBackend(directory)).rejects.toThrow();
  await rm(path.join(directory,'blobs'));
  const backend=await createMaterialsBackend(directory);
  try {const session=await backend.connectHuman();expect(await backend.list(session)).toEqual([]);}
  finally {await backend.close();await rm(root,{recursive:true,force:true});}
});

it('hard crash after physical publish recovers the orphan only after producer exit', async () => {
  const {fork}=await import('node:child_process');
  const {readdir}=await import('node:fs/promises');
  const root=await mkdtemp(path.join(tmpdir(),'career-g1-test-')),directory=path.join(root,'workspace');
  const filename=path.join(root,'原件.txt');await writeFile(filename,'published but never committed');
  const child=fork(path.resolve('dist/test-support/publish-crash.mjs'),[directory,filename],{stdio:['ignore','ignore','pipe','ipc']});
  try {
    const exited=new Promise<void>(resolve=>child.once('exit',()=>resolve()));
    const {commandId,blobId}=await Promise.race([
      new Promise<{commandId:string;blobId:string}>((resolve,reject)=>{child.once('message',value=>resolve(value as {commandId:string;blobId:string}));child.once('error',reject);}),
      exited.then(()=>{throw new Error('publish driver exited early');}),
    ]);
    expect(await readdir(path.join(directory,'blobs'))).toEqual([blobId]);
    child.kill('SIGKILL');await exited;
    const backend=await createMaterialsBackend(directory);
    try {
      const session=await backend.connectHuman();
      expect(await backend.receipt(session,commandId)).toEqual({status:'failed',commandId,code:'invalid_capability'});
      expect(await backend.list(session)).toEqual([]);
      expect(await readdir(path.join(directory,'blobs'))).toEqual([]);
      expect(await backend.stagingCount()).toBe(0);
    } finally {await backend.close();}
  } finally {if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await rm(root,{recursive:true,force:true});}
},10000);
