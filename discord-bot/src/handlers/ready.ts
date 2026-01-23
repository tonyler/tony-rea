import { Client } from 'discord.js';
import { createLogger } from '../services/logger';
import { getAllServerIds } from '../config';

const logger = createLogger('ReadyHandler');

/**
 * Handle the bot ready event
 */
export function handleReady(client: Client): void {
  if (!client.user) {
    logger.error('Bot user not available');
    return;
  }

  logger.info('Bot is ready', {
    username: client.user.tag,
    userId: client.user.id,
    guilds: client.guilds.cache.size,
  });

  // Log connected servers
  const configuredServers = getAllServerIds();
  const connectedServers = client.guilds.cache.map((g) => ({
    id: g.id,
    name: g.name,
    configured: configuredServers.includes(g.id),
  }));

  logger.info('Connected servers', { servers: connectedServers });

  // Warn about configured but not connected servers
  for (const serverId of configuredServers) {
    if (!client.guilds.cache.has(serverId)) {
      logger.warn('Configured server not connected', { serverId });
    }
  }

  // Set bot presence
  client.user.setPresence({
    status: 'online',
    activities: [
      {
        name: 'for knowledge',
        type: 3, // Watching
      },
    ],
  });
}
