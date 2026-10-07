#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const allowedIdentityFields = ["nickname", "name", "en_name", "avatar"];
const endpointPrefix = "/open-apis/contact/v3/users/";

function parseJson(text) {
  if (!text?.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function firstObjectWithIdentityFields(value, depth = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 4) return undefined;
  if (allowedIdentityFields.some((field) => Object.hasOwn(value, field))) return value;
  for (const key of ["data", "user", "result"]) {
    const child = value[key];
    const found = firstObjectWithIdentityFields(child, depth + 1);
    if (found) return found;
  }
  return undefined;
}

function responseError(document) {
  if (!document || typeof document !== "object") return {};
  const data = document.data && typeof document.data === "object" ? document.data : {};
  const nestedData = data.data && typeof data.data === "object" ? data.data : {};
  const error = document.error ?? data.error ?? nestedData.error ?? {};
  const code = error.code ?? data.code ?? nestedData.code ?? document.code;
  const type = error.type ?? error.subtype ?? data.type ?? nestedData.type;
  const message = error.message ?? data.msg ?? data.message ?? nestedData.msg ?? nestedData.message;
  const missingScopes = error.missing_scopes ?? data.missing_scopes ?? nestedData.missing_scopes;
  return { code, type, message, missingScopes };
}

function httpStatus(document) {
  if (!document || typeof document !== "object") return undefined;
  const meta = document.meta && typeof document.meta === "object" ? document.meta : {};
  for (const value of [meta.http_status, meta.httpStatus, meta.status_code, meta.statusCode,
    document.http_status, document.httpStatus, document.status_code, document.statusCode]) {
    if (Number.isInteger(Number(value)) && Number(value) >= 100) return Number(value);
  }
  return undefined;
}

export function classifyCliResult({ exitCode, stdout = "", stderr = "", spawnError, document }) {
  const combined = `${stderr}\n${stdout}`.toLowerCase();
  const error = responseError(document ?? parseJson(stdout) ?? parseJson(stderr));
  const code = error.code === undefined ? "" : String(error.code);
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  const clues = `${combined}\n${message}\n${String(error.type ?? "").toLowerCase()}`;
  const status = httpStatus(document ?? parseJson(stdout) ?? parseJson(stderr));

  const parsed = document ?? parseJson(stdout) ?? parseJson(stderr);
  let category = exitCode === 0 && parsed?.ok === true ? "SUCCESS" : "HTTP_ERROR";
  if (spawnError) {
    category = "LOCAL_COMMAND_ERROR";
  } else if (/unknown command|unsupported (endpoint|method|command)|not supported|no such command|unrecognized command/.test(clues)) {
    category = "CLI_UNSUPPORTED";
  } else if (Array.isArray(error.missingScopes) && error.missingScopes.length > 0 ||
    /missing[_ -]?scope|insufficient[_ -]?scope|scope.{0,40}(required|missing)|authorization scope/.test(clues)) {
    category = "AUTH_SCOPE_DENIED";
  } else if (/contact.{0,40}(range|visibility|data scope)|(?:range|visibility|data scope).{0,40}contact|not in (?:the )?(?:accessible|visible) range/.test(clues)) {
    category = "CONTACT_RANGE_DENIED";
  } else if (status !== undefined && status >= 400 || code && code !== "0") {
    category = "HTTP_ERROR";
  } else if (exitCode === 0 && !parseJson(stdout)) {
    category = "PARSE_ERROR";
  } else if (exitCode !== 0 && !document && !parseJson(stdout) && !parseJson(stderr)) {
    category = /timeout|network|connection|http/.test(clues) ? "HTTP_ERROR" : "LOCAL_COMMAND_ERROR";
  }

  return {
    category,
    exitCode: Number.isInteger(exitCode) ? exitCode : null,
    httpStatus: status ?? null,
    apiCode: code || null,
    stderrPresent: Boolean(stderr),
    stdoutPresent: Boolean(stdout),
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
  return {
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    spawnError: result.error,
  };
}

function safePrint(record) {
  // Emit only fixed labels and selected values. Never print raw stdout/stderr,
  // user IDs, environment variables, or request headers.
  process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
}

function getCurrentOpenId() {
  const status = run("lark-cli", ["auth", "status", "--json"]); // local only; no --verify
  if (status.spawnError || status.exitCode !== 0) {
    return { error: classifyCliResult(status) };
  }
  const document = parseJson(status.stdout);
  const user = document?.identities?.user;
  const openId = user?.openId ?? user?.open_id;
  if (typeof openId !== "string" || !openId || /[/?#\s]/.test(openId)) {
    return { error: { category: "LOCAL_COMMAND_ERROR", exitCode: status.exitCode, httpStatus: null, apiCode: null, stderrPresent: Boolean(status.stderr), stdoutPresent: Boolean(status.stdout) } };
  }
  return { openId };
}

function expectedPreview(document, openId) {
  const api = document?.data?.api;
  if (!Array.isArray(api) || api.length !== 1) return false;
  const request = api[0];
  return request.method === "GET" && request.url === `${endpointPrefix}${openId}` &&
    request.params?.user_id_type === "open_id" && Object.keys(request.params ?? {}).length === 1;
}

export function runContactUserDiagnostic({ execute = false } = {}) {
  const identity = getCurrentOpenId();
  if (identity.error) {
    safePrint({ mode: execute ? "execute" : "dry-run", category: identity.error.category, exitCode: identity.error.exitCode, requestAttempted: false });
    return identity.error.exitCode ?? 1;
  }

  const openId = identity.openId;
  const path = `${endpointPrefix}${openId}`;
  const params = JSON.stringify({ user_id_type: "open_id" });
  const dryRun = run("lark-cli", ["api", "GET", path, "--params", params, "--as", "user", "--dry-run", "--json"]);
  const previewDocument = parseJson(dryRun.stdout);
  if (dryRun.spawnError || dryRun.exitCode !== 0 || previewDocument?.ok !== true) {
    const diagnostic = classifyCliResult({ ...dryRun, document: previewDocument });
    safePrint({ mode: "dry-run", ...diagnostic, requestAttempted: false });
    return dryRun.exitCode ?? 1;
  }
  if (!expectedPreview(previewDocument, openId)) {
    safePrint({ mode: "dry-run", category: "CLI_UNSUPPORTED", exitCode: 0, httpStatus: null, apiCode: null, stderrPresent: Boolean(dryRun.stderr), stdoutPresent: true, requestAttempted: false });
    return 1;
  }
  if (!execute) {
    safePrint({ mode: "dry-run", category: "READY", endpoint: "GET /open-apis/contact/v3/users/{open_id}?user_id_type=open_id", exitCode: 0, requestAttempted: false });
    return 0;
  }

  // Exactly one invocation, with no pagination or retry option. Both streams
  // are captured and classified; raw diagnostic text is never emitted.
  const response = run("lark-cli", ["api", "GET", path, "--params", params, "--as", "user", "--json"]);
  const responseDocument = parseJson(response.stdout) ?? parseJson(response.stderr);
  const diagnostic = classifyCliResult({ ...response, document: responseDocument });
  if (response.spawnError || response.exitCode !== 0 || responseDocument?.ok !== true) {
    safePrint({ mode: "execute", ...diagnostic, requestAttempted: true });
    return response.exitCode ?? 1;
  }

  const record = firstObjectWithIdentityFields(responseDocument.data);
  if (!record) {
    safePrint({ mode: "execute", ...diagnostic, category: "PARSE_ERROR", requestAttempted: true, fieldsFound: false });
    return 1;
  }
  safePrint({
    mode: "execute",
    category: "SUCCESS",
    ...diagnostic,
    requestAttempted: true,
    identityFields: Object.fromEntries(allowedIdentityFields.map((field) => [field,
      field === "avatar" ? Object.hasOwn(record, field) && Boolean(record[field]) : Object.hasOwn(record, field) ? record[field] : null])),
  });
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const execute = process.argv.includes("--execute");
  process.exitCode = runContactUserDiagnostic({ execute });
}
