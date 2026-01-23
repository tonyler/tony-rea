import * as fs from 'fs';
import * as path from 'path';
import { ProjectConfig, ProjectConfigSchema } from '../types';
import { env } from './env';

export { env } from './env';

const CONFIG_DIR = path.join(__dirname, '../../config');

// Cache for loaded configs
const configCache = new Map<string, ProjectConfig>();

/**
 * Load all project configurations
 */
export function loadAllConfigs(): Map<string, ProjectConfig> {
  const configs = new Map<string, ProjectConfig>();

  if (!fs.existsSync(CONFIG_DIR)) {
    console.warn(`Config directory not found: ${CONFIG_DIR}`);
    return configs;
  }

  const files = fs.readdirSync(CONFIG_DIR);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const filePath = path.join(CONFIG_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      const validated = ProjectConfigSchema.parse(parsed);

      if (validated.enabled) {
        configs.set(validated.projectId, validated);
        configCache.set(validated.projectId, validated);
        console.log(`Loaded config for project: ${validated.projectId}`);
      }
    } catch (error) {
      console.error(`Failed to load config ${file}:`, error);
    }
  }

  return configs;
}

/**
 * Get config for a specific project
 */
export function getProjectConfig(projectId: string): ProjectConfig | undefined {
  return configCache.get(projectId);
}

/**
 * Find project config by server ID and channel ID
 */
export function findConfigForChannel(
  serverId: string,
  channelId: string
): { config: ProjectConfig; isWhitelisted: boolean } | null {
  for (const config of configCache.values()) {
    if (config.serverId !== serverId) continue;

    // Check if channel is whitelisted
    if (config.whitelistedChannels.includes(channelId)) {
      return { config, isWhitelisted: true };
    }

    // Check if channel is monitored
    if (config.monitoredChannels.includes(channelId)) {
      return { config, isWhitelisted: false };
    }
  }

  return null;
}

/**
 * Check if a user is tracked in a project
 */
export function isTrackedUser(projectId: string, userId: string): boolean {
  const config = configCache.get(projectId);
  if (!config) return false;
  return config.trackedUsers.includes(userId);
}

/**
 * Get all server IDs from configs (for Discord intents)
 */
export function getAllServerIds(): string[] {
  const serverIds = new Set<string>();
  for (const config of configCache.values()) {
    serverIds.add(config.serverId);
  }
  return Array.from(serverIds);
}

/**
 * Reload all configurations
 */
export function reloadConfigs(): void {
  configCache.clear();
  loadAllConfigs();
}
