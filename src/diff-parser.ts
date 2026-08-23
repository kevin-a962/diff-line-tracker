export type LineChange =
  | { type: 'context'; text: string }
  | { type: 'add'; text: string }
  | { type: 'remove'; text: string };

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: LineChange[];
}

export interface FileDiff {
  // null means the path is /dev/null, i.e. the file didn't exist on that side
  oldPath: string | null;
  newPath: string | null;
  hunks: Hunk[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function parseFilePath(raw: string): string | null {
  // strip the trailing "\t<timestamp>" that some diff producers add
  const path = raw.split('\t')[0].trim();
  if (path === '/dev/null') return null;
  if (path.startsWith('a/') || path.startsWith('b/')) return path.slice(2);
  return path;
}

// Parses a unified diff (as produced by `diff -u` or `git diff`) into one
// entry per file. Anything outside of --- / +++ / @@ / +- context lines
// (git's "diff --git", "index ...", mode lines, etc.) is ignored, since none
// of it is needed to map line numbers across the patch.
export function parseUnifiedDiff(diffText: string): FileDiff[] {
  const lines = diffText.split('\n');
  const files: FileDiff[] = [];
  let current: FileDiff | null = null;
  let currentHunk: Hunk | null = null;

  const finishHunk = () => {
    if (currentHunk && current) {
      current.hunks.push(currentHunk);
    }
    currentHunk = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('--- ') && lines[i + 1]?.startsWith('+++ ')) {
      finishHunk();
      current = {
        oldPath: parseFilePath(line.slice(4)),
        newPath: parseFilePath(lines[i + 1].slice(4)),
        hunks: [],
      };
      files.push(current);
      i++; // consumed the +++ line
      continue;
    }

    const hunkMatch = HUNK_HEADER.exec(line);
    if (hunkMatch && current) {
      finishHunk();
      currentHunk = {
        oldStart: Number(hunkMatch[1]),
        oldLines: hunkMatch[2] !== undefined ? Number(hunkMatch[2]) : 1,
        newStart: Number(hunkMatch[3]),
        newLines: hunkMatch[4] !== undefined ? Number(hunkMatch[4]) : 1,
        changes: [],
      };
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith('+')) {
      currentHunk.changes.push({ type: 'add', text: line.slice(1) });
    } else if (line.startsWith('-')) {
      currentHunk.changes.push({ type: 'remove', text: line.slice(1) });
    } else if (line.startsWith(' ') || line === '') {
      // an empty string here is a blank context line whose leading space
      // got trimmed somewhere between the producer and us
      currentHunk.changes.push({ type: 'context', text: line.slice(1) });
    } else if (line.startsWith('\\')) {
      // "\ No newline at end of file" - not a real line, ignore
    } else {
      // anything else (e.g. the start of the next file's "diff --git" block)
      // means this hunk is over
      finishHunk();
    }
  }
  finishHunk();

  return files;
}
