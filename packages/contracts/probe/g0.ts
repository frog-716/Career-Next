// G0 feasibility contract only; replace with slice-specific contracts after G0.
import { z } from 'zod';

export const ProbeRequest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('echo'), text: z.string().max(80) }).strict(),
  z.object({ kind: z.literal('transaction') }).strict(),
  z.object({ kind: z.literal('status') }).strict(),
  z.object({ kind: z.literal('slow-start') }).strict(),
  z.object({ kind: z.literal('stop') }).strict(),
  z.object({ kind: z.literal('snapshot') }).strict(),
]);
export type ProbeRequest = z.infer<typeof ProbeRequest>;
export const ProbeResponse = z.object({
  generation: z.string(),
  echo: z.string().optional(),
  count: z.number().int().nonnegative().optional(),
  sqlite: z.string().optional(),
  stopped: z.boolean().optional(),
  workerRunning: z.boolean().optional(),
  snapshot: z.object({ id: z.string(), text: z.string() }).strict().optional(),
}).strict();
export type ProbeResponse = z.infer<typeof ProbeResponse>;
export type ProbeBridge = {
  request(input: ProbeRequest): Promise<ProbeResponse>;
  reconnect(): Promise<{ connected: boolean }>;
  saveSecret(input: string): Promise<{ configured: boolean }>;
  secretStatus(): Promise<{ configured: boolean }>;
  print(): Promise<{ snapshotId: string; hash: string; filename: string; released: boolean }>;
};
declare global { interface Window { careerG0: ProbeBridge } }
