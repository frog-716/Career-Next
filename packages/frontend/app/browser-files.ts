/** The user grants a single file, not access to a local pathname or directory. */
export function chooseBrowserFile(accept:string,maximumBytes:number):Promise<File|undefined>{
 return new Promise((resolve,reject)=>{const input=document.createElement('input');input.type='file';input.accept=accept;input.style.display='none';const previous=document.activeElement;
  function done(file?:File){input.remove();if(previous instanceof HTMLElement)previous.focus({preventScroll:true});if(file&&(!file.size||file.size>maximumBytes)){reject(Error('unsupported_file'));return;}resolve(file);}
  input.addEventListener('change',()=>done(input.files?.[0]),{once:true});input.addEventListener('cancel',()=>done(),{once:true});document.body.append(input);input.click();
 });
}
