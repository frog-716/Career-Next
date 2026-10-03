import {Request,Result} from './schema.ts';
export const interviewManifest={module:'interview',schemas:{request:Request,result:Result},operations:Request.options.map(option=>option.shape.operation.value)};
