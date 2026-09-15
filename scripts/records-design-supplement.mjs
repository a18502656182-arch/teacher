import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || '.qa-shots/records-design/supplement');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9252',`--user-data-dir=${path.resolve('.qa-shots/records-design/supplement-chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9252/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');

 await send('DOM.enable');await send('CSS.enable');report.measurements=[];
 const snap=async(name,width)=>{await evaluate('document.fonts.ready.then(()=>true)');const info=await evaluate(`(()=>{const selectors={page:'[data-records-design]',heading:'[data-records-design] h1',search:'[aria-label="搜索沟通记录"]',row:'[data-record-id]',notice:'[data-notice-id]',dialog:'dialog[open]'};return{scrollWidth:document.documentElement.scrollWidth,regions:Object.fromEntries(Object.entries(selectors).map(([k,s])=>{const e=document.querySelector(s);if(!e)return[k,null];const r=e.getBoundingClientRect(),c=getComputedStyle(e);return[k,{x:r.x,y:r.y,width:r.width,height:r.height,font:c.font,padding:c.padding,gap:c.gap,background:c.backgroundColor}]}))}})()`);report.measurements.push({width,name,...info});if(info.scrollWidth>width+1)report.failures.push({name,width,overflow:info.scrollWidth});const bytes=Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64');writeFileSync(path.join(out,name+'.png'),bytes);report.evidence.push({path:name+'.png',sha256:hash(bytes),width});};
 const go=async(state,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width<900?844:1024,deviceScaleFactor:1,mobile:width<900});await send('Page.navigate',{url:'http://127.0.0.1:4216/records.html?state='+state});await wait(1200);};
 const check=async(name,expression)=>{const passed=!!await evaluate(expression);report.interactions.push({name,passed});if(!passed)report.failures.push(name);};
 for(const width of [1536,390,1057,360]){await go('normal',width);await snap(width+'-normal',width);const doc=await send('DOM.getDocument');const node=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'[data-records-design] h1'});report.measurements.at(-1).platformFonts=await send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});}
 for(const width of [1536,390]){
 await go('students-105',width);await evaluate('window.__records.controller.openRecord()');await wait(150);await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='搜索姓名或学号选择学生').click()");await wait(150);await snap(width+'-student-picker',width);await check(width+' picker present',"[...document.querySelectorAll('dialog[open]')].some(d=>d.innerText.includes('选择沟通学生'))");
 await go('conflict-409',width);await evaluate("[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='导出草稿').scrollIntoView({block:'center'})");await snap(width+'-recovery',width);await evaluate("HTMLAnchorElement.prototype.click=function(){window.__exportName=this.download};[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='导出草稿').click()");await check(width+' export draft invocation',"window.__exportName==='synthetic-records-draft.json'");await evaluate("[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='载入最新数据').click()");await wait(120);await check(width+' explicit replace confirmation',"document.body.innerText.includes('确认载入最新')");await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='确认载入最新').click()");await wait(1200);await check(width+' replace latest reload',"location.search==='?state=normal'&&!window.__records.controller.pending");
 }
 console.log(JSON.stringify({shots:report.evidence.length,checks:report.interactions.length,failures:report.failures,consoleErrors:report.consoleErrors}));if(report.failures.length||report.consoleErrors.length)process.exitCode=1;
}finally{writeFileSync(path.join(out,'supplement.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
