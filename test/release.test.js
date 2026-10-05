import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRelease, normalizeRelease, compareReleases, minRelease, isAvailableAt, docsVersionToRelease } from '../src/release.js';

test('parseRelease handles common 4D labels', () => {
  assert.deepEqual(parseRelease('17 R5'), { major: 17, r: 5, minor: 0, label: '17 R5' });
  assert.equal(normalizeRelease('v20R10'), '20 R10');
  assert.equal(normalizeRelease('4D v19 R2'), '19 R2');
  assert.equal(normalizeRelease('21'), '21');
  assert.equal(normalizeRelease('19 R8 '), '19 R8');
  assert.equal(normalizeRelease('11 SQL'), '11');
  assert.equal(normalizeRelease('2004'), '8');
  assert.equal(normalizeRelease('6.8.1'), '6');
  assert.equal(normalizeRelease('Release'), null);
  assert.equal(normalizeRelease(''), null);
  assert.equal(normalizeRelease(null), null);
});

test('compareReleases orders LTS and feature releases', () => {
  const ordered = ['17', '17 R5', '18', '18 R2', '18 R6', '19', '19 R2', '19 R10', '20', '20 R2', '20 R10', '21', '21 R2'];
  const shuffled = [...ordered].reverse();
  assert.deepEqual(shuffled.sort(compareReleases), ordered);
  assert.equal(compareReleases('20 R10', '20 R9') > 0, true);
  assert.equal(compareReleases('21', '20 R10') > 0, true);
  assert.equal(compareReleases('19', '18 R6') > 0, true);
  assert.equal(compareReleases('v18', '18'), 0);
});

test('minRelease / isAvailableAt / docsVersionToRelease', () => {
  assert.equal(minRelease(['19 R7', '17 R5', 'junk', '18']), '17 R5');
  assert.equal(minRelease([]), null);
  assert.equal(isAvailableAt('19 R7', '19 R6'), false);
  assert.equal(isAvailableAt('19 R7', '19 R7'), true);
  assert.equal(isAvailableAt('19 R7', '20'), true);
  assert.equal(isAvailableAt(null, '18'), true);
  assert.equal(isAvailableAt('21', null), true);
  assert.equal(docsVersionToRelease('21-R4'), '21 R4');
  assert.equal(docsVersionToRelease('latest'), null);
});
