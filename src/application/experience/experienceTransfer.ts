import {serializeWorkspaceUsageContent} from '../workspace/usageSnapshots';
import type {ExperienceContentAddressPort} from './experienceArtifacts';

/** Portable transport, not a second Experience or a module installer.
 * Payload semantics/admission and disclosure policy remain with the host/provider. */
export type ExperienceTransferProfile='distribution'|'continuation';
export interface ExperienceTransferBody {
 schema:'konitif.experience-transfer';schemaVersion:1;
 profile:ExperienceTransferProfile;format:string;title:string;payload:unknown;
 requirements:{toolIds:string[];capabilities:{id:string;versionRange:string;mode:'required'|'optional'}[];resources:{id:string;versionRange:string}[]};
}
export interface ExperienceTransferArtifact extends ExperienceTransferBody {contentId:string}
export const EXPERIENCE_TRANSFER_PNG_KEYWORD='konitif.experience-transfer';
export const EXPERIENCE_TRANSFER_MAX_BYTES=2*1024*1024;
export const browserExperienceTransferContent:ExperienceContentAddressPort={async sha256(text){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}};
function body(value:ExperienceTransferBody):ExperienceTransferBody {
 const candidate=JSON.parse(serializeWorkspaceUsageContent(value)) as ExperienceTransferBody;
 if(candidate.schema!=='konitif.experience-transfer'||candidate.schemaVersion!==1||!['distribution','continuation'].includes(candidate.profile)||typeof candidate.format!=='string'||!candidate.format||candidate.format.length>160||typeof candidate.title!=='string'||candidate.title.length>160||!candidate.requirements||!Array.isArray(candidate.requirements.toolIds)||!candidate.requirements.toolIds.every(t=>typeof t==='string')||!Array.isArray(candidate.requirements.capabilities)||!Array.isArray(candidate.requirements.resources)||!Object.hasOwn(candidate,'payload'))throw Error('Format de transfert d’expérience incompatible.');
 for(const r of candidate.requirements.capabilities)if(!r||typeof r.id!=='string'||typeof r.versionRange!=='string'||!['required','optional'].includes(r.mode))throw Error('Besoin de capacité invalide.');
 for(const r of candidate.requirements.resources)if(!r||typeof r.id!=='string'||typeof r.versionRange!=='string')throw Error('Besoin de ressource invalide.');
 if(new TextEncoder().encode(serializeWorkspaceUsageContent(candidate)).length>EXPERIENCE_TRANSFER_MAX_BYTES)throw Error('Expérience portable supérieure à 2 Mio.');
 return candidate;
}
export async function createExperienceTransfer(input:Omit<ExperienceTransferBody,'schema'|'schemaVersion'>,content:ExperienceContentAddressPort=browserExperienceTransferContent):Promise<ExperienceTransferArtifact>{
 const value=body({schema:'konitif.experience-transfer',schemaVersion:1,...input});
 return {...value,contentId:await content.sha256(serializeWorkspaceUsageContent(value))};
}
export async function admitExperienceTransfer(value:unknown,content:ExperienceContentAddressPort=browserExperienceTransferContent):Promise<ExperienceTransferArtifact>{
 if(!value||typeof value!=='object')throw Error('Carte d’expérience invalide.');
 const {contentId,...raw}=value as ExperienceTransferArtifact;
 if(typeof contentId!=='string'||!/^[a-f0-9]{64}$/.test(contentId))throw Error('Empreinte de carte absente.');
 const parsed=body(raw);
 if(await content.sha256(serializeWorkspaceUsageContent(parsed))!==contentId)throw Error('Le contenu de la carte ne correspond pas à son empreinte.');
 return {...parsed,contentId};
}
export function experienceTransferReference(card:ExperienceTransferArtifact){return 'urn:konitif:experience:sha256:'+card.contentId;}
export function serializeExperienceTransfer(card:ExperienceTransferArtifact){return serializeWorkspaceUsageContent(card);}

// PNG carrier uses uncompressed UTF-8 iTXt, with bounds and CRC validation.
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const signature=[137,80,78,71,13,10,26,10];
const u32=(b:Uint8Array,i:number)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(i);
function crc(bytes:Uint8Array){let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function concat(...values:Uint8Array[]){const result=new Uint8Array(values.reduce((n,v)=>n+v.length,0));let offset=0;for(const v of values){result.set(v,offset);offset+=v.length;}return result;}
function chunks(bytes:Uint8Array){
 if(signature.some((v,i)=>bytes[i]!==v)||bytes.length>12*1024*1024)throw Error('Image PNG absente ou trop volumineuse.');
 const out:{start:number;end:number;type:string;data:Uint8Array}[]=[];let offset=8;
 while(offset+12<=bytes.length){const size=u32(bytes,offset),end=offset+12+size;if(end>bytes.length)throw Error('PNG tronqué.');const type=decoder.decode(bytes.subarray(offset+4,offset+8)),data=bytes.subarray(offset+8,offset+8+size);if(crc(bytes.subarray(offset+4,offset+8+size))!==u32(bytes,offset+8+size))throw Error('Intégrité PNG invalide.');out.push({start:offset,end,type,data});offset=end;if(type==='IEND'){if(size!==0||offset!==bytes.length)throw Error('Fin PNG invalide.');return out;}}
 throw Error('Fin PNG manquante.');
}
function keyword(data:Uint8Array){const end=data.indexOf(0);return end<0?'':decoder.decode(data.subarray(0,end));}
export function embedExperienceTransferPng(bytes:Uint8Array,card:ExperienceTransferArtifact):Uint8Array {
 const all=chunks(bytes),text=encoder.encode(serializeExperienceTransfer(card));if(text.length>EXPERIENCE_TRANSFER_MAX_BYTES+4096)throw Error('Carte trop volumineuse.');
 const data=concat(encoder.encode(EXPERIENCE_TRANSFER_PNG_KEYWORD),new Uint8Array([0,0,0,0,0]),text),type=encoder.encode('iTXt'),chunk=new Uint8Array(data.length+12),view=new DataView(chunk.buffer);view.setUint32(0,data.length);chunk.set(type,4);chunk.set(data,8);view.setUint32(data.length+8,crc(concat(type,data)));
 const result=[bytes.subarray(0,8)];for(const c of all){if(c.type==='iTXt'&&keyword(c.data)===EXPERIENCE_TRANSFER_PNG_KEYWORD)continue;if(c.type==='IEND')result.push(chunk);result.push(bytes.subarray(c.start,c.end));}return concat(...result);
}
export async function readExperienceTransferPng(bytes:Uint8Array,content:ExperienceContentAddressPort=browserExperienceTransferContent):Promise<ExperienceTransferArtifact|null>{
 const matching=chunks(bytes).filter(c=>c.type==='iTXt'&&keyword(c.data)===EXPERIENCE_TRANSFER_PNG_KEYWORD);if(!matching.length)return null;if(matching.length!==1)throw Error('Plusieurs définitions concurrentes dans la carte.');
 const data=matching[0].data,start=data.indexOf(0);if(data[start+1]!==0||data[start+2]!==0)throw Error('Métadonnées PNG compressées non prises en charge.');let cursor=start+3;for(let i=0;i<2;i++){const next=data.indexOf(0,cursor);if(next<0)throw Error('Métadonnées PNG incomplètes.');cursor=next+1;}if(data.length-cursor>EXPERIENCE_TRANSFER_MAX_BYTES+4096)throw Error('Métadonnées trop volumineuses.');
 return admitExperienceTransfer(JSON.parse(decoder.decode(data.subarray(cursor))),content);
}
