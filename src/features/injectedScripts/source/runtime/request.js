export function createRequestTools(runtime) {
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
