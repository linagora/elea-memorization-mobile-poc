export const fetchPart = `
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
