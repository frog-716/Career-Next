import {Request,Result} from './schema';
export const resumeManifest={module:'resume',schemas:{request:Request,result:Result},operations:Request.options.map(option=>option.shape.operation.value)};
