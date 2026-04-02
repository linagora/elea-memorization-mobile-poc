export function initializeForceCacheFlag() {
  // Preserve a previous explicit value and otherwise default to false.
  var forceCacheFromConfig = window.__memoForceCache === true;
  window.__memoForceCache =
    typeof window.__memoForceCache === 'boolean' ? window.__memoForceCache : forceCacheFromConfig;
}
