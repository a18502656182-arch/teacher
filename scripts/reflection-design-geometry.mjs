import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || 'docs/page-designs/V4/reflection/screenshots/p01-geometry');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9263',`--user-data-dir=${path.resolve('.qa-shots/reflection-design/interaction-chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9263/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');

 const check=async(name,expression)=>{const passed=!!await evaluate(expression);report.interactions.push({name,passed});if(!passed){console.log(await evaluate('({state:window.__reflection.getState(),error:window.__reflection.controller.error,body:document.body.innerText.slice(-1500)})'));throw Error(name);}};
 const go=async(state,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width<900?844:1024,deviceScaleFactor:1,mobile:width<900});await send('Page.navigate',{url:'http://127.0.0.1:4220/reflection.html?state='+state});await wait(1100);for(let i=0;i<30;i++){if(await evaluate("!!window.__reflection"))return;await wait(200);}throw Error("preview not ready");};
 const act=async(code)=>{await evaluate(`(()=>{const c=window.__reflection.controller;${code}})()`);await wait(120);};
 const click=async(text)=>{await evaluate(`[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).reverse().find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`);await wait(120);};


for(const width of [1536,390])for(const state of ['normal','mobile-editor']){await go(state,width);const geometry=await evaluate(`(()=>{const region=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,color:s.color,background:s.backgroundColor,padding:s.padding,gap:s.gap,radius:s.borderRadius,position:s.position,bottom:s.bottom}};return{viewport:innerWidth+'x'+innerHeight,title:region(document.querySelector('h1')),queue:region(document.querySelector('aside[aria-label="学生复盘状态"]')),editor:region(document.querySelector('section[aria-label="反思填写"]')),problem:region(document.querySelector('[aria-label="主要问题"]')),actions:region(document.querySelector('form footer')),select:region(document.querySelector('[aria-label="反思状态"]')),image:region(document.querySelector('img')),imageNatural:[...document.images].map(e=>[e.naturalWidth,e.naturalHeight])}})()`);report.evidence.push({state,width,geometry});}console.log('4 geometry snapshots measured');
}catch(e){report.failures.push(String(e));process.exitCode=1;}finally{writeFileSync(path.join(out,'geometry.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
