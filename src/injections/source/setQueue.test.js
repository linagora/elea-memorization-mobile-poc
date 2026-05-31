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

// The FIFO queue replays "the set requests" in order (see the sequence diagram). These
// tests cover the pure functions underneath; the orchestration (drain, storage, live
// sesskey) lives in cache.js and builds on these primitives.

describe('parseQueue', () => {
  test('returns an empty queue for empty / null / undefined input', () => {
    assert.deepEqual(parseQueue(''), []);
    assert.deepEqual(parseQueue(null), []);
    assert.deepEqual(parseQueue(undefined), []);
  });

  test('returns an empty queue for invalid JSON', () => {
    assert.deepEqual(parseQueue('{not json'), []);
  });

  test('returns an empty queue when the root is not an array', () => {
    assert.deepEqual(parseQueue('{"id":"a","body":"time=1"}'), []);
  });

  test('filters out entries without a string body or without an id', () => {
    const raw = JSON.stringify([
      { id: 'a', body: 'time=1' }, // valid
      { id: 'b' }, // no body
      { body: 'time=2' }, // no id
      { id: 'c', body: 42 }, // non-string body
      null,
      'not an object',
    ]);
    const queue = parseQueue(raw);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].id, 'a');
  });

  test('normalizes fields (id to string, numeric createdAt, empty default date)', () => {
    const raw = JSON.stringify([{ id: 7, body: 'time=1', createdAt: '1700000000000' }]);
    const queue = parseQueue(raw);
    assert.deepEqual(queue[0], { id: '7', date: '', body: 'time=1', createdAt: 1700000000000 });
  });
});

describe('serializeQueue', () => {
  test('round-trips with parseQueue', () => {
    const queue = [{ id: 'a', date: '2026/01/08 15:22:23', body: 'time=1767000000', createdAt: 123 }];
    assert.deepEqual(parseQueue(serializeQueue(queue)), queue);
  });

  test('returns "[]" for a non-array value', () => {
    assert.equal(serializeQueue(null), '[]');
    assert.equal(serializeQueue({ foo: 'bar' }), '[]');
  });
});

describe('makeSetEntry', () => {
  test('keeps the provided body and normalizes the date, with deterministic id/now', () => {
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

  test('without a body: rebuilds the minimal time=<seconds> payload from the date', () => {
    const entry = makeSetEntry({ date: '2026/01/08 15:22:23', id: 'x', now: 1700000000000 });
    const expectedSec = Math.floor(new Date(2026, 0, 8, 15, 22, 23).getTime() / 1000);
    assert.equal(entry.body, 'time=' + expectedSec);
  });

  test('without body or date: derives the date and time from `now` converted to seconds', () => {
    const now = 1700000000000;
    const entry = makeSetEntry({ id: 'x', now });
    const expectedSec = Math.floor(now / 1000);
    assert.equal(entry.date, formatDate(new Date(expectedSec * 1000)));
    assert.equal(entry.body, 'time=' + expectedSec);
  });

  test('accepts a numeric date in seconds (10-digit Unix) and normalizes it', () => {
    const seconds = 1767000000;
    const entry = makeSetEntry({ date: seconds, body: 'time=1', id: 'x', now: 1700000000000 });
    assert.equal(entry.date, formatDate(new Date(seconds * 1000)));
  });

  test('generates an id prefixed with `now` when no id is provided', () => {
    const entry = makeSetEntry({ body: 'time=1', now: 1700000000000 });
    assert.equal(typeof entry.id, 'string');
    assert.ok(entry.id.startsWith('1700000000000-'));
  });
});

describe('enqueue', () => {
  test('appends the entry to the queue without mutating the source', () => {
    const queue = [{ id: 'a' }];
    const next = enqueue(queue, { id: 'b' });
    assert.deepEqual(next.map((e) => e.id), ['a', 'b']);
    assert.equal(queue.length, 1, 'the source queue must not be mutated');
  });

  test('starts a queue from a non-array value', () => {
    assert.deepEqual(enqueue(null, { id: 'a' }).map((e) => e.id), ['a']);
  });

  test('caps the queue, keeping the most recent entries', () => {
    const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const next = enqueue(queue, { id: 'd' }, 3);
    assert.deepEqual(next.map((e) => e.id), ['b', 'c', 'd']);
  });

  test('exposes a sensible default limit', () => {
    assert.equal(typeof MAX_QUEUE_ENTRIES, 'number');
    assert.ok(MAX_QUEUE_ENTRIES > 0);
  });
});

describe('buildReplayBody', () => {
  test('injects the live sesskey and preserves the other parameters', () => {
    const body = buildReplayBody('time=1767000000', 'live-key');
    const params = new URLSearchParams(body);
    assert.equal(params.get('time'), '1767000000');
    assert.equal(params.get('sesskey'), 'live-key');
  });

  test('overwrites a stale sesskey present in the body', () => {
    const body = buildReplayBody('time=1767000000&sesskey=stale', 'fresh');
    const params = new URLSearchParams(body);
    assert.equal(params.get('sesskey'), 'fresh');
    // a single sesskey, no duplicate
    assert.equal(params.getAll('sesskey').length, 1);
  });

  test('rebuilds a minimal body when the body is empty', () => {
    assert.equal(buildReplayBody('', 'k'), 'sesskey=k');
  });

  test('leaves the body intact when no live sesskey is available', () => {
    assert.equal(buildReplayBody('time=1767000000', ''), 'time=1767000000');
  });
});
