import { installCacheRuntime } from './runtime';
import { installFetchPatch } from './fetchPatch';
import { installOfflineUi } from './offlineUi';

(function() {
  installCacheRuntime();
  installOfflineUi();
  installFetchPatch();
})();
