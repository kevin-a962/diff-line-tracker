import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff } from './diff-parser.js';
import { traceLine, getContextLines } from './line-tracker.js';

// @@ -10,3 +10,4 @@
//  context1
// -removed1
// +added1
// +added2
//  context2
const [SINGLE_HUNK] = parseUnifiedDiff(`--- a/f.ts
+++ b/f.ts
@@ -10,3 +10,4 @@
 context1
-removed1
+added1
+added2
 context2
`);

test('old line before any hunk is unchanged and unshifted', () => {
  assert.deepEqual(traceLine(SINGLE_HUNK, 9, 'old'), { status: 'unchanged', line: 9 });
});

test('old context line maps to the same-content new line', () => {
  assert.deepEqual(traceLine(SINGLE_HUNK, 10, 'old'), { status: 'unchanged', line: 10 });
});

test('old removed line is reported as deleted', () => {
  assert.deepEqual(traceLine(SINGLE_HUNK, 11, 'old'), { status: 'deleted', line: null });
});

test('old context line after an insertion is shifted forward', () => {
  assert.deepEqual(traceLine(SINGLE_HUNK, 12, 'old'), { status: 'unchanged', line: 13 });
});

test('old line after the hunk is shifted by the net delta', () => {
  assert.deepEqual(traceLine(SINGLE_HUNK, 13, 'old'), { status: 'unchanged', line: 14 });
});

test('new line before any hunk is unchanged and unshifted', () => {
  assert.deepEqual(traceLine(SINGLE_HUNK, 9, 'new'), { status: 'unchanged', line: 9 });
});

test('new added line is reported as added', () => {
  assert.deepEqual(traceLine(SINGLE_HUNK, 11, 'new'), { status: 'added', line: null });
  assert.deepEqual(traceLine(SINGLE_HUNK, 12, 'new'), { status: 'added', line: null });
});

test('new context line after the insertion maps back to old', () => {
  assert.deepEqual(traceLine(SINGLE_HUNK, 13, 'new'), { status: 'unchanged', line: 12 });
});

test('new line after the hunk is shifted by the net delta', () => {
  assert.deepEqual(traceLine(SINGLE_HUNK, 14, 'new'), { status: 'unchanged', line: 13 });
});

// Two hunks in the same file, to check that offsets accumulate correctly
// across hunk boundaries rather than resetting.
//
// @@ -10,3 +10,4 @@        (net +1, as above)
// @@ -20,1 +21,2 @@        (net +1)
//  ...
// -removedA
// +addedA
// +addedB
const [TWO_HUNKS] = parseUnifiedDiff(`--- a/f.ts
+++ b/f.ts
@@ -10,3 +10,4 @@
 context1
-removed1
+added1
+added2
 context2
@@ -20,1 +21,2 @@
-removedA
+addedA
+addedB
`);

test('a line between two hunks is shifted by the first hunk only', () => {
  assert.deepEqual(traceLine(TWO_HUNKS, 15, 'old'), { status: 'unchanged', line: 16 });
});

test('a removed line inside the second hunk is deleted', () => {
  assert.deepEqual(traceLine(TWO_HUNKS, 20, 'old'), { status: 'deleted', line: null });
});

test('a line after both hunks accumulates both offsets', () => {
  assert.deepEqual(traceLine(TWO_HUNKS, 21, 'old'), { status: 'unchanged', line: 23 });
});

test('mirrored: a line after both hunks on the new side accumulates both offsets', () => {
  assert.deepEqual(traceLine(TWO_HUNKS, 23, 'new'), { status: 'unchanged', line: 21 });
});

const [MULTI_FILE_A, MULTI_FILE_B] = parseUnifiedDiff(`--- a/one.ts
+++ b/one.ts
@@ -1,1 +1,1 @@
-old one
+new one
--- a/two.ts
+++ b/two.ts
@@ -5,1 +5,3 @@
-old two
+new two a
+new two b
+new two c
`);

test('tracing is independent per file in a multi-file diff', () => {
  assert.deepEqual(traceLine(MULTI_FILE_A, 1, 'old'), { status: 'deleted', line: null });
  assert.deepEqual(traceLine(MULTI_FILE_B, 6, 'old'), { status: 'unchanged', line: 8 });
});

test('context lines around an old-side line include neighboring context and the removal', () => {
  assert.deepEqual(getContextLines(SINGLE_HUNK.hunks, 11, 'old', 1), [
    { line: 10, text: 'context1', marker: ' ' },
    { line: 11, text: 'removed1', marker: '-' },
    { line: 12, text: 'context2', marker: ' ' },
  ]);
});

test('context lines around a new-side line include neighboring context and the additions', () => {
  assert.deepEqual(getContextLines(SINGLE_HUNK.hunks, 11, 'new', 1), [
    { line: 10, text: 'context1', marker: ' ' },
    { line: 11, text: 'added1', marker: '+' },
    { line: 12, text: 'added2', marker: '+' },
  ]);
});

test('a radius of 0 returns only the requested line', () => {
  assert.deepEqual(getContextLines(SINGLE_HUNK.hunks, 11, 'old', 0), [{ line: 11, text: 'removed1', marker: '-' }]);
});

test('context is unavailable for a line outside every hunk', () => {
  assert.equal(getContextLines(SINGLE_HUNK.hunks, 9, 'old', 2), null);
});

test('context lookup uses the hunk containing the line, not the first hunk', () => {
  assert.deepEqual(getContextLines(TWO_HUNKS.hunks, 20, 'old', 0), [{ line: 20, text: 'removedA', marker: '-' }]);
});
