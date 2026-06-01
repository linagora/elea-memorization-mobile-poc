// FIFO queue of offline SETs, shared by the cache layer (cache.js).
//
// The sequence diagram (Alternative scenarios) calls for replaying "the set requests"
// (plural) when the network returns: we therefore keep a real multi-entry queue, in
// arrival order, rather than a single last value. Each entry carries the (form-urlencoded)
// body to replay; the `sesskey` (Moodle CSRF) is NOT stored but re-injected live at replay
// time (see buildReplayBody).
//
// Pure functions (no dependency on `window`/`localStorage`) so they are testable under
// Node (see setQueue.test.js). ES5 style (var), bundled/inlined by esbuild.

var dateUtils = require('./dateUtils');
var normalizeDateString = dateUtils.normalizeDateString;
var toUnixMs = dateUtils.toUnixMs;

// Guard against unbounded growth (localStorage / AsyncStorage limits): beyond this,
// keep the most recent entries.
var MAX_QUEUE_ENTRIES = 200;

function parseQueue(raw) {
  if (!raw) return [];

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  var result = [];
  for (var i = 0; i < parsed.length; i += 1) {
    var entry = parsed[i];
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.body !== 'string' || !entry.id) continue;

    result.push({
      id: String(entry.id),
      date: typeof entry.date === 'string' ? entry.date : '',
      body: entry.body,
      createdAt: Number(entry.createdAt) || 0,
    });
  }
  return result;
}

function serializeQueue(queue) {
  try {
    return JSON.stringify(Array.isArray(queue) ? queue : []);
  } catch (e) {
    return '[]';
  }
}

function makeSetEntry(options) {
  options = options || {};

  var now = Number(options.now) || Date.now();
  // `now` is in milliseconds (createdAt/id), but the canonical date is derived from seconds
  // to stay consistent with the server contract (see normalizeDateString).
  var date = normalizeDateString(options.date) || normalizeDateString(Math.floor(now / 1000));
  var body = typeof options.body === 'string' ? options.body : '';

  if (!body) {
    // No original body (SET via the offline UI, which bypasses the SPA): rebuild the
    // minimal payload the endpoint expects, identical to the SPA (time in seconds).
    var ms = toUnixMs(date) || now;
    body = 'time=' + Math.floor(ms / 1000);
  }

  var id = options.id
    ? String(options.id)
    : String(now) + '-' + Math.random().toString(36).slice(2, 10);

  return { id: id, date: date, body: body, createdAt: now };
}

function enqueue(queue, entry, maxEntries) {
  var max = maxEntries || MAX_QUEUE_ENTRIES;
  var next = Array.isArray(queue) ? queue.slice() : [];
  next.push(entry);
  if (next.length > max) {
    next = next.slice(next.length - max);
  }
  return next;
}

function buildReplayBody(body, liveSesskey) {
  var params = new URLSearchParams(typeof body === 'string' ? body : '');
  // The sesskey is mandatory and must be the page's live value: a sesskey stored offline
  // may be absent or stale.
  if (liveSesskey) {
    params.set('sesskey', String(liveSesskey));
  }
  return params.toString();
}

module.exports = {
  MAX_QUEUE_ENTRIES: MAX_QUEUE_ENTRIES,
  parseQueue: parseQueue,
  serializeQueue: serializeQueue,
  makeSetEntry: makeSetEntry,
  enqueue: enqueue,
  buildReplayBody: buildReplayBody,
};
