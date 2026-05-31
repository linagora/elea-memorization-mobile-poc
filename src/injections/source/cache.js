var dateUtils = require('./dateUtils');
var formatDate = dateUtils.formatDate;
var normalizeDateString = dateUtils.normalizeDateString;
var extractDateFromBody = dateUtils.extractDateFromBody;
var extractDateFromJson = dateUtils.extractDateFromJson;

var setQueue = require('./setQueue');
var parseQueue = setQueue.parseQueue;
var serializeQueue = setQueue.serializeQueue;
var makeSetEntry = setQueue.makeSetEntry;
var enqueue = setQueue.enqueue;

var syncQueue = require('./syncQueue');
var syncPendingOfflineSet = syncQueue.syncPendingOfflineSet;

function applyRuntimeConstants(runtime) {
  runtime.endpointPath = '/local/memorization/ajax/ajax.php';
  runtime.memorizationPath = '/local/memorization/index.php';
  runtime.cacheKey = '__memo_last_date_string__';
  runtime.pendingSetQueueKey = '__memo_pending_set_queue_v1__';
  runtime.baseUrl = typeof window.__memoBaseUrl === 'string' ? window.__memoBaseUrl : '';
  runtime.snapshotMessagePrefix = '[OFFLINE_HTML] ';
}

function createMessagingTools(runtime) {
  function post(message) {
    try {
      window.ReactNativeWebView.postMessage('[CACHE] ' + message);
    } catch (e) {}
  }

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
  window.__memoForceCache = window.__memoForceCache === true;
}

function createDateCacheTools(runtime) {
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

  function readPendingSetQueue() {
    try {
      return parseQueue(localStorage.getItem(runtime.pendingSetQueueKey));
    } catch (e) {
      return [];
    }
  }

  function writePendingSetQueue(queue) {
    try {
      localStorage.setItem(runtime.pendingSetQueueKey, serializeQueue(queue));
    } catch (e) {}
    return Array.isArray(queue) ? queue : [];
  }

  function enqueuePendingSet(options) {
    var entry = makeSetEntry(options);
    writePendingSetQueue(enqueue(readPendingSetQueue(), entry));
    return entry;
  }

  function clearPendingSetQueue() {
    try {
      localStorage.removeItem(runtime.pendingSetQueueKey);
    } catch (e) {}
  }

  function pendingSetCount() {
    return readPendingSetQueue().length;
  }

  return {
    formatDate: formatDate,
    normalizeDateString: normalizeDateString,
    readCachedDate: readCachedDate,
    writeCachedDate: writeCachedDate,
    readPendingSetQueue: readPendingSetQueue,
    writePendingSetQueue: writePendingSetQueue,
    enqueuePendingSet: enqueuePendingSet,
    clearPendingSetQueue: clearPendingSetQueue,
    pendingSetCount: pendingSetCount,
    extractDateFromBody: extractDateFromBody,
    extractDateFromJson: extractDateFromJson,
  };
}

function createRequestTools(runtime) {
  function buildCacheResponse(dateString) {
    if (!dateString) return null;

    // Single shape matching the contract: { success, data:{time}, message }. The SPA reads
    // data.time (GET) and success (SET); nothing else is consumed.
    var payload = { success: true, data: { time: dateString }, message: '' };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  function buildOfflineErrorResponse() {
    // Per the alternative scenario: the offline SET is queued locally but we return a
    // failure to the single-page app (not a fake success).
    var payload = { success: false, message: 'offline', data: {} };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

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

  function bodyToText(body) {
    if (!body) return '';
    if (typeof body === 'string') return body;
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return body.toString();
    if (typeof body.toString === 'function') return body.toString();
    return '';
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
    buildOfflineErrorResponse: buildOfflineErrorResponse,
    getRequestUrl: getRequestUrl,
    getRequestMethod: getRequestMethod,
    getRequestBody: getRequestBody,
    bodyToText: bodyToText,
    toAbsoluteUrl: toAbsoluteUrl,
  };
}

function resolveEndpointUrlForSync(runtime) {
  if (runtime.baseUrl) {
    try {
      return new URL(runtime.endpointPath, runtime.baseUrl).href;
    } catch (e) {}
  }

  var absoluteFromLocation = runtime.toAbsoluteUrl(runtime.endpointPath);
  if (absoluteFromLocation) return absoluteFromLocation;

  return runtime.endpointPath;
}

function readLiveSesskey() {
  try {
    if (window.M && window.M.cfg && window.M.cfg.sesskey) {
      return String(window.M.cfg.sesskey);
    }
  } catch (e) {}
  return '';
}

function createSnapshotTools(runtime) {
  function toBase64Utf8(value) {
    try {
      return btoa(unescape(encodeURIComponent(value)));
    } catch (e) {
      return '';
    }
  }

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

  async function fetchText(url) {
    var response = await runtime.originalFetch(url, { credentials: 'include' });
    return response.ok ? response.text() : '';
  }

  async function fetchAsDataUrl(url) {
    var response = await runtime.originalFetch(url, { credentials: 'include' });
    if (!response.ok) return '';

    var base64 = arrayBufferToBase64(await response.arrayBuffer());
    if (!base64) return '';

    var contentType = response.headers.get('content-type') || 'application/octet-stream';
    return 'data:' + contentType + ';base64,' + base64;
  }

  function shouldCaptureSnapshot() {
    return window.location.pathname === runtime.memorizationPath;
  }

  function shouldRefreshSnapshotForUrl(url) {
    return shouldCaptureSnapshot() && url.indexOf('/local/memorization/') !== -1;
  }

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

  var runtime = window.__memoCacheRuntime || {};

  applyRuntimeConstants(runtime);
  runtime.originalFetch = window.fetch.bind(window);
  initializeForceCacheFlag();

  assignTools(runtime, createMessagingTools(runtime));
  assignTools(runtime, createDateCacheTools(runtime));
  assignTools(runtime, createRequestTools(runtime));
  assignTools(runtime, createSnapshotTools(runtime));
  // Glue to the browser environment used by the (pure) sync drain in syncQueue.js.
  runtime.isOnline = function() {
    return navigator.onLine !== false;
  };
  runtime.resolveSyncEndpointUrl = function() {
    return resolveEndpointUrlForSync(runtime);
  };
  runtime.readLiveSesskey = readLiveSesskey;
  runtime.syncPendingOfflineSet = function() {
    return syncPendingOfflineSet(runtime);
  };

  runtime.isForceCacheEnabled = function() {
    return window.__memoForceCache === true;
  };

  window.__memoCacheRuntime = runtime;
  setTimeout(runtime.syncPendingOfflineSet, 0);

  if (document.readyState === 'complete') {
    runtime.scheduleSnapshotCapture();
  } else {
    window.addEventListener('load', runtime.scheduleSnapshotCapture, { once: true });
  }
}

function installOfflineUi() {
  var runtime = window.__memoCacheRuntime;
  if (!runtime) return;
  if (window.__memoOfflineUiInstalled) return;
  window.__memoOfflineUiInstalled = true;

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

    function handleSet(event) {
      if (!canInstallOfflineUi()) return;
      stopEvent(event);
      // Seconds (10-digit Unix), like the SPA and the server: avoids introducing a
      // millisecond format into the cache and the queue.
      var nowSeconds = Math.floor(Date.now() / 1000);

      runtime.writeCachedDate(nowSeconds);
      var entry = runtime.enqueuePendingSet({ date: nowSeconds });
      setContent(entry.date);
      runtime.post('SET queued offline date=' + entry.date + ', ' + runtime.pendingSetCount() + ' in queue');
    }

    nodes.getButton.addEventListener('click', handleGet, true);
    nodes.setButton.addEventListener('click', handleSet, true);

    runtime.offlineUiInstalled = true;
    runtime.post('offline GET/SET handlers installed');
  }

  runtime.installOfflineUiHandlers = installOfflineUiHandlers;

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
  window.addEventListener('online', function() {
    if (runtime.syncPendingOfflineSet) runtime.syncPendingOfflineSet();
  });
}

async function handlePassthroughRequest(runtime, thisArg, args, requestUrl) {
  var passthroughResponse = await runtime.originalFetch.apply(thisArg, args);
  if (runtime.shouldRefreshSnapshotForUrl(requestUrl)) {
    setTimeout(runtime.captureAndPostOfflineSnapshot, 100);
  }
  return passthroughResponse;
}

function trySyncDateFromPostBody(runtime, requestBody) {
  var bodyDate = runtime.extractDateFromBody(requestBody);
  if (!bodyDate) return '';
  runtime.writeCachedDate(bodyDate);
  runtime.post('SET cached date=' + bodyDate);
  return bodyDate;
}

function tryServeForcedCache(runtime, method) {
  if (!runtime.isForceCacheEnabled()) return null;

  var forcedDate = runtime.readCachedDate();
  if (forcedDate) {
    runtime.post(method + ' forced cache hit');
    return runtime.buildCacheResponse(forcedDate);
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
  return runtime.buildCacheResponse(fallbackDate);
}

async function handleEndpointRequest(runtime, thisArg, args, input, init) {
  var method = runtime.getRequestMethod(input, init);
  var requestBody = runtime.getRequestBody(init);
  var requestBodyText = runtime.bodyToText(requestBody);
  var postDate = '';

  if (method === 'POST') {
    postDate = trySyncDateFromPostBody(runtime, requestBody);
  }

  var forcedResponse = tryServeForcedCache(runtime, method);
  if (forcedResponse) {
    if (method === 'POST') {
      var forcedEntry = runtime.enqueuePendingSet({ date: postDate, body: requestBodyText });
      runtime.post('SET queued (force cache) date=' + forcedEntry.date + ', ' + runtime.pendingSetCount() + ' in queue');
    }
    return forcedResponse;
  }

  try {
    var response = await runtime.originalFetch.apply(thisArg, args);
    if (method === 'POST') {
      // An HTTP 200 does not guarantee server-side acceptance (e.g. a CSRF failure rendered
      // as 200). We validate the success flag; if rejected while the server is reachable,
      // we enqueue for a later replay rather than lose the action.
      var accepted = false;
      if (response.ok) {
        try {
          accepted = (await response.clone().json()).success === true;
        } catch (e) {
          accepted = false;
        }
      }
      if (!accepted) {
        var rejectedEntry = runtime.enqueuePendingSet({ date: postDate, body: requestBodyText });
        runtime.post('SET rejected live, queued date=' + rejectedEntry.date + ', ' + runtime.pendingSetCount() + ' in queue');
      }
    }
    await trySyncDateFromNetwork(runtime, method, response);
    return response;
  } catch (error) {
    if (method === 'POST') {
      // Offline SET: the date is already cached, we enqueue the request for resync and
      // return a failure (see the "Alternative scenarios" diagram).
      var offlineEntry = runtime.enqueuePendingSet({ date: postDate, body: requestBodyText });
      runtime.post('SET offline, queued date=' + offlineEntry.date + ', ' + runtime.pendingSetCount() + ' in queue');
      return runtime.buildOfflineErrorResponse();
    }
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

  runtime.fetchPatched = true;
  window.fetch = createPatchedFetch(runtime);
}

(function() {
  installCacheRuntime();
  installOfflineUi();
  installFetchPatch();
})();
