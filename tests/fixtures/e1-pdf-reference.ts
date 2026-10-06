import {app} from 'electron';import {printResume} from '../../apps/desktop/capabilities/print-resume';
app.setPath('userData',process.argv[2]!);app.on('window-all-closed',()=>{});
(globalThis as unknown as {printFixture:typeof printResume}).printFixture=printResume;
