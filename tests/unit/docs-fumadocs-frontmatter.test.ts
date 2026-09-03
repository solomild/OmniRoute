/**
 * Regression guard: every Markdown file inside a fumadocs `defineDocs`
 * collection must carry YAML frontmatter, otherwise `next build` fails with
 * `[MDX] invalid frontmatter in <file>` (live incident: run 33747017961 failed
 * on docs/reference/REMOVED_PROVIDERS.md, added without frontmatter in #12478).
 *
 * Source of truth for which dirs are fumadocs collections: source.config.ts
 * (`defineDocs({ dir: "docs", docs: { files: [...] } })`). This test mirrors
 * those globs instead of hardcoding them where cheap: it scans the `docs/`
 * subdirs named by the globs' first segment (architecture, guides, reference,
 * frameworks, routing, security, compression, ops) and requires a leading
 * `---` frontmatter block with at least a `title:` key.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../");

// First path segment of each glob in source.config.ts `docs.files`.
const FUMADOCS_DIRS = [
  "architecture",
  "guides",
  "reference",
  "frameworks",
  "routing",
  "security",
  "compression",
  "ops",
];

function listMarkdown(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) listMarkdown(full, out);
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

function readFrontmatter(file: string): string | null {
  const raw = readFileSync(file, "utf8");
  if (!raw.startsWith("---")) return null;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return null;
  return raw.slice(3, end);
}

const files = FUMADOCS_DIRS.flatMap((d) => listMarkdown(join(REPO_ROOT, "docs", d)));

test("fumadocs collections are non-empty (sanity)", () => {
  assert.ok(files.length > 50, `expected >50 docs, found ${files.length}`);
});

for (const file of files) {
  const rel = file.slice(REPO_ROOT.length + 1);
  test(`frontmatter present in ${rel}`, () => {
    const fm = readFrontmatter(file);
    assert.ok(fm !== null, `${rel} has no YAML frontmatter block — next build fails with [MDX] invalid frontmatter`);
    assert.ok(/^title:/m.test(fm), `${rel} frontmatter has no title: key`);
  });
}
