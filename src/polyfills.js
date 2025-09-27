// Global polyfills for Electron renderer process
globalThis.global = globalThis;
window.global = globalThis;

// Additional polyfills that might be needed
if (typeof global === 'undefined') {
  global = globalThis;
}