// Deliberately cosmetic: this protocol cannot mutate saves, rewards or combat.
export const PARTY_VERSION=1;
export const PARTY_LIMIT=8;
export const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const EMOTES={wave:'👋',cheer:'🎉',heart:'💛',ready:'✓'};
export function cleanCode(value){return typeof value==='string'?value.toUpperCase().replace(/[\s-]/g,''):''}
export function validCode(value){return /^[A-HJ-NP-Z2-9]{10}$/.test(value)}
export function formatCode(value){return value.slice(0,5)+'-'+value.slice(5)}
export function cleanName(value){return (typeof value==='string'?value:'').normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,18)||'Adventurer'}
export function cleanSnapshot(raw){
 if(!raw||!Number.isInteger(raw.world)||raw.world<0||raw.world>9||!['x','z','yaw'].every(k=>typeof raw[k]==='number'&&Number.isFinite(raw[k])))return null;
 const round=n=>Math.round(n*20)/20;
 return {world:raw.world,x:round(Math.max(-160,Math.min(160,raw.x))),z:round(Math.max(-160,Math.min(160,raw.z))),yaw:round(Math.atan2(Math.sin(raw.yaw),Math.cos(raw.yaw))),classId:['knight','ranger','mage','adventurer'].includes(raw.classId)?raw.classId:'knight',activity:['exploring','menu','fishing','arena'].includes(raw.activity)?raw.activity:'menu'};
}
