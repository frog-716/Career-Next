import {spawn} from 'node:child_process';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));const child=spawn(path.join(root,'dist/application/career-launcher'),process.argv.slice(2),{stdio:'inherit'});child.on('error',()=>{console.error('请先执行 npm run build。');process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
