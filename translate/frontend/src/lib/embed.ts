// Tells the embedding page that a demo run started.
// No-op when this app is opened directly.
export function notifyParentDemoStarted() {
  if (window.parent === window) {
    return;
  }
  window.parent.postMessage({ type: "soniox-compare:demo-started" }, "*");
}
