#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseUnifiedDiff } from './diff-parser.js';
import type { FileDiff } from './diff-parser.js';
import { traceLine, getContextLines } from './line-tracker.js';
import type { Side } from './line-tracker.js';

const USAGE = `Usage: diff-line-tracker --file <path> --line <n> [--side old|new] [--context <n>] [diff-file]

Reads a unified diff from <diff-file>, or from stdin if it's omitted, and
reports where the given line ends up on the other side of the diff.

--side selects which side <n> refers to (default: old).
--context prints <n> lines before and after the target line, as recorded in
the enclosing hunk (unavailable if the line falls outside every hunk).

Examples:
  git diff | diff-line-tracker --file src/app.ts --line 42
  diff-line-tracker --file src/app.ts --line 108 --side new patch.diff
  git diff | diff-line-tracker --file src/app.ts --line 42 --context 2
`;

function fail(message: string): never {
  process.stderr.write(`${message}\n\n${USAGE}`);
  process.exit(1);
}

interface Args {
  file: string;
  line: number;
  side: Side;
  context: number;
  diffPath: string | null;
}

function parseArgs(argv: string[]): Args {
  let file: string | null = null;
  let line: number | null = null;
  let side: Side = 'old';
  let context = 0;
  let diffPath: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(USAGE);
      process.exit(0);
    } else if (arg === '--file') {
      file = argv[++i] ?? null;
    } else if (arg === '--line') {
      const raw = argv[++i];
      line = raw === undefined ? NaN : Number(raw);
    } else if (arg === '--side') {
      const raw = argv[++i];
      if (raw !== 'old' && raw !== 'new') fail(`--side must be "old" or "new", got ${JSON.stringify(raw)}`);
      side = raw;
    } else if (arg === '--context') {
      const raw = argv[++i];
      context = raw === undefined ? NaN : Number(raw);
      if (!Number.isInteger(context) || context < 0) fail(`--context must be a non-negative integer, got ${JSON.stringify(raw)}`);
    } else if (!arg.startsWith('--')) {
      diffPath = arg;
    } else {
      fail(`unknown option ${arg}`);
    }
  }

  if (!file) fail('--file is required');
  if (line === null || !Number.isInteger(line) || line < 1) fail('--line must be a positive integer');

  return { file, line, side, context, diffPath };
}

function readDiffSource(diffPath: string | null): string {
  // fd 0 is stdin; reading it directly avoids pulling in a streaming API
  // for what is normally a small patch file
  return diffPath ? readFileSync(diffPath, 'utf8') : readFileSync(0, 'utf8');
}

function findFile(files: FileDiff[], target: string): FileDiff | undefined {
  return files.find((f) => f.oldPath === target || f.newPath === target);
}

function printContext(match: FileDiff, line: number, side: Side, context: number): void {
  const lines = getContextLines(match.hunks, line, side, context);
  if (lines === null) {
    console.log(`  (no context available - line ${line} falls outside every hunk)`);
    return;
  }
  for (const l of lines) {
    const pointer = l.line === line ? '>' : ' ';
    console.log(`${pointer} ${l.marker}${String(l.line).padStart(6)} | ${l.text}`);
  }
}

function main(): void {
  const { file, line, side, context, diffPath } = parseArgs(process.argv.slice(2));
  const diffText = readDiffSource(diffPath);
  const files = parseUnifiedDiff(diffText);
  const match = findFile(files, file);

  if (!match) {
    process.stderr.write(`no diff found for file "${file}"\n`);
    process.exit(1);
  }

  const result = traceLine(match, line, side);
  const otherSide: Side = side === 'old' ? 'new' : 'old';

  if (result.line === null) {
    const verb = result.status === 'deleted' ? 'was deleted' : 'did not exist before this diff';
    console.log(`${file}:${line} (${side}) -> ${verb}`);
  } else {
    console.log(`${file}:${line} (${side}) -> ${file}:${result.line} (${otherSide}) [${result.status}]`);
  }

  if (context > 0) {
    printContext(match, line, side, context);
  }
}

main();
