import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface Session {
  id: string;
  discordId: string;
  username: string;
  avatar: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  createdAt: number;
}

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

// Lazy initialization - resolved after env is loaded
let SESSIONS_DIR: string | null = null;

function getSessionsDir(): string {
  if (!SESSIONS_DIR) {
    const DATA_DIR = process.env.DATA_DIR || './data';
    SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
  }
  return SESSIONS_DIR;
}

async function ensureSessionsDir(): Promise<void> {
  await fs.mkdir(getSessionsDir(), { recursive: true });
}

// Initialize sessions - call after env is loaded
export async function initializeSessions(): Promise<void> {
  await ensureSessionsDir();
  try {
    const files = await fs.readdir(getSessionsDir());
    const sessionCount = files.filter(f => f.endsWith('.json')).length;
    console.log(`Sessions initialized at: ${getSessionsDir()} (${sessionCount} active sessions)`);
  } catch {
    console.log(`Sessions initialized at: ${getSessionsDir()} (new directory)`);
  }
}

function getSessionPath(sessionId: string): string {
  return path.join(getSessionsDir(), `${sessionId}.json`);
}

export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(data: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
  await ensureSessionsDir();

  const session: Session = {
    id: generateSessionId(),
    ...data,
    createdAt: Date.now(),
  };

  await fs.writeFile(getSessionPath(session.id), JSON.stringify(session, null, 2));
  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  try {
    const data = await fs.readFile(getSessionPath(sessionId), 'utf-8');
    const session: Session = JSON.parse(data);

    // Check if session is expired
    if (Date.now() - session.createdAt > SESSION_TTL) {
      await deleteSession(sessionId);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await fs.unlink(getSessionPath(sessionId));
  } catch {
    // Ignore if already deleted
  }
}

export async function cleanExpiredSessions(): Promise<void> {
  await ensureSessionsDir();

  try {
    const files = await fs.readdir(getSessionsDir());

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const sessionId = file.replace('.json', '');
      const session = await getSession(sessionId);

      // getSession already handles deletion of expired sessions
      if (!session) continue;
    }
  } catch {
    // Ignore errors during cleanup
  }
}
