const WEBVIEW_CACHE_INJECTION_RAW = `(function() {
  if (window.__memoCacheInstalled) return;
  window.__memoCacheInstalled = true;

  var ENDPOINT = '\${MEMORIZATION_AJAX_URL}';
  var FORCE_CACHE = \${FORCED_CACHE};
  var CACHE_KEY = '__memo_cached_time__';
  var originalFetch = window.fetch;
  window.__memoForceCache =
    typeof window.__memoForceCache === 'boolean'
      ? window.__memoForceCache
      : FORCE_CACHE;

  function post(msg) {
    try {
      window.ReactNativeWebView.postMessage('[CACHE] ' + msg);
    } catch (e) {}
  }

  function readCachedTime() {
    try {
      return localStorage.getItem(CACHE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function writeCachedTime(time) {
    if (!time) return;
    try {
      var value = String(time);
      if (/^\\d{10}$/.test(value)) {
        var d = new Date(Number(value) * 1000);
        var pad = function(n) { return String(n).padStart(2, '0'); };
        value =
          d.getFullYear() + '/' +
          pad(d.getMonth() + 1) + '/' +
          pad(d.getDate()) + ' ' +
          pad(d.getHours()) + ':' +
          pad(d.getMinutes()) + ':' +
          pad(d.getSeconds());
      }
      localStorage.setItem(CACHE_KEY, value);
    } catch (e) {}
  }

  function responseFromCache() {
    var time = readCachedTime();
    if (!time) return null;
    return new Response(JSON.stringify({
      success: true,
      data: { time: time },
      source: 'cache'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  window.fetch = async function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) ? input.url : '';
    if (url.indexOf(ENDPOINT) !== 0) {
      return originalFetch.apply(this, arguments);
    }

    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();

    if (method === 'POST') {
      try {
        var body = init && init.body ? init.body : null;
        if (body && typeof body.toString === 'function') {
          var params = new URLSearchParams(body.toString());
          var optimisticTime = params.get('time');
          if (optimisticTime) {
            writeCachedTime(optimisticTime);
            post('SET local cache updated');
          }
        }
      } catch (e) {}
    }

    if (window.__memoForceCache) {
      var forcedCached = responseFromCache();
      if (forcedCached) {
        post(method + ' forced cache, served from cache');
        return forcedCached;
      }
      post(method + ' forced cache enabled, no local cache');
    }

    try {
      var response = await originalFetch.apply(this, arguments);
      var clone = response.clone();
      try {
        var json = await clone.json();
        var time = json && json.data ? json.data.time : null;
        if (json && json.success === true && time) {
          writeCachedTime(time);
          post(method + ' network OK, cache synced');
        }
      } catch (e) {}
      return response;
    } catch (error) {
      var cached = responseFromCache();
      if (cached) {
        post(method + ' network failed, served from cache');
        return cached;
      }
      throw error;
    }
  };
})();
true;`;

export default WEBVIEW_CACHE_INJECTION_RAW;
