import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff } from './diff-parser.js';

const SINGLE_HUNK = `--- a/src/app.ts
+++ b/src/app.ts
@@ -10,3 +10,4 @@
 context1
-removed1
+added1
+added2
 context2
`;

test('parses paths and strips a/ b/ prefixes', () => {
  const [file] = parseUnifiedDiff(SINGLE_HUNK);
  assert.equal(file.oldPath, 'src/app.ts');
  assert.equal(file.newPath, 'src/app.ts');
});

test('parses hunk header counts and change lines in order', () => {
  const [file] = parseUnifiedDiff(SINGLE_HUNK);
  assert.equal(file.hunks.length, 1);
  const hunk = file.hunks[0];
  assert.deepEqual(
    { oldStart: hunk.oldStart, oldLines: hunk.oldLines, newStart: hunk.newStart, newLines: hunk.newLines },
    { oldStart: 10, oldLines: 3, newStart: 10, newLines: 4 },
  );
  assert.deepEqual(hunk.changes, [
    { type: 'context', text: 'context1' },
    { type: 'remove', text: 'removed1' },
    { type: 'add', text: 'added1' },
    { type: 'add', text: 'added2' },
    { type: 'context', text: 'context2' },
  ]);
});

test('a hunk header with no comma means a single line', () => {
  const diff = `--- a/f.ts
+++ b/f.ts
@@ -5 +5,2 @@
-old
+new1
+new2
`;
  const [file] = parseUnifiedDiff(diff);
  const hunk = file.hunks[0];
  assert.equal(hunk.oldLines, 1);
  assert.equal(hunk.newLines, 2);
});

test('parses multiple hunks within one file', () => {
  const diff = `--- a/f.ts
+++ b/f.ts
@@ -10,1 +10,2 @@
-removedA
+addedA
+addedB
@@ -20,2 +21,1 @@
 context
-removedB
`;
  const [file] = parseUnifiedDiff(diff);
  assert.equal(file.hunks.length, 2);
  assert.equal(file.hunks[0].oldStart, 10);
  assert.equal(file.hunks[1].oldStart, 20);
});

test('parses multiple files, ignoring diff --git and index noise', () => {
  const diff = `diff --git a/one.ts b/one.ts
index abc123..def456 100644
--- a/one.ts
+++ b/one.ts
@@ -1,1 +1,1 @@
-old one
+new one
diff --git a/two.ts b/two.ts
index 111111..222222 100644
--- a/two.ts
+++ b/two.ts
@@ -3,1 +3,2 @@
 context
+added
`;
  const files = parseUnifiedDiff(diff);
  assert.equal(files.length, 2);
  assert.equal(files[0].oldPath, 'one.ts');
  assert.equal(files[1].oldPath, 'two.ts');
  assert.equal(files[1].hunks[0].changes.length, 2);
});

test('/dev/null on the old side means the file was added', () => {
  const diff = `--- /dev/null
+++ b/new-file.ts
@@ -0,0 +1,2 @@
+line one
+line two
`;
  const [file] = parseUnifiedDiff(diff);
  assert.equal(file.oldPath, null);
  assert.equal(file.newPath, 'new-file.ts');
});

test('/dev/null on the new side means the file was removed', () => {
  const diff = `--- a/gone.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-line one
-line two
`;
  const [file] = parseUnifiedDiff(diff);
  assert.equal(file.oldPath, 'gone.ts');
  assert.equal(file.newPath, null);
});

test('strips trailing timestamps some diff producers append to headers', () => {
  const diff = `--- a/f.ts\t2024-01-01 00:00:00.000000000 +0000
+++ b/f.ts\t2024-01-02 00:00:00.000000000 +0000
@@ -1,1 +1,1 @@
-old
+new
`;
  const [file] = parseUnifiedDiff(diff);
  assert.equal(file.oldPath, 'f.ts');
  assert.equal(file.newPath, 'f.ts');
});

test('a blank line inside a hunk is treated as a blank context line', () => {
  const diff = `--- a/f.ts
+++ b/f.ts
@@ -1,3 +1,3 @@
 first

 third
`;
  const [file] = parseUnifiedDiff(diff);
  assert.deepEqual(file.hunks[0].changes[1], { type: 'context', text: '' });
});
