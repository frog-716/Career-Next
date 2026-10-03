import { Request, Result } from './schema';
export const offerManifest={module:'offer',operations:Request.options.map(schema=>schema.shape.operation.value),schemas:{request:Request,result:Result}};
