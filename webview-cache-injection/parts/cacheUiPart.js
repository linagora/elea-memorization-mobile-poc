export const cacheUiPart = `
  function formatDate(date) {
    var pad = function(n) { return String(n).padStart(2, '0'); };
    return date.getFullYear() + '/' + pad(date.getMonth() + 1) + '/' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  }

  function normalizeDateString(value) {
    if (value === undefined || value === null) return '';
    var raw = String(value).trim();
    if (!raw) return '';
    if (/^\\d{10}$/.test(raw)) return formatDate(new Date(Number(raw) * 1000));
    if (/^\\d{13}$/.test(raw)) return formatDate(new Date(Number(raw)));
    return raw;
  }

  function readCachedDate() {
    try {
      return localStorage.getItem(CACHE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function writeCachedDate(value) {
    var dateString = normalizeDateString(value);
    if (!dateString) return '';
    try {
      localStorage.setItem(CACHE_KEY, dateString);
    } catch (e) {}
    return dateString;
  }

  function extractDateFromBody(body) {
    if (!body) return '';
    try {
      var text = typeof body === 'string' ? body : (typeof body.toString === 'function' ? body.toString() : '');
      var params = new URLSearchParams(text);
      return normalizeDateString(params.get('time') || params.get('date'));
    } catch (e) {
      return '';
    }
  }

  function extractDateFromJson(json) {
    if (!json) return '';
    if (typeof json === 'string') return normalizeDateString(json);
    var candidates = [
      json.time,
      json.date,
      json.value,
      json.data && json.data.time,
      json.data && json.data.date,
      json.result && json.result.time,
      json.result && json.result.date,
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var normalized = normalizeDateString(candidates[i]);
      if (normalized) return normalized;
    }
    return '';
  }

  function stopEvent(event) {
    if (!event) return;
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function installOfflineButtonHandlers() {
    if (window.__memoOfflineButtonsInstalled) return;
    if (!(window.__memoForceCache === true || navigator.onLine === false)) return;

    var getButton = document.getElementById('memorization-get');
    var setButton = document.getElementById('memorization-set');
    var contentNode = document.getElementById('memorization-content');
    if (!getButton || !setButton || !contentNode) return;

    window.__memoOfflineButtonsInstalled = true;
    post('offline GET/SET handlers installed');

    function setContent(value) {
      contentNode.textContent = normalizeDateString(value) || '';
    }

    function resolveDateFromJson(json) {
      return extractDateFromJson(json) || readCachedDate();
    }

    async function handleGet(event) {
      stopEvent(event);
      try {
        var response = await window.fetch(ENDPOINT_PATH, { method: 'GET', credentials: 'include' });
        var dateString = resolveDateFromJson(await response.json());
        if (dateString) setContent(dateString);
      } catch (e) {
        var fallbackDate = readCachedDate();
        if (fallbackDate) setContent(fallbackDate);
      }
    }

    async function handleSet(event) {
      stopEvent(event);
      var dateString = normalizeDateString(Date.now());
      if (!dateString) return;
      writeCachedDate(dateString);
      setContent(dateString);
      try {
        await window.fetch(ENDPOINT_PATH, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams({ time: dateString }).toString(),
        });
      } catch (e) {}
    }

    getButton.addEventListener('click', handleGet, true);
    setButton.addEventListener('click', handleSet, true);

    var initial = readCachedDate();
    if (initial) setContent(initial);
  }

  function scheduleOfflineButtonHandlers() {
    installOfflineButtonHandlers();
    setTimeout(installOfflineButtonHandlers, 250);
    setTimeout(installOfflineButtonHandlers, 800);
    setTimeout(installOfflineButtonHandlers, 1600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleOfflineButtonHandlers, { once: true });
  } else {
    scheduleOfflineButtonHandlers();
  }
  window.addEventListener('offline', installOfflineButtonHandlers);`;
