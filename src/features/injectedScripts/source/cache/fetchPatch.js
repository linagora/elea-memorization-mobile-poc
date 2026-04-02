export function installFetchPatch() {
  var runtime = window.__memoCacheRuntime;
  if (!runtime) return;
  if (runtime.fetchPatched) return;

  runtime.fetchPatched = true;

  window.fetch = async function(input, init) {
    var requestUrl = runtime.getRequestUrl(input);

    if (requestUrl.indexOf(runtime.endpointPath) === -1) {
      var passthroughResponse = await runtime.originalFetch.apply(this, arguments);
      if (runtime.shouldRefreshSnapshotForUrl(requestUrl)) {
        setTimeout(runtime.captureAndPostOfflineSnapshot, 100);
      }
      return passthroughResponse;
    }

    var method = runtime.getRequestMethod(input, init);
    var requestBody = runtime.getRequestBody(init);

    if (method === 'POST') {
      var bodyDate = runtime.extractDateFromBody(requestBody);
      if (bodyDate) {
        runtime.writeCachedDate(bodyDate);
        runtime.post('SET cached date=' + bodyDate);
      }
    }

    if (runtime.isForceCacheEnabled()) {
      var forcedDate = runtime.readCachedDate();
      if (forcedDate) {
        runtime.post(method + ' forced cache hit');
        return runtime.buildCacheResponse(method, forcedDate);
      }
      runtime.post(method + ' forced cache miss');
    }

    try {
      var response = await runtime.originalFetch.apply(this, arguments);

      try {
        var json = await response.clone().json();
        var apiDate = runtime.extractDateFromJson(json);
        if (apiDate) {
          runtime.writeCachedDate(apiDate);
          runtime.post(method + ' network synced date=' + apiDate);
        }
      } catch (e) {}

      return response;
    } catch (error) {
      var fallbackDate = runtime.readCachedDate();
      if (fallbackDate) {
        runtime.post(method + ' network fallback cache hit');
        return runtime.buildCacheResponse(method, fallbackDate);
      }
      throw error;
    }
  };
}
