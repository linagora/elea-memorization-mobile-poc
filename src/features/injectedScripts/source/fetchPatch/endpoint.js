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

export async function handleEndpointRequest(runtime, thisArg, args, input, init) {
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
