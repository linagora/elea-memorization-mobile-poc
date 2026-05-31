const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  formatDate,
  normalizeDateString,
  extractDateFromBody,
  extractDateFromJson,
  toUnixMs,
} = require('./dateUtils');

// Reference server contract:
//   { success: true, data: { time: "2026/01/08 15:22:23" }, message: "" }
// The canonical format handled internally is therefore "YYYY/MM/DD HH:mm:ss".
//
// formatDate / toUnixMs / normalizeDateString(unix) work in LOCAL time. The assertions
// below stay deterministic regardless of the timezone: they compare either against a
// locally-built Date or via round-trip.

describe('formatDate', () => {
  test('formats a Date as YYYY/MM/DD HH:mm:ss with zero-padding', () => {
    const date = new Date(2026, 0, 8, 15, 22, 23); // 8 January 2026, 15:22:23 (local)
    assert.equal(formatDate(date), '2026/01/08 15:22:23');
  });

  test('pads single-digit components (month, day, hours, minutes, seconds)', () => {
    const date = new Date(2026, 8, 5, 9, 4, 3); // 5 September 2026, 09:04:03
    assert.equal(formatDate(date), '2026/09/05 09:04:03');
  });
});

describe('normalizeDateString', () => {
  test('returns an empty string for null / undefined / empty / whitespace', () => {
    assert.equal(normalizeDateString(null), '');
    assert.equal(normalizeDateString(undefined), '');
    assert.equal(normalizeDateString(''), '');
    assert.equal(normalizeDateString('   '), '');
  });

  test('passes through a date already in canonical format', () => {
    assert.equal(normalizeDateString('2026/01/08 15:22:23'), '2026/01/08 15:22:23');
  });

  test('trims whitespace around the value', () => {
    assert.equal(normalizeDateString('  2026/01/08 15:22:23  '), '2026/01/08 15:22:23');
  });

  test('converts a Unix timestamp in seconds (10 digits)', () => {
    const seconds = 1767000000;
    assert.equal(normalizeDateString(String(seconds)), formatDate(new Date(seconds * 1000)));
  });

  test('a 13-digit (ms) timestamp is NOT converted: sources are normalized to seconds upstream', () => {
    assert.equal(normalizeDateString('1767000000123'), '1767000000123');
  });

  test('accepts a numeric value (non-string)', () => {
    const seconds = 1767000000;
    assert.equal(normalizeDateString(seconds), formatDate(new Date(seconds * 1000)));
  });

  test('round-trips with toUnixMs: normalize(unix) then toUnixMs yields the same instant', () => {
    const seconds = 1767000000;
    const normalized = normalizeDateString(String(seconds));
    assert.equal(toUnixMs(normalized), seconds * 1000);
  });

  test('a non-date string is returned as-is (passthrough)', () => {
    assert.equal(normalizeDateString('not a date'), 'not a date');
  });

  test('an 11/12-digit number is NOT treated as a timestamp (neither 10 nor 13)', () => {
    assert.equal(normalizeDateString('12345678901'), '12345678901');
  });
});

describe('extractDateFromBody', () => {
  test('returns an empty string for an empty / null body', () => {
    assert.equal(extractDateFromBody(''), '');
    assert.equal(extractDateFromBody(null), '');
    assert.equal(extractDateFromBody(undefined), '');
  });

  test('extracts and normalizes the "time" parameter (seconds timestamp, like the SPA)', () => {
    const seconds = 1767000000;
    assert.equal(extractDateFromBody('time=' + seconds), formatDate(new Date(seconds * 1000)));
  });

  test('falls back to the "date" parameter when "time" is absent', () => {
    assert.equal(extractDateFromBody('date=2026/01/08 15:22:23'), '2026/01/08 15:22:23');
  });

  test('"time" takes precedence over "date"', () => {
    const seconds = 1767000000;
    const body = 'time=' + seconds + '&date=2020/01/01 00:00:00';
    assert.equal(extractDateFromBody(body), formatDate(new Date(seconds * 1000)));
  });

  test('accepts a URLSearchParams body (via toString)', () => {
    const params = new URLSearchParams();
    params.set('time', '1767000000');
    assert.equal(extractDateFromBody(params), formatDate(new Date(1767000000 * 1000)));
  });

  test('returns an empty string when neither "time" nor "date" is present', () => {
    assert.equal(extractDateFromBody('sesskey=abc&foo=bar'), '');
  });
});

describe('extractDateFromJson', () => {
  test('returns an empty string for null / undefined', () => {
    assert.equal(extractDateFromJson(null), '');
    assert.equal(extractDateFromJson(undefined), '');
  });

  test('normalizes a raw string', () => {
    assert.equal(extractDateFromJson('2026/01/08 15:22:23'), '2026/01/08 15:22:23');
  });

  test('reads data.time — the official server contract', () => {
    const json = { success: true, data: { time: '2026/01/08 15:22:23' }, message: '' };
    assert.equal(extractDateFromJson(json), '2026/01/08 15:22:23');
  });

  test('reads a top-level time (fallback for forced-cache responses)', () => {
    assert.equal(extractDateFromJson({ time: '2026/01/08 15:22:23' }), '2026/01/08 15:22:23');
  });

  test('data.time takes precedence over a top-level time', () => {
    const json = { time: '2020/01/01 00:00:00', data: { time: '2026/01/08 15:22:23' } };
    assert.equal(extractDateFromJson(json), '2026/01/08 15:22:23');
  });

  test('normalizes a Unix timestamp (seconds) found in data.time', () => {
    const seconds = 1767000000;
    assert.equal(extractDateFromJson({ data: { time: seconds } }), formatDate(new Date(seconds * 1000)));
  });

  test('probes no speculative path (date, value, data.date, result.*)', () => {
    assert.equal(extractDateFromJson({ date: '2026/01/08 15:22:23' }), '');
    assert.equal(extractDateFromJson({ value: '2026/01/08 15:22:23' }), '');
    assert.equal(extractDateFromJson({ data: { date: '2026/01/08 15:22:23' } }), '');
    assert.equal(extractDateFromJson({ result: { time: '2026/01/08 15:22:23' } }), '');
    assert.equal(extractDateFromJson({ result: { date: '2026/01/08 15:22:23' } }), '');
  });

  test('returns an empty string when no known date field is present', () => {
    assert.equal(extractDateFromJson({ success: true, message: 'ok' }), '');
  });
});

describe('toUnixMs', () => {
  test('returns 0 for null / undefined / empty', () => {
    assert.equal(toUnixMs(null), 0);
    assert.equal(toUnixMs(undefined), 0);
    assert.equal(toUnixMs(''), 0);
    assert.equal(toUnixMs('   '), 0);
  });

  test('a 13-digit timestamp is returned as-is (milliseconds)', () => {
    assert.equal(toUnixMs('1767000000123'), 1767000000123);
  });

  test('a 10-digit timestamp is converted to milliseconds', () => {
    assert.equal(toUnixMs('1767000000'), 1767000000 * 1000);
  });

  test('a canonical date is parsed in local time', () => {
    assert.equal(toUnixMs('2026/01/08 15:22:23'), new Date(2026, 0, 8, 15, 22, 23).getTime());
  });

  test('falls back to Date.parse for a recognized ISO format', () => {
    assert.equal(toUnixMs('2026-01-08T15:22:23.000Z'), Date.parse('2026-01-08T15:22:23.000Z'));
  });

  test('returns 0 for an unparseable string', () => {
    assert.equal(toUnixMs('not a date'), 0);
  });
});
