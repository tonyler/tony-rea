import * as fs from 'fs';
import * as path from 'path';

interface Whitelist {
  allowedUserIds: string[];
}

const WHITELIST_PATH = path.join(__dirname, '../../wl.json');

let cachedWhitelist: Whitelist | null = null;
let lastModified = 0;

function loadWhitelist(): Whitelist {
  try {
    const stat = fs.statSync(WHITELIST_PATH);

    // Reload if file was modified
    if (cachedWhitelist && stat.mtimeMs === lastModified) {
      return cachedWhitelist;
    }

    const data = fs.readFileSync(WHITELIST_PATH, 'utf-8');
    cachedWhitelist = JSON.parse(data);
    lastModified = stat.mtimeMs;

    return cachedWhitelist!;
  } catch (error) {
    console.error('Failed to load whitelist:', error);
    return { allowedUserIds: [] };
  }
}

export function isUserWhitelisted(discordId: string): boolean {
  const whitelist = loadWhitelist();
  return whitelist.allowedUserIds.includes(discordId);
}

export function getWhitelistedUsers(): string[] {
  const whitelist = loadWhitelist();
  return whitelist.allowedUserIds;
}
