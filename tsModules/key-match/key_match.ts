
// TODO handle non-Mac: 
function isMac() {
  return true;
}

// E.g.: cmd+shift+enter or cmd+space
export function matchKey(evt: KeyboardEvent, wantStr = '') {
  let evtKey = evt.key;
  // Special cases
  if (evtKey === ' ') {
    evtKey = 'space';
  } else if (evtKey === 'ArrowRight') {
    evtKey = 'right';
  } else if (evtKey === 'ArrowUp') {
    evtKey = 'up';
  } else if (evtKey === 'ArrowDown') {
    evtKey = 'down';
  } else if (evtKey === 'ArrowLeft') {
    evtKey = 'left';
  }
  evtKey = evtKey.toLowerCase();
  const wantProps = wantStr.split('+');
  if (wantProps.length === 0) {
    return false;
  }
  const wantKey = wantProps.pop()?.toLowerCase();
  if (evtKey !== wantKey) {
    return false;
  }

  const evtProps = new Set<string>();
  if (evt.metaKey) {
    evtProps.add(isMac() ? 'cmd' : 'ctrl');
  }
  if (evt.altKey) {
    evtProps.add('alt');
  }
  if (evt.shiftKey) {
    evtProps.add('shift');
  }
  if (evt.ctrlKey) {
    evtProps.add(isMac() ? 'ctrl' : 'cmd');
  }
  if (evtProps.size != wantProps.length) {
    return false;
  }
  if (wantProps.some(wantProp => !evtProps.has(wantProp))) {
    return false;
  }
  return true;
}
