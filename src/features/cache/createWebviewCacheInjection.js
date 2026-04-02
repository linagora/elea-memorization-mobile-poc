import { createInjectedScript } from '../injectedScripts/createInjectedScript';
import { CACHE_INJECTION_SCRIPT } from '../injectedScripts/generated/injectedScripts.generated';

export function createWebviewCacheInjection(config) {
  return createInjectedScript({
    script: CACHE_INJECTION_SCRIPT,
    globals: {
      __memoForceCache: Boolean(config && config.forceCache === true),
    },
  });
}

export default createWebviewCacheInjection;
