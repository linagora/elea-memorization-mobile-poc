import { FORCE_CACHE_PLACEHOLDER } from './constants';
import { buildCacheInjectionSource } from './buildCacheInjectionSource';

const CACHE_INJECTION_SOURCE = buildCacheInjectionSource();

export function createWebviewCacheInjection(config) {
  var forceCache = config && config.forceCache === true;
  return CACHE_INJECTION_SOURCE.replace(FORCE_CACHE_PLACEHOLDER, forceCache ? 'true' : 'false');
}

export default createWebviewCacheInjection;
