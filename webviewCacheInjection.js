const CACHE_INJECTION_SOURCE = `(function() {
  if (window.__memoCacheInstalled) return;
  window.__memoCacheInstalled = true;

  var ENDPOINT_PATH = '/local/memorization/ajax/ajax.php';
  var MEMORIZATION_PATH = '/local/memorization/index.php';
  var CACHE_KEY = '__memo_last_date_string__';
  var SNAPSHOT_MESSAGE_PREFIX = '[OFFLINE_HTML] ';
  var FORCE_CACHE = __FORCE_CACHE__;
  var originalFetch = window.fetch;
  window.__memoForceCache = typeof window.__memoForceCache === 'boolean' ? window.__memoForceCache : FORCE_CACHE;

  function post(msg) {
    try {
      window.ReactNativeWebView.postMessage('[CACHE] ' + msg);
    } catch (e) {}
  }

  function postSnapshot(value) {
    try {
      window.ReactNativeWebView.postMessage(SNAPSHOT_MESSAGE_PREFIX + value);
    } catch (e) {}
  }

  function toBase64Utf8(value) {
    try {
      return btoa(unescape(encodeURIComponent(value)));
    } catch (e) {
      return '';
    }
  }

  function toArrayBufferToBase64(buffer) {
    try {
      var bytes = new Uint8Array(buffer);
      var chunk = 0x8000;
      var binary = '';
      for (var i = 0; i < bytes.length; i += chunk) {
        var sub = bytes.subarray(i, i + chunk);
        binary += String.fromCharCode.apply(null, sub);
      }
      return btoa(binary);
    } catch (e) {
      return '';
    }
  }

  function toAbsoluteUrl(rawUrl) {
    try {
      return new URL(rawUrl, window.location.href).href;
    } catch (e) {
      return '';
    }
  }

  function shouldCaptureSnapshot() {
    return window.location.pathname === MEMORIZATION_PATH;
  }

  async function fetchText(url) {
    var response = await originalFetch(url, { credentials: 'include' });
    if (!response.ok) return '';
    return response.text();
  }

  async function fetchAsDataUrl(url) {
    var response = await originalFetch(url, { credentials: 'include' });
    if (!response.ok) return '';
    var contentType = response.headers.get('content-type') || 'application/octet-stream';
    var buffer = await response.arrayBuffer();
    var base64 = toArrayBufferToBase64(buffer);
    if (!base64) return '';
    return 'data:' + contentType + ';base64,' + base64;
  }

  async function buildOfflineSnapshotHtml() {
    var parser = new DOMParser();
    var doc = parser.parseFromString(document.documentElement.outerHTML, 'text/html');

    var links = Array.prototype.slice.call(doc.querySelectorAll('link[rel="stylesheet"][href]'));
    for (var i = 0; i < links.length; i += 1) {
      var link = links[i];
      var href = link.getAttribute('href');
      var absHref = toAbsoluteUrl(href);
      if (!absHref) continue;
      try {
        var cssText = await fetchText(absHref);
        if (!cssText) continue;
        var style = doc.createElement('style');
        style.textContent = cssText;
        link.parentNode.replaceChild(style, link);
      } catch (e) {}
    }

    var scripts = Array.prototype.slice.call(doc.querySelectorAll('script[src]'));
    for (var j = 0; j < scripts.length; j += 1) {
      var script = scripts[j];
      var src = script.getAttribute('src');
      var absSrc = toAbsoluteUrl(src);
      if (!absSrc) continue;
      try {
        var jsText = await fetchText(absSrc);
        if (!jsText) continue;
        var jsBase64 = toBase64Utf8(jsText);
        if (!jsBase64) continue;
        script.setAttribute('src', 'data:application/javascript;base64,' + jsBase64);
        script.textContent = '';
      } catch (e) {}
    }

    var imageLike = Array.prototype.slice.call(doc.querySelectorAll('img[src], source[src], input[type="image"][src]'));
    for (var k = 0; k < imageLike.length; k += 1) {
      var node = imageLike[k];
      var nodeSrc = node.getAttribute('src');
      var absNodeSrc = toAbsoluteUrl(nodeSrc);
      if (!absNodeSrc) continue;
      try {
        var dataUrl = await fetchAsDataUrl(absNodeSrc);
        if (!dataUrl) continue;
        node.setAttribute('src', dataUrl);
      } catch (e) {}
    }

    var styleNodes = Array.prototype.slice.call(doc.querySelectorAll('[style]'));
    for (var m = 0; m < styleNodes.length; m += 1) {
      var styleNode = styleNodes[m];
      var styleValue = styleNode.getAttribute('style');
      if (!styleValue) continue;
      var nextStyle = styleValue.replace(/url\\((['"]?)(.*?)\\1\\)/g, function(_, quote, rawUrl) {
        if (!rawUrl || rawUrl.indexOf('data:') === 0) return 'url(' + rawUrl + ')';
        return 'url(' + toAbsoluteUrl(rawUrl) + ')';
      });
      styleNode.setAttribute('style', nextStyle);
    }

    return '<!doctype html>\\n' + doc.documentElement.outerHTML;
  }

  async function captureAndPostOfflineSnapshot() {
    if (!shouldCaptureSnapshot()) return;
    if (window.__memoSnapshotBuilding) return;
    window.__memoSnapshotBuilding = true;
    try {
      var html = await buildOfflineSnapshotHtml();
      if (!html) return;
      var encoded = encodeURIComponent(html);
      if (!encoded) return;
      postSnapshot(encoded);
      post('offline snapshot refreshed');
    } catch (e) {
      post('offline snapshot failed');
    } finally {
      window.__memoSnapshotBuilding = false;
    }
  }

  if (document.readyState === 'complete') {
    setTimeout(captureAndPostOfflineSnapshot, 300);
  } else {
    window.addEventListener('load', function() {
      setTimeout(captureAndPostOfflineSnapshot, 300);
    }, { once: true });
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

  function installOfflineButtonHandlers() {
    if (window.__memoOfflineButtonsInstalled) return;
    var shouldUseOfflineHandlers = window.__memoForceCache === true || navigator.onLine === false;
    if (!shouldUseOfflineHandlers) return;

    var getButton = document.getElementById('memorization-get');
    var setButton = document.getElementById('memorization-set');
    var contentNode = document.getElementById('memorization-content');
    if (!getButton || !setButton || !contentNode) return;

    window.__memoOfflineButtonsInstalled = true;
    post('offline GET/SET handlers installed');

    function setContent(value) {
      var normalized = normalizeDateString(value);
      contentNode.textContent = normalized || '';
    }

    function resolveDateFromJson(json) {
      return extractDateFromJson(json) || readCachedDate();
    }

    async function handleGet(event) {
      if (event) {
        event.preventDefault();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        event.stopPropagation();
      }
      try {
        var response = await window.fetch(ENDPOINT_PATH, {
          method: 'GET',
          credentials: 'include',
        });
        var json = await response.json();
        var dateString = resolveDateFromJson(json);
        if (dateString) setContent(dateString);
      } catch (e) {
        var fallbackDate = readCachedDate();
        if (fallbackDate) setContent(fallbackDate);
      }
    }

    async function handleSet(event) {
      if (event) {
        event.preventDefault();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        event.stopPropagation();
      }
      var dateString = normalizeDateString(Date.now());
      if (!dateString) return;
      writeCachedDate(dateString);
      setContent(dateString);
      try {
        await window.fetch(ENDPOINT_PATH, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams({ time: dateString }).toString(),
        });
      } catch (e) {}
    }

    getButton.addEventListener('click', handleGet, true);
    setButton.addEventListener('click', handleSet, true);

    var initial = readCachedDate();
    if (initial) setContent(initial);
  }

  function scheduleOfflineButtonHandlers() {
    installOfflineButtonHandlers();
    setTimeout(installOfflineButtonHandlers, 250);
    setTimeout(installOfflineButtonHandlers, 800);
    setTimeout(installOfflineButtonHandlers, 1600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleOfflineButtonHandlers, { once: true });
  } else {
    scheduleOfflineButtonHandlers();
  }
  window.addEventListener('offline', installOfflineButtonHandlers);

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
      var passThroughResponse = await originalFetch.apply(this, arguments);
      if (shouldCaptureSnapshot() && requestUrl.indexOf('/local/memorization/') !== -1) {
        setTimeout(captureAndPostOfflineSnapshot, 100);
      }
      return passThroughResponse;
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
