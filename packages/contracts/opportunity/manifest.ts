import {Request,Result} from './schema.ts';
export const opportunityManifest={module:'opportunity',operations:Request.options.map(schema=>schema.shape.operation.value),schemas:{request:Request,result:Result}};
