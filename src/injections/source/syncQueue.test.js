const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { postReplaySet, syncPendingOfflineSet } = require('./syncQueue');

// Tests for the offline-first drain (the heart of the "Alternative scenarios" diagram:
// replay the queued SETs once connectivity returns). The drain is pure orchestration over
// an injected `runtime`, so we drive it with a fake runtime that records its side effects.

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

// Builds a fake runtime backed by an in-memory queue. `fetchResults` is consumed in order;
// each item is either a Response-like object, or an Error to throw (simulating offline).
function makeRuntime({ queue = [], fetchResults = [], online = true, forceCache = false } = {}) {
  const runtime = {
    syncInProgress: false,
    queue: queue.slice(),
    cachedDate: '',
    posts: [],
    fetchCalls: [],
    sesskey: 'live-key',
    endpointUrl: 'https://host/local/memorization/ajax/ajax.php',

    isForceCacheEnabled: () => forceCache,
    isOnline: () => online,
    readPendingSetQueue: () => runtime.queue.slice(),
    writePendingSetQueue: (next) => {
      runtime.queue = Array.isArray(next) ? next.slice() : [];
      return runtime.queue;
    },
    resolveSyncEndpointUrl: () => runtime.endpointUrl,
    readLiveSesskey: () => runtime.sesskey,
    writeCachedDate: (value) => {
      runtime.cachedDate = value;
      return value;
    },
    post: (message) => runtime.posts.push(message),
    originalFetch: async (url, init) => {
      runtime.fetchCalls.push({ url, init });
      const next = fetchResults.shift();
      if (next instanceof Error) throw next;
      if (next === undefined) throw new Error('unexpected fetch call');
      return next;
    },
  };

  return runtime;
}

function entry(id, date, body) {
  return { id, date, body: body || 'time=1767000000', createdAt: 0 };
}

describe('postReplaySet', () => {
  test('re-injects the live sesskey into the replayed body', async () => {
    const runtime = makeRuntime({ fetchResults: [jsonResponse({ success: true })] });

    const result = await postReplaySet(runtime, 'https://host/ajax', 'fresh', entry('a', '', 'time=42&sesskey=stale'));

    assert.deepEqual(result, { ok: true });
    const params = new URLSearchParams(runtime.fetchCalls[0].init.body);
    assert.equal(params.get('time'), '42');
    assert.equal(params.get('sesskey'), 'fresh');
  });

  test('reports a network error when fetch throws', async () => {
    const runtime = makeRuntime({ fetchResults: [new Error('offline')] });
    const result = await postReplaySet(runtime, 'u', 'k', entry('a'));
    assert.deepEqual(result, { ok: false, reason: 'network' });
  });

  test('reports the HTTP status on a non-ok response', async () => {
    const runtime = makeRuntime({ fetchResults: [jsonResponse({}, { ok: false, status: 503 })] });
    const result = await postReplaySet(runtime, 'u', 'k', entry('a'));
    assert.deepEqual(result, { ok: false, reason: 'status=503' });
  });

  test('rejects a 200 that does not honor the success:true contract (CSRF rendered as 200)', async () => {
    const runtime = makeRuntime({ fetchResults: [jsonResponse({ success: false, message: 'invalid sesskey' })] });
    const result = await postReplaySet(runtime, 'u', 'k', entry('a'));
    assert.equal(result.ok, false);
    assert.ok(result.reason.includes('rejected'));
    assert.ok(result.reason.includes('invalid sesskey'));
  });

  test('rejects a 200 whose body is not JSON', async () => {
    const runtime = makeRuntime({
      fetchResults: [{ ok: true, status: 200, json: async () => { throw new Error('not json'); } }],
    });
    const result = await postReplaySet(runtime, 'u', 'k', entry('a'));
    assert.deepEqual(result, { ok: false, reason: 'rejected' });
  });
});

describe('syncPendingOfflineSet — guards', () => {
  test('does nothing while Force cache is on', async () => {
    const runtime = makeRuntime({ queue: [entry('a')], forceCache: true });
    assert.equal(await syncPendingOfflineSet(runtime), false);
    assert.equal(runtime.fetchCalls.length, 0);
    assert.equal(runtime.queue.length, 1, 'the queue must be left untouched');
  });

  test('does nothing while offline', async () => {
    const runtime = makeRuntime({ queue: [entry('a')], online: false });
    assert.equal(await syncPendingOfflineSet(runtime), false);
    assert.equal(runtime.fetchCalls.length, 0);
  });

  test('does nothing when a drain is already in progress', async () => {
    const runtime = makeRuntime({ queue: [entry('a')], fetchResults: [jsonResponse({ success: true })] });
    runtime.syncInProgress = true;
    assert.equal(await syncPendingOfflineSet(runtime), false);
    assert.equal(runtime.fetchCalls.length, 0);
  });

  test('returns false (no work) on an empty queue', async () => {
    const runtime = makeRuntime({ queue: [] });
    assert.equal(await syncPendingOfflineSet(runtime), false);
  });
});

describe('syncPendingOfflineSet — draining', () => {
  test('drains every entry in arrival order and clears the queue', async () => {
    const runtime = makeRuntime({
      queue: [entry('a', '2026/01/01 00:00:01'), entry('b', '2026/01/01 00:00:02'), entry('c', '2026/01/01 00:00:03')],
      fetchResults: [
        jsonResponse({ success: true }),
        jsonResponse({ success: true }),
        jsonResponse({ success: true }),
      ],
    });

    const result = await syncPendingOfflineSet(runtime);

    assert.equal(result, true);
    assert.equal(runtime.queue.length, 0);
    assert.equal(runtime.fetchCalls.length, 3);
    // Last successfully synced date wins in the cache.
    assert.equal(runtime.cachedDate, '2026/01/01 00:00:03');
    assert.ok(runtime.posts.some((m) => m.startsWith('SET queue drained (3 synced)')));
  });

  test('stops on the first rejection, keeping the head entry and the following ones', async () => {
    const runtime = makeRuntime({
      queue: [entry('a', '2026/01/01 00:00:01'), entry('b', '2026/01/01 00:00:02'), entry('c')],
      fetchResults: [
        jsonResponse({ success: true }),
        jsonResponse({ success: false, message: 'boom' }),
      ],
    });

    const result = await syncPendingOfflineSet(runtime);

    // One entry synced before the stop → still reports progress.
    assert.equal(result, true);
    // Only the first entry was dequeued; b (the rejected one) and c remain, in order.
    assert.deepEqual(runtime.queue.map((e) => e.id), ['b', 'c']);
    assert.equal(runtime.fetchCalls.length, 2, 'must not try entries past the failing one');
    assert.equal(runtime.cachedDate, '2026/01/01 00:00:01');
    assert.ok(runtime.posts.some((m) => m.includes('SET sync stopped') && m.includes('2 left in queue')));
  });

  test('stops immediately and preserves the whole queue when the network drops mid-drain', async () => {
    const runtime = makeRuntime({
      queue: [entry('a'), entry('b')],
      fetchResults: [new Error('offline')],
    });

    const result = await syncPendingOfflineSet(runtime);

    assert.equal(result, false, 'no entry synced → no progress');
    assert.deepEqual(runtime.queue.map((e) => e.id), ['a', 'b']);
    assert.ok(runtime.posts.some((m) => m.includes('SET sync stopped (network)')));
  });

  test('releases the in-progress lock once the drain ends', async () => {
    const runtime = makeRuntime({ queue: [entry('a')], fetchResults: [jsonResponse({ success: true })] });
    await syncPendingOfflineSet(runtime);
    assert.equal(runtime.syncInProgress, false);
  });

  test('releases the in-progress lock even when a replay throws', async () => {
    const runtime = makeRuntime({ queue: [entry('a')], fetchResults: [new Error('offline')] });
    await syncPendingOfflineSet(runtime);
    assert.equal(runtime.syncInProgress, false);
  });
});
