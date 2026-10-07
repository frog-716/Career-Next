import { expect, test } from 'vitest';
import { classifyCliResult } from '../scripts/diagnostics/lark-contact-user.mjs';

test('a parseable successful Contact response is SUCCESS rather than an HTTP error', () => {
  const document = { ok: true, data: { code: 0, data: { user: { nickname: 'TEST nickname' } } } };
  expect(classifyCliResult({ exitCode: 0, stdout: JSON.stringify(document), stderr: '', document }).category).toBe('SUCCESS');
});

test('classifies missing user scope without returning diagnostic message text', () => {
  const result = classifyCliResult({
    exitCode: 1,
    stderr: '',
    stdout: '',
    document: { ok: false, error: { type: 'authorization', subtype: 'missing_scope', code: 99991679, missing_scopes: ['contact:user.base:readonly'], message: 'private diagnostic text' } },
  });

  expect(result.category).toBe('AUTH_SCOPE_DENIED');
  expect(JSON.stringify(result)).not.toContain('private diagnostic text');
});

test('classifies explicit contact visibility range denial separately from scope denial', () => {
  expect(classifyCliResult({
    exitCode: 1,
    stderr: '',
    stdout: '',
    document: { ok: false, error: { code: 41050, message: 'contact user is outside the visible range' } },
  }).category).toBe('CONTACT_RANGE_DENIED');
});

test('distinguishes unsupported CLI paths, transport errors and malformed successful output', () => {
  expect(classifyCliResult({ exitCode: 1, stderr: 'unsupported endpoint', stdout: '' }).category).toBe('CLI_UNSUPPORTED');
  expect(classifyCliResult({ exitCode: 1, stderr: 'HTTP status 503', stdout: '' }).category).toBe('HTTP_ERROR');
  expect(classifyCliResult({ exitCode: 0, stderr: '', stdout: 'not json' }).category).toBe('PARSE_ERROR');
});

test('does not include raw stderr, stdout, token-like values, or identifiers in diagnostics', () => {
  const result = classifyCliResult({
    exitCode: 1,
    stderr: 'Bearer secret-token Authorization: secret-header open_id=ou_sensitive',
    stdout: '',
  });

  expect(result).toMatchObject({ category: 'LOCAL_COMMAND_ERROR', exitCode: 1, stderrPresent: true });
  expect(JSON.stringify(result)).not.toMatch(/secret-token|secret-header|ou_sensitive|Authorization/i);
});
