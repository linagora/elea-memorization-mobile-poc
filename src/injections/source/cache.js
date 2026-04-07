function applyRuntimeConstants(runtime) {
  // Centralize runtime keys and URL fragments used by all injected scripts.
  runtime.endpointPath = '/local/memorization/ajax/ajax.php';
  runtime.memorizationPath = '/local/memorization/index.php';
  runtime.cacheKey = '__memo_last_date_string__';
  runtime.snapshotMessagePrefix = '[OFFLINE_HTML] ';
}

function createMessagingTools(runtime) {
  // Post cache runtime logs back to React Native when the bridge is available.
  function post(message) {
    try {
      window.ReactNativeWebView.postMessage('[CACHE] ' + message);
    } catch (e) {}
  }

  // Send URL-encoded offline HTML snapshots with a dedicated prefix.
  function postSnapshot(value) {
    try {
      window.ReactNativeWebView.postMessage(runtime.snapshotMessagePrefix + value);
    } catch (e) {}
  }

  return {
    post: post,
    postSnapshot: postSnapshot,
  };
}

function initializeForceCacheFlag() {
  // Preserve a previous explicit value and otherwise default to false.
  var forceCacheFromConfig = window.__memoForceCache === true;
  window.__memoForceCache =
    typeof window.__memoForceCache === 'boolean' ? window.__memoForceCache : forceCacheFromConfig;
}

function createDateCacheTools(runtime) {
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

function createRequestTools(runtime) {
  // Build API-compatible JSON responses from the cached date.
  function buildCacheResponse(method, dateString) {
    if (!dateString) return null;

    var payload =
      method === 'POST'
        ? { success: true, result: 'OK', date: dateString, time: dateString }
        : { success: true, date: dateString, time: dateString, data: { date: dateString, time: dateString } };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  // Normalize fetch request inputs into reusable helpers.
  function getRequestUrl(input) {
    if (typeof input === 'string') return input;
    if (input && input.url) return input.url;
    return '';
  }

  function getRequestMethod(input, init) {
    return ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
  }

  function getRequestBody(init) {
    return init && init.body ? init.body : null;
  }

  function toAbsoluteUrl(rawUrl) {
    try {
      return new URL(rawUrl, window.location.href).href;
    } catch (e) {
      return '';
    }
  }

  return {
    buildCacheResponse: buildCacheResponse,
    getRequestUrl: getRequestUrl,
    getRequestMethod: getRequestMethod,
    getRequestBody: getRequestBody,
    toAbsoluteUrl: toAbsoluteUrl,
  };
}

function createSnapshotTools(runtime) {
  // Encode string content for inline data URI script replacement.
  function toBase64Utf8(value) {
    try {
      return btoa(unescape(encodeURIComponent(value)));
    } catch (e) {
      return '';
    }
  }

  // Convert binary responses to base64 without overflowing call stack.
  function arrayBufferToBase64(buffer) {
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
  }

  // Fetch text assets as-is while preserving authenticated cookies.
  async function fetchText(url) {
    var response = await runtime.originalFetch(url, { credentials: 'include' });
    return response.ok ? response.text() : '';
  }

  // Fetch media assets and convert them to data URLs.
  async function fetchAsDataUrl(url) {
    var response = await runtime.originalFetch(url, { credentials: 'include' });
    if (!response.ok) return '';

    var base64 = arrayBufferToBase64(await response.arrayBuffer());
    if (!base64) return '';

    var contentType = response.headers.get('content-type') || 'application/octet-stream';
    return 'data:' + contentType + ';base64,' + base64;
  }

  // Limit snapshot generation to the memorization page.
  function shouldCaptureSnapshot() {
    return window.location.pathname === runtime.memorizationPath;
  }

  function shouldRefreshSnapshotForUrl(url) {
    return shouldCaptureSnapshot() && url.indexOf('/local/memorization/') !== -1;
  }

  // Clone the current page and inline external assets so it works offline.
  async function buildOfflineSnapshotHtml() {
    var doc = new DOMParser().parseFromString(document.documentElement.outerHTML, 'text/html');

    var stylesheetNodes = Array.prototype.slice.call(doc.querySelectorAll('link[rel="stylesheet"][href]'));
    for (var i = 0; i < stylesheetNodes.length; i += 1) {
      var stylesheetNode = stylesheetNodes[i];
      var stylesheetUrl = runtime.toAbsoluteUrl(stylesheetNode.getAttribute('href'));
      if (!stylesheetUrl) continue;

      try {
        var stylesheetContent = await fetchText(stylesheetUrl);
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
        var scriptContent = await fetchText(scriptUrl);
        var scriptBase64 = toBase64Utf8(scriptContent);
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
        var mediaDataUrl = await fetchAsDataUrl(mediaUrl);
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
  }

  // Capture and post encoded snapshot while preventing concurrent work.
  async function captureAndPostOfflineSnapshot() {
    if (!shouldCaptureSnapshot() || runtime.snapshotBuilding) return;

    runtime.snapshotBuilding = true;
    try {
      var html = await buildOfflineSnapshotHtml();
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
  }

  // Delay capture slightly to let initial page rendering settle.
  function scheduleSnapshotCapture() {
    setTimeout(captureAndPostOfflineSnapshot, 300);
  }

  return {
    toBase64Utf8: toBase64Utf8,
    arrayBufferToBase64: arrayBufferToBase64,
    fetchText: fetchText,
    fetchAsDataUrl: fetchAsDataUrl,
    shouldCaptureSnapshot: shouldCaptureSnapshot,
    shouldRefreshSnapshotForUrl: shouldRefreshSnapshotForUrl,
    buildOfflineSnapshotHtml: buildOfflineSnapshotHtml,
    captureAndPostOfflineSnapshot: captureAndPostOfflineSnapshot,
    scheduleSnapshotCapture: scheduleSnapshotCapture,
  };
}

function assignTools(target, source) {
  var keys = Object.keys(source);
  for (var i = 0; i < keys.length; i += 1) {
    target[keys[i]] = source[keys[i]];
  }
}

function installCacheRuntime() {
  if (window.__memoCacheInstalled) return;
  window.__memoCacheInstalled = true;

  // Reuse an existing runtime object so other injected scripts keep stable references.
  var runtime = window.__memoCacheRuntime || {};

  applyRuntimeConstants(runtime);
  runtime.originalFetch = window.fetch;
  initializeForceCacheFlag();

  // Compose runtime behavior from focused modules.
  assignTools(runtime, createMessagingTools(runtime));
  assignTools(runtime, createDateCacheTools(runtime));
  assignTools(runtime, createRequestTools(runtime));
  assignTools(runtime, createSnapshotTools(runtime));

  runtime.isForceCacheEnabled = function() {
    return window.__memoForceCache === true;
  };

  window.__memoCacheRuntime = runtime;

  if (document.readyState === 'complete') {
    runtime.scheduleSnapshotCapture();
  } else {
    window.addEventListener('load', runtime.scheduleSnapshotCapture, { once: true });
  }
}

function installOfflineUi() {
  var runtime = window.__memoCacheRuntime;
  if (!runtime) return;

  function canInstallOfflineUi() {
    return runtime.isForceCacheEnabled() || navigator.onLine === false;
  }

  function getUiNodes() {
    var getButton = document.getElementById('memorization-get');
    var setButton = document.getElementById('memorization-set');
    var contentNode = document.getElementById('memorization-content');
    if (!getButton || !setButton || !contentNode) return null;
    return { getButton: getButton, setButton: setButton, contentNode: contentNode };
  }

  function stopEvent(event) {
    if (!event) return;
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function resolveDateFromJson(json) {
    return runtime.extractDateFromJson(json) || runtime.readCachedDate();
  }

  function installOfflineUiHandlers() {
    if (runtime.offlineUiInstalled) return;
    if (!canInstallOfflineUi()) return;

    var nodes = getUiNodes();
    if (!nodes) return;

    function setContent(value) {
      nodes.contentNode.textContent = runtime.normalizeDateString(value) || '';
    }

    async function handleGet(event) {
      if (!canInstallOfflineUi()) return;
      stopEvent(event);
      try {
        var response = await window.fetch(runtime.endpointPath, { method: 'GET', credentials: 'include' });
        var dateString = resolveDateFromJson(await response.json());
        if (dateString) setContent(dateString);
      } catch (e) {
        var fallbackDate = runtime.readCachedDate();
        if (fallbackDate) setContent(fallbackDate);
      }
    }

    async function handleSet(event) {
      if (!canInstallOfflineUi()) return;
      stopEvent(event);
      var dateString = runtime.normalizeDateString(Date.now());
      if (!dateString) return;

      runtime.writeCachedDate(dateString);
    }

    nodes.getButton.addEventListener('click', handleGet, true);
    nodes.setButton.addEventListener('click', handleSet, true);

    runtime.offlineUiInstalled = true;
    runtime.post('offline GET/SET handlers installed');

    var initialDate = runtime.readCachedDate();
    if (initialDate) setContent(initialDate);
  }

  function scheduleOfflineUiInstall() {
    installOfflineUiHandlers();
    setTimeout(installOfflineUiHandlers, 250);
    setTimeout(installOfflineUiHandlers, 800);
    setTimeout(installOfflineUiHandlers, 1600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleOfflineUiInstall, { once: true });
  } else {
    scheduleOfflineUiInstall();
  }

  window.addEventListener('offline', installOfflineUiHandlers);
}

async function handlePassthroughRequest(runtime, thisArg, args, requestUrl) {
  // Keep non-memorization requests unchanged and refresh snapshots when relevant pages mutate.
  var passthroughResponse = await runtime.originalFetch.apply(thisArg, args);
  if (runtime.shouldRefreshSnapshotForUrl(requestUrl)) {
    setTimeout(runtime.captureAndPostOfflineSnapshot, 100);
  }
  return passthroughResponse;
}

function trySyncDateFromPostBody(runtime, requestBody) {
  var bodyDate = runtime.extractDateFromBody(requestBody);
  if (!bodyDate) return;
  runtime.writeCachedDate(bodyDate);
  runtime.post('SET cached date=' + bodyDate);
}

function tryServeForcedCache(runtime, method) {
  if (!runtime.isForceCacheEnabled()) return null;

  var forcedDate = runtime.readCachedDate();
  if (forcedDate) {
    runtime.post(method + ' forced cache hit');
    return runtime.buildCacheResponse(method, forcedDate);
  }

  runtime.post(method + ' forced cache miss');
  return null;
}

async function trySyncDateFromNetwork(runtime, method, response) {
  if (method !== 'GET') return;
  try {
    var json = await response.clone().json();
    var apiDate = runtime.extractDateFromJson(json);
    if (!apiDate) return;
    runtime.writeCachedDate(apiDate);
    runtime.post(method + ' network synced date=' + apiDate);
  } catch (e) {}
}

function tryFallbackToCache(runtime, method) {
  var fallbackDate = runtime.readCachedDate();
  if (!fallbackDate) return null;
  runtime.post(method + ' network fallback cache hit');
  return runtime.buildCacheResponse(method, fallbackDate);
}

async function handleEndpointRequest(runtime, thisArg, args, input, init) {
  var method = runtime.getRequestMethod(input, init);
  var requestBody = runtime.getRequestBody(init);

  if (method === 'POST') {
    trySyncDateFromPostBody(runtime, requestBody);
  }

  var forcedResponse = tryServeForcedCache(runtime, method);
  if (forcedResponse) return forcedResponse;

  try {
    var response = await runtime.originalFetch.apply(thisArg, args);
    await trySyncDateFromNetwork(runtime, method, response);
    return response;
  } catch (error) {
    var fallbackResponse = tryFallbackToCache(runtime, method);
    if (fallbackResponse) return fallbackResponse;
    throw error;
  }
}

function createPatchedFetch(runtime) {
  return async function patchedFetch(input, init) {
    var requestUrl = runtime.getRequestUrl(input);
    var args = arguments;

    if (requestUrl.indexOf(runtime.endpointPath) === -1) {
      return handlePassthroughRequest(runtime, this, args, requestUrl);
    }

    return handleEndpointRequest(runtime, this, args, input, init);
  };
}

function installFetchPatch() {
  var runtime = window.__memoCacheRuntime;
  if (!runtime) return;
  if (runtime.fetchPatched) return;

  // Patch fetch once and delegate all behavior to focused handlers.
  runtime.fetchPatched = true;
  window.fetch = createPatchedFetch(runtime);
}

(function() {
  installCacheRuntime();
  installOfflineUi();
  installFetchPatch();
})();
