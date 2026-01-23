import type { Project } from '../shared/types';
import type { AssistantResponse, EducationResponse, GrammarResponse } from '../features/assistant/types';
import type { Entry, KBPatchPlan } from '../features/feed/types';
import type { ThreadResult, SavedThread } from '../features/threads/types';
import { request } from '../shared/api';

// Project API
export const projectsApi = {
  list: () => request<{ projects: Project[] }>('/projects'),

  create: (name: string, description?: string) =>
    request<{ project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  get: (id: string) => request<{ project: Project }>(`/projects/${id}`),
};

// Retrieval info returned with assistant responses
export interface RetrievalInfo {
  fallback: boolean;
  entryCount: number;
  entryIds?: string[];
  reasoning?: string;
  sources?: string[];
}

// Assistant API
export const assistantApi = {
  mod: (userInput: string, context?: string, projectId?: string) =>
    request<{ result: AssistantResponse; retrieval?: RetrievalInfo }>('/assistant/mod', {
      method: 'POST',
      body: JSON.stringify({ userInput, context, projectId }),
    }),

  education: (userInput: string, context?: string, projectId?: string) =>
    request<{ result: EducationResponse; retrieval?: RetrievalInfo }>('/assistant/education', {
      method: 'POST',
      body: JSON.stringify({ userInput, context, projectId }),
    }),

  grammar: (text: string) =>
    request<{ result: GrammarResponse }>('/assistant/grammar', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
};

// MCP Resource type
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPIngestResult {
  uri: string;
  success: boolean;
  entry?: Entry;
  error?: string;
}

// Feed API
export const feedApi = {
  ingest: (projectId: string, content: string, sources?: string[]) =>
    request<{ entries: Entry[]; count: number }>('/feed/ingest', {
      method: 'POST',
      body: JSON.stringify({ projectId, content, sources }),
    }),

  update: (projectId: string, instruction: string, targetEntryIds?: string[]) =>
    request<{ plan: KBPatchPlan; newEntry: Entry | null }>('/feed/update', {
      method: 'POST',
      body: JSON.stringify({ projectId, instruction, targetEntryIds }),
    }),

  delete: (projectId: string, entryIds: string[], hard?: boolean) =>
    request<{ deleted: string[]; action: string }>('/feed/delete', {
      method: 'POST',
      body: JSON.stringify({ projectId, entryIds, hard }),
    }),

  listEntries: (projectId: string) =>
    request<{ entries: Entry[] }>(`/feed/entries/${projectId}`),

  getKB: (projectId: string) => request<{ kb: string }>(`/feed/kb/${projectId}`),

  // MCP endpoints
  mcpExplore: (mcpUrl: string) =>
    request<{ resources: MCPResource[]; serverUrl: string }>('/feed/mcp/explore', {
      method: 'POST',
      body: JSON.stringify({ mcpUrl }),
    }),

  mcpIngest: (mcpUrl: string, projectId: string, resourceUris?: string[]) =>
    request<{
      summary: { total: number; success: number; failed: number };
      results: MCPIngestResult[];
    }>('/feed/mcp/ingest', {
      method: 'POST',
      body: JSON.stringify({ mcpUrl, projectId, resourceUris }),
    }),
};

// Threads API
export const threadsApi = {
  generate: (content: string, postCount?: number, constraints?: string) =>
    request<{ thread: ThreadResult }>('/threads/generate', {
      method: 'POST',
      body: JSON.stringify({ content, postCount, constraints }),
    }),

  save: (projectId: string, title: string, posts: string[], metadata?: any) =>
    request<{ threadId: string; saved: boolean }>('/threads/save', {
      method: 'POST',
      body: JSON.stringify({ projectId, title, posts, metadata }),
    }),

  list: (projectId: string) =>
    request<{ threads: SavedThread[] }>(`/threads/${projectId}`),
};
