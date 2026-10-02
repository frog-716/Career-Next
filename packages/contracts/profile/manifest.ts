import {Request,Result} from './schema.ts';
export const profileManifest={module:'profile',schemas:{request:Request,result:Result},operations:Request.options.map(option=>option.shape.operation.value)};
