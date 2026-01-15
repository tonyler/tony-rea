import type { Project } from '../shared/types';
import type { AssistantResponse, EducationResponse, GrammarResponse } from '../features/assistant/types';
import type { FeedIngestResult, Entry, KBPatchPlan } from '../features/feed/types';
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

// Assistant API
export const assistantApi = {
  mod: (userInput: string, context?: string, projectId?: string) =>
    request<{ result: AssistantResponse }>('/assistant/mod', {
      method: 'POST',
      body: JSON.stringify({ userInput, context, projectId }),
    }),

  education: (userInput: string, context?: string, projectId?: string) =>
    request<{ result: EducationResponse }>('/assistant/education', {
      method: 'POST',
      body: JSON.stringify({ userInput, context, projectId }),
    }),

  grammar: (text: string) =>
    request<{ result: GrammarResponse }>('/assistant/grammar', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
};

// Feed API
export const feedApi = {
  ingest: (projectId: string, content: string, sources?: string[]) =>
    request<{ entry: Entry; extracted: FeedIngestResult }>('/feed/ingest', {
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
