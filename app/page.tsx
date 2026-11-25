'use client';

import { Document } from './document';
import { readTestnetBalance } from '../lib/channel-funding';
import { useEffect, useRef, useState } from 'react';
import { scriptToAddress, type Channel, type FiberBrowserNode, type GetPaymentResult } from '@fiber-pay/sdk/browser';
import { decryptResult, toHex } from '../lib/crypto';
import { bottle, channelFundingCkb, connectAndOpenChannel, readChannel, ready, startRole } from '../lib/fiber';
import { createOffer, parseOffer, type EncryptedOffer } from '../lib/offer';
import { payForOffer, validateOffer } from '../lib/payment';
import { createBrowserNodeSession } from '../lib/node-session';
import { encryptedSessionKey, encryptedBuyerProfile, encryptedSellerProfile, savedNodeIdentifier, readEncryptedProgress, type EncryptedLessonProgress } from '../lib/progress';

type Edition = {id:string; title:string; author:string; preview:string; offer:string; createdAt:string; category?:string; cover?:string; image?:string; minutes?:number; fit?:string; x?:number; y?:number; zoom?:number};
type Role = 'buyer' | 'seller';
const ckb = (value: string) => `${Number(BigInt(value)) / 100_000_000}`;
const sample = `THE STATE OF BITCOIN PROGRAMMABILITY
A Briefly research edition · November 2026

EXECUTIVE SUMMARY
Bitcoin established a durable model for transferring and owning value, but building richer applications around Bitcoin involves trade-offs in programmability, security, and user experience.

1. THE PROGRAMMABILITY QUESTION
Bitcoin's scripting system is deliberately constrained. That limits what applications can express directly on its base layer and motivates complementary execution models.

2. THE CKB APPROACH
Nervos CKB uses proof of work and a Cell Model, extending the UTXO idea into programmable state. Developers can use cells to represent assets and application data with explicit ownership and validation rules.

3. RGB++ AND BITCOIN-LINKED ASSETS
RGB++ explores ways to associate Bitcoin UTXO ownership with asset state validated on CKB. Applications still need careful design around transaction coordination, wallet support, liquidity, and fees.

WHAT BUILDERS SHOULD TEST
• Can users understand which chain holds the asset state?
• What are the signing and payment steps?
• What happens when a cross-chain step fails?
• Is the resulting experience meaningfully easier than alternatives?

CONCLUSION
Bitcoin programmability is not a single feature. It is a design space shaped by settlement guarantees, ownership models, and application usability.

Briefly sample research content for a Fiber Testnet pay-to-unlock demonstration. Not financial advice.`;

const extraSamples=[
['Understanding payment channels','Technology','How can repeated payments avoid a new base-layer transaction every time?','Compare channel opening, off-chain updates and closing costs.'],
['A practical guide to the Cell Model','Education','How can a cell represent both value and application state?','Trace inputs, outputs and validation rules in a simple transaction.'],
['Measuring community retention','Research','Which members return after their first interaction?','Build weekly cohorts and compare repeat participation.'],
['The cost of failed payments','Markets','What happens to a merchant when payment confirmation is delayed?','Measure abandoned orders, support time and reconciliation costs.'],
['Designing accessible interfaces','Technology','Can people navigate a product without relying on color alone?','Test keyboard navigation, contrast and descriptive labels.'],
['Digital ownership and culture','Culture','How do online communities establish shared ownership?','Compare attribution, access and governance practices.'],
['Research methods for beginners','Education','How can a reader distinguish evidence from opinion?','Compare primary sources and document uncertainty.'],
['Understanding liquidity','Markets','Why can a funded wallet still fail to route a payment?','Compare available balance with directional channel capacity.'],
['Privacy in everyday payments','Technology','What information does a payment reveal to each participant?','Map the data visible to sender, recipient and intermediaries.'],
['The future of independent journalism','Culture','How can small publishers maintain editorial independence?','Compare subscriptions, direct purchases and sponsorship incentives.'],
['Testing onboarding flows','Research','Where do new users abandon a product?','Observe first-time users and classify failure points.'],
['Introduction to cryptographic hashes','Education','Why does a small change in input produce a different digest?','Compare sample digests and distinguish hashing from encryption.'],
['Pricing digital knowledge','Markets','How should publishers evaluate one-time purchase pricing?','Compare conversion, revenue and reader feedback at different prices.'],
['Building resilient applications','Technology','How should applications recover after interrupted requests?','Test retries, duplicate submissions and persistent state.'],
['Online communities and reputation','Culture','How does reputation emerge from repeated contributions?','Compare peer recognition and measurable participation.'],
['Evaluating research quality','Education','What makes a claim reproducible?','Record methods, inputs and independent verification steps.'],
['Small business bookkeeping','Markets','Which records help merchants understand cash flow?','Separate sales, expenses, receivables and inventory movements.'],
['Understanding encrypted documents','Technology','How can a reader verify that premium content remains locked?','Test decryption with an incorrect key and with the intended key.'],
['Designing useful analytics','Research','Which metrics reflect actual user value?','Separate visits, completed actions and repeat usage.'],
['The economics of creator communities','Culture','How can creators build sustainable relationships with readers?','Compare engagement, repeat purchases and direct feedback.']];
export default function Page() {
  const nodes = useRef<Partial<Record<Role, FiberBrowserNode>>>({});
  const sessions = useRef<Partial<Record<Role, ReturnType<typeof createBrowserNodeSession>>>>({});
  const progress = useRef<EncryptedLessonProgress | null>(null);
  const locked = useRef(false);
  const [view, setView] = useState<'read' | 'publish' | 'wallet' | 'library' | 'dashboard'>('read');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addresses, setAddresses] = useState<Partial<Record<Role, string>>>({});
  const [balances, setBalances] = useState<Partial<Record<Role, string>>>({});
  const [checks, setChecks] = useState<Partial<Record<Role, string>>>({});
  const [copied, setCopied] = useState<Role | null>(null);
  const [connected, setConnected] = useState<Partial<Record<Role, boolean>>>({});
  const [channels, setChannels] = useState<Partial<Record<Role, Channel>>>({});
  const [plaintext, setPlaintext] = useState('');
  const [title,setTitle]=useState(''); const [author,setAuthor]=useState(''); const [preview,setPreview]=useState('');
  const [editions,setEditions]=useState<Edition[]>([]); const [selected,setSelected]=useState<Edition|null>(null); const [importText,setImportText]=useState(''); const [search,setSearch]=useState('');
  async function loadEditions(){const r=await fetch('/api/editions',{cache:'no-store'});if(!r.ok)throw Error('Could not load publications');const rows:Edition[]=await r.json();setEditions(rows);try{const saved=JSON.parse(localStorage.getItem('briefly:metadata:v8')||'{}');for(const e of rows){const {offer,...meta}=e;saved[e.id]={...meta,offer:''};}setArchive(saved);localStorage.setItem('briefly:metadata:v8',JSON.stringify(saved));}catch{}void fetch("/api/activity",{cache:"no-store"}).then(r=>r.json()).then(setMetrics).catch(()=>{});return rows;}
  useEffect(()=>{void loadEditions().then(rows=>{const id=new URLSearchParams(location.search).get('edition');const e=rows.find(x=>x.id===id);if(e)selectEdition(e);}).catch(e=>setError(String(e)));},[]);
  function selectEdition(e:Edition){if(e.id){let visitor=localStorage.getItem("briefly:visitor");if(!visitor){visitor=crypto.randomUUID();localStorage.setItem("briefly:visitor",visitor);}void fetch("/api/activity",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:e.id,visitor})}).catch(()=>{});}setSelected(e);setReceived(e.offer);setOffer(null);setTested(false);setPayment(null);setKey('');setDecrypted(e.id ? (JSON.parse(localStorage.getItem('briefly:library:v4')||'{}')[e.id]||'') : '');setAttempt('');setStatus('');setError('');setView('read');history.replaceState(null,'',e.id?'?edition='+encodeURIComponent(e.id):location.pathname);}
  const [category,setCategory]=useState('Research'); const [cover,setCover]=useState('forest');
  const [image,setImage]=useState(''); const [fit,setFit]=useState("contain"); const [x,setX]=useState(50); const [y,setY]=useState(50); const [zoom,setZoom]=useState(100); const [importOpen,setImportOpen]=useState(false); const [ledger,setLedger]=useState<Record<string,{title:string;id:string;fee:string;date:string}>>({}); const [metrics,setMetrics]=useState<Record<string,{views:number;paid:number}>>({}); const [sampleIndex,setSampleIndex]=useState(0); const [draftReady,setDraftReady]=useState(false); const [editorPreview,setEditorPreview]=useState(false);
  const [archive,setArchive]=useState<Record<string,Edition>>({}); const [importError,setImportError]=useState(''); const [walletRole,setWalletRole]=useState<Role>('buyer'); const [walletReturn,setWalletReturn]=useState<'read'|'publish'|null>(null);
  function setupWallet(role:Role, destination:'read'|'publish'){setWalletRole(role);setWalletReturn(destination);setView('wallet');setError('');setStatus('');}
  useEffect(()=>{if(!importOpen)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setImportOpen(false)};window.addEventListener('keydown',close);return ()=>window.removeEventListener('keydown',close)},[importOpen]);
  const [filter,setFilter]=useState('All'); const [library,setLibrary]=useState<Record<string,string>>({});
  const [published,setPublished]=useState<string[]>([]);
  useEffect(()=>{try{setLibrary(JSON.parse(localStorage.getItem('briefly:library:v4')||'{}'));setPublished(JSON.parse(localStorage.getItem('briefly:published:v4')||'[]'));setLedger(JSON.parse(localStorage.getItem('briefly:ledger:v7')||'{}'));setArchive(JSON.parse(localStorage.getItem('briefly:metadata:v8')||'{}'));}catch{}},[]);

  useEffect(()=>{try{const d=JSON.parse(localStorage.getItem('briefly:draft:v6')||'null');if(d){setTitle(d.title||'');setAuthor(d.author||'');setPlaintext(d.text||'');setCategory(d.category||'Research');setCover(d.cover||'forest');setImage(d.image||'');setFit(d.fit||'contain');setX(d.x??50);setY(d.y??50);setZoom(d.zoom??100);}}catch{}setDraftReady(true)},[]);
  useEffect(()=>{if(draftReady)try{localStorage.setItem('briefly:draft:v6',JSON.stringify({title,author,text:plaintext,category,cover,image,fit,x,y,zoom}));}catch{}},[draftReady,title,author,plaintext,category,cover,image,fit,x,y,zoom]);
  useEffect(()=>{const t=setInterval(()=>{if(!locked.current)void loadEditions().catch(()=>{});},15000);return ()=>clearInterval(t)},[]);
  const visible=editions.filter(e=>(filter==='All'||(e.category||'Research')===filter)&&(e.title+' '+e.author+' '+e.preview+' '+(e.category||'Research')).toLowerCase().includes(search.trim().toLowerCase()));
  const marker='\n<!-- paywall -->\n';
  const publicText=plaintext.split(marker)[0];
  const hasPaywall=plaintext.includes(marker)&&!!plaintext.split(marker).slice(1).join(marker).trim();
  function insertFormat(before:string,after=''){const el=document.getElementById('draft-editor') as HTMLTextAreaElement|null;if(!el)return;const a=el.selectionStart,b=el.selectionEnd;setPlaintext(plaintext.slice(0,a)+before+plaintext.slice(a,b)+after+plaintext.slice(b));}
  function lookup(input:string,rows=editions){let id=input.trim();try{id=new URL(id,location.origin).searchParams.get('edition')||id;}catch{}return rows.find(e=>e.id===id||(()=>{try{return parseOffer(e.offer).paymentHash.toLowerCase()===id.toLowerCase()}catch{return false}})());}
  function importHint(input:string){if(!input.trim())return '';if(lookup(input))return 'Publication found. Ready to open.';if(input.trim().startsWith('{')){try{parseOffer(input);return 'Encrypted offer format recognized.'}catch{return 'Invalid encrypted offer JSON.'}}return 'No matching publication on this marketplace.';}
  async function smartImport(){setImportError('');try{const input=importText.trim();const rows=await loadEditions();const match=lookup(input,rows);if(match){selectEdition(match);setImportOpen(false);setImportText('');setSearch('');return;}if(input.startsWith('{')){const parsed=parseOffer(input);const known=lookup(parsed.paymentHash,rows);selectEdition(known||{id:'',title:'Imported document',author:'Independent publisher',preview:'This encrypted offer has no public preview.',offer:input,createdAt:''});setImportOpen(false);setImportText('');setSearch('');return;}throw Error('Publication not found. Check the complete link or payment hash.');}catch(e){setImportError(e instanceof Error?e.message:String(e));}}
  const [generated, setGenerated] = useState('');
  const [received, setReceived] = useState('');
  const [offer, setOffer] = useState<EncryptedOffer | null>(null);
  const [attempt, setAttempt] = useState('');
  const [tested, setTested] = useState(false);
  const [payment, setPayment] = useState<GetPaymentResult | null>(null);
  const [key, setKey] = useState('');
  const [decrypted, setDecrypted] = useState('');
    useEffect(()=>{if(!decrypted||!selected?.id)return;setLibrary(old=>{const next={...old,[selected.id]:decrypted};localStorage.setItem('briefly:library:v4',JSON.stringify(next));return next;});},[decrypted,selected]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = readEncryptedProgress(sessionStorage, localStorage);
    progress.current = saved;

    setLoaded(true);
    const owned = sessions.current;
    const stop = () => { for (const session of Object.values(owned)) void session.stop().catch(() => {}); };
    window.addEventListener('pagehide', stop);
    return () => { window.removeEventListener('pagehide', stop); stop(); nodes.current = {}; sessions.current = {}; };
  }, []);

  function save(update: Partial<EncryptedLessonProgress>) {
    // Store payment attempts by invoice, independent of the publisher profile.
    const hash = update.attemptedPaymentHash || offer?.paymentHash;
    if (hash && update.attemptedPaymentHash !== undefined) { const id=savedNodeIdentifier(localStorage,encryptedBuyerProfile); localStorage.setItem('briefly:attempt:'+id+':'+hash,update.attemptedPaymentHash); }

  }

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (failure) { const message = failure instanceof Error ? failure.message : String(failure); if (/node is not running|call start\(\) first/i.test(message)) { const role:Role = view==='publish'?'seller':view==='wallet'?walletRole:'buyer'; setConnected(previous=>({...previous,[role]:false})); setChannels(previous=>({...previous,[role]:undefined})); setError('Your '+(role==='seller'?'publisher':'reader')+' wallet is offline. Open Wallet and reconnect it before continuing. If it is already open, close other Briefly tabs and reload this page. Your saved draft and wallet keys are retained.'); } else setError(message || 'Action failed. Check status before retrying a transfer.'); }
    finally { locked.current = false; setBusy(false); }
  }

  async function refresh(role: Role) {
    const node = nodes.current[role];
    if (!node) { setChecks(previous => ({...previous, [role]: 'Start node to check status.'})); return; }
    const results = await Promise.allSettled([readChannel(node), node.listPeers(), readTestnetBalance(node)] as const);
    if (results[0].status === 'fulfilled') {
      const channel = results[0].value;
      setChannels(previous => ({...previous, [role]: channel}));
      setChecks(previous => ({...previous, [role]: channel ? `Channel: ${channel.state.state_name}` : 'No channel found. Your wallet is not necessarily empty.'}));
    } else {const reason=results[0].reason;setChecks(previous => ({...previous, [role]: `Channel check failed: ${String(reason)}`}));}
    if (results[1].status === 'fulfilled') {const peers=results[1].value.peers;setConnected(previous => ({...previous, [role]: peers.some(peer => peer.pubkey.replace(/^0x/i, '').toLowerCase() === bottle.pubkey.slice(2))}));}
    if (results[2].status === 'fulfilled') {const balance=results[2].value;setBalances(previous => ({...previous, [role]: ckb(`0x${balance.toString(16)}`)}));}
    else setBalances(previous => ({...previous, [role]: 'Unavailable'}));
  }

  async function copyAddress(role: Role) {
    const address = addresses[role];
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(role);
  }

  async function start(role: Role) {
    if (nodes.current[role]?.isRunning) { await refresh(role); return; }
    if (sessions.current[role]) { await sessions.current[role]!.stop(); delete sessions.current[role]; delete nodes.current[role]; }
    const session = sessions.current[role] ??= createBrowserNodeSession();
    let started: FiberBrowserNode | undefined;
    await session.start(role === 'buyer' ? encryptedBuyerProfile : encryptedSellerProfile, async (track) => {
      started = await startRole(role, track);
    });
    if (!started) return;
    nodes.current[role] = started;
    const info = await started.nodeInfo();
    setAddresses((previous) => ({ ...previous, [role]: scriptToAddress(info.default_funding_lock_script, 'testnet') }));
    if (await readChannel(started)) await started.connectPeer(bottle);
    await refresh(role);
  }

  async function open(role: Role) {
    const node = nodes.current[role];
    if (!node) return;
    const channel = await connectAndOpenChannel(node);
    setChannels((previous) => ({ ...previous, [role]: channel }));
    await refresh(role);
    setStatus(channel && ready(channel) ? 'Channel ready.' : 'Opening submitted. Check channel status after confirmation.');
  }

  async function moveLiquidity() {
    const node = nodes.current.seller;
    if (!node) return;
    const id = savedNodeIdentifier(localStorage, encryptedSellerProfile);
    const storageKey = `fiber-docs:encrypted-inbound:${id}`;
    const existing = sessionStorage.getItem(storageKey);
    if (existing === 'submitting') throw new Error('Transfer outcome unknown. Review payment history before sending again.');
    let result: GetPaymentResult;
    if (existing) result = await node.getPayment({ payment_hash: existing as `0x${string}` });
    else {
      sessionStorage.setItem(storageKey, 'submitting');
      result = await node.sendPayment({ target_pubkey: bottle.pubkey, amount: '0x1dcd65000', keysend: true });
      sessionStorage.setItem(storageKey, result.payment_hash);
    }
    if (!['Success', 'Failed'].includes(result.status)) result = await node.waitForPayment(result.payment_hash, { timeout: 60_000, interval: 1_000 });
    if (result.status === 'Failed') sessionStorage.removeItem(storageKey);
    setStatus(`Liquidity transfer: ${result.status}`);
    await refresh('seller');
  }

  async function makeOffer() {
    if (!nodes.current.seller || !channels.seller || !sellerReady) throw Error('Prepare your receiving wallet first.');
    if(!title.trim()||!author.trim()||!publicText.trim()||!hasPaywall||publicText.length>2000) throw Error('Complete all publication fields.');
    const value = await createOffer(nodes.current.seller, channels.seller, plaintext.replace(marker,"\n\n"));
    const response=await fetch('/api/editions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,author,preview:publicText,offer:value,category,cover,image,fit,x,y,zoom,minutes:Math.max(1,Math.ceil(plaintext.split(/\s+/).length/220))})}); if(!response.ok)throw Error(await response.text()); const edition:Edition=await response.json(); setGenerated(value); const ids=[...published,edition.id];setPublished(ids);localStorage.setItem('briefly:published:v4',JSON.stringify(ids)); await loadEditions(); selectEdition(edition); setStatus('Edition published. Share its link with a reader.');setTitle('');setPlaintext('');setImage('');
  }

  async function validate() {
    if (!nodes.current.buyer) return;
    const parsed = parseOffer(received);
    await validateOffer(nodes.current.buyer, parsed);
    setAttempt(localStorage.getItem('briefly:attempt:'+savedNodeIdentifier(localStorage,encryptedBuyerProfile)+':'+parsed.paymentHash)??'');
    save({ buyerOfferText: received }); setOffer(parsed); setStatus('Offer validated.');
  }

  async function testLock() {
    if (!offer) return;
    try { await decryptResult(offer, toHex(crypto.getRandomValues(new Uint8Array(32)))); }
    catch { save({ triedWithoutKey: true }); setTested(true); setStatus('Decryption rejected. Pay 1 CKB to access this document. The payment key is unavailable until settlement.'); }
  }

  async function pay() {
    if (!nodes.current.buyer || !offer || !routeReady) return;
    const result = await payForOffer(nodes.current.buyer, offer, attempt, (hash) => {
      save({ attemptedPaymentHash: hash }); setAttempt(hash);
    }, payment?.status === 'Failed');
    acceptPayment(result);
    if (result.status === 'Success' && result.payment_preimage) {setDecrypted(await decryptResult(offer, result.payment_preimage)); await recordReceipt(result);}
    await refresh('buyer');
  }

  async function recordReceipt(result:GetPaymentResult){
    if(!selected||!result.payment_preimage)return;
    const entry={title:selected.title,id:selected.id,fee:ckb(result.fee),date:new Date().toISOString()};
    const next={...JSON.parse(localStorage.getItem('briefly:ledger:v7')||'{}'),[result.payment_hash]:entry};
    localStorage.setItem('briefly:ledger:v7',JSON.stringify(next));setLedger(next);
    if(selected.id){try{const r=await fetch('/api/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id,preimage:result.payment_preimage})});if(!r.ok)throw Error();await loadEditions();}catch{setStatus('Content unlocked. Dashboard receipt sync failed. The purchase is saved locally.');}}
  }
  function coverStyle(e:{image?:string;fit?:string;x?:number;y?:number;zoom?:number}){return e.image?{backgroundImage:`url(${e.image})`,backgroundSize:(e.zoom||100)>100?`${e.zoom}% auto`:e.fit||'contain',backgroundPosition:`${e.x??50}% ${e.y??50}%`,backgroundRepeat:'no-repeat',color:'white'}:undefined;}
  const sales=published.reduce((n,id)=>n+(metrics[id]?.paid||0),0);
  const visits=published.reduce((n,id)=>n+(metrics[id]?.views||0),0);
  function acceptPayment(result: GetPaymentResult) {
    setPayment(result); setStatus(`Payment: ${result.status}`);
    if (result.status === 'Failed') setError(result.failed_error ?? 'Payment failed. Check channel liquidity before retrying.');
    if (result.status === 'Success' && result.payment_preimage) setKey(result.payment_preimage);
  }

  async function checkPayment() {
    if (!nodes.current.buyer || !offer || !attempt) return;
    await validateOffer(nodes.current.buyer, offer);
    const result = await nodes.current.buyer.getPayment({ payment_hash: attempt as `0x${string}` });
    acceptPayment(result);
    if (result.status === 'Success' && result.payment_preimage) {setDecrypted(await decryptResult(offer, result.payment_preimage)); await recordReceipt(result);}
  }

  function startAnotherOffer() {
    if (busy || (attempt && payment?.status !== 'Failed')) return;
    save({ generatedOffer: '', buyerOfferText: '', attemptedPaymentHash: '', triedWithoutKey: false, completedSteps: [] });
    setGenerated(''); setReceived(''); setOffer(null); setAttempt(''); setTested(false);
    setPayment(null); setKey(''); setDecrypted(''); setError('');
    setStatus('Create a fresh encrypted offer.');
  }

  const routeReady = Boolean(nodes.current.buyer?.isRunning && connected.buyer && channels.buyer && ready(channels.buyer) && BigInt(channels.buyer.local_balance)>=100_000_000n);
  const sellerReady = Boolean(nodes.current.seller?.isRunning && connected.seller && channels.seller && ready(channels.seller) && BigInt(channels.seller.remote_balance)>=100_000_000n);

  useEffect(() => {
    const timer = window.setInterval(() => { if (!locked.current) for (const role of ['buyer','seller'] as const) if (nodes.current[role]) void refresh(role); }, 12000);
    return () => window.clearInterval(timer);
  }, []);
  return <main>
    <header><a className="brand" href="#" onClick={e=>{e.preventDefault();if(!busy){setSelected(null);setView('read');setStatus('');setError('');history.replaceState(null,'',location.pathname);}}}><span className="mark">b.</span> briefly.</a><nav>{(['read','library','publish','dashboard','wallet'] as const).map(v=><button key={v} className={view===v?'active':''} disabled={busy} onClick={()=>{setView(v);setStatus('');setError('');setImportOpen(false);setWalletReturn(null);if(v==='read')setSelected(null);history.replaceState(null,'',location.pathname);}}>{v==='read'?'Explore':v==='publish'?'Studio':v==='library'?'Library':v==='dashboard'?'Dashboard':'Wallet'}</button>)}</nav><span className="network">● Testnet</span></header>
    {error && <div className="notice error" role="alert">{error}<button className="dismiss" onClick={()=>setError('')}>×</button></div>}{status && <div className="notice" role="status">{status}<button className="dismiss" onClick={()=>setStatus('')}>×</button></div>}
    {view==='read' && <>{!selected?<><div className="intro"><span className="kicker">INDEPENDENT PUBLISHING / POWERED BY FIBER</span><h1>Ideas worth<br/>paying for<span>.</span></h1><p>Discover independent research. Unlock individual editions with CKB.</p><button className="primary compact" onClick={()=>setView('publish')}>Start publishing →</button>{!routeReady&&<div className="explore-wallet"><p>{addresses.buyer?"Prepare your reader wallet to unlock paid publications.":"Set up your testnet wallet to purchase publications. You can browse without one."}</p><button className="secondary compact" disabled={busy} onClick={()=>setupWallet('buyer','read')}>{addresses.buyer?"Finish wallet setup":"Set up your wallet"} →</button></div>}</div>{!search&&filter==='All'&&editions[0]&&<button className="featured" onClick={()=>selectEdition(editions[0])}><div className={"cover "+(editions[0].cover||"forest")} style={coverStyle(editions[0])}><span>FEATURED · NEWEST PUBLICATION</span><h2>{editions[0].title}</h2></div><div><span className="kicker">{editions[0].category||"Research"}</span><h2>{editions[0].title}</h2><p>{editions[0].preview.slice(0,180)}…</p><p className="muted">Featured automatically because it is the newest edition.</p><strong>Read edition →</strong></div></button>}<div className="toolbar"><input aria-label="Search publications" placeholder="Search titles, authors or topics" value={search} onChange={e=>{const v=e.target.value;if(/^(https?:|0x[0-9a-f]{8}|\{)/i.test(v)){setImportText(v);setImportOpen(true);setSearch('');setImportError('')}else setSearch(v)}}/><button className="secondary" onClick={()=>{setSearch('');setFilter('All')}}>Clear</button><button className="primary" onClick={()=>setImportOpen(!importOpen)}>Open publication link</button></div>{importOpen&&<div className="modal-backdrop" onClick={()=>setImportOpen(false)}><section className="panel import-dialog" role="dialog" aria-modal="true" aria-label="Open shared publication" onClick={e=>e.stopPropagation()}><button className="dismiss" aria-label="Close" onClick={()=>setImportOpen(false)}>×</button><h2>Open a shared publication</h2><p>Paste a Briefly link or encrypted offer.</p><textarea autoFocus value={importText} onChange={e=>{setImportText(e.target.value);setImportError('')}} placeholder="Publication link, payment hash or encrypted offer JSON"/><p role="status" className="muted">{importHint(importText)}</p>{importError&&<p role="alert" style={{color:"#a12626"}}>{importError}</p>}<button className="primary" disabled={!importText.trim()||busy} onClick={()=>void run(smartImport)}>Open document</button></section></div>}<div className="filters">{['All','Research','Technology','Markets','Culture','Education'].map(c=><button className={filter===c?'chosen':''} key={c} onClick={()=>setFilter(c)}>{c}</button>)}</div><div className="section-heading"><h2>{search?"Search results":"Latest editions"}</h2><span>{visible.length} publications</span></div>{!visible.length&&editions.length>0&&<p>No matching publications. Try another search.</p>}<div className="catalog">{visible.map(e=><button className="edition" key={e.id} onClick={()=>selectEdition(e)}><div className={"cover "+(e.cover||"forest")} style={coverStyle(e)}><span>BRIEFLY / {e.category||"RESEARCH"}</span><div className="symbol">◇</div><h2>{e.title}</h2></div><div className="article"><h2>{e.title}</h2><span className="kicker">{e.author}</span><p>{e.preview.slice(0,140)}…</p><div className="byline">{new Date(e.createdAt).toLocaleDateString()} · {e.minutes||1} min read · {library[e.id]?"In your library":"1 CKB"}</div><strong>{library[e.id]?"Continue reading":"Read preview →"}</strong></div></button>)}</div>{!editions.length&&<section className="panel"><h2>The research desk is open.</h2><p>Publish the first edition from Creator Studio.</p></section>}</>:<><button className="back" onClick={()=>{setSelected(null);history.replaceState(null,'',location.pathname)}}>← All research</button><div className={decrypted?"feature unlocked":"feature"}><article><div className={"cover "+(selected.cover||"forest")} style={coverStyle(selected)}><span>BRIEFLY / {selected.category||"RESEARCH"}</span><div className="symbol">◇</div><h2>{selected.title}</h2></div><div className="article"><h1>{selected.title}</h1><span className="kicker">{selected.author}</span><div className="byline">{selected.createdAt?new Date(selected.createdAt).toLocaleDateString():"Imported edition"} · {Math.max(1,Math.ceil((decrypted||selected.preview).split(/\s+/).length/220))} min read{decrypted?" · Unlocked":" · Preview"}</div>{decrypted?<Document content={decrypted}/>:<><div className="preview"><Document content={selected.preview}/><div className="redacted"><i/><i/><i/><i/></div></div><p className="muted">🔒 The rest of this edition is encrypted.</p></>}</div></article><aside><span className="kicker">{decrypted?'PURCHASED':'FULL EDITION'}</span><h2>1 <small>CKB</small></h2><p>{decrypted?'You have unlocked this document.':'One payment. Access the complete document.'}</p>{!decrypted&&<>{!routeReady&&<p className="wallet-hint">To purchase, start your reader wallet and open a funded payment channel. You can read previews without a wallet.</p>}<button className="primary" disabled={busy} onClick={()=>void run(async()=>{if(!routeReady){setupWallet('buyer','read');return;}if(!offer){await validate();return;}if(attempt&&payment?.status!=='Failed'){await checkPayment();return;}await pay();})}>{busy?'Working…':!routeReady?'Set up reader wallet':!offer?'Review purchase':attempt&&payment?.status!=='Failed'?'Recover / check payment':'Pay 1 CKB & unlock'}</button><button className="secondary" disabled={busy} onClick={()=>void run(async()=>{const parsed=parseOffer(received);try{await decryptResult(parsed,toHex(crypto.getRandomValues(new Uint8Array(32))));throw Error('Unexpected decryption result');}catch(e){if(e instanceof Error&&e.message==='Unexpected decryption result')throw e;setTested(true);}})}>Try decrypting without payment</button>{tested&&<div className="notice error" role="alert">Decryption rejected. Pay 1 CKB to access this document. The key is released after payment.</div>}</>}{selected.id&&<button className="secondary" onClick={()=>void run(async()=>{await navigator.clipboard.writeText(location.origin+'/?edition='+selected.id);setStatus('Publication link copied.');})}>Copy publication link</button>}<details><summary>Encrypted offer</summary><textarea readOnly value={received}/><button className="secondary" onClick={()=>void run(async()=>{await navigator.clipboard.writeText(received);setStatus('Offer copied.');})}>Copy offer</button></details></aside></div>{payment?.status==='Success'&&<section className="panel"><h2>Payment receipt</h2><p>1 CKB + {ckb(payment.fee)} CKB network fee</p><code>{payment.payment_hash}</code></section>}</>}</>}
    {view==='publish'&&<><div className="section-heading studio-head"><div><span className="kicker">CREATOR STUDIO</span><h2>Write your next edition.</h2></div><span className="muted">Draft saved on this browser</span></div><div className="studio-layout"><section className="panel editor"><input className="title-input" placeholder="Publication title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={160}/><div className="formatbar">{[['Bold','**','**'],['Italic','*','*'],['Heading','\n## ',''],['Quote','\n> ',''],['List','\n- ','']].map(([label,a,b])=><button key={label} onClick={()=>insertFormat(a,b)}>{label}</button>)}<button onClick={()=>{if(!plaintext.includes(marker))insertFormat(marker)}}>+ Paywall</button><button onClick={()=>setEditorPreview(!editorPreview)}>{editorPreview?'Edit':'Preview'}</button></div>{editorPreview?<Document content={plaintext.replace(marker,'\n\n---\n\n')}/>:<textarea id="draft-editor" placeholder="Write your article here. Insert a paywall where the free preview ends." value={plaintext} onChange={e=>setPlaintext(e.target.value)}/>}<div className="paywall-status">{hasPaywall?'✓ Paywall inserted. The full article is encrypted; only the text above is public.':'Insert a paywall to separate public and paid content.'} · {publicText.length}/2000 preview characters</div><label>Import Markdown or text<input type="file" accept=".txt,.md,text/plain" onChange={e=>{const f=e.target.files?.[0];if(f)void run(async()=>{if(f.size>500000)throw Error('File too large');setPlaintext(await f.text())})}}/></label><button className="secondary" onClick={()=>{const examples=[['The state of Bitcoin programmability','Technology',sample.split('1. THE')[0],sample.slice(sample.indexOf('1. THE'))],['Designing for trust','Research','Trust begins with predictable interactions. Users need to understand what a product will do before committing money.','## Practical research\nTest comprehension before conversion. Ask readers to explain the payment flow in their own words.\n## Conclusion\nClear feedback and recoverable errors are essential.'],['The economics of independent publishing','Markets','Small payments can support niche writing when the cost of purchasing is low.','## Distribution\nPublishers need discovery, repeat readers and transparent settlement.\n## Measuring success\nTrack paid readers and repeat purchases, not just impressions.']];for(const [topic,cat,question,method] of extraSamples)examples.push([topic,cat,`# ${topic}\n\n${question}`,`## Research approach\n${method}\n\n## Evaluation\nDocument assumptions, compare alternatives and record limitations before drawing conclusions.`]);const [t,c,free,paid]=examples[sampleIndex%examples.length];setSampleIndex(sampleIndex+1);setTitle(t);setAuthor('Briefly Research');setCategory(c);setPlaintext(free.trim()+marker+paid);setEditorPreview(false)}}>Try a different sample draft</button></section><aside className="studio-settings"><h2>Publication settings</h2><label>Author<input value={author} onChange={e=>setAuthor(e.target.value)} maxLength={100}/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{['Research','Technology','Markets','Culture','Education'].map(c=><option key={c}>{c}</option>)}</select></label><label>Cover style<select value={cover} onChange={e=>setCover(e.target.value)}>{['forest','ink','clay','olive'].map(c=><option key={c}>{c}</option>)}</select></label><div className={"cover studio-cover "+cover} style={coverStyle({image,fit,x,y,zoom})}><span>{category}</span><h2>{title||'Your title'}</h2></div><label>Upload cover (JPEG, PNG, WebP) · Recommended 1280 × 720, 16:9 · Max 300 KB<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>300000){setError('Cover must be under 300 KB');return;}const r=new FileReader();r.onload=()=>setImage(String(r.result));r.readAsDataURL(f)}}/></label>{image&&<div className="cover-controls"><label>Image fit<select value={fit} onChange={e=>{setFit(e.target.value);setZoom(100)}}><option value="contain">Fit entire image</option><option value="cover">Fill frame</option></select></label><label>Horizontal position<input type="range" min="0" max="100" value={x} onChange={e=>setX(+e.target.value)}/></label><label>Vertical position<input type="range" min="0" max="100" value={y} onChange={e=>setY(+e.target.value)}/></label><label>Zoom<input type="range" min="100" max="200" value={zoom} onChange={e=>setZoom(+e.target.value)}/></label><button onClick={()=>setImage('')}>Remove cover</button></div>}<p><strong>1 CKB</strong> · Testnet single purchase</p>{!sellerReady&&<p className="wallet-hint">Start your publisher wallet and prepare receiving capacity before publishing. Your draft stays saved.</p>}<button className="primary" disabled={busy||!sellerReady||!title.trim()||!author.trim()||!hasPaywall||!publicText.trim()||publicText.length>2000} onClick={()=>void run(makeOffer)}>Encrypt & publish</button>{!sellerReady&&<button className="secondary" onClick={()=>setupWallet('seller','publish')}>Set up receiving wallet</button>}<p className="muted">Publisher must remain online. Only the preview and encrypted document are listed.</p></aside></div></>}
    {view==='library'&&<><div className="intro"><span className="kicker">YOUR COLLECTION</span><h1>My library<span>.</span></h1><p>{Object.keys(library).length} purchased editions · Saved on this browser</p></div><div className="catalog">{Object.entries(library).map(([id,content])=>{const e=editions.find(x=>x.id===id)||archive[id];const recovered=Object.values(ledger).find(t=>t.id===id)?.title||content.split(/\r?\n/).map(l=>l.replace(/^#+\s*/, '').trim()).find(Boolean)?.slice(0,100)||'Archived edition';return <section className="edition" key={id}><div className={"cover "+(e?.cover||'forest')} style={coverStyle(e||{})}><span>UNLOCKED</span><h2>{e?.title||recovered}</h2></div><div className="article"><h2>{e?.title||recovered}</h2><p>{e?.author||'Independent publisher'}</p><button className="primary" onClick={()=>selectEdition(e||{id,title:recovered,author:'Independent publisher',preview:'',offer:'',createdAt:''})}>Continue reading</button><button className="secondary" onClick={()=>{const a=document.createElement('a');const url=URL.createObjectURL(new Blob([content],{type:'text/plain'}));a.href=url;a.download='briefly-research.txt';a.click();URL.revokeObjectURL(url)}}>Download text</button></div></section>})}</div>{!Object.keys(library).length&&<section className="panel">Your purchased editions will appear here.</section>}</>}
    {view==='dashboard'&&<><div className="intro"><span className="kicker">PUBLISHER WORKSPACE</span><h1>Your publications<span>.</span></h1><p>Editions published from this browser. Activity recorded since V7. Earlier payments are not automatically imported.</p>{published.some(id=>!editions.some(e=>e.id===id))&&<p className="muted">{published.filter(id=>!editions.some(e=>e.id===id)).length} older publication references are missing from this server. Restore your previous .briefly-data folder to recover their listings.</p>}</div><section className="panel"><div className="stats"><div><span>Published editions</span><h2>{editions.filter(e=>published.includes(e.id)).length}</h2></div><div><span>Recorded earnings</span><h2>{sales} CKB</h2></div><div><span>Paid editions (single-use)</span><h2>{sales}</h2></div><div><span>Unique browser views</span><h2>{visits}</h2></div></div><button className="primary" onClick={()=>setView('publish')}>Create edition</button></section>{editions.filter(e=>published.includes(e.id)).map(e=><section className="panel" key={e.id}><span className="kicker">{e.category||'Research'}</span><h2>{e.title}</h2><p>1 CKB · {metrics[e.id]?.views||0} views · {metrics[e.id]?.paid||0} receipts</p><button className="secondary" onClick={()=>selectEdition(e)}>View publication</button><button className="secondary" onClick={()=>void run(async()=>{await navigator.clipboard.writeText(location.origin+'/?edition='+e.id);setStatus('Publication link copied.');})}>Copy link</button></section>)}</>}
    {view==='wallet'&&<><div className="intro"><span className="kicker">PAYMENT SETTINGS</span><h1>Your wallet<span>.</span></h1><p>Briefly uses two separate testnet wallets in this browser. Start the wallet for your role before paying or publishing. Keep the publisher node online while accepting payments.</p></div><div className="filters wallet-switch"><button className={walletRole==='buyer'?'chosen':''} onClick={()=>setWalletRole('buyer')}>Reader wallet</button><button className={walletRole==='seller'?'chosen':''} onClick={()=>setWalletRole('seller')}>Publisher wallet</button></div><div className="wallet-grid single-wallet">{([walletRole]).map(role=><section className="panel" key={role}><span className="kicker">{role==='buyer'?'READER':'PUBLISHER'}</span><h2>{role==='buyer'?'Spending wallet':'Receiving wallet'}</h2>{!nodes.current[role]?.isRunning||!addresses[role]?<button className="primary" disabled={busy||!loaded} onClick={()=>void run(()=>start(role))}>Start {role==='buyer'?'reader':'publisher'} wallet</button>:<><div className="address"><code>{addresses[role]}</code><button className="secondary" onClick={()=>void run(()=>copyAddress(role))}>{copied===role?'Copied ✓':'Copy address'}</button></div><div className="metric"><span>On-chain balance</span><strong>{balances[role]??'Checking…'} CKB</strong></div><div className="metric"><span>Payment channel</span><strong>{channels[role]?(ready(channels[role]!)?'Ready':'Opening…'):'Not open'}</strong></div>{channels[role]&&<div className="metric"><span>Available in channel</span><strong>{ckb(channels[role]!.local_balance)} CKB</strong></div>}<button className="primary" disabled={busy||!!channels[role]||!(Number(balances[role])>500)} onClick={()=>void run(()=>open(role))}>{channels[role]?'Channel created':'Open 500 CKB channel'}</button><button className="secondary" disabled={busy} onClick={()=>void run(()=>refresh(role))}>Refresh balance & status</button><a href="https://faucet.nervos.org" target="_blank" rel="noreferrer">Get testnet CKB ↗</a><details><summary>Network diagnostics</summary><p>{checks[role]}</p><p>Bottle: {connected[role]?'Connected':'Not connected'}</p>{channels[role]&&<p>Remote liquidity: {ckb(channels[role]!.remote_balance)} CKB</p>}</details></>}</section>)}</div><section className="panel"><h2>Publication transaction history</h2><div className="filters"><button className={walletRole==='buyer'?'chosen':''} onClick={()=>setWalletRole('buyer')}>Reader · outgoing</button><button className={walletRole==='seller'?'chosen':''} onClick={()=>setWalletRole('seller')}>Publisher · incoming</button></div><p className="muted">{walletRole==='buyer'?'Outgoing purchases recorded by this browser’s reader wallet since V7.':'Incoming payment-key receipts for publications created in this browser. This is not a full network transaction history.'}</p>{walletRole==='buyer'&&Object.entries(ledger).sort((a,b)=>b[1].date.localeCompare(a[1].date)).map(([hash,t])=><div className="tx-row" key={hash}><div><strong>{t.title}</strong><p>{new Date(t.date).toLocaleString()} · Purchase completed · Fee {t.fee} CKB</p><details><summary>Payment hash</summary><code>{hash}</code></details></div><strong>−{1+Number(t.fee)} CKB</strong></div>)}{walletRole==='seller'&&editions.filter(e=>published.includes(e.id)&&metrics[e.id]?.paid).map(e=><div className="tx-row" key={e.id}><div><strong>{e.title}</strong><p>Incoming publication receipt · payment key verified</p></div><strong>+1 CKB</strong></div>)}{(walletRole==='buyer'?!Object.keys(ledger).length:!sales)&&<p>No recorded publication transactions yet.</p>}</section>{(walletRole==='buyer'?routeReady:sellerReady)?<button className="primary" onClick={()=>{setView(walletReturn||(walletRole==='seller'?'publish':'read'));setWalletReturn(null);setStatus('');}}> {walletReturn==='publish'||(!walletReturn&&walletRole==='seller')?'Return to Studio':'Return to reading'}</button>:<p className="muted">Readers need spending liquidity; publishers need receiving liquidity. Set up only the wallet for your role.</p>}{walletRole==='seller'&&channels.seller&&ready(channels.seller)&&<details><summary>Advanced: prepare receiving capacity</summary><p>This sends 5 testnet CKB to the routing peer to free inbound channel capacity. Only use if your receiving capacity is insufficient.</p><button className="secondary" disabled={busy} onClick={()=>void run(moveLiquidity)}>Prepare receiving capacity (5 CKB transfer)</button></details>}</>}
    <footer>briefly. <span>Powered by Fiber · Testnet prototype</span></footer>
  </main>;
}
