import {BrowserWindow} from 'electron';
import {randomUUID} from 'node:crypto';
/** Only the trusted backend-owned renderer supplies this static HTML. No renderer HTML or path enters this capability. */
export async function printResume(html:string){
 if(html.length>4*1024*1024)throw Error('pdf_failed');
 const printWindow=new BrowserWindow({show:false,webPreferences:{partition:'career-print-'+randomUUID(),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,devTools:false}});
 const session=printWindow.webContents.session;
 session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 session.setPermissionCheckHandler(()=>false);
 session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('data:text/html,')}));
 printWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 printWindow.webContents.on('will-navigate',event=>event.preventDefault());
 printWindow.webContents.on('will-frame-navigate',event=>event.preventDefault());
 let timeout:ReturnType<typeof setTimeout>|undefined;
 try{
  const work=(async()=>{
   await printWindow.loadURL('data:text/html,'+encodeURIComponent(html));
   const bytes=await printWindow.webContents.printToPDF({pageSize:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,scale:1});
   if(bytes.length===0||bytes.length>16*1024*1024)throw Error('pdf_failed');
   return bytes;
  })();
  return await Promise.race([work,new Promise<never>((_resolve,reject)=>{timeout=setTimeout(()=>reject(Error('pdf_failed')),30000);})]);
 }finally{if(timeout)clearTimeout(timeout);if(!printWindow.isDestroyed())printWindow.destroy();}
}
