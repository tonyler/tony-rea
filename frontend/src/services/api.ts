import type { Project } from '../shared/types';
import type { AssistantResponse, EducationResponse, GrammarResponse } from '../features/assistant/types';
import type { Entry, KBPatchPlan } from '../features/feed/types';
import type { ThreadResult, SavedThread } from '../features/threads/types';
import type { ArticleResult, ArticleSummary, VoiceSummary, LLMConfig } from '../features/articles/types';
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
  ingest: (projectId: string, content: string, sources?: string[], tags?: string[]) =>
    request<{ entries: Entry[]; count: number; suggestedNewTags?: string[] }>('/feed/ingest', {
      method: 'POST',
      body: JSON.stringify({ projectId, content, sources, tags }),
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

  updateTags: (projectId: string, entryId: string, tags: string[]) =>
    request<{ entry: Entry }>(`/feed/entries/${projectId}/${entryId}/tags`, {
      method: 'PATCH',
      body: JSON.stringify({ tags }),
    }),

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

// Pending Tag type
export interface PendingTag {
  tag: string;
  proposedAt: string;
  source: 'llm' | 'user';
  count: number;
}

// Tags API
export const tagsApi = {
  getAll: () =>
    request<{
      tags: string[];
      counts: { total: number; predefined: number; userAdded: number; pending: number };
    }>('/tags'),

  getPending: () =>
    request<{ tags: PendingTag[]; count: number }>('/tags/pending'),

  accept: (tag: string) =>
    request<{ message: string; tag: string }>('/tags/accept', {
      method: 'POST',
      body: JSON.stringify({ tag }),
    }),

  reject: (tag: string) =>
    request<{ message: string; tag: string }>('/tags/reject', {
      method: 'POST',
      body: JSON.stringify({ tag }),
    }),

  add: (tag: string) =>
    request<{ message: string; tag: string }>('/tags/add', {
      method: 'POST',
      body: JSON.stringify({ tag }),
    }),

  acceptAll: () =>
    request<{ message: string; tags: string[] }>('/tags/accept-all', {
      method: 'POST',
    }),

  rejectAll: () =>
    request<{ message: string; tags: string[] }>('/tags/reject-all', {
      method: 'POST',
    }),
};

// Articles API
export const articlesApi = {
  generate: (voiceHandle: string, content: string, wordCount?: number, constraints?: string, projectId?: string, llmConfig?: LLMConfig) =>
    request<ArticleResult>('/articles/generate', {
      method: 'POST',
      body: JSON.stringify({
        voiceHandle, content, wordCount, constraints, projectId,
        ...(llmConfig ? {
          searchMode: llmConfig.searchMode,
          draftModel: llmConfig.draftModel,
          revisionModel: llmConfig.revisionModel,
          councilMode: llmConfig.councilMode,
          judges: llmConfig.judges,
        } : {}),
      }),
    }),

  revise: (articleId: string, instruction: string, preserveDebate: boolean) =>
    request<ArticleResult>(`/articles/${articleId}/revise`, {
      method: 'POST',
      body: JSON.stringify({ instruction, preserveDebate }),
    }),

  save: (article: ArticleResult) =>
    request<{ saved: boolean; id: string }>('/articles/save', {
      method: 'POST',
      body: JSON.stringify(article),
    }),

  list: () =>
    request<{ articles: ArticleSummary[] }>('/articles'),

  get: (id: string) =>
    request<ArticleResult>(`/articles/${id}`),
};

// Voices API
export const voicesApi = {
  list: () => request<{ voices: VoiceSummary[] }>('/voices'),

  get: (handle: string) => request<VoiceSummary>(`/voices/${encodeURIComponent(handle)}`),

  refresh: (handle: string) =>
    request<VoiceSummary>(`/voices/${encodeURIComponent(handle)}/refresh`, {
      method: 'POST',
    }),
};
