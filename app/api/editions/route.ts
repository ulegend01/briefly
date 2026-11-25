import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export const runtime = 'nodejs';
const dir = join(process.cwd(), '.briefly-data');
const path = join(dir, 'editions.json');
let queue = Promise.resolve();
async function read() { try { return JSON.parse(await readFile(path,'utf8')); } catch(e) { if ((e as NodeJS.ErrnoException).code==='ENOENT') return []; throw e; } }
export async function GET() { return Response.json(await read(), {headers:{'Cache-Control':'no-store'}}); }
export async function POST(request: Request) {
  const raw = await request.text(); if(raw.length>2_000_000) return new Response('Document too large',{status:413});
  let b; try { b=JSON.parse(raw); } catch { return new Response('Invalid JSON',{status:400}); }
  if (!b || !['title','author','preview','offer'].every(k=>typeof b[k]==='string' && b[k].trim()) || b.title.length>160 || b.author.length>100 || b.preview.length>2000) return new Response('Invalid edition',{status:400});
  try { const o=JSON.parse(b.offer); if(o.version!==2 || o.cipher!=='AES-256-GCM' || !/^fibt/i.test(o.invoice) || !/^0x[0-9a-f]+$/i.test(o.ciphertext) || !/^0x[0-9a-f]{24}$/i.test(o.iv) || !/^0x[0-9a-f]{64}$/i.test(o.paymentHash)) throw Error(); } catch { return new Response('Invalid encrypted offer',{status:400}); }
  const edition={id:randomUUID(),title:b.title,author:b.author,preview:b.preview,offer:b.offer,category:['Research','Technology','Markets','Culture','Education'].includes(b.category)?b.category:'Research',cover:['forest','ink','clay','olive'].includes(b.cover)?b.cover:'forest',image:typeof b.image==='string'&&b.image.length<410000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.image)?b.image:undefined,fit:b.fit==='cover'?'cover':'contain',x:Math.max(0,Math.min(100,Number(b.x??50)||0)),y:Math.max(0,Math.min(100,Number(b.y??50)||0)),zoom:Math.max(100,Math.min(200,Number(b.zoom)||100)),minutes:Number.isInteger(b.minutes)&&b.minutes>0?b.minutes:undefined,createdAt:new Date().toISOString()};
  const job=queue.then(async()=>{await mkdir(dir,{recursive:true});const rows=await read(); rows.unshift(edition); await writeFile(path+'.tmp',JSON.stringify(rows));await rename(path+'.tmp',path);}); queue=job.catch(()=>{}); await job; return Response.json(edition,{status:201});
}
