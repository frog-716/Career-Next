import { Identity, Request, Result } from './schema.ts';

// Derived from the module's Zod source; no separately maintained DTO/operation registry.
export const materialsManifest = {
  module: 'materials',
  operations: Request.options.map(schema => schema.shape.operation.value),
  schemas: { identity: Identity, request: Request, result: Result },
};
