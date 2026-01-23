import { z } from 'zod';

/**
 * Project configuration schema for Discord monitoring
 */
export const ProjectConfigSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  serverId: z.string().min(1, 'Server ID is required'),
  whitelistedChannels: z.array(z.string()).default([]),
  monitoredChannels: z.array(z.string()).default([]),
  trackedUsers: z.array(z.string()).min(1, 'At least one tracked user is required'),
  enabled: z.boolean().default(true),
  minMessageLength: z.number().min(1).default(20),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

/**
 * Classification result schema
 */
export const ClassificationResultSchema = z.object({
  isKnowledge: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string(),
  suggestedTitle: z.string().optional(),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

/**
 * Queued message for processing
 */
export interface QueuedMessage {
  id: string;
  projectId: string;
  serverId: string;
  channelId: string;
  authorId: string;
  authorTag: string;
  content: string;
  timestamp: Date;
  isWhitelisted: boolean;
  messageUrl: string;
}

/**
 * Processing result
 */
export interface ProcessingResult {
  success: boolean;
  action: 'created' | 'updated' | 'superseded' | 'skipped' | 'failed';
  entryId?: string;
  error?: string;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
