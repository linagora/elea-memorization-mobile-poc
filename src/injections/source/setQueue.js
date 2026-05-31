// File FIFO des SET hors ligne, partagée par la couche cache (cache.js).
//
// Le diagramme client (Scénarios alternatifs) prévoit de rejouer « les requêtes set »
// (au pluriel) au retour du réseau : on conserve donc une vraie file multi-entrées,
// dans l'ordre d'arrivée, plutôt qu'une dernière valeur unique. Chaque entrée porte le
// corps (form-urlencoded) à rejouer ; le `sesskey` (CSRF Moodle) n'est PAS mémorisé mais
// réinjecté vivant au moment du rejeu (cf. buildReplayBody).
//
// Fonctions pures (aucune dépendance à `window`/`localStorage`) afin d'être testables
// sous Node (cf. setQueue.test.js). Style ES5 (var), bundlé/inliné par esbuild.

var dateUtils = require('./dateUtils');
var normalizeDateString = dateUtils.normalizeDateString;
var toUnixMs = dateUtils.toUnixMs;

// Garde-fou contre une croissance illimitée (limites localStorage / AsyncStorage) :
// au-delà, on conserve les entrées les plus récentes.
var MAX_QUEUE_ENTRIES = 200;

function parseQueue(raw) {
  if (!raw) return [];

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  var result = [];
  for (var i = 0; i < parsed.length; i += 1) {
    var entry = parsed[i];
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.body !== 'string' || !entry.id) continue;

    result.push({
      id: String(entry.id),
      date: typeof entry.date === 'string' ? entry.date : '',
      body: entry.body,
      createdAt: Number(entry.createdAt) || 0,
    });
  }
  return result;
}

function serializeQueue(queue) {
  try {
    return JSON.stringify(Array.isArray(queue) ? queue : []);
  } catch (e) {
    return '[]';
  }
}

function makeSetEntry(options) {
  options = options || {};

  var now = Number(options.now) || Date.now();
  // `now` est en millisecondes (createdAt/id), mais la date canonique se dérive de secondes
  // pour rester cohérente avec le contrat serveur (cf. normalizeDateString).
  var date = normalizeDateString(options.date) || normalizeDateString(Math.floor(now / 1000));
  var body = typeof options.body === 'string' ? options.body : '';

  if (!body) {
    // Pas de corps d'origine (SET via l'UI offline, qui court-circuite la SPA) : on
    // reconstruit le payload minimal attendu par l'endpoint, identique à la SPA (time
    // en secondes).
    var ms = toUnixMs(date) || now;
    body = 'time=' + Math.floor(ms / 1000);
  }

  var id = options.id
    ? String(options.id)
    : String(now) + '-' + Math.random().toString(36).slice(2, 10);

  return { id: id, date: date, body: body, createdAt: now };
}

function enqueue(queue, entry, maxEntries) {
  var max = maxEntries || MAX_QUEUE_ENTRIES;
  var next = Array.isArray(queue) ? queue.slice() : [];
  next.push(entry);
  if (next.length > max) {
    next = next.slice(next.length - max);
  }
  return next;
}

function buildReplayBody(body, liveSesskey) {
  var params = new URLSearchParams(typeof body === 'string' ? body : '');
  // Le sesskey est obligatoire et doit être la valeur vivante de la page : un sesskey
  // mémorisé hors ligne peut être absent ou périmé.
  if (liveSesskey) {
    params.set('sesskey', String(liveSesskey));
  }
  return params.toString();
}

module.exports = {
  MAX_QUEUE_ENTRIES: MAX_QUEUE_ENTRIES,
  parseQueue: parseQueue,
  serializeQueue: serializeQueue,
  makeSetEntry: makeSetEntry,
  enqueue: enqueue,
  buildReplayBody: buildReplayBody,
};
