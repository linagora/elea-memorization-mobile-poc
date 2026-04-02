import { corePart } from './parts/corePart';
import { cacheUiPart } from './parts/cacheUiPart';
import { fetchPart } from './parts/fetchPart';

export function buildCacheInjectionSource() {
  return [corePart, cacheUiPart, fetchPart].join('\n');
}
