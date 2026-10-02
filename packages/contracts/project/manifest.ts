import {Request,Result} from './schema.ts';
export const projectManifest={module:'project',operations:Request.options.map(schema=>schema.shape.operation.value),schemas:{request:Request,result:Result}};
