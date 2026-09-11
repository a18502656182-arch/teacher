export function canLeaveDictation() { return window.dispatchEvent(new Event('classroom:before-navigate', { cancelable: true })); }
