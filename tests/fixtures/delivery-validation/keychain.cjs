'use strict';
// TEST-only reversible wrapping; no macOS Keychain or real Secret access.
const fs = require('node:fs');
const path = require('node:path');
const {createHash}=require('node:crypto');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
let text=''; process.stdin.setEncoding('utf8'); process.stdin.on('data', part => text+=part);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(text);
    if (!['available','encrypt','decrypt'].includes(input.action) || !['deepseek','tavily'].includes(input.slot) || input.namespace!==createHash('sha256').update(config.profile).digest('hex') || !config.profile.includes('TEST')) throw Error('invalid');
    fs.appendFileSync(config.audit, JSON.stringify({time:new Date().toISOString(),pid:process.pid,mode:'SIMULATED',category:'keychain.'+input.action,slot:input.slot})+'\n',{mode:0o600});
    let result;
    if (input.action === 'available') result={available:true};
    else if (input.action === 'encrypt' && input.value==='TEST_SIMULATED_'+input.slot.toUpperCase()+'_KEY') result={value:Buffer.from('SIMULATED:'+input.value).toString('base64')};
    else if (input.action === 'decrypt') {
      const plain=Buffer.from(input.value,'base64').toString();
      if (plain!=='SIMULATED:TEST_SIMULATED_'+input.slot.toUpperCase()+'_KEY') throw Error('invalid');
      result={value:plain.slice('SIMULATED:'.length)};
    } else throw Error('invalid');
    process.stdout.write(JSON.stringify(result));
  } catch { process.stdout.write(JSON.stringify({error:'SIMULATED_KEYCHAIN_REJECTED'})); process.exitCode=1; }
});
