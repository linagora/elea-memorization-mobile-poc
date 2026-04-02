export const corePart = `(function() {
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
      var binary = '';
      for (var i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
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
    return response.ok ? response.text() : '';
  }

  async function fetchAsDataUrl(url) {
    var response = await originalFetch(url, { credentials: 'include' });
    if (!response.ok) return '';
    var base64 = toArrayBufferToBase64(await response.arrayBuffer());
    if (!base64) return '';
    return 'data:' + (response.headers.get('content-type') || 'application/octet-stream') + ';base64,' + base64;
  }

  async function buildOfflineSnapshotHtml() {
    var doc = new DOMParser().parseFromString(document.documentElement.outerHTML, 'text/html');

    var links = Array.prototype.slice.call(doc.querySelectorAll('link[rel="stylesheet"][href]'));
    for (var i = 0; i < links.length; i += 1) {
      var link = links[i];
      var absHref = toAbsoluteUrl(link.getAttribute('href'));
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
      var absSrc = toAbsoluteUrl(script.getAttribute('src'));
      if (!absSrc) continue;
      try {
        var jsBase64 = toBase64Utf8(await fetchText(absSrc));
        if (!jsBase64) continue;
        script.setAttribute('src', 'data:application/javascript;base64,' + jsBase64);
        script.textContent = '';
      } catch (e) {}
    }

    var imageLike = Array.prototype.slice.call(doc.querySelectorAll('img[src], source[src], input[type="image"][src]'));
    for (var k = 0; k < imageLike.length; k += 1) {
      var node = imageLike[k];
      var absNodeSrc = toAbsoluteUrl(node.getAttribute('src'));
      if (!absNodeSrc) continue;
      try {
        var dataUrl = await fetchAsDataUrl(absNodeSrc);
        if (dataUrl) node.setAttribute('src', dataUrl);
      } catch (e) {}
    }

    var styleNodes = Array.prototype.slice.call(doc.querySelectorAll('[style]'));
    for (var m = 0; m < styleNodes.length; m += 1) {
      var styleNode = styleNodes[m];
      var styleValue = styleNode.getAttribute('style');
      if (!styleValue) continue;
      styleNode.setAttribute('style', styleValue.replace(/url\\((['"]?)(.*?)\\1\\)/g, function(_, quote, rawUrl) {
        if (!rawUrl || rawUrl.indexOf('data:') === 0) return 'url(' + rawUrl + ')';
        return 'url(' + toAbsoluteUrl(rawUrl) + ')';
      }));
    }

    return '<!doctype html>\\n' + doc.documentElement.outerHTML;
  }

  async function captureAndPostOfflineSnapshot() {
    if (!shouldCaptureSnapshot() || window.__memoSnapshotBuilding) return;
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
  }`;
