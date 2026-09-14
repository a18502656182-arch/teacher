import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || '.qa-shots/students-design/round1');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9231',`--user-data-dir=${path.resolve('.qa-shots/students-design/chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9231/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');
 const states=(process.env.DESIGN_STATES||'normal,empty,large-105,long-name,search-empty,loading,readonly,saving,save-failure,conflict-409,detail-drawer,profile,editor,validation,import,import-error,batch,danger-confirm,dirty-close').split(',');
 const viewports=process.env.DESIGN_NARROW ? [[1057,900],[360,780]] : [[1536,1024],[390,844]];
 for(const [width,height] of viewports)for(const state of states){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const url=`http://127.0.0.1:4207/students.html?state=${state}`;
  await send('Page.navigate',{url});
  await wait(650);
  for(let i=0;i<60;i++){if(await evaluate("Boolean(document.querySelector('[data-module=students]'))"))break;await wait(250);}
  await evaluate('document.fonts.ready.then(()=>true)');
  await wait(250);
  if(state==='dirty-close'){
   await evaluate(`(()=>{const e=document.querySelector('#student-name');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'合成草稿');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await wait(80);
   await evaluate(`Array.from(document.querySelectorAll('dialog[open] button')).find(b=>b.textContent==='取消')?.click()`);await wait(100);
  }
  const info=await evaluate(`(()=>{const visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;const regions={};for(const e of document.querySelectorAll('[data-students-region],[data-design-region],h1,[class*=rosterSummary],[class*=mobileHeader]')){if(!visible(e))continue;const r=e.getBoundingClientRect(),s=getComputedStyle(e);regions[e.dataset.studentsRegion||e.dataset.designRegion||e.tagName]={x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,gap:s.gap};}return{ready:!!document.querySelector('[data-module=students]'),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,regions,dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>e.innerText.slice(0,350)),squeezed:[...document.querySelectorAll('button')].filter(e=>visible(e)&&getComputedStyle(e).fontSize!=='0px'&&e.scrollWidth>e.clientWidth+1).map(e=>({text:e.innerText,width:e.clientWidth,scroll:e.scrollWidth})),images:[...document.images].filter(visible).map(e=>({src:e.getAttribute('src'),complete:e.complete,naturalWidth:e.naturalWidth})),font:getComputedStyle(document.body).fontFamily,bodyText:document.body.innerText.slice(0,80)}})()`);
  if(!info.ready||info.scrollWidth>width+1||info.squeezed.length||info.images.some(i=>!i.naturalWidth)) report.failures.push({state,width,info});
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const name=`${width}-${state}.png`;const bytes=Buffer.from(shot.data,'base64');writeFileSync(path.join(out,name),bytes);
  // Query the actual platform font used by a visible Chinese heading.
  await send('DOM.enable');await send('CSS.enable');const doc=await send('DOM.getDocument');const node=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:width>900?'[data-design-region="heading"] h1':'.mobile-screen h2'});let fonts=[];if(node.nodeId)fonts=(await send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId})).fonts;
  const fixtureText=await evaluate("document.getElementById('students-design-fixture')?.textContent || ''");
  report.evidence.push({stateId:state,viewport:`${width}x${height}`,dpr:1,url,path:name,sha256:hash(bytes),fixtureSha256:hash(fixtureText),font:info.font,platformFonts:fonts,info});
  if(state==='normal' && info.ready) {
   const metrics=await send('Page.getLayoutMetrics');const full=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.max(height,metrics.cssContentSize.height),scale:1}});writeFileSync(path.join(out,`${width}-normal-full.png`),Buffer.from(full.data,'base64'));
   // Exercise actual native input and React events; all updates remain in synthetic memory.
   const result=await evaluate(`(async()=>{const pause=()=>new Promise(r=>setTimeout(r,80));const click=t=>[...document.querySelectorAll('button')].find(b=>b.getBoundingClientRect().width&&b.textContent.trim()===t)?.click();const type=(selector,value)=>{const e=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));};click('新增学生');await pause();click('保存学生');await pause();const validation=[...document.querySelectorAll('dialog[open]')].some(d=>d.innerText.includes('姓名'));type('#student-name','合成新增测试');await pause();click('保存学生');await pause();const added=document.body.innerText.includes('33');return{validation,added};})()`);
   report.interactions.push({width,...result});if(!result.added||!result.validation)report.failures.push({width,interaction:result});
   const navigation=await evaluate(`(async()=>{const pause=()=>new Promise(r=>setTimeout(r,100));const find=t=>[...document.querySelectorAll('button')].find(b=>b.getBoundingClientRect().width&&b.textContent.trim()===t);const next=find('下一页');next.scrollIntoView({block:'center'});await pause();const r=next.getBoundingClientRect();const pagerReachable=r.top>=0&&r.bottom<=innerHeight-(innerWidth<=900?60:0);next.click();await pause();const paged=document.body.innerText.includes('学生21');const input=document.querySelector('input[placeholder="姓名、学号、小组或备注"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'学生08');input.dispatchEvent(new Event('input',{bubbles:true}));await pause();const filtered=document.body.innerText.includes('显示 1 / 1 人');const check=[...document.querySelectorAll('input[type=checkbox]')].find(e=>e.getBoundingClientRect().width);check.click();await pause();find('批量编辑')?.click();await pause();const batch=[...document.querySelectorAll('dialog[open]')].some(e=>e.innerText.includes('批量编辑 1 名学生'));return{pagerReachable,paged,filtered,batch};})()`);
   report.interactions.push({width,...navigation});if(Object.values(navigation).some(v=>!v))report.failures.push({width,navigation});
  }
 }
 writeFileSync(path.join(out,'capture.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({out,evidence:report.evidence.length,failures:report.failures.length,consoleErrors:report.consoleErrors.length,interactions:report.interactions}));
 if(report.failures.length||report.consoleErrors.length)process.exitCode=1;
} finally {writeFileSync(path.join(out,'capture.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
