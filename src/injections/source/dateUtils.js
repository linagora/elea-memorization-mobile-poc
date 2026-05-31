// Date helpers shared by the injected sources (cache.js, setQueue.js).
// Pure (no dependency on `window`/`runtime`) so they are testable under Node
// (see dateUtils.test.js) and reusable in the WebView after esbuild bundling.
//
// Written in ES5 style (var) on purpose, like the other injected sources, then
// transpiled/minified by esbuild. Exported as CommonJS so `node --test` can load them
// without ESM configuration.

function formatDate(date) {
  var pad = function(n) {
    return String(n).padStart(2, '0');
  };

  return (
    date.getFullYear() +
    '/' +
    pad(date.getMonth() + 1) +
    '/' +
    pad(date.getDate()) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds())
  );
}

function normalizeDateString(value) {
  if (value === undefined || value === null) return '';
  var raw = String(value).trim();
  if (!raw) return '';
  // Sources are normalized to seconds (10-digit Unix) upstream (handleSet / makeSetEntry):
  // no millisecond branch here; otherwise canonical string passthrough.
  if (/^\d{10}$/.test(raw)) return formatDate(new Date(Number(raw) * 1000));
  return raw;
}

function extractDateFromBody(body) {
  if (!body) return '';

  try {
    var text = typeof body === 'string' ? body : typeof body.toString === 'function' ? body.toString() : '';
    var params = new URLSearchParams(text);
    return normalizeDateString(params.get('time') || params.get('date'));
  } catch (e) {
    return '';
  }
}

function extractDateFromJson(json) {
  if (!json) return '';
  if (typeof json === 'string') return normalizeDateString(json);

  // Server contract: the date lives in data.time; a top-level `time` is tolerated as a
  // fallback (forced cache), but data.time wins. No other speculative path.
  return normalizeDateString(json.data && json.data.time) || normalizeDateString(json.time);
}

function toUnixMs(value) {
  if (value === undefined || value === null) return 0;
  var raw = String(value).trim();
  if (!raw) return 0;
  if (/^\d{13}$/.test(raw)) return Number(raw);
  if (/^\d{10}$/.test(raw)) return Number(raw) * 1000;
  var match = raw.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6])
    ).getTime();
  }
  var parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = {
  formatDate: formatDate,
  normalizeDateString: normalizeDateString,
  extractDateFromBody: extractDateFromBody,
  extractDateFromJson: extractDateFromJson,
  toUnixMs: toUnixMs,
};
