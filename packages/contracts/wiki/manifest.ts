import { Request,Result } from './schema.ts';
export const wikiManifest={module:'wiki',operations:Request.options.map(schema=>schema.shape.operation.value),schemas:{request:Request,result:Result}};
