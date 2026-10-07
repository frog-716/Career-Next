export type CliDiagnosticCategory='LOCAL_COMMAND_ERROR'|'CLI_UNSUPPORTED'|'AUTH_SCOPE_DENIED'|'CONTACT_RANGE_DENIED'|'HTTP_ERROR'|'PARSE_ERROR'|'SUCCESS';
export type CliDiagnostic={category:CliDiagnosticCategory;exitCode:number|null;httpStatus:number|null;apiCode:string|null;stderrPresent:boolean;stdoutPresent:boolean};
/** Only fixed classifications and numeric metadata leave this diagnostic boundary. */
export function classifyCliResult(input:{exitCode:number|null;stdout?:string;stderr?:string;spawnError?:unknown;document?:unknown}):CliDiagnostic;
export function runContactUserDiagnostic(options?:{execute?:boolean}):number;
