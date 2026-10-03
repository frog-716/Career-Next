import { Request, Result, Identity, ErrorCode } from '../../contracts/materials/schema';
import type { MaterialsBackend } from '../domains/materials/public';
import type { HumanSession } from '../domains/materials/store';
export async function dispatchMaterials(backend: MaterialsBackend,session: HumanSession,identity: unknown,request: unknown,selectedFile?: string) {
  try {
    const current=Identity.parse(identity);
    if(current.workspaceInstance!==session.workspaceInstance || current.backendGeneration!==session.backendGeneration || current.connectionGeneration!==session.connectionGeneration) throw new Error('invalid_capability');
    const input=Request.parse(request);
    let result: Result;
    switch(input.operation) {
      case 'fixture-candidates':result=backend.fixtureCandidates(input.target);break;
      case 'fixture-body':result={kind:'preview',preview:await backend.fixtureBody(session,input.target,input.candidateId)};break;
      case 'select': result=selectedFile?{kind:'preview',preview:await backend.selectFile(session,selectedFile,input.target)}:{kind:'cancelled'}; break;
      case 'confirm': result={kind:'receipt',receipt:await backend.confirm(session,input.input)}; break;
      case 'cancel': await backend.cancel(session,input.importId); result={kind:'cancelled'}; break;
      case 'list': result={kind:'list',items:await backend.list(session)}; break;
      case 'read': result={kind:'raw',raw:await backend.read(session,input.materialId)}; break;
      case 'receipt': result={kind:'receipt',receipt:await backend.receipt(session,input.commandId)}; break;
    }
    return Result.parse(result);
  } catch(error) {
    const code=ErrorCode.safeParse(error instanceof Error?error.message:'invalid_request');
    return Result.parse({kind:'failure',code:code.success?code.data:'invalid_request'});
  }
}
