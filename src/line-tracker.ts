import type { FileDiff, Hunk } from './diff-parser.js';

export type Side = 'old' | 'new';

export type TraceResult =
  | { status: 'unchanged'; line: number }
  | { status: 'deleted'; line: null }
  | { status: 'added'; line: null };

// Walks the hunks in old-line order, keeping a running offset between old
// and new line numbers for the parts of the file the hunks don't touch.
function traceOldToNew(hunks: Hunk[], lineNumber: number): TraceResult {
  let offset = 0;

  for (const hunk of hunks) {
    if (lineNumber < hunk.oldStart) {
      return { status: 'unchanged', line: lineNumber + offset };
    }

    const oldEnd = hunk.oldStart + hunk.oldLines - 1;
    if (lineNumber <= oldEnd) {
      let oldCursor = hunk.oldStart;
      let newCursor = hunk.newStart;
      for (const change of hunk.changes) {
        if (change.type === 'context') {
          if (oldCursor === lineNumber) return { status: 'unchanged', line: newCursor };
          oldCursor++;
          newCursor++;
        } else if (change.type === 'remove') {
          if (oldCursor === lineNumber) return { status: 'deleted', line: null };
          oldCursor++;
        } else {
          newCursor++;
        }
      }
      // the hunk's declared oldLines count didn't match its body; treat the
      // line as removed rather than guessing at a position
      return { status: 'deleted', line: null };
    }

    offset += hunk.newLines - hunk.oldLines;
  }

  return { status: 'unchanged', line: lineNumber + offset };
}

// Mirror of traceOldToNew: walks in new-line order to find where a line in
// the new file came from.
function traceNewToOld(hunks: Hunk[], lineNumber: number): TraceResult {
  let offset = 0;

  for (const hunk of hunks) {
    if (lineNumber < hunk.newStart) {
      return { status: 'unchanged', line: lineNumber + offset };
    }

    const newEnd = hunk.newStart + hunk.newLines - 1;
    if (lineNumber <= newEnd) {
      let oldCursor = hunk.oldStart;
      let newCursor = hunk.newStart;
      for (const change of hunk.changes) {
        if (change.type === 'context') {
          if (newCursor === lineNumber) return { status: 'unchanged', line: oldCursor };
          oldCursor++;
          newCursor++;
        } else if (change.type === 'add') {
          if (newCursor === lineNumber) return { status: 'added', line: null };
          newCursor++;
        } else {
          oldCursor++;
        }
      }
      return { status: 'added', line: null };
    }

    offset += hunk.oldLines - hunk.newLines;
  }

  return { status: 'unchanged', line: lineNumber + offset };
}

export function traceLine(file: FileDiff, lineNumber: number, side: Side): TraceResult {
  return side === 'old' ? traceOldToNew(file.hunks, lineNumber) : traceNewToOld(file.hunks, lineNumber);
}
