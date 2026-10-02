import { dialog, BrowserWindow } from 'electron';
// File path stays inside trusted Desktop/backend adapters, never in renderer DTOs.
export async function selectMaterial(window: BrowserWindow): Promise<string | undefined> {
  const result=await dialog.showOpenDialog(window,{title:'选择个人原始材料',properties:['openFile'],filters:[{name:'UTF-8 文本（TXT / Markdown）',extensions:['txt','md']},{name:'全部文件',extensions:['*']}]});
  return result.canceled ? undefined : result.filePaths[0];
}
