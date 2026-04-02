import { createPatchedFetch } from './fetchPatch/createPatchedFetch';

export function installFetchPatch() {
  var runtime = window.__memoCacheRuntime;
  if (!runtime) return;
  if (runtime.fetchPatched) return;

  // Patch fetch once and delegate all behavior to focused handlers.
  runtime.fetchPatched = true;
  window.fetch = createPatchedFetch(runtime);
}
