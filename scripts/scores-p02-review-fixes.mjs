import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || 'docs/page-designs/V4/scores/screenshots/p02-review-fixes');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9255',`--user-data-dir=${path.resolve('.qa-shots/scores-design/interaction-chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9255/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');

 const check=async(name,expression)=>{const passed=!!await evaluate(expression);report.interactions.push({name,passed});if(!passed){console.log(await evaluate('({state:window.__scores.getState(),error:window.__scores.controller.error,body:document.body.innerText.slice(-1500)})'));throw Error(name);}};
 const go=async(state,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width<900?844:1024,deviceScaleFactor:1,mobile:width<900});await send('Page.navigate',{url:'http://127.0.0.1:4218/scores.html?state='+state});await wait(1100);};
 const act=async(code)=>{await evaluate(`(()=>{const c=window.__scores.controller;${code}})()`);await wait(120);};
 const click=async(text)=>{await evaluate(`[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).reverse().find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`);await wait(120);};

 const shot=async(name,width)=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),bytes=Buffer.from(r.data,'base64');writeFileSync(path.join(out,name+'.png'),bytes);report.evidence.push({path:name+'.png',sha256:hash(bytes),viewport:width+'x'+(width<900?844:1024)});};
 for(const width of [1536,390,360]){
 await go('analysis-many',width);await check(width+' paper pages capped',"document.querySelectorAll('[data-analysis-workspace] aside button[aria-pressed]').length===5");await click('下一页试卷');await check(width+' next papers',"document.querySelector('[data-analysis-workspace] aside').textContent.includes('合成试卷6.pdf')&&!document.querySelector('[data-analysis-workspace] aside').textContent.includes('合成试卷1.pdf')");await shot(width+'-many',width);
 await go('paper-review',width);await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='确认并加入统计').scrollIntoView({block:'center'})");await wait(150);await check(width+' confirm reachable after scroll',"(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='确认并加入统计'),r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()");await shot(width+'-review-scrolled',width);await click('确认并加入统计');await wait(500);await check(width+' confirm via UI',"window.__scores.controller.exam.knowledgeItems.length===2");
 await go('student-trends',width);await check(width+' row action names',"document.querySelector('[data-trend-row] button').getAttribute('aria-label').includes('9月练习6')");await shot(width+'-student',width);
 }
 console.log(JSON.stringify({checks:report.interactions.length,failures:report.failures,consoleErrors:report.consoleErrors}));
}catch(e){report.failures.push(String(e));console.error(e);process.exitCode=1;}finally{writeFileSync(path.join(out,'review-fixes.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
