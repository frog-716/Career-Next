import { expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { commandMigration, executeCommand, commandReceipt } from '../packages/backend/platform/commands/receipts';
it('commits one owner result and remembers the exact command across retries', () => {
 const db = new Database(':memory:');
 try {
  db.exec(commandMigration); db.exec('CREATE TABLE example(value TEXT)');
  const save = () => {db.prepare('INSERT INTO example VALUES (?)').run('one'); return {revision:1};};
  expect(executeCommand(db,'wiki','same',{text:'one'},save)).toEqual({revision:1});
  expect(executeCommand(db,'wiki','same',{text:'one'},save)).toEqual({revision:1});
  expect(commandReceipt(db,'wiki','same')).toEqual({revision:1});
  expect(() => executeCommand(db,'wiki','same',{text:'other'},save)).toThrow('conflict');
  expect(commandReceipt(db,'employment','same')).toBeUndefined();
  expect(() => executeCommand(db,'wiki','failure',{},() => {save(); throw Error('failed');})).toThrow('failed');
  expect(commandReceipt(db,'wiki','failure')).toBeUndefined();
  expect(db.prepare('SELECT value FROM example').all()).toEqual([{value:'one'}]);
 } finally {db.close();}
});
