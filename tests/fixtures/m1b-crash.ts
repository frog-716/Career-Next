import {readFileSync} from 'node:fs';
import {executeMigration} from '../../packages/backend/application/migration/public';
const {plan,input}=JSON.parse(readFileSync(process.argv[2],'utf8'));
await executeMigration(plan,input,{onImported(count){if(count===12)process.kill(process.pid,'SIGKILL');}});
