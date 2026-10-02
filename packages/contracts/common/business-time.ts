import { z } from 'zod';
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
export const BusinessTime = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('unknown') }).strict(),
  z.object({ kind: z.literal('date'), date: calendarDate }).strict(),
  z.object({ kind: z.literal('instant'), instant: z.iso.datetime({ offset: true }), timezone: z.string().min(1).max(100) }).strict(),
]);
export type BusinessTime = z.infer<typeof BusinessTime>;
export const CommandId = z.uuid();
export const Revision = z.number().int().positive();
