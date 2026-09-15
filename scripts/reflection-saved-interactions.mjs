import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || 'docs/page-designs/V4/reflection/screenshots/p02-interactions');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9264',`--user-data-dir=${path.resolve('.qa-shots/reflection-design/p02-interaction-chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9264/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');

 const check=async(name,expression)=>{const passed=await evaluate(`Boolean(${expression})`);report.interactions.push({name,passed});if(!passed){console.log(await evaluate('({state:window.__reflection.getState(),error:window.__reflection.controller.error,body:document.body.innerText.slice(-1500)})'));throw Error(name);}};
 const go=async(state,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width<900?844:1024,deviceScaleFactor:1,mobile:width<900});await send('Page.navigate',{url:'http://127.0.0.1:4220/reflection.html?state='+state});await wait(1100);for(let i=0;i<30;i++){if(await evaluate("!!window.__reflection"))return;await wait(200);}throw Error("preview not ready");};
 const act=async(code)=>{await evaluate(`(()=>{const c=window.__reflection.controller;${code}})()`);await wait(120);};
 const click=async(text)=>{await evaluate(`[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).reverse().find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`);await wait(120);};


for(const width of [1536,390]){
 await go('saved-library',width);
 await check(width+' library is separate from editor', "!document.querySelector('textarea')&&!document.body.innerText.includes('当前考试 ·')&&document.querySelector('[aria-label=已保存反思记录库]')");
 await check(width+' cross exam and legacy records preserved',"window.__reflection.controller.reflections.length===8&&window.__reflection.controller.reflections.some(r=>!r.examId)");
 await act("c.setLibraryExam('unlinked')");
 await check(width+' unlinked filter',"window.__reflection.controller.rows.length===1&&!window.__reflection.controller.rows[0].reflection.examId");
 await click('重置筛选');
 await act("c.setQuery('学生04')");
 await check(width+' search filters record',"window.__reflection.controller.rows.length===1");
 await click('查看反思');
 await check(width+' reading detail has five sections and no inputs',"document.querySelector('[aria-label=已保存反思详情]')&&!document.querySelector('textarea')&&document.body.innerText.includes('班主任跟进')");
 await click('返回已保存反思');
 await check(width+' return preserves search',"window.__reflection.controller.query==='学生04'&&window.__reflection.controller.rows.length===1");
 await click('重置筛选');await click('下一页');
 const savedPage=await evaluate('window.__reflection.controller.safePage');
 await click('查看反思');await click('返回已保存反思');
 await check(width+' return preserves page','window.__reflection.controller.safePage==='+savedPage);
 await go('saved-detail',width);
 const id=await evaluate('window.__reflection.controller.savedReflection.id'),count=await evaluate('window.__reflection.controller.reflections.length');
 await click('编辑反思');
 await check(width+' explicit edit keeps record id','document.querySelectorAll("textarea").length===5&&window.__reflection.controller.draft.id==='+JSON.stringify(id));
 await act("c.setField('problem','P02保存后的合成问题')");
 await click('返回反思详情');
 await check(width+' dirty back guarded',"window.__reflection.controller.confirm");
 await click('继续填写');
 await click('保存草稿');await wait(600);
 await check(width+' save returns updated reading with original id','window.__reflection.controller.savedView==="detail"&&window.__reflection.controller.savedReflection.id==='+JSON.stringify(id)+'&&window.__reflection.controller.reflections.length==='+count+'&&document.body.innerText.includes("P02保存后的合成问题")&&!document.querySelector("textarea")');
 await go('saved-readonly',width);
 await check(width+' read-only allows reading but disables editing',"[...document.querySelectorAll('button')].find(b=>b.textContent==='编辑反思')?.disabled&&!document.querySelector('textarea')");
 await go('saved-library',width);await act("c.setLibraryExam('unlinked')");await click('查看反思');
 await check(width+' unlinked has reading page',"document.querySelector('[aria-label=已保存反思详情]')&&document.body.innerText.includes('未关联考试')");
 const legacyId=await evaluate('window.__reflection.controller.savedReflection.id');
 await click('关联考试并编辑');
 await evaluate("(()=>{const el=document.querySelector('select[aria-label=关联考试]');el.value=el.options[1].value;el.dispatchEvent(new Event('change',{bubbles:true}));})()");await wait(120);
 await click('关联所选考试并编辑');await click('保存草稿');await wait(600);
 await check(width+' legacy association preserves record id and returns detail','window.__reflection.controller.savedView==="detail"&&window.__reflection.controller.savedReflection.id==='+JSON.stringify(legacyId)+'&&!!window.__reflection.controller.savedReflection.examId');
}
console.log(report.interactions);
}catch(e){report.failures.push(String(e));console.error(e);process.exitCode=1;}finally{writeFileSync(path.join(out,'interactions.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
