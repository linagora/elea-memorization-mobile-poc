import { handlePassthroughRequest } from './passthrough';
import { handleEndpointRequest } from './endpoint';

export function createPatchedFetch(runtime) {
  return async function patchedFetch(input, init) {
    var requestUrl = runtime.getRequestUrl(input);
    var args = arguments;

    if (requestUrl.indexOf(runtime.endpointPath) === -1) {
      return handlePassthroughRequest(runtime, this, args, requestUrl);
    }

    return handleEndpointRequest(runtime, this, args, input, init);
  };
}
