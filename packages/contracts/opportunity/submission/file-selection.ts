import {z} from 'zod';
export const SentFileCandidate=z.strictObject({kind:z.literal('artifact'),id:z.uuid(),name:z.string().min(1).max(255)});
export type SentFileCandidate=z.infer<typeof SentFileCandidate>;
declare global {interface Window {careerSentFiles:{select():Promise<SentFileCandidate|undefined>}}}
