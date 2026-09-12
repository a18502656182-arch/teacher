import test from 'node:test';
import assert from 'node:assert/strict';
import { transition } from './save-transition.mjs';
const base = () => ({ phase:'dirty', confirmed:true, readOnly:false, index:0, total:2, revision:4, draft:{ wrong:[1], note:'合成测试' } });
test('未核对或只读不能提交', () => {
  for (const s of [{...base(),confirmed:false},{...base(),readOnly:true}]) assert.equal(transition(s,{type:'submit'}),s);
});
test('网络失败与冲突都保留当前学生和草稿', () => {
  for (const conflict of [false,true]) { const s=transition(base(),{type:'submit'}); const n=transition(s,{type:'failure',conflict}); assert.equal(n.index,0); assert.equal(n.draft,s.draft); assert.equal(n.phase,conflict?'conflict':'failed'); }
});
test('只有有效服务端确认后进入下一人', () => {
  const s=transition(base(),{type:'submit'}); assert.equal(transition(s,{type:'accepted',revision:4}),s);
  const n=transition(s,{type:'accepted',revision:5}); assert.equal(n.index,1); assert.equal(n.draft,null); assert.equal(n.confirmed,false);
});
test('主题事件不改状态，冲突不能直接重试', () => {
  const s={...base(),phase:'conflict'}; assert.equal(transition(s,{type:'theme'}),s); assert.equal(transition(s,{type:'submit'}),s);
});
test('最后一人不越界', () => { const s={...base(),phase:'saving',index:1}; const n=transition(s,{type:'accepted',revision:5}); assert.equal(n.index,1); assert.equal(n.finished,true); });
