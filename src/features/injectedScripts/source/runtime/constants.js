export function applyRuntimeConstants(runtime) {
  // Centralize runtime keys and URL fragments used by all injected scripts.
  runtime.endpointPath = '/local/memorization/ajax/ajax.php';
  runtime.memorizationPath = '/local/memorization/index.php';
  runtime.cacheKey = '__memo_last_date_string__';
  runtime.snapshotMessagePrefix = '[OFFLINE_HTML] ';
}
