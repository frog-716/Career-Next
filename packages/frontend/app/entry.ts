export {};
try{
 if(location.protocol==='http:'){const {installBrowserBridge}=await import('./browser-bridge');await installBrowserBridge();}
 await import('./main');
}catch{
 const root=document.getElementById('root'),main=document.createElement('main'),message=document.createElement('p'),reload=document.createElement('button');
 message.textContent='Career 本地连接暂不可用，请确认后台已启动，并允许这个本地页面使用 Cookie。';reload.textContent='重新加载';reload.addEventListener('click',()=>location.reload());main.append(message,reload);root?.replaceChildren(main);
}
