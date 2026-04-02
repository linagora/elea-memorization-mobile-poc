export async function handlePassthroughRequest(runtime, thisArg, args, requestUrl) {
  // Keep non-memorization requests unchanged and refresh snapshots when relevant pages mutate.
  var passthroughResponse = await runtime.originalFetch.apply(thisArg, args);
  if (runtime.shouldRefreshSnapshotForUrl(requestUrl)) {
    setTimeout(runtime.captureAndPostOfflineSnapshot, 100);
  }
  return passthroughResponse;
}
