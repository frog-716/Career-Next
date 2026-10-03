import {Request,Result} from './schema.ts';
export const applicationManifest={module:'application',schemas:{request:Request,result:Result},operations:Request.options.map(option=>option.shape.operation.value)};
