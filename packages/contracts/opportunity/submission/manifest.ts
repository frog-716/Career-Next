import {Request,Result} from './schema.ts';
export const submissionManifest={module:'submission',operations:Request.options.map(schema=>schema.shape.operation.value),schemas:{request:Request,result:Result}};
