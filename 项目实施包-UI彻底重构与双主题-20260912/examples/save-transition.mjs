// 纯状态转换教学样例：没有网络、没有数据存储，不能替代生产保存实现。
export function transition(state, event) {
  switch (event.type) {
    case 'theme': return state;
    case 'edit': return state.phase === 'saving' ? state : { ...state, phase: 'dirty', confirmed: false, draft: event.draft };
    case 'confirm': return state.phase === 'saving' ? state : { ...state, confirmed: true };
    case 'submit': return state.readOnly || !state.confirmed || ['saving','conflict'].includes(state.phase) ? state : { ...state, phase: 'saving' };
    case 'failure': return state.phase !== 'saving' ? state : { ...state, phase: event.conflict ? 'conflict' : 'failed' };
    case 'accepted': {
      if (state.phase !== 'saving' || !Number.isInteger(event.revision) || event.revision <= state.revision) return state;
      // accepted只能由真实响应适配层发出；到最后一人保持位置并标finished。
      const finished = state.index >= state.total - 1;
      return { ...state, revision: event.revision, phase: 'saved', index: finished ? state.index : state.index + 1, finished, draft: null, confirmed: false };
    }
    default: return state;
  }
}
