import { it, expect } from 'vitest';
import { _electron } from 'playwright';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
it('real desktop file dialog selection previews/cancels and saves/reads durable personal Raw', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'career-g1-desktop-'));
  const filename=path.join(root,'人工原件.txt'); await writeFile(filename,'蒸牛蛙\n这是实际文件原文。English and 中文。');
  const packaged=process.env.CAREER_PACKAGED==='1';
  const options={executablePath:packaged?path.resolve('out/CareerNext-darwin-arm64/CareerNext.app/Contents/MacOS/CareerNext'):undefined,args:packaged?[`--user-data-dir=${root}/profile`]:['.',`--user-data-dir=${root}/profile`],timeout:30000};
  let application=await _electron.launch(options);
  try {
    // System dialog seam only: returns a real fixture path; no renderer filepath/Node capability.
    await application.evaluate(({dialog},filename)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[filename]})) as typeof dialog.showOpenDialog;},filename);
    let page=await application.firstWindow();
    await page.getByRole('button',{name:'选择本地文本材料'}).waitFor();
    expect(await page.evaluate(()=>({node:typeof (window as unknown as {require:unknown}).require,process:typeof (window as unknown as {process:unknown}).process,keys:Object.keys(window.careerMaterials).sort()}))).toEqual({node:'undefined',process:'undefined',keys:['ready','reconnect','request']});
    await page.getByRole('button',{name:'选择本地文本材料'}).click();
    await expect.poll(()=>page.locator('#preview-text').textContent()).toContain('这是实际文件原文');
    expect(await page.getByRole('heading',{name:'尚未保存',exact:true}).isVisible()).toBe(true);
    expect(await page.evaluate(()=>window.careerMaterials.request({operation:'list'}))).toEqual({kind:'list',items:[]});
    await page.getByRole('button',{name:'取消导入'}).click();
    await expect.poll(()=>page.locator('#status').textContent()).toContain('已取消');
    expect(await readdir(path.join(root,'profile/workspaces/local/staging'))).toEqual([]);
    expect(await page.evaluate(()=>window.careerMaterials.request({operation:'list'}))).toEqual({kind:'list',items:[]});
    await page.getByRole('button',{name:'选择本地文本材料'}).click();await page.locator('#preview-text').waitFor();
    // Retire the real connection immediately before one confirm: old preview must remain discardable.
    await application.evaluate(({ipcMain})=>{
      const handlers=(ipcMain as unknown as {_invokeHandlers:Map<string,(...args:unknown[])=>Promise<unknown>>})._invokeHandlers;
      const original=handlers.get('materials:request')!,reconnect=handlers.get('materials:reconnect')!;
      ipcMain.removeHandler('materials:request');
      let retired=false;
      ipcMain.handle('materials:request',async(...args)=>{
        if((args[1] as {operation:string}).operation==='confirm'&&!retired){retired=true;await reconnect(args[0]);}
        return original(...args);
      });
    });
    await page.getByRole('button',{name:'确认保存原件'}).click();
    await expect.poll(()=>page.locator('#status').textContent()).toContain('预览或连接已失效');
    expect(await page.getByRole('button',{name:'重新确认保存'}).isDisabled()).toBe(true);
    await page.getByRole('button',{name:'取消导入'}).click();
    await expect.poll(()=>page.locator('#status').textContent()).toContain('已丢弃失效预览');
    await page.getByRole('button',{name:'选择本地文本材料'}).click();await page.locator('#preview-text').waitFor();
    // Drop only the committed response in the external driver; production has no fault switches.
    await application.evaluate(({ipcMain})=>{
      const handlers=(ipcMain as unknown as {_invokeHandlers:Map<string,(...args:unknown[])=>Promise<unknown>>})._invokeHandlers;
      const original=handlers.get('materials:request')!; let dropped=false,firstPayload:string|undefined;
      ipcMain.removeHandler('materials:request');
      ipcMain.handle('materials:request',async(...args)=>{
        const request=args[1] as {operation:string;input:unknown};
        if(request.operation==='confirm'){
          const payload=JSON.stringify(request.input);
          if(firstPayload===undefined){firstPayload=payload;throw new Error('request lost before dispatch');}
          if(payload!==firstPayload)throw new Error('immutable original command changed');
        }
        const result=await original(...args);
        if(request.operation==='confirm'&&!dropped){dropped=true;throw new Error('response lost after commit');}
        return result;
      });
    });
    await page.getByRole('button',{name:'确认保存原件'}).click();
    await expect.poll(()=>page.locator('#status').textContent()).toContain('保存结果待核对');
    expect(await page.evaluate(()=>window.careerMaterials.request({operation:'list'}))).toEqual({kind:'list',items:[]});
    await page.getByRole('button',{name:'核对保存结果'}).click();
    await expect.poll(()=>page.locator('#status').textContent()).toContain('尚未查到原命令记录');
    await page.getByRole('button',{name:'继续原保存'}).click();
    await expect.poll(()=>page.locator('#status').textContent()).toContain('保存结果待核对');
    const once=await page.evaluate(()=>window.careerMaterials.request({operation:'list'}));expect(once.kind).toBe('list');if(once.kind!=='list')throw new Error('not list');expect(once.items).toHaveLength(1);
    await page.getByRole('button',{name:'核对保存结果'}).click();
    await expect.poll(()=>page.locator('#status').textContent()).toContain('已保存');
    await expect.poll(()=>page.locator('#saved-text').textContent()).toContain('蒸牛蛙');
    const identity=await page.evaluate(()=>window.careerMaterials.ready());
    const backendPid=await application.evaluate(({app})=>app.getAppMetrics().find(item=>item.name==='Career Materials Backend')?.pid);
    expect(backendPid).toBeTruthy();process.kill(backendPid!,'SIGKILL');
    await expect.poll(async()=>page.evaluate(async()=>{try{await window.careerMaterials.ready();return false;}catch{return true;}})).toBe(true);
    await page.getByRole('button',{name:'重新连接',exact:true}).click();
    await expect.poll(async()=>page.evaluate(async()=>{try{return (await window.careerMaterials.ready()).backendGeneration;}catch{return undefined;}})).not.toBeUndefined();
    const restarted=await page.evaluate(()=>window.careerMaterials.ready());
    expect(restarted.workspaceInstance).toBe(identity.workspaceInstance);expect(restarted.backendGeneration).not.toBe(identity.backendGeneration);
    expect(await page.evaluate(()=>window.careerMaterials.request({operation:'list'}))).toEqual(once);
    await application.close();application=await _electron.launch(options);
    page=await application.firstWindow();
    await page.getByRole('button',{name:'人工原件.txt'}).click();
    await expect.poll(()=>page.locator('#saved-text').textContent()).toContain('English and 中文');
    const next=await page.evaluate(()=>window.careerMaterials.ready());
    expect(next.workspaceInstance).toBe(identity.workspaceInstance);expect(next.backendGeneration).not.toBe(identity.backendGeneration);
    const sandboxed=await application.evaluate(({app,BrowserWindow})=>app.getAppMetrics().find(p=>p.pid===BrowserWindow.getAllWindows()[0]!.webContents.getOSProcessId())?.sandboxed);
    expect(sandboxed).toBe(true);
    const denied=await page.evaluate(async()=>{try{await window.careerMaterials.request({operation:'select',path:'/etc/passwd'} as never);return false;}catch{return true;}});expect(denied).toBe(true);
  } finally { await application.close();await rm(root,{recursive:true,force:true}); }
},120000);
