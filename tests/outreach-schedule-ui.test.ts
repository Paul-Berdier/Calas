import assert from 'node:assert/strict';
import test from 'node:test';
import { formatParisSchedule, parisScheduleCandidates, validateScheduledAt } from '../apps/web/src/admin/outreach-schedule';

test('Paris scheduling resolves winter and summer independently of browser timezone', () => {
  assert.deepEqual(parisScheduleCandidates('2027-01-20T09:30'), ['2027-01-20T08:30:00.000Z']);
  assert.deepEqual(parisScheduleCandidates('2027-07-20T09:30'), ['2027-07-20T07:30:00.000Z']);
});
test('nonexistent dates and spring DST gap are rejected', () => {
  for (const value of ['', '2027-02-30T09:30', '2027-03-28T02:30', '2027-01-20T24:30', '2027-13-20T09:30']) {
    assert.deepEqual(parisScheduleCandidates(value), [], value);
  }
});
test('autumn DST ambiguity exposes both instants for explicit selection', () => {
  assert.deepEqual(parisScheduleCandidates('2027-10-31T02:30'), ['2027-10-31T00:30:00.000Z', '2027-10-31T01:30:00.000Z']);
});
test('future boundary and scheduling horizon are validated again at confirmation', () => {
  const now=Date.parse('2026-11-12T10:00:00Z');
  assert.notEqual(validateScheduledAt('2026-11-12T10:00:00Z',now),'');
  assert.equal(validateScheduledAt('2026-11-12T10:01:00Z',now),'');
  assert.notEqual(validateScheduledAt('2027-11-14T10:00:00Z',now),'');
  assert.notEqual(validateScheduledAt('invalid',now),'');
  assert.match(formatParisSchedule('2027-01-20T08:30:00Z'),/09:30.*Paris/);
});
