import { applyRuntimeConstants } from './runtime/constants';
import { createMessagingTools } from './runtime/messaging';
import { initializeForceCacheFlag } from './runtime/forceCache';
import { createDateCacheTools } from './runtime/dateCache';
import { createRequestTools } from './runtime/request';
import { createSnapshotTools } from './runtime/snapshot';

function assignTools(target, source) {
  var keys = Object.keys(source);
  for (var i = 0; i < keys.length; i += 1) {
    target[keys[i]] = source[keys[i]];
  }
}

export function installCacheRuntime() {
  if (window.__memoCacheInstalled) return;
  window.__memoCacheInstalled = true;

  // Reuse an existing runtime object so other injected scripts keep stable references.
  var runtime = window.__memoCacheRuntime || {};

  applyRuntimeConstants(runtime);
  runtime.originalFetch = window.fetch;
  initializeForceCacheFlag();

  // Compose runtime behavior from focused modules.
  assignTools(runtime, createMessagingTools(runtime));
  assignTools(runtime, createDateCacheTools(runtime));
  assignTools(runtime, createRequestTools(runtime));
  assignTools(runtime, createSnapshotTools(runtime));

  runtime.isForceCacheEnabled = function() {
    return window.__memoForceCache === true;
  };

  window.__memoCacheRuntime = runtime;

  if (document.readyState === 'complete') {
    runtime.scheduleSnapshotCapture();
  } else {
    window.addEventListener('load', runtime.scheduleSnapshotCapture, { once: true });
  }
}
