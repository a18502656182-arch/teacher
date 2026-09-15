import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || '.qa-shots/growth-design/supplement');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9243',`--user-data-dir=${path.resolve('.qa-shots/growth-design/supplement-chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9243/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');
 for(const [width,height,state,full]of [[1057,900,'normal',false],[360,780,'normal',false],[360,780,'mobile-detail',false],[360,780,'composer',false],[1536,1024,'long-record',true],[390,844,'long-record',true],[390,844,'conflict-409',true],[1536,1024,'students-105',true]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});const url='http://127.0.0.1:4212/growth.html?state='+state;await send('Page.navigate',{url});await wait(1100);await evaluate('document.fonts.ready.then(()=>true)');if(state==='students-105'){await evaluate('window.__growth.controller.setListPage(11)');await wait(100);}if(state==='conflict-409'){await evaluate("document.querySelector('dialog[open] [class*=body]')?.scrollTo(0,9999)");await wait(100);}const metrics=await send('Page.getLayoutMetrics');const info=await evaluate('({scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,dialogText:[...document.querySelectorAll("dialog[open]")].map(d=>d.innerText)})');const params={format:'png',captureBeyondViewport:full};if(full)params.clip={x:0,y:0,width,height:metrics.cssContentSize.height,scale:1};const shot=await send('Page.captureScreenshot',params);const bytes=Buffer.from(shot.data,'base64'),name=width+'-'+state+(full?'-full':'-narrow')+'.png';writeFileSync(path.join(out,name),bytes);report.evidence.push({path:name,sha256:hash(bytes),viewport:width+'x'+height,stateId:state,url,full,info});if(info.scrollWidth>width+1)report.failures.push({width,state,info});}
 const fonts=await send('DOM.getDocument');const q=await send('DOM.querySelector',{nodeId:fonts.root.nodeId,selector:'h1'});await send('DOM.enable');await send('CSS.enable');report.platformFonts=await send('CSS.getPlatformFontsForNode',{nodeId:q.nodeId});console.log(JSON.stringify({evidence:report.evidence.length,failures:report.failures,fonts:report.platformFonts}));
}finally{writeFileSync(path.join(out,'supplement.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
