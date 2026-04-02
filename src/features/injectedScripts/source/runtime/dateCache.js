export function createDateCacheTools(runtime) {
  // Format dates in the same string format expected by the memorization endpoint.
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

  // Normalize all date-like values to a stable string before caching.
  function normalizeDateString(value) {
    if (value === undefined || value === null) return '';
    var raw = String(value).trim();
    if (!raw) return '';
    if (/^\d{10}$/.test(raw)) return formatDate(new Date(Number(raw) * 1000));
    if (/^\d{13}$/.test(raw)) return formatDate(new Date(Number(raw)));
    return raw;
  }

  // Read and write cached date values with localStorage safety guards.
  function readCachedDate() {
    try {
      return localStorage.getItem(runtime.cacheKey) || '';
    } catch (e) {
      return '';
    }
  }

  function writeCachedDate(value) {
    var normalized = normalizeDateString(value);
    if (!normalized) return '';
    try {
      localStorage.setItem(runtime.cacheKey, normalized);
    } catch (e) {}
    return normalized;
  }

  // Extract memo date values from form-encoded request bodies.
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

  // Extract memo date values from known API response payload shapes.
  function extractDateFromJson(json) {
    if (!json) return '';
    if (typeof json === 'string') return normalizeDateString(json);

    var candidates = [
      json.time,
      json.date,
      json.value,
      json.data && json.data.time,
      json.data && json.data.date,
      json.result && json.result.time,
      json.result && json.result.date,
    ];

    for (var i = 0; i < candidates.length; i += 1) {
      var normalized = normalizeDateString(candidates[i]);
      if (normalized) return normalized;
    }

    return '';
  }

  return {
    formatDate: formatDate,
    normalizeDateString: normalizeDateString,
    readCachedDate: readCachedDate,
    writeCachedDate: writeCachedDate,
    extractDateFromBody: extractDateFromBody,
    extractDateFromJson: extractDateFromJson,
  };
}
