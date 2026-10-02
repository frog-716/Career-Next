import { BrowserWindow } from 'electron';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function printSnapshot(directory: string, snapshot: { id: string; text: string }) {
  if (createHash('sha256').update(snapshot.text).digest('hex') !== snapshot.id) throw new Error('G0_SNAPSHOT_MISMATCH');
  const printer = new BrowserWindow({ show: false, webPreferences: {
    contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: false,
    partition: `g0-print-${snapshot.id}`,
  } });
  printer.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  printer.webContents.on('will-navigate', event => event.preventDefault());
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const html = `<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"></head><body style="font-family:PingFang SC,sans-serif"><h1>${escape(snapshot.text)}</h1><p>${snapshot.id}</p></body></html>`;
  try {
    await printer.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await printer.webContents.printToPDF({ pageSize: 'A4', printBackground: true });
    const filename = `g0-${snapshot.id}.pdf`;
    await writeFile(path.join(directory, filename), pdf);
    return { snapshotId: snapshot.id, hash: createHash('sha256').update(pdf).digest('hex'), filename, released: true };
  } finally { printer.destroy(); }
}
