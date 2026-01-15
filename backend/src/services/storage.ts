import * as fs from 'fs/promises';
import * as path from 'path';
import { FeedIngestResult } from '../schemas/output-schemas';

const DATA_DIR = process.env.DATA_DIR || './data';
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');

// Project metadata interface
export interface ProjectMeta {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  description?: string;
}

// Entry interface
export interface Entry {
  id: string;
  created_at: string;
  data: FeedIngestResult;
  deprecated?: boolean;
  superseded_by?: string;
}

// Initialize storage directories
export async function initializeStorage() {
  try {
    await fs.mkdir(PROJECTS_DIR, { recursive: true });
    console.log('Storage initialized at:', PROJECTS_DIR);
  } catch (error) {
    console.error('Failed to initialize storage:', error);
    throw error;
  }
}

// Project operations
export async function createProject(name: string, description?: string): Promise<ProjectMeta> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const projectDir = path.join(PROJECTS_DIR, slug);

  // Check if project already exists
  try {
    await fs.access(projectDir);
    throw new Error('Project already exists');
  } catch (error) {
    // Project doesn't exist, continue
  }

  const meta: ProjectMeta = {
    id: slug,
    name,
    slug,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    description,
  };

  // Create project directories
  await fs.mkdir(projectDir, { recursive: true });
  await fs.mkdir(path.join(projectDir, 'entries'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'threads'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'archive', 'deprecated'), { recursive: true });

  // Write meta.json
  await fs.writeFile(
    path.join(projectDir, 'meta.json'),
    JSON.stringify(meta, null, 2)
  );

  // Create empty kb.md
  await fs.writeFile(
    path.join(projectDir, 'kb.md'),
    '# Knowledge Base\n\nNo entries yet.\n'
  );

  return meta;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  try {
    const dirs = await fs.readdir(PROJECTS_DIR);
    const projects: ProjectMeta[] = [];

    for (const dir of dirs) {
      try {
        const metaPath = path.join(PROJECTS_DIR, dir, 'meta.json');
        const metaContent = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(metaContent);
        projects.push(meta);
      } catch (error) {
        // Skip invalid project directories
        console.warn(`Skipping invalid project directory: ${dir}`);
      }
    }

    return projects.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  } catch (error) {
    return [];
  }
}

export async function getProject(projectId: string): Promise<ProjectMeta | null> {
  try {
    const metaPath = path.join(PROJECTS_DIR, projectId, 'meta.json');
    const metaContent = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(metaContent);
  } catch (error) {
    return null;
  }
}

// Entry operations
export async function createEntry(
  projectId: string,
  data: FeedIngestResult
): Promise<Entry> {
  const projectDir = path.join(PROJECTS_DIR, projectId);
  const entriesDir = path.join(projectDir, 'entries');

  // Check if project exists
  const meta = await getProject(projectId);
  if (!meta) {
    throw new Error('Project not found');
  }

  const entryId = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const entry: Entry = {
    id: entryId,
    created_at: new Date().toISOString(),
    data,
  };

  // Write entry file
  await fs.writeFile(
    path.join(entriesDir, `${entryId}.json`),
    JSON.stringify(entry, null, 2)
  );

  // Update project meta
  meta.updated_at = new Date().toISOString();
  await fs.writeFile(
    path.join(projectDir, 'meta.json'),
    JSON.stringify(meta, null, 2)
  );

  return entry;
}

export async function listEntries(projectId: string): Promise<Entry[]> {
  const entriesDir = path.join(PROJECTS_DIR, projectId, 'entries');

  try {
    const files = await fs.readdir(entriesDir);
    const entries: Entry[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const entryPath = path.join(entriesDir, file);
        const entryContent = await fs.readFile(entryPath, 'utf-8');
        const entry = JSON.parse(entryContent);
        entries.push(entry);
      } catch (error) {
        console.warn(`Skipping invalid entry file: ${file}`);
      }
    }

    return entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (error) {
    return [];
  }
}

export async function getEntry(projectId: string, entryId: string): Promise<Entry | null> {
  try {
    const entryPath = path.join(PROJECTS_DIR, projectId, 'entries', `${entryId}.json`);
    const entryContent = await fs.readFile(entryPath, 'utf-8');
    return JSON.parse(entryContent);
  } catch (error) {
    return null;
  }
}

export async function deprecateEntry(
  projectId: string,
  entryId: string,
  supersededBy?: string
): Promise<void> {
  const entryPath = path.join(PROJECTS_DIR, projectId, 'entries', `${entryId}.json`);
  const archivePath = path.join(PROJECTS_DIR, projectId, 'archive', 'deprecated', `${entryId}.json`);

  try {
    // Read entry
    const entryContent = await fs.readFile(entryPath, 'utf-8');
    const entry = JSON.parse(entryContent);

    // Mark as deprecated
    entry.deprecated = true;
    if (supersededBy) {
      entry.superseded_by = supersededBy;
    }

    // Move to archive
    await fs.writeFile(archivePath, JSON.stringify(entry, null, 2));
    await fs.unlink(entryPath);
  } catch (error) {
    console.error(`Failed to deprecate entry ${entryId}:`, error);
    throw error;
  }
}

export async function hardDeleteEntry(projectId: string, entryId: string): Promise<void> {
  const entryPath = path.join(PROJECTS_DIR, projectId, 'entries', `${entryId}.json`);

  try {
    await fs.unlink(entryPath);
  } catch (error) {
    console.error(`Failed to delete entry ${entryId}:`, error);
    throw error;
  }
}

// KB operations
export async function readKB(projectId: string): Promise<string> {
  try {
    const kbPath = path.join(PROJECTS_DIR, projectId, 'kb.md');
    return await fs.readFile(kbPath, 'utf-8');
  } catch (error) {
    return '';
  }
}

export async function writeKB(projectId: string, content: string): Promise<void> {
  const kbPath = path.join(PROJECTS_DIR, projectId, 'kb.md');
  await fs.writeFile(kbPath, content);
}

// Thread operations
export async function saveThread(
  projectId: string,
  title: string,
  posts: string[],
  metadata?: any
): Promise<string> {
  const threadsDir = path.join(PROJECTS_DIR, projectId, 'threads');
  const threadId = `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const thread = {
    id: threadId,
    title,
    posts,
    metadata,
    created_at: new Date().toISOString(),
  };

  await fs.writeFile(
    path.join(threadsDir, `${threadId}.json`),
    JSON.stringify(thread, null, 2)
  );

  return threadId;
}

export async function listThreads(projectId: string): Promise<any[]> {
  const threadsDir = path.join(PROJECTS_DIR, projectId, 'threads');

  try {
    const files = await fs.readdir(threadsDir);
    const threads: any[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const threadPath = path.join(threadsDir, file);
        const threadContent = await fs.readFile(threadPath, 'utf-8');
        const thread = JSON.parse(threadContent);
        threads.push(thread);
      } catch (error) {
        console.warn(`Skipping invalid thread file: ${file}`);
      }
    }

    return threads.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (error) {
    return [];
  }
}
