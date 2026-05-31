// Fonctions de manipulation de dates partagées par les sources injectées (cache.js, setQueue.js).
// Pures (sans dépendance à `window`/`runtime`) afin d'être testables sous Node
// (cf. dateUtils.test.js) et réutilisables dans la WebView après bundling esbuild.
//
// Écrites en style ES5 (var) à dessein, comme les autres sources injectées, puis
// transpilées/minifiées par esbuild. Exportées en CommonJS pour que `node --test`
// puisse les charger sans configuration ESM.

function formatDate(date) {
  var pad = function(n) {
    return String(n).padStart(2, '0');
  };

  return (
    date.getFullYear() +
    '/' +
    pad(date.getMonth() + 1) +
    '/' +
    pad(date.getDate()) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds())
  );
}

function normalizeDateString(value) {
  if (value === undefined || value === null) return '';
  var raw = String(value).trim();
  if (!raw) return '';
  // Sources normalisées en secondes (Unix 10 chiffres) en amont (handleSet / makeSetEntry) :
  // pas de branche millisecondes ici ; sinon chaîne canonique en passthrough.
  if (/^\d{10}$/.test(raw)) return formatDate(new Date(Number(raw) * 1000));
  return raw;
}

function extractDateFromBody(body) {
  if (!body) return '';

  try {
    var text = typeof body === 'string' ? body : typeof body.toString === 'function' ? body.toString() : '';
    var params = new URLSearchParams(text);
    return normalizeDateString(params.get('time') || params.get('date'));
  } catch (e) {
    return '';
  }
}

function extractDateFromJson(json) {
  if (!json) return '';
  if (typeof json === 'string') return normalizeDateString(json);

  // Contrat serveur : la date vit dans data.time ; `time` de premier niveau toléré comme
  // filet (cache forcé), mais data.time prioritaire. Aucun autre chemin spéculatif.
  return normalizeDateString(json.data && json.data.time) || normalizeDateString(json.time);
}

function toUnixMs(value) {
  if (value === undefined || value === null) return 0;
  var raw = String(value).trim();
  if (!raw) return 0;
  if (/^\d{13}$/.test(raw)) return Number(raw);
  if (/^\d{10}$/.test(raw)) return Number(raw) * 1000;
  var match = raw.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6])
    ).getTime();
  }
  var parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = {
  formatDate: formatDate,
  normalizeDateString: normalizeDateString,
  extractDateFromBody: extractDateFromBody,
  extractDateFromJson: extractDateFromJson,
  toUnixMs: toUnixMs,
};
