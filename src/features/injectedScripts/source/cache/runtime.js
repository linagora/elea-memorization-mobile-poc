export function installCacheRuntime() {
  if (window.__memoCacheInstalled) return;
  window.__memoCacheInstalled = true;

  var runtime = window.__memoCacheRuntime || {};

  runtime.endpointPath = '/local/memorization/ajax/ajax.php';
  runtime.memorizationPath = '/local/memorization/index.php';
  runtime.cacheKey = '__memo_last_date_string__';
  runtime.snapshotMessagePrefix = '[OFFLINE_HTML] ';
  runtime.originalFetch = window.fetch;

  var forceCacheFromConfig = window.__memoForceCache === true;
  window.__memoForceCache =
    typeof window.__memoForceCache === 'boolean' ? window.__memoForceCache : forceCacheFromConfig;

  runtime.post = function(message) {
    try {
      window.ReactNativeWebView.postMessage('[CACHE] ' + message);
    } catch (e) {}
  };

  runtime.postSnapshot = function(value) {
    try {
      window.ReactNativeWebView.postMessage(runtime.snapshotMessagePrefix + value);
    } catch (e) {}
  };

  runtime.formatDate = function(date) {
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
  };

  runtime.normalizeDateString = function(value) {
    if (value === undefined || value === null) return '';
    var raw = String(value).trim();
    if (!raw) return '';
    if (/^\d{10}$/.test(raw)) return runtime.formatDate(new Date(Number(raw) * 1000));
    if (/^\d{13}$/.test(raw)) return runtime.formatDate(new Date(Number(raw)));
    return raw;
  };

  runtime.readCachedDate = function() {
    try {
      return localStorage.getItem(runtime.cacheKey) || '';
    } catch (e) {
      return '';
    }
  };

  runtime.writeCachedDate = function(value) {
    var normalized = runtime.normalizeDateString(value);
    if (!normalized) return '';
    try {
      localStorage.setItem(runtime.cacheKey, normalized);
    } catch (e) {}
    return normalized;
  };

  runtime.extractDateFromBody = function(body) {
    if (!body) return '';

    try {
      var text = typeof body === 'string' ? body : typeof body.toString === 'function' ? body.toString() : '';
      var params = new URLSearchParams(text);
      return runtime.normalizeDateString(params.get('time') || params.get('date'));
    } catch (e) {
      return '';
    }
  };

  runtime.extractDateFromJson = function(json) {
    if (!json) return '';
    if (typeof json === 'string') return runtime.normalizeDateString(json);

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
      var normalized = runtime.normalizeDateString(candidates[i]);
      if (normalized) return normalized;
    }

    return '';
  };

  runtime.buildCacheResponse = function(method, dateString) {
    if (!dateString) return null;

    var payload =
      method === 'POST'
        ? { success: true, result: 'OK', date: dateString, time: dateString }
        : { success: true, date: dateString, time: dateString, data: { date: dateString, time: dateString } };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };

  runtime.getRequestUrl = function(input) {
    if (typeof input === 'string') return input;
    if (input && input.url) return input.url;
    return '';
  };

  runtime.getRequestMethod = function(input, init) {
    return ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
  };

  runtime.getRequestBody = function(init) {
    return init && init.body ? init.body : null;
  };

  runtime.toAbsoluteUrl = function(rawUrl) {
    try {
      return new URL(rawUrl, window.location.href).href;
    } catch (e) {
      return '';
    }
  };

  runtime.toBase64Utf8 = function(value) {
    try {
      return btoa(unescape(encodeURIComponent(value)));
    } catch (e) {
      return '';
    }
  };

  runtime.arrayBufferToBase64 = function(buffer) {
    try {
      var bytes = new Uint8Array(buffer);
      var binary = '';
      for (var i = 0; i < bytes.length; i += 32768) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
      }
      return btoa(binary);
    } catch (e) {
      return '';
    }
  };

  runtime.fetchText = async function(url) {
    var response = await runtime.originalFetch(url, { credentials: 'include' });
    return response.ok ? response.text() : '';
  };

  runtime.fetchAsDataUrl = async function(url) {
    var response = await runtime.originalFetch(url, { credentials: 'include' });
    if (!response.ok) return '';

    var base64 = runtime.arrayBufferToBase64(await response.arrayBuffer());
    if (!base64) return '';

    var contentType = response.headers.get('content-type') || 'application/octet-stream';
    return 'data:' + contentType + ';base64,' + base64;
  };

  runtime.shouldCaptureSnapshot = function() {
    return window.location.pathname === runtime.memorizationPath;
  };

  runtime.shouldRefreshSnapshotForUrl = function(url) {
    return runtime.shouldCaptureSnapshot() && url.indexOf('/local/memorization/') !== -1;
  };

  runtime.isForceCacheEnabled = function() {
    return window.__memoForceCache === true;
  };

  runtime.buildOfflineSnapshotHtml = async function() {
    var doc = new DOMParser().parseFromString(document.documentElement.outerHTML, 'text/html');

    var stylesheetNodes = Array.prototype.slice.call(doc.querySelectorAll('link[rel="stylesheet"][href]'));
    for (var i = 0; i < stylesheetNodes.length; i += 1) {
      var stylesheetNode = stylesheetNodes[i];
      var stylesheetUrl = runtime.toAbsoluteUrl(stylesheetNode.getAttribute('href'));
      if (!stylesheetUrl) continue;

      try {
        var stylesheetContent = await runtime.fetchText(stylesheetUrl);
        if (!stylesheetContent) continue;

        var styleNode = doc.createElement('style');
        styleNode.textContent = stylesheetContent;
        stylesheetNode.parentNode.replaceChild(styleNode, stylesheetNode);
      } catch (e) {}
    }

    var scriptNodes = Array.prototype.slice.call(doc.querySelectorAll('script[src]'));
    for (var j = 0; j < scriptNodes.length; j += 1) {
      var scriptNode = scriptNodes[j];
      var scriptUrl = runtime.toAbsoluteUrl(scriptNode.getAttribute('src'));
      if (!scriptUrl) continue;

      try {
        var scriptContent = await runtime.fetchText(scriptUrl);
        var scriptBase64 = runtime.toBase64Utf8(scriptContent);
        if (!scriptBase64) continue;

        scriptNode.setAttribute('src', 'data:application/javascript;base64,' + scriptBase64);
        scriptNode.textContent = '';
      } catch (e) {}
    }

    var mediaNodes = Array.prototype.slice.call(
      doc.querySelectorAll('img[src], source[src], input[type="image"][src]')
    );
    for (var k = 0; k < mediaNodes.length; k += 1) {
      var mediaNode = mediaNodes[k];
      var mediaUrl = runtime.toAbsoluteUrl(mediaNode.getAttribute('src'));
      if (!mediaUrl) continue;

      try {
        var mediaDataUrl = await runtime.fetchAsDataUrl(mediaUrl);
        if (mediaDataUrl) mediaNode.setAttribute('src', mediaDataUrl);
      } catch (e) {}
    }

    var styledNodes = Array.prototype.slice.call(doc.querySelectorAll('[style]'));
    for (var m = 0; m < styledNodes.length; m += 1) {
      var styledNode = styledNodes[m];
      var styleValue = styledNode.getAttribute('style');
      if (!styleValue) continue;

      var normalizedStyleValue = styleValue.replace(/url\((['"]?)(.*?)\1\)/g, function(_, quote, rawUrl) {
        if (!rawUrl || rawUrl.indexOf('data:') === 0) return 'url(' + rawUrl + ')';
        return 'url(' + runtime.toAbsoluteUrl(rawUrl) + ')';
      });

      styledNode.setAttribute('style', normalizedStyleValue);
    }

    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  };

  runtime.captureAndPostOfflineSnapshot = async function() {
    if (!runtime.shouldCaptureSnapshot() || runtime.snapshotBuilding) return;

    runtime.snapshotBuilding = true;
    try {
      var html = await runtime.buildOfflineSnapshotHtml();
      if (!html) return;

      var encodedHtml = encodeURIComponent(html);
      if (!encodedHtml) return;

      runtime.postSnapshot(encodedHtml);
      runtime.post('offline snapshot refreshed');
    } catch (e) {
      runtime.post('offline snapshot failed');
    } finally {
      runtime.snapshotBuilding = false;
    }
  };

  runtime.scheduleSnapshotCapture = function() {
    setTimeout(runtime.captureAndPostOfflineSnapshot, 300);
  };

  window.__memoCacheRuntime = runtime;

  if (document.readyState === 'complete') {
    runtime.scheduleSnapshotCapture();
  } else {
    window.addEventListener('load', runtime.scheduleSnapshotCapture, { once: true });
  }
}
