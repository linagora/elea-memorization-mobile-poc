export function createSnapshotTools(runtime) {
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
