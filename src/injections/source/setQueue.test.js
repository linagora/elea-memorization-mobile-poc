const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_QUEUE_ENTRIES,
  parseQueue,
  serializeQueue,
  makeSetEntry,
  enqueue,
  buildReplayBody,
} = require('./setQueue');
const { formatDate } = require('./dateUtils');

// La file FIFO rejoue « les requêtes set » dans l'ordre (cf. diagramme client). Ces
// tests couvrent les fonctions pures qui la sous-tendent ; l'orchestration (drain,
// stockage, sesskey vivant) vit dans cache.js et s'appuie sur ces briques.

describe('parseQueue', () => {
  test('retourne une file vide pour entrée vide / null / undefined', () => {
    assert.deepEqual(parseQueue(''), []);
    assert.deepEqual(parseQueue(null), []);
    assert.deepEqual(parseQueue(undefined), []);
  });

  test('retourne une file vide pour du JSON invalide', () => {
    assert.deepEqual(parseQueue('{pas du json'), []);
  });

  test('retourne une file vide si la racine n’est pas un tableau', () => {
    assert.deepEqual(parseQueue('{"id":"a","body":"time=1"}'), []);
  });

  test('filtre les entrées sans body string ou sans id', () => {
    const raw = JSON.stringify([
      { id: 'a', body: 'time=1' }, // valide
      { id: 'b' }, // pas de body
      { body: 'time=2' }, // pas d'id
      { id: 'c', body: 42 }, // body non-string
      null,
      'pas un objet',
    ]);
    const queue = parseQueue(raw);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].id, 'a');
  });

  test('normalise les champs (id en string, createdAt numérique, date par défaut vide)', () => {
    const raw = JSON.stringify([{ id: 7, body: 'time=1', createdAt: '1700000000000' }]);
    const queue = parseQueue(raw);
    assert.deepEqual(queue[0], { id: '7', date: '', body: 'time=1', createdAt: 1700000000000 });
  });
});

describe('serializeQueue', () => {
  test('round-trip avec parseQueue', () => {
    const queue = [{ id: 'a', date: '2026/01/08 15:22:23', body: 'time=1767000000', createdAt: 123 }];
    assert.deepEqual(parseQueue(serializeQueue(queue)), queue);
  });

  test('retourne "[]" pour une valeur non tableau', () => {
    assert.equal(serializeQueue(null), '[]');
    assert.equal(serializeQueue({ foo: 'bar' }), '[]');
  });
});

describe('makeSetEntry', () => {
  test('conserve le body fourni et normalise la date, avec id/now déterministes', () => {
    const entry = makeSetEntry({
      date: '2026/01/08 15:22:23',
      body: 'time=1767000000&sesskey=old',
      id: 'fixed-id',
      now: 1700000000000,
    });
    assert.deepEqual(entry, {
      id: 'fixed-id',
      date: '2026/01/08 15:22:23',
      body: 'time=1767000000&sesskey=old',
      createdAt: 1700000000000,
    });
  });

  test('sans body : reconstruit le payload minimal time=<secondes> à partir de la date', () => {
    const entry = makeSetEntry({ date: '2026/01/08 15:22:23', id: 'x', now: 1700000000000 });
    const expectedSec = Math.floor(new Date(2026, 0, 8, 15, 22, 23).getTime() / 1000);
    assert.equal(entry.body, 'time=' + expectedSec);
  });

  test('sans body ni date : dérive la date et le time de `now` converti en secondes', () => {
    const now = 1700000000000;
    const entry = makeSetEntry({ id: 'x', now });
    const expectedSec = Math.floor(now / 1000);
    assert.equal(entry.date, formatDate(new Date(expectedSec * 1000)));
    assert.equal(entry.body, 'time=' + expectedSec);
  });

  test('accepte une date numérique en secondes (Unix 10 chiffres) et la normalise', () => {
    const seconds = 1767000000;
    const entry = makeSetEntry({ date: seconds, body: 'time=1', id: 'x', now: 1700000000000 });
    assert.equal(entry.date, formatDate(new Date(seconds * 1000)));
  });

  test('génère un id préfixé par `now` quand aucun id n’est fourni', () => {
    const entry = makeSetEntry({ body: 'time=1', now: 1700000000000 });
    assert.equal(typeof entry.id, 'string');
    assert.ok(entry.id.startsWith('1700000000000-'));
  });
});

describe('enqueue', () => {
  test('ajoute l’entrée en fin de file sans muter l’entrée d’origine', () => {
    const queue = [{ id: 'a' }];
    const next = enqueue(queue, { id: 'b' });
    assert.deepEqual(next.map((e) => e.id), ['a', 'b']);
    assert.equal(queue.length, 1, 'la file source ne doit pas être mutée');
  });

  test('démarre une file à partir d’une valeur non tableau', () => {
    assert.deepEqual(enqueue(null, { id: 'a' }).map((e) => e.id), ['a']);
  });

  test('plafonne la file en conservant les entrées les plus récentes', () => {
    const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const next = enqueue(queue, { id: 'd' }, 3);
    assert.deepEqual(next.map((e) => e.id), ['b', 'c', 'd']);
  });

  test('expose une limite par défaut raisonnable', () => {
    assert.equal(typeof MAX_QUEUE_ENTRIES, 'number');
    assert.ok(MAX_QUEUE_ENTRIES > 0);
  });
});

describe('buildReplayBody', () => {
  test('injecte le sesskey vivant et préserve les autres paramètres', () => {
    const body = buildReplayBody('time=1767000000', 'live-key');
    const params = new URLSearchParams(body);
    assert.equal(params.get('time'), '1767000000');
    assert.equal(params.get('sesskey'), 'live-key');
  });

  test('écrase un sesskey périmé présent dans le body', () => {
    const body = buildReplayBody('time=1767000000&sesskey=stale', 'fresh');
    const params = new URLSearchParams(body);
    assert.equal(params.get('sesskey'), 'fresh');
    // un seul sesskey, pas de doublon
    assert.equal(params.getAll('sesskey').length, 1);
  });

  test('reconstruit un body minimal quand le body est vide', () => {
    assert.equal(buildReplayBody('', 'k'), 'sesskey=k');
  });

  test('laisse le body intact si aucun sesskey vivant n’est disponible', () => {
    assert.equal(buildReplayBody('time=1767000000', ''), 'time=1767000000');
  });
});
