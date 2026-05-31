// Offline SET resynchronization: drains the FIFO queue when connectivity returns.
//
// This is the offline-first heart of the POC (see the "Alternative scenarios" diagram:
// "replay the set requests" when the connection is back). It is kept as pure orchestration:
// every side effect (queue read/write, network, cache write, logging, online state,
// endpoint/sesskey resolution) goes through the injected `runtime`, so the drain logic is
// testable under Node (see syncQueue.test.js) with a fake runtime. Bundled/inlined into
// cache.js by esbuild.

var setQueue = require('./setQueue');
var buildReplayBody = setQueue.buildReplayBody;

// Replays a single queued SET against the server, re-injecting the live sesskey.
// Returns { ok: true } only once the server confirms the success:true contract, so the
// caller never dequeues an entry the server did not actually accept.
async function postReplaySet(runtime, endpointUrl, sesskey, entry) {
  var body = buildReplayBody(entry.body, sesskey);

  var response;
  try {
    response = await runtime.originalFetch(endpointUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body,
    });
  } catch (e) {
    return { ok: false, reason: 'network' };
  }

  if (!response.ok) {
    return { ok: false, reason: 'status=' + response.status };
  }

  // An HTTP 200 does not guarantee server-side acceptance (e.g. a CSRF failure rendered
  // as 200). We validate the success:true contract before dequeuing, otherwise the data
  // would be silently lost.
  var json = null;
  try {
    json = await response.json();
  } catch (e) {
    json = null;
  }

  if (!json || json.success !== true) {
    return { ok: false, reason: 'rejected' + (json && json.message ? ' (' + json.message + ')' : '') };
  }

  return { ok: true };
}

async function syncPendingOfflineSet(runtime) {
  if (runtime.isForceCacheEnabled()) return false;
  if (!runtime.isOnline()) return false;
  // One drain at a time: avoids replaying the same entry twice when several triggers
  // (the `online` event, startup, Force cache toggle) overlap.
  if (runtime.syncInProgress) return false;
  runtime.syncInProgress = true;

  try {
    var remaining = runtime.readPendingSetQueue();
    if (!remaining.length) return false;

    var endpointUrl = runtime.resolveSyncEndpointUrl();
    var sesskey = runtime.readLiveSesskey();
    var syncedCount = 0;

    // FIFO queue: replay SETs in arrival order and dequeue an entry only after the server
    // confirms success:true. On the first error (network or rejection), stop and keep the
    // head entry and all the following ones, to preserve order and lose no data. Conflict
    // handling (a more recent SET having already overwritten the server-side value) is
    // deliberately out of scope.
    while (remaining.length) {
      var entry = remaining[0];
      var result = await postReplaySet(runtime, endpointUrl, sesskey, entry);

      if (!result.ok) {
        runtime.writePendingSetQueue(remaining);
        runtime.post('SET sync stopped (' + result.reason + '), ' + remaining.length + ' left in queue');
        return syncedCount > 0;
      }

      remaining = remaining.slice(1);
      runtime.writePendingSetQueue(remaining);
      if (entry.date) runtime.writeCachedDate(entry.date);
      syncedCount += 1;
      runtime.post('SET synced date=' + entry.date + ', ' + remaining.length + ' left in queue');
    }

    runtime.post('SET queue drained (' + syncedCount + ' synced)');
    return syncedCount > 0;
  } finally {
    runtime.syncInProgress = false;
  }
}

module.exports = {
  postReplaySet: postReplaySet,
  syncPendingOfflineSet: syncPendingOfflineSet,
};
