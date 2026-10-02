import { z } from 'zod';
export const Identity = z.object({ protocolVersion: z.literal(1), workspaceInstance: z.uuid(), backendGeneration: z.uuid(), connectionGeneration: z.uuid() }).strict();
export type Identity = z.infer<typeof Identity>;
