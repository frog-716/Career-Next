import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {} from '../../contracts/probe/g0';
import './style.css';

function Probe() {
  const [text, setText] = useState('中文输入与焦点验证');
  const [result, setResult] = useState('尚未执行');
  const [secret, setSecret] = useState('');
  async function run(action: () => Promise<unknown>) {
    try { setResult(JSON.stringify(await action())); }
    catch { setResult('G0_OPERATION_FAILED'); }
  }
  return <main><h1>Career Next · G0 Probe</h1><p>仅验证技术链，不能保存职业资料。</p>
    <label>输入验证<input id="probe-text" value={text} onChange={event => setText(event.target.value)} /></label>
    <button onClick={() => run(() => window.careerG0.request({ kind: 'echo', text }))}>发送 typed request</button>
    <button onClick={() => run(() => window.careerG0.request({ kind: 'transaction' }))}>临时 SQLite transaction</button>
    <button onClick={() => run(() => window.careerG0.request({ kind: 'status' }))}>查询连接</button>
    <button onClick={() => run(() => window.careerG0.reconnect())}>重建连接</button>
    <button onClick={() => run(() => window.careerG0.print())}>生成 G0 PDF</button>
    <label>虚构测试 Secret<input id="probe-secret" type="password" autoComplete="off" value={secret} onChange={event => setSecret(event.target.value)} /></label>
    <button onClick={() => { const input = secret; setSecret(''); void run(() => window.careerG0.saveSecret(input)); }}>只写 Secret</button>
    <button onClick={() => run(() => window.careerG0.secretStatus())}>查询已配置状态</button>
    <output id="probe-result">{result}</output>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Probe />);
