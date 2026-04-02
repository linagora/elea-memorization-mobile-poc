export function installOfflineUi() {
  var runtime = window.__memoCacheRuntime;
  if (!runtime) return;

  function canInstallOfflineUi() {
    return runtime.isForceCacheEnabled() || navigator.onLine === false;
  }

  function getUiNodes() {
    var getButton = document.getElementById('memorization-get');
    var setButton = document.getElementById('memorization-set');
    var contentNode = document.getElementById('memorization-content');
    if (!getButton || !setButton || !contentNode) return null;
    return { getButton: getButton, setButton: setButton, contentNode: contentNode };
  }

  function stopEvent(event) {
    if (!event) return;
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function resolveDateFromJson(json) {
    return runtime.extractDateFromJson(json) || runtime.readCachedDate();
  }

  function installOfflineUiHandlers() {
    if (runtime.offlineUiInstalled) return;
    if (!canInstallOfflineUi()) return;

    var nodes = getUiNodes();
    if (!nodes) return;

    function setContent(value) {
      nodes.contentNode.textContent = runtime.normalizeDateString(value) || '';
    }

    async function handleGet(event) {
      if (!canInstallOfflineUi()) return;
      stopEvent(event);
      try {
        var response = await window.fetch(runtime.endpointPath, { method: 'GET', credentials: 'include' });
        var dateString = resolveDateFromJson(await response.json());
        if (dateString) setContent(dateString);
      } catch (e) {
        var fallbackDate = runtime.readCachedDate();
        if (fallbackDate) setContent(fallbackDate);
      }
    }

    async function handleSet(event) {
      if (!canInstallOfflineUi()) return;
      stopEvent(event);
      var dateString = runtime.normalizeDateString(Date.now());
      if (!dateString) return;

      runtime.writeCachedDate(dateString);
    }

    nodes.getButton.addEventListener('click', handleGet, true);
    nodes.setButton.addEventListener('click', handleSet, true);

    runtime.offlineUiInstalled = true;
    runtime.post('offline GET/SET handlers installed');

    var initialDate = runtime.readCachedDate();
    if (initialDate) setContent(initialDate);
  }

  function scheduleOfflineUiInstall() {
    installOfflineUiHandlers();
    setTimeout(installOfflineUiHandlers, 250);
    setTimeout(installOfflineUiHandlers, 800);
    setTimeout(installOfflineUiHandlers, 1600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleOfflineUiInstall, { once: true });
  } else {
    scheduleOfflineUiInstall();
  }

  window.addEventListener('offline', installOfflineUiHandlers);
}
