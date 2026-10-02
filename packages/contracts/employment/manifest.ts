import { Request, Result } from './schema.ts';
export const employmentManifest={module:'employment',operations:Request.options.map(schema=>schema.shape.operation.value),schemas:{request:Request,result:Result}};
