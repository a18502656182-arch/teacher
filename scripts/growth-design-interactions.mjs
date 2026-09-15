import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = path.resolve(process.env.DESIGN_CAPTURE_DIR || '.qa-shots/growth-design/interactions');
mkdirSync(out,{recursive:true});
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9242',`--user-data-dir=${path.resolve('.qa-shots/growth-design/interaction-chrome')}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ws; const pending = new Map(); let seq=0;
const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate = async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value; };
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const report = {createdAt:new Date().toISOString(),browser:null,evidence:[],failures:[],interactions:[],consoleErrors:[]};
try {
 let tabs; for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9242/json').then(r=>r.json());break;}catch{await wait(250);}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')report.consoleErrors.push(m.params);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result);});
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 report.browser=await send('Browser.getVersion');await send('Runtime.enable');await send('Page.enable');

 const check=async(name,expression)=>{const passed=!!await evaluate(expression);report.interactions.push({name,passed});if(!passed)throw Error(name);};
 const click=async(text,scope='document')=>{await evaluate(`[...${scope}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`);await wait(120);};
 const fill=async(label,value)=>{await evaluate(`(()=>{const e=document.querySelector('[aria-label="${label}"]');const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await wait(80);};
 const go=async(state,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:width>900?1024:844,deviceScaleFactor:1,mobile:width<900});await send('Page.navigate',{url:'http://127.0.0.1:4212/growth.html?state='+state});await wait(1100);};
 for(const width of [1536,390]){
 await go('students-105',width);await check(width+' roster starts10',"document.querySelectorAll('[data-student-id]').length===10");await fill('搜索学生','105');await check(width+' search105',"document.querySelectorAll('[data-student-id]').length===1&&document.querySelector('[data-student-id]').textContent.includes('105')");await fill('搜索学生','');await click('下一页',"document.querySelector('[aria-label=学生分页]')");await check(width+' roster page2',"document.querySelector('[data-student-id]').textContent.includes('学生11')");
 await go('normal',width);await evaluate("document.querySelector('[data-student-id]').click()");await wait(100);await check(width+' no identity metric',"![...document.querySelectorAll('header')].some(h=>h.textContent.includes('作业完成'))");await click('添加记录');await click('保存成长记录');await check(width+' validation retains',"document.querySelector('dialog[open]').textContent.includes('请填写日期')");await fill('记录标题','交互测试观察');await fill('具体事实','合成：学生主动分享阅读方法。');await click('取消');await check(width+' dirty guard',"[...document.querySelectorAll('dialog[open]')].some(d=>d.textContent.includes('当前记录尚未保存'))");await click('继续编辑');await click('保存成长记录');await wait(650);await check(width+' saved once',"window.__growth.getData().growthEvidence.filter(e=>e.title==='交互测试观察').length===1&&!window.__growth.getState().composer");
 await go('save-failure',width);await check(width+' failure retains',"window.__growth.getState().pending&&window.__growth.getState().composer&&document.body.textContent.includes('同步失败')");const before=await evaluate('window.__growth.getData().growthEvidence.length');await click('重试同步');await wait(650);await check(width+' retry no duplicate',`window.__growth.getData().growthEvidence.length===${before}&&!window.__growth.getState().composer`);
 await go('save-throw',width);await check(width+' throw recovers busy',"!window.__growth.getState().busy&&document.body.textContent.includes('保存连接中断')");
 await go('conflict-409',width);await check(width+' conflict draft preserved',"window.__growth.getState().sync==='conflict-409'&&window.__growth.getState().pending");
 await go('readonly',width);await check(width+' readonly action disabled',"[...document.querySelectorAll('button')].find(b=>b.textContent==='添加记录').disabled");
 await go('long-record',width);await click('查看全文');await check(width+' full record dialog',"document.querySelector('dialog[open]').textContent.includes('合成长记录')");
 await go('timeline-pages',width);await click('下一页',"document.querySelector('[aria-label=成长记录分页]')");await check(width+' timeline paging',"window.__growth.controller.m.safePage===2");
 }

 await go('conflict-409',390);await click('重试同步');await wait(600);await check('persistent conflict remains',"window.__growth.getState().sync==='conflict-409'");await click('载入最新版本',"document.querySelector('dialog[open]')");await check('conflict explicit confirm',"[...document.querySelectorAll('dialog[open]')].some(d=>d.textContent.includes('载入最新版本前确认'))");await click('返回保留草稿');await check('cancel preserves pending',"window.__growth.getState().pending");await evaluate("window.__exported=false;HTMLAnchorElement.prototype.click=function(){window.__exported=this.download==='synthetic-growth-draft.json'}");await click('导出当前草稿',"document.querySelector('dialog[open]')");await check('export reachable in composer',"window.__exported");await click('载入最新版本',"document.querySelector('dialog[open]')");await click('确认载入最新版本');await wait(1100);await check('load latest explicit discards local',"!window.__growth.getState().pending&&window.__growth.getData().growthEvidence.length===1");
 await go('summary',390);await evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__copied=t;}}})");await click('复制摘要');await check('copied summary carries limitation',"window.__copied.includes('不能作为学生的常态评价')&&window.__copied.includes('学生01')");
 console.log(JSON.stringify({checks:report.interactions.length,failures:report.interactions.filter(x=>!x.passed),errors:report.consoleErrors.length}));
}finally{writeFileSync(path.join(out,'interactions.json'),JSON.stringify(report,null,2)+'\n');ws?.close();chrome.kill();}
