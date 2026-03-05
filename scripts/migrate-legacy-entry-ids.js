#!/usr/bin/env node

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, 'data');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function slugifyTitle(title) {
  const raw = normalizeWhitespace(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  if (!raw || /^entry(?:-|$)/.test(raw) || /^untitled(?:-|$)/.test(raw)) {
    return 'knowledge-update';
  }
  return raw;
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generateUniqueId(entriesDir, title) {
  const base = slugifyTitle(title);
  let candidate = base;
  let counter = 1;

  while (await fileExists(path.join(entriesDir, `${candidate}.json`))) {
    candidate = `${base}-${counter}`;
    counter++;
  }
  return candidate;
}

function titleKey(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeSource(value) {
  return normalizeWhitespace(value).toLowerCase().replace(/\/+$/, '');
}

function hasSourceOverlap(a, b) {
  const setA = new Set((Array.isArray(a) ? a : []).map(normalizeSource).filter(Boolean));
  if (setA.size === 0) return false;
  for (const source of Array.isArray(b) ? b : []) {
    if (setA.has(normalizeSource(source))) return true;
  }
  return false;
}

function sharedTagCount(a, b) {
  const setA = new Set((Array.isArray(a) ? a : []).map((x) => String(x).toLowerCase()));
  let count = 0;
  for (const tag of Array.isArray(b) ? b : []) {
    if (setA.has(String(tag).toLowerCase())) count++;
  }
  return count;
}

function tokenize(text) {
  return new Set(
    normalizeWhitespace(text)
      .toLowerCase()
      .replace(/[`*_>#~-]/g, ' ')
      .match(/[a-z0-9][a-z0-9'-]*/g) || []
  );
}

function jaccard(aSet, bSet) {
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let intersection = 0;
  for (const t of aSet) if (bSet.has(t)) intersection++;
  const union = aSet.size + bSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function likelyDuplicate(a, b) {
  if (titleKey(a.data.title) !== titleKey(b.data.title)) return false;

  if (hasSourceOverlap(a.data.sources, b.data.sources)) return true;

  if (
    a.data.date_detected &&
    b.data.date_detected &&
    a.data.date_detected === b.data.date_detected &&
    sharedTagCount(a.data.tags, b.data.tags) >= 2
  ) {
    return true;
  }

  const sim = jaccard(tokenize(a.data.full_content), tokenize(b.data.full_content));
  return sim >= 0.72;
}

function chooseCanonical(entryA, entryB) {
  const aIsLegacy = /^entry-/i.test(entryA.id);
  const bIsLegacy = /^entry-/i.test(entryB.id);
  if (aIsLegacy && !bIsLegacy) return entryB;
  if (!aIsLegacy && bIsLegacy) return entryA;

  const aDate = entryA.data.date_detected || entryA.created_at || '';
  const bDate = entryB.data.date_detected || entryB.created_at || '';
  return aDate >= bDate ? entryA : entryB;
}

async function loadEntries(entriesDir) {
  const files = (await fsp.readdir(entriesDir)).filter((f) => f.endsWith('.json'));
  const entries = [];
  for (const file of files) {
    const fullPath = path.join(entriesDir, file);
    try {
      const parsed = JSON.parse(await fsp.readFile(fullPath, 'utf8'));
      entries.push({ file, fullPath, entry: parsed });
    } catch (error) {
      console.warn(`[WARN] Skipping invalid JSON: ${fullPath}`);
    }
  }
  return entries;
}

async function rebuildKbIndex(projectId) {
  const { compileKBIndex } = require(path.join(ROOT_DIR, 'backend', 'dist', 'services', 'kb-compiler.js'));
  await compileKBIndex(projectId);
}

async function migrateProject(projectId) {
  const projectDir = path.join(PROJECTS_DIR, projectId);
  const entriesDir = path.join(projectDir, 'entries');
  const deprecatedDir = path.join(projectDir, 'archive', 'deprecated');

  if (!(await fileExists(entriesDir))) {
    console.log(`[SKIP] ${projectId}: no entries directory`);
    return { migrated: 0, deduped: 0, skipped: 0 };
  }

  await fsp.mkdir(deprecatedDir, { recursive: true });
  const rows = await loadEntries(entriesDir);
  const active = rows.map((row) => row.entry).filter((entry) => !entry.deprecated);

  let migrated = 0;
  let deduped = 0;
  let skipped = 0;

  for (const row of rows) {
    const current = row.entry;
    if (current.deprecated) continue;
    if (!/^entry-/i.test(current.id)) continue;
    const oldId = current.id;

    const duplicate = active.find((candidate) => {
      if (candidate.id === current.id || candidate.deprecated) return false;
      return likelyDuplicate(current, candidate);
    });

    if (duplicate) {
      const canonical = chooseCanonical(current, duplicate);
      if (canonical.id !== oldId) {
        current.deprecated = true;
        current.superseded_by = canonical.id;
        await fsp.writeFile(path.join(deprecatedDir, `${oldId}.json`), JSON.stringify(current, null, 2) + '\n');
        await fsp.unlink(path.join(entriesDir, `${oldId}.json`));
        deduped++;
        continue;
      }
    }

    const nextId = await generateUniqueId(entriesDir, current.data.title || '');
    if (!nextId) {
      skipped++;
      continue;
    }

    current.id = nextId;
    const nextPath = path.join(entriesDir, `${nextId}.json`);
    await fsp.writeFile(nextPath, JSON.stringify(current, null, 2) + '\n');
    await fsp.unlink(path.join(entriesDir, `${oldId}.json`));
    migrated++;
  }

  await rebuildKbIndex(projectId);
  return { migrated, deduped, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  let projects = [];
  if (args.length > 0) {
    projects = args;
  } else {
    const all = await fsp.readdir(PROJECTS_DIR);
    for (const name of all) {
      if (await fileExists(path.join(PROJECTS_DIR, name, 'entries'))) {
        projects.push(name);
      }
    }
  }

  let totalMigrated = 0;
  let totalDeduped = 0;
  let totalSkipped = 0;

  for (const projectId of projects) {
    const result = await migrateProject(projectId);
    totalMigrated += result.migrated;
    totalDeduped += result.deduped;
    totalSkipped += result.skipped;
    console.log(
      `[DONE] ${projectId}: migrated=${result.migrated} deduped=${result.deduped} skipped=${result.skipped}`
    );
  }

  console.log(`[SUMMARY] migrated=${totalMigrated} deduped=${totalDeduped} skipped=${totalSkipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
