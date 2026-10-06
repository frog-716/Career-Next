import {build} from 'vite';import {mkdir,writeFile,readFile,copyFile,cp} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import path from 'node:path';import {chromium} from 'playwright';import {release} from 'node:os';
await mkdir('dist/application',{recursive:true});
for(const [name,entry] of Object.entries({'node-host':'apps/desktop/node/main.ts','node-launcher':'apps/desktop/node/launcher.ts','print-worker':'apps/desktop/node/print-worker.ts'}))await build({configFile:false,build:{emptyOutDir:false,outDir:'dist/application',target:'node24',lib:{entry,formats:['cjs'],fileName:()=>name+'.cjs'},rolldownOptions:{external:[/^node:/,'better-sqlite3','playwright']}}});
const fonts=['/System/Library/Fonts/Supplemental/Arial.ttf','/System/Library/Fonts/Supplemental/Arial Bold.ttf','/System/Library/Fonts/Supplemental/Arial Italic.ttf','/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf','/System/Library/Fonts/Supplemental/Arial Unicode.ttf','/System/Library/Fonts/Hiragino Sans GB.ttc','/System/Library/PrivateFrameworks/FontServices.framework/Resources/Reserved/PingFangUI.ttc'];
const records=[];for(const file of fonts)records.push({path:file,digest:createHash('sha256').update(await readFile(file)).digest('hex')});
const fontVersion='darwin-'+release()+';fonts-'+createHash('sha256').update(JSON.stringify(records)).digest('hex');
await writeFile('dist/application/pdf-environment.json',JSON.stringify({browserVersion:'153.0.8010.12',platformRelease:release(),executable:chromium.executablePath(),fonts:records,fontVersion},null,2));
execFileSync('/usr/bin/swiftc',['-O','apps/desktop/native/keychain.swift','-o','dist/application/career-keychain'],{stdio:'inherit'});
execFileSync('/usr/bin/codesign',['--force','--sign','-','dist/application/career-keychain'],{stdio:'inherit'});
execFileSync('/usr/bin/swiftc',['-O','apps/desktop/native/launcher.swift','-o','dist/application/career-launcher'],{stdio:'inherit'});

await cp('apps/desktop/recovery','dist/recovery-renderer',{recursive:true});
