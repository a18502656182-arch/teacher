'use client';
import { useEffect } from 'react';

/** Adapts the existing dialog families without changing their save/cancel handlers. */
export function DialogAccessibility() {
 useEffect(()=>{
  let current:HTMLElement|null=null;
  let stack:HTMLElement[]=[];
  let restoreFocus:HTMLElement|null=null;
  let previousOverflow:string|null=null;
  let restoreInert:Array<[HTMLElement,boolean]>=[];
  const visible=(e:HTMLElement)=>e.getClientRects().length>0;
  const controls=()=>current?Array.from(current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]')).filter(visible):[];
  function release(){for(const [e,value] of restoreInert)e.inert=e.getAttribute('aria-hidden')==='true'||value;restoreInert=[];}
  function sync(){
   const dialogs=Array.from(document.querySelectorAll<HTMLElement>('.app-shell [role="dialog"][aria-modal="true"],.workbench-confirm[role="dialog"]')).filter(visible);
   // A nested picker can render before its parent in React's DOM order.
   // Activation order, not document order, determines the active dialog.
   stack=stack.filter(dialog=>dialogs.includes(dialog));
   for(const dialog of dialogs)if(!stack.includes(dialog))stack.push(dialog);
   const next=stack.at(-1)??null;
   if(next===current)return;
   release();
   if(!next){current=null;if(previousOverflow!==null)document.body.style.overflow=previousOverflow;previousOverflow=null;if(restoreFocus?.isConnected)restoreFocus.focus();restoreFocus=null;return;}
   if(!current){restoreFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
   current=next;
   let child:HTMLElement=next;
   while(child.parentElement&&child.parentElement!==document.documentElement){
    for(const sibling of Array.from(child.parentElement.children)){if(sibling!==child&&sibling instanceof HTMLElement&&!sibling.inert&&!['SCRIPT','STYLE','LINK'].includes(sibling.tagName)){restoreInert.push([sibling,false]);sibling.inert=true;}}
    child=child.parentElement;
   }
   if(!current.contains(document.activeElement)){const first=controls()[0];if(first)first.focus();else{current.tabIndex=-1;current.focus();}}
  }
  function keydown(event:KeyboardEvent){
   // Native next-generation dialogs own the top layer while open. The legacy
   // manager must not close or refocus a parent dialog underneath them.
   if(document.querySelector('dialog[data-workbench-dialog="next"][open]'))return;
   if(!current)return;
   if(event.key==='Escape'){
    const close=Array.from(current.querySelectorAll<HTMLButtonElement>('button')).find(button=>!button.disabled&&visible(button)&&(/^(关闭|取消|返回)$/.test(button.getAttribute('aria-label')??'')||/^(关闭|取消|×|✕)$/.test(button.textContent?.trim()??'')));
    if(close){event.preventDefault();event.stopImmediatePropagation();close.click();}
   }
   if(event.key==='Tab'){
    const items=controls();const first=items[0],last=items.at(-1);
    if(!first){event.preventDefault();return;}
    if(event.shiftKey&&(document.activeElement===first||!current.contains(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!current.contains(document.activeElement))){event.preventDefault();first.focus();}
   }
  }
  const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('keydown',keydown,true);sync();
  return()=>{observer.disconnect();document.removeEventListener('keydown',keydown,true);release();if(previousOverflow!==null)document.body.style.overflow=previousOverflow;};
 },[]);
 return null;
}
