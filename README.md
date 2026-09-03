# diff-line-tracker

A stack trace says `src/app.ts:412`. You're looking at `src/app.ts` on a
branch that's had a dozen commits since the trace was captured, and line 412
is now something completely different. Did the crashing line move? Was it
deleted? Where is it now?

`diff-line-tracker` answers exactly that question. Point it at a unified
diff (a `git diff` output, a `.patch` file, anything `diff -u` would
produce), give it a file and a line number, and it tells you where that line
landed on the other side of the diff - or whether it's gone.

It doesn't render diffs, compute them, or apply them. It only answers "where
did this line go".

## Usage

```
diff-line-tracker --file <path> --line <n> [--side old|new] [--context <n>] [diff-file]
```

The diff is read from `<diff-file>` if given, otherwise from stdin. `--side`
says which side of the diff `<n>` belongs to (default `old`, meaning "before
the patch"). `<path>` is matched against the file paths recorded in the
diff's `---`/`+++` headers, with any `a/` or `b/` prefix stripped.

`--context <n>` prints `n` lines before and after the target line, pulled
from whichever hunk contains it. This only works for lines inside a hunk -
a unified diff never records the text of unchanged lines far from a
change, so there's nothing to show for those.

### From stdin

```
$ git diff | diff-line-tracker --file src/app.ts --line 42
src/app.ts:42 (old) -> src/app.ts:45 (new) [unchanged]
```

### From a file

```
$ diff-line-tracker --file src/app.ts --line 108 --side new patch.diff
src/app.ts:108 (new) -> src/app.ts:101 (old) [unchanged]
```

### A line that no longer exists

```
$ git diff | diff-line-tracker --file src/app.ts --line 60
src/app.ts:60 (old) -> was deleted
```

### A line that's new

```
$ git diff | diff-line-tracker --file src/app.ts --line 46 --side new
src/app.ts:46 (new) -> did not exist before this diff
```

### With surrounding context

```
$ git diff | diff-line-tracker --file src/app.ts --line 42 --context 2
src/app.ts:42 (old) -> src/app.ts:45 (new) [unchanged]
      40 |   const id = req.params.id;
      41 |   if (!record) {
>     42 |     return notFound();
      43 |   }
      44 | }
```

The `>` marks the requested line; `+`/`-` in that column (instead of a
blank) mean the line was only present on one side of the hunk.

## How it works

A unified diff already tells you, hunk by hunk, exactly which old lines
correspond to which new lines: context lines (` `) exist on both sides,
removed lines (`-`) exist only on the old side, added lines (`+`) only on
the new side. `diff-line-tracker` walks the hunks for the requested file,
tracks the old/new line counters through each one, and reports the mapping
for the exact line you asked about. Lines outside any hunk are assumed
unchanged and are shifted by the net line-count delta of the hunks before
them.

## Building

```
npm run build
```

produces `dist/cli.js`, runnable directly or via the `diff-line-tracker` bin
entry.

## Status

Early. Handles single- and multi-file unified diffs with standard `---`/
`+++`/`@@` headers (including git's `a/`/`b/` path prefixes and `/dev/null`
for added/removed files).

Run `npm test` to build and run the test suite (`node --test` against the
compiled output in `dist`).
