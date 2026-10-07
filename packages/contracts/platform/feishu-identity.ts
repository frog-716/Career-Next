import {z} from 'zod';

export const FeishuConnectionState=z.enum(['not_connected','connected','connection_invalid','reauthorization_required']);
export type FeishuConnectionState=z.infer<typeof FeishuConnectionState>;
export const FeishuConnectionStatus=z.strictObject({provider:z.literal('feishu'),state:FeishuConnectionState});
export const FeishuCurrentIdentity=z.strictObject({connected:z.literal(true),provider:z.literal('feishu'),displayName:z.string().min(1).max(255),avatar:z.literal('feishu/avatar').nullable()});
export type FeishuConnectionStatus= z.infer<typeof FeishuConnectionStatus>;
export type FeishuCurrentIdentity= z.infer<typeof FeishuCurrentIdentity>;
export interface FeishuIdentityBridge {
 getConnectionStatus():Promise<FeishuConnectionStatus>;
 getCurrentIdentity():Promise<FeishuCurrentIdentity>;
 /** Uses the local connector's cached image only; no remote URL or credential crosses this bridge. */
 getAvatar():Promise<string|undefined>;
 /** Reuses user authorization to connect or refresh the cached display identity; it never selects a bot. */
 connect():Promise<FeishuConnectionStatus>;
}
declare global{interface Window{careerFeishu?:FeishuIdentityBridge}}
