const CACHE_INJECTION_SOURCE = `(function() {
  if (window.__memoCacheInstalled) return;
  window.__memoCacheInstalled = true;

  var ENDPOINT_PATH = '/local/memorization/ajax/ajax.php';
  var CACHE_KEY = '__memo_last_date_string__';
  var FORCE_CACHE = __FORCE_CACHE__;
  var originalFetch = window.fetch;
  window.__memoForceCache = typeof window.__memoForceCache === 'boolean' ? window.__memoForceCache : FORCE_CACHE;

  function post(msg) {
    try {
      window.ReactNativeWebView.postMessage('[CACHE] ' + msg);
    } catch (e) {}
  }

  function normalizeDateString(value) {
    if (value === undefined || value === null) return '';
    var raw = String(value).trim();
    if (!raw) return '';
    var pad = function(n) { return String(n).padStart(2, '0'); };
    if (/^\\d{10}$/.test(raw)) {
      var secDate = new Date(Number(raw) * 1000);
      return secDate.getFullYear() + '/' + pad(secDate.getMonth() + 1) + '/' + pad(secDate.getDate()) + ' ' + pad(secDate.getHours()) + ':' + pad(secDate.getMinutes()) + ':' + pad(secDate.getSeconds());
    }
    if (/^\\d{13}$/.test(raw)) {
      var msDate = new Date(Number(raw));
      return msDate.getFullYear() + '/' + pad(msDate.getMonth() + 1) + '/' + pad(msDate.getDate()) + ' ' + pad(msDate.getHours()) + ':' + pad(msDate.getMinutes()) + ':' + pad(msDate.getSeconds());
    }
    return raw;
  }

  function readCachedDate() {
    try {
      return localStorage.getItem(CACHE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function writeCachedDate(value) {
    var dateString = normalizeDateString(value);
    if (!dateString) return '';
    try {
      localStorage.setItem(CACHE_KEY, dateString);
    } catch (e) {}
    return dateString;
  }

  function extractDateFromBody(body) {
    if (!body) return '';
    try {
      var text = typeof body === 'string' ? body : (typeof body.toString === 'function' ? body.toString() : '');
      var params = new URLSearchParams(text);
      return normalizeDateString(params.get('time') || params.get('date'));
    } catch (e) {
      return '';
    }
  }

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

  function buildCacheResponse(method, dateString) {
    if (!dateString) return null;
    var payload = method === 'POST'
      ? { success: true, result: 'OK', date: dateString, time: dateString }
      : { success: true, date: dateString, time: dateString, data: { date: dateString, time: dateString } };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  window.fetch = async function(input, init) {
    var requestUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (requestUrl.indexOf(ENDPOINT_PATH) === -1) {
      return originalFetch.apply(this, arguments);
    }

    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var requestBody = init && init.body ? init.body : null;

    if (method === 'POST') {
      var bodyDate = extractDateFromBody(requestBody);
      if (bodyDate) {
        writeCachedDate(bodyDate);
        post('SET cached date=' + bodyDate);
      }
    }

    if (window.__memoForceCache === true) {
      var forcedDate = readCachedDate();
      if (forcedDate) {
        post(method + ' forced cache hit');
        return buildCacheResponse(method, forcedDate);
      }
      post(method + ' forced cache miss');
    }

    try {
      var response = await originalFetch.apply(this, arguments);
      try {
        var json = await response.clone().json();
        var apiDate = extractDateFromJson(json);
        if (apiDate) {
          writeCachedDate(apiDate);
          post(method + ' network synced date=' + apiDate);
        }
      } catch (e) {}
      return response;
    } catch (error) {
      var fallbackDate = readCachedDate();
      if (fallbackDate) {
        post(method + ' network fallback cache hit');
        return buildCacheResponse(method, fallbackDate);
      }
      throw error;
    }
  };
})();
true;`;

export function createWebviewCacheInjection(config) {
  var forceCache = config && config.forceCache === true;
  return CACHE_INJECTION_SOURCE.replace('__FORCE_CACHE__', forceCache ? 'true' : 'false');
}

export default createWebviewCacheInjection;
