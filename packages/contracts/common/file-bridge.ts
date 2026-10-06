/** Platform download is bound to a readable ResumeVersion; no path or generic blob ID. */
export interface ResumePdfBridge {download(resumeId:string,versionId:string):Promise<void>}
declare global {interface Window {careerPdf?:ResumePdfBridge;careerHost?:{stop():Promise<void>}}}
