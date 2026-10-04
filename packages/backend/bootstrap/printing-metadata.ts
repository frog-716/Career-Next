import {readFileSync} from 'node:fs';
import {release} from 'node:os';
import {createHash} from 'node:crypto';
/** Fixed local system fonts only; the fingerprint records the fallback set used by this print engine. */
export function printingMetadata(){
 const fonts=[['Arial','/System/Library/Fonts/Supplemental/Arial.ttf'],['Arial Unicode MS','/System/Library/Fonts/Supplemental/Arial Unicode.ttf'],['Hiragino Sans GB','/System/Library/Fonts/Hiragino Sans GB.ttc'],['PingFang SC','/System/Library/Fonts/PingFang.ttc']] as const;
 const fontVersion=fonts.map(([family,filename])=>{try{return family+'='+createHash('sha256').update(readFileSync(filename)).digest('hex').slice(0,12);}catch{return family+'=system-fallback';}}).join(';');
 return {fontVersion:'darwin-'+release()+';'+fontVersion,engineVersion:`electron-${process.versions.electron??'unavailable'};chrome-${process.versions.chrome??'unavailable'}`};
}
