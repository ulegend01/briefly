import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,createDecipheriv} from 'node:crypto';
export const runtime='nodejs';
const dir=join(process.cwd(),'.briefly-data'), path=join(dir,'activity.json');
type Activity=Record<string,{visitors:string[];paid:boolean}>;
let queue=Promise.resolve();
async function read():Promise<Activity>{try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};throw e;}}
export async function GET(){const rows=await read();return Response.json(Object.fromEntries(Object.entries(rows).map(([id,r])=>[id,{views:r.visitors.length,paid:r.paid?1:0}])),{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){
 let b;try{b=await req.json();}catch{return new Response('Invalid JSON',{status:400});}
 if(!b||typeof b.id!=='string')return new Response('Invalid edition',{status:400});
 const editions=JSON.parse(await readFile(join(dir,'editions.json'),'utf8')) as {id:string;offer:string}[];
 const edition=editions.find(e=>e.id===b.id);if(!edition)return new Response('Not found',{status:404});
 let paid=false;
 if(typeof b.preimage==='string'){
  try{if(!/^0x[0-9a-f]{64}$/i.test(b.preimage))throw Error();const o=JSON.parse(edition.offer);const key=Buffer.from(b.preimage.slice(2),'hex');if('0x'+createHash('sha256').update(key).digest('hex')!==o.paymentHash.toLowerCase())throw Error();const bytes=Buffer.from(o.ciphertext.slice(2),'hex');const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(o.iv.slice(2),'hex'));decipher.setAuthTag(bytes.subarray(-16));decipher.update(bytes.subarray(0,-16));decipher.final();paid=true;}catch{return new Response('Invalid payment key',{status:400});}
 }else if(typeof b.visitor!=='string'||!/^[a-f0-9-]{36}$/i.test(b.visitor))return new Response('Invalid visitor',{status:400});
 const job=queue.then(async()=>{const rows=await read();const row=rows[b.id]??{visitors:[],paid:false};if(paid)row.paid=true;else if(!row.visitors.includes(b.visitor))row.visitors.push(b.visitor);rows[b.id]=row;await mkdir(dir,{recursive:true});await writeFile(path+'.tmp',JSON.stringify(rows));await rename(path+'.tmp',path);});queue=job.catch(()=>{});await job;return Response.json({ok:true});
}
