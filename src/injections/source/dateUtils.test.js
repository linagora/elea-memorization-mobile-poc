const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  formatDate,
  normalizeDateString,
  extractDateFromBody,
  extractDateFromJson,
  toUnixMs,
} = require('./dateUtils');

// Contrat serveur de référence :
//   { success: true, data: { time: "2026/01/08 15:22:23" }, message: "" }
// Le format canonique manipulé en interne est donc "YYYY/MM/DD HH:mm:ss".
//
// Les fonctions formatDate / toUnixMs / normalizeDateString(unix) travaillent en
// heure LOCALE. Les assertions ci-dessous restent donc déterministes quel que soit
// le fuseau : on compare soit à une Date construite localement, soit en round-trip.

describe('formatDate', () => {
  test('formate une Date en YYYY/MM/DD HH:mm:ss avec zéro-padding', () => {
    const date = new Date(2026, 0, 8, 15, 22, 23); // 8 janvier 2026, 15:22:23 (local)
    assert.equal(formatDate(date), '2026/01/08 15:22:23');
  });

  test('pad les composantes mono-chiffre (mois, jour, heures, minutes, secondes)', () => {
    const date = new Date(2026, 8, 5, 9, 4, 3); // 5 septembre 2026, 09:04:03
    assert.equal(formatDate(date), '2026/09/05 09:04:03');
  });
});

describe('normalizeDateString', () => {
  test('retourne une chaîne vide pour null / undefined / vide / espaces', () => {
    assert.equal(normalizeDateString(null), '');
    assert.equal(normalizeDateString(undefined), '');
    assert.equal(normalizeDateString(''), '');
    assert.equal(normalizeDateString('   '), '');
  });

  test('laisse passer une date déjà au format canonique', () => {
    assert.equal(normalizeDateString('2026/01/08 15:22:23'), '2026/01/08 15:22:23');
  });

  test('trim les espaces autour de la valeur', () => {
    assert.equal(normalizeDateString('  2026/01/08 15:22:23  '), '2026/01/08 15:22:23');
  });

  test('convertit un timestamp Unix en secondes (10 chiffres)', () => {
    const seconds = 1767000000;
    assert.equal(normalizeDateString(String(seconds)), formatDate(new Date(seconds * 1000)));
  });

  test('un timestamp 13 chiffres (ms) n’est PAS converti : les sources sont normalisées en secondes en amont', () => {
    assert.equal(normalizeDateString('1767000000123'), '1767000000123');
  });

  test('accepte une valeur numérique (non chaîne)', () => {
    const seconds = 1767000000;
    assert.equal(normalizeDateString(seconds), formatDate(new Date(seconds * 1000)));
  });

  test('round-trip avec toUnixMs : normalize(unix) puis toUnixMs redonne le même instant', () => {
    const seconds = 1767000000;
    const normalized = normalizeDateString(String(seconds));
    assert.equal(toUnixMs(normalized), seconds * 1000);
  });

  test('une chaîne non datée est renvoyée telle quelle (passthrough)', () => {
    assert.equal(normalizeDateString('pas une date'), 'pas une date');
  });

  test('un nombre à 11/12 chiffres n’est PAS traité comme un timestamp (ni 10 ni 13)', () => {
    assert.equal(normalizeDateString('12345678901'), '12345678901');
  });
});

describe('extractDateFromBody', () => {
  test('retourne une chaîne vide pour un corps vide / null', () => {
    assert.equal(extractDateFromBody(''), '');
    assert.equal(extractDateFromBody(null), '');
    assert.equal(extractDateFromBody(undefined), '');
  });

  test('extrait et normalise le paramètre "time" (timestamp secondes, comme la SPA)', () => {
    const seconds = 1767000000;
    assert.equal(extractDateFromBody('time=' + seconds), formatDate(new Date(seconds * 1000)));
  });

  test('retombe sur le paramètre "date" si "time" est absent', () => {
    assert.equal(extractDateFromBody('date=2026/01/08 15:22:23'), '2026/01/08 15:22:23');
  });

  test('"time" est prioritaire sur "date"', () => {
    const seconds = 1767000000;
    const body = 'time=' + seconds + '&date=2020/01/01 00:00:00';
    assert.equal(extractDateFromBody(body), formatDate(new Date(seconds * 1000)));
  });

  test('accepte un body URLSearchParams (via toString)', () => {
    const params = new URLSearchParams();
    params.set('time', '1767000000');
    assert.equal(extractDateFromBody(params), formatDate(new Date(1767000000 * 1000)));
  });

  test('retourne une chaîne vide quand ni "time" ni "date" ne sont présents', () => {
    assert.equal(extractDateFromBody('sesskey=abc&foo=bar'), '');
  });
});

describe('extractDateFromJson', () => {
  test('retourne une chaîne vide pour null / undefined', () => {
    assert.equal(extractDateFromJson(null), '');
    assert.equal(extractDateFromJson(undefined), '');
  });

  test('normalise une chaîne brute', () => {
    assert.equal(extractDateFromJson('2026/01/08 15:22:23'), '2026/01/08 15:22:23');
  });

  test('lit data.time — le contrat serveur officiel', () => {
    const json = { success: true, data: { time: '2026/01/08 15:22:23' }, message: '' };
    assert.equal(extractDateFromJson(json), '2026/01/08 15:22:23');
  });

  test('lit time au premier niveau (filet pour réponses de cache forcé)', () => {
    assert.equal(extractDateFromJson({ time: '2026/01/08 15:22:23' }), '2026/01/08 15:22:23');
  });

  test('data.time est prioritaire sur un time de premier niveau', () => {
    const json = { time: '2020/01/01 00:00:00', data: { time: '2026/01/08 15:22:23' } };
    assert.equal(extractDateFromJson(json), '2026/01/08 15:22:23');
  });

  test('normalise un timestamp Unix (secondes) trouvé dans data.time', () => {
    const seconds = 1767000000;
    assert.equal(extractDateFromJson({ data: { time: seconds } }), formatDate(new Date(seconds * 1000)));
  });

  test('ne sonde aucun chemin spéculatif (date, value, data.date, result.*)', () => {
    assert.equal(extractDateFromJson({ date: '2026/01/08 15:22:23' }), '');
    assert.equal(extractDateFromJson({ value: '2026/01/08 15:22:23' }), '');
    assert.equal(extractDateFromJson({ data: { date: '2026/01/08 15:22:23' } }), '');
    assert.equal(extractDateFromJson({ result: { time: '2026/01/08 15:22:23' } }), '');
    assert.equal(extractDateFromJson({ result: { date: '2026/01/08 15:22:23' } }), '');
  });

  test('retourne une chaîne vide si aucun champ date connu', () => {
    assert.equal(extractDateFromJson({ success: true, message: 'ok' }), '');
  });
});

describe('toUnixMs', () => {
  test('retourne 0 pour null / undefined / vide', () => {
    assert.equal(toUnixMs(null), 0);
    assert.equal(toUnixMs(undefined), 0);
    assert.equal(toUnixMs(''), 0);
    assert.equal(toUnixMs('   '), 0);
  });

  test('un timestamp 13 chiffres est renvoyé tel quel (millisecondes)', () => {
    assert.equal(toUnixMs('1767000000123'), 1767000000123);
  });

  test('un timestamp 10 chiffres est converti en millisecondes', () => {
    assert.equal(toUnixMs('1767000000'), 1767000000 * 1000);
  });

  test('une date canonique est parsée en heure locale', () => {
    assert.equal(toUnixMs('2026/01/08 15:22:23'), new Date(2026, 0, 8, 15, 22, 23).getTime());
  });

  test('retombe sur Date.parse pour un format ISO reconnu', () => {
    assert.equal(toUnixMs('2026-01-08T15:22:23.000Z'), Date.parse('2026-01-08T15:22:23.000Z'));
  });

  test('retourne 0 pour une chaîne non parsable', () => {
    assert.equal(toUnixMs('pas une date'), 0);
  });
});
